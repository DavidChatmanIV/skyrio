// backend/services/liteapiClient.js
// LiteAPI (Nuitee) hotel search + booking client
// Mirrors the raw-fetch pattern used for duffelClient.js — no SDK dependency

const LITEAPI_BASE_URL =
  process.env.LITEAPI_BASE_URL || "https://api.liteapi.travel/v3";

// Toggle between sandbox and production via env var.
// Set LITEAPI_ENV=production once you have an approved production key.
function getApiKey() {
  const env = process.env.LITEAPI_ENV || "sandbox";
  const key =
    env === "production"
      ? process.env.LITEAPI_PRODUCTION_KEY
      : process.env.LITEAPI_SANDBOX_KEY;

  if (!key) {
    throw new Error(
      `Missing LiteAPI key for env "${env}". Check your .env file.`
    );
  }
  return key;
}

// Shared request helper — every LiteAPI call goes through here
async function liteapiRequest(path, { method = "GET", body } = {}) {
  const apiKey = getApiKey();

  const res = await fetch(`${LITEAPI_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.error?.message || data?.message || "LiteAPI request failed";
    const error = new Error(message);
    error.status = res.status;
    error.details = data;
    throw error;
  }

  return data;
}

/**
 * Search hotel availability
 * @param {Object} params
 * @param {string} params.destination - City name or destination ID
 * @param {string} params.checkin - YYYY-MM-DD
 * @param {string} params.checkout - YYYY-MM-DD
 * @param {number} params.adults - Number of adults
 * @param {number} [params.rooms=1] - Number of rooms
 */
export async function searchHotelRates({
  destination,
  checkin,
  checkout,
  adults,
  rooms = 1,
}) {
  return liteapiRequest("/hotels/rates", {
    method: "POST",
    body: {
      destination,
      checkin,
      checkout,
      occupancies: [{ adults, rooms }],
    },
  });
}

/**
 * Prebook a specific rate — locks in price/availability before final booking
 * @param {string} rateId - Rate ID returned from searchHotelRates
 */
export async function prebookRate(rateId) {
  return liteapiRequest("/rates/prebook", {
    method: "POST",
    body: { rateId },
  });
}

/**
 * Confirm and finalize a booking after a successful prebook
 * @param {Object} params
 * @param {string} params.prebookId - ID returned from prebookRate
 * @param {Object} params.guest - { firstName, lastName, email, phone }
 * @param {Object} [params.payment] - Payment details (sandbox may accept a test token)
 */
export async function confirmBooking({ prebookId, guest, payment }) {
  return liteapiRequest("/rates/book", {
    method: "POST",
    body: {
      prebookId,
      guestInfo: guest,
      payment,
    },
  });
}

export default {
  searchHotelRates,
  prebookRate,
  confirmBooking,
};
