// Destination weather from OpenWeather (free tier): what it's like now plus
// a day-by-day forecast for up to 5 days. Shared by the booking page's
// WeatherStrip (GET /api/weather) and Atlas (get_weather), so they always agree.
//
// The free 5-day/3-hour forecast only reaches ~5 days out. Anything later
// has no forecast yet; callers must say so instead of guessing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OWM_BASE = "https://api.openweathermap.org";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const key = () => process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // key → { at, body }
function cached(k) {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  if (hit) cache.delete(k);
  return null;
}
function remember(k, body) {
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(k, { at: Date.now(), body });
}


// ---- Picking the right place ----------------------------------------------
// Many US cities share a name (Newark NJ / DE / OH / CA). The geocoder's
// first hit isn't always the one people mean, so:
//  - an airport code uses the airport's own location;
//  - "Newark, NJ" is sent as "Newark,NJ,US" (the format the geocoder wants);
//  - a plain US name prefers the one with a big airport (Newark → EWR's).
const US_STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};
const STATE_BY_NAME = new Map(
  Object.entries(US_STATES).map(([ab, name]) => [name.toLowerCase(), ab])
);

export function normalizeQuery(city) {
  const parts = String(city || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length === 2) {
    const st = parts[1].toUpperCase();
    const ab = US_STATES[st] ? st : STATE_BY_NAME.get(parts[1].toLowerCase());
    if (ab) return `${parts[0]},${ab},US`;
  }
  return parts.join(",");
}

// Big US airports by city name (only names with exactly one), for the
// "plain US name" tie-break.
let BIG_AIRPORT_BY_CITY = null;
function bigAirportFor(name) {
  if (!BIG_AIRPORT_BY_CITY) {
    BIG_AIRPORT_BY_CITY = new Map();
    try {
      const airports = JSON.parse(fs.readFileSync(path.join(__dirname, "../airports.json"), "utf8"));
      const coords = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../data/usAirportCoords.json"), "utf8")
      ).airports;
      const seen = new Map();
      for (const a of airports) {
        if (a.countryCode !== "US" || a.size !== "large" || !coords[a.code]) continue;
        const k = a.city.toLowerCase();
        seen.set(k, seen.has(k) ? null : coords[a.code]);
      }
      for (const [k, v] of seen) if (v) BIG_AIRPORT_BY_CITY.set(k, v);
    } catch {
      /* no tie-break, use the geocoder's order */
    }
  }
  return BIG_AIRPORT_BY_CITY.get(String(name || "").toLowerCase()) || null;
}

