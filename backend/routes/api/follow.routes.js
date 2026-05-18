import { Router } from "express";
import mongoose from "mongoose";
import User from "../../models/user.js";

const router = Router();

function requireAuth(req, res, next) {
  const id = req.user?.id || req.user?._id || req.headers["x-user-id"];
  if (!id) return res.status(401).json({ ok: false, error: "Unauthorized" });
  req.authUserId = String(id);
  next();
}

// ─── GET /api/follow/search?q=john&limit=10 ─────────────────
// Search for users by username or name
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 25);
    const me = req.authUserId;

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

    // Check which ones the requester already follows
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

// ─── POST /api/follow/:targetUserId ─────────────────────────
router.post("/:targetUserId", requireAuth, async (req, res) => {
  try {
    const me = req.authUserId;
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
    const me = req.authUserId;
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

// ─── GET /api/follow/mine/list ───────────────────────────────
router.get("/mine/list", requireAuth, async (req, res) => {
  try {
    const me = req.authUserId;
    const u = await User.findById(me).select("following").lean();
    return res.json({ ok: true, following: u?.following || [] });
  } catch (err) {
    console.error("follow mine error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
