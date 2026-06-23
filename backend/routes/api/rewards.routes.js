import { Router } from "express";
import User from "../../models/user.js";
import { requireAuth } from "../../middleware/requireAuth.js";
// ✅ Confirmed against the real requireAuth.js: req.user is the FULL
// Mongoose document (requireAuth does `User.findById(userId)` before
// calling next()), not a decoded JWT payload. That means req.user.xp and
// req.user.redeemedRewards are already loaded — no need for an extra DB
// read just to look at them (see GET /redeemed below).
//
// Important: that does NOT mean it's safe to mutate req.user and call
// .save() for the actual redeem write. req.user is a snapshot taken at the
// start of THIS request — if two tabs hit Redeem at the same instant, both
// snapshots would show the same xp, both could pass a "can afford it" check
// in JS, and both would then save(), double-spending. The atomic
// findOneAndUpdate below (with xp: { $gte: cost } in the filter) is what
// actually prevents that, so it stays even though req.user already has
// the data.

const router = Router();

// ─────────────────────────────────────────────────────────────────────────
// Server-side source of truth for reward costs + repeatability.
//
// SECURITY: never trust a `cost` sent from the client request body — always
// look it up here. Otherwise anyone could open devtools, rewrite the
// network request, and redeem a 1200-XP item by claiming it costs 1 XP.
//
// ⚠️ Keep this in sync with DEFAULT_ITEMS in PassportRewards.jsx.
//
// ⚠️ "globetrotter" here is a purchasable badge item, but your User model's
// XP_LEVELS also has a tier literally called "Globetrotter" (reached
// automatically at 1000 XP). Worth renaming one of these to avoid confusing
// users who'll otherwise think they already have this.
// ─────────────────────────────────────────────────────────────────────────
const REWARDS_CATALOG = {
  weekend_xp: {
    cost: 250,
    repeatable: true,
    title: "Weekend XP Multiplier",
  },
  review_streak: {
    cost: 180,
    repeatable: false,
    title: "Review Streak (+1.5x)",
  },
  globetrotter: {
    cost: 400,
    repeatable: false,
    title: "Globetrotter",
  },
  priority_support: {
    cost: 150,
    repeatable: true,
    title: "Priority Support Week",
  },
  wc_jacket: {
    cost: 1200,
    repeatable: false,
    title: "Skyrio World Cup Jacket — Numbered Drop",
  },
};

// GET /api/rewards/redeemed
// Returns which one-time items this user has already redeemed, so the
// frontend can correctly show "Redeemed" instead of "Redeem" after a
// refresh — without this, a one-time item would look redeemable again on
// reload even though the POST route below would (correctly) reject a
// second redeem of it.
router.get("/redeemed", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    redeemedRewards: req.user.redeemedRewards || [],
  });
});

// POST /api/rewards/redeem
// Body: { itemId: string }
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ ok: false, message: "Missing itemId." });
    }

    const reward = REWARDS_CATALOG[itemId];
    if (!reward) {
      return res
        .status(400)
        .json({ ok: false, message: "Unknown reward item." });
    }

    const userId = req.user._id;

    // Atomic find+update. The `xp: { $gte: reward.cost }` filter is what
    // prevents double-spending: if two redeem requests race (e.g. two open
    // tabs hitting Redeem at the same instant), only the FIRST one to reach
    // Mongo can match — by the time the second request's filter is
    // evaluated, the first one's $inc has already landed. A naive
    // "read xp, check in JS, then write" approach has a race window between
    // the read and the write; this single atomic operation does not.
    const filter = {
      _id: userId,
      xp: { $gte: reward.cost },
    };
    const update = {
      $inc: { xp: -reward.cost },
    };

    if (!reward.repeatable) {
      // Same atomic operation also guards against redeeming a one-time
      // item twice — no separate read-then-write race window here either.
      filter.redeemedRewards = { $ne: itemId };
      update.$push = { redeemedRewards: itemId };
    }

    const updatedUser = await User.findOneAndUpdate(filter, update, {
      new: true,
    }).select("xp redeemedRewards");

    if (!updatedUser) {
      // The atomic update matched nothing — figure out why, purely for an
      // accurate error message. req.user reflects state from the start of
      // this same request, which is fresh enough for picking a message
      // (the actual security-critical decision was already made correctly
      // by the atomic write above, regardless of what we say here).
      if (!reward.repeatable && req.user.redeemedRewards?.includes(itemId)) {
        return res
          .status(409)
          .json({ ok: false, message: "You've already redeemed this." });
      }
      return res.status(400).json({ ok: false, message: "Not enough XP." });
    }

    return res.json({
      ok: true,
      item: { id: itemId, title: reward.title, cost: reward.cost },
      newBalance: updatedUser.xp,
    });
  } catch (err) {
    console.error("Reward redeem error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Something went wrong. Please try again." });
  }
});

export default router;
