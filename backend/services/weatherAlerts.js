// Severe-weather alerts from the US National Weather Service (api.weather.gov).
// Free, no key; covers the US and US territories only.
//
// Two uses:
//  1) Travelers: when a severe weather WARNING is active near the departure
//     or arrival airport of a flight starting in the next 3 days, they get one
//     email + notification per storm type per airport. Never repeated.
//  2) Admin: Travel alerts shows active warnings at major US airports, with a
//     one-tap "Use for alert" that fills the site-alert form. A person posts it.
//
// Wording rule: weather *could* delay or cancel flights. The airline decides.
// Off with WEATHER_ALERTS_ENABLED=false (also off when RUN_JOBS=false).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import {
  renderEmail,
  sendEmail,
  detailBox,
  subLine,
  noteLine,
  esc,
  APP_URL,
  TRIPS_URL,
} from "./emailLayout.js";
import { manageUrlFor } from "./manageLink.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COORDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/usAirportCoords.json"), "utf8")
).airports;

const NWS = "https://api.weather.gov/alerts/active";
const UA = `Skyrio travel alerts (${process.env.SUPPORT_EMAIL || "skyrioofficial@gmail.com"})`;
const CACHE_MS = 10 * 60 * 1000;
const TRIP_WINDOW_MS = 72 * 3600 * 1000;

// Busiest US airports, for the admin view.
export const MAJOR_US_AIRPORTS = [
  "ATL", "DFW", "DEN", "ORD", "LAX", "JFK", "LAS", "MCO", "MIA", "CLT",
  "SEA", "PHX", "EWR", "SFO", "IAH", "BOS", "FLL", "MSP", "LGA", "DTW",
  "PHL", "SLC", "BWI", "DCA", "IAD", "SAN", "MDW", "TPA", "BNA", "AUS",
  "HNL", "DAL", "HOU", "STL", "RDU", "SJC", "OAK", "MCI", "SMF", "SAT",
  "IND", "CLE", "PIT", "CVG", "CMH", "MSY", "PDX", "SJU", "ANC", "RSW",
];

// Weather that can disrupt travel. Warnings only (not watches or
// advisories), and only Severe/Extreme, so travelers aren't spammed.
const TRAVEL_EVENTS =
  /(Winter Storm|Blizzard|Ice Storm|Heavy Snow|Lake Effect Snow|Snow Squall|Hurricane|Typhoon|Tropical Storm|Storm Surge|Tornado|Severe Thunderstorm|Flash Flood|Flood|Extreme Wind|High Wind|Dust Storm|Extreme Cold|Wind Chill|Excessive Heat|Extreme Heat|Red Flag)/i;

export const enabled = () =>
  process.env.WEATHER_ALERTS_ENABLED !== "false" &&
  process.env.RUN_JOBS !== "false" &&
  process.env.USE_MOCKS !== "true";

export const hasCoords = (code) => Boolean(COORDS[String(code || "").toUpperCase()]);

/** Keeps only travel-relevant warnings from an NWS GeoJSON response. */
export function pickTravelWarnings(geojson) {
  const out = [];
  for (const f of geojson?.features || []) {
    const p = f?.properties || {};
    if (p.status && p.status !== "Actual") continue;
    if (p.messageType === "Cancel") continue;
    if (!/Warning$/i.test(p.event || "")) continue;
    if (!TRAVEL_EVENTS.test(p.event || "")) continue;
    if (!["Severe", "Extreme"].includes(p.severity)) continue;
    const ends = p.ends || p.expires || null;
    if (ends && new Date(ends) < new Date()) continue;
    out.push({
      id: p.id || f.id,
      event: p.event,
      severity: p.severity,
      headline: p.headline || p.event,
      area: p.areaDesc || "",
      onset: p.onset || p.effective || null,
      ends,
    });
  }
  return out;
}

const cache = new Map(); // code -> { at, alerts }

