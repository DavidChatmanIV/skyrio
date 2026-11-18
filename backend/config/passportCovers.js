// Passport covers: rewards that restyle the Digital Passport. The traveler
// picks which owned cover to show (User.passportCover). Same keys are used by
// the frontend (PassportDataPage COVERS).
export const COVER_BY_ITEM = {
  golden_hour_cover: "golden",
  aurora_cover: "aurora",
  midnight_runway_cover: "midnight",
  legend_foil_cover: "legend",
  team_colors_cover: "team",
};

// Team Colors cover: the traveler picks two colors and a sport's lines
// (User.passportTeamColors). Same lists as the frontend teamColors.jsx.
export const TEAM_PATTERNS = ["none", "stripes", "court", "field", "pitch", "diamond", "rink"];
const HEX = /^#[0-9a-f]{6}$/i;
/** { primary, secondary, pattern } with only real colors and known patterns, else null. */
export function cleanTeamColors(t) {
  if (!t || !HEX.test(t.primary || "") || !HEX.test(t.secondary || "")) return null;
  return {
    primary: t.primary.toUpperCase(),
    secondary: t.secondary.toUpperCase(),
    pattern: TEAM_PATTERNS.includes(t.pattern) ? t.pattern : "none",
  };
}

// For every plan (no minPlan). Colors only: no team names or logos.
export const TEAM_COLORS_REWARD = {
  itemId: "team_colors_cover",
  type: "PERK",
  title: "Team Colors Passport cover",
  desc: "Your team's two colors and your sport's lines on your Digital Passport. Any team, any sport. Change them anytime.",
  cost: 250,
  isNewItem: true,
};

export const PLAN_RANK = { free: 0, explorer: 1, legend: 2 };
export const planRank = (plan) => PLAN_RANK[String(plan || "free").toLowerCase()] ?? 0;

// Rewards created at startup if missing (members-only covers below, plus
// Team Colors). Members-only rewards. Created (turned on) at startup if missing; edits made
// in the admin rewards screen are never overwritten. Paid for with XP like
// any reward, and yours to keep if you cancel later.
export const MEMBER_REWARDS = [
  {
    itemId: "aurora_cover",
    type: "PERK",
    title: "Aurora Passport cover",
    desc: "Northern-lights greens and purples for your Digital Passport. Yours to keep.",
    cost: 300,
    minPlan: "explorer",
    isNewItem: true,
  },
  {
    itemId: "midnight_runway_cover",
    type: "PERK",
    title: "Midnight Runway Passport cover",
    desc: "Deep night blue with a row of runway lights. Yours to keep.",
    cost: 300,
    minPlan: "explorer",
    isNewItem: true,
  },
  {
    itemId: "legend_foil_cover",
    type: "LIMITED",
    title: "Legend Gold Foil Passport cover",
    desc: "Black and gold foil for your Digital Passport. Yours to keep.",
    cost: 500,
    minPlan: "legend",
    isNewItem: true,
  },
];

// Everything ensureMemberRewards() adds at startup if missing.
export const SEEDED_REWARDS = [...MEMBER_REWARDS, TEAM_COLORS_REWARD];
