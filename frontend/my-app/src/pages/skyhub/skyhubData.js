// ─────────────────────────────────────────────────────────────
// All static config for SkyHub — NO hardcoded stats or counts.
// Stats come from the backend at runtime.
// ─────────────────────────────────────────────────────────────

// `value` is the internal key SkyHubPage.jsx filters on — keep it stable.
// "following" currently shows only your own posts, so it's labelled
// "Your posts". Rename the label if real following is added later.
export const skyhubTabs = [
  { value: "forYou", label: "For You" },
  { value: "following", label: "Your posts" },
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
