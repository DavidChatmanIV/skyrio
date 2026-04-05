/**
 * circles.routes.js
 * Skyrio — Circle (group) REST API
 *
 * Mount in app.js:  app.use("/api/circles", require("./routes/circles.routes"));
 */

const express = require("express");
const router = express.Router();

// ─── Middleware stubs ─────────────────────────────────────────────────────────
// Replace these with your real auth + db middleware
const authenticate = (req, res, next) => {
  // e.g. verify JWT, attach req.user
  // const user = verifyToken(req.headers.authorization);
  // if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = { id: "user_demo_001", name: "Demo User" }; // STUB
  next();
};

const db = {
  // Replace each stub with your real DB calls (Mongoose, Prisma, Supabase, etc.)
  circles: {
    findById: async (id) => ({
      id,
      name: "Bali Squad Retreat 🌴",
      destination: "Bali, Indonesia",
      host: "user_host_001",
      joinType: "request", // "open" | "request" | "invite"
      inviteCode: "SKY-BALI-4829",
      members: ["user_host_001"],
      maxMembers: 8,
      xp: 1240,
      tags: ["Beach", "Adventure", "Culture"],
      createdAt: new Date(),
    }),
    findAll: async (filters) => [],
    create: async (data) => ({ id: `circle_${Date.now()}`, ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async (id) => ({ deleted: true }),
  },
  joinRequests: {
    findByCircle: async (circleId) => [],
    findPending: async (circleId) => [],
    create: async (data) => ({
      id: `req_${Date.now()}`,
      ...data,
      status: "pending",
    }),
    updateStatus: async (requestId, status) => ({ id: requestId, status }),
  },
  members: {
    add: async (circleId, userId, role = "member") => ({
      circleId,
      userId,
      role,
      joinedAt: new Date(),
    }),
    remove: async (circleId, userId) => ({ removed: true }),
    list: async (circleId) => [],
  },
  posts: {
    findByCircle: async (circleId, page, limit) => ({ posts: [], total: 0 }),
    create: async (data) => ({ id: `post_${Date.now()}`, ...data }),
  },
  invites: {
    generate: async (circleId, createdBy) => ({
      code: `SKY-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      circleId,
      createdBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }),
    validate: async (code) => ({
      valid: code === "SKY-BALI-4829",
      circleId: "circle_001",
    }),
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ═════════════════════════════════════════════════════════════════════════════
// CIRCLE CRUD
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/circles
 * List all circles (optionally filter by userId, public, tags)
 */
router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { userId, joinType, tag, page = 1, limit = 20 } = req.query;
    const circles = await db.circles.findAll({
      userId,
      joinType,
      tag,
      page,
      limit,
    });
    res.json({ success: true, data: circles });
  })
);

/**
 * POST /api/circles
 * Create a new circle
 * Body: { name, destination, dates, maxMembers, joinType, tags, coverGradient }
 */
router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      name,
      destination,
      dates,
      maxMembers = 8,
      joinType = "request",
      tags = [],
      coverGradient,
    } = req.body;
    if (!name || !destination) {
      return res
        .status(400)
        .json({ error: "name and destination are required" });
    }
    const circle = await db.circles.create({
      name,
      destination,
      dates,
      maxMembers,
      joinType,
      tags,
      coverGradient,
      host: req.user.id,
      members: [req.user.id],
      xp: 0,
      createdAt: new Date(),
    });
    res.status(201).json({ success: true, data: circle });
  })
);

/**
 * GET /api/circles/:circleId
 * Get a single circle by ID
 */
router.get(
  "/:circleId",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    res.json({ success: true, data: circle });
  })
);

/**
 * PATCH /api/circles/:circleId
 * Update circle metadata (host only)
 */
router.patch(
  "/:circleId",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    if (circle.host !== req.user.id)
      return res
        .status(403)
        .json({ error: "Only the host can update this circle" });

    const allowed = [
      "name",
      "destination",
      "dates",
      "maxMembers",
      "joinType",
      "tags",
      "coverGradient",
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const updated = await db.circles.update(req.params.circleId, updates);
    res.json({ success: true, data: updated });
  })
);

/**
 * DELETE /api/circles/:circleId
 * Delete a circle (host only)
 */
router.delete(
  "/:circleId",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    if (circle.host !== req.user.id)
      return res
        .status(403)
        .json({ error: "Only the host can delete this circle" });
    await db.circles.delete(req.params.circleId);
    res.json({ success: true, message: "Circle deleted" });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// JOIN FLOW — all three methods
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/circles/:circleId/join
 * Universal join endpoint — handles all three join types
 *
 * Body:
 *   { type: "open" }
 *   { type: "invite", code: "SKY-XXXX-XXXX" }
 *   { type: "request", message: "Hey I'd love to join..." }
 */
router.post(
  "/:circleId/join",
  authenticate,
  asyncHandler(async (req, res) => {
    const { circleId } = req.params;
    const { type, code, message } = req.body;
    const userId = req.user.id;

    const circle = await db.circles.findById(circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });

    // Capacity check
    if (circle.members.length >= circle.maxMembers) {
      return res.status(409).json({ error: "This circle is full" });
    }

    // Already a member?
    if (circle.members.includes(userId)) {
      return res
        .status(409)
        .json({ error: "You are already a member of this circle" });
    }

    // ── Open join ──
    if (type === "open") {
      if (circle.joinType !== "open") {
        return res
          .status(403)
          .json({ error: "This circle does not allow open joining" });
      }
      const membership = await db.members.add(circleId, userId);
      return res.status(200).json({
        success: true,
        joined: true,
        membership,
        message: `Welcome to ${circle.name}!`,
      });
    }

    // ── Invite code ──
    if (type === "invite") {
      if (!code)
        return res.status(400).json({ error: "Invite code is required" });
      const invite = await db.invites.validate(code);
      if (!invite.valid || invite.circleId !== circleId) {
        return res
          .status(403)
          .json({ error: "Invalid or expired invite code" });
      }
      const membership = await db.members.add(circleId, userId);
      return res.status(200).json({
        success: true,
        joined: true,
        membership,
        message: `Invite code verified. Welcome to ${circle.name}!`,
      });
    }

    // ── Request to join ──
    if (type === "request") {
      const joinRequest = await db.joinRequests.create({
        circleId,
        userId,
        message: message || "",
        status: "pending",
        createdAt: new Date(),
      });
      // TODO: emit notification to host (websocket / push)
      return res.status(201).json({
        success: true,
        joined: false,
        pending: true,
        requestId: joinRequest.id,
        message: "Your request has been sent. The host will review it shortly.",
      });
    }

    return res
      .status(400)
      .json({ error: "Invalid join type. Use: open | invite | request" });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// JOIN REQUESTS (host management)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/circles/:circleId/requests
 * List all pending join requests (host only)
 */
router.get(
  "/:circleId/requests",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    if (circle.host !== req.user.id)
      return res.status(403).json({ error: "Only the host can view requests" });

    const requests = await db.joinRequests.findPending(req.params.circleId);
    res.json({ success: true, data: requests });
  })
);

/**
 * PATCH /api/circles/:circleId/requests/:requestId
 * Approve or decline a join request (host only)
 * Body: { action: "approve" | "decline" }
 */
router.patch(
  "/:circleId/requests/:requestId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { circleId, requestId } = req.params;
    const { action } = req.body;
    if (!["approve", "decline"].includes(action)) {
      return res
        .status(400)
        .json({ error: 'action must be "approve" or "decline"' });
    }

    const circle = await db.circles.findById(circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    if (circle.host !== req.user.id)
      return res
        .status(403)
        .json({ error: "Only the host can manage requests" });

    const updated = await db.joinRequests.updateStatus(
      requestId,
      action === "approve" ? "approved" : "declined"
    );

    if (action === "approve") {
      // TODO: get userId from the request record and add to members
      // await db.members.add(circleId, request.userId);
    }

    // TODO: notify the requesting user
    res.json({
      success: true,
      data: updated,
      message:
        action === "approve" ? "Member added to circle" : "Request declined",
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// INVITE CODE GENERATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/circles/:circleId/invite
 * Generate a new invite code (host or existing member)
 */
router.post(
  "/:circleId/invite",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    if (!circle.members.includes(req.user.id) && circle.host !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Only circle members can generate invite codes" });
    }
    const invite = await db.invites.generate(req.params.circleId, req.user.id);
    res.status(201).json({ success: true, data: invite });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// MEMBERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/circles/:circleId/members
 * List all members
 */
router.get(
  "/:circleId/members",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    const members = await db.members.list(req.params.circleId);
    res.json({ success: true, data: members });
  })
);

/**
 * DELETE /api/circles/:circleId/members/:userId
 * Remove a member (host can remove anyone; member can remove themselves)
 */
router.delete(
  "/:circleId/members/:userId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { circleId, userId } = req.params;
    const circle = await db.circles.findById(circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });

    const isSelf = req.user.id === userId;
    const isHost = circle.host === req.user.id;
    if (!isSelf && !isHost) {
      return res
        .status(403)
        .json({ error: "Not authorized to remove this member" });
    }
    if (circle.host === userId) {
      return res
        .status(400)
        .json({ error: "Host cannot be removed. Transfer ownership first." });
    }

    await db.members.remove(circleId, userId);
    res.json({
      success: true,
      message: isSelf ? "You left the circle" : "Member removed",
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// CIRCLE POSTS (SkyHub feed source)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/circles/:circleId/posts
 * Get posts for this circle (paginated)
 */
router.get(
  "/:circleId/posts",
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await db.posts.findByCircle(
      req.params.circleId,
      page,
      limit
    );
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/circles/:circleId/posts
 * Create a post in this circle
 * Body: { content, mediaUrls, location, type }
 * type: "story" | "idea" | "booking" | "checkin"
 */
router.post(
  "/:circleId/posts",
  authenticate,
  asyncHandler(async (req, res) => {
    const circle = await db.circles.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ error: "Circle not found" });
    if (!circle.members.includes(req.user.id) && circle.host !== req.user.id) {
      return res.status(403).json({ error: "Only circle members can post" });
    }

    const { content, mediaUrls = [], location, type = "story" } = req.body;
    if (!content && mediaUrls.length === 0) {
      return res.status(400).json({ error: "Post must have content or media" });
    }

    const post = await db.posts.create({
      circleId: req.params.circleId,
      authorId: req.user.id,
      content,
      mediaUrls,
      location,
      type,
      likes: 0,
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, data: post });
  })
);

// ─── Global error handler for this router ────────────────────────────────────
router.use((err, req, res, next) => {
  console.error("[circles.routes]", err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

module.exports = router;