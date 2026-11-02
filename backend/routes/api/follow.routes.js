import { Router } from "express";
import mongoose from "mongoose";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { autoFlagForVerification } from "../verificationRoutes.js";

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
      // Added verifiedTier so PlaneBadge renders in search results
      .select(
        "_id username name avatar bio followersCount followingCount verifiedTier"
      )
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

// ─── Shared list loader for followers / following ───────────
// Reads the User.followers / User.following arrays (the same data the
// follow + unfollow routes write), so the list always matches the count.
// Each person comes back with:
//   isFollowing — the logged-in traveler follows them
//   followsYou  — they follow the logged-in traveler
//   isMe        — it's the logged-in traveler
const LIST_FIELDS = "username name avatar bio city homeBase verifiedTier";

async function sendFollowList(req, res, field) {
  try {
    const { userId } = req.params;
    const me = String(req.user?._id || req.user?.id || "");

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id" });
    }

    const [owner, caller] = await Promise.all([
      User.findById(userId)
        .select(`${field} followersCount followingCount`)
        .populate(field, LIST_FIELDS)
        .lean(),
      User.findById(me).select("following followers").lean(),
    ]);

    if (!owner) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // populate drops accounts that were deleted, so filter out any gaps
    const people = (owner[field] || []).filter((u) => u && u._id);

    const iFollow = new Set((caller?.following || []).map(String));
    const followMe = new Set((caller?.followers || []).map(String));

    const users = people
      .map((u) => {
        const id = String(u._id);
        return {
          ...u,
          isMe: id === me,
          isFollowing: iFollow.has(id),
          followsYou: followMe.has(id),
        };
      })
      .reverse(); // newest first ($addToSet appends to the end)

    // Self-heal: if the stored counter drifted from the real list
    // (e.g. a follower deleted their account), fix it quietly.
    const counterField =
      field === "followers" ? "followersCount" : "followingCount";
    if (owner[counterField] !== users.length) {
      User.updateOne(
        { _id: userId },
        { $set: { [counterField]: users.length } }
      ).catch(() => {});
    }

    return res.json({ ok: true, users, count: users.length });
  } catch (err) {
    console.error(`get ${field} error:`, err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}

// ─── GET /api/follow/travelers?page=1&limit=30 ──────────────
// The "Active Travelers → View all" page. Public on purpose, since SkyHub is
// open to preview; the page adds Follow state itself from /mine/list.
//
// "Active" = posted on SkyHub in the last ACTIVE_DAYS days, newest first.
// The SkyHub post model is looked up by name so a wrong guess can never
// crash the server. If none is found, it falls back to "recently active"
// accounts and says so (basis: "recent"), so the page never overclaims.
const ACTIVE_DAYS = 30;
const POST_MODEL_NAMES = ["SkyHubPost", "SkyhubPost", "SkyHubPosts", "Post"];
const AUTHOR_FIELDS = ["author", "authorId", "userId", "user", "createdBy"];
const TRAVELER_FIELDS = `${LIST_FIELDS} followersCount`;

function findPostModel() {
  for (const name of POST_MODEL_NAMES) {
    const M = mongoose.models[name];
    if (!M) continue;
    const authorField = AUTHOR_FIELDS.find((f) => {
      const p = M.schema.path(f);
      return p && /^ObjectI[dD]$/.test(p.instance);
    });
    if (authorField) return { M, authorField };
  }
  return null;
}

router.get("/travelers", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 60);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const found = findPostModel();

    if (found) {
      const { M, authorField } = found;
      const since = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);
      const match = {
        createdAt: { $gte: since },
        [authorField]: { $ne: null },
      };
      // Leave out removed posts when the schema tracks that.
      if (M.schema.path("isDeleted")) match.isDeleted = { $ne: true };
      if (M.schema.path("deletedAt")) match.deletedAt = null;
      if (M.schema.path("hidden")) match.hidden = { $ne: true };

      const [rows, countRows] = await Promise.all([
        M.aggregate([
          { $match: match },
          {
            $group: {
              _id: `$${authorField}`,
              lastPostAt: { $max: "$createdAt" },
              recentPosts: { $sum: 1 },
            },
          },
          { $sort: { lastPostAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        M.aggregate([
          { $match: match },
          { $group: { _id: `$${authorField}` } },
          { $count: "n" },
        ]),
      ]);

      const users = await User.find({ _id: { $in: rows.map((r) => r._id) } })
        .select(TRAVELER_FIELDS)
        .lean();
      const byId = new Map(users.map((u) => [String(u._id), u]));

      // Keep the "newest poster first" order; skip deleted accounts.
      const travelers = rows
        .map((r) => {
          const u = byId.get(String(r._id));
          return u
            ? { ...u, lastPostAt: r.lastPostAt, recentPosts: r.recentPosts }
            : null;
        })
        .filter(Boolean);

      const total = countRows[0]?.n || 0;
      return res.json({
        ok: true,
        basis: "posts",
        days: ACTIVE_DAYS,
        travelers,
        total,
        page,
        hasMore: skip + rows.length < total,
      });
    }

    // Fallback: no SkyHub post model found.
    const filter = { username: { $exists: true, $ne: "" } };
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(TRAVELER_FIELDS)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      basis: "recent",
      travelers: users,
      total,
      page,
      hasMore: skip + users.length < total,
    });
  } catch (err) {
    console.error("travelers list error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─── GET /api/follow/:userId/followers ───────────────────────
router.get("/:userId/followers", requireAuth, (req, res) =>
  sendFollowList(req, res, "followers")
);

// ─── GET /api/follow/:userId/following ───────────────────────
router.get("/:userId/following", requireAuth, (req, res) =>
  sendFollowList(req, res, "following")
);

// ─── DELETE /api/follow/followers/:followerId ────────────────
// Remove someone from YOUR followers (they stop following you).
router.delete("/followers/:followerId", requireAuth, async (req, res) => {
  try {
    const me = String(req.user?._id || req.user?.id);
    const follower = req.params.followerId;

    if (
      !mongoose.Types.ObjectId.isValid(me) ||
      !mongoose.Types.ObjectId.isValid(follower) ||
      me === follower
    ) {
      return res.status(400).json({ ok: false, error: "Invalid user id" });
    }

    const meUpdate = await User.updateOne(
      { _id: me, followers: follower },
      { $pull: { followers: follower }, $inc: { followersCount: -1 } }
    );
    const changed = meUpdate.modifiedCount === 1;

    if (changed) {
      await User.updateOne(
        { _id: follower, following: me },
        { $pull: { following: me }, $inc: { followingCount: -1 } }
      );
    }

    return res.json({ ok: true, removed: changed });
  } catch (err) {
    console.error("remove follower error:", err);
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

      // Auto-flag for verification review if they crossed a threshold
      await autoFlagForVerification(target);
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
