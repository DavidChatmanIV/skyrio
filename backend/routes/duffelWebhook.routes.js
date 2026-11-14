// Duffel webhooks: changes the airline, hotel or rental company makes on
// their side, after the traveler booked.
//
// Set up (Duffel dashboard → Developers → Webhooks):
//   URL:    https://<backend>/api/webhooks/duffel
//   Events: order.airline_initiated_change_detected, stays.booking.cancelled,
//           cars.booking.cancelled (ping.triggered for testing)
//   Put the webhook secret in DUFFEL_WEBHOOK_SECRET on Render.
//
// What happens: the booking is flagged, the traveler gets an email telling
// them what changed and what they're owed, and admin phones get a text.
// Nothing is cancelled or refunded automatically; a person decides.
//
// Mounted in server.js BEFORE express.json(), because the signature is
// over the raw body.

import express from "express";
import crypto from "node:crypto";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import { notifyAdmins } from "../utils/notifyAdmins.js";
import {
  renderEmail,
  sendEmail,
  detailBox,
  subLine,
  noteLine,
  esc,
  APP_URL,
  TRIPS_URL,
} from "../services/emailLayout.js";
import { manageUrlFor } from "../services/manageLink.js";

const router = express.Router();
const TOLERANCE_SEC = 10 * 60;

/** X-Duffel-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.rawBody">. */
export function verifyDuffelSignature(rawBody, header, secret, now = Date.now()) {
  if (!secret || !header || !rawBody) return false;
  const parts = Object.fromEntries(
    String(header)
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((kv) => kv.length === 2)
  );
  const t = Number(parts.t);
  const sig = String(parts.v1 || "");
  if (!t || !/^[a-f0-9]{64}$/i.test(sig)) return false;
  if (Math.abs(now / 1000 - t) > TOLERANCE_SEC) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.`)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}

const HANDLED = {
  "order.airline_initiated_change_detected": "airline_change",
  "stays.booking.cancelled": "supplier_cancelled",
  "cars.booking.cancelled": "supplier_cancelled",
};

// The supplier id on the event: an order (ord_), stay booking (bok_) or car booking.
function supplierIdFrom(obj = {}) {
  return obj.order_id || obj.booking_id || obj.id || null;
}

function travelerEmail(kind, booking) {
  const trip = esc(booking.tripDetails || booking.type);
  const code = (booking.confirmationCodes || [])[0];
  const isFlight = booking.type === "Flight";
  let title, intro, what;
  if (kind === "airline_change") {
    title = "The airline changed your flight";
    intro = `The airline made a change to <strong>${trip}</strong>. The airline sets the new schedule, not Skyrio.`;
    what =
      `Check the new details in the airline's app or site${code ? ` with confirmation code <strong>${esc(code)}</strong>` : ""}. ` +
      "If your flight was cancelled, or the change is significant (3+ hours domestic or 6+ international, a different airport, an extra stop, or a lower cabin) and you don't want the new flight, you're owed a full refund. Reply to this email or use Help, and we'll take care of it.";
  } else {
    const who = booking.type === "Car" ? "rental company" : "hotel";
    title = `The ${who} cancelled your booking`;
    intro = `We were told the ${who} cancelled <strong>${trip}</strong>. We didn't cancel it, and neither did you.`;
    what =
      `A Skyrio team member is looking into it and will contact you. Don't count on this ${booking.type === "Car" ? "rental" : "room"} until you hear from us. If you need to make other plans now, reply to this email or use Help.`;
  }
  const manageUrl = booking.user ? TRIPS_URL : manageUrlFor(booking._id);
  const html = renderEmail({
    preheader: title,
    title,
    introHtml: subLine(intro),
    bodyHtml:
      detailBox("What to do", subLine(what)) +
      noteLine(`More help: <a href="${APP_URL}/travel-disruptions">What to do when travel is disrupted</a>`),
    cta: { label: "View my trip", url: manageUrl },
  });
  const text = `${title}\n\n${intro.replace(/<[^>]+>/g, "")}\n\n${what.replace(/<[^>]+>/g, "")}\n\nView your trip: ${manageUrl}\n${APP_URL}/travel-disruptions`;
  return { title: isFlight ? title : title, html, text };
}

router.post("/", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const secret = process.env.DUFFEL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[duffel-webhook] DUFFEL_WEBHOOK_SECRET is not set — ignoring event");
    return res.status(503).json({ ok: false });
  }
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifyDuffelSignature(raw, req.get("X-Duffel-Signature"), secret)) {
    console.warn("[duffel-webhook] bad signature — rejected");
    return res.status(401).json({ ok: false });
  }

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ ok: false });
  }
  const type = String(event?.type || "");
  const eventId = String(event?.id || event?.idempotency_key || "");
  const kind = HANDLED[type];

  // Answer right away; Duffel retries anything that isn't a quick 2xx.
  res.json({ ok: true });
  if (!kind) {
    if (type) console.log(`[duffel-webhook] ${type} (not handled)`);
    return;
  }

  try {
    const supplierId = supplierIdFrom(event?.data?.object);
    if (!supplierId) {
      console.warn(`[duffel-webhook] ${type} without an id`);
      return;
    }
    const booking = await Booking.findOne({ providerBookingIds: String(supplierId) });
    if (!booking) {
      console.warn(`[duffel-webhook] ${type} for ${supplierId}: no Skyrio booking`);
      return;
    }
    // A cancellation we asked for isn't news.
    if (kind === "supplier_cancelled" && ["cancel_pending", "cancelled"].includes(booking.status)) {
      return;
    }
    // Retries / duplicates: claim the event id once.
    const claimed = await Booking.findOneAndUpdate(
      { _id: booking._id, "supplierAlerts.eventId": { $ne: eventId } },
      {
        $push: {
          supplierAlerts: {
            $each: [{ type: kind, eventId, at: new Date(), source: type }],
            $position: 0,
            $slice: 20,
          },
        },
      },
      { new: true }
    );
    if (!claimed) return;

    const to = booking.user
      ? (await User.findById(booking.user).select("email").lean())?.email || booking.email
      : booking.email;
    let travelerOk = false;
    if (to) {
      const { title, html, text } = travelerEmail(kind, booking);
      const r = await sendEmail({ to, subject: title, html, text, tag: `duffel-${kind}` });
      travelerOk = Boolean(r?.ok);
    }
    const texted = await notifyAdmins(
      "cancellations",
      `${kind === "airline_change" ? "Airline changed a flight" : `${booking.type} cancelled by supplier`}: ${String(booking.tripDetails || "").slice(0, 80)} (booking ${booking._id}). Traveler emailed: ${travelerOk ? "yes" : "NO"}.`
    );
    await Booking.updateOne(
      { _id: booking._id, "supplierAlerts.eventId": eventId },
      { $set: { "supplierAlerts.$.notified": { traveler: travelerOk, admins: texted } } }
    );
    console.log(`[duffel-webhook] ${type} → booking ${booking._id} flagged (traveler emailed: ${travelerOk}, admin texts: ${texted})`);
  } catch (err) {
    console.error("[duffel-webhook] handling failed:", err.message);
  }
});

export default router;
