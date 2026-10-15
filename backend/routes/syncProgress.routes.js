// GET /api/sync-progress/:groupId
// Returns what the signed-in traveler has booked for one Sync Together group.
// The trip card's "x of 2 booked", the flight/stay tiles AND the budget bar
// should all read from this ONE response, so they can never disagree again.
//
// Only the requester's own bookings are returned (filtered by `user`), so no
// other member's booking data is exposed.

import express from "express";
import mongoose from "mongoose";
import Booking from "../models/booking.js";
// ⚠️ Use the SAME auth middleware your other protected routes use.
// Adjust the path/name to match your project (e.g. protect, verifyToken).
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// A booking counts toward the trip when it is confirmed, or when it is still
// "pending" with the airline/hotel but has already been paid for.
// Cancelled and cancel_pending bookings never count.
function isActiveBooking(b) {
  if (b.status === "confirmed") return true;
  if (b.status === "pending" && b.paidAt) return true;
  return false;
}

function amountOf(b) {
  // totalAmount is the real charged amount from Stripe/LiteAPI; total is the
  // older field used by the admin dashboard. Prefer the real charge.
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

router.get("/:groupId", requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ ok: false, message: "Invalid group id" });
    }

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Not signed in" });
    }

    const bookings = await Booking.find({
      syncGroup: groupId,
      user: userId,
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

// ── Mount it in server.js / app.js (next to your other routes) ──
//
//   import syncProgressRoutes from "./routes/syncProgress.routes.js";
//   app.use("/api/sync-progress", syncProgressRoutes);
//
// The file name above is all lowercase except the "P" — make sure the import
// matches the file name EXACTLY, or Render (Linux) will fail to start.
