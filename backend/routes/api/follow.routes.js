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

// POST /api/follow/:targetUserId  -> follow
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

    // Only update counts if the relationship was newly added.
    // Step 1: try to add target to my "following"
    const meUpdate = await User.updateOne(
      { _id: me, following: { $ne: target } },
      { $addToSet: { following: target }, $inc: { followingCount: 1 } }
    );

    // If nothing modified, I already follow them
    const changed = meUpdate.modifiedCount === 1;

    // Step 2: if changed, add me to target "followers" and increment their count
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

// DELETE /api/follow/:targetUserId -> unfollow
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

// GET /api/follow/mine -> returns who I follow (IDs)
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
