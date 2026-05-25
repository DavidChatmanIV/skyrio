/**
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for every XP action in Skyrio.
 *
 * DIFFICULTY: Medium / Hard
 *   • Early ranks (Explorer → Adventurer) are achievable in days
 *   • Mid ranks (Voyager → Pathfinder) take consistent weekly use
 *   • Top ranks (Trailblazer → Legend) require months of engagement
 *
 * PASSIVE XP (SkyHub activity — awarded via /api/xp/activity):
 *   These fire automatically based on client-side signals.
 *   All passive awards are subject to XP_DAILY_CAP.
 *
 * ACTIVE XP (explicit user actions — awarded at event points in app):
 *   Call addXP(userId, XP_RULES.ACTION_KEY.xp) at the right moment.
 * ─────────────────────────────────────────────────────────────
 */

// ─── Tier Ladder ─────────────────────────────────────────────────────────────
export const XP_TIERS = [
  { name: "Explorer", icon: "🧭", min: 0, max: 150, color: "#60a5fa" },
  { name: "Adventurer", icon: "⚡", min: 150, max: 400, color: "#f59e0b" },
  { name: "Voyager", icon: "🌊", min: 400, max: 800, color: "#34d399" },
  { name: "Pathfinder", icon: "🔥", min: 800, max: 1600, color: "#f97316" },
  { name: "Trailblazer", icon: "💎", min: 1600, max: 4000, color: "#a78bfa" },
  { name: "Legend", icon: "👑", min: 4000, max: Infinity, color: "#fbbf24" },
];

// ─── Membership XP Multipliers ────────────────────────────────────────────────
export const XP_MULTIPLIERS = {
  free: 1,
  pro: 2, // Sky Pro:   2× all XP
  elite: 3, // Sky Elite: 3× all XP
};

// ─── Passive: SkyHub Activity ─────────────────────────────────────────────────
// Fired automatically by the frontend activity tracker.
// Each key maps to a string sent to POST /api/xp/activity.
export const XP_PASSIVE = {
  DAILY_SESSION: {
    xp: 5,
    label: "Daily visit",
    icon: "🏠",
    dailyLimit: 1, // once per calendar day
  },
  ACTIVE_INTERVAL: {
    xp: 3,
    label: "5 min active on SkyHub",
    icon: "⏱️",
    dailyLimit: 5, // max +15 XP/day from time-on-site
    intervalMs: 5 * 60 * 1000,
  },
  PAGE_VISIT: {
    xp: 1,
    label: "Explored a new page",
    icon: "🗺️",
    dailyLimit: 10, // max +10 XP/day from browsing
  },
  STREAK_DAY: {
    xp: 10,
    label: "Daily login streak",
    icon: "🔥",
    dailyLimit: 1,
  },
  STREAK_WEEK: {
    xp: 50,
    label: "7-day streak bonus",
    icon: "🔥",
    // awarded when streak % 7 === 0
  },
  STREAK_MONTH: {
    xp: 200,
    label: "30-day streak bonus",
    icon: "🏆",
    // awarded when streak % 30 === 0
  },
};

// ─── Active: Explicit User Actions ───────────────────────────────────────────
export const XP_RULES = {
  // ── Core ──
  BOOKING_CONFIRMED: {
    xp: 120,
    label: "Booking confirmed",
    icon: "✈️",
  },
  FIRST_INTERNATIONAL: {
    xp: 80,
    label: "First international booking",
    icon: "🌍",
    once: true, // flag: backend should only award once per user
  },
  SAVED_TRIP: {
    xp: 15,
    label: "Saved a trip",
    icon: "💾",
  },

  // ── Profile / Onboarding ──
  PROFILE_COMPLETED: {
    xp: 60,
    label: "Completed profile",
    icon: "👤",
    once: true,
  },
  FEEDBACK_SUBMITTED: {
    xp: 25,
    label: "Submitted feedback",
    icon: "📝",
  },

  // ── Social / SkyStream ──
  POST_CREATED: {
    xp: 10,
    label: "Created a post",
    icon: "📡",
  },
  COMMENT_CREATED: {
    xp: 5,
    label: "Commented",
    icon: "💬",
  },
  SHARE_SKYSTREAM: {
    xp: 10,
    label: "Shared on SkyStream",
    icon: "📡",
  },

  // ── Growth ──
  REFER_FRIEND: {
    xp: 60,
    label: "Referred a friend",
    icon: "🤝",
    // award when referred user completes first booking
  },

  // ── Admin / Seasonal ──
  SEASONAL_AWARD: {
    xp: 0,
    label: "Seasonal award (amount set by admin)",
    icon: "🎁",
  },
  ADMIN_GRANT: {
    xp: 0,
    label: "Admin grant (amount set by admin)",
    icon: "⚙️",
  },

  // ── Membership bonus (Elite) ──
  ELITE_MONTHLY_BONUS: {
    xp: 200,
    label: "Elite monthly XP bonus",
    icon: "👑",
    // awarded by a monthly cron job for all elite members
  },
};

// ─── Guardrails ───────────────────────────────────────────────────────────────
export const XP_DAILY_CAP = 500; // soft launch guardrail (all sources combined)
export const XP_MAX_SINGLE_AWARD = 1000; // single-award ceiling (admin can override)

// ─── Helpers (shared frontend + backend via alias) ────────────────────────────

/** Get the tier object for a given XP value */
export function getTier(xp) {
  return [...XP_TIERS].reverse().find((t) => xp >= t.min) ?? XP_TIERS[0];
}

/** Get the next tier, or null if at Legend */
export function getNextTier(xp) {
  return XP_TIERS.find((t) => xp < t.min) ?? null;
}

/** 0–100 progress percentage within the current tier */
export function getTierProgress(xp) {
  const tier = getTier(xp);
  const next = getNextTier(xp);
  if (!next) return 100;
  return Math.min(100, ((xp - tier.min) / (tier.max - tier.min)) * 100);
}

/** Apply a plan multiplier to a base XP amount */
export function applyMultiplier(baseXP, plan = "free") {
  return baseXP * (XP_MULTIPLIERS[plan] ?? 1);
}
