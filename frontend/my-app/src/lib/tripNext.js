// "What's next for this trip": after a flight (or stay) is booked, Skyrio
// offers the next piece — a place to stay, a rental car, things to do —
// already filled in with the trip's city, dates and travelers.
//
// Saved in this browser tab when flight checkout opens, so the flight
// "You're booked!" page (which the payment form redirects to) still knows
// the trip. Nothing here is sent anywhere.
import { searchAirports } from "@/data/airportData";

const KEY = "skyrio_trip_next";
const day = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : null);
const hhmm = (v) => {
  const m = String(v || "").match(/T(\d{2}):(\d{2})/);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
};
const pad = (n) => String(n).padStart(2, "0");

/** City name for an airport code ("MIA" → "Miami"), else the fallback. */
export function cityForCode(code, fallback = "") {
  const c = String(code || "").toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) {
    const hit = searchAirports(c).results.find((a) => a.code === c);
    if (hit?.city) return hit.city;
  }
  // "Miami International Airport" → "Miami"
  return String(fallback || "").replace(/\s+(international|intl\.?|airport|regional).*$/i, "").trim() || c;
}

/** The trip from a flight offer (the flat shape the Book page uses). */
export function tripFromFlight(flight, { budget = null } = {}) {
  // The Book page's flat flight (destination, arrivingAt…) or an offer
  // whose flat fields live under .raw.
  const raw = flight?.destination ? flight : flight?.raw?.destination ? flight.raw : flight || {};
  const code = raw.destination || raw.slices?.[0]?.destination || null;
  const priced = raw.pricedFor || flight?.pricedFor;
  const adults = Math.max(1, Number(priced?.adults) || 1) + Math.max(0, Number(priced?.children) || 0);
  return {
    code,
    city: cityForCode(code, raw.slices?.[0]?.destinationName),
    arriveAt: raw.arrivingAt || null, // local time there
    leaveAt: raw.returningAt || null, // flight home (local)
    adults,
    budget: Number(budget) > 0 ? Number(budget) : null,
    spent: Number(raw.totalAmount) || Number(flight?.totalAmount) || 0,
    have: { flight: true },
  };
}

export function saveTripNext(trip) {
  try {
    if (trip?.city) window.sessionStorage.setItem(KEY, JSON.stringify({ ...trip, savedAt: Date.now() }));
  } catch {
    /* fine: the next-step card just won't show */
  }
}

export function readTripNext() {
  try {
    const t = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
    // Only for a trip from the last 12 hours.
    return t && Date.now() - (t.savedAt || 0) < 12 * 3600 * 1000 ? t : null;
  } catch {
    return null;
  }
}

/** Mark a piece as done (e.g. the stay) and add what it cost. */
export function markTripNext(piece, { spent = 0, checkin, checkout, city } = {}) {
  const t = readTripNext() || { have: {} };
  saveTripNext({
    ...t,
    city: t.city || city,
    arriveAt: t.arriveAt || (checkin ? `${checkin}T15:00` : null),
    leaveAt: t.leaveAt || (checkout ? `${checkout}T11:00` : null),
    have: { ...(t.have || {}), [piece]: true },
    spent: (Number(t.spent) || 0) + (Number(spent) || 0),
  });
  return readTripNext();
}

/**
 * Links that open the Book page already searching:
 *   stay  — check in the day they land (before 6 AM counts as the night
 *           before), check out the day they fly home
 *   car   — pick up an hour after landing, drop off 2 hours before the
 *           flight home, at the arrival airport
 *   things / events — that city, those dates
 */
export function nextLinks(t) {
  if (!t?.city) return {};
  let arrive = day(t.arriveAt);
  const leave = day(t.leaveAt);
  const land = hhmm(t.arriveAt);
  if (arrive && land && land.h < 6) {
    const d = new Date(`${arrive}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    arrive = d.toISOString().slice(0, 10);
  }
  const q = (o) =>
    "/booking?" +
    new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "")).toString();

  const rooms = Math.max(1, Math.ceil((Number(t.adults) || 1) / 2));
  const stay = q({ tab: "Stays", city: t.city, depart: arrive, return: leave, adults: t.adults, rooms, auto: arrive && leave ? 1 : null });

  // About an hour after landing, rounded up to the next half hour.
  const pickMin = land ? Math.min(23 * 60 + 30, Math.ceil((land.h * 60 + land.m + 60) / 30) * 30) : null;
  const pick = pickMin != null ? `${pad(Math.floor(pickMin / 60))}:${pad(pickMin % 60)}` : null;
  const home = hhmm(t.leaveAt);
  const drop = home ? `${pad(Math.max(0, home.h - 2))}:${pad(home.m >= 30 ? 30 : 0)}` : null;
  const car = q({
    tab: "Cars",
    to: t.code || t.city,
    toName: t.city,
    depart: day(t.arriveAt),
    return: leave,
    ptime: pick,
    dtime: drop,
    auto: day(t.arriveAt) && leave ? 1 : null,
  });
  const things = q({ tab: "Excursions", city: t.city, depart: day(t.arriveAt), return: leave, auto: 1 });
  const events = q({ tab: "Events", city: t.city, depart: day(t.arriveAt), return: leave, auto: 1 });
  return { stay, car, things, events };
}
