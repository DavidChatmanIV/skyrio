import mongoose from "mongoose";
import { XpLedger } from "../models/xpModels.js";
import {
  reverseXp,
  applyBalance,
  progressChallenges,
} from "../services/xpService.js";
import { XP_RULES, DEAD_BOOKING_STATUSES } from "../config/xpRules.js";
// ⚠️ Render is case-sensitive: match your real filename exactly (booking.js vs Booking.js).
import Booking from "../models/booking.js";

// The airline accepted a cancellation but hasn't finished it. Don't confirm
// the XP (the trip is probably going away) and don't reverse it yet (the
// airline could still refuse) — check again on the next run.
const WAIT_STATUSES = ["cancel_pending"];

/**
 * Pending booking/referral XP → confirmed, once the trip has started and the
 * 24h hold is over — but only if the booking is still alive at that moment.
 *
 * onRankUp(userId, newRank) is optional: plug in your notification / modal trigger.
 */
export async function confirmPendingXp({ onRankUp } = {}) {
  const due = await XpLedger.find({
    status: "pending",
    confirmAfter: { $lte: new Date() },
  }).limit(500);

  for (const row of due) {
    const bookingId = row.linkedTo;
    const booking = mongoose.isValidObjectId(bookingId)
      ? await Booking.findById(bookingId).select("status")
      : null;
    const status = String(booking?.status || "").toLowerCase();

    if (booking && WAIT_STATUSES.includes(status)) continue;

    const alive = Boolean(booking) && !DEAD_BOOKING_STATUSES.includes(status);

    if (!alive) {
      await reverseXp({
        linkedTo: bookingId,
        reason: "booking not active at confirm time",
      });
      continue;
    }

    // Claim the row so two job runs can't confirm it twice.
    const claimed = await XpLedger.findOneAndUpdate(
      { _id: row._id, status: "pending" },
      { $set: { status: "confirmed" } }
    );
    if (!claimed) continue;

    const rule = XP_RULES[row.ruleKey] ?? {};
    const { rankUp } = await applyBalance(
      row.user,
      { xp: row.amount, pendingXp: -row.amount },
      {
        label: `${rule.label ?? "XP"} — unlocked`,
        xp: row.amount,
        icon: rule.iconKey ?? "plane",
        iconKey: rule.iconKey ?? "plane",
        pending: false,
        time: Date.now(),
      }
    );

    // Booking-based challenges move only once the booking is real.
    await progressChallenges(row.user, row.ruleKey);

    if (rankUp && onRankUp) {
      await onRankUp(row.user, rankUp).catch((e) =>
        console.error("[xp-confirm] onRankUp", e)
      );
    }
  }
  return due.length;
}

/** Call once from server.js after mongoose connects. */
export function startXpConfirmJob(options = {}) {
  const run = () =>
    confirmPendingXp(options).catch((err) =>
      console.error("[xp-confirm]", err)
    );
  run();
  setInterval(run, 60 * 60 * 1000); // hourly; catches up after a Render sleep
}
