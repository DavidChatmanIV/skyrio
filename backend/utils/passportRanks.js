// Single source of truth for ranks. Copy into BOTH:
//   frontend/my-app/src/utils/passportRanks.js
//   backend/utils/passportRanks.js
// RANK IS ALWAYS COMPUTED FROM lifetimeXp — NEVER from xpBalance.
//
// ⚠️ Replace the `min` values with your real thresholds if they differ.

export const RANKS = [
  { key: "explorer",     name: "Explorer",     min: 0,    color: "#94a3b8" },
  { key: "adventurer",   name: "Adventurer",   min: 100,  color: "#fb923c" },
  { key: "voyager",      name: "Voyager",      min: 300,  color: "#38bdf8" },
  { key: "trailblazer",  name: "Trailblazer",  min: 700,  color: "#a78bfa" },
  { key: "globetrotter", name: "Globetrotter", min: 1500, color: "#facc15" },
];

export function getRank(lifetimeXp = 0) {
  let current = RANKS[0];
  for (const r of RANKS) if (lifetimeXp >= r.min) current = r;
  const idx = RANKS.indexOf(current);
  const next = RANKS[idx + 1] || null;
  const span = next ? next.min - current.min : 1;
  const into = next ? lifetimeXp - current.min : span;
  return {
    ...current,
    next,
    xpIntoTier: into,
    xpForTier: span,
    xpToNext: next ? next.min - lifetimeXp : 0,
    progress: next ? Math.min(1, into / span) : 1,
  };
}
