// Feedback and reviews from people WITHOUT an account (guests).
//
//   POST /api/feedback       { type, message, rating, page, guestName, guestEmail, website }
//   POST /api/testimonials   { rating, text, displayName, city, consent, guestEmail, website }
//
// Signed-in requests (an "Authorization: Bearer …" header) skip this file
// and go on to the existing feedback routes exactly as before, so XP and
// everything else for account holders is unchanged.
//
// Guests:
//   - no XP (there's no account to give it to)
//   - reviews need a name and an email (email is never shown; it's for
//     confirming the review is real and for the admin "thank you")
//   - one general review per email
//   - "website" is a hidden field people never see; bots fill it in, so
//     anything with it is quietly accepted and thrown away
//   - limited to a few submissions per hour per IP and per email
//
// Mounted in server.js BEFORE the main API router:
//   import guestFeedbackRoutes from "./routes/guestFeedback.routes.js";
//   app.use("/api", guestFeedbackRoutes);
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

// Registered at startup by the feedback model file, looked up by name.
const M = (name) => mongoose.models[name] || mongoose.model(name);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FEEDBACK_TYPES = ["bug", "idea", "general"];
const MIN_REVIEW_CHARS = 20;

// Signed in = a real bearer token was sent. Those go to the normal routes.
function isSignedInRequest(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return !!(m && m[1] && !["null", "undefined", ""].includes(m[1].trim()));
}

// Small in-memory limiter: N per hour per key. Resets on restart, which is
// fine for spam protection.
const HOUR = 60 * 60 * 1000;
const hits = new Map();
function tooMany(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < HOUR);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) {
    const fresh = list.filter((t) => now - t < HOUR);
    if (fresh.length) hits.set(k, fresh);
    else hits.delete(k);
  }
}, HOUR).unref?.();

const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
const ipOf = (req) => req.ip || req.headers["x-forwarded-for"] || "unknown";

/* ── Guest feedback ──────────────────────────────────────────── */
router.post("/feedback", async (req, res, next) => {
  if (isSignedInRequest(req)) return next();
  try {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true, xpAwarded: 0 }); // bot

    const message = clean(b.message, 4000);
    const rating = Number(b.rating);
    if (!message && !(rating >= 1 && rating <= 5)) {
      return res
        .status(400)
        .json({ ok: false, message: "Please enter some feedback first." });
    }
    const guestEmail = clean(b.guestEmail, 200).toLowerCase();
    if (guestEmail && !EMAIL_RE.test(guestEmail)) {
      return res.status(400).json({
        ok: false,
        message: "That email doesn't look right. Fix it or leave it empty.",
      });
    }
    if (
      tooMany(`fb:ip:${ipOf(req)}`, 10) ||
      (guestEmail && tooMany(`fb:email:${guestEmail}`, 10))
    ) {
      return res.status(429).json({
        ok: false,
        message: "Thanks, we've got lots from you already. Try again later.",
      });
    }

    await M("Feedback").create({
      type: FEEDBACK_TYPES.includes(b.type) ? b.type : "general",
      message,
      ...(rating >= 1 && rating <= 5 ? { rating: Math.round(rating) } : {}),
      page: clean(b.page, 200) || undefined,
      guestName: clean(b.guestName, 40) || undefined,
      guestEmail: guestEmail || undefined,
      status: "new",
    });
    res.json({
      ok: true,
      xpAwarded: 0,
      xpNote: "Create a free account to earn XP for feedback.",
    });
  } catch (err) {
    console.error("[guest feedback] failed:", err?.message);
    res
      .status(500)
      .json({ ok: false, message: "We couldn't send that. Please try again." });
  }
});

/* ── Guest review (testimonial) ──────────────────────────────── */
router.post("/testimonials", async (req, res, next) => {
  if (isSignedInRequest(req)) return next();
  try {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true, xpAwarded: 0 }); // bot

    const rating = Math.round(Number(b.rating));
    const text = clean(b.text, 1000);
    const displayName = clean(b.displayName, 40);
    const city = clean(b.city, 60);
    const guestEmail = clean(b.guestEmail, 200).toLowerCase();

    if (!(rating >= 1 && rating <= 5))
      return res
        .status(400)
        .json({ ok: false, message: "Pick a star rating." });
    if (text.length < MIN_REVIEW_CHARS)
      return res.status(400).json({
        ok: false,
        message: `Write at least ${MIN_REVIEW_CHARS} characters.`,
      });
    if (!displayName)
      return res.status(400).json({
        ok: false,
        message: "Add your name so other travelers know who wrote it.",
      });
    if (!EMAIL_RE.test(guestEmail))
      return res.status(400).json({
        ok: false,
        message:
          "Add your email. It's never shown; we only use it to confirm your review is real.",
      });
    if (
      tooMany(`rv:ip:${ipOf(req)}`, 5) ||
      tooMany(`rv:email:${guestEmail}`, 5)
    ) {
      return res.status(429).json({
        ok: false,
        message: "Too many tries. Please try again in an hour.",
      });
    }

    const Testimonial = M("Testimonial");
    // One general review per email (account holders: one per account).
    const already = await Testimonial.exists({
      guestEmail,
      booking: { $in: [null, undefined] },
    });
    if (already) {
      return res
        .status(409)
        .json({ ok: false, message: "You've already left a review. Thanks!" });
    }

    await Testimonial.create({
      guestEmail,
      displayName,
      city: city || undefined,
      rating,
      text,
      consent: b.consent !== false,
      status: "pending", // checked in the admin dashboard before it shows
    });
    res.json({ ok: true, xpAwarded: 0 });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ ok: false, message: "You've already left a review. Thanks!" });
    }
    if (err?.name === "ValidationError") {
      // Usually: the Testimonial model still requires an account.
      console.error(
        "[guest review] model rejected it (deploy the updated feedback model?):",
        err.message
      );
    } else {
      console.error("[guest review] failed:", err?.message);
    }
    res
      .status(500)
      .json({ ok: false, message: "We couldn't post that. Please try again." });
  }
});

export default router;
