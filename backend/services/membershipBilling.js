/**
 * services/membershipBilling.js
 * Stripe client + helpers that keep User.plan in sync with Stripe.
 */

import Stripe from "stripe";
import User from "../models/User.js";
import { MEMBERSHIP_PRICES, ENTITLED_STATUSES } from "../config/membership.js";

let client;
export function stripe() {
  if (!client) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

// ── Prices ────────────────────────────────────────────────────
const priceCache = new Map();

export async function getPriceId(lookupKey) {
  if (!MEMBERSHIP_PRICES[lookupKey]) throw new Error(`Unknown membership price: ${lookupKey}`);
  if (priceCache.has(lookupKey)) return priceCache.get(lookupKey);

  const { data } = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (!data.length) {
    throw new Error(
      `No active Stripe price with lookup key "${lookupKey}". Run: node scripts/createMembershipPrices.js`
    );
  }
  priceCache.set(lookupKey, data[0].id);
  return data[0].id;
}

// ── Customers ─────────────────────────────────────────────────
export async function ensureCustomer(user) {
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe().customers.retrieve(user.stripeCustomerId);
      if (!existing.deleted) return existing.id;
    } catch (err) {
      // Customer from the other mode (test vs live) or deleted — make a new one.
      if (err?.code !== "resource_missing") throw err;
    }
  }

  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name || user.username,
    metadata: { userId: user._id.toString() },
  });
  await User.updateOne({ _id: user._id }, { $set: { stripeCustomerId: customer.id } });
  user.stripeCustomerId = customer.id;
  return customer.id;
}

// ── Subscription → User sync ──────────────────────────────────
/**
 * Re-reads the subscription from Stripe (so out-of-order webhooks can't
 * leave stale data) and writes plan + subscription details to the user.
 * Accepts a subscription id or object.
 */
export async function syncSubscription(subOrId) {
  const subId = typeof subOrId === "string" ? subOrId : subOrId?.id;
  if (!subId) return null;

  const sub = await stripe().subscriptions.retrieve(subId);
  const item = sub.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key || null;
  const priceInfo = lookupKey ? MEMBERSHIP_PRICES[lookupKey] : null;
  if (!priceInfo) return null; // not a membership subscription — ignore

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const userId = sub.metadata?.userId;

  let user = userId ? await User.findById(userId) : null;
  if (!user && customerId) user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) {
    console.warn(`[billing] No user for subscription ${sub.id} (customer ${customerId})`);
    return null;
  }

  const entitled = ENTITLED_STATUSES.includes(sub.status);

  // If the user has a different, still-active subscription on file, don't let
  // an event about an old/ended one knock them down to free.
  const currentId = user.subscription?.id;
  if (currentId && currentId !== sub.id && !entitled && ENTITLED_STATUSES.includes(user.subscription?.status)) {
    return user;
  }

  // Newer Stripe API versions moved current_period_end onto the item.
  const periodEnd = sub.current_period_end ?? item?.current_period_end ?? null;

  const update = {
    plan: entitled ? priceInfo.plan : "free",
    stripeCustomerId: customerId,
    subscription: {
      id: sub.id,
      status: sub.status,
      priceLookupKey: lookupKey,
      interval: priceInfo.interval,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end || (!!sub.cancel_at && entitled),
      updatedAt: new Date(),
    },
  };

  await User.updateOne({ _id: user._id }, { $set: update });
  console.log(`[billing] ${user.username}: ${sub.status} → plan=${update.plan}`);
  return { ...user.toObject(), ...update };
}

export function publicBillingStatus(user) {
  const s = user?.subscription || {};
  return {
    plan: user?.plan || "free",
    subscription: s.id
      ? {
          status: s.status,
          interval: s.interval,
          currentPeriodEnd: s.currentPeriodEnd,
          cancelAtPeriodEnd: !!s.cancelAtPeriodEnd,
          entitled: ENTITLED_STATUSES.includes(s.status),
        }
      : null,
    hasBillingAccount: !!user?.stripeCustomerId,
  };
}
