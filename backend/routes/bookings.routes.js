import { Router } from "express";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import authRequired from "../middleware/authRequired.js";
import { readAdminSession } from "./admin.routes.js";
import {
  sendCancellationEmail,
  sendCancellationRequestEmail,
  sendCancellationRequestAlert,
} from "../services/bookingEmails.js";
import mongoose from "mongoose";
import SplitPayment from "../models/SplitPayment.js";
import { cancelSharedRoom, SyncError } from "../services/sharedRooms.js";
import Stripe from "stripe";
import Notification from "../models/notification.js";
import {
  hotelGetBooking,
  hotelCancel,
  flightGetBooking,
  flightCancelQuote,
  flightCancel,
  pickAmount,
  extractFlightBookingId,
} from "../services/liteapiBookings.js";

const router = Router();

let _stripe;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not set");
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const isAdminUser = (req) =>
  req.user?.role === "admin" || req.user?.isAdmin === true;
const requireAdmin = (req, res, next) =>
  isAdminUser(req)
    ? next()
    : res.status(403).json({ message: "Admin access required." });

// ── Two ways to be an admin here ──
// 1. The admin-dashboard login (signed admin cookie; x-admin-email header
//    in local dev only — see admin.routes.js).
// 2. A regular Skyrio login whose account has role "admin".
const asAdminSession = (req, admin) => {
  req.user = {
    ...(req.user || {}),
    id: req.user?.id || `admin:${admin.email}`,
    email: req.user?.email || admin.email,
    role: "admin",
    adminSession: true,
  };
};

// Admin-only routes.
function adminOnly(req, res, next) {
  const admin = readAdminSession(req);
  if (admin) {
    asAdminSession(req, admin);
    return next();
  }
  return authRequired(req, res, () => requireAdmin(req, res, next));
}

// Owner-or-admin routes (cancel quote / cancel). A signed-in traveler acts
// as themselves; an admin-dashboard session can act on any booking.
function ownerOrAdmin(req, res, next) {
  const admin = readAdminSession(req);
  const hasBearer = /^bearer\s+\S+/i.test(req.headers.authorization || "");
  if (!hasBearer) {
    if (admin) {
      asAdminSession(req, admin);
      return next();
    }
    return res.status(401).json({ message: "Please log in." });
  }
  return authRequired(req, res, () => {
    if (admin && !isAdminUser(req)) {
      req.user = { ...req.user, role: "admin", adminSession: true };
    }
    next();
  });
}
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// LiteAPI booking IDs on a Skyrio booking record.
function supplierIds(b) {
  if (b.type === "Flight") {
    // Older flight records stored no top-level bookingId because LiteAPI
    // nests it — fall back to the raw LiteAPI response saved with the
    // booking so those trips can still be cancelled.
    return [
      b.flight?.bookingId,
      ...(b.providerBookingIds || []),
      extractFlightBookingId(b.flight?.liteapi),
    ]
      .filter(Boolean)
      .slice(0, 1);
  }
  const fromStay = (b.hotelStay?.confirmation || []).map((c) => c?.bookingId);
  return [
    ...new Set([...(b.providerBookingIds || []), ...fromStay].filter(Boolean)),
  ];
}

// Loads a booking the requester may act on: its owner, or an admin.
async function loadOwnedBooking(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Invalid booking id." });
    return null;
  }
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404).json({ message: "Booking not found." });
    return null;
  }
  if (!isAdminUser(req) && String(booking.user) !== String(req.user.id)) {
    res
      .status(403)
      .json({ message: "This booking belongs to a different account." });
    return null;
  }
  return booking;
}

// A share of a room shared with a Sync Together group can't be cancelled
// on its own — that would cancel the WHOLE room with the hotel but refund
// only one person. Only the organizer can cancel it, from the trip page,
// which refunds everyone their share. (Admins: use "Handle by hand" for
// one person's record if you need to.)
function blockSharedRoom(req, res, booking) {
  if (booking?.sharedRoom) {
    res.status(409).json({
      message: isAdminUser(req)
        ? "This is one person's share of a Sync Together shared room. Cancelling here would cancel the whole room but refund only this person — the organizer cancels it from the trip page (that refunds everyone). Use “Handle by hand” to adjust just this record."
        : "This room is shared with your Sync Together group, so only the trip organizer can cancel it — from the trip page.",
      sharedRoom: true,
      groupId: booking.sharedRoom.groupId || null,
    });
    return true;
  }
  return false;
}

// Hotel policy estimate from LiteAPI's booking record (policies are set by
// the hotel). Returns { refundable, estimatedFee, policies, ... }.
function summarizeHotelPolicy(data, paid) {
  const cp = data?.cancellationPolicies || {};
  const infos = Array.isArray(cp.cancelPolicyInfos) ? cp.cancelPolicyInfos : [];
  const now = Date.now();
  const passed = infos
    .filter((p) => p?.cancelTime && new Date(p.cancelTime).getTime() <= now)
    .sort((a, b) => new Date(b.cancelTime) - new Date(a.cancelTime));
  const fee = passed.length ? Number(passed[0].amount) || 0 : 0;
  const nonRefundable = cp.refundableTag === "NRFN";
  return {
    refundableTag: cp.refundableTag || null,
    policies: infos.map((p) => ({
      after: p.cancelTime,
      fee: Number(p.amount) || 0,
      currency: p.currency || data?.currency || "USD",
    })),
    estimatedFee: nonRefundable && !infos.length ? paid : Math.min(fee, paid),
    estimatedRefund:
      nonRefundable && !infos.length ? 0 : Math.max(0, round2(paid - fee)),
  };
}

