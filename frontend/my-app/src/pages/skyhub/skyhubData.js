export const skyhubTabs = [
  { value: "forYou", label: "For You" },
  { value: "following", label: "Following" },
  { value: "nearby", label: "Nearby" },
  { value: "trips", label: "Trips" },
  { value: "questions", label: "Questions" },
];

export const skyhubFilters = [
  "All",
  "Budget",
  "Luxury",
  "Solo",
  "Family",
  "Food",
  "Hidden Gems",
  "Safety",
  "Weekend Trips",
];

// ── NO skyhubStats export — stats fetched live from /api/skyhub/stats ──
// If that endpoint doesn't exist yet, SkyHubPage shows nothing rather
// than fake numbers. Update skyhub.routes.js to add the endpoint.
