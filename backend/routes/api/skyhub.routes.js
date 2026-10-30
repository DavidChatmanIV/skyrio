import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import SkyHubTakedown from "../../models/SkyHubTakedown.js";
import Notification from "../../models/notification.js";
import SkyHubPost from "../../models/SkyHubPost.js";
import SkyHubComment from "../../models/SkyHubComment.js";
import SkyHubReport from "../../models/SkyHubReport.js";
import SkyHubBlock from "../../models/SkyHubBlock.js";
import SkyHubRestriction from "../../models/SkyHubRestriction.js";
import User from "../../models/user.js";
// Official rank ladder — the same one the Digital Passport and
// User.getXPLevel() use, so badges can never disagree across the site.
import { getLevel } from "../../config/xpRules.js";
import { readAdminSession } from "../admin.routes.js";
import SkyHubStrike from "../../models/SkyHubStrike.js";
import {
  STRIKE_POLICY,
  issueStrike,
  standingFor,
  activeStrikes,
  resolveAppeal,
  decide,
  REPORT_REASON_KEYS,
  severityOf,
  severityRank,
  reasonLabel,
  LEGAL,
} from "../../services/skyhubModeration.js";
import { sendReportAlert } from "../../services/moderationEmails.js";
// Namespace import: if a helper is ever renamed, XP just skips instead of
// crashing the whole server on boot.
import * as xpService from "../../services/xpService.js";
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
const POST_TYPES = [
  "Tip",
  "Travel Tip",
  "Question",
  "Story",
  "Photo",
  "Photo Drop",
  "Join Trip",
];
const REPORT_REASONS = REPORT_REASON_KEYS;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// In-app notice to a traveler (never blocks the request if it fails).
function notifyUser(userId, title, msg, link = "/skyhub?standing=1") {
  if (!userId) return;
  Notification.create({
    user: userId,
    type: "system",
    title,
    message: msg,
    link,
  }).catch(() => {});
}

const newTicket = () =>
  `SKY-${crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`;

// Pulls post ids out of whatever the requester pasted (links, ids, text).
function postIdsFrom(text) {
  const ids = String(text || "").match(/\b[a-f0-9]{24}\b/gi) || [];
  return [...new Set(ids.map((s) => s.toLowerCase()))]
    .filter(validId)
    .slice(0, 20);
}

// Hides the given posts, plus any other post that reuses the same photo
// (the TAKE IT DOWN Act also covers identical copies). Returns how many.
async function hidePostsAndCopies(
  postIds,
  { reason = "review", holdDays = 0 } = {}
) {
  if (!postIds.length) return { hidden: 0, duplicates: 0 };
  const posts = await SkyHubPost.find({ _id: { $in: postIds } })
    .select("images image author")
    .lean();
  const urls = [
    ...new Set(
      posts.flatMap((p) => [...(p.images || []), p.image]).filter(Boolean)
    ),
  ];
  const set = {
    hidden: true,
    hiddenReason: reason,
    hiddenAt: new Date(),
    ...(holdDays
      ? { legalHoldUntil: new Date(Date.now() + holdDays * DAY) }
      : {}),
  };
  await SkyHubPost.updateMany({ _id: { $in: postIds } }, { $set: set });
  let duplicates = 0;
  if (urls.length) {
    const r = await SkyHubPost.updateMany(
      {
        _id: { $nin: postIds },
        $or: [{ images: { $in: urls } }, { image: { $in: urls } }],
      },
      { $set: set }
    );
    duplicates = r.modifiedCount || 0;
  }
  return {
    hidden: posts.length,
    duplicates,
    authors: posts.map((p) => p.author).filter(Boolean),
  };
}

