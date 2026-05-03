import { Router } from "express";
import SavedTrip from "../../models/savedTrip.js";
import Notification from "../../models/notification.js";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

/**
 * GET /api/saved-trips
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const savedTrips = await SavedTrip.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json({
      ok: true,
      savedTrips,
    });
  } catch (err) {
    console.error("Saved trips fetch error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch saved trips",
    });
  }
});

/**
 * POST /api/saved-trips
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      tripType = "custom",
      title,
      destination = "",
      image = "",
      price = 0,
      currency = "USD",
      startDate = "",
      endDate = "",
      metadata = {},
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        ok: false,
        message: "Trip title is required",
      });
    }

    const savedTrip = await SavedTrip.create({
      user: req.user._id,
      tripType,
      title: String(title).trim(),
      destination: String(destination).trim(),
      image,
      price,
      currency,
      startDate,
      endDate,
      metadata,
    });

    await Notification.create({
      user: req.user._id,
      type: "saved_trip",
      title: "Trip Saved",
      message: `${savedTrip.title} was added to your saved trips`,
      link: "/saved-trips",
    });

    // ── Award save-trip XP ──
    try {
      await User.findByIdAndUpdate(req.user._id, { $inc: { xp: 50 } });
    } catch (xpErr) {
      console.error("Save-trip XP award failed:", xpErr);
    }

    return res.status(201).json({
      ok: true,
      message: "Trip saved successfully",
      savedTrip,
    });
  } catch (err) {
    console.error("Saved trips create error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to save trip",
    });
  }
});

/**
 * DELETE /api/saved-trips/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await SavedTrip.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message: "Saved trip not found",
      });
    }

    return res.json({
      ok: true,
      message: "Saved trip removed successfully",
    });
  } catch (err) {
    console.error("Saved trips delete error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to delete saved trip",
    });
  }
});

export default router;
