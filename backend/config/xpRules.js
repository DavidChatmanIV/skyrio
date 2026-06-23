/**
 * ─────────────────────────────────────────────────────────────
 * Skyrio XP System — Single Source of Truth
 *
 * DIFFICULTY CURVE (intentionally balanced):
 *   Explorer  → Adventurer : ~1 active session + 1 post
 *   Adventurer→ Voyager    : a few days of engagement
 *   Voyager   → Navigator  : ~1 week of consistent use
 *   Navigator → Trailblazer: ~2 weeks + a booking
 *   Trailblazer→ Globetrotter: consistent monthly use
 *   Globetrotter→ Elite    : power user (multiple bookings)
 *   Elite     → Legend     : dedicated long-term user
 *
 * PASSIVE XP (SkyHub activity — /api/xp/activity):
 *   Fired automatically by the frontend activity tracker.
 *   Subject to XP_DAILY_CAP.
 *
 * ACTIVE XP (explicit user actions — called at event points):
 *   Call addXP(userId, XP_RULES.ACTION_KEY.xp) at the right moment.
 * ─────────────────────────────────────────────────────────────
 */

// ─── SVG Icon Library ─────────────────────────────────────────────────────────
export const XP_ICONS = {
  compass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clip-rule="evenodd"/><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zM6.44 7.25a.75.75 0 011.06 0l2.25 2.25 2.25-2.25a.75.75 0 011.06 1.06l-2.75 2.75a.75.75 0 01-1.06 0L6.44 8.31a.75.75 0 010-1.06z"/></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z"/></svg>`,
  wave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 6.75C3.5 5.784 4.284 5 5.25 5h.75a.75.75 0 010 1.5h-.75a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25h-.75a.75.75 0 010-1.5h.75c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0114.75 15H5.25A1.75 1.75 0 013.5 13.25v-6.5zM10 2a.75.75 0 01.75.75v8.69l1.22-1.22a.75.75 0 111.06 1.06l-2.5 2.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 111.06-1.06l1.22 1.22V2.75A.75.75 0 0110 2z"/></svg>`,
  map: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.157 2.176a1.5 1.5 0 00-1.147 0l-4.084 1.69A1.5 1.5 0 002 5.25v10.877a1.5 1.5 0 002.074 1.386l3.51-1.453 4.26 1.763a1.5 1.5 0 001.146 0l4.083-1.69A1.5 1.5 0 0018 14.75V3.873a1.5 1.5 0 00-2.073-1.386l-3.51 1.452-4.26-1.763zM7.58 5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 017.58 5zm5.59 2.5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/></svg>`,
  flame: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a.75.75 0 01.675.423l1.25 2.5a.75.75 0 01-.67 1.077H6.75l-.002.001c.064.063.132.125.203.183.51.415 1.064.757 1.627 1.095.992.593 2.023 1.209 2.738 2.289C12 10.531 12.25 11.5 12.25 13a5.25 5.25 0 01-10.5 0c0-1.613.455-2.91 1.32-3.955.864-1.043 2.054-1.745 3.3-2.416l.07-.038A.75.75 0 016 6.25a.75.75 0 01-.696-1.034l.946-2.364A.75.75 0 017 2.5h2zm2.65 11.5c.356-.693.6-1.427.6-2 0-1.142-.39-1.86-.853-2.555-.197-.293-.413-.547-.627-.79.046.436.07.888.07 1.345 0 1.656-.413 3.12-1.19 4z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-1.503.204A6.5 6.5 0 1110 3.5a6.5 6.5 0 016.497 6.704zM10 5.5a.5.5 0 01.5.5v3.586l1.207 1.207a.5.5 0 01-.707.707l-1.354-1.353A.5.5 0 019.5 9.75V6a.5.5 0 01.5-.5z" clip-rule="evenodd"/></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd"/></svg>`,
  crown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 1a.75.75 0 01.67.415l2.58 5.16 5.665.824a.75.75 0 01.416 1.279l-4.098 3.994.967 5.638a.75.75 0 01-1.088.791L10 16.347l-5.112 2.754a.75.75 0 01-1.088-.79l.968-5.639L.67 8.678a.75.75 0 01.416-1.28l5.666-.823L9.33 1.415A.75.75 0 0110 1z" clip-rule="evenodd"/></svg>`,
  plane: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.25.25 0 010 .5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.114A28.897 28.897 0 003.105 2.289z"/></svg>`,
  earth: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.007A6.003 6.003 0 014.332 8.027z" clip-rule="evenodd"/></svg>`,
  bookmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2.41 2.41A1.5 1.5 0 013.5 2h13A1.5 1.5 0 0118 3.5v13a1.5 1.5 0 01-2.56 1.06L10 12.12l-5.44 5.44A1.5 1.5 0 012 16.5v-13c0-.4.16-.78.41-1.09z"/></svg>`,
  user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"/></svg>`,
  chat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a40.012 40.012 0 004.66-.603c1.437-.231 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.102 41.102 0 0010 2z" clip-rule="evenodd"/></svg>`,
  broadcast: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z"/><path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
  handshake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 5.25a.75.75 0 00-1.5 0V8.5H6.5a.75.75 0 000 1.5h2.75v3.25a.75.75 0 001.5 0V10H13.5a.75.75 0 000-1.5h-2.75V5.25z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-5.657-5.657a6 6 0 118.485-8.485 6 6 0 01-8.485 8.485z" clip-rule="evenodd"/></svg>`,
  gift: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 4A2.5 2.5 0 007 6.5h3V4a2.5 2.5 0 10-5.5 0zm-.5 8H3.5a2 2 0 01-2-2V9.5A1.5 1.5 0 013 8h7.5v4H4zM12.5 8H17a1.5 1.5 0 011.5 1.5V10a2 2 0 01-2 2h-4V8zm0-1.5V4a2.5 2.5 0 10-2 2.45V6.5h2z"/><path d="M3.5 13H10v5H5a1.5 1.5 0 01-1.5-1.5V13zM10 13h6.5v3.5A1.5 1.5 0 0115 18h-5v-5z"/></svg>`,
  wrench: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M19 5.5a4.5 4.5 0 01-4.791 4.49c-.873-.055-1.808.128-2.368.8l-6.024 7.23a2.724 2.724 0 11-3.837-3.837L9.21 8.16c.672-.56.855-1.495.8-2.368A4.5 4.5 0 0114.5 1a.75.75 0 01.53 1.28l-1.78 1.78a1 1 0 001.415 1.414l1.779-1.78A.75.75 0 0119 5.5zm-8.279 6.988l-6.024 7.23 1.783-1.782a1 1 0 01-1.415-1.414l6.024-7.23-.368.197z" clip-rule="evenodd"/></svg>`,
  timer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clip-rule="evenodd"/></svg>`,
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clip-rule="evenodd"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7a13.067 13.067 0 01.104-1.589.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.749z" clip-rule="evenodd"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>`,
};

