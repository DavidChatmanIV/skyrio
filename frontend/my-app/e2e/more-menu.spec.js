// The "More" tab menu says what's inside, in Skyrio's colors.
import { test, expect } from "./mocks.js";

test("More shows a count and each option says what it's for", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/booking?tab=Flights");
  const more = page.locator(".sk-tab-more-btn");
  await expect(more.locator(".sk-tab-more-count")).toHaveText("3");
  await more.click();
  const menu = page.locator(".sk-tab-more-menu--portal");
  await expect(menu.getByText("Tours & things to do")).toBeVisible();
  await expect(menu.getByText("Concerts, games & shows")).toBeVisible();
  await expect(menu.getByText("Trips leaving soon")).toBeVisible();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await menu.getByText("Events", { exact: true }).click();
  await expect(more).toContainText("Events");
});
