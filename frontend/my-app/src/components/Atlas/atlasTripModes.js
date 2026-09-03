// src/components/Atlas/atlasTripModes.js
//
// Intent-based prompt modes for Atlas. Detected from the user's latest
// message and appended to the base system prompt built in AtlasPanel.jsx.
// Mirrors the pattern used by atlasTripTypes.js (TRIP_TYPE_GUIDANCE, etc).

export const MODE_LABELS = {
  itinerary: "Day-by-Day Itinerary",
  stay_match: "Stay & Area Match",
  backup_plan: "Backup Plan",
  budget: "Budget Mode",
  luxury_budget: "Luxury on a Budget",
  food_guide: "Food Guide",
  local_secrets: "Local Secrets",
};

export const MODE_GUIDANCE = {
  itinerary: `
MODE: DAY-BY-DAY ITINERARY
Build a day-by-day plan. For each day: best time to visit each stop, realistic
travel time between stops, transport options, approximate costs, food
recommendations, one hidden gem, rest periods, and a backup option if weather
or closures disrupt the plan. Keep days balanced — don't overpack.`.trim(),

  stay_match: `
MODE: STAY & AREA MATCH
Compare top neighborhoods/areas for this destination on: budget fit, safety,
walkability, nightlife, food scene, public transport, airport access, and
proximity to attractions. Rank the top 2-3 areas, explain trade-offs, then
recommend one area + accommodation type for this specific trip.`.trim(),

  backup_plan: `
MODE: BACKUP PLAN
Identify likely failure points for this trip: bad weather, canceled
activities, delayed flights, closed attractions, transport issues,
overspending, scams, lost reservations, sudden itinerary changes. For each:
fastest practical fix, a backup activity/route, and what to prepare
beforehand so it doesn't ruin the day.`.trim(),

  budget: `
MODE: BUDGET
Build a realistic daily budget. Find best-value flights, affordable stays,
cheap local transport, low-cost attractions, food strategies, free
activities. Flag common tourist overspend traps for this destination. Keep
it under the user's stated budget without making the trip feel cheap or
inconvenient.`.trim(),

  luxury_budget: `
MODE: LUXURY ON A BUDGET
Identify where extra spend creates the biggest experiential improvement
(hotel category, one splurge meal, a private/skip-line experience) and where
paying more is unnecessary. Suggest cheaper alternatives to overpriced
tourist-marketed options.`.trim(),

  food_guide: `
MODE: FOOD GUIDE
Cover must-try local dishes, breakfast spots, cafes, street food, lunch,
dinner, dessert, markets, and food-focused neighborhoods. Build into a
day-by-day food route with approximate prices and reservation notes.
Prioritize places that read as genuinely local. This is general-knowledge
guidance, not live inventory data — tell the user to double-check hours and
availability before relying on it.`.trim(),

  local_secrets: `
MODE: LOCAL SECRETS
Surface underrated spots, local cafes, scenic areas, cultural experiences,
nightlife, and activities most visitors miss. Organize by area/neighborhood,
explain what makes each worth it, and the best time of day to go. This is
general-knowledge guidance, not live inventory data — tell the user to
double-check specifics before relying on it.`.trim(),
};

// Ordered so more specific phrases are checked before generic ones.
const MODE_PATTERNS = [
  {
    mode: "backup_plan",
    test: /backup plan|what if it rains|flight (gets |is )?delayed|plan b|goes wrong/i,
  },
  {
    mode: "luxury_budget",
    test: /luxury|splurge|premium|upgrade my trip|make .* feel (expensive|premium)/i,
  },
  {
    mode: "budget",
    test: /budget travel|cheap(est)?|save money|under \$|low[- ]cost|shoestring/i,
  },
  {
    mode: "stay_match",
    test: /where should i stay|best (area|neighborhood)|which neighborhood|where to stay/i,
  },
  {
    mode: "food_guide",
    test: /where to eat|restaurants?|food guide|best food|street food|cafes?/i,
  },
  {
    mode: "local_secrets",
    test: /hidden gems?|local secrets?|off the beaten path|like a local|underrated/i,
  },
  {
    mode: "itinerary",
    test: /day[- ]by[- ]day|itinerary|daily (plan|schedule)|build me a \d+[- ]day/i,
  },
];

/**
 * Detects the best-fit mode from a user's message.
 * Returns a mode key (string) or null if nothing matches — in which case
 * the base system prompt (general trip planning) is used as-is.
 */
export function detectMode(userText) {
  if (!userText || typeof userText !== "string") return null;
  for (const { mode, test } of MODE_PATTERNS) {
    if (test.test(userText)) return mode;
  }
  return null;
}
