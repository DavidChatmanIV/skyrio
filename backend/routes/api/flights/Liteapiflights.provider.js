import axios from "axios";

const env = process.env.LITEAPI_ENV || "sandbox";

const apiKey =
  env === "production"
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;

if (!apiKey) {
  console.warn(`⚠️ Missing LiteAPI key for env "${env}"`);
}

console.log(`[LiteAPI Flights] Using ${env} key`);

// Same key/account as hotels — Flights Production access was enabled
// on this account (confirmed via LiteAPI support). Follows the same
// LITEAPI_ENV sandbox/production switch as the hotels provider.
const BASE_URL = "https://api.liteapi.travel/v3.0";

export const liteApiFlights = axios.create({
  baseURL: BASE_URL,
  headers: {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});
