// Texts admin phones through Twilio's REST API (no SDK needed).
//
// Env vars (set on Render):
//   TWILIO_ACCOUNT_SID   ACxxxxxxxx
//   TWILIO_AUTH_TOKEN    your auth token
//   TWILIO_FROM_NUMBER   +1XXXXXXXXXX (your Twilio number)
//   ADMIN_DASHBOARD_URL  https://www.myskyrio.com/admin  (optional, added to texts)
//
// Usage anywhere in the backend:
//   import { notifyAdmins } from "../utils/notifyAdmins.js";
//   notifyAdmins("supportUrgent", `Urgent ticket from ${name}: ${subject}`);
//
// It never throws, so a texting problem can't break a booking or a ticket.

import AdminAlertContact from "../models/AdminAlertContact.js";

export const ALERT_KEYS = [
  "supportUrgent",
  "supportAll",
  "cancellations",
  "takedowns",
];

/** "201-555-1234" / "(201) 555 1234" / "12015551234" → "+12015551234". */
export function toE164(input = "") {
  const raw = String(input).trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

/** Sends one text. Throws with a readable message if it fails. */
export async function sendSms(to, body) {
  if (!smsConfigured()) {
    throw new Error("Texting isn't set up yet (Twilio env vars missing).");
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString(
    "base64"
  );
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: process.env.TWILIO_FROM_NUMBER,
        Body: body.slice(0, 320), // keep it to ~2 text segments
      }),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Text failed (${res.status})`);
  }
  return json.sid;
}

/**
 * Texts every enabled phone that opted into `alertKey`.
 * Returns how many texts went out.
 */
export async function notifyAdmins(alertKey, text) {
  if (!ALERT_KEYS.includes(alertKey)) {
    console.warn(`[notifyAdmins] unknown alert type: ${alertKey}`);
    return 0;
  }
  try {
    const contacts = await AdminAlertContact.find({
      enabled: true,
      [`alerts.${alertKey}`]: true,
    }).lean();
    if (!contacts.length) return 0;

    const link = process.env.ADMIN_DASHBOARD_URL;
    const body = `Skyrio: ${text}${link ? `\n${link}` : ""}`;

    const results = await Promise.allSettled(
      contacts.map((c) => sendSms(c.phone, body))
    );
    const sentIds = contacts
      .filter((_, i) => results[i].status === "fulfilled")
      .map((c) => c._id);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[notifyAdmins] text to ${contacts[i].phone} failed:`,
          r.reason?.message
        );
      }
    });
    if (sentIds.length) {
      await AdminAlertContact.updateMany(
        { _id: { $in: sentIds } },
        { $set: { lastAlertAt: new Date() } }
      );
    }
    return sentIds.length;
  } catch (err) {
    console.error("[notifyAdmins] failed:", err.message);
    return 0;
  }
}
