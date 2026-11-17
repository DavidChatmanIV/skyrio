// Flights: search → pick → traveler details → fare held → pay step.
import { test, expect, callsTo, FLIGHT } from "./mocks.js";

const SEARCH =
  "/booking?tab=Flights&from=EWR&to=MIA&toName=Miami&depart=2027-03-12&return=2027-03-15&adults=1&auto=1";

async function pickRoundTrip(page) {
  await page.getByRole("button", { name: /^select flight$/i }).first().click();
  // Round trip: choose the flight home too.
  const home = page.getByRole("button", { name: /^(select|selected)$/i }).first();
  await home.click();
}

test("search shows the fare and opens checkout on that flight", async ({ page, calls }) => {
  await page.goto(SEARCH);
  await expect(page.locator(".sk-priceAmt:visible", { hasText: "413" }).first()).toBeVisible();
  const search = callsTo(calls, "GET /api/flights/search")[0];
  expect(search.query).toMatchObject({ from: "EWR", to: "MIA", departDate: "2027-03-12", returnDate: "2027-03-15", adults: "1" });

  await pickRoundTrip(page);
  await expect(page.getByText("Passenger details")).toBeVisible();
  await expect(page.getByText(/Fri, Mar 12 · 8:00 AM/).first()).toBeVisible();
  await expect(page.getByText(/Mon, Mar 15 · 5:00 PM/).first()).toBeVisible();
});

test("guest fills traveler details and the fare is held with those names", async ({ page, calls }) => {
  await page.goto(SEARCH);
  await pickRoundTrip(page);
  await expect(page.getByText("Passenger details")).toBeVisible();
  await expect(page.getByText(/booking as a guest/i)).toBeVisible();

  const form = page.locator("input:visible");
  await form.nth(0).fill("Maria");
  await form.nth(1).fill("Lopez");
  await page.locator('input[type="date"]:visible').first().fill("1990-05-20");
  await page.locator("select:visible").first().selectOption({ label: "Female" });
  await page.locator('input[type="email"]:visible').fill("maria@example.com");
  await page.locator('input[type="tel"]:visible').fill("2015550123");
  await page.getByRole("button", { name: /continue to seats/i }).click();

  // The fare is checked, then held, for this exact offer and traveler.
  await expect.poll(() => callsTo(calls, "POST /api/flights/prebook").length).toBe(1);
  const verify = callsTo(calls, "POST /api/flights/verify")[0];
  expect(verify.body.offerId).toBe(FLIGHT.offerId);
  const prebook = callsTo(calls, "POST /api/flights/prebook")[0];
  const pax = prebook.body.passengers?.[0] || {};
  expect(JSON.stringify(pax)).toContain("Maria");
  expect(JSON.stringify(pax)).toContain("Lopez");
  expect(prebook.body.passengers).toHaveLength(1);

  // Seats are optional → the pay step shows who's flying and the real total.
  await page.getByRole("button", { name: /review & pay →/i }).click();
  await expect(page.getByText("Maria Lopez")).toBeVisible();
  await expect(page.getByText("$412.50").first()).toBeVisible();
  // The card form waits until the fare rules are accepted.
  await expect(page.getByText(/agree to the fare rules above to enter your card/i)).toBeVisible();
});

test("a fare that can't be held shows a clear message, not a crash", async ({ page, routes }) => {
  routes["POST /api/flights/prebook"] = { __status: 400, body: { ok: false, message: "This fare is no longer available." } };
  await page.goto(SEARCH);
  await pickRoundTrip(page);
  const form = page.locator("input:visible");
  await form.nth(0).fill("Maria");
  await form.nth(1).fill("Lopez");
  await page.locator('input[type="date"]:visible').first().fill("1990-05-20");
  await page.locator("select:visible").first().selectOption({ label: "Female" });
  await page.locator('input[type="email"]:visible').fill("maria@example.com");
  await page.locator('input[type="tel"]:visible').fill("2015550123");
  await page.getByRole("button", { name: /continue to seats/i }).click();
  await expect(page.getByText(/no longer available/i).first()).toBeVisible();
});

test("Book a flight on the home page opens the Flights tab", async ({ page }) => {
  // A saved hotel search used to win and open Stays (Nov 16 tester report).
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "skyrio_last_search",
      JSON.stringify({ tab: "Stays", savedAt: Date.now(), query: { city: "Miami" }, results: [] })
    )
  );
  await page.goto("/");
  await page.locator("a.lp-btn", { hasText: "Book a flight" }).click();
  await expect(page).toHaveURL(/tab=Flights/);
});
