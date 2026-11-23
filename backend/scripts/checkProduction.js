// node scripts/checkProduction.js
//
// One-minute check before (and right after) switching Skyrio to
// production. Uses the SAME env vars the server uses and makes one tiny,
// read-only call to each partner. Never books, charges or prints a key.
//
// Run it in Render → your web service → Shell, so it sees Render's
// environment:  node scripts/checkProduction.js

import "dotenv/config";

const results = [];
const ok = (name, mode, note = "") => results.push({ name, status: "OK", mode, note });
const fail = (name, mode, note) => results.push({ name, status: "FAIL", mode, note });
const skip = (name, note) => results.push({ name, status: "SKIP", mode: "-", note });

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  return { status: res.status, body };
}

// ── LiteAPI (hotels + flights) ──
async function liteapi() {
  const env = String(process.env.LITEAPI_ENV || "sandbox").toLowerCase();
  const key = env === "production" ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY;
  if (!key) return fail("LiteAPI", env, `missing ${env === "production" ? "LITEAPI_PRODUCTION_KEY" : "LITEAPI_SANDBOX_KEY"}`);
  const prefix = String(key).slice(0, 5);
  if (env === "production" && !prefix.startsWith("prod")) return fail("LiteAPI", env, "LITEAPI_ENV=production but the key isn't a prod_ key");
  const r = await getJson("https://api.liteapi.travel/v3.0/data/hotels?countryCode=US&cityName=Newark&limit=1", {
    headers: { "X-API-Key": key, Accept: "application/json" },
  });
  r.status === 200 ? ok("LiteAPI", env) : fail("LiteAPI", env, `HTTP ${r.status} ${r.body?.error?.message || ""}`);
}

// ── Viator (excursions) ──
async function viator() {
  const env = process.env.VIATOR_ENV || "sandbox";
  const key = env === "production" ? process.env.VIATOR_PRODUCTION_KEY : process.env.VIATOR_SANDBOX_KEY;
  if (!key) return fail("Viator", env, `missing ${env === "production" ? "VIATOR_PRODUCTION_KEY" : "VIATOR_SANDBOX_KEY"}`);
  const base =
    env === "production"
      ? process.env.VIATOR_PRODUCTION_BASE_URL || "https://api.viator.com/partner"
      : process.env.VIATOR_SANDBOX_BASE_URL || "https://api.sandbox.viator.com/partner";
  const r = await getJson(`${base}/products/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json;version=2.0",
      "Accept-Language": "en-US",
      "exp-api-key": key,
    },
    body: JSON.stringify({ filtering: { destination: "684" }, pagination: { start: 1, count: 1 }, currency: "USD" }),
  });
  if (r.status !== 200) return fail("Viator", env, `HTTP ${r.status} ${r.body?.message || ""}`);
  const url = r.body?.products?.[0]?.productUrl || "";
  const tracked = /[?&](pid|mcid)=/i.test(url);
  ok(
    "Viator",
    env,
    tracked
      ? "links carry your affiliate tracking"
      : process.env.VIATOR_AFFILIATE_CODE
      ? "Skyrio adds pid from VIATOR_AFFILIATE_CODE"
      : "no affiliate tracking on links (set VIATOR_AFFILIATE_CODE?)"
  );
}

// ── Ticketmaster (events) ── one key; no sandbox.
async function ticketmaster() {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return fail("Ticketmaster", "live", "missing TICKETMASTER_API_KEY");
  const r = await getJson(
    `https://app.ticketmaster.com/discovery/v2/events.json?size=1&countryCode=US&apikey=${encodeURIComponent(key)}`
  );
  r.status === 200 ? ok("Ticketmaster", "live") : fail("Ticketmaster", "live", `HTTP ${r.status}`);
}

// ── OpenWeather ── one key; no sandbox.
async function weather() {
  const key = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
  if (!key) return fail("OpenWeather", "live", "missing OPENWEATHER_API_KEY / WEATHER_API_KEY");
  const r = await getJson(
    `https://api.openweathermap.org/data/2.5/weather?lat=40.74&lon=-74.23&units=imperial&appid=${encodeURIComponent(key)}`
  );
  r.status === 200 ? ok("OpenWeather", "live") : fail("OpenWeather", "live", `HTTP ${r.status} ${r.body?.message || ""}`);
}

// ── Stripe ── mode comes from the key itself.
async function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return fail("Stripe", "-", "missing STRIPE_SECRET_KEY");
  const mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
  const r = await getJson("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
  if (r.status !== 200) return fail("Stripe", mode, `HTTP ${r.status}`);
  const notes = [];
  if (!process.env.STRIPE_WEBHOOK_SECRET) notes.push("missing STRIPE_WEBHOOK_SECRET (bookings)");
  if (!process.env.STRIPE_BILLING_WEBHOOK_SECRET) notes.push("missing STRIPE_BILLING_WEBHOOK_SECRET (memberships)");
  ok("Stripe", mode, notes.join("; "));
}

// ── Duffel ── mode comes from the token itself.
async function duffel() {
  const key = process.env.DUFFEL_ACCESS_TOKEN;
  if (!key) return skip("Duffel", "DUFFEL_ACCESS_TOKEN not set");
  const mode = key.startsWith("duffel_live_") ? "live" : "test";
  const r = await getJson("https://api.duffel.com/air/airlines?limit=1", {
    headers: { Authorization: `Bearer ${key}`, "Duffel-Version": "v2", Accept: "application/json" },
  });
  r.status === 200 ? ok("Duffel", mode) : fail("Duffel", mode, `HTTP ${r.status}`);
}

const checks = [liteapi, viator, ticketmaster, weather, stripe, duffel];
await Promise.all(
  checks.map((c) =>
    c().catch((e) => fail(c.name, "-", e?.name === "TimeoutError" ? "timed out" : e?.message || "error"))
  )
);

console.log("\nSkyrio production check\n");
for (const r of results) {
  console.log(`${r.status.padEnd(5)} ${r.name.padEnd(13)} ${String(r.mode).padEnd(11)} ${r.note}`);
}
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(failed ? `\n${failed} problem(s) above.\n` : "\nAll partners answered.\n");
process.exit(failed ? 1 : 0);
