// GET /api/stripe-config → { ok, publishableKey }
// Gives the frontend Skyrio's Stripe PUBLISHABLE key at runtime (hotels +
// shared rooms), so the live site works even if the Vercel build has no key.
// Publishable keys (pk_…) are meant to be public — never put sk_… here.
import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  const key = String(
    process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || ""
  )
    .trim()
    .replace(/^["']|["']$/g, "");
  res.set("Cache-Control", "no-store");
  if (!key.startsWith("pk_")) {
    return res.status(503).json({
      ok: false,
      error: "Stripe publishable key isn't set on the server.",
    });
  }
  return res.json({ ok: true, publishableKey: key });
});

export default router;
