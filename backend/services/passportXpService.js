// backend/services/xpService.js
// lifetimeXp = rank (only goes up). xpBalance = spendable wallet.
import User from "../models/User.js";
import XpTransaction from "../models/XpTransaction.js";
import { getRank } from "../utils/passportRanks.js";

export async function grantXp(userId, amount, reason, refId) {
  if (!amount || amount <= 0) throw new Error("grantXp amount must be positive");

  // Ledger first — the unique index blocks granting twice for the same booking/challenge
  try {
    await XpTransaction.create({ user: userId, amount, kind: "earn", reason, refId });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { "passport.lifetimeXp": amount, "passport.xpBalance": amount } },
    { new: true }
  );

  const rank = getRank(user.passport.lifetimeXp);
  const rankedUp = rank.key !== user.passport.rankKey;
  if (rankedUp) await User.updateOne({ _id: userId }, { "passport.rankKey": rank.key });

  // Frontend shows the "NEW RANK UNLOCKED" modal only when rankedUp === true
  return { user, rank, rankedUp };
}

// Call when a booking is cancelled/refunded — removes the XP it earned.
export async function reverseXp(userId, refId) {
  const tx = await XpTransaction.findOne({ user: userId, refId, kind: "earn", reversed: false });
  if (!tx) return null;

  await User.updateOne({ _id: userId }, [
    { $set: {
        "passport.lifetimeXp": { $max: [0, { $subtract: ["$passport.lifetimeXp", tx.amount] }] },
        "passport.xpBalance":  { $max: [0, { $subtract: ["$passport.xpBalance",  tx.amount] }] },
    } },
  ]);
  tx.reversed = true;
  await tx.save();

  const user = await User.findById(userId, "passport");
  const rank = getRank(user.passport.lifetimeXp);
  await User.updateOne({ _id: userId }, { "passport.rankKey": rank.key });
  return { user, rank };
}
