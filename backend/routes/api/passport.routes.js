import { Router } from "express";
import Passport from "../../models/Passport.js";
import Notification from "../../models/notification.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

function calculateLevel(xp) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

function getXpForActivity(type) {
  const map = {
    trip_saved: 15,
    trip_planned: 20,
    booking_made: 50,
    profile_completed: 25,
    daily_login: 5,
  };

  return map[type] || 10;
}

// GET /api/passport
router.get("/", requireAuth, async (req, res) => {
  try {
    let passport = await Passport.findOne({ user: req.user._id });

    if (!passport) {
      passport = await Passport.create({
        user: req.user._id,
      });
    }

    return res.json({
      ok: true,
      passport,
    });
  } catch (err) {
    console.error("Passport fetch error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch passport",
    });
  }
});

// POST /api/passport/activity
router.post("/activity", requireAuth, async (req, res) => {
  try {
    const { type, metadata = {} } = req.body;

    if (!type) {
      return res.status(400).json({
        ok: false,
        message: "Activity type is required",
      });
    }

    let passport = await Passport.findOne({ user: req.user._id });
    if (!passport) {
      passport = await Passport.create({ user: req.user._id });
    }

    const xpEarned = getXpForActivity(type);
    passport.xp += xpEarned;
    passport.level = calculateLevel(passport.xp);

    if (type === "trip_saved") passport.stats.tripsSaved += 1;
    if (type === "trip_planned") passport.stats.tripsPlanned += 1;
    if (type === "booking_made") passport.stats.bookingsMade += 1;

    passport.journeyHistory.unshift({
      type,
      metadata,
      xpEarned,
      createdAt: new Date(),
    });

    if (passport.journeyHistory.length > 50) {
      passport.journeyHistory = passport.journeyHistory.slice(0, 50);
    }

    await passport.save();

    await Notification.create({
      user: req.user._id,
      type: "xp",
      title: "XP Earned",
      message: `You earned ${xpEarned} XP for ${type.replace(/_/g, " ")}`,
      link: "/passport",
    });

    return res.json({
      ok: true,
      message: "Passport activity tracked",
      passport,
      xpEarned,
    });
  } catch (err) {
    console.error("Passport activity error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to track passport activity",
    });
  }
});

export default router;