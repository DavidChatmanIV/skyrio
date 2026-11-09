// backend/routes/api/flights/Duffelflights.provider.js
// Duffel Flights — second flight supplier next to LiteAPI.
//
// OFF unless DUFFEL_FLIGHTS_ENABLED=true AND DUFFEL_ACCESS_TOKEN is set.
// While off, nothing in this file is called and flights work exactly as before.
//
// Duffel offers come back in the SAME frontend shape as LiteAPI
// (see Duffelflights.utils.js), tagged provider: "duffel".

import axios from "axios";
import {
  buildDuffelSearchPayload,
  duffelOfferToFrontendShape,
} from "./Duffelflights.utils.js";

const BASE_URL = "https://api.duffel.com";
// Duffel waits this long for airlines, then returns what it has.
// Must stay below the HTTP timeout so we get partial results, not nothing.
const SUPPLIER_TIMEOUT_MS = 25 * 1000;
const HTTP_TIMEOUT_MS = 35 * 1000;
// Duffel can return hundreds of offers; keep the cheapest ones.
const MAX_DUFFEL_OFFERS = 200;

export function duffelFlightsEnabled() {
  return (
    String(process.env.DUFFEL_FLIGHTS_ENABLED).toLowerCase() === "true" &&
    Boolean(process.env.DUFFEL_ACCESS_TOKEN)
  );
}

export function isDuffelOfferId(offerId) {
  return /^off_/.test(String(offerId || ""));
}

export const duffelFlights = axios.create({
  baseURL: BASE_URL,
  timeout: HTTP_TIMEOUT_MS,
  headers: {
    "Duffel-Version": "v2",
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip",
  },
});

// Token read per request (not at import), so a missing token never crashes
// the server — Duffel just stays off.
duffelFlights.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`;
  return config;
});

// Log Duffel's real error body (errors[].code / message) instead of only
// "Request failed with status code 4xx".
duffelFlights.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response) {
      const first = err.response.data?.errors?.[0] || {};
      console.error(
        `[Duffel Flights] ${err.config?.method?.toUpperCase()} ${
          err.config?.url
        } -> ${err.response.status}`,
        JSON.stringify({ code: first.code, title: first.title, message: first.message })
      );
    } else {
      console.error("[Duffel Flights] request failed with no response:", err.message);
    }
    return Promise.reject(err);
  }
);

if (process.env.DUFFEL_ACCESS_TOKEN) {
  const mode = String(process.env.DUFFEL_ACCESS_TOKEN).startsWith("duffel_live_")
    ? "LIVE"
    : "test";
  console.log(
    `[Duffel Flights] token found (${mode} mode) — search ${
      duffelFlightsEnabled() ? "ON" : "OFF (set DUFFEL_FLIGHTS_ENABLED=true)"
    }`
  );
}

// Duffel error codes that mean "this fare is gone".
export function isDuffelSoldOut(err) {
  const status = err?.response?.status;
  const code = String(err?.response?.data?.errors?.[0]?.code || "");
  return (
    status === 404 ||
    /no_longer_available|offer_expired|expired|not_found|sold_out/i.test(code)
  );
}

/**
 * Search Duffel. Same params as runSearch():
 *   { origin, destination, departureDate, returnDate, adults, children, cabinClass }
 * Returns flights in the frontend shape (provider: "duffel"), USD only.
 */
export async function searchDuffelFlights(params) {
  // Duffel needs each child's real age to price the fare. Skyrio's search
  // only knows how many children, so we don't guess an age — LiteAPI
  // covers searches with children.
  if (Number(params?.children) > 0) {
    console.info("[Duffel Flights] skipped: search has children (ages unknown)");
    return [];
  }

  const payload = buildDuffelSearchPayload(params);
  const startedAt = Date.now();
  const { data } = await duffelFlights.post("/air/offer_requests", payload, {
    params: { return_offers: true, supplier_timeout: SUPPLIER_TIMEOUT_MS },
  });

  const offers = data?.data?.offers || [];
  const shaped = offers.map(duffelOfferToFrontendShape);
  // Only show fares we can price honestly next to LiteAPI's USD fares.
  const usd = shaped.filter(
    (f) => f.totalCurrency === "USD" && Number.isFinite(f.totalAmount) && f.totalAmount > 0
  );
  const dropped = shaped.length - usd.length;

  const kept = usd
    .sort((a, b) => a.totalAmount - b.totalAmount)
    .slice(0, MAX_DUFFEL_OFFERS);

  console.log(
    `[Duffel Flights] ${offers.length} offer(s) in ${Date.now() - startedAt}ms` +
      (dropped ? ` (${dropped} non-USD hidden)` : "") +
      ` → using ${kept.length}`
  );
  return kept;
}

/** Latest price/availability for one Duffel offer (used at verify). */
export async function getDuffelOffer(offerId) {
  const { data } = await duffelFlights.get(`/air/offers/${encodeURIComponent(offerId)}`, {
    timeout: 20 * 1000,
  });
  return data?.data || null;
}
