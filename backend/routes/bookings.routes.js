import { Router } from "express";
import Booking from "../models/booking.js";
import authRequired from "../middleware/authRequired.js";

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
        .populate("flight")
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
    const { hotel, flight, pkg, place, dates, travelers } = req.body;

    const newBooking = new Booking({
      user: req.user.id,
      hotel,
      flight,
      package: pkg, // frontend sends `pkg`
      place,
      dates,
      travelers,
    });

    await newBooking.save();

    await newBooking.populate("user", "email");
    await newBooking.populate("hotel");
    await newBooking.populate("flight");
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
