// Destination weather from OpenWeather (free tier): what it's like now plus
// a day-by-day forecast for up to 5 days. Shared by the booking page's
// WeatherStrip (GET /api/weather) and Atlas (get_weather), so they always agree.
//
// The free 5-day/3-hour forecast only reaches ~5 days out. Anything later
// has no forecast yet; callers must say so instead of guessing.

const OWM_BASE = "https://api.openweathermap.org";
const key = () => process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;

const CACHE_MS = 20 * 60 * 1000;
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
export async function getForecast({ city = "Newark", days = 5, fetchImpl = fetch } = {}) {
  const OWM_KEY = key();
  if (!OWM_KEY) throw new WeatherError("Weather API key not configured", 500);
  const cacheKey = `${String(city).trim().toLowerCase()}|${days}`;
  const hit = cached(cacheKey);
  if (hit) return hit;
  const fetch = fetchImpl;

  // Step 1: Geocode city name to lat/lon (free tier, unchanged)
  const geoRes = await fetch(
    `${OWM_BASE}/geo/1.0/direct?q=${encodeURIComponent(
      city
    )}&limit=1&appid=${OWM_KEY}`
  );
  const geoData = await geoRes.json();

  if (!Array.isArray(geoData) || geoData.length === 0) {
    return { success: false, city, error: "City not found" };
  }

  const { lat, lon, name, country } = geoData[0];

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
