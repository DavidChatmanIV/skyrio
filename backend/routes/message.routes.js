import { Router } from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";

// 👇 match actual lowercase filenames
import Message from "../models/message.js";
import Conversation from "../models/conversation.js";

const router = Router();

// Toggle mock responses with USE_MOCKS=true
const USE_MOCKS =
  String(process.env.USE_MOCKS || "")
    .toLowerCase()
    .trim() === "true";

// Helpers
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /conversations/:userId
 * Return conversations for a user (sorted by last update)
 * NOTE: If mounted at:
 *   - /api/dm      → GET /api/dm/conversations/:userId
 *   - /api/message → GET /api/message/conversations/:userId
 */
router.get("/conversations/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (USE_MOCKS) {
      return res.json([
        {
          _id: "mock-convo-1",
          participants: [
            { _id: userId, username: "you" },
            { _id: "u2", username: "Questy" },
          ],
          lastMessage: "Welcome to Skyrio messages",
          updatedAt: new Date(),
        },
      ]);
    }

    if (!isValidId(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const convos = await Conversation.find({ participants: userId })
      .populate("participants", "username avatar")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(convos);
  } catch (err) {
    console.error("GET /conversations/:userId error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /conversations
 * Create or fetch an existing conversation between the authed user and receiverId
 * body: { receiverId }
 *
 * Mounted:
 *   - /api/dm      → POST /api/dm/conversations
 *   - /api/message → POST /api/message/conversations
 */
router.post("/conversations", auth, async (req, res) => {
  try {
    const { receiverId } = req.body || {};
    const me =
      req.user?._id || req.user?.id || req.user?.userId || req.user?.sub;

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required" });
    }

    if (USE_MOCKS) {
      return res.status(201).json({
        _id: "mock-convo-created",
        participants: [me, receiverId],
        lastMessage: null,
        updatedAt: new Date(),
      });
    }

    if (!isValidId(receiverId) || !isValidId(me)) {
      return res.status(400).json({ error: "Invalid user id(s)" });
    }

    let convo = await Conversation.findOne({
      participants: { $all: [me, receiverId] },
    });

    if (!convo) {
      convo = await Conversation.create({
        participants: [me, receiverId],
      });
    }

    return res.status(201).json(convo);
  } catch (err) {
    console.error("POST /conversations error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * CORE HANDLER: create message (text and/or image)
 * body: { conversationId, text?, imageUrl?, ...rest }
 * Also emits "dm:newMessage" via Socket.io to the conversation room.
 */
async function handleCreateMessage(req, res) {
  try {
    const { conversationId, text, imageUrl, ...rest } = req.body || {};

    const me =
      req.user?._id || req.user?.id || req.user?.userId || req.user?.sub;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    // Must have at least text or an image
    const hasText = Boolean(String(text || "").trim());
    const hasImage = Boolean(imageUrl);
    if (!hasText && !hasImage) {
      return res.status(400).json({
        error: "Message must have text or an image.",
      });
    }

    // Socket.io instance (set in server.js with app.set("io", io))
    const io = req.app.get("io");

    if (USE_MOCKS) {
      const mockMsg = {
        _id: "mock-msg-1",
        conversationId,
        senderId: me,
        text: hasText ? String(text).trim() : "",
        imageUrl: hasImage ? imageUrl : "",
        createdAt: new Date(),
        ...rest,
      };

      if (io && conversationId) {
        io.to(String(conversationId)).emit("dm:newMessage", mockMsg);
      }

      return res.status(201).json(mockMsg);
    }

    if (!isValidId(conversationId) || !isValidId(me)) {
      return res.status(400).json({ error: "Invalid id(s)" });
    }

    // Ensure conversation exists and user is a participant
    const convo = await Conversation.findById(conversationId).lean();
    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (!convo.participants?.some((p) => String(p) === String(me))) {
      return res
        .status(403)
        .json({ error: "Not a participant in this conversation" });
    }

    const trimmedText = hasText ? String(text).trim() : "";

    const newMessage = await Message.create({
      conversationId,
      senderId: me,
      text: trimmedText,
      imageUrl: hasImage ? imageUrl : "",
      // any extra fields allowed by your schema (e.g., emojiOnly)
      ...rest,
    });

    // Update conversation preview
    const lastMessagePreview =
      trimmedText || (hasImage ? "[Image]" : "[New message]");

    await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          lastMessage: lastMessagePreview,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    // Emit over Socket.io so all clients in this room receive it
    if (io && conversationId) {
      // convert to plain object for safety if needed
      const payload = newMessage.toObject ? newMessage.toObject() : newMessage;
      io.to(String(conversationId)).emit("dm:newMessage", payload);
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("POST /message error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /message
 * Mounted:
 *   - /api/dm/message
 *   - /api/message/message   (if mounted at /api/message)
 *
 * Alias:
 *   - POST /  → /api/message  (for older code that posts directly)
 */
router.post("/message", auth, handleCreateMessage);
router.post("/", auth, handleCreateMessage); // alias for /api/message

/**
 * CORE HANDLER: get messages for a conversation
 * supports optional ?limit=50&cursor=<messageId or ISO date>
 */
async function handleGetMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { limit = 100, cursor } = req.query;
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);

    if (USE_MOCKS) {
      return res.json([
        {
          _id: "m1",
          conversationId,
          text: "Hey!",
          imageUrl: "",
          senderId: "u2",
          createdAt: new Date(Date.now() - 60000),
        },
        {
          _id: "m2",
          conversationId,
          text: "Welcome to Skyrio",
          imageUrl: "",
          senderId: "u2",
          createdAt: new Date(),
        },
      ]);
    }

    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversationId" });
    }

    const query = { conversationId };
    if (cursor) {
      // Support cursor as ISO date or message _id
      if (isValidId(cursor)) {
        query._id = { $gt: cursor };
      } else {
        const dt = new Date(cursor);
        if (!isNaN(dt)) query.createdAt = { $gt: dt };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(pageSize)
      .populate("senderId", "username avatar")
      .lean();

    return res.json(messages);
  } catch (err) {
    console.error("GET /messages/:conversationId error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /messages/:conversationId
 * Mounted:
 *   - /api/dm/messages/:conversationId
 *   - /api/message/messages/:conversationId
 *
 * Alias:
 *   - GET /:conversationId   → used by older code like /api/message/:conversationId
 */
router.get("/messages/:conversationId", auth, handleGetMessages);
router.get("/:conversationId", auth, handleGetMessages); // alias

export default router;