// ── Helpers ───────────────────────────────────────────────────
function getTimeAgo(date) {
  const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Runs an XP helper without ever letting an XP problem break the post itself.
async function runXp(name, args) {
  const fn = xpService[name];
  if (typeof fn !== "function") {
    console.warn(`[skyhub] xpService.${name} not found — XP skipped`);
    return null;
  }
  try {
    return await fn(args);
  } catch (err) {
    console.error(`[skyhub] ${name} failed:`, err);
    return null;
  }
}

// What the browser needs to update the XP shown on screen.
async function xpSummary(userId, result) {
  const u = await User.findById(userId)
    .select("xp pendingXp")
    .lean()
    .catch(() => null);
  const awarded = Boolean(result?.awarded ?? (result && result.amount > 0));
  if (result && !awarded)
    console.info(`[skyhub] no post XP for ${userId}:`, result.reason || result);
  return {
    awarded,
    amount: result?.amount || 0,
    // Why nothing was awarded (too_short, daily_cap, ...). "xp_unavailable"
    // means the XP service itself didn't run — check the server log.
    reason: awarded
      ? null
      : result?.reason || (result ? "not_awarded" : "xp_unavailable"),
    rankUp: result?.rankUp || null,
    total: u?.xp ?? null,
    pending: u?.pendingXp ?? null,
  };
}

function mapPost(
  post,
  viewerId,
  xpByAuthorId = new Map(),
  followingIds = null
) {
  const likeIds = (post.likes || []).map(String);
  const saveIds = (post.saves || []).map(String);
  const authorId = post.author?.toString() || null;
  // Author's LIFETIME earned XP (see xpMapFor) — never the spendable balance.
  const authorXp = authorId ? xpByAuthorId.get(authorId) ?? 0 : 0;
  return {
    _id: post._id,
    authorId,
    isMine: Boolean(viewerId && authorId && authorId === viewerId),
    authorName: post.authorName,
    username: post.username,
    avatar: post.avatar,
    verified: post.verified,
    authorBadge: getLevel(authorXp).current.name,
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
    viewerFollowsAuthor: Boolean(
      followingIds && authorId && followingIds.has(authorId)
    ),
    // Only the author ever receives a hidden post (see /feed).
    underReview: Boolean(post.hidden && post.hiddenReason === "review"),
    timeAgo: getTimeAgo(post.createdAt),
    createdAt: post.createdAt,
    edited: Boolean(post.editedAt),
    editedAt: post.editedAt || null,
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

// Rank XP for each post author. Rank comes from LIFETIME earned XP
// (xpTotalEarned), the same as User.getXPLevel(), so redeeming rewards
// never lowers anyone's badge. Falls back to xp for older accounts.
async function xpMapFor(posts) {
  const ids = [
    ...new Set(posts.map((p) => p.author?.toString()).filter(Boolean)),
  ];
  if (!ids.length) return new Map();
  const authors = await User.find({ _id: { $in: ids } })
    .select("xpTotalEarned xp")
    .lean();
  return new Map(
    authors.map((a) => [a._id.toString(), a.xpTotalEarned ?? a.xp ?? 0])
  );
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
  if (!isAdmin(req))
    return res.status(403).json({ message: "Admin access required." });
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

    // Who the viewer follows — used for the Follow buttons and ?scope=following
    let followingIds = null;
    if (viewerId) {
      const me = await User.findById(viewerId).select("following").lean();
      followingIds = new Set((me?.following || []).map(String));
    }
    const followingOnly = req.query.scope === "following";
    if (followingOnly && !viewerId) return res.json({ posts: [] });

    const hidden = new Set(hide.map(String));
    const authorFilter = followingOnly
      ? { author: { $in: [...followingIds].filter((id) => !hidden.has(id)) } }
      : hide.length
      ? { author: { $nin: hide } }
      : {};
    const visible = viewerId
      ? {
          $or: [
            { hidden: { $ne: true } },
            { author: viewerId, hiddenReason: "review" },
          ],
        }
      : { hidden: { $ne: true } };
    const posts = await SkyHubPost.find({
      ...visible,
      ...authorFilter,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const xp = await xpMapFor(posts);
    return res.json({
      posts: posts.map((p) => mapPost(p, viewerId, xp, followingIds)),
    });
  } catch (err) {
    console.error("[skyhub] feed error:", err);
    return res.status(500).json({ message: "Failed to load feed." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/skyhub/posts   (logged in, not suspended, rate-limited)
───────────────────────────────────────────────────────────── */
router.post(
  "/posts",
  requireViewer,
  requireNotSuspended,
  rateLimit("post"),
  async (req, res) => {
    try {
      const me = req.skyUser;
      const text = cleanText(req.body?.text, 1200);
      const images = safeImageUrls(
        req.body?.images?.length
          ? req.body.images
          : [req.body?.image].filter(Boolean)
      );
      // Photo-only posts are allowed. If photos were sent but none survived the
      // safety check, say so instead of a confusing "write something".
      const sentImages = (
        req.body?.images?.length ? req.body.images : [req.body?.image]
      ).filter(Boolean).length;
      if (!text && !images.length) {
        return res.status(400).json({
          message: sentImages
            ? "Your photo couldn't be attached. Try uploading it again."
            : "Write something or add a photo.",
        });
      }

      if (text) {
        const spam = checkSpam(text);
        if (spam) return res.status(400).json({ message: spam });
        if (await isRepeatPost(me.id, text)) {
          return res
            .status(409)
            .json({ message: "You already posted this today." });
        }
      }

      const type = POST_TYPES.includes(req.body?.type)
        ? req.body.type
        : "Story";
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

      // XP goes through the anti-cheat service (ledger, daily caps, min length).
      const award = await runXp("awardPostXp", {
        userId: me.id,
        postId: newPost._id,
        text,
        mediaCount: images.length,
      });
      const xpResult = await xpSummary(me.id, award);

      const xp = await xpMapFor([newPost]);
      return res.status(201).json({
        message: "Post created.",
        post: mapPost(newPost.toObject(), me.id, xp),
        xp: xpResult,
      });
    } catch (err) {
      console.error("[skyhub] create post error:", err);
      return res.status(500).json({ message: "Failed to create post." });
    }
  }
);

/* ─────────────────────────────────────────────────────────────
   PATCH /api/skyhub/posts/:id   (the author only)
   Body: { text?, destination? }  — photos stay as they were.
───────────────────────────────────────────────────────────── */
router.patch(
  "/posts/:id",
  requireViewer,
  requireNotSuspended,
  rateLimit("post"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!validId(id))
        return res.status(400).json({ message: "Invalid post id." });
      const post = await SkyHubPost.findById(id);
      if (!post) return res.status(404).json({ message: "Post not found." });
      if (String(post.author) !== req.skyUser.id) {
        return res
          .status(403)
          .json({ message: "You can only edit your own posts." });
      }
      if (post.hidden && post.hiddenReason === "removed") {
        return res
          .status(403)
          .json({ message: "This post was removed and can't be edited." });
      }

      const text =
        req.body?.text !== undefined
          ? cleanText(req.body.text, 1200)
          : post.text;
      const destination =
        req.body?.destination !== undefined
          ? cleanText(req.body.destination, 120)
          : post.destination;
      const hasPhotos = (post.images?.length || 0) > 0 || Boolean(post.image);
      if (!text && !hasPhotos)
        return res
          .status(400)
          .json({ message: "A post needs text or a photo." });

      if (text && text !== post.text) {
        const spam = checkSpam(text);
        if (spam) return res.status(400).json({ message: spam });
      }

      const changed = text !== post.text || destination !== post.destination;
      if (changed) {
        post.text = text;
        post.destination = destination;
        post.editedAt = new Date();
        await post.save();
      }

      const xp = await xpMapFor([post]);
      return res.json({
        message: changed ? "Post updated." : "No changes.",
        post: mapPost(post.toObject(), req.skyUser.id, xp),
      });
    } catch (err) {
      console.error("[skyhub] edit post error:", err);
      return res.status(500).json({ message: "Failed to update post." });
    }
  }
);

/* ─────────────────────────────────────────────────────────────
   DELETE /api/skyhub/posts/:id   (the author, or an admin)
───────────────────────────────────────────────────────────── */
router.delete("/posts/:id", requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id))
      return res.status(400).json({ message: "Invalid post id." });
    const post = await SkyHubPost.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const mine = post.author && String(post.author) === req.skyUser.id;
    if (!mine && !isAdmin(req)) {
      return res
        .status(403)
        .json({ message: "You can only delete your own posts." });
    }
    // Under an evidence hold: take it off SkyHub but keep the record.
    if (post.legalHoldUntil && post.legalHoldUntil > new Date()) {
      await SkyHubPost.updateOne(
        { _id: id },
        {
          $set: { hidden: true, hiddenReason: "removed", hiddenAt: new Date() },
        }
      );
      return res.json({ success: true, message: "Post deleted." });
    }
    await Promise.all([
      SkyHubPost.deleteOne({ _id: id }),
      SkyHubComment.deleteMany({ post: id }),
    ]);
    // Take back the post's XP (and its like XP) so delete-and-repost can't farm.
    await runXp("reversePostXp", id);
    const xpResult = mine ? await xpSummary(req.skyUser.id, null) : null;
    return res.json({ success: true, message: "Post deleted.", xp: xpResult });
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
  const post = await SkyHubPost.findOne({
    _id: id,
    hidden: { $ne: true },
  }).select(`${field} author`);
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

router.post(
  "/posts/:id/like",
  requireViewer,
  rateLimit("react"),
  async (req, res) => {
    try {
      const r = await toggle(req, res, "likes");
      if (r) res.json({ liked: r.on, likesCount: r.count });
    } catch (err) {
      console.error("[skyhub] like error:", err);
      res.status(500).json({ message: "Failed to update like." });
    }
  }
);

router.post(
  "/posts/:id/save",
  requireViewer,
  rateLimit("react"),
  async (req, res) => {
    try {
      const r = await toggle(req, res, "saves");
      if (r) res.json({ saved: r.on, savesCount: r.count });
    } catch (err) {
      console.error("[skyhub] save error:", err);
      res.status(500).json({ message: "Failed to update save." });
    }
  }
);

/* ─────────────────────────────────────────────────────────────
   Comments
───────────────────────────────────────────────────────────── */
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id))
      return res.status(400).json({ message: "Invalid post id." });
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
      if (!validId(id))
        return res.status(400).json({ message: "Invalid post id." });
      const text = cleanText(req.body?.text, 600);
      if (!text)
        return res.status(400).json({ message: "Comment text is required." });
      const spam = checkSpam(text, { maxLinks: 1 });
      if (spam) return res.status(400).json({ message: spam });

      const post = await SkyHubPost.findOne({ _id: id, hidden: { $ne: true } });
      if (!post) return res.status(404).json({ message: "Post not found." });
      if (await isBlockedBetween(me.id, post.author)) {
        return res
          .status(403)
          .json({ message: "You can't comment on this post." });
      }

      await SkyHubComment.create({
        post: post._id,
        author: me.id,
        authorName: me.name,
        username: me.username,
        avatar: me.avatar,
        text,
      });
      const fresh = await SkyHubPost.findByIdAndUpdate(
        id,
        { $inc: { commentsCount: 1 } },
        { new: true }
      );

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
    if (!validId(id))
      return res.status(400).json({ message: "Invalid comment id." });
    const c = await SkyHubComment.findById(id);
    if (!c) return res.status(404).json({ message: "Comment not found." });
    const post = await SkyHubPost.findById(c.post).select("author");
    const allowed =
      String(c.author) === req.skyUser.id ||
      String(post?.author) === req.skyUser.id ||
      isAdmin(req);
    if (!allowed)
      return res
        .status(403)
        .json({ message: "You can't delete this comment." });
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
  const reason = REPORT_REASONS.includes(req.body?.reason)
    ? req.body.reason
    : "other";
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

  const severity = severityOf(reason);
  const dueBy =
    reason === "intimate_image"
      ? new Date(Date.now() + LEGAL.intimateImageHours * HOUR)
      : null;

  try {
    await SkyHubReport.create({
      targetType,
      targetId: id,
      post,
      targetUser,
      reporter: me,
      reason,
      severity,
      dueBy,
      details,
    });
  } catch (e) {
    if (e?.code === 11000)
      return res.json({
        message: "You already reported this. Thanks — we're on it.",
      });
    throw e;
  }

  const count = await SkyHubReport.countDocuments({
    targetType,
    targetId: id,
    status: "open",
  });
  // Critical reasons (child safety, intimate images) hide on the FIRST report.
  const threshold = severity === "critical" ? 1 : AUTO_HIDE_REPORTS;
  let autoHidden = false;
  if (targetType !== "user") {
    const Model = targetType === "post" ? SkyHubPost : SkyHubComment;
    const update = { reportCount: count };
    if (count >= threshold && !doc.hidden) {
      autoHidden = true;
      Object.assign(update, {
        hidden: true,
        hiddenReason: "review",
        ...(targetType === "post" ? { hiddenAt: new Date() } : {}),
      });
    }
    // Child-safety: preserve the evidence so a quick "delete" can't erase it.
    if (reason === "child_safety" && targetType === "post") {
      update.legalHoldUntil = new Date(
        Date.now() + LEGAL.childSafetyHoldDays * DAY
      );
    }
    await Model.updateOne({ _id: id }, { $set: update });

    // Intimate image on a post: also hide identical copies elsewhere.
    if (reason === "intimate_image" && targetType === "post") {
      await hidePostsAndCopies([id]).catch(() => {});
    }
  }

  // Tell the author their post is hidden while we review — but never tip
  // off someone reported for child safety.
  if (autoHidden && targetUser && reason !== "child_safety") {
    notifyUser(
      targetUser,
      `Your SkyHub ${targetType} is hidden for review`,
      `It was reported for ${reasonLabel(
        reason
      ).toLowerCase()}. Only you can see it until our team reviews it. We'll let you know what we decide.`
    );
  }

  // Someone is worried about the poster: reach out with support, not a penalty.
  if (reason === "self_harm" && count === 1 && targetUser) {
    notifyUser(
      targetUser,
      "Someone on SkyHub is thinking of you",
      "A traveler who saw your post wanted to make sure you're okay. If you're going through something hard, you can call or text 988 (Suicide & Crisis Lifeline, US) any time, or visit findahelpline.com outside the US. You're not in trouble.",
      "/skyhub/guidelines#support"
    );
  }

  // Tell the Skyrio team: on the first report, when it auto-hides, and
  // EVERY time for critical reasons.
  if (count === 1 || autoHidden || severity === "critical") {
    const author = targetUser
      ? await User.findById(targetUser).select("name username").lean()
      : null;
    sendReportAlert({
      targetType,
      reason,
      count,
      autoHidden,
      // Never put reported child-safety content into an email.
      snippet:
        reason === "child_safety"
          ? "[CHILD SAFETY — open the admin queue. Do not download or forward the content.]"
          : `${
              severity === "critical"
                ? `[URGENT${
                    dueBy ? ` — remove by ${dueBy.toISOString()}` : ""
                  }] `
                : ""
            }${doc.text || ""}`,
      authorName: author?.name || doc.authorName,
      authorUsername: author?.username || doc.username,
    }).catch(() => {});
  }

  const messages = {
    child_safety:
      "Thank you. We've hidden it and our team is reviewing it now. If a child is in immediate danger, call 911.",
    intimate_image:
      "Thank you. We've hidden it while we review. If it's an image of you, you can also file a formal removal request at /skyhub/report-content.",
    self_harm:
      "Thank you for looking out for them. We've reached out with support resources. If someone is in immediate danger, call 911.",
  };
  return res.status(201).json({
    message:
      messages[reason] || "Thanks for reporting. Our team will review it.",
  });
}

router.post(
  "/posts/:id/report",
  requireViewer,
  rateLimit("report"),
  (req, res) =>
    fileReport(req, res, "post").catch((err) => {
      console.error("[skyhub] report post error:", err);
      res.status(500).json({ message: "Failed to report post." });
    })
);
router.post(
  "/comments/:id/report",
  requireViewer,
  rateLimit("report"),
  (req, res) =>
    fileReport(req, res, "comment").catch((err) => {
      console.error("[skyhub] report comment error:", err);
      res.status(500).json({ message: "Failed to report comment." });
    })
);
router.post(
  "/users/:id/report",
  requireViewer,
  rateLimit("report"),
  (req, res) =>
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
    return res
      .status(500)
      .json({ message: "Failed to load blocked travelers." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/skyhub/users/:id/follow   (logged in, rate-limited)
   Toggles following. Uses the same User.following / followers arrays
   (and counts) the block route already cleans up. No XP — following
   must never be a way to farm points.
───────────────────────────────────────────────────────────── */
const MAX_FOLLOWING = 2000;

router.post(
  "/users/:id/follow",
  requireViewer,
  rateLimit("react"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const me = req.skyUser.id;
      if (!validId(id))
        return res.status(400).json({ message: "Invalid traveler." });
      if (id === me)
        return res.status(400).json({ message: "You can't follow yourself." });

      const target = await User.findById(id).select("_id isActive");
      if (!target || target.isActive === false)
        return res.status(404).json({ message: "Traveler not found." });
      if (await isBlockedBetween(me, id))
        return res.status(404).json({ message: "Traveler not found." });

      // Follow — only if not already following and under the cap.
      // The conditions make this safe against double-taps.
      const added = await User.updateOne(
        {
          _id: me,
          following: { $ne: id },
          followingCount: { $lt: MAX_FOLLOWING },
        },
        { $addToSet: { following: id }, $inc: { followingCount: 1 } }
      );

      if (added.modifiedCount === 1) {
        await User.updateOne(
          { _id: id, followers: { $ne: me } },
          { $addToSet: { followers: me }, $inc: { followersCount: 1 } }
        );
        const t = await User.findById(id).select("followersCount").lean();
        return res.json({
          following: true,
          followersCount: t?.followersCount ?? 0,
        });
      }

      // Not added: either already following (→ unfollow) or at the cap.
      const removed = await User.updateOne(
        { _id: me, following: id },
        { $pull: { following: id }, $inc: { followingCount: -1 } }
      );
      if (removed.modifiedCount === 1) {
        await User.updateOne(
          { _id: id, followers: me },
          { $pull: { followers: me }, $inc: { followersCount: -1 } }
        );
        const t = await User.findById(id).select("followersCount").lean();
        return res.json({
          following: false,
          followersCount: Math.max(0, t?.followersCount ?? 0),
        });
      }

      return res.status(400).json({
        message: `You can follow up to ${MAX_FOLLOWING.toLocaleString()} travelers.`,
      });
    } catch (err) {
      console.error("[skyhub] follow error:", err);
      return res.status(500).json({ message: "Couldn't update follow." });
    }
  }
);

router.post(
  "/users/:id/block",
  requireViewer,
  rateLimit("block"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const me = req.skyUser.id;
      if (!validId(id))
        return res.status(400).json({ message: "Invalid traveler." });
      if (id === me)
        return res.status(400).json({ message: "You can't block yourself." });
      const target = await User.findById(id).select("_id isOfficial");
      if (!target)
        return res.status(404).json({ message: "Traveler not found." });
      if (target.isOfficial)
        return res
          .status(400)
          .json({ message: "You can mute Skyrio updates instead." });

      await SkyHubBlock.updateOne(
        { blocker: me, blocked: id },
        { $setOnInsert: { blocker: me, blocked: id } },
        { upsert: true }
      );

      // Blocking also unfollows both ways (both follow systems, best effort).
      await Promise.all([
        User.updateOne(
          { _id: me, following: id },
          { $pull: { following: id }, $inc: { followingCount: -1 } }
        ),
        User.updateOne(
          { _id: id, followers: me },
          { $pull: { followers: me }, $inc: { followersCount: -1 } }
        ),
        User.updateOne(
          { _id: id, following: me },
          { $pull: { following: me }, $inc: { followingCount: -1 } }
        ),
        User.updateOne(
          { _id: me, followers: id },
          { $pull: { followers: id }, $inc: { followersCount: -1 } }
        ),
        mongoose.models.Follow
          ? mongoose.models.Follow.deleteMany({
              $or: [
                { followerId: me, followingId: id },
                { followerId: id, followingId: me },
              ],
            })
          : null,
      ]).catch(() => {});

      return res.json({
        ok: true,
        message: "Blocked. You won't see each other on SkyHub.",
      });
    } catch (err) {
      console.error("[skyhub] block error:", err);
      return res.status(500).json({ message: "Failed to block traveler." });
    }
  }
);

router.delete("/users/:id/block", requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id))
      return res.status(400).json({ message: "Invalid traveler." });
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
      SkyHubPost.distinct("destination", visible).then((d) =>
        d.filter(Boolean)
      ),
      SkyHubPost.distinct("author", visible).then((a) => a.filter(Boolean)),
    ]);
    return res.json({
      travelers: authors.length,
      posts,
      countries: destinations.length,
    });
  } catch (err) {
    console.error("[skyhub] stats error:", err);
    return res.status(500).json({ message: "Failed to load stats." });
  }
});

