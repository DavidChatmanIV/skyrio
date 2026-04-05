/**
 * passportActivityRules.js
 * Defines XP rewards, stat keys, and display titles for all passport activity types.
 */

export const ACTIVITY_RULES = {
  // ── Onboarding ─────────────────────────────────────────────────────────────
  profile_completed: {
    xp: 100,
    title: "Completed Profile",
    statKey: "profileCompleted",
    setValue: true,
  },

  // ── Flights ────────────────────────────────────────────────────────────────
  flight_searched: {
    xp: 5,
    title: "Searched for a Flight",
    statKey: "flightsSearched",
    increment: 1,
  },
  flight_booked: {
    xp: 50,
    title: "Booked a Flight",
    statKey: "flightsBooked",
    increment: 1,
  },

  // ── Hotels ─────────────────────────────────────────────────────────────────
  hotel_searched: {
    xp: 5,
    title: "Searched for a Hotel",
    statKey: "hotelsSearched",
    increment: 1,
  },
  hotel_booked: {
    xp: 50,
    title: "Booked a Hotel",
    statKey: "hotelsBooked",
    increment: 1,
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  post_created: {
    xp: 10,
    title: "Created a Post",
    statKey: "postsCreated",
    increment: 1,
  },
  post_liked: {
    xp: 2,
    title: "Liked a Post",
    statKey: "postsLiked",
    increment: 1,
  },
  user_followed: {
    xp: 5,
    title: "Followed a Traveler",
    statKey: "usersFollowed",
    increment: 1,
  },

  // ── Price Watches ──────────────────────────────────────────────────────────
  watch_created: {
    xp: 10,
    title: "Set a Price Watch",
    statKey: "watchesCreated",
    increment: 1,
  },
  watch_triggered: {
    xp: 15,
    title: "Price Watch Triggered",
    statKey: "watchesTriggered",
    increment: 1,
  },

  // ── Destinations / Hotspots ────────────────────────────────────────────────
  hotspot_visited: {
    xp: 20,
    title: "Visited a Hotspot",
    statKey: "hotspotsVisited",
    increment: 1,
  },
  destination_saved: {
    xp: 5,
    title: "Saved a Destination",
    statKey: "destinationsSaved",
    increment: 1,
  },

  // ── Streaks / Milestones ───────────────────────────────────────────────────
  daily_login: {
    xp: 10,
    title: "Daily Login",
    statKey: "loginStreak",
    increment: 1,
  },
};

/**
 * XP thresholds per level.
 * Level N is reached when totalXP >= XP_THRESHOLDS[N - 1].
 * Add more entries to extend the level cap.
 */
const XP_THRESHOLDS = [
  0, // Level 1
  100, // Level 2
  250, // Level 3
  500, // Level 4
  850, // Level 5
  1300, // Level 6
  1900, // Level 7
  2600, // Level 8
  3500, // Level 9
  4600, // Level 10
];

/**
 * Derives the current level from a total XP value.
 * Always returns at least 1.
 */
export function calculateLevel(xp = 0) {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Returns XP needed to reach the next level, or null if already at max.
 */
export function xpToNextLevel(xp = 0) {
  const current = calculateLevel(xp);
  const nextThreshold = XP_THRESHOLDS[current]; // index = level (0-based level+1)
  return nextThreshold !== undefined ? nextThreshold - xp : null;
}