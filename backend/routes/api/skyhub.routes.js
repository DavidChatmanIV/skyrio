import { Router } from "express";
import mongoose from "mongoose";
import SkyHubPost from "../../models/SkyHubPost.js";
import SkyHubComment from "../../models/SkyHubComment.js";
import SkyHubReport from "../../models/SkyHubReport.js";
import SkyHubBlock from "../../models/SkyHubBlock.js";
import SkyHubRestriction from "../../models/SkyHubRestriction.js";
import User from "../../models/user.js";
import { getLevel } from "../../lib/xpLevels.js";
import { readAdminSession } from "../admin.routes.js";
import {
  readViewer,
  requireViewer,
  requireNotSuspended,
  rateLimit,
  cleanText,
  checkSpam,
  isRepeatPost,
  safeImageUrls,
  cleanTags,
  hiddenAuthorIds,
  isBlockedBetween,
  AUTO_HIDE_REPORTS,
} from "../../services/skyhubSafety.js";

const router = Router();

// Every request: work out who's calling from their login (if any).
router.use(readViewer);

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const POST_TYPES = ["Tip", "Travel Tip", "Question", "Story", "Photo", "Photo Drop", "Join Trip"];
const REPORT_REASONS = ["spam", "harassment", "hate", "nudity", "scam", "violence", "misinformation", "other"];

// ── Helpers ───────────────────────────────────────────────────
function getTimeAgo(date) {
  const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function mapPost(post, viewerId, xpByAuthorId = new Map()) {
  const likeIds = (post.likes || []).map(String);
  const saveIds = (post.saves || []).map(String);
  const authorId = post.author?.toString() || null;
  const authorXp = authorId ? xpByAuthorId.get(authorId) ?? 0 : 0;
  return {
    _id: post._id,
    authorId,
    isMine: Boolean(viewerId && authorId && authorId === viewerId),
    authorName: post.authorName,
    username: post.username,
    avatar: post.avatar,
    verified: post.verified,
    authorBadge: getLevel(authorXp).current,
    type: post.type,
    destination: post.destination,
    text: post.text,
    image: post.image || "",
    images: Array.isArray(post.images) ? post.images : [],
    tags: post.tags || [],
    budget: post.budget,
    helpful: post.helpful,
    likesCount: likeIds.length,
    savesCount: saveIds.length,
    commentsCount: post.commentsCount || 0,
    sharesCount: post.sharesCount || 0,
    viewerHasLiked: Boolean(viewerId && likeIds.includes(viewerId)),
    viewerHasSaved: Boolean(viewerId && saveIds.includes(viewerId)),
    // Only the author ever receives a hidden post (see /feed).
    underReview: Boolean(post.hidden && post.hiddenReason === "review"),
    timeAgo: getTimeAgo(post.createdAt),
  };
}

function mapComment(comment, viewerId) {
  const authorId = comment.author?.toString() || null;
  return {
    _id: comment._id,
    authorId,
    isMine: Boolean(viewerId && authorId && authorId === viewerId),
    author: comment.authorName,
    username: comment.username,
    avatar: comment.avatar,
    text: comment.text,
    timeAgo: getTimeAgo(comment.createdAt),
  };
}

async function xpMapFor(posts) {
  const ids = [...new Set(posts.map((p) => p.author?.toString()).filter(Boolean))];
  if (!ids.length) return new Map();
  const authors = await User.find({ _id: { $in: ids } }).select("xp").lean();
  return new Map(authors.map((a) => [a._id.toString(), a.xp || 0]));
}

async function visibleComments(postId, viewerId) {
  const hide = await hiddenAuthorIds(viewerId);
  const comments = await SkyHubComment.find({
    post: postId,
    hidden: { $ne: true },
    ...(hide.length ? { author: { $nin: hide } } : {}),
  })
    .sort({ createdAt: 1 })
    .limit(300)
    .lean();
  return comments.map((c) => mapComment(c, viewerId));
}

function isAdmin(req) {
  return Boolean(readAdminSession(req) || req.skyUser?.isAdmin);
}
function adminOnly(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ message: "Admin access required." });
  next();
}
function adminName(req) {
  return readAdminSession(req)?.email || req.skyUser?.username || "admin";
}

