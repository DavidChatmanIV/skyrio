// ─── Tier ladder ──────────────────────────────────────────────────────────────
export const XP_TIERS = [
  { name: "Explorer", icon: "🧭", min: 0, max: 100, color: "#60a5fa" },
  { name: "Adventurer", icon: "⚡", min: 100, max: 300, color: "#f59e0b" },
  { name: "Voyager", icon: "🌊", min: 300, max: 700, color: "#34d399" },
  { name: "Pathfinder", icon: "🔥", min: 700, max: 1500, color: "#f97316" },
  { name: "Trailblazer", icon: "💎", min: 1500, max: 3000, color: "#a78bfa" },
  { name: "Legend", icon: "👑", min: 3000, max: Infinity, color: "#fbbf24" },
];

// ─── Plan XP multipliers ─────────────────────────────────────────────────────
export const XP_MULTIPLIERS = {
  free: 1,
  pro: 2,
  elite: 3,
};

// ─── Passive activity rules (used in the earn-XP table UI) ───────────────────
export const XP_PASSIVE = {
  DAILY_SESSION: {
    xp: 5,
    label: "Daily visit",
    icon: "🏠",
    dailyLimit: 1,
    intervalMs: null,
  },
  ACTIVE_INTERVAL: {
    xp: 3,
    label: "5 min active on SkyHub",
    icon: "⏱️",
    dailyLimit: 5,
    intervalMs: 5 * 60 * 1000,
  },
  PAGE_VISIT: {
    xp: 1,
    label: "Explored a new page",
    icon: "🗺️",
    dailyLimit: 10,
    intervalMs: null,
  },
  STREAK_DAY: {
    xp: 10,
    label: "Daily login streak",
    icon: "🔥",
    dailyLimit: 1,
    intervalMs: null,
  },
  STREAK_WEEK: {
    xp: 50,
    label: "7-day streak bonus",
    icon: "🔥",
    dailyLimit: null,
    intervalMs: null,
  },
  STREAK_MONTH: {
    xp: 200,
    label: "30-day streak bonus",
    icon: "🏆",
    dailyLimit: null,
    intervalMs: null,
  },
};

// ─── Active action rules (used in the earn-XP table UI) ──────────────────────
export const XP_RULES = {
  BOOKING_CONFIRMED: { xp: 120, label: "Booking confirmed", icon: "✈️" },
  FIRST_INTERNATIONAL: {
    xp: 80,
    label: "First international booking",
    icon: "🌍",
    once: true,
  },
  SAVED_TRIP: { xp: 15, label: "Saved a trip", icon: "💾" },
  PROFILE_COMPLETED: {
    xp: 60,
    label: "Completed profile",
    icon: "👤",
    once: true,
  },
  FEEDBACK_SUBMITTED: { xp: 25, label: "Submitted feedback", icon: "📝" },
  POST_CREATED: { xp: 10, label: "Created a post", icon: "📡" },
  COMMENT_CREATED: { xp: 5, label: "Commented", icon: "💬" },
  SHARE_SKYSTREAM: { xp: 10, label: "Shared on SkyStream", icon: "📡" },
  REFER_FRIEND: { xp: 60, label: "Referred a friend", icon: "🤝" },
  ELITE_MONTHLY_BONUS: { xp: 200, label: "Elite monthly XP bonus", icon: "👑" },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Tier object for a given XP total */
export function getTier(xp) {
  return [...XP_TIERS].reverse().find((t) => xp >= t.min) ?? XP_TIERS[0];
}

/** Next tier object, or null if already Legend */
export function getNextTier(xp) {
  return XP_TIERS.find((t) => xp < t.min) ?? null;
}

/** 0–100 progress % within the current tier */
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
