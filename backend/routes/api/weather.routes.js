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
 * Full day-by-day forecast (for booking checkout / destination pages)
 * Uses OpenWeather Geocoding + 5 Day / 3 Hour Forecast (free tier)
 * Days are bucketed using the DESTINATION's local timezone, not UTC.
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

    // Step 1: Geocode city name to lat/lon
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

    // Step 2: Fetch 5 day / 3 hour forecast
    const weatherRes = await fetch(
      `${OWM_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
    );
    const weatherData = await weatherRes.json();

    if (weatherData.cod && Number(weatherData.cod) !== 200) {
      return res.status(502).json({
        success: false,
        message: "Weather fetch failed",
        error: weatherData.message || "Unknown error",
      });
    }

    // Step 3: Collapse 3-hour blocks into daily hi/lo, bucketed by
    // the DESTINATION's local day (not the server/UTC day)
    const tzOffsetSec = weatherData.city?.timezone ?? 0; // seconds from UTC

    const dailyMap = new Map();
    for (const entry of weatherData.list || []) {
      const localMs = (entry.dt + tzOffsetSec) * 1000;
      const date = new Date(localMs).toISOString().split("T")[0]; // local Y-M-D

      const temp = entry.main.temp;
      const code = entry.weather?.[0]?.id;
      const pop = entry.pop != null ? Math.round(entry.pop * 100) : null;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          high: temp,
          low: temp,
          rainChance: pop ?? 0,
          code,
        });
      } else {
        const day = dailyMap.get(date);
        day.high = Math.max(day.high, temp);
        day.low = Math.min(day.low, temp);
        day.rainChance = Math.max(day.rainChance, pop ?? 0);
      }
    }

    const forecast = Array.from(dailyMap.values())
      .slice(0, Math.min(Number(days), 5))
      .map((d) => ({
        date: d.date,
        high: Math.round(d.high),
        low: Math.round(d.low),
        rainChance: d.rainChance,
        condition: codeToLabel(d.code),
        code: d.code,
      }));

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
 * Lightweight current temp + today's hi/lo (for the WeatherChip widget)
 * Includes the destination's local wall-clock time.
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

    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `${OWM_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
      ),
      fetch(
        `${OWM_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
      ),
    ]);
    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    if (current.cod && Number(current.cod) !== 200) {
      return res.status(502).json({
        success: false,
        message: current.message || "Weather fetch failed",
      });
    }

    const tzOffsetSec = current.timezone ?? 0;

    // Destination's current local date
    const destLocalMs = (current.dt + tzOffsetSec) * 1000;
    const destLocalDate = new Date(destLocalMs).toISOString().split("T")[0];

    // Pull today's hi/lo from the forecast list, bucketed the same way
    let high = current.main.temp_max;
    let low = current.main.temp_min;
    for (const entry of forecast.list || []) {
      const entryLocalMs = (entry.dt + tzOffsetSec) * 1000;
      const entryLocalDate = new Date(entryLocalMs).toISOString().split("T")[0];
      if (entryLocalDate === destLocalDate) {
        high = Math.max(high, entry.main.temp);
        low = Math.min(low, entry.main.temp);
      }
    }

    res.json({
      success: true,
      temp: Math.round(current.main.temp),
      high: Math.round(high),
      low: Math.round(low),
      code: current.weather?.[0]?.id,
      timezoneOffsetSec: tzOffsetSec,
      localTimeIso: new Date(destLocalMs).toISOString(),
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
