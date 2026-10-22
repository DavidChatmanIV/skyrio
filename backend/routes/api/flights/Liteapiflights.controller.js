import jwt from "jsonwebtoken";
import { liteApiFlights } from "./Liteapiflights.provider.js";
import {
  extractFlightBookingId,
  extractFlightPnr,
} from "../../../services/liteapiBookings.js";
import {
  buildLiteApiSearchPayload,
  buildVerifyPayload,
  buildPrebookPayload,
  buildCompleteBookingPayload,
  normalizeFlightSearchResponse,
  toFrontendFlightShape,
  parsePrebookSeatOptions,
} from "./Liteapiflights.utils.js";
import { sendBookingConfirmation } from "../../../services/email.js";
import Booking from "../../../models/booking.js";
import User from "../../../models/user.js";
import Notification from "../../../models/notification.js";
import { awardXpForBooking } from "../../../services/xpService.js";
import { memberGroupId } from "../../../services/sharedRooms.js";
import {
  recordEmailResult,
  sendConfirmationFor,
  onGroupBookingSaved,
} from "../../../services/bookingConfirmations.js";

// ---------------------------------------------------------------------
// Search speed + fare freshness
//
// LiteAPI's sandbox can take ~50s to return a round-trip search. What we
// control:
//
//   1. Cache: an identical search is served instantly, but ONLY while its
//      fares still have enough life left for a traveler to finish checkout
//      (OFFER_MIN_REMAINING_MS). The cache adapts to each offer's real
//      expiry instead of a fixed age.
//   2. In-flight sharing: duplicate searches wait on the one already running.
//   3. Warm-up: POST /api/flights/warm starts the search early.
//   4. Fare refresh: if a chosen fare has expired (or LiteAPI calls it sold
//      out) at verify, we run a fresh search, find the SAME flight again,
//      verify the new offer and hand it back — the traveler keeps their
//      flight instead of starting over. This is how the big OTAs behave:
//      "We refreshed your fare" (+ a price-change notice if it moved).
//
// Every flight returned to the frontend carries `searchedAt` and
// `expiresAt`, so the UI can show an honest timer and refresh on its own.
// ---------------------------------------------------------------------
const SEARCH_CACHE = new Map(); // cacheKey -> { ts, flights, params }
const INFLIGHT_SEARCHES = new Map();

// LiteAPI offers live ~13-15 min. Used when an offer has no expiration field.
const OFFER_LIFETIME_MS = 13 * 60 * 1000;
// A cached list is reused only if its soonest-expiring fare still has at
// least this long left — enough to browse, fill passenger details and pay.
const OFFER_MIN_REMAINING_MS =
  Number(process.env.FLIGHT_OFFER_MIN_REMAINING_MS) || 10 * 60 * 1000;
// Hard cap on cache age regardless of offer expiry.
const CACHE_TTL_MS =
  Number(process.env.FLIGHT_SEARCH_CACHE_TTL_MS) || 4 * 60 * 1000;
// If LiteAPI fails, recent results are shown instead of an error — but
// only if their fares still have this long left.
const STALE_MIN_REMAINING_MS = 6 * 60 * 1000;
// A fare this close to expiry is treated as expired at verify.
const EXPIRY_GRACE_MS = 30 * 1000;

// Total time a traveler can wait for one search, including the retry.
const SEARCH_BUDGET_MS = 80 * 1000;
const FIRST_ATTEMPT_TIMEOUT_MS = 50 * 1000;
const MIN_RETRY_WINDOW_MS = 15 * 1000;
// A search that just failed on BOTH attempts usually fails again.
const FAILED_SEARCH_TTL_MS = 3 * 60 * 1000;
const FAILED_SEARCHES = new Map(); // cacheKey -> { ts, err }
const CACHE_MAX_ENTRIES = 200;
const RETRY_DELAY_MS = 1500;

// LiteAPI error codes we handle specifically.
const CODE_SOLD_OUT = 52010;
const CODE_SEARCH_FAILED = 51099;
const CODE_VERIFY_FAILED = 52099;
const CODE_PREBOOK_FAILED = 53099;
const VERIFY_TIMEOUT_MS = 20 * 1000;

