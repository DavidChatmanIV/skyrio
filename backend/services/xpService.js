import mongoose from "mongoose";
import { XpLedger, XpCounter } from "../models/xpModels.js";
import {
  XP_RULES,
  XP_PASSIVE,
  XP_MAX_SINGLE_AWARD,
  ENGAGEMENT_CAPS,
  ENGAGEMENT_RULE_KEYS,
  BOOKING_HOLD_HOURS,
  DEAD_BOOKING_STATUSES,
  MIN_POST_TEXT_LENGTH,
  MIN_COMMENT_TEXT_LENGTH,
  MIN_LIKER_ACCOUNT_AGE_DAYS,
  XP_PAGE_WHITELIST,
  applyMultiplier,
  getLevel,
  getBookingXP,
} from "../config/xpRules.js";
import User from "../models/user.js";
// ⚠️ Render is case-sensitive: match your real filename exactly (booking.js vs Booking.js).
import Booking from "../models/booking.js";
import Challenge from "../models/challenge.js";
import Notification from "../models/notification.js";
import ChallengeProgress from "../models/challengeProgress.js";

// Field on Booking that points to the user who booked it — change if yours is "userId".
const BOOKING_USER_FIELD = "user";

/* ───────────────────────── helpers ───────────────────────── */

const ruleFor = (key) => XP_RULES[key] ?? XP_PASSIVE[key] ?? null;

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10); // UTC day, same as routes/xp.js