// ── Upcoming trips helpers ──
// Pulls a usable trip date from whatever this booking stored. Flight records
// from /pending don't set `dates`, so fall back to flight fields, the hotel
// check-in, or the YYYY-MM-DD inside tripDetails.
const ISO_DAY = /\b(\d{4}-\d{2}-\d{2})\b/;
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
function tripDates(b) {
  const room = b.hotelStay?.rooms?.[0];
  const start =
    b.dates?.start ||
    room?.checkin ||
    b.flight?.departureDate ||
    b.flight?.departDate ||
    (String(b.tripDetails || "").match(ISO_DAY) || [])[1];
  const end = b.dates?.end || room?.checkout || b.flight?.returnDate;
  return { start: toDate(start), end: toDate(end) };
}

/**
 * GET /api/bookings/upcoming — the signed-in traveler's upcoming trips.
 * Covers solo AND Sync Together: each group member has their own booking
 * record (user = them, syncGroup set), so one query returns both.
 * Defined before any "/:id" GET so "upcoming" is never read as an id.
 */
router.get("/upcoming", authRequired, async (req, res) => {
  try {
    const docs = await Booking.find({
      user: req.user.id,
      status: { $in: ["confirmed", "cancel_pending"] },
    })
      .select(
        "tripDetails type status dates hotelStay.rooms flight.departureDate flight.departDate flight.returnDate flight.bookingRef syncGroup sharedRoom total totalAmount totalCurrency confirmationCodes createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const bookings = docs
      .map((b) => {
        const { start, end } = tripDates(b);
        return {
          _id: b._id,
          tripDetails: b.tripDetails,
          type: b.type,
          status: b.status,
          startDate: start,
          endDate: end,
          kind: b.syncGroup ? "group" : "solo",
          syncGroup: b.syncGroup || null,
          sharedRoom: !!b.sharedRoom,
          hotelName: b.hotelStay?.rooms?.[0]?.name || null,
          total: b.totalAmount ?? b.total,
          totalCurrency: b.totalCurrency || "USD",
          confirmation:
            b.confirmationCodes?.[0] || b.flight?.bookingRef || null,
        };
      })
      // Hide finished trips. Keep trips with no known date so they're never silently lost.
      .filter((b) => !b.startDate || (b.endDate || b.startDate) >= today)
      .sort(
        (a, b) =>
          (a.startDate?.getTime() ?? Infinity) -
          (b.startDate?.getTime() ?? Infinity)
      );

    res.json({ bookings });
  } catch (err) {
    console.error("GET /api/bookings/upcoming error:", err);
    res.status(500).json({ message: "Couldn't load your upcoming trips." });
  }
});

/**
 * GET /api/bookings/admin/search?q=&type=&status=&page=&limit=
 * Admin only. Searches traveler name/email (on the booking AND the account),
 * confirmation codes, LiteAPI booking IDs, Stripe payment IDs, route text,
 * passenger names, or an exact Skyrio booking id.
 */
router.get("/admin/search", adminOnly, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "25", 10), 1),
      100
    );
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status === "cancel_requested") {
      filter["cancelRequest.status"] = "open";
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const users = await User.find({
        $or: [{ email: rx }, { name: rx }, { username: rx }],
      })
        .select("_id")
        .limit(100)
        .lean();
      const or = [
        { name: rx },
        { email: rx },
        { tripDetails: rx },
        { confirmationCodes: rx },
        { providerBookingIds: rx },
        { stripePaymentIntentId: rx },
        { paymentIntentId: rx },
        { "passengers.name": rx },
        { "flight.bookingRef": rx },
        { "flight.bookingId": rx },
        { "flight.prebookId": rx },
        { "hotelStay.rooms.name": rx },
      ];
      if (users.length) or.push({ user: { $in: users.map((u) => u._id) } });
      if (mongoose.isValidObjectId(q)) or.push({ _id: q });
      filter.$or = or;
    }

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name username email")
        .lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/bookings/admin/search error:", err);
    res.status(500).json({ message: "Search failed." });
  }
});

/**
 * GET /api/bookings/admin/:id — admin only, full record incl. supplier data.
 */
router.get("/admin/:id", adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name username email createdAt")
      .lean();
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });
    res.json({ booking });
  } catch (err) {
    console.error("GET /api/bookings/admin/:id error:", err);
    res.status(500).json({ message: "Failed to load booking." });
  }
});

/**
 * GET /api/bookings/admin/:id/live — admin only. Fetches the booking's
 * CURRENT state straight from LiteAPI (status, policies, guest details).
 */
router.get("/admin/:id/live", adminOnly, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
    const ids = supplierIds(booking);
    if (!ids.length)
      return res
        .status(404)
        .json({ message: "No LiteAPI booking ID on this record." });
    const results = [];
    for (const id of ids) {
      try {
        const r =
          booking.type === "Flight"
            ? await flightGetBooking(id)
            : await hotelGetBooking(id);
        results.push({ bookingId: id, ok: true, data: r.data });
      } catch (e) {
        results.push({ bookingId: id, ok: false, message: e.message });
      }
    }
    res.json({ results });
  } catch (err) {
    console.error("GET /api/bookings/admin/:id/live error:", err);
    res.status(500).json({ message: "Failed to load live supplier data." });
  }
});

/**
 * POST /api/bookings/admin/:id/notes  { text } — admin only, internal notes.
 */
