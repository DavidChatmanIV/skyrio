// ─────────────────────────────────────────────────────────────
// hotel.provider.js
// LiteAPI client setup — mirrors duffel.provider.js
//
// NOTE: LiteAPI splits traffic across two hosts:
//   - api.liteapi.travel  → search / hotel data endpoints
//   - book.liteapi.travel → prebook / book endpoints
// ─────────────────────────────────────────────────────────────

const token =
  process.env.LITEAPI_ENV === "production"
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;

const SEARCH_BASE_URL =
  process.env.LITEAPI_SEARCH_BASE_URL || "https://api.liteapi.travel/v3.0";
const BOOK_BASE_URL =
  process.env.LITEAPI_BOOK_BASE_URL || "https://book.liteapi.travel/v3.0";

if (!token) {
  const env = process.env.LITEAPI_ENV || "sandbox";
  console.warn(
    `⚠️ Missing LiteAPI key for env "${env}". Check LITEAPI_SANDBOX_KEY / LITEAPI_PRODUCTION_KEY / LITEAPI_ENV in your .env`
  );
} else {
  console.log(`[LiteAPI] Using ${process.env.LITEAPI_ENV || "sandbox"} key`);
}

async function request(baseURL, path, { method = "GET", body } = {}) {
  const res = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await res.text();

  let json;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.error(
      `[LiteAPI] Non-JSON response from ${path} (status ${res.status}):`,
      rawText
    );
    const error = new Error(
      `LiteAPI returned a non-JSON response (status ${res.status})`
    );
    error.status = res.status;
    error.details = rawText;
    throw error;
  }

  if (!res.ok) {
    const error = new Error(
      json?.error?.message || json?.message || "LiteAPI request failed"
    );
    error.status = res.status;
    error.details = json;
    throw error;
  }

  return json;
}

export const liteapi = {
  // Search-side calls (hotel lookup, rates)
  searchRequest: (path, opts) => request(SEARCH_BASE_URL, path, opts),
  // Booking-side calls (prebook, book)
  bookRequest: (path, opts) => request(BOOK_BASE_URL, path, opts),
  // GET helper for query-string based endpoints (e.g. /data/hotels)
  searchGet: (path, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    return request(SEARCH_BASE_URL, `${path}?${query}`, { method: "GET" });
  },
};
