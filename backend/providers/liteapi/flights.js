// backend/providers/liteapi/flights.js
// Thin adapter so Atlas can use the same LiteAPI flight code as the
// regular checkout (routes/api/flights). It only reshapes data; search
// caching, retries and test-airline filtering all come from runSearch.

import { liteApiFlights } from "../../routes/api/flights/Liteapiflights.provider.js";
import { runSearch } from "../../routes/api/flights/Liteapiflights.controller.js";
import {
  buildVerifyPayload,
  buildPrebookPayload,
} from "../../routes/api/flights/Liteapiflights.utils.js";

function durationText(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// Frontend flight shape (toFrontendFlightShape) → the shape Atlas reads.
function toAtlasOffer(f) {
  const outbound = f.slices?.[0] || {};
  const segments = (outbound.segments || []).map((s) => ({
    origin: s.origin,
    destination: s.destination,
    departTime: s.departureTime,
    arriveTime: s.arrivalTime,
    // marketingNumber may or may not already carry the airline code
    flightNumber: /[A-Z]/i.test(String(s.flightNumber || ""))
      ? String(s.flightNumber)
      : [s.carrierCode, s.flightNumber].filter(Boolean).join(""),
    carrier: s.carrier,
  }));
  return {
    offerId: f.offerId,
    airlineName: f.owner,
    airlineCode: f.ownerCode,
    segments,
    returnSlice: f.slices?.[1] || null,
    durationText: durationText(f.totalDurationMinutes),
    baggageSummary: null, // not in search results; LiteAPI lists bags at prebook
    price: { total: Number(f.totalAmount), currency: f.totalCurrency || "USD" },
    expiresAt: f.fareExpiresAt,
    // The exact object the Book page passes to <BookingCheckout flight={...}>,
    // so an Atlas "Review & pay" link opens the normal checkout on it.
    frontend: f,
  };
}

/**
 * @param {{origin, destination, departDate, returnDate?, adults, children?, cabin?, flightNumbers?}} input
 * @returns {Promise<object[]>} offers in Atlas shape. With flightNumbers,
 *   only offers flying exactly those flights (used to re-check a friend's flight).
 */
export async function searchFlights(input = {}) {
  const params = {
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departDate || input.departureDate,
    returnDate: input.returnDate,
    adults: input.adults ? Number(input.adults) : 1,
    children: input.children ? Number(input.children) : undefined,
    cabinClass: input.cabin || input.cabinClass,
  };
  const { flights } = await runSearch(params);
  let offers = (flights || []).filter((f) => f.offerId).map(toAtlasOffer);

  if (input.flightNumbers?.length) {
    const want = input.flightNumbers.map((n) => String(n).replace(/\s+/g, "").toUpperCase());
    offers = offers.filter((o) => {
      const have = o.segments.map((s) => s.flightNumber.toUpperCase());
      return have.length === want.length && want.every((n, i) => have[i] === n);
    });
  }
  return offers;
}

export async function verifyFlightOffer(offerId) {
  const { data } = await liteApiFlights.post("/flights/verify", buildVerifyPayload({ offerId }));
  return data;
}

function firstNumber(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

export async function createFlightPrebook({ offerId, passengers, contact }) {
  const payload = buildPrebookPayload({ offerId, passengers, contact });
  const { data } = await liteApiFlights.post("/flights/prebooks", payload, { _noRetry: true });
  const d = data?.data ?? data ?? {};

  const prebookId = d.prebookId ?? d.prebookID ?? d.id;
  const total = firstNumber(
    d.price?.total,
    d.price?.amount,
    d.pricing?.display?.total,
    d.pricing?.total,
    d.totalAmount,
    d.totalPrice
  );
  const currency = d.price?.currency ?? d.pricing?.display?.currency ?? d.currency ?? "USD";

  // Never let Atlas propose a charge we couldn't read from LiteAPI.
  if (!prebookId || !Number.isFinite(total)) {
    const err = new Error("Flight prebook response missing prebookId or price");
    err.details = data;
    throw err;
  }
  return { prebookId, price: { total, currency }, fareRulesText: d.fareRulesText ?? null, raw: data };
}