// ─── 8-Level Rank Ladder ──────────────────────────────────────────────────────
export const XP_LEVELS = [
  {
    name: "Explorer",
    minXp: 0,
    iconKey: "compass",
    color: "#60a5fa",
    description: "Just getting started",
  },
  {
    name: "Adventurer",
    minXp: 100,
    iconKey: "bolt",
    color: "#f59e0b",
    description: "Finding your wings",
  },
  {
    name: "Voyager",
    minXp: 300,
    iconKey: "wave",
    color: "#34d399",
    description: "Open waters ahead",
  },
  {
    name: "Navigator",
    minXp: 600,
    iconKey: "map",
    color: "#22d3ee",
    description: "Charting your own course",
  },
  {
    name: "Trailblazer",
    minXp: 1000,
    iconKey: "flame",
    color: "#f97316",
    description: "Blazing new paths",
  },
  {
    name: "Globetrotter",
    minXp: 1500,
    iconKey: "globe",
    color: "#a78bfa",
    description: "The world is your runway",
  },
  {
    name: "Elite",
    minXp: 2500,
    iconKey: "star",
    color: "#ec4899",
    description: "Among the best in the skies",
  },
  {
    name: "Legend",
    minXp: 4000,
    iconKey: "crown",
    color: "#fbbf24",
    description: "Skyrio royalty",
  },
];

// ─── Membership XP Multipliers ────────────────────────────────────────────────
// Keys match User.plan's real enum: free / explorer / legend.
// (Previously free/pro/elite — a field that never existed on the User model,
// so this multiplier always silently fell back to 1 for everyone. Fixed
// alongside routes/xp.js, which now reads user.plan instead of a separate
// membershipPlan field.)
//
// ⚠️ Naming heads-up: "explorer" and "legend" here are MEMBERSHIP PLAN tiers
// (paid subscription names), but XP_LEVELS above also has rank tiers
// literally named "Explorer" (rank 1, 0 XP — where every user starts) and
// "Legend" (rank 8, 4000 XP — the top rank). Those are two unrelated
// concepts sharing the same words. A free-tier user who's grinded their way
// to "Legend" rank, and a user who's paid for the "Legend" membership plan,
// are two completely different people — but any UI copy that just says
// "You're Legend!" won't be able to tell them apart. Worth renaming one set
// of these (probably the membership plan tiers, since the XP rank ladder
// already has a full design — icons, colors, descriptions — built around its
// names) before this reaches more surfaces.
export const XP_MULTIPLIERS = {
  free: 1,
  explorer: 1.5,
  legend: 2.5,
};

