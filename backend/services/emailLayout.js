// backend/services/emailLayout.js
// ONE shared look for every Skyrio email + the Resend sender.
//
// Why light-first with solid colors:
//   - Gmail (iPhone/Android) in dark mode IGNORES our dark-mode CSS and
//     recolors the email itself. It flips solid colors but NOT background
//     gradients — the old dark gradient card stayed dark while Gmail turned
//     its white text dark, making it unreadable.
//   - A light design with only solid colors gets flipped by Gmail
//     consistently (background AND text together), so it stays readable.
//   - Apple Mail / iOS Mail / Outlook honor the @media dark styles below,
//     so they get a proper Skyrio dark version.
//   - Layout uses tables (not flexbox) — Gmail strips display:flex.

import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
export const FROM_EMAIL =
  process.env.FROM_EMAIL || "Skyrio <onboarding@resend.dev>";
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || "support@skyrioofficial.com";

// FRONTEND_ORIGIN holds every environment's URL as a comma-separated list.
// Pick the one matching where this code runs (production → apex domain).
const origins = (
  process.env.FRONTEND_ORIGIN || "https://skyrio-iota.vercel.app"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
export const APP_URL =
  (process.env.NODE_ENV === "production"
    ? origins.find((o) => o.includes("myskyrio.com") && !o.includes("www"))
    : origins.find((o) => o.includes("localhost"))) ||
  origins[0] ||
  "https://skyrio-iota.vercel.app";
export const TRIPS_URL = `${APP_URL}/saved-trips`;

// ── Palette (light) — contrast-checked for readability ──
const C = {
  page: "#f4f1f9",
  card: "#ffffff",
  cardBorder: "#e7e1f0",
  box: "#f8f6fb",
  boxBorder: "#ebe5f3",
  heading: "#1a1030",
  text: "#4a4358",
  label: "#7d7590",
  accent: "#d9620f", // Skyrio orange, darkened to stay readable on white
  button: "#f26b10",
  buttonText: "#ffffff",
  footer: "#8a8299",
};

export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const formatMoney = (amount, currency = "USD") =>
  Number.isFinite(Number(amount))
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(Number(amount))
    : null;

// ── Building blocks ──
export function detailBox(label, innerHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sk-box" style="background:${
    C.box
  };border:1px solid ${C.boxBorder};border-radius:12px;margin:0 0 14px;">
  <tr><td style="padding:18px 20px;">
    ${
      label
        ? `<div class="sk-label" style="color:${C.label};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">${label}</div>`
        : ""
    }
    ${innerHtml}
  </td></tr>
</table>`;
}

export function bigLine(text) {
  return `<div class="sk-heading" style="color:${C.heading};font-size:18px;font-weight:700;margin:0 0 4px;">${text}</div>`;
}

export function subLine(text) {
  return `<div class="sk-text" style="color:${C.text};font-size:14px;line-height:1.5;margin:0;">${text}</div>`;
}

export function kvRow(label, valueHtml, { highlight = false } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
  <tr>
    <td class="sk-label" valign="top" style="color:${
      C.label
    };font-size:13px;padding:0 12px 0 0;white-space:nowrap;">${label}</td>
    <td class="${
      highlight ? "sk-accent" : "sk-heading"
    }" valign="top" align="right" style="color:${
    highlight ? C.accent : C.heading
  };font-size:14px;font-weight:700;word-break:break-all;">${valueHtml}</td>
  </tr>
</table>`;
}

export function noteLine(text) {
  return `<div class="sk-label" style="color:${C.label};font-size:12px;line-height:1.5;margin:8px 0 0;">${text}</div>`;
}

export function button(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">
  <tr><td class="sk-btn" align="center" bgcolor="${C.button}" style="background:${C.button};border-radius:12px;">
    <a href="${url}" style="display:inline-block;padding:15px 36px;color:${C.buttonText};text-decoration:none;font-size:16px;font-weight:700;">${label}</a>
  </td></tr>
</table>`;
}

/**
 * Full email document.
 * preheader: short preview text shown in the inbox list.
 */
export function renderEmail({
  preheader = "",
  title,
  introHtml = "",
  bodyHtml = "",
  cta,
  footerNote = "",
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  /* Apple Mail, iOS Mail, Outlook (Mac/iOS) — real dark version */
  @media (prefers-color-scheme: dark) {
    .sk-page { background:#0f0a1c !important; }
    .sk-card { background:#1b1330 !important; border-color:#2e2347 !important; }
    .sk-box { background:#241a3d !important; border-color:#33284f !important; }
    .sk-heading { color:#ffffff !important; }
    .sk-text { color:#d6d0e2 !important; }
    .sk-label { color:#a59cbb !important; }
    .sk-accent { color:#ff9a4d !important; }
    .sk-footer { color:#8f86a6 !important; }
  }
  /* Outlook.com dark mode */
  [data-ogsc] .sk-page { background:#0f0a1c !important; }
  [data-ogsc] .sk-card { background:#1b1330 !important; }
  [data-ogsc] .sk-box { background:#241a3d !important; }
  [data-ogsc] .sk-heading { color:#ffffff !important; }
  [data-ogsc] .sk-text { color:#d6d0e2 !important; }
  [data-ogsc] .sk-label { color:#a59cbb !important; }
  [data-ogsc] .sk-accent { color:#ff9a4d !important; }
  @media (max-width: 480px) {
    .sk-pad { padding:28px 20px !important; }
  }
</style>
</head>
<body class="sk-page" bgcolor="${
    C.page
  }" style="margin:0;padding:0;background:${
    C.page
  };font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(
    preheader
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sk-page" bgcolor="${
    C.page
  }" style="background:${C.page};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr><td align="center" style="padding:0 0 22px;">
          <span style="font-size:26px;font-weight:800;color:${
            C.button
          };letter-spacing:-0.5px;">✈ Skyrio</span>
        </td></tr>
        <tr><td class="sk-card sk-pad" bgcolor="${C.card}" style="background:${
    C.card
  };border:1px solid ${C.cardBorder};border-radius:18px;padding:34px 28px;">
          <h1 class="sk-heading" style="color:${
            C.heading
          };font-size:22px;font-weight:800;margin:0 0 10px;text-align:center;line-height:1.3;">${title}</h1>
          ${
            introHtml
              ? `<p class="sk-text" style="color:${C.text};font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">${introHtml}</p>`
              : ""
          }
          ${bodyHtml}
          ${cta ? button(cta.label, cta.url) : ""}
          ${
            footerNote
              ? `<p class="sk-label" style="color:${C.label};font-size:12px;line-height:1.5;text-align:center;margin:20px 0 0;">${footerNote}</p>`
              : ""
          }
        </td></tr>
        <tr><td align="center" style="padding:24px 8px 0;">
          <p class="sk-footer" style="color:${
            C.footer
          };font-size:12px;line-height:1.6;margin:0;">
            Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:${
    C.accent
  };text-decoration:underline;">${SUPPORT_EMAIL}</a><br>
            Sent by Skyrio · Plan smarter. Travel better.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send through Resend. Never throws — returns { ok, id } or { ok:false, error }.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  tag = "email",
}) {
  if (!to) {
    console.error(`[email:${tag}] no recipient — not sent`);
    return { ok: false, error: "no recipient" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(attachments ? { attachments } : {}),
    });
    if (error) {
      console.error(`[email:${tag}] send failed:`, error);
      return { ok: false, error };
    }
    console.log(`[email:${tag}] sent to ${to} (id: ${data?.id})`);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error(`[email:${tag}] error:`, err?.message);
    return { ok: false, error: err?.message };
  }
}
