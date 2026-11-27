// Duffel fares get the Seats step too (it used to be skipped), and the
// seat's price is added to the total before paying.
import { test, expect, callsTo, FLIGHT } from "./mocks.js";

const SEARCH =
  "/booking?tab=Flights&from=EWR&to=MIA&toName=Miami&depart=2027-03-12&return=2027-03-15&adults=1&auto=1";
const DUFFEL = { ...FLIGHT, id: "off_1", offerId: "off_1", provider: "duffel" };
const seatsFor = (seg) =>
  [10, 11, 12, 13].flatMap((row) =>
    ["A", "B", "C", "D", "E", "F"].map((col) => ({
      seatNumber: `${row}${col}`,
      serviceId: `${seg}|${row}${col}`,
      available: !(row === 11 && col === "C"),
      price: row === 10 ? 25 : 0,
      tier: row === 10 ? "paid" : row === 12 ? "exit-row" : "standard",
      segmentKey: seg,
    }))
  );

test.use({
  routes: async ({}, use) => {
    const { defaultRoutes } = await import("./mocks.js");
    use({
      ...defaultRoutes(),
      "GET /api/flights/search": { ok: true, flights: [DUFFEL] },
      "POST /api/flights/verify": { ok: true, offerId: "off_1", expiresAt: new Date(Date.now() + 3600e3).toISOString() },
      "POST /api/flights/duffel/intent": {
        ok: true, checkoutId: "pi_1", clientSecret: "pi_1_secret_x", total: 412.5, currency: "USD",
        expiresAt: new Date(Date.now() + 3600e3).toISOString(), checkoutToken: "ct-1",
      },
      "GET /api/flights/duffel/seats/pi_1": { ok: true, seats: [...seatsFor("seg_out"), ...seatsFor("seg_back")], bags: [] },
      "POST /api/flights/duffel/seats/pi_1": { ok: true, seatsTotal: 25, total: 437.5 },
    });
  },
});

test("Duffel fare: pick a seat, and the total includes it", async ({ page, calls }) => {
  await page.goto(SEARCH);
  await page.getByRole("button", { name: /^select flight$/i }).first().click();
  await page.getByRole("button", { name: /^(select|selected)$/i }).first().click();
  const form = page.locator("input:visible");
  await form.nth(0).fill("Maria");
  await form.nth(1).fill("Lopez");
  await page.locator('input[type="date"]:visible').first().fill("1990-05-20");
  await page.locator("select:visible").first().selectOption({ label: "Female" });
  await page.locator('input[type="email"]:visible').fill("maria@example.com");
  await page.locator('input[type="tel"]:visible').fill("2015550123");
  await page.getByRole("button", { name: /continue to seats/i }).click();

  await expect(page.getByRole("heading", { name: "Seat selection" })).toBeVisible();
  await page.locator('button[data-seat="10A"]').first().click();
  await expect(page.getByText("Costs extra · from $25")).toBeVisible();
  await expect(page.getByText("Maria's seat")).toBeVisible();
  if (process.env.SHOT) await page.locator(".skc-step-form").screenshot({ path: process.env.SHOT });
  await page.getByRole("button", { name: /review & pay →/i }).click();

  const sent = callsTo(calls, "POST /api/flights/duffel/seats/pi_1")[0].body;
  expect(sent.selected).toEqual([{ passengerIndex: 0, serviceId: "seg_out|10A" }]);
  await expect(page.getByText("$437.50").first()).toBeVisible();
});

test("Duffel fare: a traveler under 18 is caught in the form, with their age shown", async ({ page, calls }) => {
  await page.goto(SEARCH);
  await page.getByRole("button", { name: /^select flight$/i }).first().click();
  await page.getByRole("button", { name: /^(select|selected)$/i }).first().click();
  const form = page.locator("input:visible");
  await form.nth(0).fill("Maria");
  await form.nth(1).fill("Lopez");
  await page.locator('input[type="date"]:visible').first().fill("2012-05-20");
  await page.locator("select:visible").first().selectOption({ label: "Female" });
  await page.locator('input[type="email"]:visible').fill("maria@example.com");
  await page.locator('input[type="tel"]:visible').fill("2015550123");
  await page.getByRole("button", { name: /continue to seats/i }).click();
  await expect(page.getByText(/This fare is for adults \(18\+\)\. This date makes them 14 on the trip/)).toBeVisible();
  expect(callsTo(calls, "POST /api/flights/duffel/intent")).toHaveLength(0);
  await page.locator('input[type="date"]:visible').first().fill("1990-05-20");
  await expect(page.getByText("Age 36 on the trip")).toBeVisible();
});


test("a 9-across wide-body fits a phone: no sideways page scroll, no fake row labels", async ({ page, routes }) => {
  const wide = (seg) =>
    [28, 29, 30, 31, 32, 33].flatMap((row) =>
      ["A", "B", "C", "D", "E", "F", "H", "J", "K"].map((col, i) => ({
        seatNumber: `${row}${col}`,
        serviceId: `${seg}|${row}${col}`,
        available: (row + i) % 3 === 0,
        price: 20,
        tier: "paid",
        segmentKey: seg,
      }))
    );
  routes["GET /api/flights/duffel/seats/pi_1"] = { ok: true, seats: [...wide("seg_out"), ...wide("seg_back")], bags: [] };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SEARCH);
  await page.getByRole("button", { name: /^select flight$/i }).first().click();
  await page.getByRole("button", { name: /^(select|selected)$/i }).first().click();
  const form = page.locator("input:visible");
  await form.nth(0).fill("David");
  await form.nth(1).fill("Chatman");
  await page.locator('input[type="date"]:visible').first().fill("1990-05-20");
  await page.locator("select:visible").first().selectOption({ label: "Male" });
  await page.locator('input[type="email"]:visible').fill("d@example.com");
  await page.locator('input[type="tel"]:visible').fill("2015550123");
  await page.getByRole("button", { name: /continue to seats/i }).click();
  await expect(page.locator('button[data-seat="28A"]').first()).toBeVisible();
  // The page itself never scrolls sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // Every seat in the row is on screen.
  const k = await page.locator('button[data-seat="28K"]').first().boundingBox();
  expect(k.x + k.width).toBeLessThanOrEqual(390);
  await expect(page.getByText("Pick for me")).toBeInViewport({ ratio: 0.5 }).catch(() => {});
  await expect(page.getByRole("separator").filter({ hasText: /free|costs extra/i })).toHaveCount(0);
  // The "Choosing for…" bar stays above the map: scrolling down the cabin
  // never puts it on top of seats.
  await page.locator('button[data-seat="33K"]').first().scrollIntoViewIfNeeded();
  const bar = await page.getByText("Choosing for David Chatman").boundingBox();
  const seat = await page.locator('button[data-seat="33K"]').first().boundingBox();
  expect(!bar || bar.y + bar.height <= seat.y).toBe(true);
  if (process.env.SHOT) {
    await page.locator('button[data-seat="28A"]').first().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(400);
    await page.screenshot({ path: process.env.SHOT });
  }
});