/* ─────────────────────────────────────────────────────────────
   Your account standing — strikes, any pause, and appeals
───────────────────────────────────────────────────────────── */
router.get("/me/standing", requireViewer, async (req, res) => {
  try {
    return res.json({ ok: true, ...(await standingFor(req.skyUser.id)) });
  } catch (err) {
    console.error("[skyhub] standing error:", err);
    return res
      .status(500)
      .json({ message: "Couldn't load your account standing." });
  }
});

// POST /api/skyhub/strikes/:id/appeal  { message }
router.post(
  "/strikes/:id/appeal",
  requireViewer,
  rateLimit("report"),
  async (req, res) => {
    try {
      if (!validId(req.params.id))
        return res.status(400).json({ message: "Invalid strike." });
      const message = cleanText(req.body?.message, 1000);
      if (message.length < 10)
        return res
          .status(400)
          .json({ message: "Tell us a bit more about why we got it wrong." });
      const strike = await SkyHubStrike.findOne({
        _id: req.params.id,
        user: req.skyUser.id,
      });
      if (!strike)
        return res.status(404).json({ message: "Strike not found." });
      if (strike.voided)
        return res
          .status(409)
          .json({ message: "This strike was already removed." });
      if (strike.appeal?.status !== "none")
        return res
          .status(409)
          .json({ message: "You've already appealed this strike." });
      const windowMs = STRIKE_POLICY.appealWindowDays * 24 * 60 * 60 * 1000;
      if (Date.now() - strike.createdAt.getTime() > windowMs) {
        return res.status(409).json({
          message: `Appeals are accepted within ${STRIKE_POLICY.appealWindowDays} days.`,
        });
      }
      strike.appeal = { status: "pending", message, at: new Date() };
      await strike.save();
      sendReportAlert({
        targetType: "user",
        reason: strike.reason,
        count: 1,
        autoHidden: false,
        snippet: `APPEAL from @${req.skyUser.username}: ${message}`,
        authorName: req.skyUser.name,
        authorUsername: req.skyUser.username,
      }).catch(() => {});
      return res.json({
        ok: true,
        message: "Appeal sent. We'll email you when we've reviewed it.",
      });
    } catch (err) {
      console.error("[skyhub] appeal error:", err);
      return res.status(500).json({ message: "Couldn't send your appeal." });
    }
  }
);