/* ─────────────────────────────────────────────────────────────
   GET /api/skyhub/feed
   Public. Leaves out hidden posts and anyone blocked either way.
   Your own posts that are under review still show (to you only).
───────────────────────────────────────────────────────────── */
router.get("/feed", async (req, res) => {
  try {
    const viewerId = req.skyUser?.id || null;
    const hide = await hiddenAuthorIds(viewerId);
    const visible = viewerId
      ? { $or: [{ hidden: { $ne: true } }, { author: viewerId, hiddenReason: "review" }] }
      : { hidden: { $ne: true } };
    const posts = await SkyHubPost.find({
      ...visible,
      ...(hide.length ? { author: { $nin: hide } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const xp = await xpMapFor(posts);
    return res.json({ posts: posts.map((p) => mapPost(p, viewerId, xp)) });
  } catch (err) {
    console.error("[skyhub] feed error:", err);
    return res.status(500).json({ message: "Failed to load feed." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/skyhub/posts   (logged in, not suspended, rate-limited)
───────────────────────────────────────────────────────────── */
router.post("/posts", requireViewer, requireNotSuspended, rateLimit("post"), async (req, res) => {
  try {
    const me = req.skyUser;
    const text = cleanText(req.body?.text, 1200);
    const images = safeImageUrls(req.body?.images?.length ? req.body.images : [req.body?.image].filter(Boolean));
    if (!text && !images.length) return res.status(400).json({ message: "Write something or add a photo." });
    if (!text) return res.status(400).json({ message: "Add a caption to your photo." });

    const spam = checkSpam(text);
    if (spam) return res.status(400).json({ message: spam });
    if (await isRepeatPost(me.id, text)) {
      return res.status(409).json({ message: "You already posted this today." });
    }

    const type = POST_TYPES.includes(req.body?.type) ? req.body.type : "Story";
    const destination = cleanText(req.body?.destination, 120);
    const tags = cleanTags(req.body?.tags);

    const newPost = await SkyHubPost.create({
      author: me.id,
      authorName: me.name,
      username: me.username,
      avatar: me.avatar,
      verified: me.verified,
      type,
      destination,
      text,
      image: images[0] || "",
      images,
      helpful: type === "Tip" || type === "Travel Tip",
      tags: tags.length ? tags : destination ? ["Travel"] : [],
    });

    const xp = await xpMapFor([newPost]);
    return res.status(201).json({
      message: "Post created.",
      post: mapPost(newPost.toObject(), me.id, xp),
    });
  } catch (err) {
    console.error("[skyhub] create post error:", err);
    return res.status(500).json({ message: "Failed to create post." });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/skyhub/posts/:id   (the author, or an admin)
───────────────────────────────────────────────────────────── */
router.delete("/posts/:id", requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "Invalid post id." });
    const post = await SkyHubPost.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const mine = post.author && String(post.author) === req.skyUser.id;
    if (!mine && !isAdmin(req)) {
      return res.status(403).json({ message: "You can only delete your own posts." });
    }
    await Promise.all([SkyHubPost.deleteOne({ _id: id }), SkyHubComment.deleteMany({ post: id })]);
    return res.json({ success: true, message: "Post deleted." });
  } catch (err) {
    console.error("[skyhub] delete post error:", err);
    return res.status(500).json({ message: "Failed to delete post." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/skyhub/posts/:id/like  and  /save   (logged in)
───────────────────────────────────────────────────────────── */
async function toggle(req, res, field) {
  const { id } = req.params;
  if (!validId(id)) {
    res.status(400).json({ message: "Invalid post id." });
    return null;
  }
  const me = req.skyUser.id;
  const post = await SkyHubPost.findOne({ _id: id, hidden: { $ne: true } }).select(`${field} author`);
  if (!post || (await isBlockedBetween(me, post.author))) {
    res.status(404).json({ message: "Post not found." });
    return null;
  }
  const has = post[field].map(String).includes(me);
  const updated = await SkyHubPost.findByIdAndUpdate(
    id,
    has ? { $pull: { [field]: me } } : { $addToSet: { [field]: me } },
    { new: true, projection: { [field]: 1 } }
  );
  return { on: !has, count: updated[field].length };
}

router.post("/posts/:id/like", requireViewer, rateLimit("react"), async (req, res) => {
  try {
    const r = await toggle(req, res, "likes");
    if (r) res.json({ liked: r.on, likesCount: r.count });
  } catch (err) {
    console.error("[skyhub] like error:", err);
    res.status(500).json({ message: "Failed to update like." });
  }
});

router.post("/posts/:id/save", requireViewer, rateLimit("react"), async (req, res) => {
  try {
    const r = await toggle(req, res, "saves");
    if (r) res.json({ saved: r.on, savesCount: r.count });
  } catch (err) {
    console.error("[skyhub] save error:", err);
    res.status(500).json({ message: "Failed to update save." });
  }
});

/* ─────────────────────────────────────────────────────────────
   Comments
───────────────────────────────────────────────────────────── */
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "Invalid post id." });
    return res.json({ comments: await visibleComments(id, req.skyUser?.id) });
  } catch (err) {
    console.error("[skyhub] get comments error:", err);
    return res.status(500).json({ message: "Failed to load comments." });
  }
});

router.post(
  "/posts/:id/comments",
  requireViewer,
  requireNotSuspended,
  rateLimit("comment"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const me = req.skyUser;
      if (!validId(id)) return res.status(400).json({ message: "Invalid post id." });
      const text = cleanText(req.body?.text, 600);
      if (!text) return res.status(400).json({ message: "Comment text is required." });
      const spam = checkSpam(text, { maxLinks: 1 });
      if (spam) return res.status(400).json({ message: spam });

      const post = await SkyHubPost.findOne({ _id: id, hidden: { $ne: true } });
      if (!post) return res.status(404).json({ message: "Post not found." });
      if (await isBlockedBetween(me.id, post.author)) {
        return res.status(403).json({ message: "You can't comment on this post." });
      }

      await SkyHubComment.create({
        post: post._id,
        author: me.id,
        authorName: me.name,
        username: me.username,
        avatar: me.avatar,
        text,
      });
      const fresh = await SkyHubPost.findByIdAndUpdate(id, { $inc: { commentsCount: 1 } }, { new: true });

      return res.status(201).json({
        message: "Comment added.",
        comments: await visibleComments(id, me.id),
        commentCount: fresh.commentsCount,
      });
    } catch (err) {
      console.error("[skyhub] create comment error:", err);
      return res.status(500).json({ message: "Failed to add comment." });
    }
  }
);

// DELETE /api/skyhub/comments/:id — your comment, a comment on your post, or an admin.
router.delete("/comments/:id", requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "Invalid comment id." });
    const c = await SkyHubComment.findById(id);
    if (!c) return res.status(404).json({ message: "Comment not found." });
    const post = await SkyHubPost.findById(c.post).select("author");
    const allowed =
      String(c.author) === req.skyUser.id || String(post?.author) === req.skyUser.id || isAdmin(req);
    if (!allowed) return res.status(403).json({ message: "You can't delete this comment." });
    await SkyHubComment.deleteOne({ _id: id });
    const fresh = await SkyHubPost.findOneAndUpdate(
      { _id: c.post, commentsCount: { $gt: 0 } },
      { $inc: { commentsCount: -1 } },
      { new: true }
    );
    return res.json({ ok: true, commentCount: fresh?.commentsCount ?? 0 });
  } catch (err) {
    console.error("[skyhub] delete comment error:", err);
    return res.status(500).json({ message: "Failed to delete comment." });
  }
});

/* ─────────────────────────────────────────────────────────────
   Reports — posts, comments and travelers
   Body: { reason: spam|harassment|hate|nudity|scam|violence|misinformation|other, details? }
   A post or comment is hidden for review once 3 different people report it.
───────────────────────────────────────────────────────────── */
async function fileReport(req, res, targetType) {
  const { id } = req.params;
  if (!validId(id)) return res.status(400).json({ message: "Invalid id." });
  const me = req.skyUser.id;
  const reason = REPORT_REASONS.includes(req.body?.reason) ? req.body.reason : "other";
  const details = cleanText(req.body?.details, 500);

  let doc = null;
  let targetUser = null;
  let post = null;
  if (targetType === "post") {
    doc = await SkyHubPost.findById(id);
    targetUser = doc?.author || null;
    post = doc?._id || null;
  } else if (targetType === "comment") {
    doc = await SkyHubComment.findById(id);
    targetUser = doc?.author || null;
    post = doc?.post || null;
  } else {
    doc = await User.findById(id).select("_id");
    targetUser = doc?._id || null;
  }
  if (!doc) return res.status(404).json({ message: "Not found." });
  if (targetUser && String(targetUser) === me) {
    return res.status(400).json({ message: "You can't report yourself." });
  }

  try {
    await SkyHubReport.create({ targetType, targetId: id, post, targetUser, reporter: me, reason, details });
  } catch (e) {
    if (e?.code === 11000) return res.json({ message: "You already reported this. Thanks — we're on it." });
    throw e;
  }

  if (targetType !== "user") {
    const count = await SkyHubReport.countDocuments({ targetType, targetId: id, status: "open" });
    const Model = targetType === "post" ? SkyHubPost : SkyHubComment;
    const update = { reportCount: count };
    if (count >= AUTO_HIDE_REPORTS && !doc.hidden) {
      Object.assign(update, { hidden: true, hiddenReason: "review", ...(targetType === "post" ? { hiddenAt: new Date() } : {}) });
    }
    await Model.updateOne({ _id: id }, { $set: update });
  }
  return res.status(201).json({ message: "Thanks for reporting. Our team will review it." });
}

router.post("/posts/:id/report", requireViewer, rateLimit("report"), (req, res) =>
  fileReport(req, res, "post").catch((err) => {
    console.error("[skyhub] report post error:", err);
    res.status(500).json({ message: "Failed to report post." });
  })
);
router.post("/comments/:id/report", requireViewer, rateLimit("report"), (req, res) =>
  fileReport(req, res, "comment").catch((err) => {
    console.error("[skyhub] report comment error:", err);
    res.status(500).json({ message: "Failed to report comment." });
  })
);
router.post("/users/:id/report", requireViewer, rateLimit("report"), (req, res) =>
  fileReport(req, res, "user").catch((err) => {
    console.error("[skyhub] report user error:", err);
    res.status(500).json({ message: "Failed to report traveler." });
  })
);

/* ─────────────────────────────────────────────────────────────
   Blocking — you won't see each other's posts or comments,
   and neither of you can comment on or react to the other's posts.
───────────────────────────────────────────────────────────── */
router.get("/blocks", requireViewer, async (req, res) => {
  try {
    const rows = await SkyHubBlock.find({ blocker: req.skyUser.id })
      .populate("blocked", "name username avatar")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({
      blocked: rows
        .filter((r) => r.blocked)
        .map((r) => ({
          id: String(r.blocked._id),
          name: r.blocked.name || r.blocked.username,
          username: r.blocked.username,
          avatar: r.blocked.avatar || null,
        })),
    });
  } catch (err) {
    console.error("[skyhub] blocks error:", err);
    return res.status(500).json({ message: "Failed to load blocked travelers." });
  }
});

router.post("/users/:id/block", requireViewer, rateLimit("block"), async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.skyUser.id;
    if (!validId(id)) return res.status(400).json({ message: "Invalid traveler." });
    if (id === me) return res.status(400).json({ message: "You can't block yourself." });
    const target = await User.findById(id).select("_id isOfficial");
    if (!target) return res.status(404).json({ message: "Traveler not found." });
    if (target.isOfficial) return res.status(400).json({ message: "You can mute Skyrio updates instead." });

    await SkyHubBlock.updateOne({ blocker: me, blocked: id }, { $setOnInsert: { blocker: me, blocked: id } }, { upsert: true });

    // Blocking also unfollows both ways (both follow systems, best effort).
    await Promise.all([
      User.updateOne({ _id: me, following: id }, { $pull: { following: id }, $inc: { followingCount: -1 } }),
      User.updateOne({ _id: id, followers: me }, { $pull: { followers: me }, $inc: { followersCount: -1 } }),
      User.updateOne({ _id: id, following: me }, { $pull: { following: me }, $inc: { followingCount: -1 } }),
      User.updateOne({ _id: me, followers: id }, { $pull: { followers: id }, $inc: { followersCount: -1 } }),
      mongoose.models.Follow
        ? mongoose.models.Follow.deleteMany({
            $or: [
              { followerId: me, followingId: id },
              { followerId: id, followingId: me },
            ],
          })
        : null,
    ]).catch(() => {});

    return res.json({ ok: true, message: "Blocked. You won't see each other on SkyHub." });
  } catch (err) {
    console.error("[skyhub] block error:", err);
    return res.status(500).json({ message: "Failed to block traveler." });
  }
});

router.delete("/users/:id/block", requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "Invalid traveler." });
    await SkyHubBlock.deleteOne({ blocker: req.skyUser.id, blocked: id });
    return res.json({ ok: true, message: "Unblocked." });
  } catch (err) {
    console.error("[skyhub] unblock error:", err);
    return res.status(500).json({ message: "Failed to unblock traveler." });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/skyhub/stats — real counts (visible posts only)
───────────────────────────────────────────────────────────── */
router.get("/stats", async (_req, res) => {
  try {
    const visible = { hidden: { $ne: true } };
    const [posts, destinations, authors] = await Promise.all([
      SkyHubPost.countDocuments(visible),
      SkyHubPost.distinct("destination", visible).then((d) => d.filter(Boolean)),
      SkyHubPost.distinct("author", visible).then((a) => a.filter(Boolean)),
    ]);
    return res.json({ travelers: authors.length, posts, countries: destinations.length });
  } catch (err) {
    console.error("[skyhub] stats error:", err);
    return res.status(500).json({ message: "Failed to load stats." });
  }
});

/* ═════════════════════════════════════════════════════════════
   ADMIN — moderation queue (admin dashboard login or admin account)
═════════════════════════════════════════════════════════════ */

// GET /api/skyhub/admin/reports?status=open|dismissed|actioned
// Grouped: one row per reported thing, with every reason and reporter count.
router.get("/admin/reports", adminOnly, async (req, res) => {
  try {
    const status = ["open", "dismissed", "actioned"].includes(req.query.status) ? req.query.status : "open";
    const reports = await SkyHubReport.find({ status })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("reporter", "name username")
      .populate("targetUser", "name username email avatar")
      .lean();

    const groups = new Map();
    for (const r of reports) {
      const key = `${r.targetType}:${r.targetId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          targetType: r.targetType,
          targetId: String(r.targetId),
          targetUser: r.targetUser
            ? {
                id: String(r.targetUser._id),
                name: r.targetUser.name || r.targetUser.username,
                username: r.targetUser.username,
                email: r.targetUser.email,
              }
            : null,
          reasons: {},
          reports: [],
          firstAt: r.createdAt,
          lastAt: r.createdAt,
        });
      }
      const g = groups.get(key);
      g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
      g.reports.push({
        id: String(r._id),
        reason: r.reason,
        details: r.details,
        by: r.reporter?.username || r.reporter?.name || "traveler",
        at: r.createdAt,
        resolution: r.resolution,
      });
      if (r.createdAt < g.firstAt) g.firstAt = r.createdAt;
      if (r.createdAt > g.lastAt) g.lastAt = r.createdAt;
    }

    // Attach the content itself.
    const list = [...groups.values()];
    const postIds = list.filter((g) => g.targetType === "post").map((g) => g.targetId);
    const commentIds = list.filter((g) => g.targetType === "comment").map((g) => g.targetId);
    const [posts, comments, suspended] = await Promise.all([
      SkyHubPost.find({ _id: { $in: postIds } }).select("text images destination type hidden hiddenReason createdAt").lean(),
      SkyHubComment.find({ _id: { $in: commentIds } }).select("text post hidden hiddenReason createdAt").lean(),
      SkyHubRestriction.find({ user: { $in: list.map((g) => g.targetUser?.id).filter(Boolean) } }).lean(),
    ]);
    const pById = new Map(posts.map((p) => [String(p._id), p]));
    const cById = new Map(comments.map((c) => [String(c._id), c]));
    const sByUser = new Map(suspended.map((s) => [String(s.user), s]));
    for (const g of list) {
      const c = g.targetType === "post" ? pById.get(g.targetId) : g.targetType === "comment" ? cById.get(g.targetId) : null;
      g.content = c
        ? {
            text: c.text,
            images: c.images || [],
            destination: c.destination || null,
            hidden: Boolean(c.hidden),
            hiddenReason: c.hiddenReason || null,
            postId: c.post ? String(c.post) : g.targetType === "post" ? g.targetId : null,
          }
        : g.targetType === "user"
        ? null
        : { deleted: true };
      g.count = g.reports.length;
      const s = g.targetUser ? sByUser.get(g.targetUser.id) : null;
      g.suspendedUntil = s ? s.until || "indefinite" : null;
    }
    list.sort((a, b) => b.count - a.count || new Date(b.lastAt) - new Date(a.lastAt));
    return res.json({ ok: true, items: list });
  } catch (err) {
    console.error("[skyhub/admin] reports error:", err);
    return res.status(500).json({ message: "Failed to load reports." });
  }
});

// GET /api/skyhub/admin/open-count — for the admin dashboard badge
router.get("/admin/open-count", adminOnly, async (_req, res) => {
  const ids = await SkyHubReport.distinct("targetId", { status: "open" }).catch(() => []);
  res.json({ ok: true, count: ids.length });
});

/* POST /api/skyhub/admin/resolve
   Body: { targetType, targetId, action: "dismiss"|"hide"|"remove"|"suspend"|"restore", days?, note? }
   Applies to every open report on that thing. */
router.post("/admin/resolve", adminOnly, async (req, res) => {
  try {
    const { targetType, targetId, action } = req.body || {};
    if (!["post", "comment", "user"].includes(targetType) || !validId(targetId)) {
      return res.status(400).json({ message: "Pick a reported item." });
    }
    if (!["dismiss", "hide", "remove", "suspend", "restore"].includes(action)) {
      return res.status(400).json({ message: "Unknown action." });
    }
    const by = adminName(req);
    const Model = targetType === "post" ? SkyHubPost : targetType === "comment" ? SkyHubComment : null;

    let targetUser = null;
    if (Model) {
      const doc = await Model.findById(targetId).select("author post");
      targetUser = doc?.author || null;
      if (action === "dismiss" || action === "restore") {
        await Model.updateOne({ _id: targetId }, { $set: { hidden: false, hiddenReason: null } });
      } else if (action === "hide" || action === "remove" || action === "suspend") {
        await Model.updateOne(
          { _id: targetId },
          { $set: { hidden: true, hiddenReason: "removed", ...(targetType === "post" ? { hiddenAt: new Date() } : {}) } }
        );
        if (targetType === "comment" && doc?.post) {
          await SkyHubPost.updateOne({ _id: doc.post, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
        }
      }
    } else {
      targetUser = targetId;
    }

    if (action === "suspend" && targetUser) {
      const days = Number(req.body?.days);
      const until = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000) : null;
      await SkyHubRestriction.updateOne(
        { user: targetUser },
        { $set: { user: targetUser, until, reason: cleanText(req.body?.note, 300), by } },
        { upsert: true }
      );
    }

    const resolution =
      action === "dismiss" ? "dismissed" : action === "restore" ? "restored" : action === "suspend" ? "suspended" : action === "remove" ? "removed" : "hidden";
    await SkyHubReport.updateMany(
      { targetType, targetId, status: "open" },
      {
        $set: {
          status: action === "dismiss" || action === "restore" ? "dismissed" : "actioned",
          resolution,
          resolvedBy: by,
          resolvedAt: new Date(),
        },
      }
    );
    return res.json({ ok: true, resolution });
  } catch (err) {
    console.error("[skyhub/admin] resolve error:", err);
    return res.status(500).json({ message: "Couldn't apply that action." });
  }
});

// GET/DELETE /api/skyhub/admin/suspensions — see and lift suspensions
router.get("/admin/suspensions", adminOnly, async (_req, res) => {
  const rows = await SkyHubRestriction.find({})
    .populate("user", "name username email")
    .sort({ createdAt: -1 })
    .lean();
  res.json({
    ok: true,
    suspensions: rows.map((r) => ({
      userId: String(r.user?._id || r.user),
      name: r.user?.name || r.user?.username || "Traveler",
      username: r.user?.username,
      email: r.user?.email,
      until: r.until,
      reason: r.reason,
      by: r.by,
      at: r.createdAt,
    })),
  });
});

router.delete("/admin/suspensions/:userId", adminOnly, async (req, res) => {
  if (!validId(req.params.userId)) return res.status(400).json({ message: "Invalid traveler." });
  await SkyHubRestriction.deleteOne({ user: req.params.userId });
  res.json({ ok: true });
});

export default router;
