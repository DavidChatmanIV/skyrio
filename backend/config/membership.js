/**
 * config/membership.js
 * Single source of truth for Skyrio membership prices.
 * Stripe prices are found by lookup_key, so no price IDs live in .env.
 * Create them once with: node scripts/createMembershipPrices.js
 */

export const PAID_PLANS = ["explorer", "legend"];
export const BILLING_INTERVALS = ["monthly", "annual"];

// Subscription statuses that keep paid access.
// past_due = Stripe is still retrying a failed card, so access stays on until
// Stripe gives up and the subscription moves to canceled/unpaid.
export const ENTITLED_STATUSES = ["active", "trialing", "past_due"];

export const lookupKeyFor = (plan, interval) => `skyrio_${plan}_${interval}`;

export const MEMBERSHIP_PRICES = {
  skyrio_explorer_monthly: { plan: "explorer", interval: "monthly", amount: 700, stripeInterval: "month" },
  skyrio_explorer_annual: { plan: "explorer", interval: "annual", amount: 5500, stripeInterval: "year" },
  skyrio_legend_monthly: { plan: "legend", interval: "monthly", amount: 1500, stripeInterval: "month" },
  skyrio_legend_annual: { plan: "legend", interval: "annual", amount: 14400, stripeInterval: "year" },
};

export const PLAN_PRODUCTS = {
  explorer: { name: "Skyrio Explorer", description: "Skyrio Explorer membership" },
  legend: { name: "Skyrio Legend", description: "Skyrio Legend membership" },
};
