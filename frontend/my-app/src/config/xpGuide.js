// Plain facts about XP for the tour and the rewards page — one place, so
// every screen says the same thing.
//
// Numbers mirror backend/config/xpRules.js. If you change XP there,
// change it here too.

export const RANKS = [
  { name: "Explorer", minXp: 0, color: "#60a5fa" },
  { name: "Adventurer", minXp: 100, color: "#f59e0b" },
  { name: "Voyager", minXp: 300, color: "#34d399" },
  { name: "Navigator", minXp: 600, color: "#22d3ee" },
  { name: "Trailblazer", minXp: 1000, color: "#f97316" },
  { name: "Globetrotter", minXp: 1500, color: "#a78bfa" },
  { name: "Elite", minXp: 2500, color: "#ec4899" },
  { name: "Legend", minXp: 4000, color: "#fbbf24" },
];

// What each rank unlocks. ONLY list things that really work, or mark them
// as coming soon:
//   { text: "Early access to new destinations", status: "live" }
//   { text: "Priority support",                  status: "soon" }
// A rank with an empty list simply shows no perks. Nothing here is
// promised to travelers until you add it.
export const RANK_PERKS = {
  Explorer: [],
  Adventurer: [],
  Voyager: [],
  Navigator: [],
  Trailblazer: [],
  Globetrotter: [],
  Elite: [],
  Legend: [],
};

export const hasAnyRankPerks = () =>
  Object.values(RANK_PERKS).some((list) => list.length > 0);

// How XP is earned (base amounts, before any membership bonus).
export const XP_EARN = {
  flightMin: 120, // flights with 2+ stops
  flightMax: 150, // nonstop flights
  hotel: 150,
  firstBooking: 50,
  firstInternational: 75,
  profileCompleted: 50,
  engagementDaily: 30, // SkyHub posts, comments, likes, daily visits…
  engagementWeekly: 100,
  bookingHoldHours: 24, // booking XP counts this long after the trip starts
};
