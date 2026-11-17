// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { Search as SearchIcon, Sparkles, Wallet } from "lucide-react";

export const EXAMPLE_PLANS = {
  japan: {
    destination: "Tokyo",
    iata: "NRT",
    prompt: "10-day Japan trip under $2,500 with cherry blossoms",
    budget: 2500,
    tripDays: 10,
    tab: "Flights",
  },
  miami: {
    destination: "Miami",
    iata: "MIA",
    prompt: "Miami weekend for two under $600",
    budget: 600,
    tripDays: 3,
    tab: "Flights",
  },
  paris: {
    destination: "Paris",
    iata: "CDG",
    prompt: "Paris honeymoon with premium stay ideas",
    budget: 4000,
    tripDays: 7,
    tab: "Flights",
  },
};

export const PLAN_SEEDS = {
  "tokyo-kyoto": {
    destination: "Tokyo",
    iata: "NRT",
    prompt: "Tokyo + Kyoto — April 5–15, cherry blossom season",
    budget: 1462,
    tripDays: 10,
    tab: "Flights",
  },
};

export function extractBudgetFromPrompt(prompt) {
  if (!prompt) return null;
  const match = prompt.match(/\$[\s]?([\d,]+)/);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ""), 10);
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  return null;
}

export const KNOWN_DESTINATIONS = [
  "tokyo",
  "japan",
  "kyoto",
  "osaka",
  "miami",
  "paris",
  "bali",
  "london",
  "barcelona",
  "rome",
  "dubai",
  "bangkok",
  "singapore",
  "new york",
  "los angeles",
  "cancun",
  "hawaii",
  "sydney",
  "seoul",
];

export function extractDestFromPrompt(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  const found = KNOWN_DESTINATIONS.find((d) => lower.includes(d));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);
  const skip = new Set([
    "a",
    "in",
    "to",
    "for",
    "the",
    "with",
    "under",
    "trip",
    "day",
    "week",
    "budget",
    "plan",
  ]);
  const cap = prompt
    .split(/\s+/)
    .find((w) => /^[A-Z]/.test(w) && !skip.has(w.toLowerCase()));
  return cap ?? null;
}

