// backend/providers/ticketmasterProvider.js
// Talks to the Ticketmaster Discovery API (read-only event data).
// Tickets are bought on Ticketmaster's site — Skyrio never sells or charges for tickets.

import { encodeGeohash } from "../utils/eventsUtils.js";

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — protects the daily quota
const CACHE_MAX = 500;
const cache = new Map();

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function getApiKey() {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) throw httpError("Events are not configured (missing TICKETMASTER_API_KEY)", 500);
  return key;
}

async function tmGet(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }

  const cacheKey = `${path}?${qs}`; // key never includes the API key
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;

  qs.set("apikey", getApiKey());
  const res = await fetch(`${TM_BASE}${path}?${qs}`, {
    headers: { Accept: "application/json" },
  });

  if (res.status === 429) throw httpError("Events are busy right now. Try again in a moment.", 503);
  if (res.status === 404) throw httpError("Event not found", 404);
  if (!res.ok) throw httpError(`Ticketmaster error ${res.status}`, 502);

  const data = await res.json();
  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return data;
}

/**
 * Search events by location + date range.
 * Pass either lat/lng (preferred, uses radius) or city (+ optional stateCode).
 */
export async function searchEvents({
  city,
  stateCode,
  lat,
  lng,
  radius = 25,
  startDateTime,
  endDateTime,
  classificationName,
  keyword,
  page = 0,
  size = 20,
}) {
  const params = {
    startDateTime,
    endDateTime,
    classificationName,
    keyword,
    page,
    size,
    sort: "date,asc",
    locale: "*",
  };

  if (lat != null && lng != null) {
    params.geoPoint = encodeGeohash(lat, lng, 9);
    params.radius = radius;
    params.unit = "miles";
  } else if (city) {
    params.city = city;
    if (stateCode) params.stateCode = stateCode;
  }

  return tmGet("/events.json", params);
}

export async function getEventById(id) {
  return tmGet(`/events/${encodeURIComponent(id)}.json`, { locale: "*" });
}
