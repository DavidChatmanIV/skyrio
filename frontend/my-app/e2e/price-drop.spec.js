// "Your stay got cheaper": shown on Manage booking, checked live, and the
// old booking is never cancelled before the traveler books the new price.
import { test, expect, callsTo } from "./mocks.js";

const BOOKING = {
  _id: "b555",
  type: "Hotel",
  status: "confirmed",
  provider: "liteapi",
  totalAmount: 600,
  totalCurrency: "USD",
  hotelStay: { rooms: [{ name: "Condado Inn", roomName: "Deluxe King", boardName: "Room only", checkin: "2027-03-12", checkout: "2027-03-15" }] },
  dates: { start: "2027-03-12", end: "2027-03-15" },
  confirmationCodes: ["CND-42"],
  priceDrop: { savings: 84, currency: "USD", freeCancelUntil: "2027-03-10T12:00:00Z" },
};
const OFFER = {
  hotelId: "h9", offerId: "drop-offer", roomName: "Deluxe King", boardName: "Room only", refundableTag: "RFN",
  roomCount: 1, rates: [{ rateId: "r9", name: "Deluxe King", occupancyNumber: 1 }],
  name: "Condado Inn", address: "1 Ashford Ave", checkin: "2027-03-12", checkout: "2027-03-15", adults: 2,
  totalAmount: 516, totalCurrency: "USD",
};

test.use({
  routes: async ({}, use) => {
    const { defaultRoutes } = await import("./mocks.js");
    use({
      ...defaultRoutes(),
      "GET /api/bookings/manage/": { ok: true, booking: BOOKING },
      "GET /api/bookings/b555/price-drop": {
        ok: true, savings: 84, currency: "USD", freeCancelUntil: "2027-03-10T12:00:00Z",
        rooms: [{ roomName: "Deluxe King", old: 600, now: 516, offer: OFFER }],
      },
    });
  },
});

test("shows the saving, checks it live, opens checkout on the same room", async ({ page, calls }) => {
  await page.goto("/manage-booking/b555?t=link-token");
  await expect(page.getByText("Your stay got cheaper")).toBeVisible();
  await expect(page.getByText("$84 less")).toBeVisible();

  await page.getByRole("button", { name: /see the lower price/i }).click();
  await expect.poll(() => callsTo(calls, "GET /api/bookings/b555/price-drop").length).toBe(1);
  await expect(page.getByText("$516")).toBeVisible();
  await expect(page.getByText(/card holds both amounts/)).toBeVisible();
  if (process.env.SHOT) {
    await page.locator(".pdp-drop").scrollIntoViewIfNeeded();
    await page.locator(".pdp-drop").screenshot({ path: process.env.SHOT });
  }

  await page.getByRole("button", { name: /book the lower price/i }).click();
  await expect(page.getByText("Confirm your stay")).toBeVisible();
  await expect(page.getByText("$516.00").first()).toBeVisible();
  // Nothing is cancelled until the new stay is booked.
  expect(callsTo(calls, "POST /api/bookings/b555/cancel")).toHaveLength(0);
});

test("gone since the email: says so, offers nothing", async ({ page, routes }) => {
  routes["GET /api/bookings/b555/price-drop"] = { ok: false, message: "The lower price isn't available anymore." };
  await page.goto("/manage-booking/b555?t=link-token");
  await page.getByRole("button", { name: /see the lower price/i }).click();
  await expect(page.getByText("The lower price isn't available anymore.")).toBeVisible();
  await expect(page.getByRole("button", { name: /book the lower price/i })).toHaveCount(0);
});
