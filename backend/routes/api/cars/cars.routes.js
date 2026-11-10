// backend/routes/api/cars/cars.routes.js
// Car rentals via Duffel Cars.  Mount in routes/api/index.js:
//   await mount("/cars", "./cars/cars.routes.js");
//
//   GET  /api/cars/search?location=MIA&pickupDate=2026-12-10&pickupTime=10:30
//                         &dropoffDate=2026-12-14&dropoffTime=10:30&driverAge=30
//   POST /api/cars/quote          { rateId }            → confirmed price + terms
//   POST /api/cars/book           { quoteId, driver }   → booking (saved to My Trips)
//   POST /api/cars/bookings/:id/cancel                  (signed-in owner)
//
// Only "postpaid" rates are offered for now: the traveler pays the rental
// company at pickup, so no card is taken by Skyrio. Prepaid/guarantee rates
// need a card step (Duffel Cards + 3DS) that isn't built yet.

import express from "express";
import { optionalAuth } from "../../../middleware/requireAuth.js";
import { holdLimiter } from "../../../middleware/rateLimits.js";
import { duffelFlights as duffel } from "../flights/Duffelflights.provider.js";
import { normalizeCarOffer, rentalDays } from "./cars.utils.js";
import { searchCars, carsEnabled, CarSearchError } from "./cars.service.js";
import mongoose from "mongoose";
import Booking from "../../../models/booking.js";
import SyncGroup from "../../../models/SyncGroup.js";
import Notification from "../../../models/notification.js";
import { currentUserId } from "../../../services/checkoutToken.js";

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ ok: false, message, ...extra });

function duffelCode(err) {
  return err?.response?.data?.errors?.[0]?.code || "";
}

// Traveler's device, as Duffel asks for fraud checks on bookings.
function deviceHeaders(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  const ua = req.get("user-agent");
  return {
    ...(ip && { "x-duffel-device-ip": ip }),
    ...(ua && { "x-duffel-device-user-agent": ua.slice(0, 500) }),
  };
}

// ── Search ────────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  try {
    const { location, pickupDate, pickupTime, dropoffDate, dropoffTime, driverAge } = req.query;
    const body = await searchCars({
      location,
      pickupDate,
      pickupTime: pickupTime || undefined,
      dropoffDate,
      dropoffTime: dropoffTime || undefined,
      driverAge: driverAge || undefined,
    });
    return res.json(body);
  } catch (err) {
    if (err instanceof CarSearchError) return fail(res, err.status, err.message);
    console.error("[cars/search] failed:", err.message);
    return fail(res, 502, "Car rental companies didn't respond. Please try again in a moment.");
  }
});

// ── Quote: confirms price + availability for the chosen car ──────────────
router.post("/quote", async (req, res) => {
  if (!carsEnabled()) return fail(res, 503, "Car rentals aren't available right now.");
  const { rateId, pickupDate, pickupTime, dropoffDate, dropoffTime } = req.body || {};
  if (!/^rae_/.test(String(rateId || ""))) return fail(res, 400, "Pick a car first.");
  try {
    const { data } = await duffel.post("/cars/quotes", { data: { rate_id: rateId } }, { timeout: 30000 });
    const q = data?.data || {};
    if (q.payment_type && q.payment_type !== "postpaid") {
      return fail(res, 409, "This rate needs payment up front, which Skyrio can't take yet. Please pick another car.");
    }
    const days = rentalDays(
      q.pickup_date || pickupDate,
      q.pickup_time || pickupTime,
      q.dropoff_date || dropoffDate,
      q.dropoff_time || dropoffTime
    );
    return res.json({
      ok: true,
      quote: {
        ...normalizeCarOffer(q, days),
        pickupDate: q.pickup_date || pickupDate || null,
        pickupTime: q.pickup_time || pickupTime || null,
        dropoffDate: q.dropoff_date || dropoffDate || null,
        dropoffTime: q.dropoff_time || dropoffTime || null,
      },
    });
  } catch (err) {
    const status = err?.response?.status;
    console.error("[cars/quote] failed:", duffelCode(err) || err.message);
    if (status === 404 || status === 422 || /unavailable|expired|not_found/i.test(duffelCode(err))) {
      return fail(res, 409, "This car is no longer available. Please pick another one.", { unavailable: true });
    }
    return fail(res, 502, "The rental company didn't respond. Please try again.");
  }
});

