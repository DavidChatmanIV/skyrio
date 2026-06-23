// backend/routes/rewards.js
//
// Redeem Passport Rewards (XP store). Mounts at /api/rewards.
//
// ⚠️ THE TWO IMPORTS BELOW ARE BEST-GUESS PLACEHOLDERS. Check how your other
// protected routes (e.g. whatever handles /api/user/delete or
// /api/profile/update) import the User model and the auth middleware, and
// swap these two lines to match exactly:
const express = require("express");
const router = express.Router();
const User = require("../models/User"); // TODO: confirm this path/name
const { requireAuth } = require("../middleware/auth"); // TODO: confirm this path/name

// ─────────────────────────────────────────────────────────────────────────
// Server-side source of truth for reward costs + repeatability.
//
// SECURITY: never trust a `cost` sent from the client request body — always
// look it up here. Otherwise anyone could open devtools, rewrite the
// network request, and redeem a 1200-XP item by claiming it costs 1 XP.
//
// ⚠️ Keep this in sync with DEFAULT_ITEMS in PassportRewards.jsx. This
// duplication is a known shortcut for now — the real fix later is a
// `Reward` Mongo collection that both sides read from, so there's a single
// source of truth. Not worth building until the catalog itself is final.
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
// frontend can correctly show "Redeemed" instead of "Redeem" after a refresh
// — without this, a one-time item would *look* redeemable again on reload
// even though the backend would (correctly) reject a second redeem of it.
router.get("/redeemed", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select("redeemedRewards");
    return res.json({
      ok: true,
      redeemedRewards: user?.redeemedRewards || [],
    });
  } catch (err) {
    console.error("Fetch redeemed rewards error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load redemption history." });
  }
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

    const userId = req.user._id || req.user.id;

    // Atomic find+update. The `xp: { $gte: reward.cost }` filter is what
    // prevents double-spending: if two redeem requests race (e.g. two open
    // tabs hitting Redeem at the same instant), only the FIRST one to reach
    // Mongo can match — by the time the second request's filter is
    // evaluated, the first one's $inc has already landed, so if the user
    // can't afford both, the second one correctly fails. A naive
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
      // Same atomic operation also guards against redeeming a one-time item
      // twice — no separate read-then-write race window here either.
      filter.redeemedRewards = { $ne: itemId };
      update.$push = { redeemedRewards: itemId };
    }

    const updatedUser = await User.findOneAndUpdate(filter, update, {
      new: true,
    }).select("xp redeemedRewards");

    if (!updatedUser) {
      // The atomic update matched nothing — look up why, purely so the
      // error message is accurate. This second read doesn't affect
      // correctness; the write above already failed safe either way.
      const fresh = await User.findById(userId).select("xp redeemedRewards");
      if (!reward.repeatable && fresh?.redeemedRewards?.includes(itemId)) {
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

module.exports = router;
