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
  // Default ceiling for the quick calls (verify, prebook details,
  // attach, etc.). Flight SEARCH overrides this per request (see
  // searchFlights in the controller): live round-trip searches
  // returning 150-190+ journeys have been measured at ~50s even on a
  // clean 200, so 35s was cutting off searches that would have
  // succeeded.
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
    // responses, which should keep failing immediately.
    //
    // A request can opt out of the retry with `_noRetry: true` in its
    // axios config. Two cases use that:
    //   - search: a timed-out search that retries just doubles the
    //     wait for the user (2 x the timeout) on a slow upstream.
    //   - prebook / bookings: a request that times out on OUR side may
    //     have actually reached LiteAPI. Retrying it could create a
    //     second reservation or booking.
    const isTimeout =
      err.code === "ECONNABORTED" || /timeout/i.test(err.message || "");
    const alreadyRetried = config?._retryCount >= 1;

    if (isTimeout && config && !alreadyRetried && !config._noRetry) {
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
