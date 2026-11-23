// Stays: search → prices for the whole stay → checkout shows the same total.
import { test, expect, callsTo } from "./mocks.js";

const SEARCH = "/booking?tab=Stays&city=Miami&depart=2027-03-12&return=2027-03-15&adults=2&rooms=1&auto=1";

test("searches the right dates and guests, cheapest first, with price per night", async ({ page, calls }) => {
  await page.goto(SEARCH);
  await expect(page.getByText(/2 Room Options Found/i)).toBeVisible();
  const search = callsTo(calls, "GET /api/hotels/search")[0];
  expect(search.query).toMatchObject({ checkin: "2027-03-12", checkout: "2027-03-15", adults: "2", rooms: "1" });

  const names = await page.locator(".sk-result-card .sk-resultTitle").allInnerTexts();
  expect(names.slice(0, 2)).toEqual(["Palm Inn", "Bayfront Hotel"]); // $420 before $630
  // $420 for 3 nights = $140 a night.
  await expect(page.getByText("$140/night · 3 nights total")).toBeVisible();
  await expect(page.getByText("$210/night · 3 nights total")).toBeVisible();
});

test("Book this room opens checkout with the same dates, nights and total", async ({ page, calls }) => {
  await page.goto(SEARCH);
  await page.getByRole("button", { name: /book this room/i }).first().click();
  await expect(page.getByText("Confirm your stay")).toBeVisible();
  await expect(page.getByText(/Fri, Mar 12 → Mon, Mar 15 · 3 nights/)).toBeVisible();
  await expect(page.getByText("$420.00").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay \$420\.00 · Book 1 room/ })).toBeVisible();
  // The room is checked with the hotel before anyone pays.
  await expect.poll(() => callsTo(calls, "POST /api/hotels/availability").length).toBeGreaterThan(0);
  expect(JSON.stringify(callsTo(calls, "POST /api/hotels/availability")[0].body)).toContain("hoffer-2");
  // Hotel rules belong to the hotel, said plainly.
  await expect(page.getByText(/Set by Palm Inn, not Skyrio/)).toBeVisible();
});

test("a failed hotel search says so instead of showing an empty page", async ({ page, routes }) => {
  routes["GET /api/hotels/search"] = { __status: 502, body: { ok: false, message: "Hotel search failed" } };
  await page.goto(SEARCH);
  await expect(page.getByText(/hotel search failed/i).first()).toBeVisible();
});

test("a dorm bed says it's a shared room; private rooms stay as they are", async ({ page, routes }) => {
  const { HOTEL_RATES } = await import("./mocks.js");
  routes["GET /api/hotels/search"] = {
    ok: true,
    hotels: [
      { ...HOTEL_RATES[0], roomKind: "private", roomType: "Private room" },
      { ...HOTEL_RATES[1], roomName: "Bed in 6-Bed Female Dormitory", roomKind: "female_dorm", roomType: "Female-only dorm (shared room)" },
    ],
  };
  await page.goto(SEARCH);
  await expect(page.getByText("Female-only dorm (shared room)")).toBeVisible();
  await expect(page.locator(".sk-roomKind")).toHaveCount(1);
  if (process.env.SHOT) await page.locator(".sk-result-card").first().screenshot({ path: process.env.SHOT });
});
