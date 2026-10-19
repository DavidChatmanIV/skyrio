// backend/controllers/passportRedeemController.js
// Route:  router.post("/passport/rewards/:rewardId/redeem", requireAuth, redeemReward);
// Redeeming only lowers xpBalance — rank (lifetimeXp) is never touched.
import User from "../models/User.js";
import Reward from "../models/Reward.js"; // ← change to your Rewards Catalog model path
import XpTransaction from "../models/XpTransaction.js";
import { getRank } from "../utils/passportRanks.js";

export async function redeemReward(req, res) {
  try {
    const reward = await Reward.findById(req.params.rewardId);
    if (!reward || reward.active === false) {
      return res.status(404).json({ error: "This reward isn't available right now." });
    }

    // Atomic: only succeeds if the balance covers the cost (no double-click overspend)
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, "passport.xpBalance": { $gte: reward.cost } },
      { $inc: { "passport.xpBalance": -reward.cost } },
      { new: true }
    );
    if (!user) return res.status(400).json({ error: "Not enough XP to redeem this reward." });

    await XpTransaction.create({
      user: user._id,
      amount: -reward.cost,
      kind: "spend",
      reason: `redeem:${reward.slug || reward._id}`,
      refId: reward._id,
    });

    const rank = getRank(user.passport.lifetimeXp);
    return res.json({
      ok: true,
      xpBalance: user.passport.xpBalance,
      lifetimeXp: user.passport.lifetimeXp,
      rank: { key: rank.key, name: rank.name, xpToNext: rank.xpToNext, progress: rank.progress },
    });
  } catch (err) {
    console.error("[redeemReward]", err);
    return res.status(500).json({ error: "Redemption failed. Your XP was not charged." });
  }
}
