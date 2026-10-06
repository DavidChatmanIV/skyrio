import jwt from "jsonwebtoken";
import { liteApiFlights } from "./Liteapiflights.provider.js";
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
const CACHE_TTL_MS =
  Number(process.env.FLIGHT_SEARCH_CACHE_TTL_MS) || 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
// Healthy searches have been measured at 35-50s. 60s leaves headroom;
// anything slower is almost always going to fail anyway.
const SEARCH_TIMEOUT_MS = 60 * 1000;
// Only retry a 51099 if it came back FAST. Logs showed 51099 arriving
// after ~54s; retrying that doubled the traveler's wait to 100+ seconds
// for the same failure. A quick 51099 is the transient kind worth retrying.
const RETRY_WINDOW_MS = 20 * 1000;
const RETRY_DELAY_MS = 1500;

// LiteAPI error codes we handle specifically.
const CODE_SOLD_OUT = 52010;
const CODE_SEARCH_FAILED = 51099;
const CODE_VERIFY_FAILED = 52099; // LiteAPI: "unable to process verify request" (their side)
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

function setCachedFlights(cacheKey, flights) {
  // Keep the map from growing forever: drop expired entries first,
  // then the oldest if it's still over the cap.
  if (SEARCH_CACHE.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of SEARCH_CACHE) {
      if (now - entry.ts >= CACHE_TTL_MS) SEARCH_CACHE.delete(key);
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
// { ok:false, code, soldOut, message }. `code` is LiteAPI's numeric code
// when there is one, so the checkout can react to it reliably.
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
    return {
      status: 409,
      body: {
        ok: false,
        code,
        soldOut: true,
        message:
          "This fare just sold out with the airline. Please pick another flight.",
      },
    };
  }
  if (code === CODE_SEARCH_FAILED || code === CODE_VERIFY_FAILED || isTimeout) {
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

// LiteAPI's sandbox sometimes fails a search with HTTP 500 / code 51099
// and then succeeds on the next identical attempt. Retry ONLY that error,
// ONCE, and only if the failure came back within RETRY_WINDOW_MS — a slow
// failure retried just doubles the wait for the same result.
async function postRatesWithRetry(payload) {
  const opts = { timeout: SEARCH_TIMEOUT_MS, _noRetry: true };
  const startedAt = Date.now();
  try {
    return await liteApiFlights.post("/flights/rates", payload, opts);
  } catch (err) {
    const status = err?.response?.status;
    const code = err?.response?.data?.error?.code;
    const elapsed = Date.now() - startedAt;
    if (
      status === 500 &&
      code === CODE_SEARCH_FAILED &&
      elapsed < RETRY_WINDOW_MS
    ) {
      console.warn(
        `[flights/search] LiteAPI 51099 after ${elapsed}ms — retrying once`
      );
      await sleep(RETRY_DELAY_MS);
      return await liteApiFlights.post("/flights/rates", payload, opts);
    }
    if (code === CODE_SEARCH_FAILED) {
      console.warn(
        `[flights/search] LiteAPI 51099 after ${elapsed}ms — too slow to retry`
      );
    }
    throw err;
  }
}

// Runs one search, or joins/reuses an identical one. Returns
// { flights, cached, shared }.
async function runSearch(params) {
  const cacheKey = buildCacheKey(params);

  const cached = getCachedFlights(cacheKey);
  if (cached) return { flights: cached, cached: true, shared: false };

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
    return flights;
  })();

  INFLIGHT_SEARCHES.set(cacheKey, promise);
  try {
    const flights = await promise;
    return { flights, cached: false, shared: false };
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

    const { flights, cached, shared } = await runSearch(params);
    return res.status(200).json({ ok: true, flights, cached, shared });
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
        .json({
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
    const pnr =
      record?.bookingRef ||
      record?.pnr ||
      record?.confirmationNumber ||
      record?.reference ||
      null;
    const bookingId = record?.bookingId || null;
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

    const saved = await Booking.create({
      user: userId,
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
    if (confirmationEmail?.to) {
      const record = Array.isArray(data?.data)
        ? data.data[0]
        : data?.data || data;
      const airlineCode = record?.bookingRef || record?.pnr || null;
      const confirmationNumber =
        airlineCode ||
        record?.bookingId ||
        record?.confirmationNumber ||
        record?.reference ||
        resolvedPrebookId;

      sendBookingConfirmation({
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
          confirmationEmail.returnArrivalAt ||
          confirmationEmail.returnArrivingAt,
        totalAmount: confirmationEmail.totalAmount,
        currency: confirmationEmail.currency,
        cabinClass: confirmationEmail.cabinClass,
      }).catch((emailErr) => {
        console.error(
          "[flights/complete] confirmation email failed:",
          emailErr?.message || emailErr
        );
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