/* ═════════════════════════════════════════════════════════════
   ADMIN — moderation queue (admin dashboard login or admin account)
═════════════════════════════════════════════════════════════ */

// GET /api/skyhub/admin/reports?status=open|dismissed|actioned
// Grouped: one row per reported thing, with every reason and reporter count.
router.get("/admin/reports", adminOnly, async (req, res) => {
  try {
    const status = ["open", "dismissed", "actioned"].includes(req.query.status)
      ? req.query.status
      : "open";
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
          severity: "standard",
          dueBy: null,
        });
      }
      const g = groups.get(key);
      const sev = r.severity || severityOf(r.reason);
      if (severityRank(sev) < severityRank(g.severity)) g.severity = sev;
      if (r.dueBy && (!g.dueBy || r.dueBy < g.dueBy)) g.dueBy = r.dueBy;
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
    const postIds = list
      .filter((g) => g.targetType === "post")
      .map((g) => g.targetId);
    const commentIds = list
      .filter((g) => g.targetType === "comment")
      .map((g) => g.targetId);
    const [posts, comments, suspended] = await Promise.all([
      SkyHubPost.find({ _id: { $in: postIds } })
        .select("text images destination type hidden hiddenReason createdAt")
        .lean(),
      SkyHubComment.find({ _id: { $in: commentIds } })
        .select("text post hidden hiddenReason createdAt")
        .lean(),
      SkyHubRestriction.find({
        user: { $in: list.map((g) => g.targetUser?.id).filter(Boolean) },
      }).lean(),
    ]);
    const userIds = [
      ...new Set(list.map((g) => g.targetUser?.id).filter(Boolean)),
    ];
    const strikeRows = userIds.length
      ? await SkyHubStrike.aggregate([
          {
            $match: {
              user: { $in: userIds.map((u) => new mongoose.Types.ObjectId(u)) },
              voided: { $ne: true },
              expiresAt: { $gt: new Date() },
            },
          },
          { $group: { _id: "$user", n: { $sum: 1 } } },
        ])
      : [];
    const strikesByUser = new Map(strikeRows.map((r) => [String(r._id), r.n]));
    const pById = new Map(posts.map((p) => [String(p._id), p]));
    const cById = new Map(comments.map((c) => [String(c._id), c]));
    const sByUser = new Map(suspended.map((s) => [String(s.user), s]));
    for (const g of list) {
      const c =
        g.targetType === "post"
          ? pById.get(g.targetId)
          : g.targetType === "comment"
          ? cById.get(g.targetId)
          : null;
      g.content = c
        ? {
            text: c.text,
            images: c.images || [],
            destination: c.destination || null,
            hidden: Boolean(c.hidden),
            hiddenReason: c.hiddenReason || null,
            postId: c.post
              ? String(c.post)
              : g.targetType === "post"
              ? g.targetId
              : null,
          }
        : g.targetType === "user"
        ? null
        : { deleted: true };
      g.count = g.reports.length;
      const s = g.targetUser ? sByUser.get(g.targetUser.id) : null;
      g.suspendedUntil = s ? s.until || "indefinite" : null;
      g.activeStrikes = g.targetUser
        ? strikesByUser.get(g.targetUser.id) || 0
        : 0;
      // Most-reported reason — the admin page pre-selects it for a strike.
      g.topReason =
        Object.entries(g.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "other";
      g.suggestSevere = STRIKE_POLICY.severeReasons.includes(g.topReason);
      // What a strike would do to this person right now (days: 0 warning, null ban).
      g.next = {
        standard: decide(g.activeStrikes, "standard"),
        severe: decide(g.activeStrikes, "severe"),
      };
      g.overdue = Boolean(g.dueBy && new Date(g.dueBy) < new Date());
      // The admin page should blur photos for these instead of showing them.
      g.blurMedia = g.severity === "critical";
      if (g.reasons.child_safety) g.childSafety = true;
    }
    // Critical first, then the nearest legal deadline, then most reported.
    list.sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        (a.dueBy ? new Date(a.dueBy).getTime() : Infinity) -
          (b.dueBy ? new Date(b.dueBy).getTime() : Infinity) ||
        b.count - a.count ||
        new Date(b.lastAt) - new Date(a.lastAt)
    );
    return res.json({ ok: true, items: list });
  } catch (err) {
    console.error("[skyhub/admin] reports error:", err);
    return res.status(500).json({ message: "Failed to load reports." });
  }
});

