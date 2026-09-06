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
  // Bumped from 20000 — live round-trip searches returning 150-190+
  // journeys have been observed legitimately taking 9-15s even on a
  // clean success (see server logs). A 20s ceiling left almost no
  // headroom before a normal slow response tipped into a spurious
  // timeout, which is exactly what happened: the same search that
  // succeeded moments earlier at ~15s failed twice in a row at
  // "20052ms" / "20039ms" — right at the old ceiling, not a real
  // outage. 35s gives real breathing room without masking a genuinely
  // hung request for an unreasonable amount of time.
  timeout: 35000,
});

// Surface LiteAPI's actual error body in logs instead of just "Request
// failed with status code 4xx" — this is the #1 thing that saves debugging
// time when a payload field is wrong.
liteApiFlights.interceptors.response.use(
  (res) => res,
  (err) => {
    const config = err.config;
    // Timeout errors only (axios sets code "ECONNABORTED" for these,
    // and/or the message contains "timeout") — NOT real 4xx/5xx
    // responses, which should keep failing immediately so a bad
    // payload or auth issue surfaces right away instead of being
    // retried and masked. One retry only: a single slow sandbox
    // response is worth one more attempt; a request that times out
    // twice in a row is more likely a genuine outage, and retrying
    // indefinitely would just make a real outage take even longer to
    // surface as a user-visible error.
    const isTimeout =
      err.code === "ECONNABORTED" || /timeout/i.test(err.message || "");
    const alreadyRetried = config?._retryCount >= 1;

    if (isTimeout && config && !alreadyRetried) {
      config._retryCount = (config._retryCount || 0) + 1;
      console.warn(
        `[LiteAPI Flights] timeout on ${config.method?.toUpperCase()} ${
          config.url
        } — retrying once (attempt ${config._retryCount})`
      );
      return liteApiFlights(config);
    }

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
