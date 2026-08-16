// ─────────────────────────────────────────────────────────────
// viator.provider.js
// Viator Affiliate/Partner API client — mirrors hotel.provider.js
//
// ⚠️ UNVERIFIED AGAINST LIVE DOCS — base URL, auth header name,
// and endpoint paths below are Viator's PUBLICLY DOCUMENTED
// conventions as of last training data, but were NOT confirmed
// against your actual partners.viator.com/developer-api-docs
// session. Before running this against sandbox, verify:
//   1. Auth header name (commonly "exp-api-key")
//   2. Sandbox base URL (commonly https://api.sandbox.viator.com/partner)
//   3. Required "Accept-Language" and "Accept" headers
//      (Viator's API is versioned via Accept, e.g.
//      "application/json;version=2.0")
// Search each TODO below and confirm against the docs, then
// delete this warning block.
//
// NOTE: Per Viator's Affiliate API license terms, this provider
// fetches ON DEMAND only — it must NOT persist/cache Viator's
// unique content (descriptions, images, listings) into Skyrio's
// own database. Live fetch every request, same as we do NOT
// seed excursions the way seed-hotel.js seeds hotel data.
// ─────────────────────────────────────────────────────────────

const apiKey =
  process.env.VIATOR_SANDBOX_KEY || process.env.VIATOR_PRODUCTION_KEY;

const BASE_URL =
  process.env.VIATOR_ENV === "production"
    ? process.env.VIATOR_PRODUCTION_BASE_URL || "https://api.viator.com/partner"
    : process.env.VIATOR_SANDBOX_BASE_URL ||
      "https://api.sandbox.viator.com/partner"; // TODO: confirm exact sandbox host

if (!apiKey) {
  const env = process.env.VIATOR_ENV || "sandbox";
  console.warn(
    `⚠️ Missing Viator API key for env "${env}". Check VIATOR_SANDBOX_KEY / VIATOR_PRODUCTION_KEY / VIATOR_ENV in your .env`
  );
} else {
  console.log(`[Viator] Using ${process.env.VIATOR_ENV || "sandbox"} key`);
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
      Accept: "application/json;version=2.0", // TODO: confirm Viator's required version header
      "Accept-Language": "en-US",
      "exp-api-key": apiKey, // TODO: confirm this is the correct header name
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
  // GET/POST helper for search & product endpoints
  get: (path, params) => request(path, { method: "GET", params }),
  post: (path, body) => request(path, { method: "POST", body }),
};
