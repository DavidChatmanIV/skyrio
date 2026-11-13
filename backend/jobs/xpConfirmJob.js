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
import User from "../models/user.js";
import Notification from "../models/notification.js";
import {
  LAUNCH_TRAVELER,
  launchTravelerIneligibleReason,
} from "../config/launchTraveler.js";

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
      ? await Booking.findById(bookingId).lean()
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

    // Launch Traveler: check everything again at unlock time (account
    // blocked, booking refunded since, etc.). Only this row is taken back;
    // the trip's normal booking XP is unaffected.
    if (row.ruleKey === LAUNCH_TRAVELER.ruleKey) {
      const user = await User.findById(row.user)
        .select("launchTravelerBlocked")
        .lean();
      const why = launchTravelerIneligibleReason(booking, user);
      // "program_off" / "outside_window" only matter when it was granted;
      // turning the program off later must not take earned badges away.
      if (why && !["program_off", "outside_window"].includes(why)) {
        await reverseXp({
          linkedTo: bookingId,
          ruleKey: LAUNCH_TRAVELER.ruleKey,
          reason: `launch traveler: ${why}`,
        });
        continue;
      }
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

    if (row.ruleKey === LAUNCH_TRAVELER.ruleKey) {
      await Notification.create({
        user: row.user,
        type: "xp",
        title: `You're a ${LAUNCH_TRAVELER.name}`,
        message: `Your badge is on your Digital Passport. +${row.amount} XP added.`,
        link: "/passport",
      }).catch((e) =>
        console.error("[xp-confirm] launch traveler notification", e.message)
      );
    }

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
