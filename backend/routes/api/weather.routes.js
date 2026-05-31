import { Router } from "express";

const router = Router();

/**
 * GET /api/weather?city=Miami&days=7
 * Uses Open-Meteo (free, no API key needed)
 */
router.get("/", async (req, res) => {
  try {
    const { city = "Newark", days = 7 } = req.query;

    // Step 1: Geocode city name to lat/lon
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.json({
        success: false,
        city,
        error: "City not found",
      });
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    // Step 2: Fetch weather forecast
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&forecast_days=${Math.min(
        Number(days),
        16
      )}`
    );
    const weatherData = await weatherRes.json();

    // Weather code descriptions
    const weatherCodes = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Rime fog",
      51: "Light drizzle",
      53: "Drizzle",
      55: "Heavy drizzle",
      61: "Light rain",
      63: "Rain",
      65: "Heavy rain",
      71: "Light snow",
      73: "Snow",
      75: "Heavy snow",
      80: "Light showers",
      81: "Showers",
      82: "Heavy showers",
      95: "Thunderstorm",
      96: "Thunderstorm w/ hail",
      99: "Heavy thunderstorm",
    };

    const forecast =
      weatherData.daily?.time?.map((date, i) => ({
        date,
        high: Math.round(weatherData.daily.temperature_2m_max[i]),
        low: Math.round(weatherData.daily.temperature_2m_min[i]),
        rainChance: weatherData.daily.precipitation_probability_max[i],
        condition: weatherCodes[weatherData.daily.weathercode[i]] || "Unknown",
        code: weatherData.daily.weathercode[i],
      })) || [];

    res.json({
      success: true,
      city: name,
      country,
      latitude,
      longitude,
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

export default router;
