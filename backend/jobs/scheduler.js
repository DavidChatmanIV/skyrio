import mongoose from "mongoose";
import { runPriceWatchOnce } from "./priceWatch.job.js";

const HOUR_MS = 60 * 60 * 1000;

// How often Price Watch re-checks prices. Flight prices move during the
// day, so once a day misses most drops. Default: every 4 hours.
// Change it on Render with PRICE_WATCH_EVERY_HOURS (1–24).
const EVERY_HOURS = Math.min(
  24,
  Math.max(1, Number(process.env.PRICE_WATCH_EVERY_HOURS) || 4)
);

// First run after the server starts. Not immediate, so a deploy or restart
// doesn't fire a burst of LiteAPI searches while the app is warming up.
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function startJobs() {
  const USE_MOCKS = process.env.USE_MOCKS === "true";

  // Don't run in mock mode
  if (USE_MOCKS) {
    console.log("[jobs] disabled (USE_MOCKS=true)");
    return;
  }

  // Optional kill-switch for production
  if (process.env.RUN_JOBS === "false") {
    console.log("[jobs] disabled (RUN_JOBS=false)");
    return;
  }

  let running = false;

  const tick = async () => {
    // Prevent overlap if a run takes too long
    if (running) return;
    running = true;
    const t0 = Date.now();

    try {
      // If DB not ready, skip this tick
      if (mongoose.connection.readyState !== 1) {
        console.log("[jobs] price watch skipped (DB not ready)");
        return;
      }

      const r = await runPriceWatchOnce();
      console.log(
        `[jobs] price watch done in ${Math.round(
          (Date.now() - t0) / 1000
        )}s: ` +
          `checked=${r.checked} notified=${r.notified} expired=${
            r.expired ?? 0
          } failed=${r.failed}`
      );
    } catch (e) {
      console.error("[jobs] price watch error:", e?.message || e);
    } finally {
      running = false;
    }
  };

  (async () => {
    await sleep(FIRST_RUN_DELAY_MS);
    tick();
  })();

  setInterval(tick, EVERY_HOURS * HOUR_MS);

  console.log(`[jobs] started: price watch every ${EVERY_HOURS}h`);
}
