export const PASSPORT = {
  xp: {
    level: 7,
    current: 1820,
    nextLevelAt: 2200,
  },

  boosts: [
    {
      id: "xp25",
      icon: "⚡",
      label: "XP +25%",
      active: true,
      expiresIn: "48h",
    },
    { id: "ai", icon: "🧠", label: "AI Priority", active: true },
  ],

  badges: [
    {
      id: "explorer",
      name: "Explorer",
      tier: "Silver",
      progress: 6,
      total: 10,
    },
    {
      id: "budget-master",
      name: "Budget Master",
      tier: "Bronze",
      progress: 2,
      total: 5,
    },
  ],

  perks: [
    "Priority price alerts",
    "Early feature access",
    "Faster support replies",
  ],
};