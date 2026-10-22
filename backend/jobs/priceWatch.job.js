/**
 * Runs on a schedule (recommend every few hours — flight prices move
 * faster than the dormancy job's daily cadence). Re-checks every active
 * flight Watch against LiteAPI, and creates a Notification when the
 * price has dropped below the last seen price.
 *
 * Safety & accuracy:
 *  - Prices are compared as NUMBERS (LiteAPI sends strings; comparing
 *    "1200" < "950" as text gives the wrong cheapest flight).
 *  - Same route + dates + travelers + cabin is searched once per run and
 *    shared by every watch on it.
 *  - Watches for trips that have already departed are switched off.
 *  - The same price drop is never announced twice in a row.
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
// LiteAPI searches can be slow; give each one this long.
const SEARCH_TIMEOUT_MS = 60 * 1000;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// The cheapest real price in a list of flights, as a number.
function cheapestOf(flights) {
  let best = null;
  for (const f of flights) {
    const price = toNumber(f?.totalAmount);
    if (price != null && (!best || price < best.price))
      best = { price, flight: f };
  }
  return best;
}

// Link that opens Book with this exact search filled in.
function bookingLink(watch) {
  const q = new URLSearchParams({
    from: watch.origin,
    to: watch.destination,
  });
  if (watch.dates?.[0]) q.set("depart", watch.dates[0]);
  if (watch.dates?.[1]) q.set("return", watch.dates[1]);
  if (watch.adults > 1) q.set("adults", String(watch.adults));
  if (watch.cabin && watch.cabin !== "economy") q.set("cabin", watch.cabin);
  q.set("auto", "1"); // runs the search as soon as Book opens
  return `/booking?${q}`;
}

// Signature matches the existing scheduler.js contract:
// runPriceWatchOnce({ limit, dryRun })
export async function runPriceWatchOnce({ limit = 500, dryRun = false } = {}) {
  console.log("[priceWatchJob] starting run:", new Date().toISOString());

  const watches = await Watch.find({ type: "flights", active: true }).limit(
    limit
  );
  console.log(`[priceWatchJob] found ${watches.length} active flight watches`);

  let checked = 0;
  let notified = 0;
  let failed = 0;
  let expired = 0;
  const searches = new Map(); // search key -> Promise<flights[]>
  const today = todayISO();

  for (const watch of watches) {
    try {
      const depart = String(watch.dates?.[0] || "").slice(0, 10);
      if (!watch.origin || !watch.destination || !ISO_DAY.test(depart)) {
        // Incomplete watch record — skip rather than error out the whole run.
        continue;
      }

      // Trip already departed (or leaves today): nothing left to watch.
      if (depart <= today) {
        if (!dryRun) {
          watch.active = false;
          await watch.save();
        }
        expired++;
        continue;
      }

      const params = {
        origin: watch.origin,
        destination: watch.destination,
        departureDate: depart,
        returnDate: watch.dates?.[1]
          ? String(watch.dates[1]).slice(0, 10)
          : undefined,
        adults: Math.max(1, Number(watch.adults) || 1),
        cabinClass: watch.cabin || "economy",
      };
      const key = JSON.stringify(params);
      if (!searches.has(key)) {
        searches.set(
          key,
          (async () => {
            const payload = buildLiteApiSearchPayload(params);
            const { data } = await liteApiFlights.post(
              "/flights/rates",
              payload,
              {
                timeout: SEARCH_TIMEOUT_MS,
              }
            );
            return normalizeFlightSearchResponse(data, params).map(
              toFrontendFlightShape
            );
          })()
        );
      }
      const flights = await searches.get(key);
      checked++;

      const best = cheapestOf(flights);
      if (!best) continue;

      const previousPrice = toNumber(watch.lastSeenPrice);
      const currentPrice = best.price;
      const droppedEnough =
        previousPrice != null &&
        previousPrice - currentPrice >= MIN_DROP_TO_NOTIFY;

      if (droppedEnough) {
        if (!dryRun) {
          const notification = await Notification.create({
            user: watch.userId,
            type: "price_watch",
            title: "Price dropped",
            message: `${watch.origin} → ${
              watch.destination
            } is now $${Math.round(currentPrice).toLocaleString(
              "en-US"
            )} (was $${Math.round(previousPrice).toLocaleString(
              "en-US"
            )}). Prices change often, and the final price is confirmed at checkout.`,
            link: bookingLink(watch),
            metadata: {
              watchId: watch._id,
              origin: watch.origin,
              destination: watch.destination,
              departDate: depart,
              previousPrice,
              currentPrice,
              owner: best.flight?.owner || null,
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

      // Always update lastSeenPrice to the latest — keeps future comparisons
      // accurate, and means the same drop is never announced twice.
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
    `[priceWatchJob] done. checked: ${checked}, notified: ${notified}, expired: ${expired}, failed: ${failed}, searches: ${searches.size}`
  );
  return { checked, notified, expired, failed, totalWatches: watches.length };
}