const SOLD_OUT_BODY = {
  ok: false,
  code: CODE_SOLD_OUT,
  soldOut: true,
  message:
    "This fare just sold out with the airline. Please pick another flight.",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---------------------------------------------------------------------
// Offer helpers
// ---------------------------------------------------------------------
function offerIdOf(f) {
  return f?.offerId || f?.raw?.offerId || f?.id || null;
}

// When this offer stops being bookable. Uses LiteAPI's own expiration when
// present, otherwise searchedAt + OFFER_LIFETIME_MS.
function offerExpiry(f, searchedAt) {
  const raw =
    f?.fareExpiresAt ??
    f?.expiration ??
    f?.raw?.expiration ??
    findField(f, "expiration") ??
    findField(f, "expiresAt");
  const parsed = raw != null ? Date.parse(raw) : NaN;
  const fallback = searchedAt + OFFER_LIFETIME_MS;
  // Never trust an expiry later than our known lifetime cap.
  return Number.isFinite(parsed)
    ? Math.min(parsed, fallback + 5 * 60 * 1000)
    : fallback;
}

function stampOffers(flights, searchedAt) {
  return flights.map((f) => ({
    ...f,
    searchedAt: new Date(searchedAt).toISOString(),
    expiresAt: new Date(offerExpiry(f, searchedAt)).toISOString(),
  }));
}

function msRemaining(f) {
  const t = Date.parse(f?.expiresAt);
  return Number.isFinite(t) ? t - Date.now() : Infinity;
}

// Time left on the soonest-expiring fare in a list.
function minRemaining(flights) {
  if (!flights?.length) return 0;
  return Math.min(...flights.map(msRemaining));
}

function earliestExpiry(flights) {
  const ms = minRemaining(flights);
  return Number.isFinite(ms) ? new Date(Date.now() + ms).toISOString() : null;
}

function isExpired(f) {
  return msRemaining(f) <= EXPIRY_GRACE_MS;
}

// Identifies the same physical journey across searches (offer IDs change
// every search; flight numbers and times don't). Returns null if the
// flight shape doesn't give us enough to match safely — then no auto-
// refresh is attempted.
function journeySignature(f) {
  if (!f) return null;
  // Skyrio's flight shape keeps segments under slices[].segments
  // (outbound slice, then return slice).
  const sliceSegs = (slices) =>
    Array.isArray(slices) ? slices.map((s) => s?.segments) : [];
  const segLists = [
    ...sliceSegs(f.slices),
    ...sliceSegs(f.raw?.slices),
    f.segments,
    f.outbound?.segments,
    f.return?.segments,
    f.inbound?.segments,
    f.legs,
    f.raw?.segments,
  ].filter(Array.isArray);

  const segParts = segLists
    .flat()
    .map((s) =>
      [
        s?.carrierCode || s?.marketingCarrier || s?.airlineCode || s?.airline,
        s?.flightNumber || s?.number,
        s?.departureAt || s?.departure?.at || s?.departureTime || s?.departure,
      ]
        .filter((v) => v != null && typeof v !== "object")
        .join(":")
    )
    .filter(Boolean);

  if (segParts.length) {
    return JSON.stringify([segParts, f.cabinClass || f.cabin || ""]);
  }

  const flat = [
    f.owner || f.airline,
    f.flightNumber,
    f.departingAt || f.departureAt || f.departAt || f.departureTime,
    f.arrivingAt || f.arrivalAt || f.arriveAt || f.arrivalTime,
    f.returnFlightNumber,
    f.returningAt || f.returnDepartureAt,
    f.returnArrivingAt || f.returnArrivalAt,
    f.cabinClass || f.cabin,
  ];
  const meaningful = flat.filter((v) => v != null && v !== "");
  // Need at least an airline/flight number AND a time to call it a match.
  if (meaningful.length < 3) return null;
  return JSON.stringify(flat.map((v) => (v == null ? "" : String(v))));
}

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

// ---------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------
function getCachedFlights(cacheKey) {
  const cached = SEARCH_CACHE.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.ts >= CACHE_TTL_MS) return null;
  if (minRemaining(cached.flights) < OFFER_MIN_REMAINING_MS) return null;
  return cached.flights;
}

// Last good result for this search, only if its fares can still be booked.
function getStaleFlights(cacheKey) {
  const cached = SEARCH_CACHE.get(cacheKey);
  if (!cached) return null;
  const usable = cached.flights.filter(
    (f) => msRemaining(f) >= STALE_MIN_REMAINING_MS
  );
  return usable.length ? usable : null;
}

