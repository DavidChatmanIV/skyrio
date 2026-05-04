export const XP_LEVELS = [
  { name: "Explorer",    minXp: 0    },
  { name: "Adventurer",  minXp: 100  },
  { name: "Voyager",     minXp: 300  },
  { name: "Navigator",   minXp: 600  },
  { name: "Trailblazer", minXp: 1000 },
  { name: "Globetrotter",minXp: 1500 },
  { name: "Elite",       minXp: 2500 },
  { name: "Legend",      minXp: 4000 },
];

export function getLevel(xp) {
  const x = Number(xp || 0);
  let current = XP_LEVELS[0];
  let next = XP_LEVELS[1];
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (x >= XP_LEVELS[i].minXp) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] || null;
      break;
    }
  }
  const xpIntoLevel = next ? x - current.minXp : 0;
  const xpNeeded = next ? next.minXp - current.minXp : 0;
  const percent = next ? Math.round((xpIntoLevel / xpNeeded) * 100) : 100;
  return {
    current: current.name,
    next: next?.name || null,
    xp: x,
    xpIntoLevel,
    xpNeeded,
    xpToNext: next ? next.minXp - x : 0,
    percent,
  };
}