// ─── Passive: SkyHub Activity ─────────────────────────────────────────────────
export const XP_PASSIVE = {
  DAILY_SESSION: {
    xp: 5,
    label: "Daily visit",
    iconKey: "home",
    dailyLimit: 1,
  },
  ACTIVE_INTERVAL: {
    xp: 3,
    label: "5 min active on SkyHub",
    iconKey: "timer",
    dailyLimit: 5,
    intervalMs: 5 * 60 * 1000,
  },
  PAGE_VISIT: {
    xp: 1,
    label: "Explored a new page",
    iconKey: "map",
    dailyLimit: 10,
  },
  STREAK_DAY: {
    xp: 10,
    label: "Daily login streak",
    iconKey: "flame",
    dailyLimit: 1,
  },
  STREAK_WEEK: { xp: 50, label: "7-day streak bonus", iconKey: "flame" },
  STREAK_MONTH: { xp: 150, label: "30-day streak bonus", iconKey: "crown" },
};

// ─── Active: Explicit User Actions ───────────────────────────────────────────
export const XP_RULES = {
  BOOKING_CONFIRMED: { xp: 100, label: "Booking confirmed", iconKey: "plane" },
  FIRST_BOOKING: {
    xp: 50,
    label: "First booking ever",
    iconKey: "plane",
    once: true,
  },
  FIRST_INTERNATIONAL: {
    xp: 75,
    label: "First international booking",
    iconKey: "earth",
    once: true,
  },
  SAVED_TRIP: {
    xp: 10,
    label: "Saved a trip",
    iconKey: "bookmark",
    dailyLimit: 5,
  },
  PROFILE_COMPLETED: {
    xp: 50,
    label: "Completed profile",
    iconKey: "user",
    once: true,
  },
  FEEDBACK_SUBMITTED: {
    xp: 20,
    label: "Submitted feedback",
    iconKey: "chat",
    dailyLimit: 2,
  },
  POST_CREATED: {
    xp: 10,
    label: "Created a post",
    iconKey: "broadcast",
    dailyLimit: 10,
  },
  COMMENT_CREATED: {
    xp: 5,
    label: "Commented",
    iconKey: "chat",
    dailyLimit: 20,
  },
  POST_LIKED_RECEIVED: {
    xp: 2,
    label: "Your post got a like",
    iconKey: "star",
    dailyLimit: 25,
  },
  SHARE_SKYSTREAM: {
    xp: 8,
    label: "Shared on SkyStream",
    iconKey: "broadcast",
    dailyLimit: 5,
  },
  REFER_FRIEND: { xp: 60, label: "Referred a friend", iconKey: "handshake" },
  SEASONAL_AWARD: { xp: 0, label: "Seasonal award", iconKey: "gift" },
  ADMIN_GRANT: { xp: 0, label: "Admin grant", iconKey: "wrench" },
  ELITE_MONTHLY_BONUS: {
    xp: 150,
    label: "Elite monthly XP bonus",
    iconKey: "crown",
  },
  PRO_MONTHLY_BONUS: { xp: 50, label: "Pro monthly XP bonus", iconKey: "star" },
};

// ─── Guardrails ───────────────────────────────────────────────────────────────
export const XP_DAILY_CAP = 400;
export const XP_MAX_SINGLE_AWARD = 500;

// ─── Core Helper: getLevel ────────────────────────────────────────────────────
export function getLevel(xp) {
  const x = Number(xp || 0);
  let currentIdx = 0;
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (x >= XP_LEVELS[i].minXp) {
      currentIdx = i;
      break;
    }
  }
  const current = XP_LEVELS[currentIdx];
  const next = XP_LEVELS[currentIdx + 1] ?? null;

  const xpIntoLevel = next ? x - current.minXp : 0;
  const xpNeeded = next ? next.minXp - current.minXp : 0;
  const percent = next
    ? Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
    : 100;

  return {
    current,
    next,
    xp: x,
    xpIntoLevel,
    xpNeeded,
    xpToNext: next ? next.minXp - x : 0,
    percent,
    icon: XP_ICONS[current.iconKey],
    nextIcon: next ? XP_ICONS[next.iconKey] : null,
  };
}

// ─── Legacy aliases — keep so existing imports don't break ───────────────────
/** @deprecated use XP_LEVELS */
export const XP_TIERS = XP_LEVELS;

/** @deprecated use getLevel(xp).current */
export function getTier(xp) {
  const { current } = getLevel(xp);
  return {
    name: current.name,
    color: current.color,
    icon: current.iconKey,
    min: current.minXp,
  };
}

/** @deprecated use getLevel(xp).next */
export function getNextTier(xp) {
  const { next } = getLevel(xp);
  if (!next) return null;
  return { name: next.name, color: next.color, min: next.minXp };
}

/** @deprecated use getLevel(xp).percent */
export function getTierProgress(xp) {
  return getLevel(xp).percent;
}

/** Apply a plan multiplier to a base XP amount */
export function applyMultiplier(baseXP, plan = "free") {
  return Math.round(baseXP * (XP_MULTIPLIERS[plan] ?? 1));
}

/** Resolve the SVG string for any XP rule or passive event */
export function getXPIcon(iconKey) {
  return XP_ICONS[iconKey] ?? XP_ICONS.star;
}
