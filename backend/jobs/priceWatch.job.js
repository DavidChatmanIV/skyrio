// import Watch from "../models/Watch.js";
// import Notification from "../models/Notification.js";

function mockGetCurrentPrice(watch) {
  const base =
    typeof watch.lastSeenPrice === "number" && watch.lastSeenPrice !== null
      ? watch.lastSeenPrice
      : 1200;
  const delta = Math.floor(Math.random() * 120 - 60);
  return Math.max(50, base + delta);
}

export async function runPriceWatchOnce({ limit = 500, dryRun = false } = {}) {
  // 🚧 Watch model not yet built — skipping
  console.warn("[priceWatch] Skipping — Watch model not yet implemented.");
  return { checked: 0 };
}