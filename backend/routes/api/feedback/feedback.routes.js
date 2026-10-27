/**
 * Feedback, testimonials and feedback XP.
 *
 * Lives at:  routes/api/feedback/feedback.routes.js
 * Mounted in routes/api/index.js with:
 *   await mount("/", "./feedback/feedback.routes.js");
 * It handles /api/feedback/* and /api/testimonials/*.
 *
 * Fairness rules this file enforces:
 *  - XP never depends on the star rating.
 *  - Testimonials are only rejected for spam, profanity or personal info.
 *  - The public endpoint labels every review as XP-incentivized.
 *  - Every admin decision is written to the audit log.
 */
import express from "express";
import mongoose from "mongoose";
import {
  Feedback,
  Testimonial,
  XpAward,
  ReviewPrompt,
  AdminAudit,
} from "../../../models/feedback.models.js";
import { requireAuth } from "../../../middleware/requireAuth.js";
// Same admin check as challenges + the admin dashboard (x-admin-email aware).
import { verifyAdmin } from "../../admin.routes.js";

/* ═══════════════════════════════════════════════════════════════════════════
   ADAPTERS
   ═══════════════════════════════════════════════════════════════════════════ */

const requireUser = requireAuth;
const requireAdmin = verifyAdmin;

/**
 * Sets req.user when the request has a valid login, and carries on without
 * one otherwise. Signed-out users (or expired tokens) can still send
 * feedback; they just don't earn XP.
 */
function optionalUser(req, res, next) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    next();
  };
  // Catch requireAuth's 401 response instead of sending it to the user.
  const quietRes = Object.create(res);
  quietRes.status = () => quietRes;
  quietRes.json =
    quietRes.send =
    quietRes.end =
      () => {
        req.user = undefined;
        finish();
        return quietRes;
      };
  try {
    requireAuth(req, quietRes, (err) => {
      if (err) req.user = undefined;
      finish();
    });
  } catch {
    req.user = undefined;
    finish();
  }
}

const User = () => mongoose.model("User");
const Booking = () => mongoose.model("Booking");

/** Which admin did this (for the audit log). */
const adminOf = (req) =>
  req.admin?.email || req.headers["x-admin-email"] || "admin";

/** The signed-in user's id. */
const userIdOf = (req) => req.user?._id || req.user?.id;

/** Bookings that belong to a user. Adjust if your field is named differently. */
const bookingOwnerQuery = (userId) => ({
  $or: [{ user: userId }, { userId }],
});

/** When a trip is over. Adjust to your Booking shape. */
function tripEndDate(b) {
  const d =
    b.flight?.returnDate ||
    b.flight?.arrivalDate ||
    b.flight?.departureDate ||
    b.endDate;
  return d ? new Date(d) : null;
}

/** In-app notification. Uses your Notification model if it exists. */
async function notify(userId, { title, message, type = "xp" }) {
  try {
    if (!mongoose.models.Notification) return;
    await mongoose.model("Notification").create({
      user: userId,
      title,
      message,
      type,
    });
  } catch (err) {
    console.warn("[feedback] notify failed:", err.message);
  }
}

/** Counts toward challenges that use FEEDBACK_SUBMITTED. Wire to your tracker. */
async function recordChallengeAction(userId, actionType) {
  // e.g. await trackChallengeAction(userId, actionType);
}

/* ═══════════════════════════════════════════════════════════════════════════
   XP RULES
   ═══════════════════════════════════════════════════════════════════════════ */

export const XP = {
  FEEDBACK_QUICK: 10,
  FEEDBACK_DETAILED: 25,
  TESTIMONIAL: 50,
  FEEDBACK_SHIPPED: 100,
};
const FEEDBACK_WEEKLY_CAP = 3; // feedback XP awards per rolling 7 days
const MIN_CHARS_FOR_XP = 20;
const DETAILED_CHARS = 120;
const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const PROMPT_SNOOZE_DAYS = 30;

const FEEDBACK_REASONS = ["FEEDBACK_QUICK", "FEEDBACK_DETAILED"];

async function awardXp(userId, amount, reason, source) {
  const award = await XpAward.create({ user: userId, amount, reason, source });
  await User().updateOne({ _id: userId }, { $inc: { xp: amount } });
  return award;
}