router.post("/admin/:id/notes", adminOnly, async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text)
      return res.status(400).json({ message: "Note text is required." });
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          adminNotes: {
            text: text.slice(0, 2000),
            by: String(req.user.id),
            at: new Date(),
          },
        },
      },
      { new: true }
    ).lean();
    if (!updated)
      return res.status(404).json({ message: "Booking not found." });
    res.json({ adminNotes: updated.adminNotes });
  } catch (err) {
    console.error("POST /api/bookings/admin/:id/notes error:", err);
    res.status(500).json({ message: "Failed to save note." });
  }
});

/**
 * POST /api/bookings/:id/cancel-request  { reason? } — owner or admin.
 * For when automatic cancellation terms aren't available. Records the
 * request, alerts support, and tells the traveler. Does NOT cancel anything.
 */
router.post("/:id/cancel-request", authRequired, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
    if (blockSharedRoom(req, res, booking)) return;
    if (booking.status !== "confirmed") {
      return res
        .status(400)
        .json({ message: "Only confirmed bookings can be cancelled." });
    }
    if (booking.cancelRequest?.status === "open") {
      return res.json({ ok: true, alreadyRequested: true, booking });
    }
    const reason = String(req.body?.reason || "")
      .trim()
      .slice(0, 500);
    booking.cancelRequest = {
      status: "open",
      at: new Date(),
      byUserId: String(req.user.id),
      reason: reason || null,
    };
    booking.markModified("cancelRequest");
    booking.adminNotes.push({
      text: `Traveler requested cancellation (automatic terms unavailable).${
        reason ? ` Note: ${reason}` : ""
      }`,
      by: "system",
      at: new Date(),
    });
    await booking.save();

    let to = booking.email;
    if (!to) {
      const u = await User.findById(booking.user)
        .select("email")
        .lean()
        .catch(() => null);
      to = u?.email;
    }
    // Emails never block the response.
    sendCancellationRequestEmail({
      to,
      name: (booking.name || "").split(" ")[0],
      tripDetails: booking.tripDetails,
      bookingId: String(booking._id),
    });
    sendCancellationRequestAlert({ booking, travelerEmail: to, reason });
    try {
      await Notification.create({
        user: booking.user,
        type: "booking",
        title: "Cancellation request received",
        message:
          "We'll confirm the cancellation terms with the airline or hotel and contact you before anything is cancelled.",
        link: "/saved-trips",
      });
    } catch (e) {
      console.error(
        "[bookings/cancel-request] notification failed:",
        e.message
      );
    }
    res.json({ ok: true, booking });
  } catch (err) {
    console.error("POST /api/bookings/:id/cancel-request error:", err);
    res
      .status(500)
      .json({
        message: "We couldn't send your request. Please contact support.",
      });
  }
});

/**
 * POST /api/bookings/admin/:id/cancel-request/resolve  { resolution } — admin.
 * Closes an open request after support has handled it (cancelled, or
 * traveler decided to keep the trip, etc.).
 */
router.post(
  "/admin/:id/cancel-request/resolve",
  adminOnly,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid booking id." });
      }
      const resolution = String(req.body?.resolution || "")
        .trim()
        .slice(0, 1000);
      if (!resolution)
        return res
          .status(400)
          .json({ message: "Describe how it was resolved." });
      const booking = await Booking.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ message: "Booking not found." });
      if (booking.cancelRequest?.status !== "open") {
        return res
          .status(400)
          .json({ message: "There's no open cancellation request." });
      }
      booking.cancelRequest = {
        ...booking.cancelRequest,
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: String(req.user.id),
        resolution,
      };
      booking.markModified("cancelRequest");
      booking.adminNotes.push({
        text: `Cancellation request resolved: ${resolution}`,
        by: String(req.user.id),
        at: new Date(),
      });
      await booking.save();
      res.json({ ok: true, booking });
    } catch (err) {
      console.error(
        "POST /api/bookings/admin/:id/cancel-request/resolve error:",
        err
      );
      res.status(500).json({ message: "Failed to resolve the request." });
    }
  }
);

/**
 * POST /api/bookings/admin/:id/manual-cancel — ADMIN ONLY.
 * Records a cancellation handled OUTSIDE Skyrio (phone/email/LiteAPI
 * support), refunds the traveler the chosen way, and notifies them.
 * Body: {
 *   note,                       // required — what happened
 *   supplierReference?,         // e.g. LiteAPI ticket # / hotel cancel code
 *   refundAmount,               // 0..amount paid
 *   refundMethod: "stripe" | "supplier" | "none",
 *     // stripe:   Skyrio refunds the card now (hotels — Skyrio took payment)
 *     // supplier: the airline/LiteAPI refunds the card (flights)
 *   notifyTraveler = true
 * }
 */
