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
 * POST /api/bookings
 */
router.post("/", authRequired, async (req, res) => {
  try {
    const { hotel, flight, pkg, place, dates, travelers, addOns } = req.body;

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

    // ✅ FIX: `travelers` arrives from the frontend as an array of
    // passenger objects (firstName, lastName, email, dob, phone, ktn),
    // but the schema's `travelers` field is a Number (headcount) and the
    // actual people belong in `passengers` (array of passengerSchema).
    // Previously the raw array was being assigned directly to the
    // Number field, so passenger names/emails/DOB were never really
    // saved. This splits it correctly.
    const travelersArray = Array.isArray(travelers) ? travelers : [];
    const passengers = travelersArray.map((t) => ({
      name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim(),
      type: "adult",
      dob: t.dob || undefined,
      phone: t.phone || undefined,
      knownTravelerNumber: t.knownTravelerNumber || undefined,
    }));
    const travelerCount = travelersArray.length || 1;

    // Primary contact info on the booking itself, pulled from the first
    // passenger so existing code that reads booking.name/booking.email
    // (e.g. confirmation emails, admin views) keeps working.
    const primaryTraveler = travelersArray[0] || {};

    // ✅ NEW: addOns (seat tier, bag option, insurance) were being
    // selected and priced on the frontend but never sent to this route
    // at all — nothing was saved. Now captured with safe defaults so a
    // missing/malformed addOns object doesn't crash booking creation.
    const safeAddOns = {
      seatTier: addOns?.seatTier || "none",
      seatPrice: Number(addOns?.seatPrice) || 0,
      bagOption: addOns?.bagOption || "none",
      bagPrice: Number(addOns?.bagPrice) || 0,
      insurance: Boolean(addOns?.insurance),
      insurancePrice: Number(addOns?.insurancePrice) || 0,
    };

    const newBooking = new Booking({
      user: req.user.id,
      name: [primaryTraveler.firstName, primaryTraveler.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
      email: primaryTraveler.email,
      tripDetails,
      type,
      hotel,
      flight,
      package: pkg,
      place,
      dates,
      travelers: travelerCount,
      passengers,
      addOns: safeAddOns,
    });

    await newBooking.save();

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
