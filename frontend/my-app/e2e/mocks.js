// Shared test data and a fake API. Every /api request is answered here, so
// tests never touch LiteAPI, Duffel, Stripe or the database. Each test
// gets a `calls` list to check what the site sent.
import { test as base, expect } from "@playwright/test";

const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString();

// A round trip EWR ⇄ MIA for one adult (LiteAPI's flat shape).
export const FLIGHT = {
  id: "f1",
  offerId: "offer-1",
  provider: "liteapi",
  owner: "JetBlue",
  ownerCode: "B6",
  origin: "EWR",
  destination: "MIA",
  totalAmount: 412.5,
  totalCurrency: "USD",
  departingAt: "2027-03-12T08:00:00",
  arrivingAt: "2027-03-12T11:05:00",
  returningAt: "2027-03-15T17:00:00",
  returnArrivingAt: "2027-03-15T20:05:00",
  stops: 0,
  fareExpiresAt: inHours(1),
  slices: [
    {
      origin: "EWR",
      destination: "MIA",
      departureTime: "2027-03-12T08:00:00",
      arrivalTime: "2027-03-12T11:05:00",
      stops: 0,
      segments: [
        {
          origin: "EWR",
          destination: "MIA",
          departureTime: "2027-03-12T08:00:00",
          arrivalTime: "2027-03-12T11:05:00",
          carrier: "JetBlue",
          flightNumber: "B6 1",
        },
      ],
    },
    {
      origin: "MIA",
      destination: "EWR",
      departureTime: "2027-03-15T17:00:00",
      arrivalTime: "2027-03-15T20:05:00",
      stops: 0,
      segments: [
        {
          origin: "MIA",
          destination: "EWR",
          departureTime: "2027-03-15T17:00:00",
          arrivalTime: "2027-03-15T20:05:00",
          carrier: "JetBlue",
          flightNumber: "B6 2",
        },
      ],
    },
  ],
};

// A red-eye EWR → SJU that lands the next morning, for 4 travelers.
export const REDEYE = {
  ...FLIGHT,
  id: "f2",
  offerId: "offer-2",
  destination: "SJU",
  totalAmount: 1600,
  departingAt: "2027-01-20T21:00:00",
  arrivingAt: "2027-01-21T07:30:00",
  returningAt: "2027-01-24T16:00:00",
  returnArrivingAt: "2027-01-24T19:30:00",
  slices: [
    {
      origin: "EWR",
      destination: "SJU",
      departureTime: "2027-01-20T21:00:00",
      arrivalTime: "2027-01-21T07:30:00",
      stops: 0,
      segments: [
        {
          origin: "EWR",
          destination: "SJU",
          departureTime: "2027-01-20T21:00:00",
          arrivalTime: "2027-01-21T07:30:00",
          carrier: "JetBlue",
          flightNumber: "B6 3",
        },
      ],
    },
    {
      origin: "SJU",
      destination: "EWR",
      departureTime: "2027-01-24T16:00:00",
      arrivalTime: "2027-01-24T19:30:00",
      stops: 0,
      segments: [
        {
          origin: "SJU",
          destination: "EWR",
          departureTime: "2027-01-24T16:00:00",
          arrivalTime: "2027-01-24T19:30:00",
          carrier: "JetBlue",
          flightNumber: "B6 4",
        },
      ],
    },
  ],
};

// Hotel lookup (names) + rates (prices), as the Stays tab asks for them.
export const HOTELS = [
  { id: "h1", name: "Bayfront Hotel", stars: 4, address: "1 Bay St" },
  { id: "h2", name: "Palm Inn", stars: 3, address: "2 Palm Ave" },
];
export const HOTEL_RATES = [
  {
    hotelId: "h1",
    offerId: "hoffer-1",
    roomTypeId: "rt1",
    roomName: "King Room",
    boardName: "Room only",
    refundableTag: "RFN",
    roomCount: 1,
    rates: [{ rateId: "r1", name: "King Room", occupancyNumber: 1 }],
    totalAmount: 630,
    totalCurrency: "USD",
  },
  {
    hotelId: "h2",
    offerId: "hoffer-2",
    roomTypeId: "rt2",
    roomName: "Queen Room",
    boardName: "Breakfast",
    refundableTag: "NRFN",
    roomCount: 1,
    rates: [{ rateId: "r2", name: "Queen Room", occupancyNumber: 1 }],
    totalAmount: 420,
    totalCurrency: "USD",
  },
];

/** Default answers, by "METHOD /api/path" prefix. Tests can override. */
export function defaultRoutes() {
  return {
    "GET /api/stripe-config": { ok: true, publishableKey: "pk_test_e2e" },
    "GET /api/site-status": { ok: true, paused: {} },
    "GET /api/airports": { ok: true, airports: [] },
    "GET /api/flights/search": { ok: true, flights: [FLIGHT] },
    "POST /api/flights/verify": { ok: true, offerId: FLIGHT.offerId, expiresAt: inHours(1) },
    "POST /api/flights/prebook": {
      ok: true,
      data: { prebookId: "pb-1", transactionId: "tx-1", secretKey: "secret-1", price: { total: 412.5 } },
      checkoutToken: "ct-1",
      expiresAt: inHours(1),
    },
    "GET /api/flights/prebook/": { ok: true, data: { prebookId: "pb-1", servicesAttachable: { groups: [] } } },
    "GET /api/hotels/places": {
      ok: true,
      places: [{ placeId: "p-mia", displayName: "Miami", secondaryText: "Florida, United States" }],
    },
    "GET /api/hotels/lookup": { ok: true, hotels: HOTELS },
    "GET /api/hotels/search": { ok: true, hotels: HOTEL_RATES },
  };
}

/**
 * The page with: no cookie banner or tour, and every /api call answered by
 * `routes` (exact "METHOD /api/path", else the longest matching prefix;
 * a function gets { url, body, method }). Unknown calls get {} (200).
 */
export const test = base.extend({
  routes: [async ({}, use) => use(defaultRoutes()), { option: true }],
  calls: async ({}, use) => use([]),
  page: async ({ page, routes, calls }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("cookieConsent", "accepted");
        localStorage.setItem("skyrio_tour_done", "1");
      } catch {
        /* fine */
      }
    });
    // Nothing leaves the test machine: outside scripts (Stripe, maps,
    // analytics) are blocked, so tests run the same everywhere.
    await page.route(
      (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => route.abort()
    );
    const errors = [];
    page.on("pageerror", (e) => {
      // Expected with outside scripts blocked.
      if (/Failed to load Stripe\.js|google is not defined/i.test(e.message)) return;
      errors.push(e.message);
    });
    await page.route(/\/api\//, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;
      let body = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
      calls.push({ method: req.method(), path, query: Object.fromEntries(url.searchParams), body });
      const key = `${req.method()} ${path}`;
      const match =
        routes[key] ??
        Object.entries(routes)
          .filter(([k]) => key.startsWith(k))
          .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
      const answer = typeof match === "function" ? await match({ url, body, method: req.method() }) : match;
      if (answer && answer.__status) {
        return route.fulfill({ status: answer.__status, json: answer.body || {} });
      }
      return route.fulfill({ json: answer ?? {} });
    });
    await use(page);
    expect(errors, "no page errors").toEqual([]);
  },
});
export { expect };

/** Calls to one endpoint ("POST /api/flights/prebook"). */
export const callsTo = (calls, key) => calls.filter((c) => `${c.method} ${c.path}`.startsWith(key));
