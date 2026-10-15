// GET /api/sync-progress/:groupId
// Returns what the signed-in traveler has booked for one Sync Together group.
// The trip card's "x of 2 booked", the flight/stay tiles AND the budget bar
// should all read from this ONE response, so they can never disagree.
//
// CRASH-SAFE: this file imports only express and mongoose, so it can never
// stop the server from booting on Render.
//   - The Booking model is looked up from mongoose at request time (it is
//     registered by your existing bookings routes), so the file name's
//     capitalization doesn't matter.
//   - The login token is checked here with jsonwebtoken, loaded on first use,
//     so a wrong guess about your auth middleware can't break startup.
//
// Only the requester's own bookings are returned (filtered by `user`).

import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// ── Auth ────────────────────────────────────────────────────────────────
// Reads "Authorization: Bearer <token>" (what the frontend already sends)
// and verifies it with your JWT secret. Tries the common env var names.
let jwtLib = null;
async function getJwt() {
  if (!jwtLib) {
    const mod = await import("jsonwebtoken");
    jwtLib = mod.default || mod;
  }
  return jwtLib;
}

function getJwtSecret() {
  return (
    process.env.JWT_SECRET ||
    process.env.JWT_SECRET_KEY ||
    process.env.ACCESS_TOKEN_SECRET ||
    process.env.TOKEN_SECRET ||
    null
  );
}

async function authFromBearer(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ ok: false, message: "Not signed in" });
    }

    const secret = getJwtSecret();
    if (!secret) {
      console.error("[sync-progress] No JWT secret env var found");
      return res
        .status(500)
        .json({ ok: false, message: "Auth is not configured" });
    }

    const jwt = await getJwt();
    const decoded = jwt.verify(token, secret);

    // Token payloads differ between projects; accept the usual shapes.
    const userId =
      decoded?.id ||
      decoded?._id ||
      decoded?.userId ||
      decoded?.sub ||
      decoded?.user?.id ||
      decoded?.user?._id ||
      null;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ ok: false, message: "Not signed in" });
    }

    req.syncUserId = String(userId);
    next();
  } catch (err) {
    if (
      err?.name === "TokenExpiredError" ||
      err?.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({ ok: false, message: "Not signed in" });
    }
    console.error("[sync-progress] auth error:", err);
    return res.status(500).json({ ok: false, message: "Auth failed" });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

// A booking counts toward the trip when it is confirmed, or when it is still
// "pending" with the airline/hotel but has already been paid for.
// Cancelled and cancel_pending bookings never count.
function isActiveBooking(b) {
  if (b.status === "confirmed") return true;
  if (b.status === "pending" && b.paidAt) return true;
  return false;
}

function amountOf(b) {
  // totalAmount is the real charged amount; total is the older field.
  const n = Number(b.totalAmount ?? b.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function summarize(b) {
  if (!b) return null;
  return {
    _id: b._id,
    type: b.type,
    status: b.status,
    tripDetails: b.tripDetails,
    amount: amountOf(b),
    currency: b.totalCurrency || "USD",
    flight: b.flight || null,
    hotelStay: b.hotelStay || null,
    dates: b.dates || null,
    createdAt: b.createdAt,
  };
}

// ── Route ───────────────────────────────────────────────────────────────

router.get("/:groupId", authFromBearer, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ ok: false, message: "Invalid group id" });
    }

    const Booking = mongoose.models.Booking;
    if (!Booking) {
      console.error("[sync-progress] Booking model is not registered");
      return res
        .status(500)
        .json({ ok: false, message: "Bookings are unavailable" });
    }

    const bookings = await Booking.find({
      syncGroup: groupId,
      user: req.syncUserId,
      status: { $in: ["pending", "confirmed"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const active = bookings.filter(isActiveBooking);

    // Most recent active booking of each kind.
    const flight = active.find((b) => b.type === "Flight") || null;
    const stay = active.find((b) => b.type === "Hotel") || null;

    const spent = active.reduce((sum, b) => sum + amountOf(b), 0);

    res.json({
      ok: true,
      flight: summarize(flight),
      stay: summarize(stay),
      bookedCount: (flight ? 1 : 0) + (stay ? 1 : 0),
      requiredCount: 2,
      spent: Math.round(spent * 100) / 100,
    });
  } catch (err) {
    console.error("[sync-progress] error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Could not load trip progress" });
  }
});

export default router;
