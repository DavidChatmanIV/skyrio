import { Router } from "express";
import mongoose from "mongoose";
import SkyHubPost from "../../models/SkyHubPost.js";
import SkyHubComment from "../../models/SkyHubComment.js";

const router = Router();

function getViewerId(req) {
  return req.user?._id?.toString() || req.user?.id?.toString() || "guest-user";
}

function getViewerName(req) {
  return req.user?.username || req.user?.name || "You";
}

function getViewerAvatar(req) {
  return req.user?.avatar || "YU";
}

function getTimeAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

function mapPost(post, viewerId) {
  return {
    _id: post._id,
    authorName: post.authorName,
    username: post.username,
    avatar: post.avatar,
    verified: post.verified,
    type: post.type,
    destination: post.destination,
    text: post.text,
    image: post.image,
    tags: post.tags || [],
    budget: post.budget,
    helpful: post.helpful,
    likesCount: post.likes?.length || 0,
    savesCount: post.saves?.length || 0,
    commentsCount: post.commentsCount || 0,
    sharesCount: post.sharesCount || 0,
    viewerHasLiked: (post.likes || []).includes(viewerId),
    viewerHasSaved: (post.saves || []).includes(viewerId),
    timeAgo: getTimeAgo(post.createdAt),
  };
}

function mapComment(comment) {
  return {
    _id: comment._id,
    author: comment.authorName,
    username: comment.username,
    avatar: comment.avatar,
    text: comment.text,
    timeAgo: getTimeAgo(comment.createdAt),
  };
}

/**
 * GET /api/skyhub/feed
 */
router.get("/feed", async (req, res) => {
  try {
    const viewerId = getViewerId(req);

    const posts = await SkyHubPost.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      posts: posts.map((post) => mapPost(post, viewerId)),
    });
  } catch (err) {
    console.error("[skyhub] feed error:", err);
    return res.status(500).json({ message: "Failed to load feed." });
  }
});

/**
 * POST /api/skyhub/posts
 */
router.post("/posts", async (req, res) => {
  try {
    const { text, type, destination = "" } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Post text is required." });
    }

    const newPost = await SkyHubPost.create({
      author: req.user?._id || null,
      authorName: getViewerName(req),
      username: req.user?.username || "you",
      avatar: getViewerAvatar(req),
      verified: !!req.user?.verified,
      type: type || "Story",
      destination: destination.trim(),
      text: text.trim(),
      helpful: type === "Travel Tip",
      tags: destination ? ["Travel"] : [],
    });

    return res.status(201).json({
      message: "Post created.",
      post: mapPost(newPost.toObject(), getViewerId(req)),
    });
  } catch (err) {
    console.error("[skyhub] create post error:", err);
    return res.status(500).json({ message: "Failed to create post." });
  }
});

/**
 * POST /api/skyhub/posts/:id/like
 */
router.post("/posts/:id/like", async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await SkyHubPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    const alreadyLiked = post.likes.includes(viewerId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((item) => item !== viewerId);
    } else {
      post.likes.push(viewerId);
    }

    await post.save();

    return res.json({
      liked: !alreadyLiked,
      likesCount: post.likes.length,
    });
  } catch (err) {
    console.error("[skyhub] like error:", err);
    return res.status(500).json({ message: "Failed to update like." });
  }
});

/**
 * POST /api/skyhub/posts/:id/save
 */
router.post("/posts/:id/save", async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await SkyHubPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    const alreadySaved = post.saves.includes(viewerId);

    if (alreadySaved) {
      post.saves = post.saves.filter((item) => item !== viewerId);
    } else {
      post.saves.push(viewerId);
    }

    await post.save();

    return res.json({
      saved: !alreadySaved,
      savesCount: post.saves.length,
    });
  } catch (err) {
    console.error("[skyhub] save error:", err);
    return res.status(500).json({ message: "Failed to update save." });
  }
});

/**
 * GET /api/skyhub/posts/:id/comments
 */
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const comments = await SkyHubComment.find({ post: id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      comments: comments.map(mapComment),
    });
  } catch (err) {
    console.error("[skyhub] get comments error:", err);
    return res.status(500).json({ message: "Failed to load comments." });
  }
});

/**
 * POST /api/skyhub/posts/:id/comments
 */
router.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    if (!text?.trim()) {
      return res.status(400).json({ message: "Comment text is required." });
    }

    const post = await SkyHubPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    await SkyHubComment.create({
      post: post._id,
      author: req.user?._id || null,
      authorName: getViewerName(req),
      username: req.user?.username || "you",
      avatar: getViewerAvatar(req),
      text: text.trim(),
    });

    post.commentsCount += 1;
    await post.save();

    const comments = await SkyHubComment.find({ post: id })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(201).json({
      message: "Comment added.",
      comments: comments.map(mapComment),
      commentCount: post.commentsCount,
    });
  } catch (err) {
    console.error("[skyhub] create comment error:", err);
    return res.status(500).json({ message: "Failed to add comment." });
  }
});

/**
 * POST /api/skyhub/posts/:id/report
 */
router.post("/posts/:id/report", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Reported by user" } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await SkyHubPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    post.reports.push({
      userId: getViewerId(req),
      reason,
      createdAt: new Date(),
    });

    await post.save();

    return res.status(201).json({
      message: "Post reported successfully.",
    });
  } catch (err) {
    console.error("[skyhub] report error:", err);
    return res.status(500).json({ message: "Failed to report post." });
  }
});

export default router;