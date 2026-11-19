// "On a budget": tapping it shows the budget planner right away, and the
// budget is the same everywhere (slider, trip budget card, results).
import { test, expect } from "./mocks.js";

test("On a budget shows the planner, and the card shows the same budget", async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem("skyrio_plan_mode", "search"); } catch { /* ignore */ }
  });
  await page.goto("/booking");
  await page.getByRole("radio", { name: /On a budget/ }).click();

  // The planner appears without picking anything else first.
  await expect(page.getByText("Your budget").first()).toBeVisible();
  await expect(page.getByText("$1,500").first()).toBeVisible();

  // The trip budget card shows that same $1,500 (it used to stay empty).
  await expect(page.locator(".ant-input-number-input").first()).toHaveValue(/1,?500/);
});

test("a budget typed on the card moves the slider too", async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem("skyrio_plan_mode", "budget"); } catch { /* ignore */ }
  });
  await page.goto("/booking");
  await expect(page.getByText("$1,500").first()).toBeVisible();
  const box = page.locator(".ant-input-number-input").first();
  await box.fill("900");
  await box.blur();
  await expect(page.getByText("$900").first()).toBeVisible();
});