function setCachedFlights(cacheKey, flights, params) {
  if (SEARCH_CACHE.size >= CACHE_MAX_ENTRIES) {
    for (const [key, entry] of SEARCH_CACHE) {
      if (minRemaining(entry.flights) <= 0) SEARCH_CACHE.delete(key);
    }
    while (SEARCH_CACHE.size >= CACHE_MAX_ENTRIES) {
      SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
    }
  }
  SEARCH_CACHE.set(cacheKey, { ts: Date.now(), flights, params });
}

// Finds the flight + the search that produced it, even if that cache
// entry is too old to serve. Used to refresh an expired fare.
function findOfferInCache(offerId) {
  if (!offerId) return null;
  for (const entry of SEARCH_CACHE.values()) {
    const flight = entry.flights.find((f) => offerIdOf(f) === offerId);
    if (flight) return { flight, params: entry.params };
  }
  return null;
}

// Drops a sold-out offer from every cached result list.
function removeOfferFromCache(offerId) {
  if (!offerId) return;
  let removed = 0;
  for (const [key, entry] of SEARCH_CACHE) {
    const kept = entry.flights.filter(
      (f) =>
        f?.offerId !== offerId &&
        f?.id !== offerId &&
        f?.raw?.offerId !== offerId
    );
    if (kept.length !== entry.flights.length) {
      removed += entry.flights.length - kept.length;
      SEARCH_CACHE.set(key, { ...entry, flights: kept });
    }
  }
  if (removed)
    console.log(`[flights] removed sold-out offer from cache (${removed})`);
}

// One shape for every provider failure the frontend sees:
// { ok:false, code, soldOut, message }.
function providerError(err, label) {
  console.error(
    `[flights/${label}] failed:`,
    err?.response?.data || err.message
  );
  const code = err?.response?.data?.error?.code ?? null;
  const upstream =
    err?.response?.data?.error?.message || err?.response?.data?.message;
  const isTimeout =
    err.code === "ECONNABORTED" || /timeout/i.test(err.message || "");

  if (code === CODE_SOLD_OUT) {
    return { status: 409, body: { ...SOLD_OUT_BODY } };
  }
  if (label === "search" && (code === CODE_SEARCH_FAILED || isTimeout)) {
    return {
      status: 502,
      body: {
        ok: false,
        code: code ?? "TIMEOUT",
        message:
          "The airline's system couldn't complete this search. Please try again in a few minutes, or try nearby dates.",
      },
    };
  }
  if (
    code === CODE_SEARCH_FAILED ||
    code === CODE_VERIFY_FAILED ||
    code === CODE_PREBOOK_FAILED ||
    isTimeout
  ) {
    return {
      status: 502,
      body: {
        ok: false,
        code: code ?? "TIMEOUT",
        message:
          "The airline's system didn't respond. Please try again in a moment.",
      },
    };
  }
  return {
    status: 502,
    body: { ok: false, code, message: upstream || err.message },
  };
}

// LiteAPI nests transactionId/secretKey differently across endpoints.
// (Function declaration: hoisted, so offerExpiry above can use it.)
function findField(obj, key, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return undefined;
  if (obj[key] != null && typeof obj[key] !== "object") return obj[key];
  for (const v of Object.values(obj)) {
    const found = findField(v, key, depth + 1);
    if (found != null) return found;
  }
  return undefined;
}

function paymentRefs(data, label) {
  const transactionId = findField(data, "transactionId");
  const secretKey = findField(data, "secretKey");
  console.log(
    `[flights/${label}] transactionId: ${
      transactionId ? String(transactionId).slice(0, 14) + "…" : "MISSING"
    }, secretKey: ${
      secretKey ? String(secretKey).split("_secret")[0] : "MISSING"
    }`
  );
  return {
    ...(transactionId && { transactionId }),
    ...(secretKey && { secretKey }),
  };
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
  } = source || {};

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

function hasRequiredSearchParams(params) {
  return Boolean(
    params?.origin && params?.destination && params?.departureDate
  );
}

function isRetryableSearchError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.error?.code;
  const isTimeout =
    err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
  const noResponse = !err?.response;
  return (
    code === CODE_SEARCH_FAILED ||
    isTimeout ||
    noResponse ||
    (status >= 500 && status < 600)
  );
}

