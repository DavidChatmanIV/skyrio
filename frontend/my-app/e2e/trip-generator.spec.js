// "Can't decide?": a real Skyrio fare replaces the estimate when it's for
// the same place and dates; test (sandbox) fares never do.
import { test, expect, callsTo } from "./mocks.js";

const SUGGESTION = {
  kind: "trip",
  trip: "Miami",
  destCode: "MIA",
  depart: "2027-03-12",
  return: "2027-03-14",
  total: 900,
  fit: "Beach weekend",
  summary: "Sun, beaches and Cuban food.",
};
const FARE = {
  destination: "MIA",
  city: "Miami",
  tripType: "weekend",
  fromCode: "EWR",
  from: [40.692, -74.174],
  lat: 25.795,
  lng: -80.287,
  price: 191,
  airline: "JetBlue",
  stops: 0,
  departDate: "2027-03-12",
  returnDate: "2027-03-14",
  foundAt: new Date().toISOString(),
  lowerThanUsual: true,
  usual: { low: 230, high: 310, days: 21 },
  hotel: { name: "Palm Inn", price: 300, payAtHotel: 40 },
  tripTotal: 531,
};

async function makeTrip(page) {
  await page.goto("/");
  const from = page.getByPlaceholder("Flying from?");
  await from.fill("Newark");
  await page.locator(".sk-airport-option", { hasText: "EWR" }).first().dispatchEvent("mousedown");
  await page.getByRole("button", { name: /make me a trip/i }).click();
}

test("a real fare for the same place and dates shows instead of the estimate", async ({ page, routes, calls }) => {
  routes["GET /api/deals/fares"] = { origin: "EWR", preview: false, fares: [FARE] };
  routes["POST /api/atlas/suggest"] = { suggestions: [SUGGESTION] };
  await makeTrip(page);
  await expect(page.getByText("Real Skyrio price")).toBeVisible();
  await expect(page.getByText("Lower than usual on Skyrio")).toBeVisible();
  await expect(page.getByText("$191 round trip")).toBeVisible();
  await expect(page.getByText("flight + hotel for you")).toBeVisible();
  await expect(page.getByText("$531")).toBeVisible();
  await expect(page.getByText(/Includes \$40 in fees paid at the hotel/)).toBeVisible();
  await expect(page.getByText("est. for you")).toHaveCount(0);
  // Atlas was told which places have real fares, with their exact dates.
  const sent = callsTo(calls, "POST /api/atlas/suggest")[0].body;
  expect(sent.realFares[0]).toMatchObject({ destCode: "MIA", depart: "2027-03-12", return: "2027-03-14", price: 191 });
  if (process.env.SHOT) await page.locator(".tg-card").screenshot({ path: process.env.SHOT });
});

test("test (sandbox) fares never show as real: the estimate stays labeled", async ({ page, routes, calls }) => {
  routes["GET /api/deals/fares"] = { origin: "EWR", preview: true, fares: [FARE] };
  routes["POST /api/atlas/suggest"] = { suggestions: [SUGGESTION] };
  await makeTrip(page);
  await expect(page.getByText("est. for you")).toBeVisible();
  await expect(page.getByText("Real Skyrio price")).toHaveCount(0);
  expect(callsTo(calls, "POST /api/atlas/suggest")[0].body.realFares).toBeUndefined();
});

test("preview link: test fares show, clearly labeled as test prices", async ({ page, routes }) => {
  routes["GET /api/deals/fares"] = { origin: "EWR", preview: true, fares: [FARE] };
  routes["POST /api/atlas/suggest"] = { suggestions: [SUGGESTION] };
  await page.goto("/?farePreview=1");
  const from = page.getByPlaceholder("Flying from?");
  await from.fill("Newark");
  await page.locator(".sk-airport-option", { hasText: "EWR" }).first().dispatchEvent("mousedown");
  await page.getByRole("button", { name: /make me a trip/i }).click();
  await expect(page.getByText("Test price (preview, not real)")).toBeVisible();
  await expect(page.getByText("Real Skyrio price")).toHaveCount(0);
  await expect(page.getByText(/These aren't real prices/)).toBeVisible();
  if (process.env.SHOT) await page.locator(".tg-real").screenshot({ path: process.env.SHOT });
});
