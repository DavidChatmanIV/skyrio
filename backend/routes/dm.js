import { Router } from "express";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";

const router = Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true, route: "dm" });
});

router.get("/mine", async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const convos = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .select("_id participants isGroup title lastMessage updatedAt")
      .lean();

    if (!convos.length) return res.json([]);

    const convoIds = convos.map((c) => c._id);

    const latestByConvo = await Message.aggregate([
      { $match: { conversationId: { $in: convoIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          messageId: { $first: "$_id" },
          text: { $first: "$text" },
          sender: { $first: "$sender" },
          createdAt: { $first: "$createdAt" },
        },
      },
    ]);

    const latestMap = new Map(latestByConvo.map((m) => [String(m._id), m]));

    const data = convos.map((c) => {
      const latest = latestMap.get(String(c._id)) || null;
      const partnerId = !c.isGroup
        ? c.participants.find((p) => String(p) !== String(userId))
        : null;

      return {
        ...c,
        partnerId,
        last: latest
          ? {
              _id: latest.messageId,
              text: latest.text,
              sender: latest.sender,
              createdAt: latest.createdAt,
            }
          : null,
      };
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
