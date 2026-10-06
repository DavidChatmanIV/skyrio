import { Router } from "express";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import authRequired from "../middleware/authRequired.js";
import { sendCancellationEmail } from "../services/bookingEmails.js";
import mongoose from "mongoose";
import Stripe from "stripe";
import Notification from "../models/notification.js";
import {
  hotelGetBooking,
  hotelCancel,
  flightGetBooking,
  flightCancelQuote,
  flightCancel,
  pickAmount,
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
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// LiteAPI booking IDs on a Skyrio booking record.
function supplierIds(b) {
  if (b.type === "Flight") {
    return [b.flight?.bookingId, ...(b.providerBookingIds || [])]
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

/**
 * GET /api/bookings/admin/search?q=&type=&status=&page=&limit=
 * Admin only. Searches traveler name/email (on the booking AND the account),
 * confirmation codes, LiteAPI booking IDs, Stripe payment IDs, route text,
 * passenger names, or an exact Skyrio booking id.
 */
router.get("/admin/search", authRequired, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "25", 10), 1),
      100
    );
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;

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
router.get("/admin/:id", authRequired, requireAdmin, async (req, res) => {
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
router.get("/admin/:id/live", authRequired, requireAdmin, async (req, res) => {
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
router.post(
  "/admin/:id/notes",
  authRequired,
  requireAdmin,
  async (req, res) => {
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
  }
);

/**
 * GET /api/bookings/:id/cancel-quote — owner or admin.
 * Shows what cancelling would cost BEFORE anything is cancelled.
 * Hotels: from the hotel's policies on LiteAPI's booking record.
 * Flights: LiteAPI's cancellation quote (an estimate — the airline decides).
 */
router.get("/:id/cancel-quote", authRequired, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
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
    const { data } = await flightCancelQuote(ids[0]);
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
    res.status(502).json({
      message:
        "We couldn't get cancellation terms right now. Please try again shortly.",
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
router.post("/:id/cancel", authRequired, async (req, res) => {
  try {
    const booking = await loadOwnedBooking(req, res);
    if (!booking) return;
    if (booking.status === "cancelled") {
      return res.json({ ok: true, alreadyCancelled: true, booking });
    }
    if (booking.status === "cancel_pending") {
      return res.status(202).json({
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
      return res.status(400).json({
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
    res.status(500).json({
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
 * DELETE /api/bookings/:id — ADMIN ONLY, removes Skyrio's RECORD only.
 * It does NOT cancel with the airline/hotel or refund anyone. Travelers
 * cancel through POST /api/bookings/:id/cancel instead.
 */
router.delete("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findOneAndDelete({ _id: req.params.id });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    res.json({
      message:
        "Booking record deleted. This did NOT cancel it with the supplier or refund anyone.",
    });
  } catch (err) {
    console.error("❌ Failed to delete booking record:", err);
    res.status(500).json({ message: "Error deleting booking record." });
  }
});

export default router;