// ── Book ──────────────────────────────────────────────────────────────────
router.post("/book", holdLimiter, optionalAuth, async (req, res) => {
  if (!carsEnabled()) return fail(res, 503, "Car rentals aren't available right now.");
  const { quoteId, driver = {}, flightNumber, groupId } = req.body || {};
  if (!/^qut_/.test(String(quoteId || ""))) return fail(res, 400, "Your car selection expired. Please pick the car again.");

  const given = String(driver.firstName || "").trim();
  const family = String(driver.lastName || "").trim();
  const email = String(driver.email || "").trim().toLowerCase();
  const phone = String(driver.phone || "").replace(/[\s()-]/g, "");
  const dob = String(driver.dob || "");
  if (!given || !family) return fail(res, 400, "Enter the driver's first and last name as on their license.");
  if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email for your confirmation.");
  if (!E164_RE.test(phone)) return fail(res, 400, "Enter a valid phone number with country code.");
  if (!DATE_RE.test(dob)) return fail(res, 400, "Enter the driver's date of birth.");
  const flight = String(flightNumber || "").toUpperCase().replace(/\s/g, "");
  if (flight && !/^[A-Z0-9]{2}\d{1,4}$/.test(flight)) {
    return fail(res, 400, "Flight number should look like B6123 (or leave it blank).");
  }

  // Same quote booked twice (double tap) → return the first booking.
  const existing = await Booking.findOne({ "carRental.quoteId": quoteId }).catch(() => null);
  if (existing) {
    return res.json({ ok: true, duplicate: true, booking: { _id: existing._id }, reference: existing.carRental?.reference || null });
  }

  const userId = currentUserId(req) || null;
  // Sync Together: link the rental to the group trip, only if this signed-in
  // traveler is really on it (organizer, or a member who didn't decline).
  let syncGroup = null;
  if (userId && groupId && mongoose.isValidObjectId(groupId)) {
    const onTrip = await SyncGroup.exists({
      _id: groupId,
      $or: [
        { owner: userId },
        { members: { $elemMatch: { user: userId, status: { $ne: "declined" } } } },
      ],
    }).catch(() => null);
    if (onTrip) syncGroup = onTrip._id;
  }
  let b;
  try {
    const { data } = await duffel.post(
      "/cars/bookings",
      {
        data: {
          quote_id: quoteId,
          driver: {
            given_name: given,
            family_name: family,
            email,
            phone_number: phone,
            date_of_birth: dob,
          },
          ...(flight && { inbound_flight_number: flight }),
          metadata: { skyrio_user: userId ? String(userId) : "guest" },
        },
      },
      { timeout: 60000, headers: deviceHeaders(req) }
    );
    b = data?.data;
    if (!b?.id) throw new Error("Duffel returned no booking id");
  } catch (err) {
    const code = duffelCode(err);
    console.error("[cars/book] failed:", code || err.message, JSON.stringify(err?.response?.data?.errors?.[0] || {}));
    if (!err?.response) {
      return fail(res, 502, "We lost contact with the rental company. Please check My Trips before trying again.", { pending: true });
    }
    if (/high_fraud_risk/i.test(code)) {
      return fail(res, 422, "We couldn't confirm this rental. Please contact Skyrio support.");
    }
    if (/expired|unavailable|not_found/i.test(code) || err.response.status === 404) {
      return fail(res, 409, "This car is no longer available. Please pick another one.", { unavailable: true });
    }
    if (err.response.status === 422 || err.response.status === 400) {
      return fail(res, 400, "The rental company didn't accept the driver details. Please check them and try again.", { driverDetails: true });
    }
    return fail(res, 502, "The rental company couldn't confirm this car. Please try another one.");
  }

  const days = rentalDays(b.pickup_date, b.pickup_time, b.dropoff_date, b.dropoff_time);
  const offer = normalizeCarOffer(b, days);
  const pickupAt = b.pickup_date ? `${b.pickup_date}T${b.pickup_time || "10:00"}` : null;
  const dropoffAt = b.dropoff_date ? `${b.dropoff_date}T${b.dropoff_time || "10:00"}` : null;

  let saved = null;
  try {
    saved = await Booking.create({
      user: userId,
      name: `${given} ${family}`,
      email,
      tripDetails: [
        offer.supplier.name,
        offer.car.category ? `${offer.car.category} car` : "Car rental",
        offer.pickup.city || offer.pickup.name,
        b.pickup_date && b.dropoff_date ? `${b.pickup_date} → ${b.dropoff_date}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      type: "Car",
      ...(syncGroup && { syncGroup }),
      carRental: {
        bookingId: b.id,
        reference: b.reference || null,
        quoteId,
        supplier: offer.supplier,
        car: offer.car,
        pickup: offer.pickup,
        dropoff: offer.dropoff,
        pickupAt,
        dropoffAt,
        paymentType: b.payment_type || "postpaid",
        payAtPickup: { amount: offer.totalAmount, currency: offer.currency },
        mileage: offer.mileage,
        conditions: offer.conditions,
        privacyPolicies: offer.privacyPolicies,
        charges: offer.charges,
        flightNumber: flight || null,
        liveMode: b.live_mode ?? null,
      },
      dates: {
        start: pickupAt ? new Date(pickupAt) : undefined,
        end: dropoffAt ? new Date(dropoffAt) : undefined,
      },
      travelers: 1,
      passengers: [{ name: `${given} ${family}`, type: "adult", dob: new Date(dob), phone }],
      status: "confirmed",
      // Paid to the rental company at pickup — Skyrio collected nothing.
      total: 0,
      totalAmount: offer.totalAmount,
      totalCurrency: offer.currency,
      provider: "duffel",
      providerBookingIds: [b.id],
      confirmationCodes: b.reference ? [b.reference] : [],
    });
    // No booking XP: nothing is paid up front, so it can't be verified like
    // flights/hotels (keeps XP cheat-proof).
    if (userId) {
      await Notification.create({
        user: userId,
        type: "booking",
        title: "Car rental booked 🚗",
        message: `Your ${offer.supplier.name} car is confirmed${b.reference ? ` (ref ${b.reference})` : ""}. Pay at pickup.`,
        link: "/saved-trips",
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[cars/book] booked with Duffel but couldn't save Booking —", b.id, err.message);
  }

  return res.json({
    ok: true,
    booking: saved ? { _id: saved._id } : null,
    reference: b.reference || null,
    rental: {
      ...offer,
      pickupAt,
      dropoffAt,
      driver: { name: `${given} ${family}`, email },
    },
  });
});

// ── Cancel (signed-in owner) ──────────────────────────────────────────────
router.post("/bookings/:id/cancel", optionalAuth, async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) return fail(res, 401, "Log in to cancel this rental.");
  const booking = await Booking.findById(req.params.id).catch(() => null);
  if (!booking || booking.type !== "Car" || !booking.carRental?.bookingId) {
    return fail(res, 404, "Rental not found.");
  }
  if (String(booking.user) !== String(userId)) return fail(res, 403, "This rental belongs to a different account.");
  if (booking.status === "cancelled") return res.json({ ok: true, alreadyCancelled: true });

  try {
    await duffel.post(`/cars/bookings/${booking.carRental.bookingId}/actions/cancel`, {}, { timeout: 30000 });
    // Read it back: Duffel's docs say to check status after cancelling.
    const { data } = await duffel.get(`/cars/bookings/${booking.carRental.bookingId}`, { timeout: 20000 });
    const cancelled = data?.data?.status === "cancelled";
    booking.status = cancelled ? "cancelled" : "cancel_pending";
    booking.cancellation = { at: new Date(), by: "traveler", byUserId: userId, supplier: [data?.data?.status] };
    booking.markModified("cancellation");
    await booking.save();
    return res.json({ ok: true, status: booking.status });
  } catch (err) {
    console.error("[cars/cancel] failed:", duffelCode(err) || err.message);
    return fail(res, 502, "We couldn't cancel with the rental company. Please try again or contact support.");
  }
});

export default router;
