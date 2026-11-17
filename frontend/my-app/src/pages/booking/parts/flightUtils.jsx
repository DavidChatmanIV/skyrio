// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import dayjs from "dayjs";

export const DEFAULT_FILTERS = {
  price: "any",
  stops: "any",
  time: "any",
  airline: "any",
  xp: "any",
};

export const ATLAS_LOADING_STEPS = [
  "Scanning live routes…",
  "Comparing 847 options…",
  "Filtering by value + timing…",
  "Ranking best picks for you…",
  "Almost there…",
];

// The XP this flight ACTUALLY earns when booked (before the plan multiplier).
// Must match getBookingXP() in the backend config/xpRules.js — the server grants
// exactly this, so the badge on the card is never a made-up number.
// (Previously 40–90 XP, while bookings really granted 100+, and the
// "Epic 100+" / "Legend 150+" filters could never match anything.)
export function getFlightXP(flight) {
  if (flight.stops === 0) return 150;
  if (flight.stops === 1) return 135;
  return 120;
}

// Sort options for the "Sort:" button — it cycles through these.
export const SORT_OPTIONS = [
  { key: "price", label: "Cheapest" },
  { key: "stops", label: "Fewest stops" },
  { key: "depart", label: "Earliest departure" },
];

export function compareFlights(sortKey) {
  const price = (f) => parseFloat(f.totalAmount) || Infinity;
  const depart = (f) =>
    f.departingAt ? dayjs(f.departingAt).valueOf() : Infinity;
  if (sortKey === "stops") {
    return (a, b) => (a.stops ?? 9) - (b.stops ?? 9) || price(a) - price(b);
  }
  if (sortKey === "depart") {
    return (a, b) => depart(a) - depart(b) || price(a) - price(b);
  }
  return (a, b) => price(a) - price(b);
}

// Read the hour straight from the airline's local time ("2027-01-21T06:15"),
// so the phone's own time zone can't shift a flight into the wrong slot.
export function getFlightTimeSlot(flight) {
  const m = String(flight.departingAt || "").match(/T(\d{2}):/);
  const hour = m ? Number(m[1]) : flight.departingAt ? dayjs(flight.departingAt).hour() : null;
  if (hour == null || !Number.isFinite(hour)) return null;
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18) return "evening";
  return "overnight"; // midnight – 5am (red-eyes)
}

// Stops on each direction (outbound, and return when there is one).
export function legStops(flight) {
  const out = Number.isFinite(flight.stops) ? flight.stops : 0;
  const back = flight.slices?.[1]?.stops;
  return Number.isFinite(back) ? [out, back] : [out];
}

export function applyFilters(flights, filters) {
  return flights.filter((f) => {
    const price = parseFloat(f.totalAmount);
    if (filters.price !== "any" && price > Number(filters.price)) return false;
    if (filters.stops !== "any") {
      const s = Number(filters.stops);
      // 0 = Nonstop only · 1 = 1 stop OR FEWER (keeps nonstops) · 2 = 2+ stops.
      // Checked on BOTH directions: "Nonstop only" means nonstop there AND back.
      const legs = legStops(f);
      if (s === 0 && legs.some((n) => n !== 0)) return false;
      if (s === 1 && legs.some((n) => n > 1)) return false;
      if (s >= 2 && legs.every((n) => n < 2)) return false;
    }
    if (filters.time !== "any" && getFlightTimeSlot(f) !== filters.time)
      return false;
    // The Airline dropdown stores an IATA code ("AS"); older values may be a
    // full name ("Alaska Airlines"). Match either.
    if (
      filters.airline !== "any" &&
      f.ownerCode !== filters.airline &&
      f.owner !== filters.airline
    )
      return false;
    if (filters.xp !== "any" && getFlightXP(f) < Number(filters.xp))
      return false;
    return true;
  });
}

// A stable identity for a flight's OUTBOUND leg only (ignores return
// time/price) — used to group multiple round-trip fare combinations
// that share the same outbound flight but differ in which return
// flight they're paired with. LiteAPI returns each outbound+return
// pairing as its own priced "journey", so without this grouping the
// same outbound flight would show up once per available return time,
// as a wall of near-duplicate cards.
export function getOutboundGroupKey(flight) {
  return [
    flight.origin,
    flight.destination,
    flight.departingAt,
    flight.ownerCode,
    flight.stops,
  ].join("|");
}

// The airports a connecting itinerary stops at, for one direction:
// EWR → ATL → MIA gives ["ATL"]. Every flight's own segments come from
// LiteAPI, so this is real data — the customer just never saw it before.
// Nonstop (or unknown) gives [].
export function getConnectionCodes(slice) {
  const segs = Array.isArray(slice?.segments) ? slice.segments : [];
  return segs
    .slice(0, -1)
    .map((s) => s?.destination)
    .filter(Boolean);
}

// "Nonstop" | "1 stop · via ATL" | "2 stops · via ATL, DFW"
export function describeStops(stops, slice) {
  if (!stops) return "Nonstop";
  const via = getConnectionCodes(slice);
  return `${stops} stop${stops > 1 ? "s" : ""}${
    via.length ? ` · via ${via.join(", ")}` : ""
  }`;
}

// The closest bookable flight to one that just sold out: same day first,
// nearest departure time, then same number of stops, then price.
export function closestFlight(gone, list) {
  const t0 = gone?.departingAt ? dayjs(gone.departingAt) : null;
  const day0 = t0 ? t0.format("YYYY-MM-DD") : null;
  const stops0 = Number(gone?.stops ?? 0);
  const scored = (list || [])
    .filter((f) => f && f !== gone && (f.offerId || f.id))
    .map((f) => {
      const t = f.departingAt ? dayjs(f.departingAt) : null;
      return {
        f,
        otherDay: day0 && t ? Number(t.format("YYYY-MM-DD") !== day0) : 1,
        minutes: t0 && t ? Math.abs(t.diff(t0, "minute")) : 1e6,
        stopsDiff: Math.abs(Number(f.stops ?? 0) - stops0),
        price: parseFloat(f.totalAmount) || 1e9,
      };
    })
    .sort(
      (a, b) =>
        a.otherDay - b.otherDay ||
        a.minutes - b.minutes ||
        a.stopsDiff - b.stopsDiff ||
        a.price - b.price
    );
  return scored[0]?.f || null;
}
