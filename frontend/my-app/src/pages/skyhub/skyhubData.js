// ─────────────────────────────────────────────────────────────
// skyhubData.js
// All static config for SkyHub — NO hardcoded stats or counts.
// Stats come from the backend at runtime.
// ─────────────────────────────────────────────────────────────

export const skyhubTabs = [
  { value: "forYou", label: "For You" },
  { value: "following", label: "Following" },
  { value: "nearby", label: "Nearby" },
  { value: "trips", label: "Trips" },
  { value: "questions", label: "Questions" },
];

// "Team Travel" excluded from display (kept here for data mapping)
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

// Stats are computed live from feed data in SkyHubPage.jsx — no static export needed.
