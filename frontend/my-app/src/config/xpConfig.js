// ─── Tier ladder ──────────────────────────────────────────────────────────────
// MUST match backend/config/xpRules.js XP_LEVELS (names, thresholds, colors).
// Rank is always computed from LIFETIME XP (totalEarned), never the spendable balance.
//
// iconKey → SVG icon rendered by <TierIcon /> (components/passport/TierIcon.jsx).
// `icon` (emoji) is kept only as a plain-text fallback for toasts / share text.
export const XP_TIERS = [
  {
    name: "Explorer",
    iconKey: "compass",
    icon: "🧭",
    min: 0,
    max: 100,
    color: "#60a5fa",
    description: "Just getting started",
  },
  {
    name: "Adventurer",
    iconKey: "bolt",
    icon: "⚡",
    min: 100,
    max: 300,
    color: "#f59e0b",
    description: "Finding your wings",
  },
  {
    name: "Voyager",
    iconKey: "wave",
    icon: "🌊",
    min: 300,
    max: 600,
    color: "#34d399",
    description: "Open waters ahead",
  },
  {
    name: "Navigator",
    iconKey: "map",
    icon: "🗺️",
    min: 600,
    max: 1000,
    color: "#22d3ee",
    description: "Charting your own course",
  },
  {
    name: "Trailblazer",
    iconKey: "flame",
    icon: "🔥",
    min: 1000,
    max: 1500,
    color: "#f97316",
    description: "Blazing new paths",
  },
  {
    name: "Globetrotter",
    iconKey: "globe",
    icon: "🌍",
    min: 1500,
    max: 2500,
    color: "#a78bfa",
    description: "The world is your runway",
  },
  {
    name: "Elite",
    iconKey: "star",
    icon: "⭐",
    min: 2500,
    max: 4000,
    color: "#ec4899",
    description: "Among the best in the skies",
  },
  {
    name: "Legend",
    iconKey: "crown",
    icon: "👑",
    min: 4000,
    max: Infinity,
    color: "#fbbf24",
    description: "Skyrio royalty",
  },
];

// ─── Plan XP multipliers ─────────────────────────────────────────────────────
// ⚠️ Display only — the backend applies the real multiplier using user.plan
// (free / explorer / legend). Update these keys to match when you finalize pricing.
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

/** Tier object for a given LIFETIME XP total */
export function getTier(xp) {
  const n = Number(xp) || 0;
  return [...XP_TIERS].reverse().find((t) => n >= t.min) ?? XP_TIERS[0];
}

/** Next tier object, or null if already Legend */
export function getNextTier(xp) {
  const n = Number(xp) || 0;
  return XP_TIERS.find((t) => n < t.min) ?? null;
}

/** Tier by name ("Globetrotter"), case-insensitive — for values coming from the API */
export function getTierByName(name) {
  const key = String(name || "").toLowerCase();
  return XP_TIERS.find((t) => t.name.toLowerCase() === key) ?? null;
}

/** 0–100 progress % within the current tier */
export function getTierProgress(xp) {
  const n = Number(xp) || 0;
  const tier = getTier(n);
  const next = getNextTier(n);
  if (!next) return 100;
  return Math.min(100, ((n - tier.min) / (tier.max - tier.min)) * 100);
}

/** Apply a plan multiplier to a base XP amount */
export function applyMultiplier(baseXP, plan = "free") {
  return baseXP * (XP_MULTIPLIERS[plan] ?? 1);
}
