/**
 * routes/billing.routes.js
 * Mount at /api/billing (normal JSON routes, after express.json()).
 *
 *   POST /api/billing/checkout-session  { plan, billing } → { url }
 *   POST /api/billing/portal-session                    → { url }
 *   GET  /api/billing/status[?session_id=cs_...]        → { plan, subscription, hasBillingAccount }
 */

import express from "express";
// ⚠️ ADJUST this import to your real auth middleware (must set req.user).
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../models/user.js";
import {
  PAID_PLANS,
  BILLING_INTERVALS,
  ENTITLED_STATUSES,
  lookupKeyFor,
} from "../config/membership.js";
import {
  stripe,
  getPriceId,
  ensureCustomer,
  syncSubscription,
  publicBillingStatus,
} from "../services/membershipBilling.js";

const router = express.Router();

// Where Stripe should send the browser back to (localhost:5273 in dev, myskyrio.com in prod).
function frontendOrigin(req) {
  const allowed = [process.env.FRONTEND_URL, ...(process.env.FRONTEND_ORIGIN || "").split(",")]
    .map((s) => (s || "").trim().replace(/\/$/, ""))
    .filter(Boolean);
  const origin = (req.headers.origin || "").replace(/\/$/, "");
  if (origin && (allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin))) return origin;
  return allowed[0] || "http://localhost:5273";
}

const userId = (req) => (req.user?._id || req.user?.id).toString();

// ── Start checkout ────────────────────────────────────────────
router.post("/checkout-session", requireAuth, async (req, res) => {
  try {
    const plan = String(req.body?.plan || "").toLowerCase();
    const billing = String(req.body?.billing || "").toLowerCase();
    if (!PAID_PLANS.includes(plan) || !BILLING_INTERVALS.includes(billing)) {
      return res.status(400).json({ error: "invalid_plan", message: "Pick Explorer or Legend, monthly or annual." });
    }

    const user = await User.findById(userId(req));
    if (!user) return res.status(404).json({ error: "user_not_found" });

    // One membership per account — plan changes go through the billing portal
    // so Stripe prorates instead of double-charging.
    if (user.subscription?.id && ENTITLED_STATUSES.includes(user.subscription.status)) {
      return res.status(409).json({
        error: "already_subscribed",
        message: "You already have a membership. Use Manage billing to switch plans.",
      });
    }

    const customer = await ensureCustomer(user);
    const price = await getPriceId(lookupKeyFor(plan, billing));
    const origin = frontendOrigin(req);

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user._id.toString(),
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { userId: user._id.toString(), plan, billing } },
      metadata: { userId: user._id.toString(), plan, billing },
      allow_promotion_codes: true,
      success_url: `${origin}/membership?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upgrade?plan=${plan}&billing=${billing}&checkout=canceled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[billing] checkout-session failed:", err);
    res.status(500).json({ error: "checkout_failed", message: "Couldn't start checkout. Please try again." });
  }
});

// ── Manage billing (cancel, switch plan, update card, invoices) ──
router.post("/portal-session", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(userId(req));
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "no_billing_account", message: "You don't have a paid membership yet." });
    }
    const portal = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendOrigin(req)}/membership`,
    });
    res.json({ url: portal.url });
  } catch (err) {
    console.error("[billing] portal-session failed:", err);
    res.status(500).json({ error: "portal_failed", message: "Couldn't open billing. Please try again." });
  }
});

// ── Current status (+ instant sync after checkout success) ─────
router.get("/status", requireAuth, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (typeof sessionId === "string" && sessionId.startsWith("cs_")) {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      // Only sync a session that belongs to this user.
      if (session.client_reference_id === userId(req) && session.mode === "subscription" && session.subscription) {
        await syncSubscription(session.subscription);
      }
    }
    const user = await User.findById(userId(req)).lean();
    res.json(publicBillingStatus(user));
  } catch (err) {
    console.error("[billing] status failed:", err);
    res.status(500).json({ error: "status_failed" });
  }
});

export default router;
