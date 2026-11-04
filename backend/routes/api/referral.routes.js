// Refer a friend.
//
// How it works:
//   1. Every traveler's link is https://myskyrio.com/register?ref=<username>
//   2. The friend signs up through it → the friend gets a welcome bonus.
//   3. The friend completes their FIRST booking (still confirmed 3 days
//      later, so book-then-cancel doesn't count) → the referrer gets XP.
//   4. Friends who've booked unlock levels with bigger bonuses.
//
// The referrer is rewarded for bookings, not sign-ups, so fake accounts
// earn nothing. Every reward is recorded once (unique index), so nothing
// can be claimed twice.
//
//   POST /api/referral/complete  { newUserId, referredBy }   (sign-up, existing)
//   GET  /api/referral/me        (signed in) link, progress, friends
//
// Rewards for bookings are settled when the referrer opens their Passport
// (GET /me) and by startReferralJob() every 30 minutes.
import { Router } from "express";
import mongoose from "mongoose";
import User from "../../models/user.js";
import Booking from "../../models/booking.js";
import Notification from "../../models/notification.js";
import authRequired from "../../middleware/authRequired.js";

const router = Router();

const APP_URL = (process.env.FRONTEND_URL || "https://myskyrio.com").replace(
  /\/$/,
  ""
);

// ── Rewards ────────────────────────────────────────────────────
export const XP_NEW_USER = 50; // friend's welcome bonus at sign-up
export const XP_PER_BOOKED_FRIEND = 150; // referrer, per friend who books
// Levels by number of friends who've booked. Bonus XP on reaching each.
export const REFERRAL_LEVELS = [
  { at: 1, key: "connector", name: "Connector", bonus: 100 },
  { at: 3, key: "trailblazer", name: "Trailblazer", bonus: 250 },
  { at: 5, key: "ambassador", name: "Ambassador", bonus: 500 },
  { at: 10, key: "legend", name: "Skyrio Legend", bonus: 1000 },
];
const QUALIFY_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // booking still active after 3 days
const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000; // /complete only for new accounts
const BOOKED = ["confirmed", "completed"];

// One row per reward, so each can only ever be given once.
const ReferralRewardSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    kind: { type: String, enum: ["booked", "level"], required: true },
    level: String,
    xp: Number,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  },
  { timestamps: true }
);
ReferralRewardSchema.index(
  { referrer: 1, friend: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: "booked" } }
);
ReferralRewardSchema.index(
  { referrer: 1, level: 1 },
  { unique: true, partialFilterExpression: { kind: "level" } }
);
const ReferralReward =
  mongoose.models.ReferralReward ||
  mongoose.model("ReferralReward", ReferralRewardSchema);

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameUsername = (u) =>
  new RegExp(`^${escapeRe(String(u || "").trim())}$`, "i");
const firstName = (u) =>
  String(u?.name || u?.username || "Traveler")
    .trim()
    .split(/\s+/)[0];

async function notify(user, title, message) {
  const note = { user, type: "system", title, message, link: "/passport" };
  try {
    await Notification.create(note);
  } catch (err) {
    if (err?.name !== "ValidationError") return;
    try {
      await Notification.create({ ...note, type: "booking" });
    } catch {
      /* notifications are best-effort */
    }
  }
}

// ── POST /complete — after sign-up via ?ref= ───────────────────
// Kept for the existing register flow. Now safe to call more than once:
//   - only for accounts created in the last 24 hours
//   - only if the account doesn't already have a referrer
//   - you can't refer yourself
//   - the referrer is NOT paid here (that happens when the friend books)
router.post("/complete", async (req, res) => {
  try {
    const { newUserId, referredBy } = req.body || {};
    if (!newUserId || !referredBy || !mongoose.isValidObjectId(newUserId))
      return res
        .status(400)
        .json({ ok: false, message: "newUserId and referredBy required." });

    const referrer = await User.findOne({ username: sameUsername(referredBy) })
      .select("_id username")
      .lean();
    if (!referrer) return res.json({ ok: true, referrerFound: false });
    if (String(referrer._id) === String(newUserId))
      return res.json({ ok: true, referrerFound: true, self: true });

    // Atomic: only the first call for a brand-new account does anything.
    const friend = await User.findOneAndUpdate(
      {
        _id: newUserId,
        createdAt: { $gte: new Date(Date.now() - SIGNUP_WINDOW_MS) },
        $or: [
          { referredBy: { $exists: false } },
          { referredBy: null },
          { referredBy: "" },
        ],
      },
      {
        $set: { referredBy: referrer.username, referredByUser: referrer._id },
        $inc: { xp: XP_NEW_USER },
      },
      { new: true, strict: false }
    );
    if (!friend)
      return res.json({ ok: true, referrerFound: true, already: true });

    await User.updateOne(
      { _id: referrer._id },
      { $inc: { referralsCount: 1 } },
      { strict: false }
    );
    notify(
      referrer._id,
      `${firstName(friend)} joined Skyrio with your link`,
      `When they complete their first booking, you'll get +${XP_PER_BOOKED_FRIEND} XP.`
    );
    console.log(`[referral] ${referrer.username} → ${newUserId} signed up`);
    res.json({ ok: true, referrerFound: true, xpGranted: XP_NEW_USER });
  } catch (err) {
    console.error("[referral] complete error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Couldn't apply the referral." });
  }
});