// GET /api/skyhub/admin/open-count — for the admin dashboard badge
router.get("/admin/open-count", adminOnly, async (_req, res) => {
  const ids = await SkyHubReport.distinct("targetId", { status: "open" }).catch(
    () => []
  );
  res.json({ ok: true, count: ids.length });
});

/* POST /api/skyhub/admin/resolve
   Body: {
     targetType, targetId,
     action: "dismiss"   — nothing wrong; restore it if it was auto-hidden
           | "remove"    — take the content down, no strike
           | "strike"    — take it down + strike (follows the warning → ban ladder)
           | "severe"    — take it down + severe strike (skips the warning)
           | "ban"       — take it down + permanent SkyHub ban
           | "restore"   — put removed content back
     reason?  (strike reason; defaults to the most-reported one)
     note?    (shown to the traveler in their strike notice)
   }
   Applies to every open report on that thing. */
router.post("/admin/resolve", adminOnly, async (req, res) => {
  try {
    const { targetType, targetId } = req.body || {};
    let action = req.body?.action;
    if (action === "suspend") action = "strike"; // older admin page
    if (
      !["post", "comment", "user"].includes(targetType) ||
      !validId(targetId)
    ) {
      return res.status(400).json({ message: "Pick a reported item." });
    }
    if (
      !["dismiss", "remove", "strike", "severe", "ban", "restore"].includes(
        action
      )
    ) {
      return res.status(400).json({ message: "Unknown action." });
    }
    const by = adminName(req);
    const Model =
      targetType === "post"
        ? SkyHubPost
        : targetType === "comment"
        ? SkyHubComment
        : null;
    const takeDown = ["remove", "strike", "severe", "ban"].includes(action);

    let targetUser = targetType === "user" ? targetId : null;
    let snippet = "";
    if (Model) {
      const doc = await Model.findById(targetId).select(
        "author post text hidden hiddenReason"
      );
      targetUser = doc?.author || null;
      snippet = doc?.text || "";
      if (action === "dismiss" || action === "restore") {
        const wasRemoved = doc?.hidden;
        await Model.updateOne(
          { _id: targetId },
          { $set: { hidden: false, hiddenReason: null } }
        );
        if (
          targetType === "comment" &&
          doc?.post &&
          wasRemoved &&
          doc.hiddenReason === "removed"
        ) {
          await SkyHubPost.updateOne(
            { _id: doc.post },
            { $inc: { commentsCount: 1 } }
          );
        }
        // Tell the author it's back.
        if (doc?.author && wasRemoved) {
          notifyUser(
            doc.author,
            `Your SkyHub ${targetType} is back`,
            "We reviewed it and it doesn't break the community guidelines. It's visible again."
          );
        }
      } else if (takeDown && doc) {
        const alreadyRemoved = doc.hidden && doc.hiddenReason === "removed";
        // Removed without a strike: still tell the author which guideline it broke.
        // (Strikes send their own notice. Child safety: no notice.)
        if (action === "remove" && doc.author && !alreadyRemoved) {
          const open = await SkyHubReport.find({
            targetType,
            targetId,
            status: "open",
          })
            .select("reason")
            .lean();
          const top = open.map((r) => r.reason)[0] || "other";
          if (top !== "child_safety") {
            notifyUser(
              doc.author,
              `We removed your SkyHub ${targetType}`,
              `It broke the community guidelines (${reasonLabel(
                top
              ).toLowerCase()}). This isn't a strike on your account.`
            );
          }
        }
        await Model.updateOne(
          { _id: targetId },
          {
            $set: {
              hidden: true,
              hiddenReason: "removed",
              ...(targetType === "post" ? { hiddenAt: new Date() } : {}),
            },
          }
        );
        if (targetType === "comment" && doc.post && !alreadyRemoved) {
          await SkyHubPost.updateOne(
            { _id: doc.post, commentsCount: { $gt: 0 } },
            { $inc: { commentsCount: -1 } }
          );
        }
      }
    }

    // Strike (warning → pause → ban), following STRIKE_POLICY.
    let strikeResult = null;
    if (["strike", "severe", "ban"].includes(action)) {
      if (!targetUser)
        return res
          .status(400)
          .json({ message: "This content has no account to strike." });
      const open = await SkyHubReport.find({
        targetType,
        targetId,
        status: "open",
      })
        .select("reason")
        .lean();
      const counts = open.reduce(
        (m, r) => ((m[r.reason] = (m[r.reason] || 0) + 1), m),
        {}
      );
      const topReason =
        Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] || "other";
      const reason = REPORT_REASONS.includes(req.body?.reason)
        ? req.body.reason
        : topReason;
      strikeResult = await issueStrike({
        userId: targetUser,
        reason,
        severity: action === "severe" ? "severe" : "standard",
        targetType,
        targetId: targetType === "user" ? null : targetId,
        snippet,
        note: cleanText(req.body?.note, 500),
        by,
        forceBan: action === "ban",
      });
    }

    const resolution = {
      dismiss: "dismissed",
      restore: "restored",
      remove: "removed",
      strike: "strike",
      severe: "severe strike",
      ban: "banned",
    }[action];
    await SkyHubReport.updateMany(
      { targetType, targetId, status: "open" },
      {
        $set: {
          status:
            action === "dismiss" || action === "restore"
              ? "dismissed"
              : "actioned",
          resolution: strikeResult
            ? `${resolution} (${strikeResult.action}${
                strikeResult.days ? ` ${strikeResult.days}d` : ""
              })`
            : resolution,
          resolvedBy: by,
          resolvedAt: new Date(),
        },
      }
    );
    return res.json({
      ok: true,
      resolution,
      strike: strikeResult
        ? {
            action: strikeResult.action,
            days: strikeResult.days,
            strikeNumber: strikeResult.strikeNumber,
            until: strikeResult.until,
          }
        : null,
    });
  } catch (err) {
    console.error("[skyhub/admin] resolve error:", err);
    return res.status(500).json({ message: "Couldn't apply that action." });
  }
});

