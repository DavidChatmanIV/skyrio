// One place for the Sync Together trip-budget math, so the search page,
// both checkouts and the trip page always agree.
//
// The budget is the traveler's PRIVATE total for the whole trip, per person
// (flight + stay + activities). "left" = budget − what they've already
// booked on this trip. Going over is always allowed — we just say so.

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

export function tripBudgetFrom(info) {
  const budget = Number(info?.myBudget) > 0 ? Number(info.myBudget) : null;
  const spent = Math.max(0, Number(info?.mySpent) || 0);
  // What the spent total is made of: [{ kind, label, amount }]
  const booked = Array.isArray(info?.myBooked) ? info.myBooked : [];
  if (!budget) return { set: false, budget: null, spent, booked, left: null };
  return {
    set: true,
    budget,
    spent,
    booked,
    left: Math.max(0, budget - spent),
    usedUp: spent >= budget,
  };
}

// { fits: true } | { fits: false, over: 120 } | null (no budget / no price)
export function priceFit(price, tb) {
  if (!tb?.set) return null;
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;
  const over = Math.round(p - tb.left);
  return over > 0 ? { fits: false, over } : { fits: true, over: 0 };
}

export const money = (n) =>
  `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

// Saves the traveler's own budget on the trip. Returns { myBudget, budgetSummary }.
export async function saveTripBudget(groupId, value) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/sync-together/${groupId}/my-budget`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ budget: value || null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok)
    throw new Error(data.error || "Couldn't save your budget");
  return data;
}

// Splits a result list into what fits and what doesn't. If NOTHING fits,
// everything is shown (with tags) so nobody is left with an empty page.
export function splitByBudget(list, getPrice, tb, showOver) {
  if (!tb?.set) return { shown: list, overCount: 0, noneFit: false };
  const fit = [];
  const over = [];
  list.forEach((x) =>
    (priceFit(getPrice(x), tb)?.fits === false ? over : fit).push(x)
  );
  if (!fit.length)
    return { shown: list, overCount: 0, noneFit: over.length > 0 };
  return {
    shown: showOver ? [...fit, ...over] : fit,
    overCount: over.length,
    noneFit: false,
  };
}

// The same four lines everywhere the budget is explained.
export const BUDGET_HOW_IT_WORKS = [
  [
    "One number for the whole trip.",
    "Flight, stay and activities, per person. Set it once.",
  ],
  [
    "We track what you've booked.",
    "When you search, we subtract it and show what fits first.",
  ],
  [
    "Going over is okay.",
    "Nothing is blocked. You'll see it clearly and can change your budget anytime.",
  ],
  [
    "Always private.",
    "The group only sees what everyone's comfortable with, never your number.",
  ],
];

// Search link for one part of a group trip (flight / stay / activity),
// prefilled with the trip's destination and dates, ready to run.
// info = the /parts payload (or the group). opts: { from, cabin }
export function tripSearchParams(groupId, info, kind, opts = {}) {
  const ymd = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
  const tab =
    kind === "stay" ? "Stays" : kind === "activity" ? "Excursions" : "Flights";
  const p = { groupId, tab, auto: "1" };
  if (info?.destination) p.to = info.destination;
  if (info?.dateRangeStart) p.depart = ymd(info.dateRangeStart);
  if (info?.dateRangeEnd) p.return = ymd(info.dateRangeEnd);
  if (tab === "Flights") {
    if (opts.from) p.from = opts.from;
    if (opts.cabin || info?.cabinClass) p.cabin = opts.cabin || info.cabinClass;
    p.adults = "1";
  }
  if (tab === "Stays") {
    p.adults = "1";
    p.rooms = "1";
  }
  return p;
}
