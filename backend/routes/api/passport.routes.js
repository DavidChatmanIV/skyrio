import { Router } from "express";
import Passport from "../../models/Passport.js";
import User from "../../models/user.js";
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
      passport = await Passport.create({ user: req.user._id });
    }
    return res.json({ ok: true, passport });
  } catch (err) {
    console.error("Passport fetch error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch passport" });
  }
});

// GET /api/passport/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    let passport = await Passport.findOne({ user: req.user._id });
    if (!passport) {
      passport = await Passport.create({ user: req.user._id });
    }

    const user = await User.findById(req.user._id)
      .select("followers following followersCount followingCount")
      .lean();

    const followers = user?.followers?.length ?? user?.followersCount ?? 0;
    const following = user?.following?.length ?? user?.followingCount ?? 0;

    return res.json({
      ok: true,
      stats: {
        ...(passport.stats?.toObject?.() ?? passport.stats ?? {}),
        followers,
        following,
      },
      xp: passport.xp,
      level: passport.level,
    });
  } catch (err) {
    console.error("Passport stats error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch passport stats" });
  }
});

// GET /api/passport/followers?limit=25
router.get("/followers", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    const me = await User.findById(req.user._id)
      .select("followers following")
      .lean();

    if (!me?.followers?.length) {
      return res.json({ ok: true, items: [] });
    }

    const followerIds = me.followers.slice(0, limit);
    const users = await User.find({ _id: { $in: followerIds } })
      .select("_id username name avatar isOfficial")
      .lean();

    // Check which followers I follow back
    const myFollowingSet = new Set(
      (me.following || []).map((id) => String(id))
    );

    const items = users.map((u) => ({
      id: String(u._id),
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      avatarUrl: u.avatar,
      isOfficial: u.isOfficial || false,
      isFollowing: myFollowingSet.has(String(u._id)),
    }));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("Passport followers error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch followers" });
  }
});

// GET /api/passport/following?limit=25
router.get("/following", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    const me = await User.findById(req.user._id).select("following").lean();

    if (!me?.following?.length) {
      return res.json({ ok: true, items: [] });
    }

    const followingIds = me.following.slice(0, limit);
    const users = await User.find({ _id: { $in: followingIds } })
      .select("_id username name avatar isOfficial")
      .lean();

    const items = users.map((u) => ({
      id: String(u._id),
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      avatarUrl: u.avatar,
      isOfficial: u.isOfficial || false,
      isFollowing: true, // you follow all of these by definition
    }));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("Passport following error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch following" });
  }
});

// POST /api/passport/activity
router.post("/activity", requireAuth, async (req, res) => {
  try {
    const { type, metadata = {} } = req.body;
    if (!type) {
      return res
        .status(400)
        .json({ ok: false, message: "Activity type is required" });
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
    return res
      .status(500)
      .json({ ok: false, message: "Failed to track passport activity" });
  }
});

export default router;
