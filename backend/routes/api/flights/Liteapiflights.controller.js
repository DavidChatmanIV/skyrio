import { liteApiFlights } from "./Liteapiflights.provider.js";
import {
  buildLiteApiSearchPayload,
  buildVerifyPayload,
  buildPrebookPayload,
  buildAttachServicesPayload,
  buildCompleteBookingPayload,
  normalizeFlightSearchResponse,
  toFrontendFlightShape,
} from "./Liteapiflights.utils.js";

// ---------------------------------------------------------------------
// Short-TTL cache for identical searches (double-clicks, back button,
// two travelers searching the same route). Not a real pricing cache —
// intentionally short.
// ---------------------------------------------------------------------
const SEARCH_CACHE = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

function buildCacheKey(params) {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    adults,
    children,
    cabinClass,
  } = params;
  return [
    origin,
    destination,
    departureDate,
    returnDate || "",
    adults || 1,
    children || 0,
    cabinClass || "economy",
  ]
    .join("|")
    .toLowerCase();
}

function getCachedFlights(cacheKey) {
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.flights;
  return null;
}

function setCachedFlights(cacheKey, flights) {
  SEARCH_CACHE.set(cacheKey, { ts: Date.now(), flights });
}

function resolveSearchParams(source) {
  const {
    from,
    to,
    departDate,
    returnDate,
    adults,
    children,
    cabin,
    origin,
    destination,
    departureDate,
    cabinClass,
  } = source;

  return {
    origin: origin || from,
    destination: destination || to,
    departureDate: departureDate || departDate,
    returnDate,
    adults: adults ? Number(adults) : undefined,
    children: children ? Number(children) : undefined,
    cabinClass: cabinClass || cabin,
  };
}

/**
 * GET/POST /api/flights/search
 * Plain request/response — no streaming. Waits for LiteAPI's full
 * response, normalizes it, returns everything at once.
 */
export async function searchFlights(req, res) {
  try {
    const source = req.method === "GET" ? req.query : req.body;
    const params = resolveSearchParams(source);

    if (!params.origin || !params.destination || !params.departureDate) {
      return res.status(400).json({
        ok: false,
        message:
          "origin/from, destination/to, and departureDate/departDate are required",
      });
    }

    const cacheKey = buildCacheKey(params);
    const cached = getCachedFlights(cacheKey);
    if (cached) {
      return res.status(200).json({ ok: true, flights: cached, cached: true });
    }

    const payload = buildLiteApiSearchPayload(params);
    console.log("[flights/search] payload:", JSON.stringify(payload));

    const { data } = await liteApiFlights.post("/flights/rates", payload);

    // Temporary — keep this until we've confirmed live response shape
    // a few times, then trim it down. Cheap insurance against another
    // silent-empty-array debugging session.
    console.log(
      "[flights/search] raw response top-level keys:",
      Object.keys(data || {})
    );

    const results = normalizeFlightSearchResponse(data);
    const flights = results.map(toFrontendFlightShape);

    console.log(`[flights/search] normalized ${flights.length} flight(s)`);

    setCachedFlights(cacheKey, flights);

    return res.status(200).json({ ok: true, flights });
  } catch (err) {
    console.error(
      "[flights/search] failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      ok: false,
      message: err?.response?.data?.message || err.message,
    });
  }
}

/**
 * Step 1 of 4 — confirm the offer is still valid and get latest pricing.
 */
export async function verifyOffer(req, res) {
  try {
    const { offerId } = req.body;
    if (!offerId) {
      return res
        .status(400)
        .json({ ok: false, message: "offerId is required" });
    }

    const payload = buildVerifyPayload({ offerId });
    const { data } = await liteApiFlights.post("/flights/verify", payload);
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    console.error(
      "[flights/verify] failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      ok: false,
      message: err?.response?.data?.error?.message || err.message,
    });
  }
}

/**
 * Step 2 of 4 — reserve the offer with the provider, create a payment
 * intent (when usePaymentSdk is true). Returns a prebookId.
 */
export async function createPrebook(req, res) {
  try {
    const {
      offerId,
      contact,
      passengers,
      usePaymentSdk,
      includeCreditBalance,
      payment,
    } = req.body;

    if (!offerId || !contact || !passengers) {
      return res.status(400).json({
        ok: false,
        message: "offerId, contact, and passengers are required",
      });
    }

    const payload = buildPrebookPayload({
      offerId,
      contact,
      passengers,
      usePaymentSdk,
      includeCreditBalance,
      payment,
    });

    const { data } = await liteApiFlights.post("/flights/prebooks", payload);
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    console.error(
      "[flights/prebook] failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      ok: false,
      message: err?.response?.data?.error?.message || err.message,
    });
  }
}

/**
 * Step 3 of 4 (optional) — attach seats/bags to an existing prebook.
 */
export async function attachPrebookServices(req, res) {
  try {
    const { prebookId } = req.params;
    const { selectedServices, voucherCode } = req.body;

    if (!prebookId) {
      return res
        .status(400)
        .json({ ok: false, message: "prebookId is required" });
    }
    if (!selectedServices) {
      return res
        .status(400)
        .json({ ok: false, message: "selectedServices is required" });
    }

    const payload = buildAttachServicesPayload({
      selectedServices,
      voucherCode,
    });
    const { data } = await liteApiFlights.post(
      `/flights/prebooks/${prebookId}/services`,
      payload
    );
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    console.error(
      "[flights/prebook/services] failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      ok: false,
      message: err?.response?.data?.error?.message || err.message,
    });
  }
}

/**
 * Step 4 of 4 — finalize the booking. Field name is `prebookID` (capital
 * ID), confirmed via a live LiteAPI validation error.
 */
export async function completeBooking(req, res) {
  try {
    // Accept either casing from the frontend — LiteAPI's official docs say
    // `prebookId`, but an earlier live 45013 error suggested `prebookID`.
    // Forward whichever LiteAPI actually wants once confirmed; for now,
    // send prebookId (per docs) as the canonical field.
    const { prebookId, prebookID, ...rest } = req.body;
    const resolvedPrebookId = prebookId || prebookID;
    if (!resolvedPrebookId) {
      return res
        .status(400)
        .json({ ok: false, message: "prebookId is required" });
    }

    const payload = buildCompleteBookingPayload({
      prebookId: resolvedPrebookId,
      ...rest,
    });
    const { data } = await liteApiFlights.post("/flights/bookings", payload);
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    console.error(
      "[flights/complete] failed:",
      err?.response?.data || err.message
    );
    return res.status(502).json({
      ok: false,
      message: err?.response?.data?.error?.message || err.message,
    });
  }
}
