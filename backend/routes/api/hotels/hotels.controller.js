// ─────────────────────────────────────────────────────────────
// hotels.controller.js
// All LiteAPI business logic — imported by hotels.routes.js
// ─────────────────────────────────────────────────────────────

import Stripe from "stripe";
import { liteapi } from "./hotel.provider.js";
import {
  isValidDate,
  buildOccupancies,
  normalizeHotelRate,
} from "./hotels.utils.js";

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
// checkout flow uses initHotelCheckout() below instead, which
// combines this with Stripe PaymentIntent creation in one call.
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

// ─────────────────────────────────────────────────────────────
// POST /api/hotels/checkout-intent
//
// Step 1 of the real checkout flow. For EVERY room in the trip:
//   1. LiteAPI prebook (locks price, gets prebookId)
// Then, once every room is locked in:
//   2. ONE combined Stripe PaymentIntent covering all rooms
//
// This lets a multi-room booking (e.g. one room for the user,
// another for family/friends) go through a single card charge
// instead of one charge per room.
//
// Body (new, multi-room):
//   { offers: [{ offerId, hotelName }, ...], guestEmail }
// Body (legacy, single-room — still supported):
//   { offerId, hotelName, guestEmail }
//
// Returns:
//   { clientSecret, prebookIds: [...], totalPrice, currency, rooms }
// ─────────────────────────────────────────────────────────────
export async function initHotelCheckout(req, res) {
  try {
    const { guestEmail, hotelName } = req.body;

    // Accept either the new multi-room shape (`offers`) or the
    // original single-offer shape (`offerId`) for backward
    // compatibility with any existing caller.
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
      const totalPrice =
        prebookResult?.data?.totalPrice ?? prebookResult?.totalPrice;
      const currency = prebookResult?.data?.currency ?? "USD";

      if (!prebookId || !Number.isFinite(totalPrice)) {
        return res.status(502).json({
          ok: false,
          message:
            "LiteAPI didn't return a valid prebook for one of the rooms — please try again.",
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

    // A single Stripe PaymentIntent can only carry one currency —
    // if a multi-room trip somehow mixes currencies, make the caller
    // check out those rooms separately rather than silently picking one.
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

    // ── Step 2: ONE Stripe PaymentIntent for the combined total ──
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      receipt_email: guestEmail || undefined,
      metadata: {
        type: "hotel_booking",
        // Comma-separated (not JSON) to stay well under Stripe's
        // metadata value size limit even with several rooms.
        prebookIds: prebooks.map((p) => p.prebookId).join(","),
        roomCount: String(prebooks.length),
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
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
// POST /api/hotels/confirm-booking
//
// Step 2 of the real checkout flow. Call this ONLY after Stripe
// confirms the guest's payment succeeded (paymentIntent.status
// === "succeeded" on the frontend). This verifies the payment
// server-side too — never trust the client's word alone — then
// calls LiteAPI's /rates/book ONCE PER ROOM to confirm each one
// (LiteAPI only accepts a single prebookId per /rates/book call,
// so a multi-room trip means multiple sequential book calls here,
// all covered by the one Stripe charge already captured in step 1).
//
// Body (new, multi-room):
//   {
//     paymentIntentId,
//     bookings: [
//       { prebookId, holder: {firstName,lastName,email,phone}, guests: [...] },
//       ...
//     ]
//   }
// Body (legacy, single-room — still supported):
//   { paymentIntentId, prebookId, holder, guests }
// ─────────────────────────────────────────────────────────────
export async function confirmHotelBooking(req, res) {
  try {
    const { paymentIntentId } = req.body;

    const bookings = Array.isArray(req.body.bookings)
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

    // ── Verify payment actually succeeded — server-side, not just
    // trusting whatever the frontend claims. ──
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return res.status(402).json({
        ok: false,
        message: `Payment has not completed (status: ${intent.status}). Booking was not confirmed.`,
      });
    }

    const expectedPrebookIds = (intent.metadata?.prebookIds || "")
      .split(",")
      .filter(Boolean)
      .sort();
    const actualPrebookIds = bookings.map((b) => b.prebookId).sort();
    const setsMatch =
      expectedPrebookIds.length === actualPrebookIds.length &&
      expectedPrebookIds.every((id, i) => id === actualPrebookIds[i]);

    if (!setsMatch) {
      return res.status(400).json({
        ok: false,
        message: "Payment/prebook mismatch — booking was not confirmed.",
      });
    }

    // ── Payment confirmed — now book each room with LiteAPI. ──
    // IMPORTANT: the Stripe charge has already succeeded at this
    // point. If a /rates/book call fails partway through a
    // multi-room trip, the guest has already paid for every room
    // but not every room is actually booked — those are returned
    // in `failures` below so this can be flagged for a support
    // follow-up (manual booking completion or partial refund)
    // rather than silently losing track of it.
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
          `LiteAPI booking failed for prebookId ${b.prebookId} (payment already captured):`,
          err
        );
        failures.push({
          prebookId: b.prebookId,
          message: err?.message || "Booking failed",
        });
      }
    }

    if (failures.length > 0) {
      // 207 Multi-Status: partial success — some rooms booked, some not.
      return res.status(207).json({
        ok: false,
        message:
          "Payment succeeded, but one or more rooms could not be booked. Contact support to resolve.",
        bookings: results,
        failures,
      });
    }

    return res.json({ ok: true, bookings: results });
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
