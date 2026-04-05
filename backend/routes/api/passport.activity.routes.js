import express from "express";
import mongoose from "mongoose";
import Passport from "../../models/Passport.js";
import Profile from "../../models/Profile.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = express.Router();

/* =========================
   XP RULES
========================= */
const ACTIVITY_RULES = {
  account_created: {
    xp: 50,
    statKey: null,
    label: "Account created",
  },
  profile_completed: {
    xp: 75,
    statKey: "profileCompletions",
    label: "Profile completed",
  },
  trip_planned: {
    xp: 40,
    statKey: "tripsPlanned",
    label: "Trip planned",
  },
  booking_completed: {
    xp: 120,
    statKey: "bookingsCompleted",
    label: "Booking completed",
  },
  saved_trip: {
    xp: 20,
    statKey: "savedTrips",
    label: "Trip saved",
  },
  passport_viewed: {
    xp: 5,
    statKey: "passportViews",
    label: "Passport viewed",
  },
  post_created: {
    xp: 15,
    statKey: "postsCreated",
    label: "Post created",
  },
  daily_login: {
    xp: 10,
    statKey: "logins",
    label: "Daily login",
  },
};

/* =========================
   HELPERS
========================= */
function getLevelFromXp(xp = 0) {
  if (xp >= 5000) return 10;
  if (xp >= 3500) return 9;
  if (xp >= 2500) return 8;
  if (xp >= 1800) return 7;
  if (xp >= 1200) return 6;
  if (xp >= 800) return 5;
  if (xp >= 500) return 4;
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
}

function getNextBadge(xp = 0) {
  if (xp >= 5000) return "Legend Explorer";
  if (xp >= 3500) return "Global Navigator";
  if (xp >= 2500) return "Elite Traveler";
  if (xp >= 1800) return "Sky Adventurer";
  if (xp >= 1200) return "Passport Pro";
  if (xp >= 800) return "Frequent Flyer";
  if (xp >= 500) return "Rising Explorer";
  if (xp >= 250) return "Travel Rookie";
  if (xp >= 100) return "First Stamp";
  return "New Traveler";
}

function buildActivityEntry(type, xpEarned, metadata = {}) {
  return {
    type,
    xpEarned,
    metadata,
    createdAt: new Date(),
  };
}

/* =========================
   POST /api/passport/activity
========================= */
router.post("/activity", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { type, metadata = {} } = req.body || {};

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized user",
      });
    }

    if (!type || !ACTIVITY_RULES[type]) {
      return res.status(400).json({
        ok: false,
        message: "Invalid activity type",
        allowedTypes: Object.keys(ACTIVITY_RULES),
      });
    }

    const rule = ACTIVITY_RULES[type];

    // Upsert passport if it doesn't exist yet
    let passport = await Passport.findOne({ userId });

    if (!passport) {
      passport = await Passport.create({
        userId,
        xp: 0,
        level: 1,
        badge: "New Traveler",
        stats: {
          tripsPlanned: 0,
          bookingsCompleted: 0,
          savedTrips: 0,
          passportViews: 0,
          postsCreated: 0,
          logins: 0,
          profileCompletions: 0,
        },
        recentActivity: [],
      });
    }

    // Optional protection against spam XP
    // Example: prevent passport_viewed from awarding too often
    if (type === "passport_viewed") {
      const lastSameActivity = passport.recentActivity
        ?.slice()
        ?.reverse()
        ?.find((item) => item.type === "passport_viewed");

      if (lastSameActivity) {
        const diffMs =
          Date.now() - new Date(lastSameActivity.createdAt).getTime();
        const oneHour = 1000 * 60 * 60;

        if (diffMs < oneHour) {
          return res.status(200).json({
            ok: true,
            message: "Passport view already counted recently",
            passport,
          });
        }
      }
    }

    passport.xp += rule.xp;

    if (!passport.stats) {
      passport.stats = {};
    }

    if (rule.statKey) {
      passport.stats[rule.statKey] = (passport.stats[rule.statKey] || 0) + 1;
    }

    passport.level = getLevelFromXp(passport.xp);
    passport.badge = getNextBadge(passport.xp);

    passport.recentActivity.unshift(
      buildActivityEntry(type, rule.xp, metadata)
    );

    // keep recent activity clean
    passport.recentActivity = passport.recentActivity.slice(0, 20);

    passport.lastUpdatedAt = new Date();

    await passport.save();

    // Optional: sync profile XP summary too
    await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          xp: passport.xp,
          level: passport.level,
          badge: passport.badge,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      ok: true,
      message: `${rule.label} applied`,
      earned: {
        type,
        xp: rule.xp,
      },
      passport,
    });
  } catch (error) {
    console.error("POST /api/passport/activity error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to update passport activity",
      error: error.message,
    });
  }
});

export default router;