// Single source of truth for flight filtering on the Booking page.
// Pure functions: no React, easy to unit test.

// Shown in the Airline dropdown BEFORE a search, so users can pre-pick.
// After a search, these merge with the airlines actually on the route.
export const POPULAR_AIRLINES = [
  { code: "AA", name: "American Airlines" },
  { code: "AS", name: "Alaska Airlines" },
  { code: "B6", name: "JetBlue" },
  { code: "DL", name: "Delta Air Lines" },
  { code: "F9", name: "Frontier Airlines" },
  { code: "NK", name: "Spirit Airlines" },
  { code: "UA", name: "United Airlines" },
  { code: "WN", name: "Southwest Airlines" },
];

export const DEFAULT_FLIGHT_FILTERS = {
  maxPrice: null, // e.g. 500
  nonstopOnly: false,
  timeOfDay: null, // "morning" | "afternoon" | "evening" | "redeye" | null
  airlines: [], // IATA codes, e.g. ["AS", "DL"]; empty = any airline
  minXp: null, // e.g. 150
};

const TIME_WINDOWS = {
  morning: [5, 12], // 5:00–11:59
  afternoon: [12, 17],
  evening: [17, 21],
  redeye: [21, 29], // 21:00–04:59 (wraps past midnight)
};

// ---- Accessors: adjust these to your normalized LiteAPI flight shape ----
const getPrice = (f) =>
  Number(f.price?.amount ?? f.totalPrice ?? f.price ?? Infinity);
const getStops = (f) => Number(f.stops ?? (f.segments?.length ?? 1) - 1);
const getXp = (f) => Number(f.xp ?? f.xpReward ?? 0);
const getCarrier = (f) =>
  String(
    f.carrierCode ?? f.airlineCode ?? f.segments?.[0]?.carrierCode ?? ""
  ).toUpperCase();
const getDepart = (f) =>
  f.departureTime ?? f.departAt ?? f.segments?.[0]?.departureTime ?? "";

// Read the hour straight from the string instead of new Date(), so a
// 5:30 PM EWR departure stays 17 regardless of the user's browser timezone.
export function localHour(isoLike) {
  const m = /T(\d{2}):(\d{2})/.exec(isoLike || "");
  return m ? Number(m[1]) : null;
}

function inWindow(hour, window) {
  if (hour == null) return false;
  const [start, end] = TIME_WINDOWS[window] || [0, 24];
  const h = hour < start && end > 24 ? hour + 24 : hour;
  return h >= start && h < end;
}

export function applyFlightFilters(
  flights = [],
  filters = DEFAULT_FLIGHT_FILTERS
) {
  const { maxPrice, nonstopOnly, timeOfDay, airlines, minXp } = filters;
  const airlineSet = new Set((airlines || []).map((c) => c.toUpperCase()));

  return flights.filter((f) => {
    if (maxPrice != null && getPrice(f) > maxPrice) return false;
    if (nonstopOnly && getStops(f) !== 0) return false;
    if (timeOfDay && !inWindow(localHour(getDepart(f)), timeOfDay))
      return false;
    if (airlineSet.size && !airlineSet.has(getCarrier(f))) return false;
    if (minXp != null && getXp(f) < minXp) return false;
    return true;
  });
}

// Airline dropdown options: popular carriers before search; after search,
// the route's real carriers first (with counts), then the rest.
export function buildAirlineOptions(flights = []) {
  const counts = new Map();
  const names = new Map(POPULAR_AIRLINES.map((a) => [a.code, a.name]));
  for (const f of flights) {
    const code = getCarrier(f);
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
    if (f.airlineName) names.set(code, f.airlineName);
  }
  const onRoute = [...counts.keys()].map((code) => ({
    code,
    name: names.get(code) || code,
    count: counts.get(code),
  }));
  const others = POPULAR_AIRLINES.filter((a) => !counts.has(a.code)).map(
    (a) => ({ ...a, count: flights.length ? 0 : null })
  );
  return [...onRoute.sort((a, b) => b.count - a.count), ...others];
}

export const activeFilterCount = (f) =>
  [
    f.maxPrice != null,
    f.nonstopOnly,
    !!f.timeOfDay,
    f.airlines?.length > 0,
    f.minXp != null,
  ].filter(Boolean).length;