router.post("/admin/:id/manual-cancel", adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });
    if (!["confirmed", "cancel_pending"].includes(booking.status)) {
      return res
        .status(400)
        .json({
          message:
            "Only confirmed or cancel-pending bookings can be cancelled.",
        });
    }

    const note = String(req.body?.note || "")
      .trim()
      .slice(0, 1000);
    if (!note)
      return res
        .status(400)
        .json({ message: "Describe what happened (required)." });
    const supplierReference =
      String(req.body?.supplierReference || "")
        .trim()
        .slice(0, 200) || null;
    const refundMethod = ["stripe", "supplier", "none"].includes(
      req.body?.refundMethod
    )
      ? req.body.refundMethod
      : "none";
    const paid = Number(booking.totalAmount ?? booking.total) || 0;
    const currency = booking.totalCurrency || "USD";
    let refundAmount = round2(Number(req.body?.refundAmount) || 0);
    if (refundMethod === "none") refundAmount = 0;
    if (refundAmount < 0 || refundAmount > paid) {
      return res
        .status(400)
        .json({
          message: `Refund must be between 0 and the amount paid (${paid}).`,
        });
    }
    if (refundMethod !== "none" && refundAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Enter the refund amount, or choose “No refund”." });
    }
    if (refundMethod === "stripe" && !booking.stripePaymentIntentId) {
      return res.status(400).json({
        message:
          "This booking wasn't paid through Skyrio's Stripe — the airline/LiteAPI refunds it. Choose “Refunded by the airline / LiteAPI”.",
      });
    }

    // Refund (Stripe) — the cancellation is recorded even if this fails, so
    // the failure is visible and can be retried with "Issue a refund".
    let stripeRefundId = null;
    let refundStatus = "none";
    let refundError = null;
    if (refundMethod === "stripe") {
      try {
        const refund = await stripe().refunds.create(
          {
            payment_intent: booking.stripePaymentIntentId,
            amount: Math.round(refundAmount * 100),
            metadata: {
              bookingId: String(booking._id),
              reason: "manual_cancellation",
            },
          },
          { idempotencyKey: `skyrio_manual_cancel_${booking._id}` }
        );
        stripeRefundId = refund.id;
        refundStatus = refund.status === "succeeded" ? "succeeded" : "pending";
      } catch (e) {
        refundError = e.message;
        refundStatus = "failed";
        console.error(
          "[bookings/manual-cancel] Stripe refund failed",
          String(booking._id),
          e.message
        );
      }
    } else if (refundMethod === "supplier") {
      refundStatus = "pending"; // the airline/LiteAPI pays it out
    }

    const by = req.user?.email || String(req.user?.id || "admin");
    booking.status = "cancelled";
    booking.refundStatus = refundStatus;
    booking.refundAmount = refundAmount || null;
    if (refundStatus === "succeeded") booking.refundedAt = new Date();
    booking.cancellation = {
      at: new Date(),
      by: "admin",
      byUserId: String(req.user?.id || ""),
      manual: true,
      supplierReference,
      note,
      refundMethod,
      supplierRefund: refundMethod === "supplier" ? refundAmount : 0,
      cancellationFee: round2(Math.max(0, paid - refundAmount)),
      customerRefund: refundAmount,
      currency,
      stripeRefundId,
      refundError,
      partial: false,
    };
    booking.markModified("cancellation");
    if (booking.cancelRequest?.status === "open") {
      booking.cancelRequest = {
        ...booking.cancelRequest,
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: by,
        resolution: "Cancelled manually by Skyrio.",
      };
      booking.markModified("cancelRequest");
    }
    booking.adminNotes.push({
      text: `Cancelled manually by ${by}. ${note}${
        supplierReference ? ` · Supplier ref: ${supplierReference}` : ""
      } · Refund: ${
        refundMethod === "none"
          ? "none"
          : `${refundAmount} ${currency} via ${
              refundMethod === "stripe" ? "Stripe" : "airline/LiteAPI"
            }`
      }${refundError ? ` · STRIPE REFUND FAILED: ${refundError}` : ""}`,
      by,
      at: new Date(),
    });
    await booking.save();

    if (req.body?.notifyTraveler !== false) {
      (async () => {
        let to = booking.email;
        if (!to) {
          const u = await User.findById(booking.user)
            .select("email")
            .lean()
            .catch(() => null);
          to = u?.email;
        }
        await sendCancellationEmail({
          to,
          name: (booking.name || "").split(" ")[0],
          type: booking.type,
          tripDetails: booking.tripDetails,
          pending: false,
          partial: false,
          customerRefund: refundAmount,
          cancellationFee: 0,
          currency,
          bookingId: String(booking._id),
        });
      })();
      try {
        const amt = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(refundAmount || 0);
        await Notification.create({
          user: booking.user,
          type: "booking",
          title: "Trip cancelled",
          message:
            refundAmount > 0
              ? `Your ${
                  booking.type === "Hotel" ? "stay" : "flight"
                } is cancelled. A refund of ${amt} is on its way to your card (5–10 business days).`
              : `Your ${
                  booking.type === "Hotel" ? "stay" : "flight"
                } is cancelled. No refund applies to this booking.`,
          link: "/saved-trips",
        });
      } catch (e) {
        console.error(
          "[bookings/manual-cancel] notification failed:",
          e.message
        );
      }
    }

    res.json({
      ok: !refundError,
      message: refundError
        ? `Cancelled, but the Stripe refund failed: ${refundError}. Use “Issue a refund” to retry.`
        : "Cancelled.",
      booking,
    });
  } catch (err) {
    console.error("POST /api/bookings/admin/:id/manual-cancel error:", err);
    res
      .status(500)
      .json({ message: "Manual cancellation failed. Nothing was changed." });
  }
});

/**
 * POST /api/bookings/admin/:id/refund  { amount, reason } — ADMIN ONLY.
 * Refunds a Stripe-paid booking (hotels) by hand: goodwill credits, retries
 * of failed refunds. Never more than what's left of what was paid.
 */