function weekKey(d = new Date()) {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(
    ((t - yearStart) / 864e5 + 1) / 7
  )}`;
}

// Atomically adds `amount` to a cap bucket only if it stays <= cap.
// Check + increment happen in ONE Mongo op, so double-clicks / parallel requests can't slip past.
async function consumeCap(userId, bucket, amount, cap) {
  try {
    const doc = await XpCounter.findOneAndUpdate(
      { user: userId, bucket, total: { $lte: cap - amount } },
      {
        $inc: { total: amount },
        $setOnInsert: { expiresAt: new Date(Date.now() + 9 * 864e5) },
      },
      { upsert: true, new: true }
    );
    return Boolean(doc);
  } catch (err) {
    if (err.code === 11000) return false; // bucket exists and is full
    throw err;
  }
}

function makeEvent(rule, amount, { pending = false, label } = {}) {
  return {
    label: label ?? (pending ? `${rule.label} (pending)` : rule.label),
    xp: amount,
    icon: rule.iconKey ?? rule.icon ?? "star",
    iconKey: rule.iconKey ?? "star",
    pending,
    time: Date.now(),
  };
}

/**
 * Moves User.xp / User.pendingXp atomically, keeps xpTotalEarned + xpRecentEvents
 * (the fields GET /api/xp/me already reads) in sync, and reports a rank-up.
 *
 * TWO NUMBERS:
 *   xp            — spendable balance. Goes down when rewards are redeemed.
 *   xpTotalEarned — lifetime earned. RANK COMES FROM THIS. Redeeming never touches it;
 *                   only a reversal (cancelled booking, deleted post, unlike) lowers it.
 *
 * `earned` defaults to the positive part of `xp`, so:
 *   applyBalance(id, { xp: +50 })                 → earned +50 (normal grant / pending confirmed)
 *   applyBalance(id, { xp: -250 })                → earned 0   (reward redemption — rank safe)
 *   applyBalance(id, { xp: -50, earned: -50 })    → reversal   (cheat-proofing)
 */
export async function applyBalance(
  userId,
  { xp = 0, pendingXp = 0, earned },
  event = null
) {
  const earnedDelta = earned ?? (xp > 0 ? xp : 0);

  const update = { $inc: { xp, pendingXp } };
  if (earnedDelta !== 0) update.$inc.xpTotalEarned = earnedDelta;
  if (event)
    update.$push = {
      xpRecentEvents: { $each: [event], $position: 0, $slice: 12 },
    };

  const before = await User.findByIdAndUpdate(userId, update, {
    new: false,
    projection: { xp: 1, xpTotalEarned: 1 },
  });
  if (xp < 0 || pendingXp < 0 || earnedDelta < 0) {
    // never let a reversal/redemption push any balance below zero
    await User.updateOne({ _id: userId }, [
      {
        $set: {
          xp: { $max: [{ $ifNull: ["$xp", 0] }, 0] },
          pendingXp: { $max: [{ $ifNull: ["$pendingXp", 0] }, 0] },
          xpTotalEarned: { $max: [{ $ifNull: ["$xpTotalEarned", 0] }, 0] },
        },
      },
    ]);
  }

  const previousXp = before?.xp ?? 0;
  const newXp = Math.max(0, previousXp + xp);

  // Rank is based on lifetime earned XP, never the spendable balance.
  const previousEarned = before?.xpTotalEarned ?? previousXp;
  const newEarned = Math.max(0, previousEarned + earnedDelta);
  const prevRank = getLevel(previousEarned).current;
  const newRank = getLevel(newEarned).current;
  const rankUp =
    newEarned > previousEarned && newRank.name !== prevRank.name
      ? newRank
      : null;

  return {
    previousXp,
    xp: newXp,
    xpTotalEarned: newEarned,
    rank: newRank,
    rankUp,
  };
}

/* ───────────────────────── core ───────────────────────── */

/**
 * The ONLY way XP gets granted.
 * Returns { awarded:true, amount, pending, xp, rankUp, event, completedChallenges }
 *      or { awarded:false, reason }.
 *
 * sourceId  — what this grant is for (post id, booking id, day key). Ignored for `once` rules.
 * linkedTo  — what it depends on; reverseXp({ linkedTo }) takes it back. Defaults to sourceId.
 * actorId   — the other user involved (the liker), so each liker counts once.
 * pending   — true for bookings/referrals; counts toward pendingXp, not rank, until confirmed.
 */
export async function awardXP({
  userId,
  ruleKey,
  sourceId = null,
  sourceType = null,
  actorId = null,
  linkedTo,
  pending = false,
  confirmAfter = null,
  baseOverride,
  extraCaps = [],
  label,
  skipMultiplier = false,
}) {
  const rule = ruleFor(ruleKey);
  if (!rule) throw new Error(`Unknown XP rule: ${ruleKey}`);
  if (!rule.once && !sourceId)
    throw new Error(`XP rule ${ruleKey} needs a sourceId`);

  const base = baseOverride ?? rule.xp;
  if (!(base > 0)) return { awarded: false, reason: "zero" };

  const sid = rule.once ? "once" : String(sourceId);
  const actor = actorId ? new mongoose.Types.ObjectId(String(actorId)) : null;

  // 1. Already paid for this exact thing (even if later reversed)? Stop before touching caps.
  if (
    await XpLedger.exists({
      user: userId,
      ruleKey,
      sourceId: sid,
      actorId: actor,
    })
  ) {
    return { awarded: false, reason: "duplicate" };
  }

  // 2. Caps — per-rule daily count, then shared SkyHub/passive engagement ceilings.
  const today = dayKey();
  if (
    rule.dailyLimit &&
    !(await consumeCap(userId, `${ruleKey}:${today}`, 1, rule.dailyLimit))
  ) {
    return { awarded: false, reason: "daily_limit" };
  }
  if (ENGAGEMENT_RULE_KEYS.includes(ruleKey)) {
    if (
      !(await consumeCap(userId, `eng:${today}`, base, ENGAGEMENT_CAPS.daily))
    ) {
      return { awarded: false, reason: "engagement_daily_cap" };
    }
    if (
      !(await consumeCap(
        userId,
        `eng:${weekKey()}`,
        base,
        ENGAGEMENT_CAPS.weekly
      ))
    ) {
      return { awarded: false, reason: "engagement_weekly_cap" };
    }
  }
  for (const [bucket, amt, cap] of extraCaps) {
    if (!(await consumeCap(userId, bucket, amt, cap)))
      return { awarded: false, reason: "cap" };
  }

  // 3. Plan multiplier (server reads the plan — the client never sends it).
  const user = await User.findById(userId).select("plan");
  if (!user) return { awarded: false, reason: "no_user" };
  const amount = Math.min(
    XP_MAX_SINGLE_AWARD,
    skipMultiplier
      ? Math.round(base)
      : applyMultiplier(base, user.plan ?? "free")
  );

  // 4. Ledger row — the unique index is the final guard against races.
  try {
    await XpLedger.create({
      user: userId,
      ruleKey,
      sourceType,
      sourceId: sid,
      actorId: actor,
      linkedTo:
        linkedTo !== undefined
          ? linkedTo && String(linkedTo)
          : sourceId && String(sourceId),
      amount,
      status: pending ? "pending" : "confirmed",
      confirmAfter,
    });
  } catch (err) {
    if (err.code === 11000) return { awarded: false, reason: "duplicate" };
    throw err;
  }

  const event = makeEvent(rule, amount, { pending, label });
  const balance = await applyBalance(
    userId,
    pending ? { pendingXp: amount } : { xp: amount },
    event
  );

  // Challenges only move on REAL, confirmed actions (bookings move in the confirm job).
  const completedChallenges = pending
    ? []
    : await progressChallenges(userId, ruleKey);

  return {
    awarded: true,
    amount,
    pending,
    event,
    completedChallenges,
    ...balance,
  };
}

/**
 * Takes XP back from everything linked to a booking / post / comment.
 * Optional ruleKey + actorId narrow it (e.g. one unlike).
 * `once` rules (FIRST_BOOKING, FIRST_INTERNATIONAL) are deleted rather than reversed,
 * so a genuine first booking later can still earn them.
 */
export async function reverseXp({
  linkedTo,
  ruleKey,
  actorId,
  reason = "source removed",
}) {
  const filter = { linkedTo: String(linkedTo), status: { $ne: "reversed" } };
  if (ruleKey) filter.ruleKey = ruleKey;
  if (actorId) filter.actorId = new mongoose.Types.ObjectId(String(actorId));

  const rows = await XpLedger.find(filter);
  let count = 0;
  for (const row of rows) {
    const claimed = ruleFor(row.ruleKey)?.once
      ? await XpLedger.findOneAndDelete({ _id: row._id, status: row.status })
      : await XpLedger.findOneAndUpdate(
          { _id: row._id, status: row.status },
          { $set: { status: "reversed", reversedAt: new Date(), reason } }
        );
    if (!claimed) continue; // already handled by a parallel request
    await applyBalance(
      row.user,
      row.status === "pending"
        ? { pendingXp: -row.amount }
        : { xp: -row.amount, earned: -row.amount } // reversal also undoes lifetime/rank
    );
    count++;
  }
  return count;
}

/* ───────────────────────── challenges ───────────────────────── */

/**
 * Moves challenge progress for a REAL, server-verified action.
 * Atomic: parallel requests can't double-count, and each challenge bonus pays once per user.
 */
export async function progressChallenges(userId, ruleKey) {
  if (ruleKey === "CHALLENGE_COMPLETED") return [];
  const completed = [];
  try {
    const now = new Date();
    const challenges = await Challenge.find({
      active: true,
      "requirement.actionType": ruleKey,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean();

    for (const challenge of challenges) {
      // Only users who activated the challenge have a progress doc.
      const cp = await ChallengeProgress.findOneAndUpdate(
        { user: userId, challenge: challenge._id, completedAt: null },
        { $inc: { progress: 1 } },
        { new: true }
      );
      if (!cp || cp.progress < challenge.requirement.count) continue;

      // Claim completion exactly once.
      const claimed = await ChallengeProgress.findOneAndUpdate(
        { _id: cp._id, bonusAwarded: { $ne: true } },
        { $set: { bonusAwarded: true, completedAt: now } }
      );
      if (!claimed) continue;

      const bonus = await awardXP({
        userId,
        ruleKey: "CHALLENGE_COMPLETED",
        sourceType: "Challenge",
        sourceId: challenge._id,
        linkedTo: null,
        baseOverride: challenge.bonusXP,
        label: `Challenge complete: ${challenge.title}`,
      });
      if (bonus.awarded) {
        completed.push({
          id: challenge._id,
          title: challenge.title,
          bonusXP: bonus.amount,
        });
      }
    }
  } catch (err) {
    // A challenge bug must never break normal XP.
    console.error("[xp] challenge progress failed:", err);
  }
  return completed;
}

/* ───────────────────────── bookings ───────────────────────── */

/**
 * Call ONLY from the Stripe webhook after payment succeeds — never from a client request.
 * startDate = departure / check-in, read from your Booking document, not req.body.
 * For Sync Together, call once per member who paid their own share.
 * kind: "flight" | "hotel" | "excursion". stops: from the BOOKED flight (stored on the
 * Booking), so the XP granted matches the XP badge the customer saw on the card.
 */
export async function awardBookingXp({
  userId,
  bookingId,
  startDate,
  kind = "flight",
  stops = null,
  isInternational = false,
  referrerId = null,
}) {
  const confirmAfter = new Date(
    Math.max(
      new Date(startDate).getTime() || 0, // trip has started
      Date.now() + BOOKING_HOLD_HOURS * 3600 * 1000 // and the 24h free-cancel window is over
    )
  );
  const common = {
    sourceType: "Booking",
    linkedTo: String(bookingId),
    pending: true,
    confirmAfter,
  };

  const results = {
    booking: await awardXP({
      ...common,
      userId,
      ruleKey: "BOOKING_CONFIRMED",
      sourceId: bookingId,
      baseOverride: getBookingXP({ kind, stops }),
    }),
  };

  // Users who booked before the ledger existed shouldn't get "first booking" again.
  // Only CONFIRMED trips count — an abandoned "pending" checkout isn't a booking.
  const priorLiveBookings = await Booking.countDocuments({
    [BOOKING_USER_FIELD]: userId,
    _id: { $ne: bookingId },
    status: "confirmed",
  });
  if (priorLiveBookings === 0) {
    results.first = await awardXP({
      ...common,
      userId,
      ruleKey: "FIRST_BOOKING",
    });
  }
  if (isInternational) {
    results.international = await awardXP({
      ...common,
      userId,
      ruleKey: "FIRST_INTERNATIONAL",
    });
  }

  // Referral pays only when the friend's booking actually happens; one payout per friend, ever.
  if (referrerId && String(referrerId) !== String(userId)) {
    results.referral = await awardXP({
      ...common,
      sourceType: "Referral",
      userId: referrerId,
      ruleKey: "REFER_FRIEND",
      sourceId: userId,
    });
  }
  return results;
}

/* ───────────────────────── booking XP from a Booking record ───────────────────────── */
// Trip start = departure / check-in, read from the Booking record (never the
// client). Same fallbacks as tripDates() in bookings.routes.js.
const ISO_DAY = /\b(\d{4}-\d{2}-\d{2})\b/;
function bookingStartDate(b) {
  const room = b.hotelStay?.rooms?.[0];
  const raw =
    b.dates?.start ||
    room?.checkin ||
    b.flight?.departureDate ||
    b.flight?.departDate ||
    (String(b.tripDetails || "").match(ISO_DAY) || [])[1];
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

// Stops on the BOOKED flight, so the XP granted matches the flight card.
// null → flat BOOKING_CONFIRMED XP.
function flightStops(f) {
  if (!f) return null;
  for (const k of ["stops", "numberOfStops", "stopCount"]) {
    if (
      f[k] !== undefined &&
      f[k] !== null &&
      f[k] !== "" &&
      Number.isFinite(Number(f[k]))
    ) {
      return Number(f[k]);
    }
  }
  const segs = f.segments ?? f.outbound?.segments;
  return Array.isArray(segs) && segs.length ? segs.length - 1 : null;
}

/**
 * ONE call for every place that confirms a booking (Stripe webhook, flight
 * controller, hotel checkout, Sync Together, Atlas, admin):
 *
 *   await awardXpForBooking(booking._id).catch(console.error);
 *
 * Reads everything from the Booking record — never from the client. Grants
 * PENDING XP (unlocks when the trip starts), applies the plan multiplier, and
 * is safe to call more than once: the XP ledger pays each booking once.
 * Returns { booking, results } or null if the booking isn't confirmed.
 */
export async function awardXpForBooking(bookingId, { notify = true } = {}) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking || booking.status !== "confirmed") return null;
  const isFlight = booking.type === "Flight";
  const results = await awardBookingXp({
    userId: booking.user,
    bookingId: booking._id,
    startDate: bookingStartDate(booking),
    kind: isFlight ? "flight" : "hotel",
    stops: isFlight ? flightStops(booking.flight) : null,
  });

  // One notification with the real total — only when XP was actually granted
  // now (a repeat call for the same booking grants nothing and stays quiet).
  const total = ["booking", "first", "international"].reduce(
    (sum, k) => sum + (results[k]?.awarded ? results[k].amount : 0),
    0
  );
  if (notify && results.booking?.awarded && total > 0) {
    await Notification.create({
      user: booking.user,
      type: "xp",
      title: `🌟 +${total} XP on the way!`,
      message: `You earned ${total} XP for booking this trip. It unlocks once your trip starts — check your Passport to see it.`,
      link: "/passport",
    }).catch((e) =>
      console.error("[xp] booking XP notification failed:", e.message)
    );
  }
  return { booking, results, total };
}

/** Cancel route + Stripe charge.refunded + charge.dispute.created webhooks. */
export const reverseBookingXp = (bookingId, reason = "booking cancelled") =>
  reverseXp({ linkedTo: bookingId, reason });

/* ───────────────────────── SkyHub ───────────────────────── */

export async function awardPostXp({
  userId,
  postId,
  text = "",
  mediaCount = 0,
}) {
  if (text.trim().length < MIN_POST_TEXT_LENGTH && mediaCount < 1)
    return { awarded: false, reason: "too_short" };
  return awardXP({
    userId,
    ruleKey: "POST_CREATED",
    sourceType: "Post",
    sourceId: postId,
  });
}

/** Deleting a post takes back its post XP AND the like XP it collected. */
export const reversePostXp = (postId) =>
  reverseXp({ linkedTo: postId, reason: "post deleted" });

export async function awardCommentXp({
  userId,
  commentId,
  postAuthorId,
  text = "",
}) {
  if (String(userId) === String(postAuthorId))
    return { awarded: false, reason: "own_post" };
  if (text.trim().length < MIN_COMMENT_TEXT_LENGTH)
    return { awarded: false, reason: "too_short" };
  return awardXP({
    userId,
    ruleKey: "COMMENT_CREATED",
    sourceType: "Comment",
    sourceId: commentId,
  });
}

export const reverseCommentXp = (commentId) =>
  reverseXp({ linkedTo: commentId, reason: "comment deleted" });

export async function awardLikeReceivedXp({ postAuthorId, postId, likerId }) {
  if (String(postAuthorId) === String(likerId))
    return { awarded: false, reason: "self_like" };

  const liker = await User.findById(likerId).select("createdAt");
  if (!liker) return { awarded: false, reason: "no_liker" };
  const ageDays = (Date.now() - new Date(liker.createdAt).getTime()) / 864e5;
  if (ageDays < MIN_LIKER_ACCOUNT_AGE_DAYS)
    return { awarded: false, reason: "new_account" };

  // Per-post ceiling, counted from the ledger so it never expires (reversed likes still count).
  const rule = XP_RULES.POST_LIKED_RECEIVED;
  const paidLikes = await XpLedger.countDocuments({
    ruleKey: "POST_LIKED_RECEIVED",
    linkedTo: String(postId),
  });
  if ((paidLikes + 1) * rule.xp > rule.perPostCap)
    return { awarded: false, reason: "post_cap" };

  return awardXP({
    userId: postAuthorId,
    ruleKey: "POST_LIKED_RECEIVED",
    sourceType: "Post",
    sourceId: postId,
    actorId: likerId,
  });
}

/** Unlike → reverse that one like. Re-liking won't pay again (the ledger row remains). */
export const reverseLikeXp = ({ postId, likerId }) =>
  reverseXp({
    linkedTo: postId,
    ruleKey: "POST_LIKED_RECEIVED",
    actorId: likerId,
    reason: "unliked",
  });

/** One payout per shared item, ever. */
export const awardShareXp = ({ userId, sharedItemId }) =>
  awardXP({
    userId,
    ruleKey: "SHARE_SKYSTREAM",
    sourceType: "Share",
    sourceId: sharedItemId,
  });

/** Save → unsave → save the same trip pays once. */
export const awardSavedTripXp = ({ userId, tripId }) =>
  awardXP({
    userId,
    ruleKey: "SAVED_TRIP",
    sourceType: "Trip",
    sourceId: tripId,
  });

export const awardFeedbackXp = ({ userId, feedbackId }) =>
  awardXP({
    userId,
    ruleKey: "FEEDBACK_SUBMITTED",
    sourceType: "Feedback",
    sourceId: feedbackId,
  });

/** Call only after the SERVER has checked the profile fields are actually filled in. */
export const awardProfileCompletedXp = ({ userId }) =>
  awardXP({ userId, ruleKey: "PROFILE_COMPLETED", linkedTo: null });

/* ───────────────────────── passive activity ───────────────────────── */

// The frontend hook (useXPSystem) reports rule-style names; older callers may
// send the short names. Both map to the same three activity types here.
// STREAK_DAY → "session": streaks are handled inside the daily session, which
// can only be claimed once per day, so a repeat call just returns
// "already_counted_today".
const PASSIVE_TYPE_ALIASES = {
  DAILY_SESSION: "session",
  STREAK_DAY: "session",
  ACTIVE_INTERVAL: "active",
  PAGE_VISIT: "page",
};

/**
 * Backs POST /api/xp/activity. The client only REPORTS { type, path };
 * the server decides what counts. Returns a flat array of award results.
 *   type: "session" | "active" | "page"
 *         (or DAILY_SESSION | STREAK_DAY | ACTIVE_INTERVAL | PAGE_VISIT)
 */
export async function awardPassiveActivity({ userId, type, path }) {
  type = PASSIVE_TYPE_ALIASES[type] ?? type;
  const now = new Date();
  const day = dayKey(now);

  if (type === "session") return recordDailySession(userId, day);

  if (type === "active") {
    const { intervalMs } = XP_PASSIVE.ACTIVE_INTERVAL;
    // Must be at least ~5 real minutes since the last paid interval.
    const last = await XpLedger.findOne({
      user: userId,
      ruleKey: "ACTIVE_INTERVAL",
    })
      .sort({ createdAt: -1 })
      .select("createdAt");
    if (last && now - last.createdAt < intervalMs * 0.95)
      return [{ awarded: false, reason: "too_soon" }];
    const slot = Math.floor(now.getTime() / intervalMs);
    return [
      await awardXP({
        userId,
        ruleKey: "ACTIVE_INTERVAL",
        sourceId: `${day}:${slot}`,
        linkedTo: null,
      }),
    ];
  }

  if (type === "page") {
    const p = String(path || "")
      .split("?")[0]
      .replace(/\/+$/, "")
      .toLowerCase();
    if (!XP_PAGE_WHITELIST.includes(p))
      return [{ awarded: false, reason: "page_not_eligible" }];
    return [
      await awardXP({
        userId,
        ruleKey: "PAGE_VISIT",
        sourceId: `${day}:${p}`,
        linkedTo: null,
      }),
    ];
  }

  return [{ awarded: false, reason: "unknown_type" }];
}

/**
 * Daily visit + streaks. Uses the streak fields you already have
 * (user.xpDailyMeta.streak / lastStreakDate), so existing streaks carry over.
 */
async function recordDailySession(userId, day) {
  // Atomically claim "today" — parallel tabs/requests can only advance the streak once per day.
  const before = await User.findOneAndUpdate(
    { _id: userId, "xpDailyMeta.lastStreakDate": { $ne: day } },
    [
      {
        $set: {
          xpDailyMeta: {
            $mergeObjects: [
              { $ifNull: ["$xpDailyMeta", {}] },
              { lastStreakDate: day },
            ],
          },
        },
      },
    ],
    { new: false, projection: { xpDailyMeta: 1 } }
  );
  if (!before) return [{ awarded: false, reason: "already_counted_today" }];

  const yesterday = dayKey(new Date(Date.now() - 864e5));
  const prev = before.xpDailyMeta ?? {};
  const streak = prev.lastStreakDate === yesterday ? (prev.streak ?? 0) + 1 : 1;
  await User.updateOne({ _id: userId }, [
    {
      $set: {
        xpDailyMeta: {
          $mergeObjects: [{ $ifNull: ["$xpDailyMeta", {}] }, { streak }],
        },
      },
    },
  ]);

  const results = [
    await awardXP({
      userId,
      ruleKey: "DAILY_SESSION",
      sourceId: day,
      linkedTo: null,
    }),
  ];
  if (streak >= 2) {
    results.push(
      await awardXP({
        userId,
        ruleKey: "STREAK_DAY",
        sourceId: day,
        linkedTo: null,
      })
    );
  }
  if (streak % 30 === 0) {
    results.push(
      await awardXP({
        userId,
        ruleKey: "STREAK_MONTH",
        sourceId: day,
        linkedTo: null,
      })
    );
  } else if (streak % 7 === 0) {
    results.push(
      await awardXP({
        userId,
        ruleKey: "STREAK_WEEK",
        sourceId: day,
        linkedTo: null,
      })
    );
  }
  return results;
}
