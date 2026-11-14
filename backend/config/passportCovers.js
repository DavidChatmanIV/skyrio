// Passport covers: rewards that restyle the Digital Passport. The traveler
// picks which owned cover to show (User.passportCover). Same keys are used by
// the frontend (PassportDataPage COVERS).
export const COVER_BY_ITEM = {
  golden_hour_cover: "golden",
  aurora_cover: "aurora",
  midnight_runway_cover: "midnight",
  legend_foil_cover: "legend",
};

export const PLAN_RANK = { free: 0, explorer: 1, legend: 2 };
export const planRank = (plan) => PLAN_RANK[String(plan || "free").toLowerCase()] ?? 0;

// Members-only rewards. Created (turned on) at startup if missing; edits made
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
