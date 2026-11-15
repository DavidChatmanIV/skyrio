// Tidy place names so the same city always looks and groups the same:
//   "newark nj" / "Newark Nj" / "newark, new jersey"  → "Newark, NJ"
//   "MIAMI"                                           → "Miami"
//   "Paris, France"                                   → "Paris, France"
// Same rules as frontend/my-app/src/lib/placeName.js — keep them in sync.
// Then geocodePlace() finds it on the map (OpenWeather, same geocoder as
// the weather), so SkyHub's Nearby tab can search by distance.
import { normalizeQuery, pickPlace } from "./weatherForecast.js";

const STATES = {
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
const BY_NAME = new Map(Object.entries(STATES).map(([ab, n]) => [n.toLowerCase(), ab]));
const SMALL = new Set(["of", "de", "la", "del", "da", "do", "the", "and", "on", "upon", "en"]);

const stateCode = (s) => {
  const t = String(s || "").trim();
  if (/^[A-Za-z]{2}$/.test(t) && STATES[t.toUpperCase()]) return t.toUpperCase();
  return BY_NAME.get(t.toLowerCase()) || null;
};

// Only re-case words typed all-lower or ALL-CAPS; keep "McAllen", "LaGuardia".
function niceCase(s) {
  return s
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      const mixed = /[a-z]/.test(w) && /[A-Z]/.test(w) && w !== w[0].toUpperCase() + w.slice(1).toLowerCase();
      if (mixed) return w;
      const lw = w.toLowerCase();
      if (i > 0 && SMALL.has(lw)) return lw;
      return lw.replace(/(^|[-'’.])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
    })
    .join(" ");
}

export function tidyPlace(raw) {
  let s = String(raw || "").replace(/\s+/g, " ").trim().replace(/^[,\s]+|[,\s]+$/g, "");
  if (!s) return "";
  let parts = s.split(",").map((p) => p.trim()).filter(Boolean);

  // "Newark NJ" / "Newark New Jersey" (no comma): split the state off the end.
  if (parts.length === 1) {
    const words = parts[0].split(" ");
    for (const n of [2, 1]) {
      if (words.length > n) {
        const code = stateCode(words.slice(-n).join(" "));
        if (code) {
          parts = [words.slice(0, -n).join(" "), code];
          break;
        }
      }
    }
  }
  return parts
    .map((p, i) => {
      if (i > 0) {
        const code = stateCode(p);
        if (code) return code;
        if (/^[A-Za-z]{2,3}$/.test(p) && p === p.toUpperCase()) return p; // "UK", "USA"
      }
      return niceCase(p);
    })
    .join(", ")
    .slice(0, 120);
}

/** Same place → same key ("Newark Nj" and "newark, NJ" group together). */
export const placeKey = (raw) => tidyPlace(raw).toLowerCase();

// ---- Map lookup -----------------------------------------------------------
const OWM = "https://api.openweathermap.org/geo/1.0/direct";
const DAY = 24 * 3600 * 1000;
const cache = new Map(); // key → { at, point|null }

/** → { lat, lng } or null. Never throws; gives up after ~4s. */
export async function geocodePlace(raw, { fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const name = tidyPlace(raw);
  const apiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!name || !apiKey) return null;
  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.point ? 30 * DAY : DAY)) return hit.point;

  const q = normalizeQuery(name);
  let point = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetchImpl(`${OWM}?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const list = await res.json().catch(() => null);
    const pick = pickPlace(list, { name: q.split(",")[0] });
    if (pick && Number.isFinite(pick.lat) && Number.isFinite(pick.lon)) point = { lat: pick.lat, lng: pick.lon };
  } catch {
    return null; // network hiccup: don't cache, try again next time
  }
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), point });
  return point;
}

/** GeoJSON for Mongo ([lng, lat]) or undefined. */
export const toGeoPoint = (p) =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { type: "Point", coordinates: [p.lng, p.lat] } : undefined;

// ---- Catch up older SkyHub posts -------------------------------------------
// Posts made before places were mapped have a destination but no map point,
// so the Nearby tab can't find them. Once after startup, look up each
// distinct place (a few at a time) and fill them in.
export async function backfillSkyHubPlaces({ Post, limit = 150, fetchImpl } = {}) {
  if (!Post) Post = (await import("../models/SkyHubPost.js")).default;
  const rows = await Post.find({
    destination: { $nin: ["", null] },
    "location.coordinates": { $exists: false },
  })
    .select("_id destination")
    .limit(limit)
    .lean();
  const byPlace = new Map();
  for (const r of rows) {
    const k = placeKey(r.destination);
    if (!byPlace.has(k)) byPlace.set(k, { name: r.destination, ids: [] });
    byPlace.get(k).ids.push(r._id);
  }
  let mapped = 0;
  for (const { name, ids } of byPlace.values()) {
    const point = toGeoPoint(await geocodePlace(name, fetchImpl ? { fetchImpl } : {}));
    if (!point) continue;
    const r = await Post.updateMany({ _id: { $in: ids } }, { $set: { location: point } });
    mapped += r.modifiedCount ?? r.nModified ?? 0;
  }
  return { checked: rows.length, places: byPlace.size, mapped };
}

export function startSkyHubPlaceBackfill({ delayMs = 20_000 } = {}) {
  if (!(process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY)) return;
  const t = setTimeout(() => {
    backfillSkyHubPlaces()
      .then((r) => r.checked && console.log(`[skyhub] mapped older posts: ${r.mapped} of ${r.checked} (${r.places} places)`))
      .catch((e) => console.warn("[skyhub] place catch-up failed:", e.message));
  }, delayMs);
  t.unref?.();
}
