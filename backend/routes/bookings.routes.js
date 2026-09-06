import { Router } from "express";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import authRequired from "../middleware/authRequired.js";
import { sendBookingConfirmationEmail } from "../utils/sendConfirmationEmail.js";

const router = Router();

/**
 * GET /api/bookings
 * Supports:
 *  - ?page=1&limit=20
 *  - ?sortBy=createdAt&sortDir=desc|asc
 *  - Admin: all bookings
 *  - Normal user: only their bookings
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
    const baseFilter = isAdmin ? {} : { user: req.user.id };

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
      // This route never actually reached this code while the POST below
      // was crashing on every call (no bookings ever existed to fetch) —
      // but the moment that's fixed, this would have started throwing on
      // the very next GET. Flight data is already embedded inline on the
      // document, so it needs no populate at all.
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
 * NEW — called by BookingCheckout.jsx right after LiteAPI's /prebook
 * succeeds. Creates a lightweight "pending" Booking so we have a real
 * bookingId to hand to /api/stripe/create-payment-intent (that endpoint,
 * and the webhook logic in stripe.routes.js, are both built around
 * bookingId — they need a Booking document to exist before payment).
 *
 * /api/flights/complete finalizes this same document (matched by
 * prebookId) into status "confirmed" once payment succeeds — it should
 * NOT create a second, separate Booking document. If /api/flights/complete
 * currently does `new Booking(...)`, that needs to change to find this
 * pending one by prebookId and update it instead.
 *
 * SECURITY NOTE: `total` is currently trusted from the client, same
 * shape-of-problem the comment on /api/stripe/create-payment-intent
 * already warns about. Once you confirm what LiteAPI's prebook response
 * includes for price, re-derive `total` from that here instead of
 * trusting req.body.total directly — otherwise a user could tamper with
 * the amount before this pending booking (and therefore the PaymentIntent
 * amount) is created.
 *
 * SCHEMA NOTE: this assumes `prebookId`, `offerId`, and `status` exist on
 * the Booking model. `type` and `tripDetails` are already required fields
 * per the POST / route above, so they're populated here the same way.
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

    // Idempotency — if the user refreshes mid-checkout and this effect
    // re-fires, reuse the existing pending booking instead of creating a
    // duplicate (and a duplicate PaymentIntent downstream).
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
      // `travelers` on this schema is a headcount (Number), matching how
      // the existing POST / route above uses it — NOT an array of
      // passenger objects. Passenger names/types aren't needed on the
      // Booking document itself for payment purposes; LiteAPI already
      // has the full passenger data from /prebook, and /api/flights/complete
      // can pull it from there if it needs to display names later.
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

    // ✅ FIX: tripDetails and type are both `required: true` on the Booking
    // schema with no defaults. Neither was ever sent here, so
    // newBooking.save() below threw a validation error on every single
    // call — meaning Stripe could successfully charge a real card while
    // zero Booking document was ever created. This derives both from
    // whatever booking data is actually present.
    const type = flight
      ? "Flight"
      : hotel
      ? "Hotel"
      : pkg
      ? "Package"
      : req.body.type;
    // Note: there's no schema enum value yet for `place` (excursion /
    // activity) bookings — if that's a real booking path, the enum on
    // models/booking.js needs a "Place" or "Excursion" option added. Not
    // touching that blind since I don't know how `place` bookings are
    // used elsewhere (e.g. admin dashboards, Atlas AI logic).

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

    // ❌ REMOVED: this used to award +200 XP here, at creation time — i.e.
    // before any payment had happened. stripe.routes.js's webhook already
    // awards +200 XP on payment_intent.succeeded, the only point that's
    // actually verified a real payment went through. Keeping both would
    // double-award XP on every real booking the instant this route stopped
    // crashing; awarding it here alone (pre-payment) would also let anyone
    // farm free XP just by reaching the review screen without ever paying.

    // ── Send booking confirmation email ──
    try {
      const userDoc = await User.findById(req.user.id).lean();
      if (userDoc?.email) {
        await sendBookingConfirmationEmail({
          name: userDoc.name || userDoc.username || "Traveler",
          email: userDoc.email,
          origin: flight?.origin || "",
          destination: flight?.destination || "",
          departDate: dates?.start || "",
          returnDate: dates?.end || "",
          airline: flight?.airline || "",
          total: 0,
          bookingId: newBooking._id,
        });
      }
    } catch (emailErr) {
      console.error("Confirmation email error:", emailErr);
    }

    await newBooking.populate("user", "email");
    await newBooking.populate("hotel");
    await newBooking.populate("package");
    await newBooking.populate("place");
    // ✅ Removed .populate("flight") here too — see note on GET / above.

    res.status(201).json(newBooking);
  } catch (err) {
    console.error("❌ Failed to create booking:", err);
    res.status(500).json({ message: "Error creating booking." });
  }
});

/**
 * DELETE /api/bookings/:id
 */
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === "admin" || req.user?.isAdmin === true;
    const filter = isAdmin ? { _id: id } : { _id: id, user: req.user.id };

    const booking = await Booking.findOneAndDelete(filter);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    res.json({ message: "Booking canceled successfully." });
  } catch (err) {
    console.error("❌ Failed to cancel booking:", err);
    res.status(500).json({ message: "Error canceling booking." });
  }
});

export default router;
