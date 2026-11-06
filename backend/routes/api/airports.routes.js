import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const airportsPath = path.resolve(__dirname, "../../airports.json");

// ─────────────────────────────────────────────────────────────
// Airport search for every "From / To" box.
//
// Main source: backend/airports.json — every airport worldwide with an
// IATA code and scheduled passenger flights (~4,000, from the open
// OurAirports dataset). Searching it is instant and never depends on an
// outside API, so airports like Kingston (KIN) always show up.
//
// LiteAPI's airport search is only asked when the local list finds fewer
// than 5 matches, and anything new it returns is added to the results.
//
// Ranking, best first: exact code ("KIN") → city starts with → code starts
// with → airport name starts with → anything else that matches. Bigger
// airports win ties. Every word typed must match ("kingston jamaica"
// finds KIN, not Kingston, Ontario).
// ─────────────────────────────────────────────────────────────

const LITEAPI_ENV = process.env.LITEAPI_ENV || "sandbox";
const LITEAPI_KEY =
  LITEAPI_ENV === "production"
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;
const LITEAPI_BASE = "https://api.liteapi.travel/v3.0";

const MAX_RESULTS = 25;
const MIN_QUERY_LENGTH = 2;
const LITEAPI_WHEN_FEWER_THAN = 5;
const SEARCH_CACHE = new Map(); // query -> { ts, results }
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 2000;
const SIZE_RANK = { large: 0, medium: 1, small: 2 };

// Busy hubs win ties ("lon" → London before Long Beach) and fill the list
// before anything is typed.
const HUBS = [
  "ATL",
  "DFW",
  "DEN",
  "ORD",
  "LAX",
  "JFK",
  "LAS",
  "MCO",
  "MIA",
  "CLT",
  "SEA",
  "PHX",
  "EWR",
  "SFO",
  "IAH",
  "BOS",
  "FLL",
  "MSP",
  "LGA",
  "DTW",
  "PHL",
  "SLC",
  "BWI",
  "DCA",
  "IAD",
  "SAN",
  "TPA",
  "AUS",
  "BNA",
  "MDW",
  "HNL",
  "YYZ",
  "YVR",
  "YUL",
  "MEX",
  "CUN",
  "SJU",
  "KIN",
  "MBJ",
  "NAS",
  "PUJ",
  "SDQ",
  "MBJ",
  "BGI",
  "POS",
  "LHR",
  "LGW",
  "CDG",
  "AMS",
  "FRA",
  "MAD",
  "BCN",
  "FCO",
  "MUC",
  "IST",
  "DXB",
  "DOH",
  "HND",
  "NRT",
  "ICN",
  "SIN",
  "HKG",
  "BKK",
  "SYD",
  "GRU",
  "BOG",
  "LIM",
  "SCL",
  "EZE",
  "JNB",
  "LOS",
  "ACC",
  "NBO",
  "CAI",
  "DUB",
  "LIS",
  "ZRH",
  "CPH",
  "DEL",
  "BOM",
];
const HUB_RANK = new Map(HUBS.map((c, i) => [c, i]));

// Cities with more than one airport, and nicknames people type.
const METRO = {
  "new york": ["JFK", "LGA", "EWR"],
  nyc: ["JFK", "LGA", "EWR"],
  london: ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"],
  paris: ["CDG", "ORY"],
  tokyo: ["HND", "NRT"],
  chicago: ["ORD", "MDW"],
  washington: ["IAD", "DCA", "BWI"],
  dc: ["IAD", "DCA", "BWI"],
  miami: ["MIA", "FLL"],
  "san francisco": ["SFO", "OAK", "SJC"],
  "bay area": ["SFO", "OAK", "SJC"],
  "los angeles": ["LAX", "BUR", "LGB", "SNA", "ONT"],
  la: ["LAX", "BUR", "LGB", "SNA", "ONT"],
  houston: ["IAH", "HOU"],
  dallas: ["DFW", "DAL"],
  rome: ["FCO", "CIA"],
  milan: ["MXP", "LIN", "BGY"],
  toronto: ["YYZ", "YTZ"],
  "sao paulo": ["GRU", "CGH", "VCP"],
  "buenos aires": ["EZE", "AEP"],
  seoul: ["ICN", "GMP"],
  orlando: ["MCO", "SFB"],
};

/* ── local list ─────────────────────────────────────────────── */

const fold = (s = "") =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // "Bogotá" matches "bogota"
    .toLowerCase()
    .trim();

let airports = null;
function loadAirports() {
  if (airports) return airports;
  try {
    const parsed = JSON.parse(fs.readFileSync(airportsPath, "utf-8"));
    const list = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
    airports = list
      .map((a) => {
        const code = String(
          a.code || a.iata || a.iata_code || ""
        ).toUpperCase();
        const item = {
          code,
          name: a.name || "",
          city: a.city || a.municipality || "",
          country: a.country || a.country_name || "",
          countryCode: a.countryCode || "",
          size: a.size || "medium",
        };
        // Pre-folded text so each search doesn't redo it.
        item._code = fold(code);
        item._city = fold(item.city);
        item._name = fold(item.name);
        item._country = fold(item.country);
        item._all = `${item._code} ${item._city} ${item._name} ${
          item._country
        } ${fold(item.countryCode)}`;
        return item;
      })
      .filter((a) => a.code.length === 3);
    console.log(`[airports.routes] Loaded ${airports.length} airports`);
  } catch (err) {
    console.error(
      "[airports.routes] Failed to load airports.json:",
      err.message
    );
    airports = [];
  }
  return airports;
}

