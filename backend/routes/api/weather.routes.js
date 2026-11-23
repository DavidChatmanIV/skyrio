import { Router } from "express";
import { getForecast, codeToLabel } from "../../services/weatherForecast.js";

const router = Router();
// Same key lookup as services/weatherForecast.js, so one key on Render
// powers every weather feature.
const OWM_KEY = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
const OWM_BASE = "https://api.openweathermap.org";

// /preview cache: 10 minutes per ~1 km area, so busy pages don't use up
// OpenWeather's free-plan call limit at launch.
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const previewCache = new Map();

/**
 * GET /api/weather?city=Miami&days=5
 * Day-by-day forecast + what it's like right now (the WeatherStrip on the
 * booking page and the Sync Together trip page).
 *
 * Response also has:
 *   current:         { temp, condition, code }  (right now at the destination)
 *   forecastThrough: "YYYY-MM-DD"  last day covered, so the page can say
 *                    "your trip's forecast shows up closer to the date"
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
    const { city = "Newark", days = 5 } = req.query;
    res.json(await getForecast({ city, days }));
  } catch (err) {
    console.error("[weather] Error:", err.message);
    res.status(err.status || 500).json({
      success: false,
      message: err.status === 500 ? err.message : "Weather fetch failed",
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

    const latN = Number(req.query.lat);
    const lonN = Number(req.query.lon);
    if (
      !Number.isFinite(latN) || !Number.isFinite(lonN) ||
      Math.abs(latN) > 90 || Math.abs(lonN) > 180
    ) {
      return res
        .status(400)
        .json({ success: false, message: "lat and lon are required" });
    }
    const lat = latN.toFixed(2);
    const lon = lonN.toFixed(2);
    const cacheKey = `${lat},${lon}`;
    const hit = previewCache.get(cacheKey);
    if (hit && Date.now() - hit.at < PREVIEW_TTL_MS) {
      // Local time is worked out fresh, never served stale from the cache.
      return res.json({
        ...hit.body,
        localTimeIso: new Date(Date.now() + hit.body.timezoneOffsetSec * 1000).toISOString(),
      });
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

    const body = {
      success: true,
      temp: Math.round(currentData.main.temp),
      high,
      low,
      code: currentData.weather?.[0]?.id,
      timezoneOffsetSec: tzOffsetSec,
    };
    if (previewCache.size > 1000) previewCache.clear();
    previewCache.set(cacheKey, { at: Date.now(), body });
    res.json({ ...body, localTimeIso: new Date(nowLocalMs).toISOString() });
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
