// backend/services/liteapiBookings.js
// LiteAPI calls for managing EXISTING bookings: look up, quote, cancel.
// Uses the same key selection as the rest of the backend (LITEAPI_ENV).

const HOTEL_BASE = "https://book.liteapi.travel/v3.0";
const FLIGHTS_BASE =
  process.env.LITEAPI_FLIGHTS_BASE || "https://api.liteapi.travel/v3.0";

function liteApiKey() {
  const env = String(process.env.LITEAPI_ENV || "sandbox").toLowerCase();
  return (
    (env === "production"
      ? process.env.LITEAPI_PRODUCTION_KEY
      : process.env.LITEAPI_SANDBOX_KEY) || process.env.LITEAPI_KEY
  );
}

async function call(base, method, path, body) {
  const key = liteApiKey();
  if (!key)
    throw new Error(
      "LiteAPI key is not set (check LITEAPI_ENV / LITEAPI_SANDBOX_KEY)"
    );
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "X-API-Key": key,
      accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const err = new Error(
      json?.error?.message ||
        json?.error?.description ||
        json?.message ||
        `LiteAPI ${method} ${path} failed (${res.status})`
    );
    err.status = res.status;
    err.lite = json;
    throw err;
  }
  const data = Array.isArray(json?.data) ? json.data[0] : json?.data ?? json;
  return { httpStatus: res.status, data, raw: json };
}

// ── Hotels ──
export const hotelGetBooking = (bookingId) =>
  call(HOTEL_BASE, "GET", `/bookings/${encodeURIComponent(bookingId)}`);
export const hotelCancel = (bookingId) =>
  call(HOTEL_BASE, "PUT", `/bookings/${encodeURIComponent(bookingId)}`);

// ── Flights ──
export const flightGetBooking = (bookingId) =>
  call(
    FLIGHTS_BASE,
    "GET",
    `/flights/bookings/${encodeURIComponent(bookingId)}`
  );
export const flightCancelQuote = (bookingId) =>
  call(
    FLIGHTS_BASE,
    "GET",
    `/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`
  );
export const flightCancel = (bookingId) =>
  call(
    FLIGHTS_BASE,
    "POST",
    `/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`
  );

// First numeric value found under any of these keys (LiteAPI shapes vary).
export function pickAmount(obj, keys, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && typeof v !== "object" && Number.isFinite(Number(v)))
      return Number(v);
    if (v && typeof v === "object" && Number.isFinite(Number(v.amount)))
      return Number(v.amount);
  }
  for (const v of Object.values(obj)) {
    const found = pickAmount(v, keys, depth + 1);
    if (found != null) return found;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Reading IDs out of LiteAPI's flight booking response.
// The response nests these differently than the top level, so search
// the whole object (bounded depth) for the first matching key.
// ─────────────────────────────────────────────────────────────
function deepFind(obj, keys, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  for (const k of keys) {
    const v = obj[k];
    if (
      v != null &&
      v !== "" &&
      (typeof v === "string" || typeof v === "number")
    )
      return String(v);
  }
  for (const v of Object.values(obj)) {
    const found = deepFind(v, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

/** LiteAPI's booking ID for a completed flight booking (needed to cancel). */
export function extractFlightBookingId(record) {
  return deepFind(record, ["bookingId", "booking_id", "flightBookingId"]);
}

/** The airline's own confirmation code (PNR), if LiteAPI returned one. */
export function extractFlightPnr(record) {
  return deepFind(record, [
    "pnr",
    "PNR",
    "bookingRef",
    "bookingReference",
    "recordLocator",
    "airlineReference",
    "airlineConfirmationCode",
  ]);
}