async function reverseAward(award, admin) {
  if (award.reversed) return false;
  award.reversed = true;
  award.reversedAt = new Date();
  award.reversedBy = admin;
  await award.save();
  await User().updateOne({ _id: award.user }, { $inc: { xp: -award.amount } });
  return true;
}

async function audit(req, action, kind, id, detail) {
  await AdminAudit.create({
    admin: adminOf(req),
    action,
    target: { kind, id },
    detail,
  });
}

const clean = (s, max) =>
  String(s || "")
    .trim()
    .slice(0, max);
const badId = (id) => !mongoose.isValidObjectId(id);

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════════════════════════ */

const router = express.Router();

/* ─── User: send feedback ─────────────────────────────────────────────── */
router.post("/feedback", optionalUser, async (req, res) => {
  try {
    const message = clean(req.body.message, 4000);
    if (!message)
      return res.status(400).json({ ok: false, message: "Feedback is empty." });

    const type = ["bug", "idea", "general"].includes(req.body.type)
      ? req.body.type
      : "general";
    const rating = Number(req.body.rating);
    const userId = userIdOf(req);

    const fb = await Feedback.create({
      user: userId,
      type,
      message,
      rating: rating >= 1 && rating <= 5 ? rating : undefined,
      page: clean(req.body.page, 200),
    });

    // XP: signed in, long enough, under the weekly cap. Rating plays no part.
    let xpAwarded = 0;
    let xpNote = null;
    if (!userId) {
      xpNote = "Sign in to earn XP for feedback.";
    } else if (message.length < MIN_CHARS_FOR_XP) {
      xpNote = `Write at least ${MIN_CHARS_FOR_XP} characters to earn XP.`;
    } else {
      const recent = await XpAward.countDocuments({
        user: userId,
        reason: { $in: FEEDBACK_REASONS },
        reversed: false,
        createdAt: { $gte: new Date(Date.now() - WEEK) },
      });
      if (recent >= FEEDBACK_WEEKLY_CAP) {
        xpNote =
          "You've hit this week's feedback XP limit. Thanks for all of it!";
      } else {
        const detailed = type === "bug" || message.length >= DETAILED_CHARS;
        const reason = detailed ? "FEEDBACK_DETAILED" : "FEEDBACK_QUICK";
        xpAwarded = XP[reason];
        await awardXp(userId, xpAwarded, reason, {
          kind: "feedback",
          id: fb._id,
        });
        fb.xpAwarded = xpAwarded;
        await fb.save();
      }
      await recordChallengeAction(userId, "FEEDBACK_SUBMITTED");
    }

    res.json({ ok: true, id: fb._id, xpAwarded, xpNote });
  } catch (err) {
    console.error("[feedback] create", err);
    res.status(500).json({ ok: false, message: "Couldn't save feedback." });
  }
});

/* ─── User: is there a trip to ask about? (drives the pop-up) ─────────── */
router.get("/testimonials/prompt", requireUser, async (req, res) => {
  try {
    const userId = userIdOf(req);

    // "Not now" on any prompt snoozes all prompts for 30 days.
    const snoozed = await ReviewPrompt.exists({
      user: userId,
      dismissedAt: { $gte: new Date(Date.now() - PROMPT_SNOOZE_DAYS * DAY) },
    });
    if (snoozed) return res.json({ ok: true, prompt: null });

    const bookings = await Booking()
      .find({ ...bookingOwnerQuery(userId), status: "confirmed" })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const now = Date.now();
    for (const b of bookings) {
      const end = tripEndDate(b);
      // Ask 24 hours to 14 days after the trip ends.
      if (!end || now - end < DAY || now - end > 14 * DAY) continue;
      const [reviewed, prompt] = await Promise.all([
        Testimonial.exists({ user: userId, booking: b._id }),
        ReviewPrompt.findOne({ user: userId, booking: b._id }).lean(),
      ]);
      if (reviewed || prompt?.dismissedAt) continue;
      return res.json({
        ok: true,
        prompt: {
          bookingId: b._id,
          destination: b.flight?.destination || null,
          xp: XP.TESTIMONIAL,
        },
      });
    }
    res.json({ ok: true, prompt: null });
  } catch (err) {
    console.error("[testimonials] prompt", err);
    res.json({ ok: true, prompt: null }); // never block the page over this
  }
});

