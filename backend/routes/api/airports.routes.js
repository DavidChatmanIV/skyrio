import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const airportsPath = path.resolve(__dirname, "../../airports.json");

// Same env/key pattern as Liteapiflights.provider.js - one shared LiteAPI
// account, switched between sandbox and production via LITEAPI_ENV.
const LITEAPI_ENV = process.env.LITEAPI_ENV || "sandbox";
const LITEAPI_KEY =
  LITEAPI_ENV === "production"
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;
const LITEAPI_BASE = "https://api.liteapi.travel/v3.0";

console.log(`[airports.routes] Using ${LITEAPI_ENV} key`);

// NOTE: LiteAPI's /data/flights/airports/iatas endpoint requires a `q`
// param - despite the docs saying "call with no parameters to get all,"
// the actual param table marks q as required, and an empty call 400s.
// So this isn't a one-time full-list download like we first assumed -
// it's meant to be queried live per search term, same as Expedia's
// typeahead only searches once you start typing. We query LiteAPI on
// each request (with a short in-memory cache per search term) instead
// of trying to cache the whole database up front.

const SEARCH_CACHE = new Map(); // query -> { ts, results }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour per search term
const MIN_QUERY_LENGTH = 2; // don't call LiteAPI on 0-1 char queries

// Logs the raw shape of the first LiteAPI item exactly once per process
// so we can see the ACTUAL field names instead of guessing at them —
// same debugging approach already used to nail down LiteAPI's real
// passenger/document field names in the booking checkout flow. Once
// you've seen the real keys in your server log, update the mapping
// below and this flag stops it from logging again.
let hasLoggedRawShape = false;

let fallbackAirports = null;
function loadFallbackFile() {
  if (fallbackAirports) return fallbackAirports;
  try {
    const raw = fs.readFileSync(airportsPath, "utf-8");
    const parsed = JSON.parse(raw);
    fallbackAirports = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed || {});
  } catch (err) {
    console.error(
      "[airports.routes] Failed to load airports.json:",
      err.message
    );
    fallbackAirports = [];
  }
  return fallbackAirports;
}

function searchFallback(query) {
  const q = query.toLowerCase();
  return loadFallbackFile().filter((airport) => {
    const code = String(
      airport.code || airport.iata || airport.iata_code || ""
    ).toLowerCase();
    const name = String(airport.name || "").toLowerCase();
    const city = String(
      airport.city || airport.municipality || ""
    ).toLowerCase();
    const country = String(
      airport.country || airport.country_name || ""
    ).toLowerCase();
    return (
      !q ||
      code.includes(q) ||
      name.includes(q) ||
      city.includes(q) ||
      country.includes(q)
    );
  });
}

async function searchLiteApi(query) {
  if (!LITEAPI_KEY) return null;

  const cached = SEARCH_CACHE.get(query);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const res = await fetch(
      `${LITEAPI_BASE}/data/flights/airports/iatas?q=${encodeURIComponent(
        query
      )}`,
      { headers: { "X-API-Key": LITEAPI_KEY } }
    );

    if (!res.ok) {
      throw new Error(`LiteAPI responded ${res.status}`);
    }

    const data = await res.json();
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    // One-time diagnostic: show the ACTUAL shape LiteAPI sends back,
    // rather than continuing to guess field names. Check your server
    // log after the next search — whatever keys appear here (e.g.
    // "iataCode" vs "iata_code", "cityName" vs "city") are what the
    // mapping below needs to use.
    if (!hasLoggedRawShape && list.length > 0) {
      console.log(
        "[airports.routes] Raw LiteAPI item shape (update mapping to match this):",
        JSON.stringify(list[0], null, 2)
      );
      hasLoggedRawShape = true;
    }

    const results = list
      .map((a) => ({
        code: a.iata_code || a.code || a.iata || a.iataCode,
        name: a.name || a.airport_name || a.airportName,
        city: a.city || a.cityName || a.city_name,
        country: a.country || a.country_name || a.countryName,
      }))
      .filter((a) => a.code && a.name);

    // If LiteAPI's call itself succeeded (list.length > 0) but every
    // item got filtered out, the field-name guesses above are wrong for
    // this response — treat it as a failure and fall back to the local
    // file instead of silently returning an empty array to the user.
    if (list.length > 0 && results.length === 0) {
      console.warn(
        `[airports.routes] LiteAPI returned ${list.length} raw item(s) for "${query}" but the field mapping matched none of them — falling back to local file. See the raw shape logged above.`
      );
      return null;
    }

    SEARCH_CACHE.set(query, { ts: Date.now(), results });
    return results;
  } catch (err) {
    console.error("[airports.routes] LiteAPI fetch failed:", err.message);
    return null;
  }
}

/**
 * GET /api/airports?q=lon
 * Live LiteAPI airport search, falling back to the small local file if
 * LiteAPI is unavailable, the query is too short to bother calling it,
 * or LiteAPI's response didn't match our expected field shape.
 */
router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (query.length < MIN_QUERY_LENGTH) {
      // Not enough to search on yet - return local results so the UI
      // still has something for very short input.
      return res.json(searchFallback(query).slice(0, 25));
    }

    const liteApiResults = await searchLiteApi(query.toLowerCase());

    if (liteApiResults !== null) {
      return res.json(liteApiResults.slice(0, 25));
    }

    // LiteAPI failed (or returned nothing usable) - fall back to local
    // file for this request.
    return res.json(searchFallback(query.toLowerCase()).slice(0, 25));
  } catch (err) {
    console.error("[airports.routes] GET / error:", err);
    return res.status(500).json({ error: "Failed to load airports" });
  }
});

/**
 * GET /api/airports/health
 */
router.get("/health", async (_req, res) => {
  // Quick live check with a common query so /health actually verifies
  // LiteAPI connectivity, not just that the file loaded.
  const testResults = await searchLiteApi("new");
  return res.json({
    ok: true,
    route: "airports",
    env: LITEAPI_ENV,
    liteApiReachable: testResults !== null,
    sampleCount: testResults ? testResults.length : 0,
    fallbackCount: loadFallbackFile().length,
  });
});

export default router;
