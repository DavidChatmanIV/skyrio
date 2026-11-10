import { Router } from "express";
import mongoose from "mongoose";

import User from "../../models/user.js";
import Follow from "../../models/follow.js";
import Notification from "../../models/notification.js";

import { getOrCreateOfficialUser } from "../../lib/official.js";
import { auth as authRequired } from "../../middleware/auth.js";

const router = Router();
router.use(authRequired);

/* -----------------------------
   Ensure Official Follow (auto-add)
----------------------------- */

async function ensureOfficialFollow(meId) {
  const official = await getOrCreateOfficialUser();
  const officialId = String(official._id);

  // If the logged-in user IS the official account, skip
  if (String(meId) === officialId) {
    return { ok: true, created: false, officialUserId: officialId };
  }

  // Upsert follow relationship (unique index prevents dup)
  const r = await Follow.updateOne(
    { followerId: meId, followingId: officialId },
    { $setOnInsert: { followerId: meId, followingId: officialId } },
    { upsert: true }
  );

  const created =
    r?.upsertedCount > 0 ||
    (Array.isArray(r?.upserted) && r.upserted.length > 0) ||
    !!r?.upsertedId;

  if (created) {
    await Promise.all([
      User.updateOne({ _id: meId }, { $inc: { followingCount: 1 } }),
      User.updateOne({ _id: officialId }, { $inc: { followersCount: 1 } }),

      // ✅ Welcome notification
      Notification.create({
        userId: meId,
        type: "system",
        event: "welcome",
        title: "Welcome to Skyrio",
        message:
          "Your Digital Passport is ready. Earn XP when you book, save trips, and explore.",
        targetType: "passport",
        targetId: String(meId),
        link: "/passport",
        isRead: false,
      }).catch(() => {}),
    ]);
  }

  return { ok: true, created, officialUserId: officialId };
}

/**
 * Auto-run on every request (safe + cheap):
 * Guarantees Official is followed after auth.
 */
router.use(async (req, _res, next) => {
  try {
    const meId = req.user?.id;
    if (meId && mongoose.isValidObjectId(meId)) {
      await ensureOfficialFollow(meId);
    }
  } catch {
    // Never block the request
  }
  next();
});

/* ======================================================
   POST /api/social/follow/:targetId
   ====================================================== */
router.post("/follow/:targetId", async (req, res) => {
  try {
    const meId = req.user.id;
    const { targetId } = req.params;

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, message: "Invalid targetId" });
    }
    if (String(meId) === String(targetId)) {
      return res
        .status(400)
        .json({ ok: false, message: "You cannot follow yourself" });
    }

    const target = await User.findById(targetId).select("_id isOfficial");
    if (!target)
      return res.status(404).json({ ok: false, message: "User not found" });

    const r = await Follow.updateOne(
      { followerId: meId, followingId: targetId },
      { $setOnInsert: { followerId: meId, followingId: targetId } },
      { upsert: true }
    );

    const created =
      r?.upsertedCount > 0 ||
      (Array.isArray(r?.upserted) && r.upserted.length > 0) ||
      !!r?.upsertedId;

    if (created) {
      await Promise.all([
        User.updateOne({ _id: meId }, { $inc: { followingCount: 1 } }),
        User.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }),

        Notification.create({
          userId: targetId,
          type: "social",
          event: "follow",
          title: "New follower",
          message: "Someone followed you on Skyrio.",
          targetType: "user",
          targetId: String(meId),
          link: `/profile/${meId}`,
          isRead: false,
        }).catch(() => {}),
      ]);
    }

    const [me, them] = await Promise.all([
      User.findById(meId).select("followingCount"),
      User.findById(targetId).select("followersCount"),
    ]);

    return res.json({
      ok: true,
      alreadyFollowing: !created,
      counts: {
        meFollowing: me?.followingCount ?? 0,
        targetFollowers: them?.followersCount ?? 0,
      },
    });
  } catch (err) {
    console.error("POST /api/social/follow failed:", err);
    return res.status(500).json({ ok: false, message: "Couldn't follow. Try again." });
  }
});

/* ======================================================
   DELETE /api/social/follow/:targetId
   Block unfollowing official
   ====================================================== */
router.delete("/follow/:targetId", async (req, res) => {
  try {
    const meId = req.user.id;
    const { targetId } = req.params;

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, message: "Invalid targetId" });
    }

    const target = await User.findById(targetId).select("_id isOfficial");
    if (!target)
      return res.status(404).json({ ok: false, message: "User not found" });

    if (target.isOfficial) {
      return res.status(403).json({
        ok: false,
        message:
          "You can't remove the official Skyrio account. You can mute updates instead.",
        canMuteInstead: true,
      });
    }

    const deleted = await Follow.deleteOne({
      followerId: meId,
      followingId: targetId,
    });

    if (deleted.deletedCount > 0) {
      await Promise.all([
        User.updateOne(
          { _id: meId, followingCount: { $gt: 0 } },
          { $inc: { followingCount: -1 } }
        ),
        User.updateOne(
          { _id: targetId, followersCount: { $gt: 0 } },
          { $inc: { followersCount: -1 } }
        ),
      ]);
    }

    const [me, them] = await Promise.all([
      User.findById(meId).select("followingCount"),
      User.findById(targetId).select("followersCount"),
    ]);

    return res.json({
      ok: true,
      wasFollowing: deleted.deletedCount > 0,
      counts: {
        meFollowing: me?.followingCount ?? 0,
        targetFollowers: them?.followersCount ?? 0,
      },
    });
  } catch (err) {
    console.error("DELETE /api/social/follow failed:", err);
    return res.status(500).json({ ok: false, message: "Couldn't unfollow. Try again." });
  }
});

/* ======================================================
   GET /api/social/passport/stats
   ====================================================== */
router.get("/passport/stats", async (req, res) => {
  try {
    const meId = req.user.id;

    const [me, official] = await Promise.all([
      User.findById(meId).select("followersCount followingCount preferences"),
      getOrCreateOfficialUser(),
    ]);

    if (!me)
      return res.status(404).json({ ok: false, message: "User not found" });

    return res.json({
      ok: true,
      followers: me.followersCount || 0,
      following: me.followingCount || 0,
      officialUpdatesMuted: !!me.preferences?.officialUpdatesMuted,
      officialUserId: String(official._id),
    });
  } catch (err) {
    console.error("GET /api/social/passport/stats failed:", err);
    return res.status(500).json({ ok: false, message: "Couldn't load stats. Try again." });
  }
});

/* ======================================================
   PATCH /api/social/official/mute
   Body: { muted: true|false }
   ====================================================== */
router.patch("/official/mute", async (req, res) => {
  try {
    const meId = req.user.id;
    const muted = !!req.body?.muted;

    await User.updateOne(
      { _id: meId },
      { $set: { "preferences.officialUpdatesMuted": muted } }
    );

    return res.json({ ok: true, officialUpdatesMuted: muted });
  } catch (err) {
    console.error("PATCH /api/social/official/mute failed:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Couldn't update preference. Try again." });
  }
});

/* ======================================================
   POST /api/social/ensure-official
   ====================================================== */
router.post("/ensure-official", async (req, res) => {
  try {
    const meId = req.user.id;
    const result = await ensureOfficialFollow(meId);
    return res.json(result);
  } catch (err) {
    console.error("POST /api/social/ensure-official failed:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Couldn't ensure official follow. Try again." });
  }
});

export default router;
