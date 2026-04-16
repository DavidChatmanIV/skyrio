// ─────────────────────────────────────────────────────────────
// flights.utils.js
// Shared helpers for the flights API layer
// ─────────────────────────────────────────────────────────────

/**
 * City name → primary IATA airport code
 * Used so the frontend can pass plain city names (e.g. "Tokyo")
 * and the backend resolves the correct IATA code for Duffel.
 */
export const CITY_TO_IATA = {
  // ── US Northeast ──
  "new york": "JFK",
  newark: "EWR",
  boston: "BOS",
  philadelphia: "PHL",
  baltimore: "BWI",
  washington: "DCA",
  "washington dc": "DCA",

  // ── US Southeast ──
  miami: "MIA",
  orlando: "MCO",
  tampa: "TPA",
  atlanta: "ATL",
  charlotte: "CLT",
  nashville: "BNA",

  // ── US Midwest ──
  chicago: "ORD",
  minneapolis: "MSP",
  detroit: "DTW",
  cleveland: "CLE",
  columbus: "CMH",

  // ── US South / Southwest ──
  dallas: "DFW",
  houston: "IAH",
  austin: "AUS",
  "new orleans": "MSY",
  phoenix: "PHX",
  denver: "DEN",

  // ── US West ──
  "los angeles": "LAX",
  la: "LAX",
  "san francisco": "SFO",
  seattle: "SEA",
  portland: "PDX",
  "las vegas": "LAS",
  "san diego": "SAN",
  "salt lake": "SLC",
  "salt lake city": "SLC",
  honolulu: "HNL",
  hawaii: "HNL",

  // ── Caribbean / Mexico ──
  cancun: "CUN",
  "mexico city": "MEX",
  "punta cana": "PUJ",
  nassau: "NAS",

  // ── Europe ──
  london: "LHR",
  paris: "CDG",
  amsterdam: "AMS",
  barcelona: "BCN",
  madrid: "MAD",
  rome: "FCO",
  milan: "MXP",
  lisbon: "LIS",
  frankfurt: "FRA",
  munich: "MUC",
  zurich: "ZRH",
  istanbul: "IST",
  athens: "ATH",

  // ── Asia ──
  tokyo: "NRT",
  japan: "NRT",
  osaka: "KIX",
  kyoto: "KIX", // Kyoto → nearest major airport
  seoul: "ICN",
  beijing: "PEK",
  shanghai: "PVG",
  "hong kong": "HKG",
  singapore: "SIN",
  bangkok: "BKK",
  bali: "DPS",
  jakarta: "CGK",
  "kuala lumpur": "KUL",
  mumbai: "BOM",
  delhi: "DEL",

  // ── Middle East ──
  dubai: "DXB",
  doha: "DOH",
  "abu dhabi": "AUH",

  // ── Africa ──
  cairo: "CAI",
  "cape town": "CPT",
  johannesburg: "JNB",
  nairobi: "NBO",

  // ── Oceania ──
  sydney: "SYD",
  melbourne: "MEL",
  auckland: "AKL",
};

/**
 * Resolve a city name or IATA code to a confirmed IATA code.
 * - If input is already a 3-letter IATA code, return it uppercased.
 * - Otherwise look up in CITY_TO_IATA.
 * - Returns null if unresolvable.
 *
 * @param {string} input  e.g. "Tokyo", "NRT", "new york"
 * @returns {string|null}
 */
export function resolveIATA(input) {
  if (!input) return null;

  const trimmed = input.trim();

  // Already looks like an IATA code (3 uppercase letters)
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed;

  // Try uppercase version too
  if (/^[a-zA-Z]{3}$/.test(trimmed)) return trimmed.toUpperCase();

  // Look up by city name (case-insensitive)
  const key = trimmed.toLowerCase();
  return CITY_TO_IATA[key] ?? null;
}

/**
 * Default origin airport for auto-search when no origin is specified.
 * Matches the "New York → X" hero copy on the booking page.
 */
export const DEFAULT_ORIGIN_IATA = "EWR";

/**
 * Normalize a Duffel offer into the flat shape the frontend expects.
 *
 * @param {object} offer  Raw Duffel offer object
 * @param {string} from   Origin IATA (fallback)
 * @param {string} to     Destination IATA (fallback)
 * @returns {object}
 */
export function normalizeDuffelOffer(offer, from, to) {
  const outbound = offer.slices?.[0];
  const outboundSegments = outbound?.segments ?? [];
  const firstSeg = outboundSegments[0];
  const lastSeg = outboundSegments[outboundSegments.length - 1];

  return {
    id: offer.id,
    owner: offer.owner?.name ?? "Unknown airline",
    ownerCode: offer.owner?.iata_code ?? "",
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    expiresAt: offer.expires_at,

    origin: firstSeg?.origin?.iata_code ?? from,
    destination: lastSeg?.destination?.iata_code ?? to,
    departingAt: firstSeg?.departing_at ?? null,
    arrivingAt: lastSeg?.arriving_at ?? null,

    stops: Math.max(outboundSegments.length - 1, 0),
    slices: offer.slices ?? [],
    raw: offer,
  };
}

/**
 * Build Duffel slice array from search params.
 *
 * @param {string} from        Origin IATA
 * @param {string} to          Destination IATA
 * @param {string} departDate  YYYY-MM-DD
 * @param {string} [returnDate] YYYY-MM-DD (optional)
 * @returns {Array}
 */
export function buildSlices(from, to, departDate, returnDate) {
  const slices = [
    { origin: from, destination: to, departure_date: departDate },
  ];
  if (returnDate) {
    slices.push({ origin: to, destination: from, departure_date: returnDate });
  }
  return slices;
}

/**
 * Build Duffel passengers array.
 *
 * @param {number} adults
 * @returns {Array}
 */
export function buildPassengers(adults = 1) {
  return Array.from({ length: Number(adults) }, () => ({ type: "adult" }));
}