/**
 * ─────────────────────────────────────────────────────────────
 * XP system routes: GET /api/xp/me + POST /api/xp/activity
 *
 * ANTI-CHEAT: the browser can only REPORT passive activity
 * (a visit, 5 min active, a page view). It can no longer name an
 * XP rule. Bookings, posts, likes, referrals, challenges and
 * bonuses are granted server-side by services/xpService.js.
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../models/user.js";
import { awardPassiveActivity } from "../services/xpService.js";
import {
  XP_MULTIPLIERS,
  getTier,
  getNextTier,
  getTierProgress,
} from "../config/xpRules.js";

const router = Router();

// Old frontend tracker sends rule keys — map the passive ones, reject everything else.
const LEGACY_TYPE_MAP = {
  DAILY_SESSION: "session",
  STREAK_DAY: "session", // streak is computed server-side from the daily session
  ACTIVE_INTERVAL: "active",
  PAGE_VISIT: "page",
};
const ALLOWED_TYPES = new Set(["session", "active", "page"]);

// Tiny per-user rate limiter (no extra dependency). 20 calls / minute.
const hits = new Map();
function rateLimited(userId) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (hits.get(userId) ?? []).filter((t) => t > windowStart);
  list.push(now);
  hits.set(userId, list);
  if (hits.size > 10_000) hits.clear(); // keep memory bounded
  return list.length > 20;
}

// ─── GET /api/xp/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const xp = user.xp ?? 0; // spendable balance — goes down when rewards are redeemed
    const totalEarned = user.xpTotalEarned ?? xp; // lifetime earned — RANK USES THIS
    const plan = user.plan ?? "free";

    res.json({
      xp,
      pendingXp: user.pendingXp ?? 0, // booking XP waiting for the trip to start
      plan,
      streak: user.xpDailyMeta?.streak ?? 0,
      multiplier: XP_MULTIPLIERS[plan] ?? 1,
      tier: getTier(totalEarned),
      nextTier: getNextTier(totalEarned),
      progress: getTierProgress(totalEarned),
      totalEarned,
      recentEvents: user.xpRecentEvents ?? [],
    });
  } catch (err) {
    console.error("[xp] /me failed:", err);
    res.status(500).json({ error: "Could not load XP" });
  }
});

// ─── POST /api/xp/activity ───────────────────────────────────────────────────
// Body: { type: "session" | "active" | "page", path?: "/skyhub" }
router.post("/activity", requireAuth, async (req, res) => {
  const userId = String(req.user.id);
  const raw = req.body?.type;
  const type = LEGACY_TYPE_MAP[raw] ?? raw;

  if (!ALLOWED_TYPES.has(type)) {
    // e.g. BOOKING_CONFIRMED, POST_CREATED, REFER_FRIEND — server-only now.
    return res.status(403).json({
      awarded: false,
      error: "This XP can't be claimed from the client",
    });
  }
  if (rateLimited(userId)) {
    return res.status(429).json({ awarded: false, error: "Too many requests" });
  }

  try {
    const results = await awardPassiveActivity({
      userId,
      type,
      path: req.body?.path,
    });
    const awarded = results.filter((r) => r?.awarded);

    const user = await User.findById(userId).select("xp pendingXp").lean();

    res.json({
      awarded: awarded.length > 0,
      xp: user?.xp ?? 0,
      pendingXp: user?.pendingXp ?? 0,
      event: awarded[0]?.event ?? null, // kept for the existing frontend
      events: awarded.map((r) => r.event),
      completedChallenges: awarded.flatMap((r) => r.completedChallenges ?? []),
      rankUp:
        awarded
          .map((r) => r.rankUp)
          .filter(Boolean)
          .pop() ?? null,
      reason: awarded.length ? undefined : results[0]?.reason,
    });
  } catch (err) {
    console.error("[xp] /activity failed:", err);
    res.status(500).json({ error: "Could not record activity" });
  }
});

export default router;