// GET /api/skyhub/admin/users/:id/history — a traveler's strikes and reports
router.get("/admin/users/:id/history", adminOnly, async (req, res) => {
  try {
    if (!validId(req.params.id))
      return res.status(400).json({ message: "Invalid traveler." });
    const [standing, reports, user] = await Promise.all([
      standingFor(req.params.id),
      SkyHubReport.countDocuments({ targetUser: req.params.id }),
      User.findById(req.params.id)
        .select("name username email createdAt")
        .lean(),
    ]);
    return res.json({ ok: true, user, reportsAgainst: reports, ...standing });
  } catch (err) {
    console.error("[skyhub/admin] history error:", err);
    return res.status(500).json({ message: "Couldn't load history." });
  }
});

// GET /api/skyhub/admin/appeals?status=pending|approved|denied
router.get("/admin/appeals", adminOnly, async (req, res) => {
  const status = ["pending", "approved", "denied"].includes(req.query.status)
    ? req.query.status
    : "pending";
  const rows = await SkyHubStrike.find({ "appeal.status": status })
    .sort({ "appeal.at": -1 })
    .limit(200)
    .populate("user", "name username email")
    .lean();
  res.json({
    ok: true,
    appeals: rows.map((s) => ({
      id: String(s._id),
      user: s.user
        ? {
            id: String(s.user._id),
            name: s.user.name || s.user.username,
            username: s.user.username,
          }
        : null,
      reason: s.reason,
      severity: s.severity,
      action: s.action,
      suspensionDays: s.suspensionDays,
      snippet: s.snippet,
      note: s.note,
      strikeAt: s.createdAt,
      by: s.by,
      appeal: s.appeal,
    })),
  });
});

// POST /api/skyhub/admin/appeals/:id  { approve: true|false, response }
router.post("/admin/appeals/:id", adminOnly, async (req, res) => {
  if (!validId(req.params.id))
    return res.status(400).json({ message: "Invalid appeal." });
  const out = await resolveAppeal({
    strikeId: req.params.id,
    approve: req.body?.approve === true,
    response: cleanText(req.body?.response, 1000),
    by: adminName(req),
  });
  if (!out.ok) return res.status(409).json({ message: out.error });
  res.json({ ok: true });
});

// GET /api/skyhub/admin/open-counts — reports + appeals waiting (dashboard badge)
router.get("/admin/open-counts", adminOnly, async (_req, res) => {
  const [ids, appeals, critical, takedowns, overdue] = await Promise.all([
    SkyHubReport.distinct("targetId", { status: "open" }).catch(() => []),
    SkyHubStrike.countDocuments({ "appeal.status": "pending" }).catch(() => 0),
    SkyHubReport.distinct("targetId", {
      status: "open",
      severity: "critical",
    }).catch(() => []),
    SkyHubTakedown.countDocuments({ status: "received" }).catch(() => 0),
    SkyHubTakedown.countDocuments({
      status: "received",
      dueBy: { $lt: new Date() },
    }).catch(() => 0),
  ]);
  res.json({
    ok: true,
    reports: ids.length,
    appeals,
    critical: critical.length,
    takedowns,
    overdueTakedowns: overdue,
  });
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
  if (!validId(req.params.userId))
    return res.status(400).json({ message: "Invalid traveler." });
  await SkyHubRestriction.deleteOne({ user: req.params.userId });
  res.json({ ok: true });
});

