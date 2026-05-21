import { Router } from "express";
import mongoose from "mongoose";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// ─── GET /api/follow/search?q=john&limit=10 ─────────────────
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 25);
    const me = req.user?._id || req.user?.id;

    if (!q || q.length < 2) {
      return res.json({ ok: true, users: [] });
    }

    const meId = mongoose.Types.ObjectId.isValid(me)
      ? new mongoose.Types.ObjectId(me)
      : me;

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const users = await User.find({
      _id: { $ne: meId },
      $or: [{ username: regex }, { name: regex }],
    })
      .select("_id username name avatar bio followersCount followingCount")
      .limit(limit)
      .lean();

    const caller = await User.findById(meId).select("following").lean();
    const followingSet = new Set(
      (caller?.following || []).map((id) => String(id))
    );

    const results = users.map((u) => ({
      ...u,
      isFollowing: followingSet.has(String(u._id)),
    }));

    return res.json({ ok: true, users: results });
  } catch (err) {
    console.error("User search error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─── GET /api/follow/mine/list ───────────────────────────────
router.get("/mine/list", requireAuth, async (req, res) => {
  try {
    const me = req.user?._id || req.user?.id;
    const u = await User.findById(me).select("following").lean();
    return res.json({ ok: true, following: u?.following || [] });
  } catch (err) {
    console.error("follow mine error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─── GET /api/follow/:userId/followers ───────────────────────
// Public — returns users who follow this person
router.get("/:userId/followers", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id" });
    }

    const user = await User.findById(userId)
      .select("followers")
      .populate("followers", "username name avatar bio city")
      .lean();

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, users: user.followers || [] });
  } catch (err) {
    console.error("get followers error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─── GET /api/follow/:userId/following ───────────────────────
// Public — returns users this person follows
router.get("/:userId/following", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id" });
    }

    const user = await User.findById(userId)
      .select("following")
      .populate("following", "username name avatar bio city")
      .lean();

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, users: user.following || [] });
  } catch (err) {
    console.error("get following error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─── POST /api/follow/:targetUserId ─────────────────────────
router.post("/:targetUserId", requireAuth, async (req, res) => {
  try {
    const me = String(req.user?._id || req.user?.id);
    const target = req.params.targetUserId;

    if (
      !mongoose.Types.ObjectId.isValid(me) ||
      !mongoose.Types.ObjectId.isValid(target)
    ) {
      return res.status(400).json({ ok: false, error: "Invalid user id" });
    }
    if (me === target) {
      return res
        .status(400)
        .json({ ok: false, error: "You cannot follow yourself" });
    }

    const meUpdate = await User.updateOne(
      { _id: me, following: { $ne: target } },
      { $addToSet: { following: target }, $inc: { followingCount: 1 } }
    );

    const changed = meUpdate.modifiedCount === 1;

    if (changed) {
      await User.updateOne(
        { _id: target, followers: { $ne: me } },
        { $addToSet: { followers: me }, $inc: { followersCount: 1 } }
      );
    }

    return res.json({ ok: true, followed: changed });
  } catch (err) {
    console.error("follow error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─── DELETE /api/follow/:targetUserId ────────────────────────
router.delete("/:targetUserId", requireAuth, async (req, res) => {
  try {
    const me = String(req.user?._id || req.user?.id);
    const target = req.params.targetUserId;

    if (
      !mongoose.Types.ObjectId.isValid(me) ||
      !mongoose.Types.ObjectId.isValid(target)
    ) {
      return res.status(400).json({ ok: false, error: "Invalid user id" });
    }
    if (me === target) {
      return res.status(400).json({ ok: false, error: "Invalid operation" });
    }

    const meUpdate = await User.updateOne(
      { _id: me, following: target },
      { $pull: { following: target }, $inc: { followingCount: -1 } }
    );

    const changed = meUpdate.modifiedCount === 1;

    if (changed) {
      await User.updateOne(
        { _id: target, followers: me },
        { $pull: { followers: me }, $inc: { followersCount: -1 } }
      );
    }

    return res.json({ ok: true, unfollowed: changed });
  } catch (err) {
    console.error("unfollow error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
