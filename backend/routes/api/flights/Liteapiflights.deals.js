// Where To Next — the deal scan's LiteAPI search.
//
// Lives next to the flights controller so it reuses the SAME payload
// builder and response normalizer as a real traveler search. That way a
// price on the map is calculated exactly like the price on the booking page.
//
// It does NOT use the controller's search cache on purpose: the scan runs
// dozens of searches and would push real travelers' cached results out.

import { liteApiFlights } from "./Liteapiflights.provider.js";
import {
  buildLiteApiSearchPayload,
  normalizeFlightSearchResponse,
  toFrontendFlightShape,
} from "./Liteapiflights.utils.js";

const DEAL_SEARCH_TIMEOUT_MS = 60 * 1000;

// Same price lookup the controller uses (priceOf), so the numbers match.
function priceOf(f) {
  const candidates = [
    f?.price?.total,
    f?.price?.amount,
    typeof f?.price === "number" || typeof f?.price === "string"
      ? f.price
      : null,
    f?.totalPrice,
    f?.total,
    f?.totalAmount,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (c != null && Number.isFinite(n)) return n;
  }
  return null;
}

function currencyOf(f) {
  return f?.price?.currency || f?.currency || f?.totalCurrency || "USD";
}

// Stops on the outbound flight (segments - 1), when the shape tells us.
function outboundStops(f) {
  const segs =
    f?.slices?.[0]?.segments || f?.outbound?.segments || f?.segments || null;
  return Array.isArray(segs) && segs.length ? segs.length - 1 : null;
}

function airlineOf(f) {
  const seg = f?.slices?.[0]?.segments?.[0];
  return (
    f?.owner?.name ||
    (typeof f?.owner === "string" ? f.owner : null) ||
    f?.airline ||
    seg?.marketingCarrierName ||
    seg?.carrierName ||
    null
  );
}

/**
 * Cheapest round-trip fare for 1 adult, economy.
 * Returns { price, currency, airline, stops } or null if nothing came back.
 */
export async function searchCheapestFare({
  origin,
  destination,
  departDate,
  returnDate,
}) {
  const params = {
    origin,
    destination,
    departureDate: departDate,
    returnDate,
    adults: 1,
    cabinClass: "economy",
  };

  const { data } = await liteApiFlights.post(
    "/flights/rates",
    buildLiteApiSearchPayload(params),
    { timeout: DEAL_SEARCH_TIMEOUT_MS, _noRetry: true }
  );

  const flights = normalizeFlightSearchResponse(data, params).map(
    toFrontendFlightShape
  );

  let best = null;
  for (const f of flights) {
    const price = priceOf(f);
    if (price == null || price <= 0) continue;
    if (!best || price < best.price) {
      best = {
        price,
        currency: currencyOf(f),
        airline: airlineOf(f),
        stops: outboundStops(f),
      };
    }
  }
  return best;
}
