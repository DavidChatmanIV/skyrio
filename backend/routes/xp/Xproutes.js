/**
 * ─────────────────────────────────────────────────────────────
 * XP system routes
 *
 * GET  /api/xp/me                     — current user XP state
 * POST /api/xp/activity               — award XP for a passive or active event
 * POST /api/xp/admin/reset            — admin: reset one or all users
 * POST /api/xp/admin/grant            — admin: grant custom XP to a user
 * GET  /api/xp/admin/user/:userId     — admin: inspect any user's XP state
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../models/user.js";
import addXP from "../utils/xpTracker.js";

import {
  XP_RULES,
  XP_PASSIVE,
  XP_DAILY_CAP,
  XP_MULTIPLIERS,
  XP_MAX_SINGLE_AWARD,
  getLevel,
} from "../config/xpRules.js";

const router = Router();

// ─── Middleware: admin only ───────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

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
  if (rule.dailyLimit) {
    const count = meta.counts[key] ?? 0;
    if (count >= rule.dailyLimit) return false;
  }
  return true;
}

function pushEvent(user, event) {
  if (!user.xpRecentEvents) user.xpRecentEvents = [];
  user.xpRecentEvents.unshift({ ...event, time: Date.now() });
  if (user.xpRecentEvents.length > 20) user.xpRecentEvents.length = 20;
}

function buildXPState(user) {
  const xp = user.xp ?? 0;
  const plan = user.membershipPlan ?? "free";
  const meta = user.xpDailyMeta ?? {};
  const level = getLevel(xp);

  return {
    xp,
    plan,
    streak: meta.streak ?? 0,
    multiplier: XP_MULTIPLIERS[plan] ?? 1,
    level: {
      current: level.current.name,
      color: level.current.color,
      iconKey: level.current.iconKey,
      description: level.current.description,
    },
    next: level.next
      ? {
          name: level.next.name,
          color: level.next.color,
          iconKey: level.next.iconKey,
          minXp: level.next.minXp,
        }
      : null,
    xpIntoLevel: level.xpIntoLevel,
    xpNeeded: level.xpNeeded,
    xpToNext: level.xpToNext,
    percent: level.percent,
    totalEarned: user.xpTotalEarned ?? xp,
    dailyTotal: user.xpDailyTotal ?? 0,
    recentEvents: user.xpRecentEvents ?? [],
  };
}

// ─── GET /api/xp/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(buildXPState(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/xp/activity ───────────────────────────────────────────────────
// Body: { type: string, xpOverride?: number }
// xpOverride is only respected for SEASONAL_AWARD and ADMIN_GRANT (and only
// when the caller is an admin). All other types use the configured value.
router.post("/activity", requireAuth, async (req, res) => {
  const { type, xpOverride } = req.body;
  if (!type) return res.status(400).json({ error: "type is required" });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const meta = getDailyMeta(user);
    const plan = user.membershipPlan ?? "free";
    const multiplier = XP_MULTIPLIERS[plan] ?? 1;

    // ── Resolve rule ─────────────────────────────────────────────────────────
    const passiveRule = XP_PASSIVE[type];
    const activeRule = XP_RULES[type];
    const rule = passiveRule ?? activeRule;

    if (!rule) {
      return res.status(400).json({ error: `Unknown XP type: ${type}` });
    }

    // ── Streak logic ──────────────────────────────────────────────────────────
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

      if (meta.streak % 30 === 0) {
        const bonus = Math.round(XP_PASSIVE.STREAK_MONTH.xp * multiplier);
        user.xp += bonus;
        user.xpTotalEarned = (user.xpTotalEarned ?? 0) + bonus;
        pushEvent(user, {
          label: XP_PASSIVE.STREAK_MONTH.label,
          xp: bonus,
          iconKey: XP_PASSIVE.STREAK_MONTH.iconKey,
        });
      } else if (meta.streak % 7 === 0) {
        const bonus = Math.round(XP_PASSIVE.STREAK_WEEK.xp * multiplier);
        user.xp += bonus;
        user.xpTotalEarned = (user.xpTotalEarned ?? 0) + bonus;
        pushEvent(user, {
          label: XP_PASSIVE.STREAK_WEEK.label,
          xp: bonus,
          iconKey: XP_PASSIVE.STREAK_WEEK.iconKey,
        });
      }
    }

    // ── Guard checks ──────────────────────────────────────────────────────────
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

    // ── Compute final XP ──────────────────────────────────────────────────────
    let baseXP = rule.xp;

    // Admin-only override for variable-amount events
    const isVariableEvent = ["SEASONAL_AWARD", "ADMIN_GRANT"].includes(type);
    if (isVariableEvent && xpOverride != null && req.user?.isAdmin) {
      baseXP = Math.min(Number(xpOverride), XP_MAX_SINGLE_AWARD);
    }

    const earned = Math.round(baseXP * multiplier);

    user.xp += earned;
    user.xpTotalEarned = (user.xpTotalEarned ?? 0) + earned;
    user.xpDailyTotal = dailyTotal + earned;

    if (rule.dailyLimit) {
      meta.counts[type] = (meta.counts[type] ?? 0) + 1;
    }
    if (rule.once) {
      meta.onceDone.push(type);
    }

    const event = { label: rule.label, xp: earned, iconKey: rule.iconKey };
    pushEvent(user, event);

    user.xpDailyMeta = meta;
    user.markModified("xpDailyMeta");
    user.markModified("xpRecentEvents");
    await user.save();

    res.json({
      awarded: true,
      xp: user.xp,
      event,
      level: getLevel(user.xp).current.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/xp/admin/reset
 *
 * Reset XP for a single user, or wipe ALL users (nuclear option).
 *
 * Body options:
 *   { userId: "abc123" }              — reset one user to 0
 *   { userId: "abc123", xp: 200 }     — reset one user to a specific value
 *   { all: true }                     — reset every user to 0
 *   { all: true, reason: "exploit" }  — same, with an audit reason
 *
 * What gets cleared:
 *   xp, xpTotalEarned, xpDailyTotal, xpDailyMeta (streak/counts/onceDone),
 *   xpRecentEvents
 */