export const PLAN_MODE_KEY = "skyrio_plan_mode";
export const PLAN_MODES = [
  {
    key: "search",
    Icon: SearchIcon,
    title: "Search myself",
    sub: "Flights, stays & more",
  },
  {
    key: "budget",
    Icon: Wallet,
    title: "On a budget",
    sub: "Set a budget, see what fits",
  },
  {
    key: "atlas",
    Icon: Sparkles,
    title: "Ask Atlas",
    sub: "It plans it for you",
  },
];
export function readPlanMode() {
  try {
    const v = localStorage.getItem(PLAN_MODE_KEY);
    return PLAN_MODES.some((m) => m.key === v) ? v : "search";
  } catch {
    return "search";
  }
}
export const PLAN_CSS = `
  /* Flight "Select" buttons light up once picked, like a chosen seat. */
  .sk-pick-btn { display: inline-flex !important; align-items: center; gap: 5px; transition: background .15s, box-shadow .15s, transform .1s; }
  .sk-pick-btn:active { transform: scale(0.97); }
  .sk-pick-btn.is-picked,
  .sk-pick-btn.is-picked:hover,
  .sk-pick-btn.is-picked:focus {
    background: linear-gradient(135deg, #ff8a2a, #ffb347) !important;
    color: #1a0e06 !important; border-color: transparent !important; font-weight: 800 !important;
    box-shadow: 0 0 0 3px rgba(255,138,42,0.35), 0 6px 18px rgba(255,138,42,0.35) !important;
  }
  .sk-result-card.is-selected { box-shadow: 0 0 0 2px #ff8a2a, 0 10px 30px rgba(255,138,42,0.18) !important; }
  .sk-planmode { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0 0 16px; }
  .sk-planmode__btn {
    display: flex; align-items: center; gap: 12px; text-align: left;
    padding: 12px 14px; border-radius: 16px; cursor: pointer; font: inherit; color: #fff;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    transition: border-color .15s, background .15s, transform .15s;
  }
  .sk-planmode__btn:hover { border-color: rgba(255,138,42,0.6); transform: translateY(-1px); }
  .sk-planmode__btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .sk-planmode__btn.is-on {
    background: linear-gradient(135deg, rgba(255,138,42,0.22), rgba(124,92,252,0.26));
    border-color: #ff8a2a; box-shadow: 0 0 0 3px rgba(255,138,42,0.15);
  }
  .sk-planmode__icon {
    width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.08); color: #ffb347;
  }
  .sk-planmode__btn.is-on .sk-planmode__icon { background: linear-gradient(135deg,#ff8a2a,#7c5cfc); color: #fff; }
  .sk-planmode__title { font-weight: 800; font-size: 14.5px; line-height: 1.2; }
  .sk-planmode__sub { font-size: 12px; color: rgba(255,255,255,0.62); margin-top: 2px; }
  .sk-atlas-hint {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 14px; margin: 0 0 14px; border-radius: 14px;
    background: rgba(124,92,252,0.12); border: 1px solid rgba(167,139,250,0.4); font-size: 13.5px;
  }
  .sk-atlas-hint button {
    margin-left: auto; padding: 8px 14px; border-radius: 10px; border: none; cursor: pointer;
    font: inherit; font-weight: 700; color: #fff; background: linear-gradient(135deg,#ff8a2a,#7c5cfc);
  }
  @media (max-width: 720px) {
    .sk-planmode { grid-template-columns: 1fr; gap: 8px; }
    .sk-planmode__btn { padding: 10px 12px; }
    .sk-planmode__icon { width: 34px; height: 34px; }
  }

  /* Narrow phones (Galaxy Fold cover ~280px, iPhone SE): the tab bar
     scrolls sideways instead of clipping "Saved", and Round trip / One way /
     Multi-city wraps instead of spilling past the boarding pass. */
  @media (max-width: 360px) {
    .sk-tab-bar { max-width: 100%; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
    .sk-tab-bar::-webkit-scrollbar { display: none; }
    .sk-trip-type-row { max-width: 100%; }
    .sk-trip-type { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: 100%; box-sizing: border-box; }
    .sk-trip-type-btn { padding-left: 10px !important; padding-right: 10px !important; font-size: 12px !important; }
  }

  /* Results view: the planner folds away and the results get the screen.
     Skyrio purple glass, like the rest of the site. */
  .sk-resultsbar {
    position: sticky; top: 84px; z-index: 20; overflow: hidden;
    display: flex; align-items: center; gap: 12px;
    max-width: 1200px; margin: 12px auto 14px; padding: 10px 14px; border-radius: 18px;
    background: linear-gradient(160deg, rgba(74,40,112,0.9), rgba(34,18,62,0.92));
    border: 1px solid rgba(255,255,255,0.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 14px 34px rgba(12,4,28,0.4);
    backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%);
  }
  .sk-resultsbar::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc); }
  .sk-resultsbar__back {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px;
    border-radius: 999px; border: 1px solid rgba(255,179,71,0.5); background: rgba(255,138,42,0.12);
    color: #ffb347; font: inherit; font-weight: 800; font-size: 13.5px; cursor: pointer; white-space: nowrap;
  }
  .sk-resultsbar__back:hover { border-color: #ffb347; background: rgba(255,138,42,0.2); }
  .sk-resultsbar__title { font-weight: 800; font-size: 15px; line-height: 1.25; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sk-resultsbar__sub { font-size: 12.5px; color: rgba(255,255,255,0.65); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Filters + sort under the bar: no divider line there */
  .sk-results-tools .sk-bp-tools { border-top: 0 !important; margin-top: 0 !important; padding-top: 0 !important; }
  @media (max-width: 720px) {
    .sk-resultsbar { top: 72px; margin: 8px 12px 10px; padding: 8px 10px; gap: 10px; border-radius: 16px; }
    .sk-resultsbar__back { min-height: 36px; padding: 0 12px; font-size: 13px; }
    .sk-resultsbar__title { font-size: 14px; }
  }
  /* Airline logos: a small tile, not a giant banner, on phones/tablets */
  @media (max-width: 992px) {
    .sk-booking .sk-thumb.sk-thumb--logo {
      width: 52px !important; min-width: 52px !important; height: 52px !important;
      border-radius: 14px; background-size: 72% !important;
      background-color: #fff !important; border-color: rgba(255,255,255,0.3);
    }
    .sk-booking .sk-thumb.sk-thumb--logo::after { display: none; }
  }
`;