/* ═════════════════════════════════════════════════════════════
   FORMAL REMOVAL REQUESTS — no Skyrio account needed
   POST /api/skyhub/takedown
   kind "intimate"  (TAKE IT DOWN Act) — hidden right away, 48-hour clock
   kind "copyright" (DMCA §512(c))      — reviewed by the team
═════════════════════════════════════════════════════════════ */
router.post("/takedown", rateLimit("report"), async (req, res) => {
  try {
    const b = req.body || {};
    const kind = b.kind === "copyright" ? "copyright" : "intimate";
    const name = cleanText(b.name, 120);
    const email = cleanText(b.email, 200).toLowerCase();
    const signature = cleanText(b.signature, 120);
    const contentLinks = cleanText(b.contentLinks, 2000);
    const description = cleanText(b.description, 2000);

    // What the law requires a request to include.
    const missing = [];
    if (!name) missing.push("your name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      missing.push("a valid email");
    if (!contentLinks && !description) missing.push("where the content is");
    if (!signature) missing.push("your signature (type your full name)");
    if (!b.goodFaith) missing.push("the good-faith statement");
    if (kind === "copyright") {
      if (!cleanText(b.copyrightedWork, 1000)) missing.push("the work you own");
      if (!b.accuracyUnderPenalty) missing.push("the accuracy statement");
    }
    if (missing.length)
      return res
        .status(400)
        .json({ message: `Please add ${missing.join(", ")}.` });

    const posts = postIdsFrom(`${contentLinks} ${description}`);
    const doc = await SkyHubTakedown.create({
      ticket: newTicket(),
      kind,
      requesterName: name,
      requesterEmail: email,
      requesterUser: req.skyUser?.id || null,
      relationship: ["self", "authorized", "owner", "agent"].includes(
        b.relationship
      )
        ? b.relationship
        : "self",
      contentLinks,
      posts,
      description,
      copyrightedWork:
        kind === "copyright" ? cleanText(b.copyrightedWork, 1000) : "",
      goodFaith: true,
      accuracyUnderPenalty: Boolean(b.accuracyUnderPenalty),
      signature,
      dueBy:
        kind === "intimate"
          ? new Date(Date.now() + LEGAL.intimateImageHours * HOUR)
          : null,
    });

    // Intimate images: hide now, in good faith, while the team confirms.
    if (kind === "intimate" && posts.length) {
      const r = await hidePostsAndCopies(posts);
      doc.duplicatesRemoved = r.duplicates;
      await doc.save();
    }

    sendReportAlert({
      targetType: "post",
      reason: kind === "intimate" ? "intimate_image" : "other",
      count: 1,
      autoHidden: kind === "intimate" && posts.length > 0,
      snippet: `[${
        kind === "intimate" ? "URGENT TAKE IT DOWN" : "DMCA"
      } REQUEST ${doc.ticket}${
        doc.dueBy ? ` — remove by ${doc.dueBy.toISOString()}` : ""
      }] ${
        posts.length
          ? `${posts.length} post(s) found.`
          : "No post link found — locate manually."
      } ${description.slice(0, 300)}`,
      authorName: name,
      authorUsername: email,
    }).catch(() => {});

    return res.status(201).json({
      ok: true,
      ticket: doc.ticket,
      dueBy: doc.dueBy,
      message:
        kind === "intimate"
          ? `Request ${doc.ticket} received. ${
              posts.length ? "We've hidden the content while we review. " : ""
            }We act on these within 48 hours.`
          : `Request ${doc.ticket} received. We'll review it and update its status.`,
    });
  } catch (err) {
    console.error("[skyhub] takedown error:", err);
    return res
      .status(500)
      .json({ message: "Couldn't send your request. Please try again." });
  }
});

// GET /api/skyhub/takedown/:ticket?email=  — check a request's status
router.get("/takedown/:ticket", rateLimit("report"), async (req, res) => {
  const t = await SkyHubTakedown.findOne({
    ticket: String(req.params.ticket || "").toUpperCase(),
    requesterEmail: String(req.query.email || "").toLowerCase(),
  }).lean();
  if (!t)
    return res
      .status(404)
      .json({ message: "No request matches that number and email." });
  return res.json({
    ok: true,
    ticket: t.ticket,
    kind: t.kind,
    status: t.status,
    receivedAt: t.createdAt,
    dueBy: t.dueBy,
    decisionNote: t.decisionNote,
    resolvedAt: t.resolvedAt,
  });
});

// GET /api/skyhub/me/copyright-removals — your posts removed for copyright
router.get("/me/copyright-removals", requireViewer, async (req, res) => {
  const mine = await SkyHubPost.find({ author: req.skyUser.id })
    .select("_id")
    .lean();
  const rows = await SkyHubTakedown.find({
    kind: "copyright",
    status: "removed",
    posts: { $in: mine.map((p) => p._id) },
  })
    .select("ticket createdAt resolvedAt copyrightedWork counter")
    .lean();
  res.json({
    ok: true,
    removals: rows.map((r) => ({
      ticket: r.ticket,
      removedAt: r.resolvedAt,
      claim: r.copyrightedWork,
      counterSent: Boolean(r.counter),
    })),
  });
});

// POST /api/skyhub/takedown/:ticket/counter — DMCA counter-notice from the poster
router.post(
  "/takedown/:ticket/counter",
  requireViewer,
  rateLimit("report"),
  async (req, res) => {
    try {
      const t = await SkyHubTakedown.findOne({
        ticket: String(req.params.ticket).toUpperCase(),
        kind: "copyright",
      });
      if (!t || t.status !== "removed")
        return res
          .status(404)
          .json({ message: "Nothing to dispute for that request." });
      const owns = await SkyHubPost.exists({
        _id: { $in: t.posts },
        author: req.skyUser.id,
      });
      if (!owns)
        return res
          .status(403)
          .json({ message: "Only the person who posted it can dispute this." });
      if (t.counter)
        return res
          .status(409)
          .json({ message: "You've already sent a counter-notice." });

      const b = req.body || {};
      const c = {
        fullName: cleanText(b.fullName, 120),
        address: cleanText(b.address, 300),
        phone: cleanText(b.phone, 40),
        email: cleanText(b.email, 200),
        statement: cleanText(b.statement, 1500),
        consentsToJurisdiction: Boolean(b.consentsToJurisdiction),
        signature: cleanText(b.signature, 120),
      };
      if (
        !c.fullName ||
        !c.address ||
        !c.phone ||
        !c.statement ||
        !c.signature ||
        !c.consentsToJurisdiction ||
        !b.underPenalty
      ) {
        return res.status(400).json({
          message: "A counter-notice needs every field and both statements.",
        });
      }
      // DMCA: restore in 10–14 business days unless the claimant files suit.
      t.counter = {
        ...c,
        at: new Date(),
        restoreAfter: new Date(Date.now() + 14 * DAY),
      };
      await t.save();
      sendReportAlert({
        targetType: "post",
        reason: "other",
        count: 1,
        autoHidden: false,
        snippet: `[DMCA COUNTER-NOTICE ${t.ticket}] Forward to ${
          t.requesterEmail
        }. Restore after ${t.counter.restoreAfter.toDateString()} unless they've filed suit.`,
        authorName: c.fullName,
        authorUsername: req.skyUser.username,
      }).catch(() => {});
      res.json({
        ok: true,
        message:
          "Counter-notice sent. If the claimant doesn't take legal action, your post comes back in about 2 weeks.",
      });
    } catch (err) {
      console.error("[skyhub] counter-notice error:", err);
      res.status(500).json({ message: "Couldn't send your counter-notice." });
    }
  }
);

/* ── Admin: removal requests ───────────────────────────────── */
// GET /api/skyhub/admin/takedowns?status=received|removed|rejected|restored
router.get("/admin/takedowns", adminOnly, async (req, res) => {
  const status = ["received", "removed", "rejected", "restored"].includes(
    req.query.status
  )
    ? req.query.status
    : "received";
  const rows = await SkyHubTakedown.find({ status })
    .sort({ dueBy: 1, createdAt: 1 })
    .limit(200)
    .lean();
  const now = Date.now();
  res.json({
    ok: true,
    takedowns: rows.map((t) => ({
      ...t,
      id: String(t._id),
      hoursLeft: t.dueBy
        ? Math.round((new Date(t.dueBy).getTime() - now) / HOUR)
        : null,
      overdue: Boolean(
        t.dueBy && new Date(t.dueBy).getTime() < now && t.status === "received"
      ),
    })),
  });
});

// POST /api/skyhub/admin/takedowns/:id  { action: "remove"|"reject"|"restore", note, posts? }
router.post("/admin/takedowns/:id", adminOnly, async (req, res) => {
  try {
    if (!validId(req.params.id))
      return res.status(400).json({ message: "Invalid request." });
    const t = await SkyHubTakedown.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Request not found." });
    const action = req.body?.action;
    const note = cleanText(req.body?.note, 1000);
    // Admin can attach the posts they located by hand.
    const extra = postIdsFrom(req.body?.posts);
    if (extra.length)
      t.posts = [...new Set([...t.posts.map(String), ...extra])];

    if (action === "remove") {
      const r = await hidePostsAndCopies(t.posts.map(String), {
        reason: "removed",
      });
      t.status = "removed";
      t.duplicatesRemoved += r.duplicates;
      t.decisionNote = note || "We removed the content you reported.";
      for (const a of new Set((r.authors || []).map(String))) {
        notifyUser(
          a,
          "We removed one of your SkyHub posts",
          t.kind === "copyright"
            ? `We received a copyright complaint (${t.ticket}) about it. If you believe it was removed by mistake, you can send a counter-notice from your account standing page.`
            : "It was removed after a removal request under our intimate-image policy."
        );
        // DMCA repeat-infringer policy.
        if (t.kind === "copyright") {
          const mine = await SkyHubPost.find({ author: a })
            .select("_id")
            .lean();
          const upheld = await SkyHubTakedown.countDocuments({
            kind: "copyright",
            status: "removed",
            posts: { $in: mine.map((p) => p._id) },
            _id: { $ne: t._id },
          });
          if (upheld + 1 >= LEGAL.repeatInfringerLimit) {
            await issueStrike({
              userId: a,
              reason: "other",
              severity: "severe",
              note: "Repeated copyright infringement",
              by: adminName(req),
              forceBan: true,
            });
          }
        }
      }
    } else if (action === "reject") {
      // Intimate-image request rejected: put any good-faith hides back.
      if (t.kind === "intimate" && t.posts.length) {
        await SkyHubPost.updateMany(
          { _id: { $in: t.posts }, hiddenReason: "review" },
          { $set: { hidden: false, hiddenReason: null } }
        );
      }
      t.status = "rejected";
      if (!note)
        return res
          .status(400)
          .json({ message: "Add a short reason — the requester will see it." });
      t.decisionNote = note;
    } else if (action === "restore") {
      // After a DMCA counter-notice waiting period.
      await SkyHubPost.updateMany(
        { _id: { $in: t.posts } },
        { $set: { hidden: false, hiddenReason: null } }
      );
      t.status = "restored";
      if (t.counter) t.counter.restored = true;
      t.decisionNote =
        note || "The content was restored after a counter-notice.";
    } else {
      return res.status(400).json({ message: "Unknown action." });
    }
    t.resolvedBy = adminName(req);
    t.resolvedAt = new Date();
    await t.save();
    res.json({ ok: true, status: t.status });
  } catch (err) {
    console.error("[skyhub/admin] takedown resolve error:", err);
    res.status(500).json({ message: "Couldn't update that request." });
  }
});

/* ── Admin: confirmed child sexual abuse material ──────────────
   POST /api/skyhub/admin/child-safety/:postId  { ncmecReportId }
   1. Report it at report.cybertip.org FIRST (required by 18 U.S.C. §2258A).
   2. Then call this: keeps the post as evidence for a year, takes it
      off SkyHub, and permanently bans the account WITHOUT notifying them. */
router.post("/admin/child-safety/:postId", adminOnly, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validId(postId))
      return res.status(400).json({ message: "Invalid post." });
    const ncmecReportId = cleanText(req.body?.ncmecReportId, 60);
    if (!ncmecReportId)
      return res
        .status(400)
        .json({ message: "Add the CyberTipline report number first." });
    const post = await SkyHubPost.findById(postId).select("author");
    if (!post) return res.status(404).json({ message: "Post not found." });

    await hidePostsAndCopies([postId], {
      reason: "removed",
      holdDays: LEGAL.childSafetyHoldDays,
    });
    if (post.author) {
      await SkyHubRestriction.updateOne(
        { user: post.author },
        {
          $set: {
            user: post.author,
            until: null,
            permanent: true,
            reason: "Child safety",
            by: adminName(req),
          },
        },
        { upsert: true }
      );
    }
    await SkyHubReport.updateMany(
      { targetType: "post", targetId: postId, status: "open" },
      {
        $set: {
          status: "actioned",
          resolution: `child safety — NCMEC ${ncmecReportId}`,
          resolvedBy: adminName(req),
          resolvedAt: new Date(),
        },
      }
    );
    console.warn(
      `[skyhub/admin] child-safety action on post ${postId}, NCMEC ${ncmecReportId}, by ${adminName(
        req
      )}`
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[skyhub/admin] child-safety error:", err);
    res.status(500).json({ message: "Couldn't apply that action." });
  }
});

export default router;