export function kmBetween(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
const nearest = (list, [lat, lon]) =>
  list
    .map((g) => ({ g, km: kmBetween(lat, lon, g.lat, g.lon) }))
    .sort((a, b) => a.km - b.km)[0];

/** Picks one geocoder result. `near` = [lat, lon] of a known airport. */
export function pickPlace(results, { near, name } = {}) {
  if (!Array.isArray(results) || !results.length) return null;
  if (near) {
    const best = nearest(results, near);
    return best && best.km <= 80 ? best.g : null;
  }
  const first = results[0];
  if (first.country !== "US") return first;
  const us = results.filter((g) => g.country === "US");
  if (new Set(us.map((g) => g.state)).size < 2) return first;
  const hub = bigAirportFor(first.name || name);
  if (!hub) return first;
  const best = nearest(us, hub);
  return best && best.km <= 80 ? best.g : first;
}

// OpenWeather condition codes -> simple label (grouped by first digit)
export function codeToLabel(code) {
  if (code === 800) return "Clear";
  if (code > 800) return "Cloudy";
  if (code >= 700) return "Fog/Haze";
  if (code >= 600) return "Snow";
  if (code >= 500) return "Rain";
  if (code >= 300) return "Drizzle";
  if (code >= 200) return "Thunderstorm";
  return "Weather";
}

export class WeatherError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

/**
 * Returns the same body GET /api/weather always returned:
 * { success, city, country, latitude, longitude, timezoneOffsetSec,
 *   current, forecastThrough, forecast: [{ date, high, low, rainChance, condition, code }] }
 * or { success: false, city, error: "City not found" }.
 */
export async function getForecast({ city = "Newark", days = 5, near = null, fetchImpl = fetch } = {}) {
  const OWM_KEY = key();
  if (!OWM_KEY) throw new WeatherError("Weather API key not configured", 500);
  const q = normalizeQuery(city) || "Newark,NJ,US";
  const cacheKey = `${q.toLowerCase()}|${near ? near.join(",") : ""}|${days}`;
  const hit = cached(cacheKey);
  if (hit) return hit;
  const fetch = fetchImpl;

  // Step 1: Geocode city name to lat/lon (free tier, unchanged)
  const geoRes = await fetch(
    `${OWM_BASE}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${OWM_KEY}`
  );
  const geoData = await geoRes.json().catch(() => null);

  let place = pickPlace(geoData, { near, name: q.split(",")[0] });
  // Airport given but no match close by: use the airport's own spot.
  if (!place && near) {
    place = { lat: near[0], lon: near[1], name: String(city).split(",")[0], country: "US" };
  }
  if (!place) {
    return { success: false, city, error: "City not found" };
  }

  const { lat, lon, name, country } = place;
  const state = place.state || null;

  // Step 2: 5 day / 3 hour forecast — free tier, no card or separate
  // subscription needed (unlike One Call 3.0).
  // Plus current conditions (also free), fetched at the same time.
  const [fcRes, nowRes] = await Promise.all([
    fetch(
      `${OWM_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
    ),
    fetch(
      `${OWM_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
    ).catch(() => null),
  ]);
  const fcData = await fcRes.json();
  const nowData = nowRes ? await nowRes.json().catch(() => null) : null;

  if (fcData.cod && Number(fcData.cod) !== 200) {
    throw new WeatherError(fcData.message || "Weather fetch failed");
  }

  const tzOffsetSec = fcData.city?.timezone ?? 0;

  // Bucket the 3-hour entries into local calendar days. Each entry's
  // dt is UTC seconds; shifting by the location's tz offset before
  // formatting gives the LOCAL date, matching what a traveler at the
  // destination would actually see on their calendar.
  const buckets = new Map();
  for (const entry of fcData.list || []) {
    const localMs = (entry.dt + tzOffsetSec) * 1000;
    const localDate = new Date(localMs);
    const date = localDate.toISOString().split("T")[0];
    const localHour = localDate.getUTCHours(); // already shifted to local

    if (!buckets.has(date)) {
      buckets.set(date, { temps: [], pops: [], codes: [], middayCode: null });
    }
    const b = buckets.get(date);
    b.temps.push(entry.main.temp);
    b.pops.push(entry.pop ?? 0);
    b.codes.push(entry.weather?.[0]?.id);
    // Prefer a midday (11am-3pm local) reading as the day's
    // "representative" condition/icon, since that's most
    // recognizable to a traveler glancing at the forecast — falls
    // back to the middle entry if no midday block exists in the
    // bucket (e.g. a partial day at the start or end of the range).
    if (localHour >= 11 && localHour <= 15)
      b.middayCode = entry.weather?.[0]?.id;
  }

  const forecast = Array.from(buckets.entries())
    .slice(0, Math.min(Number(days), 5)) // 2.5 forecast only spans ~5 days
    .map(([date, b]) => {
      const code =
        b.middayCode ?? b.codes[Math.floor(b.codes.length / 2)] ?? b.codes[0];
      return {
        date,
        high: Math.round(Math.max(...b.temps)),
        low: Math.round(Math.min(...b.temps)),
        rainChance: Math.round(Math.max(...b.pops) * 100),
        condition: codeToLabel(code),
        code,
      };
    });

  const nowCode = nowData?.weather?.[0]?.id;
  const body = {
    success: true,
    city: name,
    state,
    country,
    latitude: lat,
    longitude: lon,
    timezoneOffsetSec: tzOffsetSec,
    current:
      nowData && Number(nowData.cod) === 200 && nowData.main
        ? {
            temp: Math.round(nowData.main.temp),
            condition: codeToLabel(nowCode),
            code: nowCode,
          }
        : null,
    forecastThrough: forecast.length
      ? forecast[forecast.length - 1].date
      : null,
    forecast,
  };

  remember(cacheKey, body);
  return body;
}