/* ─── User: pop-up was shown / dismissed ──────────────────────────────── */
const markPrompt = (field) => async (req, res) => {
  const { bookingId } = req.params;
  if (badId(bookingId)) return res.status(400).json({ ok: false });
  await ReviewPrompt.updateOne(
    { user: userIdOf(req), booking: bookingId },
    { $set: { [field]: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
};
router.post(
  "/testimonials/prompt/:bookingId/seen",
  requireUser,
  markPrompt("shownAt")
);
router.post(
  "/testimonials/prompt/:bookingId/dismiss",
  requireUser,
  markPrompt("dismissedAt")
);

/* ─── User: leave a testimonial ───────────────────────────────────────── */
router.post("/testimonials", requireUser, async (req, res) => {
  try {
    const userId = userIdOf(req);
    const text = clean(req.body.text, 1000);
    const rating = Number(req.body.rating);
    if (!(rating >= 1 && rating <= 5))
      return res
        .status(400)
        .json({ ok: false, message: "Pick a star rating." });
    if (text.length < MIN_CHARS_FOR_XP)
      return res.status(400).json({
        ok: false,
        message: `Write at least ${MIN_CHARS_FOR_XP} characters.`,
      });

    let bookingId = null;
    if (req.body.bookingId) {
      if (badId(req.body.bookingId))
        return res.status(400).json({ ok: false, message: "Unknown trip." });
      const owns = await Booking().exists({
        _id: req.body.bookingId,
        ...bookingOwnerQuery(userId),
      });
      if (!owns)
        return res.status(403).json({ ok: false, message: "Unknown trip." });
      bookingId = req.body.bookingId;
    }

    let t;
    try {
      t = await Testimonial.create({
        user: userId,
        booking: bookingId,
        rating,
        text,
        displayName: clean(req.body.displayName, 40),
        city: clean(req.body.city, 60),
        consent: !!req.body.consent,
      });
    } catch (err) {
      if (err.code === 11000)
        return res.status(409).json({
          ok: false,
          message: bookingId
            ? "You've already reviewed this trip."
            : "You've already left a review. Thanks!",
        });
      throw err;
    }

    // Same XP for 1 star or 5. Unique index above means once per trip.
    await awardXp(userId, XP.TESTIMONIAL, "TESTIMONIAL", {
      kind: "testimonial",
      id: t._id,
    });
    t.xpAwarded = XP.TESTIMONIAL;
    await t.save();

    if (bookingId) {
      await ReviewPrompt.updateOne(
        { user: userId, booking: bookingId },
        { $set: { respondedAt: new Date() } },
        { upsert: true }
      );
    }

    res.json({ ok: true, id: t._id, xpAwarded: XP.TESTIMONIAL });
  } catch (err) {
    console.error("[testimonials] create", err);
    res.status(500).json({ ok: false, message: "Couldn't save your review." });
  }
});

/* ─── Public: reviews for the homepage / reviews page ─────────────────── */
router.get("/testimonials/public", async (req, res) => {
  const featuredOnly = req.query.featured === "1";
  const filter = featuredOnly
    ? { status: "approved", featured: true, consent: true }
    : { status: "approved", consent: true };
  const rows = await Testimonial.find(filter)
    .sort(featuredOnly ? { featuredAt: -1 } : { createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 12, 50))
    .lean();

  // The average covers every approved review, featured or not, good or bad.
  const [summary] = await Testimonial.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  res.json({
    ok: true,
    summary: {
      averageRating: summary ? Math.round(summary.avg * 10) / 10 : null,
      count: summary?.count || 0,
    },
    disclosure:
      "Reviewers earn Skyrio XP for leaving a review, whatever their rating.",
    testimonials: rows.map((t) => ({
      id: t._id,
      rating: t.rating,
      text: t.text,
      name: t.displayName || "Skyrio traveler",
      city: t.city || null,
      date: t.createdAt,
      incentivized: t.xpAwarded > 0,
    })),
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════════════════════════════════════════ */

const admin = express.Router();
// Scoped to admin paths only, so other /api routes mounted after this
// router aren't caught by the admin check.
admin.use(["/feedback/admin", "/testimonials/admin"], requireAdmin);

const userFields = "name username email avatar xp";

/* Tab badge counts */
admin.get("/feedback/admin/counts", async (req, res) => {
  const [newFeedback, pendingReviews] = await Promise.all([
    Feedback.countDocuments({ status: "new" }),
    Testimonial.countDocuments({ status: "pending" }),
  ]);
  res.json({ ok: true, newFeedback, pendingReviews });
});

/* Stats */
admin.get("/feedback/admin/stats", async (req, res) => {
  const since30 = new Date(Date.now() - 30 * DAY);
  const since6mo = new Date();
  since6mo.setMonth(since6mo.getMonth() - 5, 1);
  since6mo.setHours(0, 0, 0, 0);

  const [ratingAll, byMonth, byType, shown, responded, shipped] =
    await Promise.all([
      Testimonial.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } },
      ]),
      Testimonial.aggregate([
        {
          $match: {
            status: { $ne: "rejected" },
            createdAt: { $gte: since6mo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            avg: { $avg: "$rating" },
            n: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Feedback.aggregate([
        { $match: { createdAt: { $gte: since30 } } },
        { $group: { _id: "$type", n: { $sum: 1 } } },
      ]),
      ReviewPrompt.countDocuments({ shownAt: { $exists: true } }),
      ReviewPrompt.countDocuments({
        shownAt: { $exists: true },
        respondedAt: { $exists: true },
      }),
      Feedback.countDocuments({ status: "shipped" }),
    ]);

  res.json({
    ok: true,
    data: {
      averageRating: ratingAll[0]
        ? Math.round(ratingAll[0].avg * 10) / 10
        : null,
      reviewCount: ratingAll[0]?.n || 0,
      ratingByMonth: byMonth.map((m) => ({
        month: m._id,
        avg: Math.round(m.avg * 10) / 10,
        count: m.n,
      })),
      feedbackByType30d: Object.fromEntries(byType.map((t) => [t._id, t.n])),
      promptsShown: shown,
      responseRate: shown ? Math.round((responded / shown) * 100) : null,
      shippedCount: shipped,
    },
  });
});

/* Feedback inbox */
admin.get("/feedback/admin", async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "all")
    filter.status = req.query.status;
  if (req.query.type && req.query.type !== "all") filter.type = req.query.type;
  const rows = await Feedback.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("user", userFields)
    .lean();
  res.json({ ok: true, feedback: rows });
});

admin.patch("/feedback/admin/:id", async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ ok: false });
  const fb = await Feedback.findById(req.params.id);
  if (!fb) return res.status(404).json({ ok: false, message: "Not found." });

  const { status, note } = req.body;
  const allowed = ["new", "reviewing", "planned", "shipped", "closed"];
  if (status && !allowed.includes(status))
    return res.status(400).json({ ok: false, message: "Unknown status." });

  const prev = fb.status;
  if (status) fb.status = status;
  if (note !== undefined) fb.adminNote = clean(note, 1000);

  // "Your feedback shipped" bonus: once per item, only if we know who sent it.
  let bonus = 0;
  if (status === "shipped" && fb.user && !fb.shippedBonusAwarded) {
    await awardXp(fb.user, XP.FEEDBACK_SHIPPED, "FEEDBACK_SHIPPED", {
      kind: "feedback",
      id: fb._id,
    });
    fb.shippedBonusAwarded = true;
    bonus = XP.FEEDBACK_SHIPPED;
    await notify(fb.user, {
      title: "Your feedback shipped 🚀",
      message: `We built something you suggested. +${bonus} XP is in your account. Thank you!`,
    });
  }
  await fb.save();

  await audit(
    req,
    "feedback.update",
    "feedback",
    fb._id,
    `${prev} → ${fb.status}${bonus ? ` (+${bonus} XP)` : ""}`
  );
  res.json({ ok: true, feedback: fb, bonusAwarded: bonus });
});

/* Testimonials queue */
admin.get("/testimonials/admin", async (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status)
    ? req.query.status
    : "pending";
  const rows = await Testimonial.find({ status })
    .sort({ createdAt: status === "pending" ? 1 : -1 }) // oldest pending first
    .limit(200)
    .populate("user", userFields)
    .populate("booking", "flight status total")
    .lean();
  res.json({ ok: true, testimonials: rows });
});

const REJECT_REASONS = ["spam", "profanity", "personal_info"];

admin.patch("/testimonials/admin/:id", async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ ok: false });
  const t = await Testimonial.findById(req.params.id);
  if (!t) return res.status(404).json({ ok: false, message: "Not found." });

  const { action, reason } = req.body;
  const by = adminOf(req);
  let detail = "";

  switch (action) {
    case "approve":
      t.status = "approved";
      t.rejectReason = undefined;
      break;
    case "reject": {
      // Negative isn't a reason. Only these three are.
      if (!REJECT_REASONS.includes(reason))
        return res.status(400).json({
          ok: false,
          message:
            "Reviews can only be rejected for spam, profanity or personal info.",
        });
      t.status = "rejected";
      t.rejectReason = reason;
      t.featured = false;
      // Spam doesn't keep its XP. Profanity or personal info does: the
      // person still left a real review, it just can't be shown as-is.
      if (reason === "spam") {
        const award = await XpAward.findOne({
          "source.kind": "testimonial",
          "source.id": t._id,
          reversed: false,
        });
        if (award && (await reverseAward(award, by)))
          detail = ` (reversed ${award.amount} XP)`;
      }
      break;
    }
    case "feature":
      if (t.status !== "approved" || !t.consent)
        return res.status(400).json({
          ok: false,
          message:
            "Only approved reviews whose author said OK can be featured.",
        });
      t.featured = true;
      t.featuredAt = new Date();
      break;
    case "unfeature":
      t.featured = false;
      break;
    default:
      return res.status(400).json({ ok: false, message: "Unknown action." });
  }

  t.reviewedBy = by;
  t.reviewedAt = new Date();
  await t.save();
  await audit(
    req,
    `testimonial.${action}`,
    "testimonial",
    t._id,
    `${action}${reason ? `: ${reason}` : ""}${detail}`
  );
  res.json({ ok: true, testimonial: t });
});

