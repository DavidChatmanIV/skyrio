// ─────────────────────────────────────────────────────────────
// All LiteAPI business logic — imported by hotels.routes.js
// ─────────────────────────────────────────────────────────────

import Stripe from "stripe";
import { liteapi } from "./hotel.provider.js";
import {
  isValidDate,
  buildOccupancies,
  normalizeHotelRate,
} from "./hotels.utils.js";
import Booking from "../../../models/booking.js";
import User from "../../../models/user.js";
import Notification from "../../../models/notification.js";
import { awardXpForBooking } from "../../../services/xpService.js";
import { sendHotelConfirmation } from "../../../services/bookingEmails.js";
import { memberGroupId } from "../../../services/sharedRooms.js";
import {
  recordEmailResult,
  onGroupBookingSaved,
} from "../../../services/bookingConfirmations.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─────────────────────────────────────────────────────────────
// GET /api/hotels/lookup
//
// Resolves a destination into a list of LiteAPI hotelIds, which
// are then fed into searchHotels(). This is the missing link
// between "user searches Miami" and the rates endpoint, which
// requires specific hotelIds rather than a city name.
//
// Confirmed against real LiteAPI docs:
//   GET https://api.liteapi.travel/v3.0/data/hotels
//
// Query params (provide at least one of countryCode, placeId,
// iataCode, or latitude+longitude per LiteAPI's validation):
//   countryCode  — e.g. "US"
//   cityName     — e.g. "New York" (pairs with countryCode)
//   hotelName    — e.g. "Hilton" (optional filter)
//   latitude, longitude — coordinates
//   placeId      — Google Place ID
//   iataCode     — airport code, e.g. "JFK"
//   limit        — max results, default 1000
//   offset       — pagination offset, default 0
//   lastUpdatedAt — ISO timestamp, for incremental sync
// ─────────────────────────────────────────────────────────────
export async function lookupHotelsByLocation(req, res) {
  try {
    const {
      countryCode,
      cityName,
      hotelName,
      latitude,
      longitude,
      placeId,
      iataCode,
      limit = "1000",
      offset = "0",
      lastUpdatedAt,
    } = req.query;

    if (!countryCode && !placeId && !iataCode && !(latitude && longitude)) {
      return res.status(400).json({
        ok: false,
        message:
          "Provide one of: countryCode, placeId, iataCode, or latitude+longitude",
      });
    }

    const result = await liteapi.searchGet("/data/hotels", {
      countryCode,
      cityName,
      hotelName,
      latitude,
      longitude,
      placeId,
      iataCode,
      limit,
      offset,
      lastUpdatedAt,
    });

    return res.json({
      ok: true,
      hotels: result?.data ?? result,
    });
  } catch (err) {
    console.error("LiteAPI hotel lookup error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to look up hotels for this location",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/hotels/places
//
// Free-text location autocomplete, backed by LiteAPI's own
// /data/places endpoint (which wraps Google Places). This is a
// DIFFERENT endpoint from /data/hotels above — it takes a `query`
// string instead of countryCode/cityName, and returns places with
// a `placeId` that /data/hotels (and this app's /api/hotels/lookup)
// already accepts directly.
//
// IMPORTANT — this endpoint is billed per LiteAPI's pricing
// ($0.01/request as of their published docs, confirm current rate
// on your account). It should NOT be called on every keystroke —
// the frontend debounces this and requires a minimum query length
// before firing. Don't lower those guards without checking cost
// impact first.
//
// Query params:
//   query      — required, free-text search e.g. "Miami"
//   type       — optional, restrict results (e.g. "city")
//   language   — optional, e.g. "en"
// ─────────────────────────────────────────────────────────────
export async function searchPlaces(req, res) {
  try {
    const { query, type, language } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({
        ok: false,
        message: "'query' is required",
      });
    }

    // LiteAPI's required param for this endpoint is `textQuery`, not
    // `query` (https://docs.liteapi.travel/reference/get_data-places).
    // Our own /api/hotels/places?query=... contract is unaffected.
    const result = await liteapi.searchGet("/data/places", {
      textQuery: query.trim(),
      type,
      language,
    });

    return res.json({
      ok: true,
      places: result?.data ?? result,
    });
  } catch (err) {
    console.error("LiteAPI places search error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to search places",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/hotels/search
//
// Query params:
//   hotelIds    — comma-separated LiteAPI hotel IDs (required)
//                 e.g. "lp3803c,lp1897"
//   checkin     — YYYY-MM-DD (required)
//   checkout    — YYYY-MM-DD (required)
//   adults      — number, default 1
//   rooms       — number, default 1
// ─────────────────────────────────────────────────────────────
export async function searchHotels(req, res) {
  try {
    const {
      hotelIds,
      checkin,
      checkout,
      adults = "1",
      rooms = "1",
    } = req.query;

    if (!hotelIds) {
      return res.status(400).json({
        ok: false,
        message: "'hotelIds' is required (comma-separated LiteAPI hotel IDs)",
      });
    }
    if (!checkin || !isValidDate(checkin)) {
      return res.status(400).json({
        ok: false,
        message: "'checkin' is required (YYYY-MM-DD)",
      });
    }
    if (!checkout || !isValidDate(checkout)) {
      return res.status(400).json({
        ok: false,
        message: "'checkout' is required (YYYY-MM-DD)",
      });
    }

    const adultsNum = Number(adults);
    if (!Number.isInteger(adultsNum) || adultsNum < 1 || adultsNum > 9) {
      return res.status(400).json({
        ok: false,
        message: "'adults' must be an integer between 1 and 9",
      });
    }

    const hotelIdsArray = hotelIds.split(",").map((id) => id.trim());
    const occupancies = buildOccupancies(adultsNum, rooms);

    const result = await liteapi.searchRequest("/hotels/rates?rm=true", {
      method: "POST",
      body: {
        hotelIds: hotelIdsArray,
        occupancies,
        guestNationality: "US",
        currency: "USD",
        checkin,
        checkout,
        roomMapping: true,
        maxRatesPerHotel: 5,
      },
    });

    const rates = (result?.data ?? []).flatMap(normalizeHotelRate);

    return res.json({
      ok: true,
      count: rates.length,
      checkin,
      checkout,
      hotels: rates,
    });
  } catch (err) {
    console.error("LiteAPI search error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to search hotels",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/hotels/prebook
// Body: { offerId }
//
// Standalone prebook — kept for direct/manual testing. The real
// checkout flow uses initHotelCheckout() below instead.
// ─────────────────────────────────────────────────────────────
export async function prebookHotel(req, res) {
  try {
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({
        ok: false,
        message: "'offerId' is required",
      });
    }

    const result = await liteapi.bookRequest("/rates/prebook", {
      method: "POST",
      body: {
        usePaymentSdk: false,
        offerId,
      },
    });

    return res.json({ ok: true, prebook: result });
  } catch (err) {
    console.error("LiteAPI prebook error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to prebook hotel",
      details: err?.details,
    });
  }
}

// Reads the prebook price whichever field LiteAPI used.
function readPrebookPrice(prebookResult) {
  const d = prebookResult?.data ?? prebookResult ?? {};
  const candidates = [d.totalPrice, d.price, d.suggestedSellingPrice];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

// ─────────────────────────────────────────────────────────────
// POST /api/hotels/checkout-intent
//
// Step 1 of the real checkout flow. For EVERY room in the trip:
//   1. LiteAPI prebook (locks price, gets prebookId)
// Then, once every room is locked in:
//   2. ONE combined Stripe PaymentIntent covering all rooms —
//      AUTHORIZE ONLY (capture_method: "manual"). The card is held,
//      not charged. confirmHotelBooking() charges it only for the
//      rooms LiteAPI actually confirms.
//
// Body (multi-room):  { offers: [{ offerId, hotelName }, ...], guestEmail }
// Body (legacy):      { offerId, hotelName, guestEmail }
//
// Returns: { clientSecret, paymentIntentId, prebookIds, totalPrice, currency, rooms }
// ─────────────────────────────────────────────────────────────
export async function initHotelCheckout(req, res) {
  try {
    const { guestEmail, hotelName } = req.body;

    const offers = Array.isArray(req.body.offers)
      ? req.body.offers
      : req.body.offerId
      ? [{ offerId: req.body.offerId, hotelName }]
      : [];

    if (!offers.length) {
      return res.status(400).json({
        ok: false,
        message: "'offers' (array) or 'offerId' is required",
      });
    }

    // ── Step 1: prebook every room with LiteAPI to lock each price ──
    const prebooks = [];
    for (const offer of offers) {
      if (!offer?.offerId) {
        return res.status(400).json({
          ok: false,
          message: "Each offer must include an 'offerId'",
        });
      }

      const prebookResult = await liteapi.bookRequest("/rates/prebook", {
        method: "POST",
        body: { usePaymentSdk: false, offerId: offer.offerId },
      });

      const prebookId =
        prebookResult?.data?.prebookId ?? prebookResult?.prebookId;
      const totalPrice = readPrebookPrice(prebookResult);
      const currency =
        prebookResult?.data?.currency ?? prebookResult?.currency ?? "USD";

      console.log("[hotels/checkout-intent] prebook", {
        prebookId,
        totalPrice,
        currency,
      });

      if (!prebookId || !Number.isFinite(totalPrice)) {
        return res.status(502).json({
          ok: false,
          message:
            "We couldn't lock the price for one of the rooms. Please search again.",
          details: prebookResult,
        });
      }

      prebooks.push({
        offerId: offer.offerId,
        hotelName: offer.hotelName || "",
        prebookId,
        totalPrice,
        currency,
      });
    }

    // A single PaymentIntent can only carry one currency.
    const currency = prebooks[0].currency;
    if (prebooks.some((p) => p.currency !== currency)) {
      return res.status(422).json({
        ok: false,
        message:
          "Rooms in this trip have different currencies — please check them out separately.",
      });
    }

    const combinedTotal = prebooks.reduce((sum, p) => sum + p.totalPrice, 0);
    const amountInCents = Math.round(combinedTotal * 100);

    // ── Step 2: ONE Stripe PaymentIntent, AUTHORIZE ONLY ──
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      capture_method: "manual",
      payment_method_types: ["card"],
      receipt_email: guestEmail || undefined,
      metadata: {
        kind: "hotel_checkout",
        type: "hotel_booking",
        userId: String(req.user?._id || req.user?.id || ""),
        // Comma-separated (not JSON) to stay under Stripe's metadata size limit.
        prebookIds: prebooks.map((p) => p.prebookId).join(","),
        // Cents per room, same order as prebookIds — used to charge only
        // for the rooms that actually get booked.
        prebookCents: prebooks
          .map((p) => Math.round(p.totalPrice * 100))
          .join(","),
        roomCount: String(prebooks.length),
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      prebookIds: prebooks.map((p) => p.prebookId),
      totalPrice: combinedTotal,
      currency,
      rooms: prebooks,
    });
  } catch (err) {
    console.error("Hotel checkout init error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to start hotel checkout",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// finalizeHotelBookings(bookings)
//
// The actual "call LiteAPI and book every room" step. Also called
// from the split-payment completion path (splitPayments.controller.js)
// once every traveler's share has been paid — the LiteAPI booking call
// only ever happens in this one place.
//
// Callers must have ALREADY verified the payment (authorized or paid)
// before calling this — it only performs the LiteAPI booking calls.
//
// @param {Array<{prebookId, holder, guests}>} bookings
// @returns {Promise<{results: Array, failures: Array}>}
// ─────────────────────────────────────────────────────────────
export async function finalizeHotelBookings(bookings) {
  const results = [];
  const failures = [];

  for (const b of bookings) {
    try {
      const result = await liteapi.bookRequest("/rates/book", {
        method: "POST",
        body: {
          holder: b.holder,
          guests: b.guests,
          payment: { method: "ACC_CREDIT_CARD" },
          prebookId: b.prebookId,
        },
      });
      results.push({ prebookId: b.prebookId, booking: result });
    } catch (err) {
      console.error(
        `LiteAPI booking failed for prebookId ${b.prebookId}:`,
        err?.message || err
      );
      failures.push({
        prebookId: b.prebookId,
        message: err?.message || "Booking failed",
      });
    }
  }

  return { results, failures };
}

// ─────────────────────────────────────────────────────────────
// Saving the booking to Skyrio's database
//
// 1. createPendingHotelBooking() runs right after LiteAPI confirms the
//    room(s), BEFORE the card is charged. Status "pending".
// 2. The Booking _id is written onto the PaymentIntent's metadata, so
//    the Stripe webhook (stripe.routes.js) recognizes it.
// 3. markHotelBookingPaid() flips pending → confirmed atomically and
//    awards XP + notifications. The webhook does the same thing when
//    payment_intent.succeeded arrives; whichever runs first does it, the
//    other sees "confirmed" and skips, so XP is awarded once.
//
// A failure here never undoes a real booking or charge — it's logged
// so it can be fixed by hand.
// ─────────────────────────────────────────────────────────────
function toDate(v) {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

async function createPendingHotelBooking({
  userId,
  intent,
  results,
  bookings,
  trip,
  amountCents,
  groupId,
}) {
  try {
    if (!userId) throw new Error("no authenticated user on request");
    const syncGroup = await memberGroupId(groupId, userId);
    const rooms = Array.isArray(trip) ? trip : [];
    const first = rooms[0] || {};
    const holder = bookings[0].holder;

    const confirmation = results.map((r) => {
      const d = r.booking?.data ?? r.booking ?? {};
      return {
        prebookId: r.prebookId,
        bookingId: d.bookingId ?? null,
        hotelConfirmationCode: d.hotelConfirmationCode ?? null,
      };
    });

    const nights =
      first.checkin && first.checkout
        ? `${String(first.checkin).slice(0, 10)} → ${String(
            first.checkout
          ).slice(0, 10)}`
        : null;
    const tripDetails = [
      first.name || "Hotel stay",
      nights,
      results.length > 1 ? `${results.length} rooms` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const total = Math.round(amountCents) / 100;

    return await Booking.create({
      user: userId,
      syncGroup,
      name: `${holder.firstName} ${holder.lastName}`,
      email: holder.email,
      tripDetails,
      type: "Hotel",
      dates: { start: toDate(first.checkin), end: toDate(first.checkout) },
      travelers: Math.max(1, results.length),
      passengers: bookings
        .filter((b) => results.some((r) => r.prebookId === b.prebookId))
        .map((b) => ({
          name: `${b.holder.firstName} ${b.holder.lastName}`,
          type: "adult",
        })),
      status: "pending",
      total,
      totalAmount: total,
      totalCurrency: String(intent.currency || "usd").toUpperCase(),
      paymentIntentId: intent.id,
      stripePaymentIntentId: intent.id,
      provider: "liteapi",
      providerBookingIds: confirmation.map((c) => c.bookingId).filter(Boolean),
      confirmationCodes: confirmation
        .map((c) => c.hotelConfirmationCode)
        .filter(Boolean),
      hotelStay: { rooms, confirmation },
    });
  } catch (err) {
    console.error(
      "[hotels/confirm] couldn't save Booking (the room IS booked) —",
      intent?.id,
      err?.message
    );
    return null;
  }
}

async function markHotelBookingPaid(booking) {
  if (!booking) return;
  try {
    const flipped = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "pending" },
      { $set: { status: "confirmed", paidAt: new Date() } },
      { new: true }
    );
    if (!flipped) {
      // The webhook confirmed it first. Still make sure XP was granted —
      // the XP ledger pays each booking once, so this is safe.
      await awardXpForBooking(booking._id).catch((e) =>
        console.error("[hotels/confirm] booking XP failed:", e?.message)
      );
      return;
    }

    await Notification.create({
      user: flipped.user,
      type: "booking",
      title: "Booking Confirmed 🏨",
      message: "Your hotel stay is confirmed. Have a great trip!",
      link: "/saved-trips",
    });
    // Booking XP through the XP ledger (pending until check-in, plan
    // multiplier, taken back if cancelled).
    await awardXpForBooking(flipped._id);
  } catch (err) {
    console.error(
      "[hotels/confirm] booking saved but confirm/XP step failed —",
      String(booking._id),
      err?.message
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/hotels/confirm-booking
//
// Step 2 of the real checkout flow. Called after the card is
// AUTHORIZED on the frontend (status "requires_capture").
//   1. Verifies the authorization server-side and that the prebookIds
//      match the ones the payment was created for.
//   2. Books each room with LiteAPI.
//   3. Charges the card:
//        all rooms booked   → capture the full amount
//        some rooms booked  → capture only those rooms (rest released)
//        no rooms booked    → cancel (hold released, nothing charged)
//
// Body (multi-room):
//   { paymentIntentId, bookings: [{ prebookId, holder, guests }, ...] }
// Body (legacy):
//   { paymentIntentId, prebookId, holder, guests }
// ─────────────────────────────────────────────────────────────
// "Also staying" names typed at checkout: plain text, short, at most 8.
const cleanName = (v) =>
  String(v || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
const cleanNames = (list) =>
  (Array.isArray(list) ? list : [])
    .map(cleanName)
    .filter((n) => n.replace(/[^\p{L}]/gu, "").length >= 2)
    .slice(0, 8);
// Guest note for the hotel ("Also staying: …"). Kept short; dropped if empty.
const cleanGuests = (guests) =>
  (Array.isArray(guests) ? guests : []).map((g) => {
    const out = { ...g };
    if (out.remarks != null) {
      const note = String(out.remarks)
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, 300);
      if (note) out.remarks = note;
      else delete out.remarks;
    }
    return out;
  });

export async function confirmHotelBooking(req, res) {
  try {
    const { paymentIntentId, groupId } = req.body;
    // Room details for My Trips + emails, with the "also staying" names cleaned.
    const trip = Array.isArray(req.body.trip)
      ? req.body.trip.map((r) => ({
          ...r,
          alsoStaying: cleanNames(r?.alsoStaying),
        }))
      : req.body.trip;

    const rawBookings = Array.isArray(req.body.bookings)
      ? req.body.bookings
      : req.body.prebookId
      ? [
          {
            prebookId: req.body.prebookId,
            holder: req.body.holder,
            guests: req.body.guests,
          },
        ]
      : [];
    const bookings = rawBookings.map((b) => ({
      ...b,
      guests: cleanGuests(b?.guests),
    }));

    if (!paymentIntentId || !bookings.length) {
      return res.status(400).json({
        ok: false,
        message:
          "'paymentIntentId' and 'bookings' (or legacy 'prebookId') are required",
      });
    }

    for (const b of bookings) {
      if (!b.prebookId) {
        return res.status(400).json({
          ok: false,
          message: "Each booking must include a 'prebookId'",
        });
      }
      if (!b.holder?.firstName || !b.holder?.lastName || !b.holder?.email) {
        return res.status(400).json({
          ok: false,
          message:
            "Each booking's 'holder' must include firstName, lastName, and email",
        });
      }
      if (!Array.isArray(b.guests) || b.guests.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "Each booking's 'guests' must be a non-empty array",
        });
      }
    }

    // ── Verify the payment server-side ──
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const authorized = intent.status === "requires_capture";
    const alreadyPaid = intent.status === "succeeded"; // legacy auto-capture intents
    if (!authorized && !alreadyPaid) {
      return res.status(402).json({
        ok: false,
        message: `Payment has not been authorized (status: ${intent.status}). Booking was not confirmed.`,
      });
    }

    const userId = String(req.user?._id || req.user?.id || "");
    if (
      intent.metadata?.userId &&
      userId &&
      intent.metadata.userId !== userId
    ) {
      return res.status(403).json({
        ok: false,
        message: "This payment belongs to a different account.",
      });
    }

    const metaIds = (intent.metadata?.prebookIds || "")
      .split(",")
      .filter(Boolean);
    const metaCents = (intent.metadata?.prebookCents || "")
      .split(",")
      .map((n) => Number(n));
    const actualPrebookIds = bookings.map((b) => b.prebookId);
    const setsMatch =
      metaIds.length === actualPrebookIds.length &&
      [...metaIds]
        .sort()
        .every((id, i) => id === [...actualPrebookIds].sort()[i]);

    if (!setsMatch) {
      return res.status(400).json({
        ok: false,
        message: "Payment/prebook mismatch — booking was not confirmed.",
      });
    }

    // ── Book each room with LiteAPI ──
    const { results, failures } = await finalizeHotelBookings(bookings);

    // ── What to charge: only the rooms that were booked ──
    const bookedIds = new Set(results.map((r) => r.prebookId));
    const amountToCapture = failures.length
      ? metaIds.reduce(
          (sum, id, i) =>
            bookedIds.has(id) && Number.isFinite(metaCents[i])
              ? sum + metaCents[i]
              : sum,
          0
        )
      : intent.amount;

    // ── Save the booking (pending) before charging ──
    let saved = null;
    if (results.length) {
      saved = await createPendingHotelBooking({
        userId,
        intent,
        results,
        bookings,
        trip,
        amountCents: authorized
          ? amountToCapture
          : intent.amount_received || intent.amount,
        groupId,
      });
      if (saved && authorized) {
        // Lets the Stripe webhook find this booking (metadata merges).
        await stripe.paymentIntents
          .update(paymentIntentId, {
            metadata: { bookingId: String(saved._id) },
          })
          .catch((e) =>
            console.error(
              "[hotels/confirm] metadata update failed:",
              e?.message
            )
          );
      }
    }

    // ── Charge only for what was booked ──
    if (authorized) {
      if (!results.length) {
        await stripe.paymentIntents
          .cancel(paymentIntentId)
          .catch((e) =>
            console.error("[hotels/confirm] cancel failed:", e?.message)
          );
        return res.status(409).json({
          ok: false,
          message:
            "The hotel couldn't confirm your room, so your card was not charged. Please try another rate.",
          failures,
        });
      }

      try {
        if (failures.length) {
          await stripe.paymentIntents.capture(paymentIntentId, {
            amount_to_capture: amountToCapture,
          });
        } else {
          await stripe.paymentIntents.capture(paymentIntentId);
        }
      } catch (capErr) {
        // Rooms ARE booked; payment capture failed. Needs manual follow-up.
        console.error(
          "[hotels/confirm] RECONCILE — rooms booked but capture failed",
          paymentIntentId,
          capErr?.message
        );
        return res.status(500).json({
          ok: false,
          message:
            "Your room is booked and we're finalizing payment. Check My Trips shortly.",
          bookings: results,
          bookingRecordId: saved?._id || null,
        });
      }
    }

    await markHotelBookingPaid(saved);

    // ── Confirmation email (never blocks or undoes the booking) ──
    if (results.length) {
      const tripRooms = Array.isArray(trip) ? trip : [];
      const chargedCents = authorized
        ? amountToCapture
        : intent.amount_received || intent.amount;
      const emailRooms = bookings
        .map((b, i) => {
          const r = results.find((x) => x.prebookId === b.prebookId);
          if (!r) return null; // only rooms that were actually booked
          const d = r.booking?.data ?? r.booking ?? {};
          const room = tripRooms[i] || {};
          return {
            name: room.name || "Your hotel",
            roomName: room.roomName,
            boardName: room.boardName,
            address: room.address,
            checkin: room.checkin,
            checkout: room.checkout,
            guestName: `${b.holder.firstName} ${b.holder.lastName}`,
            alsoStaying: room.alsoStaying || [],
            confirmationCode: d.hotelConfirmationCode || d.bookingId || null,
          };
        })
        .filter(Boolean);
      sendHotelConfirmation({
        to: bookings[0].holder.email,
        guestName: bookings[0].holder.firstName,
        rooms: emailRooms,
        totalAmount: chargedCents / 100,
        currency: String(intent.currency || "usd").toUpperCase(),
        bookingId: saved?._id ? String(saved._id) : null,
        // Sync Together stays don't get the "try Sync Together" line.
        groupTrip: Boolean(saved?.syncGroup || groupId),
      })
        .then(
          (r) =>
            saved && recordEmailResult(saved._id, bookings[0].holder.email, r)
        )
        .catch(() => {})
        .finally(() => {
          if (saved?.syncGroup) onGroupBookingSaved(saved);
        });
    }

    if (failures.length > 0) {
      return res.status(207).json({
        ok: false,
        message: authorized
          ? "Some rooms couldn't be booked. You were only charged for the rooms that were confirmed."
          : "Payment succeeded, but one or more rooms could not be booked. Contact support to resolve.",
        bookings: results,
        failures,
        bookingRecordId: saved?._id || null,
      });
    }

    return res.json({
      ok: true,
      bookings: results,
      bookingRecordId: saved?._id || null,
    });
  } catch (err) {
    console.error("Hotel booking confirmation error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to confirm hotel booking",
      details: err?.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/hotels/book
//
// Direct/manual booking endpoint — kept for testing without the
// Stripe flow. The real checkout uses confirmHotelBooking() above.
// ─────────────────────────────────────────────────────────────
export async function bookHotel(req, res) {
  try {
    const { holder, guests, payment, prebookId } = req.body;

    if (!prebookId) {
      return res.status(400).json({
        ok: false,
        message: "'prebookId' is required",
      });
    }
    if (!holder?.firstName || !holder?.lastName || !holder?.email) {
      return res.status(400).json({
        ok: false,
        message: "'holder' must include firstName, lastName, and email",
      });
    }
    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "'guests' must be a non-empty array",
      });
    }

    const result = await liteapi.bookRequest("/rates/book", {
      method: "POST",
      body: {
        holder,
        guests,
        payment: payment ?? { method: "ACC_CREDIT_CARD" },
        prebookId,
      },
    });

    return res.json({ ok: true, booking: result });
  } catch (err) {
    console.error("LiteAPI booking error:", err);
    return res.status(err?.status || 500).json({
      ok: false,
      message: err?.message || "Failed to book hotel",
      details: err?.details,
    });
  }
}
