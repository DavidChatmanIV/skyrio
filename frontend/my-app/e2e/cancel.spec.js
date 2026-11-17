// Cancel: a guest opens their booking from the email link, sees what they
// get back, has to confirm, and only then is the booking cancelled.
import { test, expect, callsTo } from "./mocks.js";

const BOOKING = {
  _id: "b123",
  type: "Hotel",
  status: "confirmed",
  provider: "liteapi",
  totalAmount: 420,
  totalCurrency: "USD",
  title: "Palm Inn",
  hotelStay: { hotelName: "Palm Inn", checkin: "2027-03-12", checkout: "2027-03-15" },
  dates: { start: "2027-03-12", end: "2027-03-15" },
  confirmationCodes: ["PALM-778"],
};

test.use({
  routes: async ({}, use) => {
    const { defaultRoutes } = await import("./mocks.js");
    use({
      ...defaultRoutes(),
      "GET /api/bookings/manage/": { ok: true, booking: BOOKING },
      "GET /api/bookings/b123/cancel-quote": {
        ok: true,
        cancellable: true,
        paid: 420,
        estimatedRefund: 420,
        estimatedFee: 0,
        currency: "USD",
        refundTo: "card",
      },
      "POST /api/bookings/b123/cancel": {
        ok: true,
        booking: { ...BOOKING, status: "cancelled", refundAmount: 420, refundStatus: "pending" },
      },
    });
  },
});

test("guest cancels from the email link only after confirming", async ({ page, calls }) => {
  await page.goto("/manage-booking/b123?t=link-token");
  await expect(page.getByText("PALM-778").first()).toBeVisible();
  // The link token is what lets a guest in.
  expect(callsTo(calls, "GET /api/bookings/manage/")[0]).toBeTruthy();

  await page.getByRole("button", { name: /^cancel booking$/i }).click();
  await expect(page.getByText("$420.00").first()).toBeVisible(); // estimated refund
  await expect(page.getByText(/not Skyrio/).first()).toBeVisible();

  await page.getByRole("button", { name: /^continue to cancel$/i }).click();
  const yes = page.getByRole("button", { name: /^yes, cancel$/i });
  await expect(yes).toBeDisabled(); // must tick "I understand" first
  expect(callsTo(calls, "POST /api/bookings/b123/cancel")).toHaveLength(0);

  await page.getByText(/I understand this cancels my stay/).click();
  await yes.click();
  await expect.poll(() => callsTo(calls, "POST /api/bookings/b123/cancel").length).toBe(1);
  await expect(page.getByText(/cancelled/i).first()).toBeVisible();
});

test("Keep my trip closes without cancelling", async ({ page, calls }) => {
  await page.goto("/manage-booking/b123?t=link-token");
  await page.getByRole("button", { name: /^cancel booking$/i }).click();
  await page.getByRole("button", { name: /^keep my trip$/i }).click();
  expect(callsTo(calls, "POST /api/bookings/b123/cancel")).toHaveLength(0);
});
