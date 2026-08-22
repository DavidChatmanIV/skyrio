// ─────────────────────────────────────────────────────────────
// viator.provider.js
// Viator Affiliate/Partner API client — mirrors hotel.provider.js
//
// Auth header, base URLs, and version header confirmed working
// against sandbox. VIATOR_ENV now drives both the key and the
// base URL together, so they can't drift out of sync.
//
// NOTE: Per Viator's Affiliate API license terms, this provider
// fetches ON DEMAND only — it must NOT persist/cache Viator's
// unique content (descriptions, images, listings) into Skyrio's
// own database. Live fetch every request, same as we do NOT
// seed excursions the way seed-hotel.js seeds hotel data.
// ─────────────────────────────────────────────────────────────

const VIATOR_ENV = process.env.VIATOR_ENV || "sandbox";

const apiKey =
  VIATOR_ENV === "production"
    ? process.env.VIATOR_PRODUCTION_KEY
    : process.env.VIATOR_SANDBOX_KEY;

const BASE_URL =
  VIATOR_ENV === "production"
    ? process.env.VIATOR_PRODUCTION_BASE_URL || "https://api.viator.com/partner"
    : process.env.VIATOR_SANDBOX_BASE_URL ||
      "https://api.sandbox.viator.com/partner";

if (!apiKey) {
  console.warn(
    `⚠️ Missing Viator API key for env "${VIATOR_ENV}". Check VIATOR_SANDBOX_KEY / VIATOR_PRODUCTION_KEY / VIATOR_ENV in your .env`
  );
}

async function request(path, { method = "GET", body, params } = {}) {
  let url = `${BASE_URL}${path}`;

  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (query) url += `?${query}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json;version=2.0",
      "Accept-Language": "en-US",
      "exp-api-key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await res.text();

  let json;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.error(
      `[Viator] Non-JSON response from ${path} (status ${res.status}):`,
      rawText
    );
    const error = new Error(
      `Viator returned a non-JSON response (status ${res.status})`
    );
    error.status = res.status;
    error.details = rawText;
    throw error;
  }

  if (!res.ok) {
    const error = new Error(
      json?.message || json?.error?.message || "Viator request failed"
    );
    error.status = res.status;
    error.details = json;
    throw error;
  }

  return json;
}

export const viator = {
  get: (path, params) => request(path, { method: "GET", params }),
  post: (path, body) => request(path, { method: "POST", body }),
};
