/**
 * emailService.js — backend/services/emailService.js
 * Thin wrapper around Resend so trigger jobs don't touch the SDK directly.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS =
  process.env.EMAIL_FROM || "Atlas from Skyrio <atlas@skyrio.com>";

export async function sendEmail({ to, subject, html }) {
  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    return { ok: true, result };
  } catch (err) {
    console.error("[emailService] sendEmail failed:", err.message);
    return { ok: false, error: err.message };
  }
}