async function postRatesWithRetry(payload) {
  const startedAt = Date.now();
  try {
    return await liteApiFlights.post("/flights/rates", payload, {
      timeout: FIRST_ATTEMPT_TIMEOUT_MS,
      _noRetry: true,
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const remaining = SEARCH_BUDGET_MS - elapsed;
    if (!isRetryableSearchError(err) || remaining < MIN_RETRY_WINDOW_MS) {
      if (isRetryableSearchError(err)) {
        console.warn(
          `[flights/search] failed after ${elapsed}ms — no time left to retry`
        );
      }
      throw err;
    }
    console.warn(
      `[flights/search] attempt 1 failed after ${elapsed}ms (${
        err?.response?.data?.error?.code ||
        err?.code ||
        err?.response?.status ||
        "error"
      }) — retrying with ${Math.round(remaining / 1000)}s left`
    );
    await sleep(RETRY_DELAY_MS);
    return await liteApiFlights.post("/flights/rates", payload, {
      timeout: Math.max(remaining - RETRY_DELAY_MS, MIN_RETRY_WINDOW_MS),
      _noRetry: true,
    });
  }
}

// Runs one search, or joins/reuses an identical one.
// { fresh: true } skips the cache (used for "Find another flight" and
// for refreshing an expired fare).
async function runSearch(params, { fresh = false } = {}) {
  const cacheKey = buildCacheKey(params);

  if (fresh) {
    FAILED_SEARCHES.delete(cacheKey);
  } else {
    const cached = getCachedFlights(cacheKey);
    if (cached) return { flights: cached, cached: true, shared: false };

    const recentFailure = FAILED_SEARCHES.get(cacheKey);
    if (recentFailure && Date.now() - recentFailure.ts < FAILED_SEARCH_TTL_MS) {
      console.warn(
        "[flights/search] same search failed moments ago — answering instantly"
      );
      throw recentFailure.err;
    }
    if (recentFailure) FAILED_SEARCHES.delete(cacheKey);
  }

  const running = INFLIGHT_SEARCHES.get(cacheKey);
  if (running) {
    console.log("[flights/search] joining in-flight identical search");
    const flights = await running;
    return { flights, cached: false, shared: true };
  }

  const promise = (async () => {
    const payload = buildLiteApiSearchPayload(params);
    console.log("[flights/search] payload:", JSON.stringify(payload));

    const startedAt = Date.now();
    const { data } = await postRatesWithRetry(payload);

    console.log(
      `[flights/search] LiteAPI answered in ${
        Date.now() - startedAt
      }ms, top-level keys:`,
      Object.keys(data || {})
    );

    const results = normalizeFlightSearchResponse(data, params);
    // Offers' clocks start when LiteAPI creates them, i.e. at request time.
    const flights = stampOffers(results.map(toFrontendFlightShape), startedAt);

    console.log(
      `[flights/search] normalized ${
        flights.length
      } flight(s), soonest expiry in ${Math.round(
        minRemaining(flights) / 1000
      )}s`
    );
    setCachedFlights(cacheKey, flights, params);
    FAILED_SEARCHES.delete(cacheKey);
    return flights;
  })();

  INFLIGHT_SEARCHES.set(cacheKey, promise);
  try {
    const flights = await promise;
    return { flights, cached: false, shared: false };
  } catch (err) {
    const stale = getStaleFlights(cacheKey);
    if (stale) {
      console.warn(
        `[flights/search] LiteAPI failed — serving recent results (${stale.length} flights)`
      );
      return { flights: stale, cached: true, shared: false, stale: true };
    }
    const status = err?.response?.status;
    if (!status || status >= 500) {
      FAILED_SEARCHES.set(cacheKey, { ts: Date.now(), err });
      if (FAILED_SEARCHES.size > 500) {
        FAILED_SEARCHES.delete(FAILED_SEARCHES.keys().next().value);
      }
    }
    throw err;
  } finally {
    INFLIGHT_SEARCHES.delete(cacheKey);
  }
}

/**
 * GET/POST /api/flights/search
 * Pass `fresh: true` to bypass the cache (e.g. "Find another flight").
 * Every flight includes `searchedAt` and `expiresAt`; the response also
 * has a top-level `expiresAt` (the soonest fare expiry).
 */
export async function searchFlights(req, res) {
  try {
    const source = req.method === "GET" ? req.query : req.body;
    const params = resolveSearchParams(source);
    const fresh = source?.fresh === true || source?.fresh === "true";

    if (!hasRequiredSearchParams(params)) {
      return res.status(400).json({
        ok: false,
        message:
          "origin/from, destination/to, and departureDate/departDate are required",
      });
    }

    const { flights, cached, shared, stale } = await runSearch(params, {
      fresh,
    });
    return res.status(200).json({
      ok: true,
      flights,
      cached,
      shared,
      expiresAt: earliestExpiry(flights),
      ...(stale && { stale: true }),
    });
  } catch (err) {
    const { status, body } = providerError(err, "search");
    return res.status(status).json(body);
  }
}

/**
 * POST /api/flights/warm
 * Same params as /search. Starts the search in the background.
 */
export function warmSearch(req, res) {
  const source = { ...req.query, ...(req.body || {}) };
  const params = resolveSearchParams(source);

  if (!hasRequiredSearchParams(params)) {
    return res.status(400).json({
      ok: false,
      message:
        "origin/from, destination/to, and departureDate/departDate are required",
    });
  }

  const cacheKey = buildCacheKey(params);
  if (getCachedFlights(cacheKey) || INFLIGHT_SEARCHES.has(cacheKey)) {
    return res.status(202).json({ ok: true, warming: false });
  }

  runSearch(params).catch((err) =>
    console.warn("[flights/warm] background search failed:", err.message)
  );
  return res.status(202).json({ ok: true, warming: true });
}

// Re-finds the same journey in a fresh search and verifies the new offer.
// Returns a 200-ready body, or null if the flight is genuinely gone.
async function refreshOffer({ params, selected, oldOfferId }) {
  const sig = journeySignature(selected);
  if (!sig) return null;
  const startedAt = Date.now();
  try {
    const { flights } = await runSearch(params, { fresh: true });
    const match = flights.find(
      (f) =>
        offerIdOf(f) &&
        offerIdOf(f) !== oldOfferId &&
        journeySignature(f) === sig
    );
    if (!match) {
      console.warn(
        "[flights/verify] refresh: same journey not found in fresh search"
      );
      return null;
    }

    const newOfferId = offerIdOf(match);
    const { data } = await liteApiFlights.post(
      "/flights/verify",
      buildVerifyPayload({ offerId: newOfferId }),
      { timeout: VERIFY_TIMEOUT_MS, _noRetry: true }
    );

    const previousPrice = priceOf(selected);
    const newPrice = priceOf(match);
    const priceChanged =
      previousPrice != null &&
      newPrice != null &&
      Math.abs(newPrice - previousPrice) >= 0.01;

    console.log(
      `[flights/verify] refreshed expired fare in ${Date.now() - startedAt}ms${
        priceChanged ? ` (price ${previousPrice} → ${newPrice})` : ""
      }`
    );

    return {
      ok: true,
      ...data,
      refreshed: true,
      offerId: newOfferId,
      previousOfferId: oldOfferId,
      flight: match,
      expiresAt: match.expiresAt,
      priceChanged,
      previousPrice,
      newPrice,
    };
  } catch (err) {
    console.warn(
      "[flights/verify] refresh failed:",
      err?.response?.data?.error?.code || err?.message
    );
    return null;
  }
}

/**
 * Step 1 of 4 — confirm the offer is still valid and get latest pricing.
 *
 * Body: { offerId, flight?, search?, autoRefresh? }
 *   - flight / search are optional: if omitted, they're looked up from the
 *     search cache. Sending them makes refresh work even after a restart.
 *
 * If the fare has expired or LiteAPI calls it sold out, the same flight is
 * re-found and re-verified. The response then has `refreshed: true` and a
 * NEW `offerId` — the frontend must use that offerId for prebook — plus
 * `priceChanged` / `newPrice` so the traveler can confirm a new price.
 */
export async function verifyOffer(req, res) {
  const {
    offerId,
    flight: clientFlight,
    search,
    autoRefresh = true,
  } = req.body || {};
  if (!offerId) {
    return res.status(400).json({ ok: false, message: "offerId is required" });
  }

  // Diagnostic: LiteAPI offerIds are msgpack-encoded and must arrive
  // byte-for-byte unchanged. A space (from "+" passing through a URL) or a
  // different length means the frontend altered it on the way here.
  const knownOffer = findOfferInCache(offerId);
  console.log(
    `[flights/verify] offerId len=${String(offerId).length} start=${String(
      offerId
    ).slice(0, 25)} end=${String(offerId).slice(-25)} hasSpace=${/\s/.test(
      String(offerId)
    )} inSearchCache=${Boolean(knownOffer)}`
  );

  const known = knownOffer;
  const selected = clientFlight || known?.flight || null;
  // Prefer the exact params of the search that produced this offer, so a
  // refresh re-runs the identical search; fall back to what the client sent.
  const params = known?.params || (search ? resolveSearchParams(search) : null);
  const canRefresh =
    autoRefresh !== false &&
    selected &&
    hasRequiredSearchParams(params) &&
    journeySignature(selected) != null;

  // Already expired? Skip the doomed verify call and refresh directly.
  if (canRefresh && isExpired(selected)) {
    const refreshed = await refreshOffer({
      params,
      selected,
      oldOfferId: offerId,
    });
    if (refreshed) return res.status(200).json(refreshed);
    removeOfferFromCache(offerId);
    return res.status(409).json({ ...SOLD_OUT_BODY });
  }

  try {
    const payload = buildVerifyPayload({ offerId });
    const { data } = await liteApiFlights.post("/flights/verify", payload, {
      timeout: VERIFY_TIMEOUT_MS,
      _noRetry: true,
    });
    return res.status(200).json({
      ok: true,
      offerId,
      ...data,
      ...(selected?.expiresAt && { expiresAt: selected.expiresAt }),
    });
  } catch (err) {
    const { status, body } = providerError(err, "verify");
    if (body.soldOut) {
      removeOfferFromCache(offerId);
      if (canRefresh) {
        const refreshed = await refreshOffer({
          params,
          selected,
          oldOfferId: offerId,
        });
        if (refreshed) return res.status(200).json(refreshed);
      }
    }
    return res.status(status).json(body);
  }
}

/**
 * Step 2 of 4 — reserve the offer with the provider, create a payment
 * intent (when usePaymentSdk is true). Returns a prebookId.
 */
export async function createPrebook(req, res) {
  const { offerId } = req.body || {};
  try {
    const {
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

    // _noRetry: a prebook that timed out on our side may still have
    // reached LiteAPI; retrying could create a second reservation.
    const { data } = await liteApiFlights.post("/flights/prebooks", payload, {
      _noRetry: true,
    });
    return res
      .status(200)
      .json({ ok: true, ...data, ...paymentRefs(data, "prebook") });
  } catch (err) {
    const { status, body } = providerError(err, "prebook");
    if (body.soldOut) removeOfferFromCache(offerId);
    return res.status(status).json(body);
  }
}

/**
 * GET /api/flights/prebook/:prebookId
 */
export async function getPrebookDetails(req, res) {
  try {
    const { prebookId } = req.params;
    if (!prebookId) {
      return res
        .status(400)
        .json({ ok: false, message: "prebookId is required" });
    }

    const { data } = await liteApiFlights.get(`/flights/prebooks/${prebookId}`);
    const seats = parsePrebookSeatOptions(data);

    return res.status(200).json({ ok: true, seats, raw: data });
  } catch (err) {
    const { status, body } = providerError(err, "prebook/details");
    return res.status(status).json(body);
  }
}

/**
 * Step 3 of 4 (optional) — attach seats/bags to an existing prebook.
 */
export async function attachPrebookServices(req, res) {
  try {
    const { prebookId } = req.params;
    const { selectedServices, voucherCode } = req.body || {};

    if (!prebookId) {
      return res
        .status(400)
        .json({ ok: false, message: "prebookId is required" });
    }
    if (!Array.isArray(selectedServices) || !selectedServices.length) {
      return res.status(400).json({
        ok: false,
        message: "selectedServices must be a non-empty array",
      });
    }

    const services = selectedServices
      .map((s) =>
        typeof s === "string"
          ? { passengerIndex: 0, serviceId: s, quantity: 1 }
          : {
              passengerIndex: Number(s?.passengerIndex ?? 0),
              serviceId: s?.serviceId,
              quantity: Number(s?.quantity ?? 1),
            }
      )
      .filter((s) => s.serviceId);

    if (!services.length) {
      return res
        .status(400)
        .json({ ok: false, message: "No valid serviceId in selectedServices" });
    }

    const payload = {
      selectedServices: services,
      ...(voucherCode && { voucherCode }),
    };
    console.log("[flights/prebook/services] payload:", JSON.stringify(payload));

    const { data } = await liteApiFlights.post(
      `/flights/prebooks/${prebookId}/services`,
      payload,
      { _noRetry: true }
    );
    return res
      .status(200)
      .json({ ok: true, ...data, ...paymentRefs(data, "prebook/services") });
  } catch (err) {
    const { status, body } = providerError(err, "prebook/services");
    return res.status(status).json(body);
  }
}

// ─────────────────────────────────────────────────────────────
// Saving flight bookings to Skyrio's database
// ─────────────────────────────────────────────────────────────
function toDate(v) {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

function resolveUserId(req) {
  const attached = req.user?._id || req.user?.id;
  if (attached) return String(attached);
  const header = req.headers?.authorization || "";
  const token =
    req.cookies?.token ||
    (header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : null);
  if (!token || !process.env.JWT_SECRET) return "";
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    return String(
      d.userId || d.id || d._id || d.sub || d.user?.id || d.user?._id || ""
    );
  } catch (err) {
    console.error("[flights/complete] login token invalid:", err.message);
    return "";
  }
}

async function findSavedFlightBooking(userId, prebookId) {
  if (!userId || !prebookId) return null;
  try {
    return await Booking.findOne({
      user: userId,
      "flight.prebookId": prebookId,
    });
  } catch {
    return null;
  }
}

// Seats the traveler chose in Skyrio (sent from checkout). Kept small and
// plain so group members can see where friends sit on the same flight.
function cleanSeats(list) {
  if (!Array.isArray(list)) return [];
  const str = (v, n) => (v == null || v === "" ? null : String(v).slice(0, n));
  return list
    .slice(0, 40)
    .map((x) => ({
      origin: str(x?.origin, 4),
      destination: str(x?.destination, 4),
      departureAt: str(x?.departureAt, 16),
      flightNumber: str(x?.flightNumber, 12),
      seatNumber: str(x?.seatNumber, 5),
      passenger: str(x?.passenger, 80),
    }))
    .filter(
      (x) =>
        x.origin &&
        x.destination &&
        x.departureAt &&
        /^\d{1,3}[A-Z]{1,2}$/i.test(x.seatNumber || "")
    );
}

async function saveFlightBooking({
  userId,
  prebookId,
  transactionId,
  record,
  email,
  groupId,
}) {
  try {
    if (!userId) throw new Error("no authenticated user on request");
    const e = email || {};
    const pnr = extractFlightPnr(record);
    const bookingId = extractFlightBookingId(record);
    const total = Number(e.totalAmount);
    const departDate = e.departureAt
      ? String(e.departureAt).slice(0, 10)
      : null;

    const tripDetails = [
      e.origin && e.destination ? `${e.origin} → ${e.destination}` : "Flight",
      departDate,
      e.returnDepartureAt ? "round trip" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const syncGroup = await memberGroupId(groupId, userId);
    const saved = await Booking.create({
      user: userId,
      syncGroup,
      name: e.passengerName || undefined,
      email: e.to || undefined,
      tripDetails,
      type: "Flight",
      flight: {
        prebookId,
        transactionId: transactionId || null,
        bookingId,
        bookingRef: pnr,
        airline: e.airline || null,
        origin: e.origin || null,
        destination: e.destination || null,
        originName: e.originName || null,
        destinationName: e.destinationName || null,
        departureAt: e.departureAt || null,
        arrivalAt: e.arrivalAt || null,
        returnDepartureAt: e.returnDepartureAt || null,
        returnArrivingAt: e.returnArrivingAt || null,
        // Seats picked in Skyrio checkout (empty if skipped). Seats chosen
        // later with the airline aren't known to Skyrio.
        seats: cleanSeats(e.seats),
        groupId: groupId || null,
        liteapi: record || null,
      },
      dates: {
        start: toDate(e.departureAt),
        end: toDate(e.returnArrivingAt || e.returnDepartureAt || e.arrivalAt),
      },
      travelers: 1,
      passengers: e.passengerName
        ? [{ name: e.passengerName, type: "adult" }]
        : [],
      status: "confirmed",
      paidAt: new Date(),
      total: Number.isFinite(total) ? total : 0,
      totalAmount: Number.isFinite(total) ? total : null,
      totalCurrency: String(e.currency || "USD").toUpperCase(),
      provider: "liteapi",
      providerBookingIds: bookingId ? [String(bookingId)] : [],
      confirmationCodes: pnr ? [String(pnr)] : [],
    });

    try {
      await Notification.create({
        user: userId,
        type: "booking",
        title: "Flight Booked ✈️",
        message: pnr
          ? `Your flight is confirmed. Airline confirmation: ${pnr}.`
          : "Your flight is confirmed. Have a great trip!",
        link: "/saved-trips",
      });
      // Booking XP through the XP ledger: pending until the trip starts,
      // plan multiplier applied, taken back if the trip is cancelled.
      await awardXpForBooking(saved._id);
    } catch (err) {
      console.error(
        "[flights/complete] XP/notification step failed:",
        err?.message
      );
    }

    return saved;
  } catch (err) {
    console.error(
      "[flights/complete] couldn't save Booking (the flight IS booked) —",
      prebookId,
      err?.message
    );
    return null;
  }
}

// How many people are on this booking. Uses what checkout sent, else
// counts the passenger list in LiteAPI's booking record. null if unknown.
function travelerCountOf(confirmationEmail, rest, record) {
  const sent = Number(confirmationEmail?.travelerCount);
  if (Number.isInteger(sent) && sent > 0) return sent;
  for (const list of [
    rest?.passengers,
    record?.passengers,
    record?.travelers,
    record?.travellers,
  ]) {
    if (Array.isArray(list) && list.length) return list.length;
  }
  return null;
}

/**
 * Step 4 of 4 — finalize the booking.
 */
export async function completeBooking(req, res) {
  try {
    // eslint-disable-next-line no-unused-vars
    const { prebookId, prebookID, confirmationEmail, groupId, ...rest } =
      req.body;
    const resolvedPrebookId = prebookId || prebookID;
    if (!resolvedPrebookId) {
      return res
        .status(400)
        .json({ ok: false, message: "prebookId is required" });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      console.warn(
        "[flights/complete] no signed-in user on request — booking will not be saved to an account",
        resolvedPrebookId
      );
    }
    const existing = await findSavedFlightBooking(userId, resolvedPrebookId);
    if (existing) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        booking: { _id: existing._id },
        data: existing.flight?.liteapi || null,
      });
    }

    const payload = buildCompleteBookingPayload({
      prebookId: resolvedPrebookId,
      ...rest,
    });
    const { data } = await liteApiFlights.post("/flights/bookings", payload, {
      _noRetry: true,
    });

    let emailPromise = null;
    if (confirmationEmail?.to) {
      const record = Array.isArray(data?.data)
        ? data.data[0]
        : data?.data || data;
      const travelerCount = travelerCountOf(confirmationEmail, rest, record);
      const airlineCode = extractFlightPnr(record);
      const confirmationNumber =
        airlineCode ||
        extractFlightBookingId(record) ||
        record?.confirmationNumber ||
        record?.reference ||
        resolvedPrebookId;

      emailPromise = sendBookingConfirmation({
        to: confirmationEmail.to,
        passengerName: confirmationEmail.passengerName,
        confirmationNumber,
        confirmationIsAirline: Boolean(airlineCode),
        airline: confirmationEmail.airline,
        flightNumber: confirmationEmail.flightNumber,
        returnFlightNumber: confirmationEmail.returnFlightNumber,
        origin: confirmationEmail.origin,
        destination: confirmationEmail.destination,
        originName: confirmationEmail.originName,
        destinationName: confirmationEmail.destinationName,
        departureAt: confirmationEmail.departureAt,
        arrivalAt: confirmationEmail.arrivalAt,
        returnDepartureAt: confirmationEmail.returnDepartureAt,
        returnArrivalAt:
          confirmationEmail.returnArrivalAt ||
          confirmationEmail.returnArrivingAt,
        totalAmount: confirmationEmail.totalAmount,
        currency: confirmationEmail.currency,
        cabinClass: confirmationEmail.cabinClass,
        // For the one-line Sync Together tip: shown only when 2+ people
        // flew on this booking and it isn't already a group trip.
        travelerCount,
        groupTrip: Boolean(groupId),
      }).catch((emailErr) => {
        console.error(
          "[flights/complete] confirmation email failed:",
          emailErr?.message || emailErr
        );
        return { ok: false, error: emailErr?.message || "send failed" };
      });
    }

    const bookedRecord = Array.isArray(data?.data)
      ? data.data[0]
      : data?.data || data;
    const saved = await saveFlightBooking({
      userId,
      prebookId: resolvedPrebookId,
      transactionId: rest?.payment?.transactionId,
      record: bookedRecord,
      email: confirmationEmail,
      groupId,
    });

    if (saved) {
      (emailPromise
        ? emailPromise.then((r) =>
            recordEmailResult(saved._id, confirmationEmail.to, r)
          )
        : sendConfirmationFor(saved)
      )
        .catch(() => {})
        .finally(() => {
          if (saved.syncGroup) onGroupBookingSaved(saved);
        });
    }

    return res.status(200).json({
      ok: true,
      ...data,
      booking: saved ? { _id: saved._id } : null,
    });
  } catch (err) {
    const { status, body } = providerError(err, "complete");
    return res.status(status).json(body);
  }
}
