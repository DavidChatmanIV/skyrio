// Once a day: for each upcoming LiteAPI stay that can still be cancelled
// for free, check whether the same room now costs less
// (services/stayPriceDrop.js). If it does, tell the traveler once (a
// notification if they have an account, and an email), and keep the
// saving on the booking so My Trips / Manage booking can show it.
// A bigger saving later is announced again; the same one never is.
import Booking from "../models/booking.js";
import Notification from "../models/notification.js";
import { checkStayPriceDrop, stayCanBeWatched, replaceOldStay } from "../services/stayPriceDrop.js";
import { sendStayPriceDropEmail } from "../services/bookingEmails.js";
import { tellReplaceOutcome } from "../services/replaceOutcome.js";

const MAX_PER_RUN = 200; // LiteAPI calls stay bounded
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Finish any "cancel the old stay" that didn't go through (hourly). */
export async function retryStayReplacesOnce() {
  const retries = await Booking.find({ type: "Hotel", "replaces.status": "retry" }).limit(50);
  if (!retries.length) return { retried: 0 };
  const { cancelBookingCore } = await import("../routes/bookings.routes.js");
  const { readManageToken } = await import("../services/manageLink.js");
  for (const nb of retries) {
    const r = await replaceOldStay(
      { newBooking: nb, oldBookingId: nb.replaces.bookingId, retry: true },
      { Booking, cancelBookingCore, readManageToken }
    ).catch((e) => ({ status: "retry", message: e.message }));
    console.log(`[stay price drop] retry old stay ${nb.replaces.bookingId}: ${r.status}`);
    await tellReplaceOutcome(nb, r);
  }
  return { retried: retries.length };
}

export async function runStayPriceDropOnce({ dryRun = false } = {}) {
  const now = new Date();
  if (!dryRun) await retryStayReplacesOnce();
  const candidates = await Booking.find({
    type: "Hotel",
    status: "confirmed",
    provider: { $ne: "duffel" },
    sharedRoom: { $exists: false },
    "dates.start": { $gt: now },
  })
    .sort({ "dates.start": 1 })
    .limit(MAX_PER_RUN)
    .lean();

  const out = { checked: 0, found: 0, notified: 0, skipped: 0 };
  for (const b of candidates) {
    if (!stayCanBeWatched(b, now.getTime())) {
      out.skipped++;
      continue;
    }
    out.checked++;
    const r = await checkStayPriceDrop(b);
    if (!r.ok) {
      // Price went back up or it can't be cancelled for free anymore: stop showing it.
      if (b.priceDrop?.savings && !dryRun)
        await Booking.updateOne({ _id: b._id }, { $unset: { priceDrop: 1 } });
      await sleep(300);
      continue;
    }
    out.found++;
    const already = Number(b.priceDrop?.notifiedSavings) || 0;
    const tellAgain = r.savings >= already + 10; // only for a meaningfully bigger saving
    if (!dryRun) {
      await Booking.updateOne(
        { _id: b._id },
        {
          $set: {
            priceDrop: {
              savings: r.savings,
              currency: r.currency,
              freeCancelUntil: r.freeCancelUntil,
              checkedAt: now,
              notifiedSavings: tellAgain ? r.savings : already,
            },
          },
        }
      );
      if (tellAgain) {
        const hotelName = b.hotelStay?.rooms?.[0]?.name || "your hotel";
        const amount = `$${Math.round(r.savings).toLocaleString("en-US")}`;
        if (b.user) {
          await Notification.create({
            user: b.user,
            type: "stay_price_drop",
            title: "Price Watch: your stay got cheaper",
            message: `The same room at ${hotelName} is ${amount} less than you paid. Book it and Skyrio cancels your old booking for free.`,
            link: `/manage-booking/${b._id}`,
            metadata: { bookingId: b._id, savings: r.savings },
          }).catch((e) => console.warn("[stay price drop] notification failed:", e.message));
        }
        await sendStayPriceDropEmail({
          to: b.email,
          guestName: String(b.name || "").split(" ")[0],
          hotelName,
          savings: r.savings,
          currency: r.currency,
          freeCancelUntil: r.freeCancelUntil,
          bookingId: b._id,
        }).catch(() => {});
        out.notified++;
      }
    }
    await sleep(300);
  }
  return out;
}
