// "Atlas noticed" card on the home page. Small, quiet, and only true things:
//  - patterns from the traveler's own confirmed trips (needs 2+ trips, and
//    the pattern has to hold for most of them), and
//  - things Atlas learned that it's fairly sure of (what they told Atlas or
//    options they kept picking), from the "What Atlas knows" page.
// No AI here, so nothing is made up. If "Let Atlas learn" is off, nothing shows.
import Booking from "../../models/booking.js";
import AtlasLearnedPreference from "../../models/AtlasLearnedPreference.js";
import { isLearningEnabled } from "./atlasLearning.js";

const MAX_LINES = 3;
const MIN_TRIPS = 2;
const MIN_SHARE = 0.6; // pattern must hold for 60%+ of trips
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

const SOURCE_LABEL = {
  stated: "You told Atlas",
  choices: "From options you picked",
  feedback: "From your feedback",
  bookings: "From your trips",
};

const top = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  for (const [value, n] of counts) if (!best || n > best.n) best = { value, n };
  return best;
};
const holds = (hit, total) => total >= MIN_TRIPS && hit.n >= MIN_TRIPS && hit.n / total >= MIN_SHARE;

const isoDay = (v) => {
  const s = typeof v === "string" ? v : v instanceof Date && !isNaN(v) ? v.toISOString() : "";
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** Pure: bookings + learned rows → card. Exported for tests. */
export function buildForYou({ bookings = [], learned = [] } = {}) {
  const trips = bookings.filter((b) => b && b.status === "confirmed");
  const lines = [];
  const facts = []; // plain words for the "Get trip ideas" message

  // 1) Things Atlas learned and is fairly sure of (their own words first).
  const sure = learned
    .filter((r) => r.active !== false && r.text && (r.source === "stated" || r.editedByUser || r.confidence >= 0.6))
    .sort((a, b) => (b.source === "stated") - (a.source === "stated") || b.confidence - a.confidence)
    .slice(0, 2);
  for (const r of sure) {
    lines.push({ key: `learned.${r.key || r._id}`, icon: "spark", text: r.text, source: SOURCE_LABEL[r.source] || "Atlas learned" });
    facts.push(r.text);
  }

  // 2) Where they usually fly from.
  const flights = trips.filter((b) => b.type === "Flight" && b.flight?.origin);
  const from = top(flights.map((b) => String(b.flight.origin).toUpperCase()));
  if (from && holds(from, flights.length)) {
    lines.push({
      key: "from",
      icon: "plane",
      text: `Usually fly from ${from.value}`,
      source: `${from.n} of ${flights.length} flights`,
    });
    facts.push(`I usually fly from ${from.value}`);
  }

  // 3) How long trips usually last (median nights).
  const nights = trips
    .map((b) => {
      const s = new Date(b.dates?.start).getTime();
      const e = new Date(b.dates?.end).getTime();
      if (!s || !e || e <= s) return null;
      const n = Math.round((e - s) / DAY_MS);
      return n >= 1 && n <= 30 ? n : null;
    })
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (nights.length >= MIN_TRIPS) {
    const m = nights[Math.floor((nights.length - 1) / 2)];
    const near = nights.filter((n) => Math.abs(n - m) <= 1).length;
    if (near / nights.length >= MIN_SHARE) {
      const word = m === 1 ? "1 night" : `${m} nights`;
      lines.push({ key: "length", icon: "moon", text: `Trips last about ${word}`, source: `From ${nights.length} trips` });
      facts.push(`my trips usually last about ${word}`);
    }
  }

  // 4) Day they usually leave.
  const days = trips
    .map((b) => isoDay(b.flight?.departureAt) || isoDay(b.dates?.start))
    .filter(Boolean)
    .map((d) => new Date(`${d}T12:00:00Z`).getUTCDay());
  const day = top(days);
  if (day && holds(day, days.length)) {
    lines.push({ key: "day", icon: "calendar", text: `Often leave on ${WEEKDAYS[day.value]}`, source: `${day.n} of ${days.length} trips` });
    facts.push(`I often leave on ${WEEKDAYS[day.value]}`);
  }

  // 5) Trips with friends.
  const group = trips.filter((b) => b.syncGroup).length;
  if (trips.length >= MIN_TRIPS && group >= MIN_TRIPS && group / trips.length >= 0.5) {
    lines.push({ key: "group", icon: "users", text: "Often travel with friends", source: `${group} of ${trips.length} trips` });
    facts.push("I often travel with friends");
  }

  const shown = lines.slice(0, MAX_LINES);
  return {
    enabled: true,
    lines: shown,
    tripCount: trips.length,
    ask: shown.length
      ? `Give me 3 trip ideas that fit how I travel: ${facts.slice(0, MAX_LINES).join("; ")}. Keep it short.`
      : null,
  };
}

export async function forYouFor(userId) {
  if (!(await isLearningEnabled(userId))) return { enabled: false, lines: [], ask: null };
  const [bookings, learned] = await Promise.all([
    Booking.find({ user: userId, status: "confirmed" })
      .select("type status flight.origin flight.departureAt dates syncGroup")
      .sort({ createdAt: -1 })
      .limit(40)
      .lean(),
    AtlasLearnedPreference.find({ user: userId, active: true })
      .select("key text source confidence editedByUser active")
      .sort({ confidence: -1 })
      .limit(10)
      .lean(),
  ]);
  return buildForYou({ bookings, learned });
}
