/**
 * routes/billingWebhook.js
 * Stripe webhook for memberships. Needs the RAW body, so mount it in your
 * server file BEFORE app.use(express.json()):
 *
 *   import billingWebhook from "./routes/billingWebhook.js";
 *   app.use("/api/billing/webhook", billingWebhook);
 *   app.use(express.json());
 */

import express from "express";
import { stripe, syncSubscription } from "../services/membershipBilling.js";

const router = express.Router();

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_BILLING_WEBHOOK_SECRET
    );
  } catch (err) {
    console.warn("[billing webhook] bad signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;

    if (event.type === "checkout.session.completed") {
      if (obj.mode === "subscription" && obj.subscription) await syncSubscription(obj.subscription);
    } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
      await syncSubscription(obj.id);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      // Older API versions: invoice.subscription; newer: invoice.parent.subscription_details.subscription
      const subId = obj.subscription || obj.parent?.subscription_details?.subscription;
      if (subId) await syncSubscription(subId);
    }

    res.json({ received: true });
  } catch (err) {
    // 500 → Stripe retries the event later.
    console.error(`[billing webhook] ${event.type} failed:`, err);
    res.status(500).json({ error: "sync_failed" });
  }
});

export default router;