router.post("/admin/:id/refund", adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });
    if (!booking.stripePaymentIntentId) {
      return res.status(400).json({
        message:
          "This booking wasn't paid through Skyrio's Stripe (flights are paid to LiteAPI). Refunds for it go through LiteAPI support.",
      });
    }
    const reason = String(req.body?.reason || "")
      .trim()
      .slice(0, 500);
    if (!reason)
      return res.status(400).json({ message: "Give a reason (required)." });
    const amount = round2(Number(req.body?.amount) || 0);
    const paid = Number(booking.totalAmount ?? booking.total) || 0;
    const currency = booking.totalCurrency || "USD";

    // Stripe is the source of truth for what's already been refunded.
    const pi = await stripe().paymentIntents.retrieve(
      booking.stripePaymentIntentId,
      {
        expand: ["latest_charge"],
      }
    );
    const charged = (pi.amount_received || 0) / 100;
    const alreadyRefunded = (pi.latest_charge?.amount_refunded || 0) / 100;
    const remaining = round2(
      Math.min(paid || charged, charged) - alreadyRefunded
    );
    if (amount <= 0 || amount > remaining) {
      return res.status(400).json({
        message: `Refund must be more than 0 and at most ${remaining.toFixed(
          2
        )} ${currency} (already refunded ${alreadyRefunded.toFixed(2)}).`,
      });
    }

    const refund = await stripe().refunds.create(
      {
        payment_intent: booking.stripePaymentIntentId,
        amount: Math.round(amount * 100),
        metadata: {
          bookingId: String(booking._id),
          reason: "manual_admin_refund",
        },
      },
      // Same amount + same already-refunded total = same request (safe double-click).
      {
        idempotencyKey: `skyrio_manual_refund_${booking._id}_${Math.round(
          alreadyRefunded * 100
        )}_${Math.round(amount * 100)}`,
      }
    );

    const by = req.user?.email || String(req.user?.id || "admin");
    booking.refundAmount = round2(alreadyRefunded + amount);
    booking.refundStatus =
      refund.status === "succeeded" ? "succeeded" : "pending";
    if (refund.status === "succeeded") booking.refundedAt = new Date();
    booking.adminNotes.push({
      text: `Manual refund of ${amount.toFixed(
        2
      )} ${currency} by ${by} (Stripe ${refund.id}). Reason: ${reason}`,
      by,
      at: new Date(),
    });
    await booking.save();
    // The traveler's "refund issued" email is sent by the Stripe webhook
    // (charge.refunded) once Stripe confirms it.
    res.json({ ok: true, refundId: refund.id, booking });
  } catch (err) {
    console.error("POST /api/bookings/admin/:id/refund error:", err);
    res.status(502).json({ message: `Refund failed: ${err.message}` });
  }
});

/**
 * POST /api/bookings/admin/:id/shared-room/cancel — admin only.
 * Fallback for when the organizer can't: cancels the WHOLE shared room
 * with the hotel and refunds every person their share of the hotel's
 * refund (same as the organizer's button on the trip page).
 */
router.post("/admin/:id/shared-room/cancel", adminOnly, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
    const splitId = booking.sharedRoom?.splitPaymentId;
    if (!splitId)
      return res.status(400).json({ message: "This isn't a shared room." });
    const split = await SplitPayment.findById(splitId);
    if (!split)
      return res.status(404).json({ message: "Shared room record not found." });
    const out = await cancelSharedRoom({
      split,
      actorUserId: req.user.id,
      actorName: "Skyrio support",
    });
    res.json({
      ok: true,
      ...out,
      message:
        "Shared room cancelled. Everyone's share of the refund is on its way.",
    });
  } catch (err) {
    if (err instanceof SyncError)
      return res.status(err.status).json({ message: err.message });
    console.error("POST /admin/:id/shared-room/cancel error:", err);
    res.status(500).json({ message: "Couldn't cancel the shared room." });
  }
});

/**
 * GET /api/bookings/:id/cancel-quote — owner or admin.
 * Shows what cancelling would cost BEFORE anything is cancelled.
 * Hotels: from the hotel's policies on LiteAPI's booking record.
 * Flights: LiteAPI's cancellation quote (an estimate — the airline decides).
 */
