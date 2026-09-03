// backend/services/atlasTripModes.js
//
// Server-side mirror of src/components/Atlas/atlasTripModes.js.
// Kept as a separate copy (not shared) because the frontend and backend
// are different bundles/runtimes — this is the version atlasService.js
// uses when a caller relies on ATLAS_DEFAULT_SYSTEM_PROMPT instead of
// passing its own systemPrompt (e.g. a server-side job, a script, or any
// future caller that bypasses AtlasPanel.jsx).
//
// If the two files drift, AtlasPanel.jsx's client-built prompt always wins
// for normal chat traffic — this only affects the default-prompt fallback.

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

export function detectMode(userText) {
  if (!userText || typeof userText !== "string") return null;
  for (const { mode, test } of MODE_PATTERNS) {
    if (test.test(userText)) return mode;
  }
  return null;
}

/**
 * Pulls the most recent user-role message out of a conversation history
 * array (either { role, content } objects or Claude-style content-block
 * messages) so mode detection has something to test against.
 */
export function getLastUserText(conversationHistory) {
  if (!Array.isArray(conversationHistory)) return null;
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg?.role !== "user") continue;
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find((b) => b.type === "text");
      if (textBlock?.text) return textBlock.text;
    }
  }
  return null;
}