// ── Settle rewards for one referrer ────────────────────────────
// Friends who signed up with their link and have a booking that's still
// active 3+ days after booking. Returns the friends list for the card.
export async function settleReferrals(referrerId) {
  const me = await User.findById(referrerId).select("_id username").lean();
  if (!me?.username) return { friends: [], booked: 0 };

  const friends = await User.find({
    $or: [
      { referredByUser: me._id },
      { referredBy: sameUsername(me.username) },
    ],
    _id: { $ne: me._id },
  })
    .select("_id name username createdAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  if (!friends.length) return { friends: [], booked: 0 };

  const cutoff = new Date(Date.now() - QUALIFY_AFTER_MS);
  const bookings = await Booking.find({
    user: { $in: friends.map((f) => f._id) },
    status: { $in: BOOKED },
    createdAt: { $lte: cutoff },
  })
    .select("_id user")
    .sort({ createdAt: 1 })
    .lean();
  const firstBooking = new Map();
  for (const b of bookings)
    if (!firstBooking.has(String(b.user)))
      firstBooking.set(String(b.user), b._id);

  // Friends with a booking made in the last 3 days (shown as "booked,
  // confirming").
  const recent = await Booking.distinct("user", {
    user: { $in: friends.map((f) => f._id) },
    status: { $in: BOOKED },
    createdAt: { $gt: cutoff },
  });
  const recentSet = new Set(recent.map(String));

  // Reward each newly qualified friend once.
  for (const [uid, bookingId] of firstBooking) {
    try {
      await ReferralReward.create({
        referrer: me._id,
        friend: uid,
        kind: "booked",
        xp: XP_PER_BOOKED_FRIEND,
        booking: bookingId,
      });
      await User.updateOne(
        { _id: me._id },
        { $inc: { xp: XP_PER_BOOKED_FRIEND } },
        { strict: false }
      );
      const f = friends.find((x) => String(x._id) === uid);
      notify(
        me._id,
        `+${XP_PER_BOOKED_FRIEND} XP: ${firstName(f)} booked their first trip`,
        "Thanks for bringing a friend to Skyrio."
      );
    } catch (err) {
      if (err?.code !== 11000)
        console.warn("[referral] reward failed:", err?.message);
    }
  }

  // Level bonuses.
  const booked = firstBooking.size;
  for (const lvl of REFERRAL_LEVELS) {
    if (booked < lvl.at) break;
    try {
      await ReferralReward.create({
        referrer: me._id,
        kind: "level",
        level: lvl.key,
        xp: lvl.bonus,
      });
      await User.updateOne(
        { _id: me._id },
        { $inc: { xp: lvl.bonus } },
        { strict: false }
      );
      notify(
        me._id,
        `You reached ${lvl.name}! +${lvl.bonus} XP`,
        `${lvl.at} ${
          lvl.at === 1 ? "friend has" : "friends have"
        } booked with Skyrio through you.`
      );
    } catch (err) {
      if (err?.code !== 11000)
        console.warn("[referral] level failed:", err?.message);
    }
  }

  return {
    booked,
    friends: friends.map((f) => ({
      name: firstName(f),
      joinedAt: f.createdAt,
      status: firstBooking.has(String(f._id))
        ? "booked"
        : recentSet.has(String(f._id))
        ? "confirming"
        : "joined",
    })),
  };
}

// ── GET /me — the "Refer a friend" card ────────────────────────
router.get("/me", authRequired, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("username").lean();
    if (!me) return res.status(404).json({ ok: false, message: "Not found." });
    const { friends, booked } = await settleReferrals(me._id);
    const earned = await ReferralReward.aggregate([
      { $match: { referrer: me._id } },
      { $group: { _id: null, xp: { $sum: "$xp" } } },
    ]);
    const current =
      [...REFERRAL_LEVELS].reverse().find((l) => booked >= l.at) || null;
    const next = REFERRAL_LEVELS.find((l) => booked < l.at) || null;
    res.json({
      ok: true,
      link: me.username
        ? `${APP_URL}/register?ref=${encodeURIComponent(me.username)}`
        : null,
      joined: friends.length,
      booked,
      xpEarned: earned[0]?.xp || 0,
      level: current && { key: current.key, name: current.name },
      next: next && {
        key: next.key,
        name: next.name,
        at: next.at,
        bonus: next.bonus,
        remaining: next.at - booked,
      },
      levels: REFERRAL_LEVELS,
      rewards: {
        friendWelcome: XP_NEW_USER,
        perBookedFriend: XP_PER_BOOKED_FRIEND,
      },
      friends: friends.slice(0, 10),
    });
  } catch (err) {
    console.error("[referral] me error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Couldn't load your referrals." });
  }
});

// ── Background settle (every 30 min) ───────────────────────────
// Rewards referrers even if they don't open their Passport.
export function startReferralJob() {
  const run = async () => {
    try {
      const referrers = await User.distinct("referredByUser", {
        referredByUser: { $ne: null },
      });
      for (const id of referrers) await settleReferrals(id);
    } catch (err) {
      console.warn("[referral job]", err?.message);
    }
  };
  setTimeout(run, 60 * 1000).unref?.();
  setInterval(run, 30 * 60 * 1000).unref?.();
}

export default router;
