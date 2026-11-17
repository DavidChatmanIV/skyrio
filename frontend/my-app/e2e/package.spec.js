// Flight + Stay: the trip total adds up, and hotel nights follow the flight.
import { test, expect, callsTo, REDEYE, HOTEL_RATES } from "./mocks.js";

const PACKAGE =
  "/booking?kind=package&tab=Flights&from=EWR&to=SJU&toName=San%20Juan&depart=2027-01-20&return=2027-01-24&adults=4&rooms=2&auto=1";

test.use({
  routes: async ({}, use) => {
    const { defaultRoutes } = await import("./mocks.js");
    use({
      ...defaultRoutes(),
      "GET /api/flights/search": { ok: true, flights: [REDEYE] },
      "GET /api/hotels/places": { ok: true, places: [{ placeId: "p-sju", displayName: "San Juan", secondaryText: "Puerto Rico" }] },
    });
  },
});

async function addFlight(page) {
  await page.getByRole("button", { name: /^select flight$/i }).first().click();
  await page.getByRole("button", { name: /^(add to trip|added)$/i }).first().click();
}

test("a red-eye landing Jan 21 searches hotels Jan 21–24, not from the departure day", async ({ page, calls }) => {
  await page.goto(PACKAGE);
  await addFlight(page);
  await expect.poll(() => callsTo(calls, "GET /api/hotels/search").length).toBeGreaterThan(0);
  const search = callsTo(calls, "GET /api/hotels/search").at(-1);
  expect(search.query).toMatchObject({ checkin: "2027-01-21", checkout: "2027-01-24", adults: "4", rooms: "2" });
  // And it searched San Juan, not the old link's "SJU".
  expect(callsTo(calls, "GET /api/hotels/places").at(-1).query.query).toBe("San Juan");
});

test("hotel cards price every room the trip needs, plus per person", async ({ page }) => {
  await page.goto(PACKAGE);
  await addFlight(page);
  // Palm Inn: $420 for one room → 2 rooms = $840. Flight $1,600. 4 travelers.
  const palm = page.locator(".sk-pkg-trip-total", { hasText: "$840" });
  await expect(palm).toContainText("$2,440 trip total");
  await expect(palm).toContainText("$1,600 flight + $840 stay (2 rooms)");
  await expect(palm).toContainText("$610 per person");
});

test("the trip card adds Flight + Stay = Trip total and warns about missing rooms", async ({ page }) => {
  await page.goto(PACKAGE);
  await addFlight(page);
  const palmCard = page.locator(".sk-result-card", { hasText: "Palm Inn" });
  await palmCard.getByRole("button", { name: /^add to trip$/i }).click();
  await page.getByRole("button", { name: /edit search/i }).click();
  const tray = page.locator(".sk-pkg-tray:visible");
  await expect(tray).toContainText("$400 per person × 4 travelers");
  await expect(tray).toContainText("$140 per room per night × 1 room × 3 nights");
  await expect(tray).toContainText("Flight $1,600 + Stay $420");
  await expect(tray).toContainText("Trip total $2,020");
  await expect(tray).toContainText(/added 1 room\. This trip has 2/);
});
