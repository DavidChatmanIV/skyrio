import { Router } from "express";
import authRequired from "../../middleware/authRequired.js";

const router = Router();

/**
 * GET /api/skyhub
 * Starter feed payload for SkyHub page
 */
router.get("/", authRequired, async (req, res) => {
  try {
    return res.json({
      ok: true,
      message: "SkyHub route is live",
      user: {
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        xp: req.user.xp,
        role: req.user.role,
      },
      trending: [
        { tag: "beach", posts: 12 },
        { tag: "budgettravel", posts: 9 },
        { tag: "hiddenGems", posts: 6 },
      ],
      posts: [],
    });
  } catch (err) {
    console.error("[skyhub.routes] GET / error:", err);
    return res.status(500).json({ error: "Failed to load SkyHub" });
  }
});

/**
 * GET /api/skyhub/trending
 */
router.get("/trending", async (_req, res) => {
  try {
    return res.json({
      ok: true,
      trending: [
        { tag: "beach", posts: 12 },
        { tag: "budgettravel", posts: 9 },
        { tag: "hiddenGems", posts: 6 },
        { tag: "familyTrips", posts: 4 },
      ],
    });
  } catch (err) {
    console.error("[skyhub.routes] GET /trending error:", err);
    return res.status(500).json({ error: "Failed to load trending tags" });
  }
});

/**
 * POST /api/skyhub/post
 * Starter post endpoint
 */
router.post("/post", authRequired, async (req, res) => {
  try {
    const { text = "", image = "", tags = [] } = req.body || {};

    if (!String(text).trim() && !image) {
      return res.status(400).json({
        error: "Post text or image is required",
      });
    }

    const newPost = {
      id: Date.now().toString(),
      author: {
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
      },
      text: String(text).trim(),
      image: String(image || "").trim(),
      tags: Array.isArray(tags) ? tags : [],
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json({
      ok: true,
      post: newPost,
    });
  } catch (err) {
    console.error("[skyhub.routes] POST /post error:", err);
    return res.status(500).json({ error: "Failed to create post" });
  }
});

/**
 * GET /api/skyhub/health
 */
router.get("/health", (_req, res) => {
  return res.json({ ok: true, route: "skyhub" });
});

export default router;