/** Lower is better; null = not a match. */
function score(a, q, words) {
  const metro = METRO[q];
  if (metro?.includes(a.code)) return 1 + metro.indexOf(a.code) * 0.01;
  if (!words.every((w) => a._all.includes(w))) return null;
  // Tie-breakers inside a tier: busy hubs first, then bigger airports.
  const hub = HUB_RANK.get(a.code);
  const sizeBonus =
    hub !== undefined ? hub * 0.0005 : 0.05 + (SIZE_RANK[a.size] ?? 1) * 0.1;
  if (a._code === q) return 0;
  if (a._city === q) return 1 + sizeBonus;
  if (a._city.startsWith(q)) return 2 + sizeBonus;
  if (a._code.startsWith(q)) return 3 + sizeBonus;
  if (a._name.startsWith(q)) return 4 + sizeBonus;
  // First word typed matches the start of the city ("kingston jam…")
  if (a._city.startsWith(words[0])) return 5 + sizeBonus;
  if (a._name.split(/\s+/).some((w) => w.startsWith(words[0])))
    return 6 + sizeBonus;
  return 7 + sizeBonus;
}

function searchLocal(query) {
  const q = fold(query);
  const words = q.split(/[\s,()]+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const a of loadAirports()) {
    const s = score(a, q, words);
    if (s !== null) hits.push({ a, s });
  }
  hits.sort((x, y) => x.s - y.s || x.a.code.localeCompare(y.a.code));
  return hits.slice(0, MAX_RESULTS).map(({ a }) => publicView(a));
}

const publicView = (a) => ({
  code: a.code,
  name: a.name,
  city: a.city,
  country: a.country,
});

/** Popular airports for 0–1 letters typed, so the list isn't empty. */
function popular() {
  const byCode = new Map(loadAirports().map((a) => [a.code, a]));
  return [...new Set(HUBS)]
    .map((c) => byCode.get(c))
    .filter(Boolean)
    .slice(0, MAX_RESULTS)
    .map(publicView);
}

/* ── LiteAPI (extra matches only) ──────────────────────────── */

async function searchLiteApi(query) {
  if (!LITEAPI_KEY) return [];
  const key = fold(query);
  const cached = SEARCH_CACHE.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.results;

  try {
    const res = await fetch(
      `${LITEAPI_BASE}/data/flights/airports/iatas?q=${encodeURIComponent(
        query
      )}`,
      {
        headers: { "X-API-Key": LITEAPI_KEY },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) throw new Error(`LiteAPI responded ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];
    const results = list
      .map((a) => ({
        code: String(
          a.iata_code || a.code || a.iata || a.iataCode || ""
        ).toUpperCase(),
        name: a.name || a.airport_name || a.airportName || "",
        city: a.city || a.cityName || a.city_name || "",
        country: a.country || a.country_name || a.countryName || "",
      }))
      .filter((a) => a.code.length === 3 && a.name);

    if (SEARCH_CACHE.size >= CACHE_MAX) SEARCH_CACHE.clear();
    SEARCH_CACHE.set(key, { ts: Date.now(), results });
    return results;
  } catch (err) {
    console.error("[airports.routes] LiteAPI search failed:", err.message);
    return [];
  }
}

/* ── routes ─────────────────────────────────────────────────── */

/**
 * GET /api/airports?q=kingston
 * Returns up to 25 airports: [{ code, name, city, country }]
 */
router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "")
      .trim()
      .slice(0, 60);
    if (query.length < MIN_QUERY_LENGTH) return res.json(popular());

    let results = searchLocal(query);

    if (results.length < LITEAPI_WHEN_FEWER_THAN) {
      const seen = new Set(results.map((a) => a.code));
      const extra = (await searchLiteApi(query)).filter(
        (a) => !seen.has(a.code)
      );
      results = [...results, ...extra].slice(0, MAX_RESULTS);
    }

    return res.json(results);
  } catch (err) {
    console.error("[airports.routes] GET / error:", err);
    return res.status(500).json({ error: "Failed to load airports" });
  }
});

/**
 * GET /api/airports/health
 */
router.get("/health", async (_req, res) => {
  const liteApi = LITEAPI_KEY ? await searchLiteApi("new york") : [];
  return res.json({
    ok: true,
    route: "airports",
    env: LITEAPI_ENV,
    localCount: loadAirports().length,
    kingstonFound: searchLocal("KIN")[0]?.code === "KIN",
    liteApiReachable: liteApi.length > 0,
  });
});

export default router;
