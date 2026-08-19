/**
 * Runs on a schedule (recommend every few hours — flight prices move
 * faster than the dormancy job's daily cadence). Re-checks every active
 * flight Watch against LiteAPI, and creates a Notification when the
 * price has dropped below the last seen price.
 */

import Watch from "../models/watch.js";
import Notification from "../models/notification.js";
import { liteApiFlights } from "../routes/api/flights/Liteapiflights.provider.js";
import {
  buildLiteApiSearchPayload,
  normalizeFlightSearchResponse,
  toFrontendFlightShape,
} from "../routes/api/flights/Liteapiflights.utils.js";
// Using app.get("io") rather than importing { io } directly from server.js —
// server.js → jobs/scheduler.js → this file → server.js would be a circular
// import, and reading a live `io` binding through that cycle is fragile.
// app.set("io", io) in server.js exists specifically so other modules can
// safely grab the socket server at call-time instead.
import { app } from "../server.js";

// Only fire a notification if the price dropped by at least this much —
// avoids spamming users over $1 fluctuations.
const MIN_DROP_TO_NOTIFY = 10;

// Signature matches the existing scheduler.js contract:
// runPriceWatchOnce({ limit, dryRun }) — limit/dryRun accepted for
// forward-compatibility but not required by this implementation.
export async function runPriceWatchOnce({ limit = 500, dryRun = false } = {}) {
  console.log("[priceWatchJob] starting run:", new Date().toISOString());

  const watches = await Watch.find({ type: "flights", active: true }).limit(
    limit
  );
  console.log(`[priceWatchJob] found ${watches.length} active flight watches`);

  let checked = 0;
  let notified = 0;
  let failed = 0;

  for (const watch of watches) {
    try {
      if (!watch.origin || !watch.destination || !watch.dates?.[0]) {
        // Incomplete watch record — skip rather than error out the whole run.
        continue;
      }

      const payload = buildLiteApiSearchPayload({
        origin: watch.origin,
        destination: watch.destination,
        departureDate: watch.dates[0],
        returnDate: watch.dates[1] || undefined,
        adults: watch.adults || 1,
        cabinClass: watch.cabin || "economy",
      });

      const { data } = await liteApiFlights.post("/flights/rates", payload);
      const results = normalizeFlightSearchResponse(data);
      const flights = results.map(toFrontendFlightShape);

      checked++;

      if (!flights.length) continue;

      const cheapest = flights.reduce((min, f) =>
        f.totalAmount < min.totalAmount ? f : min
      );

      const previousPrice = watch.lastSeenPrice;
      const currentPrice = cheapest.totalAmount;

      const droppedEnough =
        typeof previousPrice === "number" &&
        previousPrice - currentPrice >= MIN_DROP_TO_NOTIFY;

      if (droppedEnough) {
        if (!dryRun) {
          const notification = await Notification.create({
            user: watch.userId,
            type: "price_watch",
            title: "Price dropped!",
            message: `${watch.origin} → ${
              watch.destination
            } dropped to $${currentPrice.toFixed(
              0
            )} (was $${previousPrice.toFixed(0)}).`,
            link: `/booking?from=${watch.origin}&to=${watch.destination}`,
            metadata: {
              watchId: watch._id,
              origin: watch.origin,
              destination: watch.destination,
              previousPrice,
              currentPrice,
              owner: cheapest.owner,
            },
          });

          // Real-time push — matches the "notifications:join" room pattern
          // in server.js, which joins each socket to String(userId).
          const io = app.get("io");
          if (io) {
            io.to(String(watch.userId)).emit(
              "notification:new",
              notification.toObject()
            );
          }
        }
        notified++;
      }

      // Always update lastSeenPrice to the latest, whether it dropped or not —
      // keeps future comparisons accurate. Skipped in dry-run mode.
      if (!dryRun) {
        watch.lastSeenPrice = currentPrice;
        await watch.save();
      }
    } catch (err) {
      failed++;
      console.error(
        `[priceWatchJob] failed for watch ${watch._id}:`,
        err?.response?.data || err.message
      );
    }
  }

  console.log(
    `[priceWatchJob] done. checked: ${checked}, notified: ${notified}, failed: ${failed}`
  );
  return { checked, notified, failed, totalWatches: watches.length };
}
