import axios from "axios";

const env = process.env.LITEAPI_ENV || "sandbox";

const apiKey =
  env === "production"
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;

if (!apiKey) {
  // Loud on purpose — every downstream call will fail with a 401 from
  // LiteAPI otherwise, which is a much more confusing place to debug.
  throw new Error(
    `[LiteAPI Flights] Missing API key for env "${env}". Set LITEAPI_${env.toUpperCase()}_KEY in your environment.`
  );
}

console.log(`[LiteAPI Flights] Using ${env} key (${apiKey.slice(0, 6)}...)`);

const BASE_URL = "https://api.liteapi.travel/v3.0";

export const LITEAPI_FLIGHTS_HEADERS = {
  "X-API-Key": apiKey,
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const LITEAPI_FLIGHTS_BASE_URL = BASE_URL;

export const liteApiFlights = axios.create({
  baseURL: BASE_URL,
  headers: LITEAPI_FLIGHTS_HEADERS,
  timeout: 20000,
});

// Surface LiteAPI's actual error body in logs instead of just "Request
// failed with status code 4xx" — this is the #1 thing that saves debugging
// time when a payload field is wrong.
liteApiFlights.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response) {
      console.error(
        `[LiteAPI Flights] ${err.config?.method?.toUpperCase()} ${
          err.config?.url
        } -> ${err.response.status}`,
        JSON.stringify(err.response.data)
      );
    } else {
      console.error(
        "[LiteAPI Flights] request failed with no response:",
        err.message
      );
    }
    return Promise.reject(err);
  }
);