router.get("/:id/cancel-quote", ownerOrAdmin, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
    if (blockSharedRoom(req, res, booking)) return;
    if (booking.status === "cancelled" || booking.status === "cancel_pending") {
      return res.json({
        cancellable: false,
        reason: "This booking is already cancelled or being cancelled.",
      });
    }
    if (booking.status !== "confirmed") {
      return res.json({
        cancellable: false,
        reason: "Only confirmed bookings can be cancelled.",
      });
    }
    const ids = supplierIds(booking);
    if (!ids.length) {
      return res.json({
        cancellable: false,
        reason:
          "This booking has no supplier reference on file. Contact support to cancel it.",
      });
    }
    const paid = Number(booking.totalAmount ?? booking.total) || 0;
    const currency = booking.totalCurrency || "USD";

    if (booking.type === "Hotel") {
      let estimatedRefund = 0;
      let estimatedFee = 0;
      const rooms = [];
      const perRoomPaid = ids.length ? paid / ids.length : paid;
      for (const id of ids) {
        const { data } = await hotelGetBooking(id);
        const s = summarizeHotelPolicy(data, perRoomPaid);
        estimatedRefund += s.estimatedRefund;
        estimatedFee += s.estimatedFee;
        rooms.push({ bookingId: id, ...s });
      }
      return res.json({
        cancellable: true,
        type: "Hotel",
        paid,
        currency,
        estimatedRefund: round2(estimatedRefund),
        estimatedFee: round2(estimatedFee),
        rooms,
        note: "Based on the hotel's cancellation policy. The final refund is confirmed when you cancel.",
      });
    }

    // Flight
    let data;
    try {
      ({ data } = await flightCancelQuote(ids[0]));
    } catch (quoteErr) {
      // A cancelled booking can't be quoted. Check its live status so the
      // traveler/admin sees the truth instead of "try again later".
      try {
        const live = await flightGetBooking(ids[0]);
        const st = String(
          live.data?.status || live.data?.data?.status || ""
        ).toUpperCase();
        if (st.startsWith("CANCELLED")) {
          return res.json({
            cancellable: true,
            alreadyCancelledWithSupplier: true,
            type: "Flight",
            paid,
            currency,
            estimatedRefund: null,
            estimatedFee: null,
            note: "The airline already shows this booking as cancelled. Confirming will update Skyrio's records and notify the traveler.",
          });
        }
      } catch {
        /* fall through to the original error */
      }
      throw quoteErr;
    }
    const refund = pickAmount(data, [
      "refund",
      "refundAmount",
      "refund_amount",
      "maxRefund",
    ]);
    const fee = pickAmount(data, [
      "penalty",
      "cancellationFee",
      "cancellation_fee",
      "fee",
    ]);
    return res.json({
      cancellable: data?.isCancellable !== false,
      type: "Flight",
      paid,
      currency,
      isRefundable: data?.isRefundable ?? null,
      isVoidable: data?.isVoidable ?? null,
      estimatedRefund: refund != null ? round2(Math.min(refund, paid)) : null,
      estimatedFee: fee != null ? round2(fee) : null,
      note: "This is the airline's maximum possible refund, not a guarantee. The airline confirms the final amount, and refunds go back to the card used.",
      raw: isAdminUser(req) ? data : undefined,
    });
  } catch (err) {
    console.error(
      "GET /api/bookings/:id/cancel-quote error:",
      err?.message,
      err?.lite || ""
    );
    // canRequest: the traveler can still send a cancellation request that a
    // person handles — so they're never stuck with no way to cancel.
    res.status(502).json({
      message:
        "We couldn't get the cancellation terms automatically right now.",
      canRequest: true,
    });
  }
});

/**
 * POST /api/bookings/:id/cancel — owner or admin.
 * Cancels with the supplier FIRST, then refunds what the supplier refunds.
 *  - Hotels: Skyrio collected payment (Stripe) → Skyrio refunds the traveler
 *    min(supplier refund, amount paid).
 *  - Flights: LiteAPI collected payment → LiteAPI/airline refunds the card.
 */
