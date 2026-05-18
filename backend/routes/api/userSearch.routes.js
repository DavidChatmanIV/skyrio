import { Router } from "express";
import mongoose from "mongoose";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// GET /api/users/search?q=john&limit=10
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 25);

    // Debug: log what requireAuth gives us
    console.log("SEARCH HIT:", {
      q,
      reqUser: req.user,
      userId: req.user?._id || req.user?.id,
    });

    if (!q || q.length < 2) {
      return res.json({ ok: true, users: [] });
    }

    // Get the caller's ID — handle both string and ObjectId
    const rawId = req.user?._id || req.user?.id;
    const me = rawId
      ? mongoose.Types.ObjectId.isValid(rawId)
        ? new mongoose.Types.ObjectId(rawId)
        : rawId
      : null;

    // Escape regex special chars
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const query = {
      ...(me ? { _id: { $ne: me } } : {}),
      $or: [{ username: regex }, { name: regex }],
    };

    console.log("SEARCH QUERY:", JSON.stringify(query));

    const users = await User.find(query)
      .select("_id username name avatar bio city followersCount followingCount")
      .limit(limit)
      .lean();

    console.log("SEARCH RESULTS:", users.length, "found");

    // Check which ones the requester already follows
    let followingSet = new Set();
    if (me) {
      const caller = await User.findById(me).select("following").lean();
      followingSet = new Set((caller?.following || []).map((id) => String(id)));
    }

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

export default router;
