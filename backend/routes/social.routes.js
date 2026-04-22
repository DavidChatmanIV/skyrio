import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/user.js";
import Follow from "../models/Follow.js";
import Notification from "../models/Notification.js";
import { getOrCreateOfficialUser } from "../lib/official.js";

const router = Router();

// NOTE: Replace this with your real auth middleware.
// It must set req.user = { id: "..." }
function requireAuth(req, _res, next) {
  if (!req.user?.id)
    return next(Object.assign(new Error("Unauthorized"), { status: 401 }));
  next();
}

router.use(requireAuth);

// Follow a user
router.post("/follow/:targetId", async (req, res, next) => {
  try {
    const followerId = req.user.id;
    const { targetId } = req.params;

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid targetId" });
    }
    if (String(followerId) === String(targetId)) {
      return res
        .status(400)
        .json({ ok: false, error: "You cannot follow yourself" });
    }

    const target = await User.findById(targetId).select("_id isOfficial");
    if (!target)
      return res.status(404).json({ ok: false, error: "User not found" });

    // Create follow (unique index prevents duplicates)
    const created = await Follow.create({ followerId, followingId: targetId })
      .then(() => true)
      .catch((e) => {
        if (e?.code === 11000) return false; // already following
        throw e;
      });

    if (created) {
      await Promise.all([
        User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
        User.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }),
      ]);

      // Optional: notify target (skip for official)
      if (!target.isOfficial) {
        await Notification.create({
          userId: targetId,
          type: "FOLLOW",
          title: "New follower",
          message: "Someone just followed you on Skyrio.",
          data: { followerId },
        });
      }
    }

    const me = await User.findById(followerId).select("followingCount");
    const them = await User.findById(targetId).select("followersCount");

    return res.json({
      ok: true,
      followed: true,
      alreadyFollowing: !created,
      counts: {
        meFollowing: me?.followingCount ?? 0,
        targetFollowers: them?.followersCount ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Unfollow a user (blocked for official)
router.delete("/follow/:targetId", async (req, res, next) => {
  try {
    const followerId = req.user.id;
    const { targetId } = req.params;

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid targetId" });
    }

    const target = await User.findById(targetId).select("_id isOfficial");
    if (!target)
      return res.status(404).json({ ok: false, error: "User not found" });

    // Prevent unfollowing official account (your rule)
    if (target.isOfficial) {
      return res.status(403).json({
        ok: false,
        error:
          "You can’t remove the official Skyrio account. You can mute updates instead.",
        canMuteInstead: true,
      });
    }

    const deleted = await Follow.deleteOne({
      followerId,
      followingId: targetId,
    });

    if (deleted.deletedCount > 0) {
      await Promise.all([
        User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }),
        User.updateOne({ _id: targetId }, { $inc: { followersCount: -1 } }),
      ]);
    }

    const me = await User.findById(followerId).select("followingCount");
    const them = await User.findById(targetId).select("followersCount");

    return res.json({
      ok: true,
      unfollowed: true,
      wasFollowing: deleted.deletedCount > 0,
      counts: {
        meFollowing: me?.followingCount ?? 0,
        targetFollowers: them?.followersCount ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Passport stats (minimal, fast)
router.get("/passport/stats", async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "followersCount followingCount preferences"
    );
    if (!user)
      return res.status(404).json({ ok: false, error: "User not found" });

    // Ensure official exists; also helps frontend show "following includes official"
    const official = await getOrCreateOfficialUser();

    return res.json({
      ok: true,
      stats: {
        followers: user.followersCount || 0,
        following: user.followingCount || 0,
        officialUpdatesMuted: !!user.preferences?.officialUpdatesMuted,
        officialUserId: String(official._id),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Mute/unmute official updates (preference)
router.patch("/official/mute", async (req, res, next) => {
  try {
    const { muted } = req.body || {};
    const m = !!muted;

    await User.updateOne(
      { _id: req.user.id },
      { $set: { "preferences.officialUpdatesMuted": m } }
    );

    return res.json({ ok: true, officialUpdatesMuted: m });
  } catch (err) {
    next(err);
  }
});

export default router;
