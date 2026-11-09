// backend/utils/eventsUtils.js
// Helpers for the events vertical: query parsing, normalizing Ticketmaster data,
// trip-date suggestions and distance-to-venue sorting.

// Skyrio tab id -> Ticketmaster segment name
export const CATEGORY_MAP = {
  sports: "Sports",
  music: "Music",
  shows: "Arts & Theatre",
  family: "Family",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(str) {
  if (!DATE_RE.test(str || "")) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// "2026-12-14" -> "2026-12-14T00:00:00Z" (start) or "2026-12-14T23:59:59Z" (end)
export function toTmDateTime(dateStr, endOfDay = false) {
  return `${dateStr}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Arrive the day before, leave the day after.
export function suggestTripDates(eventLocalDate) {
  if (!isValidDate(eventLocalDate)) return null;
  return {
    checkIn: addDays(eventLocalDate, -1),
    checkOut: addDays(eventLocalDate, 1),
    departDate: addDays(eventLocalDate, -1),
    returnDate: addDays(eventLocalDate, 1),
  };
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Geohash encoder (Ticketmaster's geoPoint param)
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function encodeGeohash(lat, lng, precision = 9) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "", bit = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; lngMin = mid; } else { ch <<= 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

// Pick a wide image that's sharp enough for a card, without grabbing the huge one.
export function pickImage(images = []) {
  if (!images.length) return null;
  const wide = images.filter((i) => i.ratio === "16_9" && i.width >= 640 && !i.fallback);
  const pool = wide.length ? wide : images;
  return [...pool].sort((a, b) => a.width - b.width)[0]?.url || null;
}

function normalizeVenue(v) {
  if (!v) return null;
  const lat = Number(v.location?.latitude);
  const lng = Number(v.location?.longitude);
  return {
    id: v.id,
    name: v.name || "Venue TBA",
    address: v.address?.line1 || "",
    city: v.city?.name || "",
    state: v.state?.stateCode || v.state?.name || "",
    country: v.country?.countryCode || "",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

const SEGMENT_TO_CATEGORY = {
  Sports: "sports",
  Music: "music",
  "Arts & Theatre": "shows",
  Family: "family",
};

// Only real data from Ticketmaster — if a price isn't provided, priceRange stays null.
export function normalizeEvent(e) {
  const cls = e.classifications?.[0] || {};
  const start = e.dates?.start || {};
  const price = e.priceRanges?.[0];

  return {
    id: e.id,
    source: "ticketmaster",
    name: e.name,
    url: e.url, // "Buy on Ticketmaster" link (affiliate tracking added later via Impact)
    category: SEGMENT_TO_CATEGORY[cls.segment?.name] || "other",
    genre: cls.genre?.name && cls.genre.name !== "Undefined" ? cls.genre.name : null,
    date: start.localDate || null,
    time: start.timeTBA || start.noSpecificTime ? null : start.localTime || null,
    dateTime: start.dateTime || null,
    timezone: e.dates?.timezone || null,
    status: e.dates?.status?.code || "onsale",
    image: pickImage(e.images),
    priceRange:
      price && Number.isFinite(price.min)
        ? { min: price.min, max: price.max ?? price.min, currency: price.currency || "USD" }
        : null,
    venue: normalizeVenue(e._embedded?.venues?.[0]),
    suggestedDates: suggestTripDates(start.localDate),
  };
}

// Haversine distance in miles
export function distanceMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sort hotels (or anything) by distance to a venue.
 * getLatLng(item) must return { lat, lng } — adapt it to your LiteAPI hotel shape.
 * Adds `distanceToVenueMiles` to each item; items without coordinates go last.
 */
export function sortByDistanceToVenue(items, venue, getLatLng) {
  return items
    .map((item) => {
      const miles = distanceMiles(getLatLng(item), venue);
      return { ...item, distanceToVenueMiles: miles == null ? null : Math.round(miles * 10) / 10 };
    })
    .sort((a, b) => {
      if (a.distanceToVenueMiles == null) return 1;
      if (b.distanceToVenueMiles == null) return -1;
      return a.distanceToVenueMiles - b.distanceToVenueMiles;
    });
}
