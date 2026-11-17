// Browser tests for the paths where money changes hands. Every /api call
// is answered by a mock (e2e/mocks.js), so nothing reaches LiteAPI,
// Duffel or Stripe. Run: npm run test:e2e
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
    ...devices["iPhone 13"],
    // Chromium, phone-sized: most travelers book on a phone.
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // The real production build, served the way Vercel serves it.
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        port: PORT,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});