router.post("/admin/reset", requireAuth, requireAdmin, async (req, res) => {
  const { userId, xp: resetTo = 0, all, reason = "admin_reset" } = req.body;

  if (!all && !userId) {
    return res.status(400).json({ error: "Provide userId or all:true" });
  }

  const targetXP = Math.max(0, Number(resetTo));

  try {
    if (all) {
      // ── Reset every user ──────────────────────────────────────────────────
      const result = await User.updateMany(
        {},
        {
          $set: {
            xp: targetXP,
            xpTotalEarned: targetXP,
            xpDailyTotal: 0,
            xpDailyMeta: {},
            xpRecentEvents: [
              {
                label: `XP reset by admin (${reason})`,
                xp: 0,
                iconKey: "shield",
                time: Date.now(),
              },
            ],
          },
        }
      );

      return res.json({
        success: true,
        affected: result.modifiedCount,
        message: `Reset all users to ${targetXP} XP`,
      });
    }

    // ── Reset single user ───────────────────────────────────────────────────
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const previousXP = user.xp ?? 0;

    user.xp = targetXP;
    user.xpTotalEarned = targetXP;
    user.xpDailyTotal = 0;
    user.xpDailyMeta = {};
    user.xpRecentEvents = [
      {
        label: `XP reset by admin (${reason})`,
        xp: 0,
        iconKey: "shield",
        time: Date.now(),
      },
    ];
    user.markModified("xpDailyMeta");
    user.markModified("xpRecentEvents");
    await user.save();

    return res.json({
      success: true,
      userId,
      previousXP,
      newXP: targetXP,
      level: getLevel(targetXP).current.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/xp/admin/grant
 *
 * Grant a custom XP amount to a specific user (positive or negative).
 * Body: { userId, amount, reason }
 * Negative amount = deduct XP (floors at 0).
 */
router.post("/admin/grant", requireAuth, requireAdmin, async (req, res) => {
  const { userId, amount, reason = "admin_grant" } = req.body;

  if (!userId || amount == null) {
    return res.status(400).json({ error: "userId and amount are required" });
  }

  const delta = Math.max(
    -XP_MAX_SINGLE_AWARD,
    Math.min(XP_MAX_SINGLE_AWARD, Number(amount))
  );

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const previousXP = user.xp ?? 0;
    user.xp = Math.max(0, previousXP + delta);

    if (delta > 0) {
      user.xpTotalEarned = (user.xpTotalEarned ?? 0) + delta;
    }

    const event = {
      label: `Admin ${delta >= 0 ? "grant" : "deduction"}: ${reason}`,
      xp: delta,
      iconKey: delta >= 0 ? "gift" : "shield",
      time: Date.now(),
    };
    if (!user.xpRecentEvents) user.xpRecentEvents = [];
    user.xpRecentEvents.unshift(event);
    if (user.xpRecentEvents.length > 20) user.xpRecentEvents.length = 20;
    user.markModified("xpRecentEvents");

    await user.save();

    return res.json({
      success: true,
      userId,
      previousXP,
      delta,
      newXP: user.xp,
      level: getLevel(user.xp).current.name,
      reason,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/xp/admin/user/:userId
 * Full XP state for any user — admin inspection tool.
 */
router.get(
  "/admin/user/:userId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId).lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        userId: user._id,
        username: user.username,
        email: user.email,
        ...buildXPState(user),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;

/**
 * ─────────────────────────────────────────────────────────────
 * USER MODEL ADDITIONS NEEDED (backend/models/User.js)
 * ─────────────────────────────────────────────────────────────
 *
 * isAdmin:         { type: Boolean, default: false },
 * membershipPlan:  { type: String, enum: ["free","pro","elite"], default: "free" },
 * xpTotalEarned:   { type: Number, default: 0 },
 * xpDailyTotal:    { type: Number, default: 0 },
 * xpDailyMeta:     { type: mongoose.Schema.Types.Mixed, default: {} },
 * xpRecentEvents:  { type: Array, default: [] },
 *
 * ─────────────────────────────────────────────────────────────
 * CRON JOB — reset xpDailyTotal nightly (midnight UTC):
 * ─────────────────────────────────────────────────────────────
 *
 * // backend/jobs/resetDailyXP.js
 * import User from "../models/user.js";
 * export async function resetDailyXP() {
 *   await User.updateMany({}, { $set: { xpDailyTotal: 0 } });
 *   console.log("✅ Daily XP totals reset");
 * }
 * // In your scheduler:
 * cron.schedule("0 0 * * *", resetDailyXP); // midnight UTC
 */
