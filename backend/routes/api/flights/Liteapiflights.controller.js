import jwt from "jsonwebtoken";
import { liteApiFlights } from "./Liteapiflights.provider.js";
import { extractFlightBookingId, extractFlightPnr } from "../../../services/liteapiBookings.js";
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
import { memberGroupId } from "../../../services/sharedRooms.js";
import {
  recordEmailResult,
  sendConfirmationFor,
  onGroupBookingSaved,
} from "../../../services/bookingConfirmations.js";

// ---------------------------------------------------------------------
// Search speed
//
// LiteAPI's sandbox can take ~50s to return a round-trip search with
// 150-190+ journeys, and that time is on their side. What we control:
//
//   1. Cache: an identical search within CACHE_TTL_MS is instant.
//   2. In-flight sharing: if an identical search is ALREADY running
//      (double-click, dev double-render, two tabs, or the warm-up
//      request below), the second caller waits on the first instead of
//      starting another 50s LiteAPI call.
//   3. Warm-up: POST /api/flights/warm starts the search in the
//      background as soon as the route + dates are known, so results
//      are often ready by the time the user clicks Search.
//
// Fares carry their own expiry (offer.expiration), and the checkout
// re-verifies the fare before prebooking, so a slightly older cached
// list is safe — but keep the TTL short. Offers LiteAPI reports as sold
// out are removed from every cached list (see removeOfferFromCache) so
// "Find another flight" never shows a dead fare again.
// ---------------------------------------------------------------------
const SEARCH_CACHE = new Map();
const INFLIGHT_SEARCHES = new Map();
// 10 minutes: repeat searches are instant and don't depend on LiteAPI.
// Safe because prices are re-checked at prebook and the exact charge is
// shown before paying.
const CACHE_TTL_MS =
  Number(process.env.FLIGHT_SEARCH_CACHE_TTL_MS) || 10 * 60 * 1000;
// If LiteAPI fails, a result this recent is shown instead of an error.
// Kept under LiteAPI's ~13-15 min offer lifetime so every fare shown can
// still actually be booked.
const STALE_FALLBACK_MS = 13 * 60 * 1000;
// Total time a traveler can wait for one search, including the retry.
const SEARCH_BUDGET_MS = 80 * 1000;
const FIRST_ATTEMPT_TIMEOUT_MS = 50 * 1000;
const MIN_RETRY_WINDOW_MS = 15 * 1000;
// A search that just failed on BOTH attempts usually fails again (e.g. the
// provider has no fares for those dates). Answer repeats instantly for a
// few minutes instead of making the traveler wait over a minute each time.
const FAILED_SEARCH_TTL_MS = 3 * 60 * 1000;
const FAILED_SEARCHES = new Map(); // cacheKey -> { ts, err }
const CACHE_MAX_ENTRIES = 200;
// Short pause before the one search retry.
const RETRY_DELAY_MS = 1500;

// LiteAPI error codes we handle specifically.
const CODE_SOLD_OUT = 52010;
const CODE_SEARCH_FAILED = 51099;
const CODE_VERIFY_FAILED = 52099; // LiteAPI: "unable to process verify request" (their side)
const CODE_PREBOOK_FAILED = 53099; // LiteAPI: "unable to process prebook request" (their side)
// The fare check is a read-only safety step (prebook re-checks price and
// availability). Fail fast instead of making the traveler wait a minute.
const VERIFY_TIMEOUT_MS = 20 * 1000;

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

function getCachedFlights(cacheKey) {
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.flights;
  return null;
}

// Last good result for this exact search, if still within the offer
// lifetime. Used only when LiteAPI fails.
function getStaleFlights(cacheKey) {
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < STALE_FALLBACK_MS) return cached.flights;
  return null;
}

function setCachedFlights(cacheKey, flights) {
  // Keep the map from growing forever: drop expired entries first,
  // then the oldest if it's still over the cap.
  if (SEARCH_CACHE.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of SEARCH_CACHE) {
      if (now - entry.ts >= STALE_FALLBACK_MS) SEARCH_CACHE.delete(key);
    }
    while (SEARCH_CACHE.size >= CACHE_MAX_ENTRIES) {
      SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
    }
  }
  SEARCH_CACHE.set(cacheKey, { ts: Date.now(), flights });
}

