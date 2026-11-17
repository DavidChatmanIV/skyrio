// Atlas "Review & pay": the link opens the normal checkout on what Atlas
// showed, with the same price.
import { test, expect, FLIGHT, HOTEL_RATES } from "./mocks.js";

const hotelOffer = (extra = {}) => ({
  ...HOTEL_RATES[1],
  name: "Palm Inn",
  address: "2 Palm Ave",
  checkin: "2027-03-12",
  checkout: "2027-03-15",
  adults: 2,
  ...extra,
});

test("a hotel from Atlas opens hotel checkout with its dates and total", async ({ page, routes }) => {
  routes["GET /api/atlas/handoffs/"] = { ok: true, kind: "hotel", offerId: "hoffer-2", offer: hotelOffer() };
  await page.goto("/checkout/atlas/h-abc123");
  await expect(page.getByText("Confirm your stay")).toBeVisible();
  await expect(page.getByText(/3 nights/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay \$420\.00 · Book 1 room/ })).toBeVisible();
});

test("a 1-room price on a 2-room trip books the room twice", async ({ page, routes }) => {
  routes["GET /api/atlas/handoffs/"] = { ok: true, kind: "hotel", offerId: "hoffer-2", offer: hotelOffer({ bookCopies: 2 }) };
  await page.goto("/checkout/atlas/h-two");
  await expect(page.getByRole("button", { name: /Pay \$840\.00 · Book 2 rooms/ })).toBeVisible();
});

test("a flight from Atlas opens flight checkout on that fare", async ({ page, routes }) => {
  routes["GET /api/atlas/handoffs/"] = {
    ok: true,
    kind: "flight",
    offerId: FLIGHT.offerId,
    offer: { ...FLIGHT, pricedFor: { adults: 1, children: 0 } },
  };
  await page.goto("/checkout/atlas/f-abc123");
  await expect(page.getByText("Passenger details")).toBeVisible();
  await expect(page.getByText(/Fri, Mar 12 · 8:00 AM/).first()).toBeVisible();
});

test("an expired Atlas link says so and offers to ask Atlas again", async ({ page, routes }) => {
  routes["GET /api/atlas/handoffs/"] = { __status: 410, body: { ok: false, error: "expired" } };
  await page.goto("/checkout/atlas/old-link");
  await expect(page.getByText(/This price expired/)).toBeVisible();
});
