// "Happening during your trip": 2–3 real Ticketmaster events for a trip's
// city and dates. Same Ticketmaster code as the Book page's Events tab.
//
// Atlas runs this on its own when a trip has a city and dates (a hotel
// search, or a round-trip flight search), at the same time as the flight
// and hotel searches, so it adds no wait. Rules it enforces:
//   - only events whose local date is inside the trip dates
//   - only events with a real Ticketmaster link (the "Buy on Ticketmaster" button)
//   - nothing found, or Ticketmaster slow/down → [] (Atlas says nothing)
//   - the traveler's interests (Music, Culture, Sports, Family…) go first
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchEvents as tmSearchEvents } from "../../providers/ticketmasterProvider.js";
import { normalizeEvent, toTmDateTime, isValidDate, addDays } from "../../utils/eventsUtils.js";
import { stateCode as toStateCode } from "../placeName.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let AIRPORTS = null;
const airportsByCode = () => {
  if (!AIRPORTS) {
    try {
      AIRPORTS = new Map(
        JSON.parse(fs.readFileSync(path.join(__dirname, "../../airports.json"), "utf8")).map((a) => [a.code, a])
      );
    } catch {
      AIRPORTS = new Map();
    }
  }
  return AIRPORTS;
};

export const MAX_TRIP_EVENTS = 3;
const MAX_TRIP_DAYS = 31; // longer "trips" are probably a typo; skip events

// Profile vibes → Ticketmaster categories (eventsUtils CATEGORY_MAP keys).
const VIBE_TO_CATEGORY = {
  music: "music",
  nightlife: "music",
  concerts: "music",
  culture: "shows",
  history: "shows",
  arts: "shows",
  theatre: "shows",
  theater: "shows",
  sports: "sports",
  family: "family",
};

/** ["Music", "Culture & history", "Beach"] → ["music", "shows"] (in order, no repeats). */
export function interestCategories(vibes = []) {
  const out = [];
  for (const v of vibes || []) {
    const word = String(v || "").toLowerCase().split(/[^a-z]+/).find((w) => VIBE_TO_CATEGORY[w]);
    const cat = word && VIBE_TO_CATEGORY[word];
    if (cat && !out.includes(cat)) out.push(cat);
  }
  return out;
}

/**
 * Where Ticketmaster should look.
 *   hotel destination "Miami, FL" → { city: "Miami", stateCode: "FL" }
 *   "San Juan, Puerto Rico" / airport SJU → { countryCode: "PR", city: "San Juan" }
 *   airport code "MIA" → { city: "Miami" } (US) / { city, countryCode } elsewhere
 */
export function placeFor({ destination, airportCode } = {}) {
  if (airportCode) {
    const ap = airportsByCode().get(String(airportCode).toUpperCase());
    if (!ap?.city) return null;
    if (ap.countryCode === "PR") return { city: ap.city, countryCode: "PR", label: ap.city };
    return { city: ap.city, countryCode: ap.countryCode || undefined, label: ap.city };
  }
  const raw = String(destination || "").trim();
  if (!raw) return null;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const city = parts[0];
  if (!city) return null;
  const tail = parts.slice(1).join(" ");
  const st = toStateCode(tail) || toStateCode(parts[parts.length - 1]);
  if (/puerto rico/i.test(raw) || st === "PR") return { city, countryCode: "PR", label: city };
  if (st) return { city, stateCode: st, countryCode: "US", label: `${city}, ${st}` };
  return { city, label: city };
}

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

/** Pure: keep real, in-range, buyable events; interests first; dedupe; cap. */
export function pickTripEvents(events, { start, end, interests = [], max = MAX_TRIP_EVENTS } = {}) {
  const rank = (e) => {
    const i = interests.indexOf(e.category);
    return i === -1 ? interests.length : i;
  };
  const seen = new Set();
  return (events || [])
    .filter(
      (e) =>
        e?.name &&
        e.date &&
        e.date >= start &&
        e.date <= end && // inside the trip, by the event's local date
        /^https:\/\//.test(String(e.url || "")) &&
        !["cancelled", "canceled", "offsale"].includes(e.status)
    )
    .sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))
    .filter((e) => {
      const k = e.name.toLowerCase(); // one show, many nights → list it once
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")));
}

/** What Atlas and the card get: only fields from Ticketmaster's data. */
export const eventView = (e) => ({
  name: e.name,
  date: e.date,
  time: e.time || null,
  venue: e.venue?.name || null,
  city: e.venue?.city || null,
  category: e.genre || e.category || null,
  priceFrom: e.priceRange?.min ?? null,
  currency: e.priceRange?.currency || "USD",
  url: e.url,
  status: e.status === "postponed" || e.status === "rescheduled" ? e.status : null,
});

/**
 * → { place, start, end, events: [eventView…] }. events is [] when nothing
 * fits or Ticketmaster fails. Never throws.
 */
export async function tripEvents(
  { destination, airportCode, start, end, vibes = [] },
  { searchEvents = tmSearchEvents } = {}
) {
  const empty = { place: null, start, end, events: [] };
  if (!process.env.TICKETMASTER_API_KEY && searchEvents === tmSearchEvents) return empty;
  if (!isValidDate(start) || !isValidDate(end) || end < start) return empty;
  if (daysBetween(start, end) > MAX_TRIP_DAYS) return empty;
  const place = placeFor({ destination, airportCode });
  if (!place) return empty;
  try {
    const data = await searchEvents({
      city: place.countryCode === "PR" ? undefined : place.city,
      stateCode: place.stateCode,
      countryCode: place.countryCode,
      startDateTime: toTmDateTime(start),
      // A day past the end: a late show's UTC time can be the next day.
      // pickTripEvents then keeps only events whose local date is in the trip.
      endDateTime: toTmDateTime(addDays(end, 1), true),
      size: 30,
    });
    const all = (data?._embedded?.events || []).map(normalizeEvent);
    const picked = pickTripEvents(all, { start, end, interests: interestCategories(vibes) });
    return { place: place.label, start, end, events: picked.map(eventView) };
  } catch (err) {
    console.warn("[Atlas trip events] skipped:", err.message);
    return empty;
  }
}

/** The trip in a round of tool calls: a hotel stay, else a round-trip flight. */
export function tripFromCalls(calls = []) {
  const hotel = calls.find((c) => c?.name === "search_hotels" && c.arguments?.destination);
  if (hotel) {
    const a = hotel.arguments;
    return { destination: a.destination, start: a.checkin, end: a.checkout };
  }
  const flight = calls.find((c) => c?.name === "search_flights" && c.arguments?.destination && c.arguments?.returnDate);
  if (flight) {
    const a = flight.arguments;
    return { airportCode: a.destination, start: a.departDate, end: a.returnDate };
  }
  return null;
}