router.post("/:id/cancel", ownerOrAdmin, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
    if (blockSharedRoom(req, res, booking)) return;
    if (booking.status === "cancelled") {
      return res.json({ ok: true, alreadyCancelled: true, booking });
    }
    if (booking.status === "cancel_pending") {
      return res
        .status(202)
        .json({
          ok: true,
          pending: true,
          message: "The airline is still processing this cancellation.",
        });
    }
    if (booking.status !== "confirmed") {
      return res
        .status(400)
        .json({ message: "Only confirmed bookings can be cancelled." });
    }
    const ids = supplierIds(booking);
    if (!ids.length) {
      return res
        .status(400)
        .json({
          message: "No supplier reference on file. Contact support to cancel.",
        });
    }

    const actor =
      isAdminUser(req) && String(booking.user) !== String(req.user.id)
        ? "admin"
        : "traveler";
    const paid = Number(booking.totalAmount ?? booking.total) || 0;
    const currency = booking.totalCurrency || "USD";
    const supplier = [];

    // ── 1. Cancel with the supplier ──
    if (booking.type === "Hotel") {
      for (const id of ids) {
        try {
          const r = await hotelCancel(id);
          supplier.push({
            bookingId: id,
            ok: true,
            httpStatus: r.httpStatus,
            data: r.data,
          });
        } catch (e) {
          supplier.push({ bookingId: id, ok: false, message: e.message });
        }
      }
    } else {
      try {
        const r = await flightCancel(ids[0]);
        supplier.push({
          bookingId: ids[0],
          ok: true,
          httpStatus: r.httpStatus,
          data: r.data,
        });
      } catch (e) {
        supplier.push({ bookingId: ids[0], ok: false, message: e.message });
      }
    }

    // "Already cancelled" means the supplier's side is ALREADY in the state
    // we want — Skyrio's record is just behind. Treat it as success and sync,
    // reading the supplier's live record for any refund details.
    const ALREADY_CANCELLED = /already\s+cancel/i;
    for (const sup of supplier) {
      if (!sup.ok && ALREADY_CANCELLED.test(sup.message || "")) {
        sup.ok = true;
        sup.alreadyCancelled = true;
        sup.data = {};
        try {
          const live =
            booking.type === "Flight"
              ? await flightGetBooking(sup.bookingId)
              : await hotelGetBooking(sup.bookingId);
          sup.data = live.data || {};
        } catch (e) {
          sup.liveError = e.message;
        }
      }
    }
    if (supplier.some((x) => x.alreadyCancelled)) {
      console.warn(
        "[bookings/cancel] supplier already cancelled — syncing Skyrio record",
        String(booking._id)
      );
    }

    const succeeded = supplier.filter((s) => s.ok);
    if (!succeeded.length) {
      console.error(
        "[bookings/cancel] supplier refused",
        String(booking._id),
        supplier
      );
      return res.status(502).json({
        message:
          "The airline/hotel didn't accept the cancellation. Nothing was changed. Please try again or contact support.",
        supplier: isAdminUser(req) ? supplier : undefined,
      });
    }

    const supplierRefund = round2(
      succeeded.reduce(
        (sum, s) =>
          sum +
          (pickAmount(s.data, ["refund_amount", "refundAmount", "refund"]) ||
            0),
        0
      )
    );
    const cancellationFee = round2(
      succeeded.reduce(
        (sum, s) =>
          sum +
          (pickAmount(s.data, [
            "cancellation_fee",
            "cancellationFee",
            "penalty",
          ]) || 0),
        0
      )
    );

    const flightPending =
      booking.type === "Flight" &&
      !succeeded[0].alreadyCancelled &&
      (succeeded[0].httpStatus === 202 ||
        String(succeeded[0].data?.status || "").toUpperCase() === "CONFIRMED");

    // ── 2. Refund (hotels only — Skyrio holds that payment) ──
    let customerRefund = 0;
    let stripeRefundId = null;
    let refundStatus = booking.refundStatus || "none";
    let refundError = null;
    if (booking.type === "Hotel" && booking.stripePaymentIntentId) {
      customerRefund = round2(Math.min(supplierRefund, paid));
      if (customerRefund > 0) {
        try {
          const refund = await stripe().refunds.create(
            {
              payment_intent: booking.stripePaymentIntentId,
              amount: Math.round(customerRefund * 100),
              metadata: {
                bookingId: String(booking._id),
                reason: "supplier_cancellation",
              },
            },
            { idempotencyKey: `skyrio_cancel_refund_${booking._id}` }
          );
          stripeRefundId = refund.id;
          refundStatus =
            refund.status === "succeeded" ? "succeeded" : "pending";
        } catch (e) {
          refundError = e.message;
          refundStatus = "failed";
          console.error(
            "[bookings/cancel] RECONCILE — supplier cancelled but Stripe refund failed",
            String(booking._id),
            e.message
          );
        }
      }
    } else if (booking.type === "Flight") {
      customerRefund = supplierRefund;
      refundStatus = supplierRefund > 0 ? "pending" : "none"; // refunded by LiteAPI/airline
    }

    // ── 3. Save ──
    const partial = succeeded.length < supplier.length;
    booking.status = flightPending
      ? "cancel_pending"
      : partial
      ? "confirmed"
      : "cancelled";
    booking.refundStatus = refundStatus;
    booking.refundAmount = customerRefund || null;
    if (refundStatus === "succeeded") booking.refundedAt = new Date();
    booking.cancellation = {
      at: new Date(),
      by: actor,
      byUserId: String(req.user.id),
      supplier,
      supplierRefund,
      cancellationFee,
      customerRefund,
      currency,
      stripeRefundId,
      refundError,
      partial,
    };
    booking.markModified("cancellation");
    if (
      booking.cancelRequest?.status === "open" &&
      booking.status !== "confirmed"
    ) {
      booking.cancelRequest = {
        ...booking.cancelRequest,
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: String(req.user.id),
        resolution: "Cancelled through Skyrio.",
      };
      booking.markModified("cancelRequest");
    }
    await booking.save();

    // ── 4. Tell the traveler (email never blocks the response) ──
    (async () => {
      let to = booking.email;
      if (!to) {
        const u = await User.findById(booking.user)
          .select("email")
          .lean()
          .catch(() => null);
        to = u?.email;
      }
      await sendCancellationEmail({
        to,
        name: (booking.name || "").split(" ")[0],
        type: booking.type,
        tripDetails: booking.tripDetails,
        pending: flightPending,
        partial,
        customerRefund,
        cancellationFee,
        currency,
        bookingId: String(booking._id),
      });
    })();
    try {
      const money = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(customerRefund || 0);
      await Notification.create({
        user: booking.user,
        type: "booking",
        title: flightPending ? "Cancellation requested ✈️" : "Trip cancelled",
        message: flightPending
          ? "The airline is processing your cancellation. We'll update your trip when it's final."
          : customerRefund > 0
          ? `Your ${
              booking.type === "Hotel" ? "stay" : "flight"
            } is cancelled. A refund of ${money} is on its way to your card (5–10 business days).`
          : `Your ${
              booking.type === "Hotel" ? "stay" : "flight"
            } is cancelled. Under the ${
              booking.type === "Hotel" ? "hotel's" : "airline's"
            } policy, no refund applies.`,
        link: "/saved-trips",
      });
    } catch (e) {
      console.error("[bookings/cancel] notification failed:", e.message);
    }

    const status = partial ? 207 : flightPending ? 202 : 200;
    res.status(status).json({
      ok: !partial,
      pending: flightPending,
      partial,
      customerRefund,
      cancellationFee,
      currency,
      refundStatus,
      message: partial
        ? "Some rooms were cancelled but at least one wasn't. We've recorded what happened — contact support to finish."
        : flightPending
        ? "Cancellation requested. The airline will confirm it shortly."
        : "Cancelled.",
      booking,
    });
  } catch (err) {
    console.error("POST /api/bookings/:id/cancel error:", err);
    res
      .status(500)
      .json({
        message:
          "Cancellation failed. Nothing was charged; please contact support.",
      });
  }
});

