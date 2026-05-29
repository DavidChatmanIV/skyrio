/**
 * ─────────────────────────────────────────────────────────────
 * XP system routes: GET /api/xp/me + POST /api/xp/activity
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../models/user.js";
import addXP from "../utils/xpTracker.js";

import {
  XP_RULES,
  XP_PASSIVE,
  XP_TIERS,
  XP_DAILY_CAP,
  XP_MULTIPLIERS,
  getTier,
  getNextTier,
  getTierProgress,
} from "../config/xpRules.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Read + mutate the user's xpDailyMeta field.
 * xpDailyMeta shape (stored on User model):
 * {
 *   date:         String,   // "YYYY-MM-DD" — resets counts when date changes
 *   counts:       Map,      // { actionKey: Number }
 *   streak:       Number,
 *   lastStreakDate: String,
 *   onceDone:     [String], // action keys that are "once: true"
 * }
 */
function getDailyMeta(user) {
  const today = todayStr();
  if (!user.xpDailyMeta || user.xpDailyMeta.date !== today) {
    user.xpDailyMeta = {
      date: today,
      counts: {},
      streak: user.xpDailyMeta?.streak ?? 0,
      lastStreakDate: user.xpDailyMeta?.lastStreakDate ?? null,
      onceDone: user.xpDailyMeta?.onceDone ?? [],
    };
  }
  return user.xpDailyMeta;
}

function canAwardPassive(meta, key, rule) {
  if (rule.once && meta.onceDone.includes(key)) return false;
  if (rule.dailyLimit) {
    const count = meta.counts[key] ?? 0;
    if (count >= rule.dailyLimit) return false;
  }
  return true;
}

function canAwardRule(meta, key, rule) {
  if (rule.once && meta.onceDone.includes(key)) return false;
  return true;
}

// ─── Internal: push to recent events array (max 12) ──────────────────────────
function pushEvent(user, event) {
  if (!user.xpRecentEvents) user.xpRecentEvents = [];
  user.xpRecentEvents.unshift(event);
  if (user.xpRecentEvents.length > 12) user.xpRecentEvents.length = 12;
}

// ─── GET /api/xp/me ──────────────────────────────────────────────────────────
// Returns full XP state for the current user.
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const xp = user.xp ?? 0;
    const plan = user.membershipPlan ?? "free";
    const meta = user.xpDailyMeta ?? {};
    const streak = meta.streak ?? 0;
    const multiplier = XP_MULTIPLIERS[plan] ?? 1;

    res.json({
      xp,
      plan,
      streak,
      multiplier,
      tier: getTier(xp),
      nextTier: getNextTier(xp),
      progress: getTierProgress(xp),
      totalEarned: user.xpTotalEarned ?? xp,
      recentEvents: user.xpRecentEvents ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/xp/activity ───────────────────────────────────────────────────
// Awards XP for a passive activity OR an active action.
// Body: { type: "DAILY_SESSION" | "BOOKING_CONFIRMED" | ... }
router.post("/activity", requireAuth, async (req, res) => {
  const { type } = req.body;
  if (!type) return res.status(400).json({ error: "type is required" });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const meta = getDailyMeta(user);
    const plan = user.membershipPlan ?? "free";
    const multiplier = XP_MULTIPLIERS[plan] ?? 1;

    // ── Resolve rule (passive or active) ────────────────────────────────────
    const passiveRule = XP_PASSIVE[type];
    const activeRule = XP_RULES[type];
    const rule = passiveRule ?? activeRule;

    if (!rule) {
      return res.status(400).json({ error: `Unknown XP type: ${type}` });
    }

    // ── Streak logic (runs alongside STREAK_DAY) ─────────────────────────────
    if (type === "STREAK_DAY") {
      const today = todayStr();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      if (meta.lastStreakDate === today) {
        return res.json({ awarded: false, xp: user.xp });
      }

      meta.streak = meta.lastStreakDate === yStr ? (meta.streak ?? 0) + 1 : 1;
      meta.lastStreakDate = today;

      // Milestone bonuses
      if (meta.streak % 30 === 0) {
        const bonus = XP_PASSIVE.STREAK_MONTH.xp * multiplier;
        user.xp += bonus;
        user.xpTotalEarned = (user.xpTotalEarned ?? 0) + bonus;
        pushEvent(user, {
          label: XP_PASSIVE.STREAK_MONTH.label,
          xp: bonus,
          icon: XP_PASSIVE.STREAK_MONTH.icon,
        });
      } else if (meta.streak % 7 === 0) {
        const bonus = XP_PASSIVE.STREAK_WEEK.xp * multiplier;
        user.xp += bonus;
        user.xpTotalEarned = (user.xpTotalEarned ?? 0) + bonus;
        pushEvent(user, {
          label: XP_PASSIVE.STREAK_WEEK.label,
          xp: bonus,
          icon: XP_PASSIVE.STREAK_WEEK.icon,
        });
      }
    }

    // ── Guard checks ─────────────────────────────────────────────────────────
    const allowed = passiveRule
      ? canAwardPassive(meta, type, rule)
      : canAwardRule(meta, type, rule);

    if (!allowed) {
      return res.json({ awarded: false, xp: user.xp });
    }

    // ── Daily cap check ───────────────────────────────────────────────────────
    const dailyTotal = user.xpDailyTotal ?? 0;
    if (dailyTotal >= XP_DAILY_CAP) {
      return res.json({ awarded: false, xp: user.xp, reason: "daily_cap" });
    }

    // ── Award XP ──────────────────────────────────────────────────────────────
    const earned = rule.xp * multiplier;
    user.xp += earned;
    user.xpTotalEarned = (user.xpTotalEarned ?? 0) + earned;
    user.xpDailyTotal = dailyTotal + earned;

    // Update daily count
    if (rule.dailyLimit) {
      meta.counts[type] = (meta.counts[type] ?? 0) + 1;
    }
    if (rule.once) {
      meta.onceDone.push(type);
    }

    const event = {
      label: rule.label,
      xp: earned,
      icon: rule.icon,
      time: Date.now(),
    };
    pushEvent(user, event);

    user.xpDailyMeta = meta;
    user.markModified("xpDailyMeta");
    user.markModified("xpRecentEvents");
    await user.save();

    res.json({ awarded: true, xp: user.xp, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

/**
 * ─────────────────────────────────────────────────────────────
 * USER MODEL ADDITIONS NEEDED (backend/models/User.js)
 * Add these fields to your existing User schema:
 * ─────────────────────────────────────────────────────────────
 *
 * membershipPlan:  { type: String, enum: ["free","pro","elite"], default: "free" },
 * xpTotalEarned:  { type: Number, default: 0 },
 * xpDailyTotal:   { type: Number, default: 0 },
 * xpDailyMeta:    { type: mongoose.Schema.Types.Mixed, default: {} },
 * xpRecentEvents: { type: Array, default: [] },
 *
 * ─────────────────────────────────────────────────────────────
 * CRON JOB (reset xpDailyTotal nightly — add to your jobs):
 * ─────────────────────────────────────────────────────────────
 *
 * // backend/jobs/resetDailyXP.js
 * import User from "../models/user.js";
 * async function resetDailyXP() {
 *   await User.updateMany({}, { $set: { xpDailyTotal: 0 } });
 *   console.log("✅ Daily XP totals reset");
 * }
 * export default resetDailyXP;
 *
 * // In your scheduler (e.g. node-cron):
 * cron.schedule("0 0 * * *", resetDailyXP); // midnight UTC
 */
