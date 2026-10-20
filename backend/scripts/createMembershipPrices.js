/**
 * scripts/createMembershipPrices.js
 * Creates the Explorer + Legend products and their 4 prices in Stripe.
 * Safe to run more than once — anything that already exists is skipped.
 *
 *   node scripts/createMembershipPrices.js          (test mode key only)
 *   node scripts/createMembershipPrices.js --live   (when you go live)
 */

import "dotenv/config";
import Stripe from "stripe";
import { MEMBERSHIP_PRICES, PLAN_PRODUCTS } from "../config/membership.js";

const key = process.env.STRIPE_SECRET_KEY || "";
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}
if (!key.startsWith("sk_test_") && !process.argv.includes("--live")) {
  console.error("This is a LIVE key. Re-run with --live if you really mean it.");
  process.exit(1);
}

const stripe = new Stripe(key);

async function findOrCreateProduct(plan) {
  const { data } = await stripe.products.list({ limit: 100 });
  const found = data.find((p) => p.metadata?.skyrio_plan === plan);
  if (found) {
    if (!found.active) await stripe.products.update(found.id, { active: true });
    console.log(`✓ Product exists: ${found.name} (${found.id})`);
    return found.id;
  }
  const created = await stripe.products.create({ ...PLAN_PRODUCTS[plan], metadata: { skyrio_plan: plan } });
  console.log(`+ Created product: ${created.name} (${created.id})`);
  return created.id;
}

const productIds = {};
for (const plan of Object.keys(PLAN_PRODUCTS)) productIds[plan] = await findOrCreateProduct(plan);

for (const [lookupKey, info] of Object.entries(MEMBERSHIP_PRICES)) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (data.length) {
    console.log(`✓ Price exists: ${lookupKey} (${data[0].id})`);
    continue;
  }
  const price = await stripe.prices.create({
    product: productIds[info.plan],
    currency: "usd",
    unit_amount: info.amount,
    recurring: { interval: info.stripeInterval },
    lookup_key: lookupKey,
    nickname: `${PLAN_PRODUCTS[info.plan].name} ${info.interval}`,
  });
  console.log(`+ Created price: ${lookupKey} $${(info.amount / 100).toFixed(2)}/${info.stripeInterval} (${price.id})`);
}

console.log("\nDone. Skyrio finds these by lookup key — nothing to paste into .env.");