/* XP log + farming flags */
admin.get("/feedback/admin/xp-log", async (req, res) => {
  const awards = await XpAward.find()
    .sort({ createdAt: -1 })
    .limit(150)
    .populate("user", userFields)
    .lean();

  // A user is flagged if they hit the weekly feedback cap this week,
  // or earned 8+ feedback awards in the last 30 days.
  const flagged = await XpAward.aggregate([
    {
      $match: {
        reason: { $in: FEEDBACK_REASONS },
        reversed: false,
        createdAt: { $gte: new Date(Date.now() - 30 * DAY) },
      },
    },
    {
      $group: {
        _id: "$user",
        last30: { $sum: 1 },
        thisWeek: {
          $sum: {
            $cond: [
              { $gte: ["$createdAt", new Date(Date.now() - WEEK)] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $match: {
        $or: [
          { thisWeek: { $gte: FEEDBACK_WEEKLY_CAP } },
          { last30: { $gte: 8 } },
        ],
      },
    },
  ]);
  const flags = Object.fromEntries(
    flagged.map((f) => [
      String(f._id),
      { last30: f.last30, thisWeek: f.thisWeek },
    ])
  );

  res.json({
    ok: true,
    awards: awards.map((a) => ({
      ...a,
      flag: a.user ? flags[String(a.user._id)] || null : null,
    })),
    flaggedUsers: flagged.length,
  });
});

admin.post("/feedback/admin/xp-log/:id/reverse", async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ ok: false });
  const award = await XpAward.findById(req.params.id);
  if (!award) return res.status(404).json({ ok: false, message: "Not found." });
  const done = await reverseAward(award, adminOf(req));
  if (!done)
    return res.status(409).json({ ok: false, message: "Already reversed." });
  await audit(
    req,
    "xp.reverse",
    "xpAward",
    award._id,
    `-${award.amount} XP (${award.reason})`
  );
  res.json({ ok: true });
});

/* Audit log */
admin.get("/feedback/admin/audit", async (req, res) => {
  const rows = await AdminAudit.find({
    action: { $regex: /^(feedback|testimonial|xp)\./ },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ ok: true, entries: rows });
});

router.use(admin);
export default router;
