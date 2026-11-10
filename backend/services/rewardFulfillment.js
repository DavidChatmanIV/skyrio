// services/rewardFulfillment.js
//
// What happens after XP is spent on a reward. Most rewards are "owned"
// once their itemId is in user.redeemedRewards (the Passport cover, the
// SkyHub frame), so they need nothing here. Membership rewards add a
// credit to the traveler's Stripe customer balance:
//
//   explorer_month   → 1 × the Explorer monthly price
//   legend_3_months  → 3 × the Legend monthly price
//
// Why a balance credit, not a promo code: Stripe applies the credit to the
// next membership invoices automatically (at checkout for a new member, or
// at renewal for someone already paying), it can't be shared or typed into
// an annual checkout, and it can't be cashed out. It only covers Skyrio
// membership bills.
//
// Throwing here makes the redeem route give the XP back, so a traveler is
// never charged XP for a reward they didn't get.

import { lookupKeyFor } from "../config/membership.js";
import {
  stripe,
  getPriceId,
  ensureCustomer,
} from "../services/membershipBilling.js";

const MEMBERSHIP_CREDITS = {
  explorer_month: { plan: "explorer", months: 1, label: "Explorer" },
  legend_3_months: { plan: "legend", months: 3, label: "Legend" },
};

const money = (cents, cur = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur.toUpperCase(),
  }).format(cents / 100);

/**
 * Deliver a reward. Returns { howToUse } (shown to the traveler after
 * redeeming), or throws if it couldn't be delivered.
 */
export async function fulfillReward({ user, itemId }) {
  const credit = MEMBERSHIP_CREDITS[itemId];
  if (!credit) return { howToUse: null }; // owned via redeemedRewards

  const priceId = await getPriceId(lookupKeyFor(credit.plan, "monthly"));
  const price = await stripe().prices.retrieve(priceId);
  if (!price?.unit_amount) throw new Error("price has no amount");
  const amount = price.unit_amount * credit.months;
  const currency = price.currency || "usd";

  const customer = await ensureCustomer(user);
  await stripe().customers.createBalanceTransaction(
    customer,
    {
      amount: -amount, // negative = credit the customer can spend
      currency,
      description: `Passport Reward: ${credit.months} month${
        credit.months === 1 ? "" : "s"
      } of ${credit.label}`,
      metadata: { userId: String(user._id), rewardItemId: itemId },
    },
    // One-time rewards: a retried request can never add the credit twice.
    { idempotencyKey: `reward-${user._id}-${itemId}` }
  );

  const months = `${credit.months} month${credit.months === 1 ? "" : "s"}`;
  return {
    howToUse: `${money(
      amount,
      currency
    )} membership credit added. That's ${months} of ${
      credit.label
    }. It comes off your next membership bills automatically. Not a member yet? Join ${
      credit.label
    } monthly and it covers you.`,
  };
}
