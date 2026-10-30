// backend/utils/geocode.js
// Turns a place name like "Orange, NJ" into a GeoJSON point using
// OpenWeather's geocoding API. Returns null if the place can't be found.
//
// OpenWeather reads "City,XX" as city + COUNTRY, so "Orange, NJ" would fail.
// For US places we send "City,STATE,US" instead (state code is only
// supported for the US). Full state names ("Orange, New Jersey") work too.

const US_STATES = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "puerto rico": "PR",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};
const US_CODES = new Set(Object.values(US_STATES));

// Finds a US state in "NJ", "New Jersey", "NJ, US", "New Jersey, USA", ...
function usStateIn(parts) {
  for (const raw of parts) {
    const p = raw.trim();
    if (US_CODES.has(p.toUpperCase())) return p.toUpperCase();
    const name = US_STATES[p.toLowerCase()];
    if (name) return name;
  }
  return null;
}

// The queries to try, best first.
function queriesFor(place) {
  const parts = place
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const city = parts[0];
  const rest = parts.slice(1);
  const state = usStateIn(rest);
  const tries = [];
  if (state) tries.push(`${city},${state},US`);
  tries.push(parts.join(","));
  return [...new Set(tries)];
}

const cache = new Map();

async function lookup(q) {
  const url =
    "https://api.openweathermap.org/geo/1.0/direct" +
    `?q=${encodeURIComponent(q)}&limit=1` +
    `&appid=${process.env.OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const [hit] = await res.json();
  return hit ? { type: "Point", coordinates: [hit.lon, hit.lat] } : null;
}

export async function geocodePlace(place) {
  const q = String(place || "").trim();
  if (!q) return null;

  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    let point = null;
    for (const attempt of queriesFor(q)) {
      point = await lookup(attempt);
      if (point) break;
    }
    cache.set(key, point);
    return point;
  } catch {
    return null;
  }
}
