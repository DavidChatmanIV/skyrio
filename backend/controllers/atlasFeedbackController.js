// backend/controllers/atlasFeedbackController.js
// Thumbs up/down on Atlas replies, plus an insights view for you (the founder).
import mongoose from "mongoose";
import AtlasFeedback, { FEEDBACK_REASONS } from "../models/AtlasFeedback.js";
import AtlasBookingProposal from "../models/AtlasBookingProposal.js";
import { learnFromFeedback } from "../services/atlas/atlasLearning.js";
import { awardXP } from "../services/xpService.js"; // awardXP({ userId, ruleKey, sourceId, ... })

// Feedback XP is small on purpose: booking a trip must always earn more.
// The ATLAS_FEEDBACK rule in config/xpRules.js (5 XP, 3/day, counts toward
// ENGAGEMENT_CAPS) and xpService's ledger do the real enforcement. The checks
// here are a backup: 1 XP-earning rating per conversation, 3 per day, and
// changing a rating never pays twice.
const FEEDBACK_XP = 5;
const MAX_XP_FEEDBACK_PER_DAY = 3;

// POST /api/atlas/feedback
// { conversationId, messageId, rating: "up"|"down", reasons?: [], comment?, atlasReply?, toolsUsed? }
export async function submitFeedback(req, res) {
  const body = req.body ?? {};
  const { rating, comment, atlasReply } = body;
  const conversationId = String(body.conversationId || "").slice(0, 80);
  const messageId = String(body.messageId || "").slice(0, 80);
  // Arrays only — a bad payload must never crash the request.
  const reasons = Array.isArray(body.reasons) ? body.reasons : [];
  const toolsUsed = Array.isArray(body.toolsUsed)
    ? body.toolsUsed.map(String)
    : [];
  if (!conversationId || !messageId || !["up", "down"].includes(rating)) {
    return res
      .status(400)
      .json({ error: "conversationId, messageId and rating are required" });
  }
  const cleanReasons =
    rating === "down"
      ? reasons.filter((r) => FEEDBACK_REASONS.includes(r))
      : [];
  const cleanComment =
    typeof comment === "string" ? comment.trim().slice(0, 500) : undefined;

  const existing = await AtlasFeedback.findOne({
    user: req.user.id,
    messageId,
  });
  const fb = await AtlasFeedback.findOneAndUpdate(
    { user: req.user.id, messageId },
    {
      $set: {
        conversationId,
        rating,
        reasons: cleanReasons,
        comment: cleanComment,
        atlasReply:
          typeof atlasReply === "string"
            ? atlasReply.slice(0, 4000)
            : undefined,
        toolsUsed: toolsUsed.slice(0, 10),
        reviewed: false,
      },
    },
    { upsert: true, new: true }
  );

  // Adapt this user's Atlas from their reasons ("too long" twice -> shorter replies)
  if (cleanReasons.length)
    learnFromFeedback(req.user.id, cleanReasons).catch(() => {});

  // XP, once per conversation and capped per day
  let xp = 0;
  if (!existing) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [paidThisConvo, paidToday] = await Promise.all([
      AtlasFeedback.exists({
        user: req.user.id,
        conversationId,
        xpAwarded: { $gt: 0 },
      }),
      AtlasFeedback.countDocuments({
        user: req.user.id,
        xpAwarded: { $gt: 0 },
        createdAt: { $gte: since },
      }),
    ]);
    if (!paidThisConvo && paidToday < MAX_XP_FEEDBACK_PER_DAY) {
      try {
        // awardXP takes ONE object. Ledger key = (user, rule, sourceId), so one
        // Atlas chat can only ever pay once, even if this check races.
        const granted = await awardXP({
          userId: req.user.id,
          ruleKey: "ATLAS_FEEDBACK",
          sourceType: "AtlasConversation",
          sourceId: `atlas-convo:${conversationId}`,
          linkedTo: null,
        });
        xp = granted?.awarded ? Number(granted.amount) || 0 : 0;
        if (!granted?.awarded)
          console.info("[Atlas feedback] no XP:", granted?.reason);
      } catch (e) {
        console.warn("[Atlas feedback] XP not granted:", e.message);
        xp = 0;
      }
      if (xp > 0) {
        fb.xpAwarded = xp;
        await fb.save();
      }
    }
  }

  res.json({ ok: true, rating: fb.rating, xpEarned: xp });
}

// GET /api/atlas/feedback/insights?days=30   (admin only)
// What's working, what isn't, and the latest thumbs-downs to review.
export async function getInsights(req, res) {
  const days = Math.min(Number(req.query.days) || 30, 180);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totals, reasons, byTool, recentDown, proposals] = await Promise.all([
    AtlasFeedback.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$rating", n: { $sum: 1 } } },
    ]),
    AtlasFeedback.aggregate([
      { $match: { createdAt: { $gte: since }, rating: "down" } },
      { $unwind: "$reasons" },
      { $group: { _id: "$reasons", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    AtlasFeedback.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: { path: "$toolsUsed", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$toolsUsed", "chat_only"] },
          up: { $sum: { $cond: [{ $eq: ["$rating", "up"] }, 1, 0] } },
          down: { $sum: { $cond: [{ $eq: ["$rating", "down"] }, 1, 0] } },
        },
      },
      { $sort: { down: -1 } },
    ]),
    AtlasFeedback.find({
      createdAt: { $gte: since },
      rating: "down",
      reviewed: false,
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .select("reasons comment atlasReply toolsUsed createdAt")
      .lean(),
    // Did Atlas's proposals turn into bookings?
    AtlasBookingProposal.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  const count = (arr, id) => arr.find((x) => x._id === id)?.n || 0;
  const up = count(totals, "up");
  const down = count(totals, "down");
  const proposed = proposals.reduce((s, x) => s + x.n, 0);
  const booked = count(proposals, "booked");

  res.json({
    days,
    satisfaction: up + down ? Math.round((up / (up + down)) * 100) : null, // % thumbs up
    up,
    down,
    topComplaints: reasons.map((r) => ({ reason: r._id, count: r.n })),
    byTool: byTool.map((t) => ({ tool: t._id, up: t.up, down: t.down })),
    proposals: {
      total: proposed,
      booked,
      bookingRate: proposed ? Math.round((booked / proposed) * 100) : null,
      expired: count(proposals, "expired"),
      priceChanged: count(proposals, "price_changed"),
      failed: count(proposals, "failed"),
    },
    toReview: recentDown.map((f) => ({
      id: String(f._id),
      ...f,
      _id: undefined,
    })),
  });
}

// PATCH /api/atlas/feedback/:id/reviewed   (admin only)
export async function markReviewed(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Unknown feedback id" });
  }
  await AtlasFeedback.updateOne(
    { _id: req.params.id },
    { $set: { reviewed: true } }
  );
  res.json({ ok: true });
}
