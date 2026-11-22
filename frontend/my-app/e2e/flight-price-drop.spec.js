// "Your flight got cheaper": shown on Manage booking, checked live, opens
// normal flight checkout for the same flights, and never cancels the old
// ticket from the browser.
import { test, expect, callsTo, FLIGHT } from "./mocks.js";

const BOOKING = {
  _id: "f777",
  type: "Flight",
  status: "confirmed",
  provider: "liteapi",
  totalAmount: 420,
  totalCurrency: "USD",
  travelers: 1,
  flight: { airline: "JetBlue", origin: "EWR", destination: "MIA", departureAt: "2027-03-12T08:00:00" },
  dates: { start: "2027-03-12", end: "2027-03-15" },
  confirmationCodes: ["JB4242"],
  priceDrop: { savings: 70, currency: "USD", now: 350 },
};

test.use({
  routes: async ({}, use) => {
    const { defaultRoutes } = await import("./mocks.js");
    use({
      ...defaultRoutes(),
      "GET /api/bookings/manage/": { ok: true, booking: BOOKING },
      "GET /api/bookings/f777/price-drop": {
        ok: true, type: "Flight", savings: 70, currency: "USD", paid: 420, now: 350,
        flight: { ...FLIGHT, totalAmount: 350 },
      },
    });
  },
});

test("flight: shows the saving with the refund condition, opens checkout for the same flights", async ({ page, calls }) => {
  await page.goto("/manage-booking/f777?t=link-token");
  await expect(page.getByText("Your flight got cheaper")).toBeVisible();
  await expect(page.getByText("$70 less")).toBeVisible();
  await expect(page.getByText(/refund your ticket in full right now/)).toBeVisible();

  await page.getByRole("button", { name: /see the lower fare/i }).click();
  await expect.poll(() => callsTo(calls, "GET /api/bookings/f777/price-drop").length).toBe(1);
  await expect(page.getByText("$350")).toBeVisible();
  await expect(page.getByText(/Seats aren't carried over/)).toBeVisible();
  if (process.env.SHOT) {
    await page.locator(".pdp-drop").scrollIntoViewIfNeeded();
    await page.locator(".pdp-drop").screenshot({ path: process.env.SHOT });
  }

  await page.getByRole("button", { name: /book the lower fare/i }).click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.getByText(/JetBlue/).first()).toBeVisible();
  // The old ticket is only ever cancelled by the server, after booking.
  expect(callsTo(calls, "POST /api/bookings/f777/cancel")).toHaveLength(0);
});

test("flight: no full refund anymore → says so, offers nothing", async ({ page, routes }) => {
  routes["GET /api/bookings/f777/price-drop"] = {
    ok: false,
    message: "The airline wouldn't refund your current ticket in full now, so switching wouldn't save you money.",
  };
  await page.goto("/manage-booking/f777?t=link-token");
  await page.getByRole("button", { name: /see the lower fare/i }).click();
  await expect(page.getByText(/wouldn't refund your current ticket in full/)).toBeVisible();
  await expect(page.getByRole("button", { name: /book the lower fare/i })).toHaveCount(0);
});