/**
 * GET /api/bookings
 * Supports:
 *  - ?page=1&limit=20
 *  - ?sortBy=createdAt&sortDir=desc|asc
 *  - Admin: all bookings (unless ?mine=1)
 *  - Normal user: only their bookings
 *  - ?mine=1: only the signed-in user's bookings, for everyone
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "20", 10), 1),
      100
    );
    const sortBy = req.query.sortBy || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortDir };
    const isAdmin = req.user?.role === "admin" || req.user?.isAdmin === true;
    // ?mine=1 — always only the signed-in user's own bookings, even for
    // admins (used by the My Trips page so admins don't see everyone's).
    const mineOnly = req.query.mine === "1" || req.query.mine === "true";
    const baseFilter = isAdmin && !mineOnly ? {} : { user: req.user.id };

    const [items, total] = await Promise.all([
      Booking.find(baseFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("user", "email")
        .populate("hotel")
        .populate("package")
        .populate("place"),
      // ✅ Removed .populate("flight") — flight is a plain embedded
      // subdocument (no `ref` in the schema), not an ObjectId reference.
      // Mongoose 6+ defaults strictPopulate to true, which throws
      // StrictPopulateError on a populate() call against a non-ref path.
      // Flight data is already embedded inline on the document, so it
      // needs no populate at all.
      Booking.countDocuments(baseFilter),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/bookings error:", err);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

/**
 * POST /api/bookings/pending
 *
 * Creates a lightweight "pending" Booking after a LiteAPI prebook.
 *
 * SECURITY NOTE: `total` is currently trusted from the client. Re-derive it
 * from LiteAPI's prebook response before relying on it for payment amounts.
 */
router.post("/pending", authRequired, async (req, res) => {
  try {
    const {
      prebookId,
      offerId,
      total,
      currency = "usd",
      passengers,
      flightSummary,
    } = req.body;

    if (!prebookId || !offerId) {
      return res.status(400).json({
        ok: false,
        message: "prebookId and offerId are required",
      });
    }

    if (!total || total <= 0) {
      return res.status(400).json({
        ok: false,
        message: "A valid total is required to create a pending booking",
      });
    }

    // Idempotency — reuse an existing pending booking on refresh.
    const existing = await Booking.findOne({
      prebookId,
      user: req.user.id,
    });
    if (existing) {
      return res.json({ ok: true, bookingId: existing._id, reused: true });
    }

    const tripDetails =
      flightSummary?.from && flightSummary?.to
        ? `${flightSummary.from} → ${flightSummary.to}`
        : "Flight booking";

    const newBooking = new Booking({
      user: req.user.id,
      type: "Flight",
      tripDetails,
      prebookId,
      offerId,
      total,
      totalCurrency: currency.toUpperCase(),
      status: "pending",
      flight: flightSummary || undefined,
      // `travelers` is a headcount (Number), not an array of passengers.
      travelers: Array.isArray(passengers) ? passengers.length : undefined,
    });

    await newBooking.save();

    return res.json({ ok: true, bookingId: newBooking._id });
  } catch (err) {
    console.error("POST /api/bookings/pending error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create pending booking" });
  }
});

/**
 * POST /api/bookings
 */
router.post("/", authRequired, async (req, res) => {
  try {
    const { hotel, flight, pkg, place, dates, travelers } = req.body;

    // tripDetails and type are both `required: true` on the Booking schema
    // with no defaults, so both are derived from the booking data present.
    const type = flight
      ? "Flight"
      : hotel
      ? "Hotel"
      : pkg
      ? "Package"
      : req.body.type;

    if (!type) {
      return res.status(400).json({
        message:
          "Could not determine booking type — provide flight, hotel, or pkg.",
      });
    }

    const tripDetails =
      flight?.origin && flight?.destination
        ? `${flight.origin} → ${flight.destination}`
        : hotel?.name
        ? hotel.name
        : pkg?.name || place?.name || "Trip booking";

    const newBooking = new Booking({
      user: req.user.id,
      tripDetails,
      type,
      hotel,
      flight,
      package: pkg,
      place,
      dates,
      travelers,
    });

    await newBooking.save();

    // XP is awarded only after a verified payment (webhook / checkout
    // completion), never here at creation time.

    // No email here: this legacy route creates an UNPAID record. Real
    // confirmations are sent by the flight/hotel checkouts after payment.

    await newBooking.populate("user", "email");
    await newBooking.populate("hotel");
    await newBooking.populate("package");
    await newBooking.populate("place");

    res.status(201).json(newBooking);
  } catch (err) {
    console.error("❌ Failed to create booking:", err);
    res.status(500).json({ message: "Error creating booking." });
  }
});

/**
 * DELETE /api/bookings/:id — ADMIN ONLY. Removes an abandoned checkout record.
 * Only UNPAID "pending" records older than an hour can be removed: those are
 * checkouts that were started and never paid. Confirmed or cancelled trips
 * are never deleted — they're the history of real money and real bookings.
 * This never cancels anything with a supplier or refunds anyone.
 */
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });

    if (booking.status !== "pending" || booking.paidAt) {
      return res.status(400).json({
        message:
          "Only unpaid pending records can be removed. Confirmed and cancelled trips are kept as booking history.",
      });
    }
    const ageMs = Date.now() - new Date(booking.createdAt || 0).getTime();
    if (ageMs < 60 * 60 * 1000) {
      return res.status(400).json({
        message:
          "This checkout started less than an hour ago and may still be in progress. Try again later.",
      });
    }

    await booking.deleteOne();
    console.log(
      "[bookings] admin removed abandoned pending record",
      String(booking._id),
      "by",
      req.user?.email || req.user?.id
    );
    res.json({ ok: true, message: "Abandoned checkout record removed." });
  } catch (err) {
    console.error("DELETE /api/bookings/:id error:", err);
    res.status(500).json({ message: "Couldn't remove the record." });
  }
});

export default router;
