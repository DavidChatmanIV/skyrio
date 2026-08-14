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
// Step 1 of the real checkout flow. Combines:
//   1. LiteAPI prebook (locks price, gets prebookId)
//   2. Stripe PaymentIntent creation for that exact amount
//
// This is what actually charges the GUEST — separate from the
// LiteAPI book step, which settles against Skyrio's own LiteAPI
// account. The frontend calls this first, collects payment via
// Stripe Elements, then calls /api/hotels/confirm-booking once
// Stripe confirms the charge succeeded.
//
// Body: { offerId, guestEmail, hotelName }
// Returns: { clientSecret, prebookId, totalPrice, currency }
// ─────────────────────────────────────────────────────────────
export async function initHotelCheckout(req, res) {
  try {
    const { offerId, guestEmail, hotelName } = req.body;

    if (!offerId) {
      return res.status(400).json({
        ok: false,
        message: "'offerId' is required",
      });
    }

    // ── Step 1: prebook with LiteAPI to lock the price ──
    const prebookResult = await liteapi.bookRequest("/rates/prebook", {
      method: "POST",
      body: { usePaymentSdk: false, offerId },
    });

    const prebookId =
      prebookResult?.data?.prebookId ?? prebookResult?.prebookId;
    const totalPrice =
      prebookResult?.data?.totalPrice ?? prebookResult?.totalPrice;
    const currency = prebookResult?.data?.currency ?? "USD";

    if (!prebookId || !Number.isFinite(totalPrice)) {
      return res.status(502).json({
        ok: false,
        message: "LiteAPI didn't return a valid prebook — please try again.",
        details: prebookResult,
      });
    }

    // ── Step 2: create a Stripe PaymentIntent for that exact amount ──
    // Stripe expects the smallest currency unit (cents for USD).
    const amountInCents = Math.round(totalPrice * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      receipt_email: guestEmail || undefined,
      metadata: {
        type: "hotel_booking",
        prebookId,
        offerId,
        hotelName: hotelName || "",
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      prebookId,
      totalPrice,
      currency,
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
// calls LiteAPI's /rates/book to actually confirm the room.
//
// Body: {
//   paymentIntentId,
//   prebookId,
//   holder: { firstName, lastName, email, phone },
//   guests: [{ occupancyNumber, firstName, lastName, email }]
// }
// ─────────────────────────────────────────────────────────────
export async function confirmHotelBooking(req, res) {
  try {
    const { paymentIntentId, prebookId, holder, guests } = req.body;

    if (!paymentIntentId || !prebookId) {
      return res.status(400).json({
        ok: false,
        message: "'paymentIntentId' and 'prebookId' are required",
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

    // ── Verify payment actually succeeded — server-side, not
    // just trusting whatever the frontend claims. ──
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return res.status(402).json({
        ok: false,
        message: `Payment has not completed (status: ${intent.status}). Booking was not confirmed.`,
      });
    }
    if (intent.metadata?.prebookId !== prebookId) {
      return res.status(400).json({
        ok: false,
        message: "Payment/prebook mismatch — booking was not confirmed.",
      });
    }

    // ── Payment confirmed — now actually book the room with LiteAPI ──
    const result = await liteapi.bookRequest("/rates/book", {
      method: "POST",
      body: {
        holder,
        guests,
        payment: { method: "ACC_CREDIT_CARD" },
        prebookId,
      },
    });

    return res.json({ ok: true, booking: result });
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
