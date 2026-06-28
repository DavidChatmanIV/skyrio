/**
 * ─────────────────────────────────────────────────────────────
 * XP system routes: GET /api/xp/me + POST /api/xp/activity
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../models/user.js";
import addXP from "../utils/xpTracker.js";
import Challenge from "../models/challenge.js";
import ChallengeProgress from "../models/challengeProgress.js";

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

function pushEvent(user, event) {
  if (!user.xpRecentEvents) user.xpRecentEvents = [];
  user.xpRecentEvents.unshift(event);
  if (user.xpRecentEvents.length > 12) user.xpRecentEvents.length = 12;
}

// ─── GET /api/xp/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const xp = user.xp ?? 0;
    const plan = user.plan ?? "free";
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
router.post("/activity", requireAuth, async (req, res) => {
  const { type } = req.body;
  if (!type) return res.status(400).json({ error: "type is required" });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const meta = getDailyMeta(user);
    const plan = user.plan ?? "free";
    const multiplier = XP_MULTIPLIERS[plan] ?? 1;

    const passiveRule = XP_PASSIVE[type];
    const activeRule = XP_RULES[type];
    const rule = passiveRule ?? activeRule;

    if (!rule) {
      return res.status(400).json({ error: `Unknown XP type: ${type}` });
    }

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

    const allowed = passiveRule
      ? canAwardPassive(meta, type, rule)
      : canAwardRule(meta, type, rule);

    if (!allowed) {
      return res.json({ awarded: false, xp: user.xp });
    }

    const dailyTotal = user.xpDailyTotal ?? 0;
    if (dailyTotal >= XP_DAILY_CAP) {
      return res.json({ awarded: false, xp: user.xp, reason: "daily_cap" });
    }

    const earned = rule.xp * multiplier;
    user.xp += earned;
    user.xpTotalEarned = (user.xpTotalEarned ?? 0) + earned;
    user.xpDailyTotal = dailyTotal + earned;

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

    // ── Challenge progress check ────────────────────────────────────────
    // Rides on the exact same action that just earned normal XP — no new
    // tracking calls anywhere else in the app. Wrapped in its own
    // try/catch so a bug here can never break ordinary XP awarding, which
    // is the thing this whole endpoint exists to do correctly.
    let completedChallenges = [];
    try {
      const now = new Date();
      const activeChallenges = await Challenge.find({
        active: true,
        "requirement.actionType": type,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();

      for (const challenge of activeChallenges) {
        const cp = await ChallengeProgress.findOne({
          user: user._id,
          challenge: challenge._id,
        });
        // Not activated, or already finished — nothing to do.
        if (!cp || cp.completedAt) continue;

        cp.progress += 1;
        if (cp.progress >= challenge.requirement.count && !cp.bonusAwarded) {
          cp.completedAt = now;
          cp.bonusAwarded = true;
          const bonus = challenge.bonusXP * multiplier;
          user.xp += bonus;
          user.xpTotalEarned = (user.xpTotalEarned ?? 0) + bonus;
          pushEvent(user, {
            label: `Challenge complete: ${challenge.title}`,
            xp: bonus,
            icon: challenge.icon || "🏆",
            time: Date.now(),
          });
          completedChallenges.push({
            id: challenge._id,
            title: challenge.title,
            bonusXP: bonus,
          });
        }
        await cp.save();
      }
    } catch (challengeErr) {
      console.error("[xp] challenge progress check failed:", challengeErr);
    }

    user.xpDailyMeta = meta;
    user.markModified("xpDailyMeta");
    user.markModified("xpRecentEvents");
    await user.save();

    res.json({
      awarded: true,
      xp: user.xp,
      event,
      completedChallenges,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
