// Every 6 hours: for each upcoming flight Skyrio can watch
// (services/flightPriceDrop.js), search the same route again. If the same
// flights cost less AND the airline would refund the current ticket in full
// right now, keep the saving on the booking and tell the traveler once
// (notification + email). A bigger saving later is announced again.
//
// Airlines' full-refund windows can be short (often about a day), so this
// runs more often than the stay check.
import Booking from "../models/booking.js";
import Notification from "../models/notification.js";
import { checkFlightPriceDrop, flightCanBeWatched, replaceOldFlight } from "../services/flightPriceDrop.js";
import { sendFlightPriceDropEmail } from "../services/bookingEmails.js";
import { tellReplaceOutcome } from "../services/replaceOutcome.js";

const MAX_PER_RUN = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Finish any "cancel the old ticket" that didn't go through (hourly). */
export async function retryFlightReplacesOnce() {
  const retries = await Booking.find({ type: "Flight", "replaces.status": "retry" }).limit(50);
  if (!retries.length) return { retried: 0 };
  const { cancelBookingCore } = await import("../routes/bookings.routes.js");
  const { readManageToken } = await import("../services/manageLink.js");
  for (const nb of retries) {
    const r = await replaceOldFlight(
      { newBooking: nb, oldBookingId: nb.replaces.bookingId, retry: true },
      { Booking, cancelBookingCore, readManageToken }
    ).catch((e) => ({ status: "retry", message: e.message }));
    console.log(`[flight price drop] retry old ticket ${nb.replaces.bookingId}: ${r.status}`);
    await tellReplaceOutcome(nb, r);
  }
  return { retried: retries.length };
}

export async function runFlightPriceDropOnce({ dryRun = false } = {}) {
  const now = Date.now();
  const candidates = await Booking.find({
    type: "Flight",
    status: "confirmed",
    "flight.journeyKey": { $type: "string" },
    "dates.start": { $gt: new Date(now) },
  })
    .sort({ "dates.start": 1 })
    .limit(MAX_PER_RUN)
    .lean();

  const out = { checked: 0, found: 0, notified: 0, skipped: 0, failed: 0 };
  // One search per route/dates/travelers per run, shared by every booking on it.
  const searches = new Map();
  const { runSearch } = await import("../routes/api/flights/Liteapiflights.controller.js");
  const search = (params) => {
    const key = JSON.stringify(params);
    if (!searches.has(key))
      searches.set(
        key,
        runSearch(params, { fresh: true }).then((r) => r.flights || [])
      );
    return searches.get(key);
  };

  for (const b of candidates) {
    if (!flightCanBeWatched(b, now)) {
      out.skipped++;
      continue;
    }
    out.checked++;
    let r;
    try {
      r = await checkFlightPriceDrop(b, { search });
    } catch (e) {
      out.failed++;
      console.warn(`[flight price drop] ${b._id}: ${e.message}`);
      continue;
    }
    if (!r.ok) {
      if (b.priceDrop?.savings && !dryRun) await Booking.updateOne({ _id: b._id }, { $unset: { priceDrop: 1 } });
      await sleep(300);
      continue;
    }
    out.found++;
    const already = Number(b.priceDrop?.notifiedSavings) || 0;
    const tellAgain = r.savings >= already + 10;
    if (!dryRun) {
      await Booking.updateOne(
        { _id: b._id },
        {
          $set: {
            priceDrop: {
              savings: r.savings,
              currency: r.currency,
              now: r.now,
              checkedAt: new Date(),
              notifiedSavings: tellAgain ? r.savings : already,
            },
          },
        }
      );
      if (tellAgain) {
        const route =
          b.flight?.origin && b.flight?.destination ? `${b.flight.origin} → ${b.flight.destination}` : null;
        const amount = `$${Math.round(r.savings).toLocaleString("en-US")}`;
        if (b.user) {
          await Notification.create({
            user: b.user,
            type: "flight_price_drop",
            title: "Price Watch: your flight got cheaper",
            message: `The same flights${route ? ` for ${route}` : ""} are ${amount} less than you paid, and your ticket can be refunded in full right now. Book it and Skyrio cancels the old ticket.`,
            link: `/manage-booking/${b._id}`,
            metadata: { bookingId: b._id, savings: r.savings },
          }).catch((e) => console.warn("[flight price drop] notification failed:", e.message));
        }
        await sendFlightPriceDropEmail({
          to: b.email,
          name: String(b.name || "").split(" ")[0],
          route,
          savings: r.savings,
          currency: r.currency,
          bookingId: b._id,
        }).catch(() => {});
        out.notified++;
      }
    }
    await sleep(300);
  }
  return out;
}