/** Active travel warnings at an airport's location ([] if unknown/outside US). */
export async function warningsForAirport(code, { fetchImpl = fetch } = {}) {
  const c = String(code || "").toUpperCase();
  const pt = COORDS[c];
  if (!pt) return [];
  const hit = cache.get(c);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.alerts;
  try {
    const res = await fetchImpl(`${NWS}?point=${pt[0]},${pt[1]}`, {
      headers: { "User-Agent": UA, Accept: "application/geo+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`NWS ${res.status}`);
    const alerts = pickTravelWarnings(await res.json());
    cache.set(c, { at: Date.now(), alerts });
    return alerts;
  } catch (err) {
    console.warn(`[weather] ${c} lookup failed: ${err.message}`);
    return hit?.alerts || [];
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

/** Admin view: active warnings at major airports, grouped by storm type. */
export async function majorAirportWarnings(opts = {}) {
  const lists = await mapLimit(MAJOR_US_AIRPORTS, 10, (c) => warningsForAirport(c, opts));
  const groups = new Map();
  MAJOR_US_AIRPORTS.forEach((code, i) => {
    for (const a of lists[i]) {
      const g = groups.get(a.event) || { event: a.event, severity: a.severity, airports: [], ends: a.ends, headline: a.headline };
      if (!g.airports.includes(code)) g.airports.push(code);
      if (a.severity === "Extreme") g.severity = "Extreme";
      if (a.ends && (!g.ends || new Date(a.ends) > new Date(g.ends))) g.ends = a.ends;
      groups.set(a.event, g);
    }
  });
  return {
    checkedAt: new Date(),
    groups: [...groups.values()].sort((a, b) => b.airports.length - a.airports.length),
  };
}

/* ───────────── admin snapshot (kept warm) ───────────── */
// Checking 50 airports can take a while if the weather service is slow, so
// the admin list is refreshed in the background and served instantly.
const SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;
let snapshot = null;
let refreshing = null;

export function refreshMajorWarnings(opts = {}) {
  if (!refreshing) {
    refreshing = majorAirportWarnings(opts)
      .then((s) => (snapshot = s))
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Admin list. Fresh snapshot → instant. Otherwise refresh, but answer within
 * `waitMs` either way; `stillChecking: true` means try again in a few seconds.
 */
export async function getMajorWarnings({ force = false, waitMs = 12_000, ...opts } = {}) {
  const age = snapshot ? Date.now() - new Date(snapshot.checkedAt).getTime() : Infinity;
  if (!force && age < SNAPSHOT_MAX_AGE_MS) return { ...snapshot, stillChecking: false };
  const done = await Promise.race([
    refreshMajorWarnings(opts).catch(() => null),
    new Promise((r) => setTimeout(() => r(null), waitMs).unref?.()),
  ]);
  if (done) return { ...done, stillChecking: false };
  return { ...(snapshot || { checkedAt: null, groups: [] }), stillChecking: true };
}

/** Keeps the admin list warm (independent of traveler emails). */
let warmTimer = null;
export function startWeatherWarmup() {
  if (warmTimer || process.env.RUN_JOBS === "false" || process.env.USE_MOCKS === "true") return;
  const warm = () => refreshMajorWarnings().catch(() => {});
  setTimeout(warm, 45_000).unref?.();
  warmTimer = setInterval(warm, SNAPSHOT_MAX_AGE_MS);
  warmTimer.unref?.();
}

/* ───────────── traveler emails ───────────── */

const fmtWhen = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: "America/New_York",
      })
    : null;

export function weatherEmail(booking, hits) {
  const trip = booking.tripDetails || `${booking.flight?.origin || ""} → ${booking.flight?.destination || ""}`;
  const lines = hits.map(({ code, alert }) => {
    const until = fmtWhen(alert.ends);
    return `${alert.event} near ${code}${until ? `, until ${until}` : ""}`;
  });
  const title = "Severe weather near your trip";
  const intro =
    `The National Weather Service has issued a ${hits.length > 1 ? "few warnings" : "warning"} near your trip <strong>${esc(trip)}</strong>. ` +
    "Your flight could be delayed or cancelled. The airline decides.";
  const what =
    "Check your airline's app for your flight's live status. Airlines sometimes waive change fees during storms. " +
    "If the airline cancels your flight and you don't want the new one, you can get a full refund.";
  const manageUrl = booking.user ? TRIPS_URL : manageUrlFor(booking._id);
  const html = renderEmail({
    preheader: lines[0],
    title,
    introHtml: subLine(intro),
    bodyHtml:
      detailBox("Weather warnings", lines.map((l) => subLine(esc(l))).join("")) +
      detailBox("What to do", subLine(esc(what))) +
      noteLine(
        `Source: US National Weather Service. You're getting this because you have a trip with Skyrio. More: <a href="${APP_URL}/travel-disruptions">What to do when travel is disrupted</a>`
      ),
    cta: { label: "View my trip", url: manageUrl },
  });
  const text = [
    title,
    intro.replace(/<[^>]+>/g, ""),
    lines.join("\n"),
    what,
    `View your trip: ${manageUrl}`,
    "Source: US National Weather Service.",
  ].join("\n\n");
  return { title, html, text, lines };
}

/**
 * Checks confirmed flights starting in the next 3 days. One email +
 * notification per new storm type per airport per booking.
 */
export async function runTripWeatherCheck(opts = {}) {
  const now = new Date();
  const bookings = await Booking.find({
    type: "Flight",
    status: "confirmed",
    "dates.start": { $gte: new Date(now.getTime() - 6 * 3600 * 1000), $lte: new Date(now.getTime() + TRIP_WINDOW_MS) },
  })
    .select("user email name tripDetails flight.origin flight.destination dates weatherAlertKeys")
    .limit(2000)
    .lean();

  let notified = 0;
  for (const b of bookings) {
    const codes = [...new Set([b.flight?.origin, b.flight?.destination].map((c) => String(c || "").toUpperCase()).filter(hasCoords))];
    if (!codes.length) continue;
    const seen = new Set(b.weatherAlertKeys || []);
    const hits = [];
    for (const code of codes) {
      for (const alert of await warningsForAirport(code, opts)) {
        const key = `${code}:${alert.event}`;
        if (seen.has(key) || hits.some((h) => h.key === key)) continue;
        hits.push({ key, code, alert });
      }
    }
    if (!hits.length) continue;

    // Claim first, so two runs can't email the same traveler twice.
    const claimed = await Booking.updateOne(
      { _id: b._id, weatherAlertKeys: { $nin: hits.map((h) => h.key) } },
      { $addToSet: { weatherAlertKeys: { $each: hits.map((h) => h.key) } } }
    );
    if (!claimed.modifiedCount) continue;

    const { title, html, text, lines } = weatherEmail(b, hits);
    const to = b.user ? (await User.findById(b.user).select("email").lean())?.email || b.email : b.email;
    if (to) await sendEmail({ to, subject: title, html, text, tag: "weather-alert" }).catch(() => null);
    if (b.user) {
      await Notification.create({
        user: b.user,
        type: "booking",
        title,
        message: `${lines.join(". ")}. Your flight could be delayed or cancelled. Check your airline's app.`,
        link: `/saved-trips?booking=${b._id}`,
      }).catch(() => {});
    }
    notified++;
  }
  return { checked: bookings.length, notified };
}

let timer = null;
export function startWeatherJob({ everyMs = 30 * 60 * 1000 } = {}) {
  if (timer || !enabled()) {
    if (!enabled()) console.log("[weather] alerts off");
    return;
  }
  let running = false;
  const tick = async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try {
      const r = await runTripWeatherCheck();
      if (r.notified) console.log(`[weather] trips checked=${r.checked} notified=${r.notified}`);
    } catch (err) {
      console.error("[weather] trip check failed:", err.message);
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, everyMs);
  timer.unref?.();
  setTimeout(tick, 3 * 60 * 1000).unref?.();
  console.log("[weather] severe-weather trip alerts on (every 30 min)");
}
