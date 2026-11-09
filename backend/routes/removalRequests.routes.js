// backend/routes/removalRequests.routes.js
// Formal removal requests for SkyHub content (the /skyhub/report-content page).
//
//   POST /api/skyhub/removal-requests
//     { kind, urls, fullName, email, onBehalf, workDescription, originalUrl,
//       details, goodFaith, accurate, perjury, website }
//
// kind: "intimate"  — intimate image shared without consent (48-hour removal)
//       "copyright" — DMCA notice
//       "privacy"   — private info (address, phone, documents)
//       "other"
//
// Each request is:
//   1. saved to Feedback (so it shows in the admin dashboard), and
//   2. emailed to SUPPORT_EMAIL right away ([URGENT 48h] for intimate images),
//   3. confirmed to the requester by email (their copy / record).
//
// Works without an account. "website" is a hidden field only bots fill in.
//
// Mount in server.js BEFORE apiRouter:
//   import removalRequestsRoutes from "./routes/removalRequests.routes.js";
//   app.use("/api/skyhub/removal-requests", removalRequestsRoutes);
import { Router } from "express";
import mongoose from "mongoose";
import {
  renderEmail,
  sendEmail,
  noteLine,
  esc,
} from "../services/emailLayout.js";

const router = Router();
const M = (name) => mongoose.models[name] || mongoose.model(name);

const KINDS = {
  intimate: "Intimate image shared without consent",
  copyright: "Copyright (DMCA)",
  privacy: "Private information",
  other: "Other",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
const ipOf = (req) => req.ip || req.headers["x-forwarded-for"] || "unknown";

// 5 per hour per IP and per email. In memory; resets on restart.
const HOUR = 60 * 60 * 1000;
const hits = new Map();
function tooMany(key, max = 5) {
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

const bad = (res, message) => res.status(400).json({ ok: false, message });

router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // bot

    const kind = KINDS[b.kind] ? b.kind : "other";
    const urls = clean(b.urls, 2000);
    const fullName = clean(b.fullName, 120);
    const email = clean(b.email, 200).toLowerCase();
    const onBehalf = b.onBehalf === "authorized" ? "authorized" : "self";
    const workDescription = clean(b.workDescription, 1500);
    const originalUrl = clean(b.originalUrl, 500);
    const details = clean(b.details, 2000);

    // Same rules as the form, so a request can't skip a required part.
    if (!urls) return bad(res, "Add the link to the post.");
    if (!fullName) return bad(res, "Type your full name to sign.");
    if (!EMAIL_RE.test(email)) return bad(res, "Enter a valid email.");
    if (kind === "copyright" && !workDescription)
      return bad(res, "Describe the work you own.");
    if (!b.accurate) return bad(res, "Confirm the information is accurate.");
    if ((kind === "copyright" || kind === "intimate") && !b.goodFaith)
      return bad(res, "Confirm the good-faith statement.");
    if (kind === "copyright" && !b.perjury)
      return bad(res, "Confirm the statement under penalty of perjury.");

    if (tooMany(`rr:ip:${ipOf(req)}`) || tooMany(`rr:email:${email}`)) {
      return res.status(429).json({
        ok: false,
        message: `Too many requests. Email ${
          process.env.SUPPORT_EMAIL || "support"
        } instead.`,
      });
    }

    const receivedAt = new Date();
    const deadline =
      kind === "intimate" ? new Date(receivedAt.getTime() + 48 * HOUR) : null;

    const lines = [
      `REMOVAL REQUEST — ${KINDS[kind]}`,
      deadline ? `Remove by: ${deadline.toISOString()} (48 hours)` : null,
      `Received: ${receivedAt.toISOString()}`,
      ``,
      `Link(s):\n${urls}`,
      ``,
      `Name (signature): ${fullName}`,
      `Email: ${email}`,
      kind === "intimate"
        ? `Filed by: ${
            onBehalf === "self"
              ? "the person in the image"
              : "someone authorized to act for them"
          }`
        : null,
      kind === "copyright" ? `Work owned: ${workDescription}` : null,
      kind === "copyright" && originalUrl ? `Original: ${originalUrl}` : null,
      details ? `Details: ${details}` : null,
      ``,
      `Statements confirmed: accurate${b.goodFaith ? ", good faith" : ""}${
        b.perjury ? ", under penalty of perjury (owner or authorized)" : ""
      }`,
      `IP: ${ipOf(req)}`,
    ].filter((l) => l !== null);
    const text = lines.join("\n");

    // 1. Save (admin dashboard)
    await M("Feedback").create({
      type: "general",
      message: text.slice(0, 4000),
      page: `removal:${kind}`,
      guestName: fullName.slice(0, 40),
      guestEmail: email,
      status: "new",
    });

    // 2. Alert support. Failure here must not lose the request (it's saved).
    const supportTo = process.env.SUPPORT_EMAIL;
    if (supportTo) {
      sendEmail({
        to: supportTo,
        subject: `${
          kind === "intimate" ? "[URGENT 48h] " : "[Action needed] "
        }Removal request: ${KINDS[kind]}`,
        html: `<pre style="font-family:Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap">${esc(
          text
        )}</pre>`,
        text,
        tag: "removal-request-alert",
      }).catch((e) =>
        console.error("[removal] support alert failed:", e?.message)
      );
    } else {
      console.error("[removal] SUPPORT_EMAIL not set — request saved only");
    }

    // 3. Copy to the requester
    sendEmail({
      to: email,
      subject: "We got your removal request",
      html: renderEmail({
        preheader: "Your SkyHub removal request was received.",
        title: "Request received",
        introHtml:
          kind === "intimate"
            ? "We&rsquo;ll review it and remove the image within 48 hours if it breaks our rules. We&rsquo;ll email you when it&rsquo;s done."
            : "We&rsquo;ll review it and email you with what we did.",
        bodyHtml: noteLine(
          `Your request: ${esc(KINDS[kind])}. Received ${esc(
            receivedAt.toUTCString()
          )}. Keep this email as your record.`
        ),
      }),
      text: `Request received.\n\n${
        kind === "intimate"
          ? "We'll review it and remove the image within 48 hours if it breaks our rules."
          : "We'll review it and email you with what we did."
      }\n\nYour request: ${KINDS[kind]}. Received ${receivedAt.toUTCString()}.`,
      tag: "removal-request-copy",
    }).catch(() => {});

    res.json({ ok: true, deadline });
  } catch (err) {
    console.error("[removal] failed:", err?.message);
    res.status(500).json({
      ok: false,
      message: `Couldn't send it. Email ${
        process.env.SUPPORT_EMAIL || "support"
      } instead.`,
    });
  }
});

export default router;
