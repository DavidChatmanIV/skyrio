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
