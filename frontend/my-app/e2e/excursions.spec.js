// Excursions: a country name finds tours, trying the next match if the
// best one has none.
import { test, expect, callsTo } from "./mocks.js";

test("Iceland: if the first place has no tours, the next one is tried", async ({ page, routes, calls }) => {
  routes["GET /api/excursions/destinations"] = {
    ok: true,
    destinations: [
      { destinationId: 3, name: "Iceland", type: "COUNTRY" },
      { destinationId: 1, name: "South Iceland", type: "REGION" },
    ],
  };
  routes["GET /api/excursions/search"] = ({ url }) =>
    new URL(url).searchParams.get("destinationId") === "3"
      ? { ok: true, excursions: [] }
      : {
          ok: true,
          excursions: [
            { id: "x1", title: "Golden Circle Day Tour", price: 89, currency: "USD", rating: 4.8, reviewCount: 1200, bookingUrl: "https://www.viator.com/tours/x1" },
          ],
        };
  await page.goto("/booking?tab=Excursions");
  await page.getByPlaceholder("Destination city").fill("Iceland");
  await page.getByRole("button", { name: /search things to do/i }).click();
  await expect(page.getByText("Golden Circle Day Tour")).toBeVisible();
  const ids = callsTo(calls, "GET /api/excursions/search").map((c) => c.query.destinationId);
  expect(ids).toEqual(["3", "1"]);
});
