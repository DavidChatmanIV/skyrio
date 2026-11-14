// Atlas's get_weather tool. Real data only:
//  - Forecast: OpenWeather, up to ~5 days out (same data as the booking
//    page's weather strip).
//  - Severe weather warnings: US National Weather Service (US + territories).
// Beyond the forecast window there is NO forecast. Atlas may describe what
// the weather is usually like that time of year, clearly labeled as typical.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getForecast } from "../weatherForecast.js";
import { warningsForAirport, warningsForPoint, hasCoords } from "../weatherAlerts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AIRPORTS = new Map(
  JSON.parse(fs.readFileSync(path.join(__dirname, "../../airports.json"), "utf8")).map(
    (a) => [a.code, a]
  )
);
const NWS_COUNTRIES = new Set(["US", "PR", "VI", "GU", "AS", "MP"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const GET_WEATHER_TOOL = {
  name: "get_weather",
  description:
    "Weather for a city or airport: right now, a day-by-day forecast up to about 5 days out, and any official severe weather warnings (US only, from the National Weather Service). Use it when the traveler asks about weather, what to pack, or whether a storm could affect their trip. For their own booked trip, call list_my_bookings first to get the airports and dates.",
  parameters: {
    type: "object",
    properties: {
      place: {
        type: "string",
        description: "City (e.g. 'Miami', 'Portland, OR', 'Paris, France') or a 3-letter airport code (e.g. 'EWR')",
      },
      startDate: { type: "string", description: "YYYY-MM-DD, first day they care about (default: today)" },
      endDate: { type: "string", description: "YYYY-MM-DD, last day (default: startDate)" },
    },
    required: ["place"],
  },
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const todayIn = (tz = "America/New_York") =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function getWeatherForAtlas(input = {}, { fetchImpl } = {}) {
  const raw = String(input.place || "").trim();
  if (!raw) return { error: "Ask which city or airport they mean." };

  // Airport code → its city (and remember the code for warnings).
  let query = raw;
  let airport = null;
  if (/^[A-Za-z]{3}$/.test(raw) && AIRPORTS.has(raw.toUpperCase())) {
    airport = AIRPORTS.get(raw.toUpperCase());
    query = `${airport.city},${airport.countryCode}`;
  }

  let fc;
  try {
    fc = await getForecast({ city: query, days: 5, ...(fetchImpl ? { fetchImpl } : {}) });
  } catch {
    return { error: "Couldn't get the weather right now. Say so in one line and suggest checking a weather app." };
  }
  if (!fc?.success) {
    return { error: `Couldn't find "${raw}". Ask for the city and state or country.` };
  }

  const today = todayIn();
  const start = ISO.test(input.startDate || "") ? input.startDate : today;
  const end = ISO.test(input.endDate || "") && input.endDate >= start ? input.endDate : start;
  const through = fc.forecastThrough;
  const days = (fc.forecast || [])
    .filter((d) => d.date >= start && d.date <= end)
    .map(({ date, high, low, rainChance, condition }) => ({
      date,
      highF: high,
      lowF: low,
      rainChancePct: rainChance,
      condition,
    }));

  const tooFar = !through || start > through;
  const partial = !tooFar && end > through;

  // Official warnings (US only). Airport point if we have it, else the city.
  let warnings = [];
  const country = String(fc.country || airport?.countryCode || "").toUpperCase();
  if (NWS_COUNTRIES.has(country)) {
    const list =
      airport && hasCoords(airport.code)
        ? await warningsForAirport(airport.code, fetchImpl ? { fetchImpl } : {})
        : await warningsForPoint(fc.latitude, fc.longitude, fetchImpl ? { fetchImpl } : {});
    warnings = list.map((w) => ({ event: w.event, until: w.ends, area: w.area }));
  }

  return {
    place: `${fc.city}${fc.country ? `, ${fc.country}` : ""}${airport ? ` (${airport.code})` : ""}`,
    today,
    rightNow: fc.current
      ? { tempF: fc.current.temp, condition: fc.current.condition }
      : null,
    forecast: days,
    forecastCoversThrough: through,
    noForecastYet: tooFar
      ? { reason: "Too far out for a forecast.", forecastAvailableAround: addDays(start, -4) }
      : null,
    partialForecast: partial ? `Forecast only goes through ${through}.` : null,
    warnings,
    warningsChecked: NWS_COUNTRIES.has(country)
      ? "US National Weather Service"
      : "No official warnings source outside the US",
    sources: "Forecast: OpenWeather. Warnings: US National Weather Service.",
    instruction: [
      "Give the weather in 1-3 short lines. Use °F. Name dates (e.g. Thu Nov 20).",
      tooFar
        ? "There is NO forecast for these dates yet. Say so, and that it shows up about 5 days before. You may say what it's usually like there that time of year, labeled 'usually' or 'typically', with no exact numbers."
        : "Only use the numbers above. Don't add days that aren't listed.",
      warnings.length
        ? "There's an official severe weather warning. Name it and the source (National Weather Service). Flights could be delayed or cancelled; the airline decides. Never say a flight will be cancelled. Tell them to check their airline's app."
        : "No official warnings were found. Don't invent any.",
      "Don't predict flight delays from the forecast alone.",
    ].join(" "),
  };
}
