import { Router } from "express";

const router = Router();
const OWM_KEY = process.env.WEATHER_API_KEY;
const OWM_BASE = "https://api.openweathermap.org";

// OpenWeather condition codes -> simple label (grouped by first digit)
function codeToLabel(code) {
  if (code === 800) return "Clear";
  if (code > 800) return "Cloudy";
  if (code >= 700) return "Fog/Haze";
  if (code >= 600) return "Snow";
  if (code >= 500) return "Rain";
  if (code >= 300) return "Drizzle";
  if (code >= 200) return "Thunderstorm";
  return "Weather";
}

/**
 * GET /api/weather?city=Miami&days=5
 * Full day-by-day forecast (for booking checkout / destination pages).
 *
 * Uses OpenWeather Geocoding (free) + the 5-day/3-hour Forecast API
 * (/data/2.5/forecast — also free, no card or separate subscription
 * required). This replaces a previous version that used One Call 3.0,
 * which requires activating a separate "One Call by Call" plan on the
 * OpenWeather account (still free under 1,000 calls/day, but gated
 * behind account setup) — confirmed via a live 401
 * ("requires a separate subscription to the One Call by Call plan").
 *
 * Trade-offs vs. the old One Call version:
 * - /data/2.5/forecast returns 3-hour blocks, not pre-computed daily
 *   min/max, so this route buckets them into daily hi/lo itself below.
 * - Only covers ~5 days (40 entries × 3h), not 8.
 * - TODAY's bucket may look artificially mild/narrow: this endpoint
 *   only returns blocks from now onward, not hours earlier today that
 *   have already passed — the opposite of One Call, which always
 *   returned the full day's real min/max regardless of the time of
 *   the request.
 */
router.get("/", async (req, res) => {
  try {
    if (!OWM_KEY) {
      return res.status(500).json({
        success: false,
        message: "Weather API key not configured",
      });
    }

    const { city = "Newark", days = 5 } = req.query;

    // Step 1: Geocode city name to lat/lon (free tier, unchanged)
    const geoRes = await fetch(
      `${OWM_BASE}/geo/1.0/direct?q=${encodeURIComponent(
        city
      )}&limit=1&appid=${OWM_KEY}`
    );
    const geoData = await geoRes.json();

    if (!Array.isArray(geoData) || geoData.length === 0) {
      return res.json({
        success: false,
        city,
        error: "City not found",
      });
    }

    const { lat, lon, name, country } = geoData[0];

    // Step 2: 5 day / 3 hour forecast — free tier, no card or separate
    // subscription needed (unlike One Call 3.0).
    const fcRes = await fetch(
      `${OWM_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
    );
    const fcData = await fcRes.json();

    if (fcData.cod && Number(fcData.cod) !== 200) {
      return res.status(502).json({
        success: false,
        message: "Weather fetch failed",
        error: fcData.message || "Unknown error",
      });
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

    res.json({
      success: true,
      city: name,
      country,
      latitude: lat,
      longitude: lon,
      timezoneOffsetSec: tzOffsetSec,
      forecast,
    });
  } catch (err) {
    console.error("[weather] Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Weather fetch failed",
      error: err.message,
    });
  }
});

/**
 * GET /api/weather/preview?lat=&lon=
 * Lightweight current temp + TODAY's hi/lo (for the WeatherChip widget).
 *
 * Uses /data/2.5/weather (current conditions — free) for the live temp,
 * plus /data/2.5/forecast (also free) to derive today's hi/lo from
 * whatever 3-hour blocks remain for today. Same today's-bucket caveat
 * as above: if it's evening local time, "today" here may only reflect
 * the last block or two rather than the full day's actual range.
 */
router.get("/preview", async (req, res) => {
  try {
    if (!OWM_KEY) {
      return res.status(500).json({
        success: false,
        message: "Weather API key not configured",
      });
    }

    const { lat, lon } = req.query;
    if (lat == null || lon == null) {
      return res
        .status(400)
        .json({ success: false, message: "lat and lon are required" });
    }

    const [currentRes, fcRes] = await Promise.all([
      fetch(
        `${OWM_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
      ),
      fetch(
        `${OWM_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
      ),
    ]);
    const currentData = await currentRes.json();
    const fcData = await fcRes.json();

    if (currentData.cod && Number(currentData.cod) !== 200) {
      return res.status(502).json({
        success: false,
        message: currentData.message || "Weather fetch failed",
      });
    }

    const tzOffsetSec = currentData.timezone ?? fcData.city?.timezone ?? 0;
    const nowLocalMs = (currentData.dt + tzOffsetSec) * 1000;
    const todayDate = new Date(nowLocalMs).toISOString().split("T")[0];

    // Pull today's remaining 3-hour blocks out of the forecast list to
    // derive a hi/lo — falls back to the current temp alone if the
    // forecast call failed or returned nothing for today.
    let high = Math.round(currentData.main.temp);
    let low = Math.round(currentData.main.temp);
    if (Array.isArray(fcData.list)) {
      const todaysTemps = fcData.list
        .filter((entry) => {
          const localMs = (entry.dt + tzOffsetSec) * 1000;
          return new Date(localMs).toISOString().split("T")[0] === todayDate;
        })
        .map((entry) => entry.main.temp);
      if (todaysTemps.length > 0) {
        high = Math.round(Math.max(...todaysTemps, currentData.main.temp));
        low = Math.round(Math.min(...todaysTemps, currentData.main.temp));
      }
    }

    res.json({
      success: true,
      temp: Math.round(currentData.main.temp),
      high,
      low,
      code: currentData.weather?.[0]?.id,
      timezoneOffsetSec: tzOffsetSec,
      localTimeIso: new Date(nowLocalMs).toISOString(),
    });
  } catch (err) {
    console.error("[weather-preview] Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Weather fetch failed",
      error: err.message,
    });
  }
});

export default router;