// Drops a sold-out offer from every cached result list, so the next
// search (served from cache) doesn't offer it again.
function removeOfferFromCache(offerId) {
  if (!offerId) return;
  let removed = 0;
  for (const [key, entry] of SEARCH_CACHE) {
    const kept = entry.flights.filter(
      (f) => f?.offerId !== offerId && f?.id !== offerId && f?.raw?.offerId !== offerId
    );
    if (kept.length !== entry.flights.length) {
      removed += entry.flights.length - kept.length;
      SEARCH_CACHE.set(key, { ...entry, flights: kept });
    }
  }
  if (removed) console.log(`[flights] removed sold-out offer from cache (${removed})`);
}

// One shape for every provider failure the frontend sees:
// { ok:false, code, soldOut, message }. `code` is LiteAPI's numeric code
// when there is one, so the checkout can react to it reliably.
function providerError(err, label) {
  console.error(`[flights/${label}] failed:`, err?.response?.data || err.message);
  const code = err?.response?.data?.error?.code ?? null;
  const upstream =
    err?.response?.data?.error?.message || err?.response?.data?.message;
  const isTimeout =
    err.code === "ECONNABORTED" || /timeout/i.test(err.message || "");

  if (code === CODE_SOLD_OUT) {
    return {
      status: 409,
      body: {
        ok: false,
        code,
        soldOut: true,
        message: "This fare just sold out with the airline. Please pick another flight.",
      },
    };
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
        message: "The airline's system didn't respond. Please try again in a moment.",
      },
    };
  }
  return {
    status: 502,
    body: { ok: false, code, message: upstream || err.message },
  };
}

// LiteAPI nests transactionId/secretKey differently across endpoints
// (data, data[0], payment, paymentData...). Find them wherever they are
// and hand them to the frontend at the top level, where it always looks.
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
    `[flights/${label}] transactionId: ${transactionId ? String(transactionId).slice(0, 14) + "…" : "MISSING"}, secretKey: ${
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

function hasRequiredSearchParams(params) {
  return Boolean(params.origin && params.destination && params.departureDate);
}

// Search only READS prices (books nothing), so retrying is always safe.
// Retry once on any LiteAPI server error (incl. 51099) or timeout, inside a
// fixed total budget so the traveler never waits more than ~80 seconds.
// Client errors (4xx — e.g. a bad date) are never retried.
function isRetryableSearchError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.error?.code;
  const isTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
  const noResponse = !err?.response; // network drop
  return code === CODE_SEARCH_FAILED || isTimeout || noResponse || (status >= 500 && status < 600);
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
        console.warn(`[flights/search] failed after ${elapsed}ms — no time left to retry`);
      }
      throw err;
    }
    console.warn(
      `[flights/search] attempt 1 failed after ${elapsed}ms (${
        err?.response?.data?.error?.code || err?.code || err?.response?.status || "error"
      }) — retrying with ${Math.round(remaining / 1000)}s left`
    );
    await sleep(RETRY_DELAY_MS);
    return await liteApiFlights.post("/flights/rates", payload, {
      timeout: Math.max(remaining - RETRY_DELAY_MS, MIN_RETRY_WINDOW_MS),
      _noRetry: true,
    });
  }
}

// Runs one search, or joins/reuses an identical one. Returns
// { flights, cached, shared }.
async function runSearch(params) {
  const cacheKey = buildCacheKey(params);

  const cached = getCachedFlights(cacheKey);
  if (cached) return { flights: cached, cached: true, shared: false };

  const recentFailure = FAILED_SEARCHES.get(cacheKey);
  if (recentFailure && Date.now() - recentFailure.ts < FAILED_SEARCH_TTL_MS) {
    console.warn("[flights/search] same search failed moments ago — answering instantly");
    throw recentFailure.err;
  }
  if (recentFailure) FAILED_SEARCHES.delete(cacheKey);

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

    // `params` is passed through so normalizeFlightSearchResponse can
    // split each journey's segments into outbound vs. return legs.
    const results = normalizeFlightSearchResponse(data, params);
    const flights = results.map(toFrontendFlightShape);

    console.log(`[flights/search] normalized ${flights.length} flight(s)`);
    setCachedFlights(cacheKey, flights);
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
    // Remember provider-side failures (not bad input) so an identical
    // repeat answers instantly. Bounded: oldest entries dropped past 500.
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
 * Waits for LiteAPI's full response (or joins an identical search that
 * is already running), normalizes it, returns everything at once.
 */
export async function searchFlights(req, res) {
  try {
    const source = req.method === "GET" ? req.query : req.body;
    const params = resolveSearchParams(source);

    if (!hasRequiredSearchParams(params)) {
      return res.status(400).json({
        ok: false,
        message:
          "origin/from, destination/to, and departureDate/departDate are required",
      });
    }

    const { flights, cached, shared, stale } = await runSearch(params);
    return res
      .status(200)
      .json({ ok: true, flights, cached, shared, ...(stale && { stale: true }) });
  } catch (err) {
    const { status, body } = providerError(err, "search");
    return res.status(status).json(body);
  }
}

/**
 * POST /api/flights/warm
 * Same params as /search. Starts the search in the background and
 * returns 202 immediately, so the results are cached by the time the
 * user actually runs the search. Params must match the real search
 * exactly (same adults/cabin/returnDate) or the cache key won't hit.
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

  // Fire and forget. A failure here is logged and otherwise ignored —
  // the user's real search will simply run normally.
  runSearch(params).catch((err) =>
    console.warn("[flights/warm] background search failed:", err.message)
  );
  return res.status(202).json({ ok: true, warming: true });
}

/**
 * Step 1 of 4 — confirm the offer is still valid and get latest pricing.
 */
export async function verifyOffer(req, res) {
  const { offerId } = req.body || {};
  try {
    if (!offerId) {
      return res
        .status(400)
        .json({ ok: false, message: "offerId is required" });
    }

    const payload = buildVerifyPayload({ offerId });
    const { data } = await liteApiFlights.post("/flights/verify", payload, {
      timeout: VERIFY_TIMEOUT_MS,
      _noRetry: true,
    });
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    const { status, body } = providerError(err, "verify");
    if (body.soldOut) removeOfferFromCache(offerId);
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
 *
 * Fetches details for an existing prebook: latest confirmed pricing
 * and available ancillary services (including seats). Confirmed
 * against LiteAPI's API reference (GET /flights/prebooks/{prebookId},
 * "1.3 Get prebook details").
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
 * LiteAPI requires: { selectedServices: [{ passengerIndex, serviceId, quantity }] }
 * Accepts that shape, or plain serviceId strings (treated as passenger 0).
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
      return res
        .status(400)
        .json({ ok: false, message: "selectedServices must be a non-empty array" });
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

    // _noRetry: attaching services changes the prebook and returns a
    // superseding transactionId/secretKey; don't replay it blindly.
    const { data } = await liteApiFlights.post(
      `/flights/prebooks/${prebookId}/services`,
      payload,
      { _noRetry: true }
    );
    // The NEW transactionId/secretKey replace the prebook's originals; the
    // old payment is no longer valid, so the frontend must get these.
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
//
// Flight payments are collected on LiteAPI's Stripe account, so Skyrio's
// Stripe webhook never sees them. The booking is therefore saved here,
// right after LiteAPI confirms it — already paid, so "confirmed" directly,
// with XP + notifications awarded once.
// ─────────────────────────────────────────────────────────────
function toDate(v) {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

// Who is booking? Prefer the user attached by requireAuth on the route.
// If the route isn't protected (or the middleware didn't run), verify the
// login token here the same way requireAuth does, so a completed booking
// is ALWAYS saved to the right account.
function resolveUserId(req) {
  const attached = req.user?._id || req.user?.id;
  if (attached) return String(attached);
  const header = req.headers?.authorization || "";
  const token =
    req.cookies?.token ||
    (header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null);
  if (!token || !process.env.JWT_SECRET) return "";
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    return String(d.userId || d.id || d._id || d.sub || d.user?.id || d.user?._id || "");
  } catch (err) {
    console.error("[flights/complete] login token invalid:", err.message);
    return "";
  }
}

async function findSavedFlightBooking(userId, prebookId) {
  if (!userId || !prebookId) return null;
  try {
    return await Booking.findOne({ user: userId, "flight.prebookId": prebookId });
  } catch {
    return null;
  }
}

async function saveFlightBooking({ userId, prebookId, transactionId, record, email, groupId }) {
  try {
    if (!userId) throw new Error("no authenticated user on request");
    const e = email || {};
    // LiteAPI nests these — search the whole response, not just the top.
    const pnr = extractFlightPnr(record);
    const bookingId = extractFlightBookingId(record);
    const total = Number(e.totalAmount);
    const departDate = e.departureAt ? String(e.departureAt).slice(0, 10) : null;

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
        groupId: groupId || null,
        liteapi: record || null,
      },
      dates: {
        start: toDate(e.departureAt),
        end: toDate(e.returnArrivingAt || e.returnDepartureAt || e.arrivalAt),
      },
      travelers: 1,
      passengers: e.passengerName ? [{ name: e.passengerName, type: "adult" }] : [],
      status: "confirmed",
      paidAt: new Date(),
      total: Number.isFinite(total) ? total : 0,
      totalAmount: Number.isFinite(total) ? total : null,
      totalCurrency: String(e.currency || "USD").toUpperCase(),
      provider: "liteapi",
      providerBookingIds: bookingId ? [String(bookingId)] : [],
      confirmationCodes: pnr ? [String(pnr)] : [],
    });

    // XP + notifications — once, because this record is created once.
    try {
      await User.findByIdAndUpdate(userId, { $inc: { xp: 200 } });
      await Notification.create({
        user: userId,
        type: "booking",
        title: "Flight Booked ✈️",
        message: pnr
          ? `Your flight is confirmed. Airline confirmation: ${pnr}.`
          : "Your flight is confirmed. Have a great trip!",
        link: "/saved-trips",
      });
      await Notification.create({
        user: userId,
        type: "xp",
        title: "🌟 +200 XP Earned!",
        message:
          "You earned 200 XP for booking a trip. Check your Passport to see your progress!",
        link: "/passport",
      });
    } catch (err) {
      console.error("[flights/complete] XP/notification step failed:", err?.message);
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

/**
 * Step 4 of 4 — finalize the booking. LiteAPI's required body field is
 * lowercase `prebookId` (confirmed against their API reference); the
 * frontend also sends `prebookID`, so either casing is accepted here.
 */
export async function completeBooking(req, res) {
  try {
    // confirmationEmail and groupId are destructured out on purpose so
    // they are NOT forwarded to LiteAPI inside `...rest`:
    //   - confirmationEmail is data for OUR confirmation email only.
    //   - groupId is Skyrio's own group-booking context; LiteAPI has no
    //     use for it and may reject unknown fields.
    // eslint-disable-next-line no-unused-vars
    const { prebookId, prebookID, confirmationEmail, groupId, ...rest } =
      req.body;
    const resolvedPrebookId = prebookId || prebookID;
    if (!resolvedPrebookId) {
      return res
        .status(400)
        .json({ ok: false, message: "prebookId is required" });
    }

    // Already completed (refresh / double submit)? Return the saved booking
    // instead of booking again.
    const userId = resolveUserId(req);
    if (!userId) {
      console.warn("[flights/complete] no signed-in user on request — booking will not be saved to an account", resolvedPrebookId);
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
    // _noRetry: a booking request that times out on our side may have
    // reached LiteAPI; retrying could create a duplicate booking.
    const { data } = await liteApiFlights.post("/flights/bookings", payload, {
      _noRetry: true,
    });

    // Fire the confirmation email without blocking or risking the
    // actual booking response. A failure here must never make a
    // successfully-completed booking look like it failed.
    //
    // Built from data the FRONTEND sends explicitly (confirmationEmail)
    // rather than guessed out of LiteAPI's completion response. The one
    // thing pulled from LiteAPI's response is the confirmation number,
    // with a defensive multi-shape fallback that ends at the prebookId
    // so the email always has SOMETHING concrete to point to.
    let emailPromise = null;
    if (confirmationEmail?.to) {
      const record = Array.isArray(data?.data)
        ? data.data[0]
        : data?.data || data;
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
        // Labeled "Airline confirmation" only when it's the airline's own
        // code; otherwise "Booking reference".
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
        // email.js reads `returnArrivalAt`; the checkout sends `returnArrivingAt`.
        // Without this, round trips were emailed (and calendared) as one-way.
        returnArrivalAt:
          confirmationEmail.returnArrivalAt || confirmationEmail.returnArrivingAt,
        totalAmount: confirmationEmail.totalAmount,
        currency: confirmationEmail.currency,
        cabinClass: confirmationEmail.cabinClass,
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

    // Record whether the confirmation went out — or send one to the
    // account's email if checkout didn't give us an address. Then tell
    // the rest of the Sync Together group. Never blocks the response.
    if (saved) {
      (emailPromise
        ? emailPromise.then((r) => recordEmailResult(saved._id, confirmationEmail.to, r))
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
