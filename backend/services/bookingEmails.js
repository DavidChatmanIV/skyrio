// Booking lifecycle emails: hotel confirmation, cancellation, refund issued.
// Built on the shared layout (./emailLayout.js): light-first, solid colors,
// table layout — readable in light and dark mode on every mail app.
//
// Rule: only state what actually happened — exact amounts charged/refunded,
// real confirmation codes. Never estimates. Functions never throw.

import {
  renderEmail,
  sendEmail,
  detailBox,
  bigLine,
  subLine,
  kvRow,
  noteLine,
  esc,
  formatMoney,
  TRIPS_URL,
  SUPPORT_EMAIL,
} from "./emailLayout.js";
import { manageUrlFor } from "./manageLink.js";

export { formatMoney };

const formatDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
};

const nightsBetween = (a, b) => {
  const n = Math.round((new Date(b) - new Date(a)) / 86400000);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Refunds and cancellation terms are the hotel's rules, not Skyrio's —
// said plainly in every hotel confirmation (same wording as checkout).
const hotelPolicy = (rooms) => {
  const names = [...new Set(rooms.map((r) => r?.name).filter(Boolean))];
  const who = names.length === 1 ? names[0] : "the hotel";
  return `Refunds and cancellation terms are set by ${who}, not Skyrio. The hotel's policy for this rate applies.`;
};

// Duffel stay extras → "Check-in from 3:00 PM" style lines. Only what the
// hotel actually sent; empty when nothing was sent.
const checkInText = (st) =>
  st?.checkInAfter
    ? `from ${st.checkInAfter}${st.checkInBefore && st.checkInBefore !== "12:00 AM" ? ` until ${st.checkInBefore}` : ""}`
    : null;
const checkOutText = (st) => (st?.checkOutBefore ? `by ${st.checkOutBefore}` : null);
const conditionsOf = (st) =>
  (Array.isArray(st?.conditions) ? st.conditions : []).filter((c) => c?.text).slice(0, 6);

// Deposit / fees owed at the hotel, same wording as the checkout page:
// the plain summary, then the hotel's exact sentences.
export function atHotelLines(st) {
  const lines = [];
  const p = st?.payAtHotel;
  if (p?.amount > 0) {
    lines.push({
      bold: "Paid at the hotel:",
      text: `${formatMoney(p.amount, p.currency || "USD")}${
        p.names?.length ? ` (${p.names.join(", ")})` : ""
      } at check-in. This isn't included in what you paid Skyrio.`,
    });
  }
  const dep = st?.deposit;
  if (dep) {
    lines.push({ bold: dep.headline, text: dep.details });
    if (dep.original?.length) lines.push({ bold: "Hotel's wording:", text: dep.original.join(" ") });
  }
  for (const t of st?.otherCharges || []) lines.push({ bold: "At the hotel:", text: t });
  if (!dep && !(st?.otherCharges || []).length && (st?.hotelCharges || []).length) {
    lines.push({ bold: "At the hotel:", text: st.hotelCharges.join(" ") });
  }
  return lines;
}

const textFooter = `\n\nView your trips: ${TRIPS_URL}\nQuestions? ${SUPPORT_EMAIL}\n\nSent by Skyrio - Plan smarter. Travel better.`;

/**
 * Hotel booking confirmation.
 * rooms: [{ name, roomName, boardName, address, checkin, checkout, guestName,
 *          confirmationCode, alsoStaying: [names],
 *          stay?: { checkInAfter, checkInBefore, checkOutBefore, hotelPhone,
 *                   hotelEmail, keyCollection, conditions: [{ title, text }] } }]
 * totalAmount: the EXACT amount charged.
 * groupTrip: true when this is part of a Sync Together trip (no tip then).
 */
export async function sendHotelConfirmation({
  to,
  guestName,
  rooms = [],
  totalAmount,
  currency = "USD",
  bookingId,
  groupTrip = false,
  // Secure "Manage or cancel" link (works without an account). Built from
  // bookingId when not passed, so every hotel confirmation has one.
  manageUrl = null,
}) {
  const manageLink =
    manageUrl ||
    (/^[a-f0-9]{24}$/i.test(String(bookingId || ""))
      ? manageUrlFor(bookingId)
      : null);
  const others = (r) =>
    Array.isArray(r?.alsoStaying)
      ? r.alsoStaying.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
  // One short line about Sync Together, only when booking for others.
  const syncTip =
    !groupTrip && (rooms.length > 1 || rooms.some((r) => others(r).length));
  const first = rooms[0] || {};
  const nights = nightsBetween(first.checkin, first.checkout);
  const total = formatMoney(totalAmount, currency);

  const roomBlocks = rooms
    .map((r, i) =>
      detailBox(
        rooms.length > 1 ? `ROOM ${i + 1}` : "YOUR STAY",
        bigLine(esc(r.name)) +
          (r.address ? subLine(esc(r.address)) : "") +
          ([r.roomName, r.boardName].filter(Boolean).length
            ? subLine(
                esc([r.roomName, r.boardName].filter(Boolean).join(" · "))
              )
            : "") +
          `<div style="height:10px;line-height:10px;">&nbsp;</div>` +
          kvRow(
            "Check-in",
            esc(
              [formatDate(r.checkin) || "—", checkInText(r.stay)]
                .filter(Boolean)
                .join(", ")
            )
          ) +
          kvRow(
            "Check-out",
            esc(
              [formatDate(r.checkout) || "—", checkOutText(r.stay)]
                .filter(Boolean)
                .join(", ")
            )
          ) +
          (r.guestName ? kvRow("Guest", esc(r.guestName)) : "") +
          (others(r).length
            ? kvRow("Also staying", esc(others(r).join(", ")))
            : "") +
          (r.confirmationCode
            ? kvRow("Hotel confirmation", esc(r.confirmationCode))
            : "") +
          (r.stay?.hotelPhone ? kvRow("Hotel phone", esc(r.stay.hotelPhone)) : "") +
          (r.stay?.hotelEmail ? kvRow("Hotel email", esc(r.stay.hotelEmail)) : "") +
          (r.stay?.keyCollection
            ? noteLine(
                `<strong>Check-in &amp; keys:</strong> ${esc(r.stay.keyCollection)}`
              )
            : "") +
          atHotelLines(r.stay)
            .map((l) => noteLine(l.bold ? `<strong>${esc(l.bold)}</strong> ${esc(l.text)}` : esc(l.text)))
            .join("") +
          (r.stay?.hidPaymentText
            ? noteLine(
                "Skyrio collected the full room price. If the hotel asks you to pay for the room again, contact Skyrio first."
              )
            : "") +
          conditionsOf(r.stay)
            .map((c) =>
              noteLine(
                `${c.title ? `<strong>${esc(c.title)}:</strong> ` : ""}${esc(c.text)}`
              )
            )
            .join("")
      )
    )
    .join("");

  const html = renderEmail({
    preheader: `${first.name || "Your hotel"} is confirmed${
      formatDate(first.checkin) ? ` for ${formatDate(first.checkin)}` : ""
    }`,
    title: "Your stay is booked!",
    introHtml: `Thanks${
      guestName ? `, <strong>${esc(guestName)}</strong>` : ""
    }! Your hotel ${rooms.length > 1 ? "rooms are" : "room is"} confirmed${
      nights ? ` for ${nights} night${nights > 1 ? "s" : ""}` : ""
    }.`,
    bodyHtml:
      roomBlocks +
      detailBox(
        "",
        (total ? kvRow("Total charged", esc(total), { highlight: true }) : "") +
          (bookingId ? kvRow("Skyrio booking ID", esc(bookingId)) : "") +
          noteLine(
            "Show your hotel confirmation code at check-in. Hotels may ask for a photo ID and a card for incidentals."
          )
      ) +
      noteLine(esc(hotelPolicy(rooms))) +
      (syncTip
        ? noteLine(
            "Group trip next time? With Sync Together, everyone plans together and pays their own share."
          )
        : "") +
      (manageLink
        ? noteLine(
            `Need to cancel? Use <strong>Manage or cancel</strong> above. You'll see the hotel's refund estimate before anything is cancelled. Have a Skyrio account? Your trips are also in <a href="${TRIPS_URL}" style="color:inherit;">My Trips</a>.`
          )
        : ""),
    // Guests have no My Trips, so the manage link is the main button.
    cta: manageLink
      ? { label: "Manage or cancel", url: manageLink }
      : { label: "View my trips", url: TRIPS_URL },
  });

  const text = `Your stay is booked!${guestName ? ` Thanks, ${guestName}.` : ""}

${rooms
  .map(
    (r, i) => `${rooms.length > 1 ? `Room ${i + 1}: ` : ""}${r.name}
${r.address ? `${r.address}\n` : ""}${[r.roomName, r.boardName]
      .filter(Boolean)
      .join(" · ")}
Check-in: ${[formatDate(r.checkin) || "—", checkInText(r.stay)].filter(Boolean).join(", ")}
Check-out: ${[formatDate(r.checkout) || "—", checkOutText(r.stay)].filter(Boolean).join(", ")}
${r.guestName ? `Guest: ${r.guestName}\n` : ""}${
      others(r).length ? `Also staying: ${others(r).join(", ")}\n` : ""
    }${r.confirmationCode ? `Hotel confirmation: ${r.confirmationCode}\n` : ""}${
      r.stay?.hotelPhone ? `Hotel phone: ${r.stay.hotelPhone}\n` : ""
    }${r.stay?.hotelEmail ? `Hotel email: ${r.stay.hotelEmail}\n` : ""}${
      r.stay?.keyCollection ? `Check-in & keys: ${r.stay.keyCollection}\n` : ""
    }${atHotelLines(r.stay)
      .map((l) => `${l.bold ? `${l.bold} ` : ""}${l.text}\n`)
      .join("")}${
      r.stay?.hidPaymentText
        ? "Skyrio collected the full room price. If the hotel asks you to pay for the room again, contact Skyrio first.\n"
        : ""
    }${conditionsOf(r.stay)
      .map((c) => `${c.title ? `${c.title}: ` : ""}${c.text}\n`)
      .join("")}`
  )
  .join("\n")}
${total ? `Total charged: ${total}\n` : ""}${
    bookingId ? `Skyrio booking ID: ${bookingId}` : ""
  }

${hotelPolicy(rooms)}${
    syncTip
      ? "\n\nGroup trip next time? With Sync Together, everyone plans together and pays their own share."
      : ""
  }${
    manageLink ? `\n\nManage or cancel this booking: ${manageLink}` : ""
  }${textFooter}`;

  return sendEmail({
    to,
    subject: `Your stay is booked: ${first.name || "Hotel"}${
      formatDate(first.checkin) ? ` · ${formatDate(first.checkin)}` : ""
    }`,
    html,
    text,
    tag: "hotel-confirmation",
  });
}

/**
 * Cancellation — flights and hotels.
 * pending: airline accepted but hasn't finalized (flights).
 * airlineCredit: { amount, currency, vouchers: [{ code, amount, currency,
 *   expiresAt, airline }] } when the airline gave CREDIT instead of money
 *   back (LiteAPI destination "voucher"). Never described as a card refund.
 */
export async function sendCancellationEmail({
  to,
  name,
  type,
  tripDetails,
  pending = false,
  partial = false,
  customerRefund = 0,
  cancellationFee = 0,
  currency = "USD",
  bookingId,
  airlineCredit = null,
}) {
  const isHotel = type === "Hotel";
  const credit =
    !pending && airlineCredit
      ? {
          amount: Number(airlineCredit.amount) || 0,
          currency: airlineCredit.currency || currency,
          vouchers: (airlineCredit.vouchers || []).filter(Boolean),
        }
      : null;
  const creditMoney = credit?.amount
    ? formatMoney(credit.amount, credit.currency)
    : null;
  const creditExpiry = formatDate(credit?.vouchers?.[0]?.expiresAt);
  const creditAirline = credit?.vouchers?.[0]?.airline || "the airline";
  const refund = formatMoney(customerRefund, currency);
  const fee =
    cancellationFee > 0 ? formatMoney(cancellationFee, currency) : null;
  const trip = esc(tripDetails);

  let title, intro, refundLine;
  if (pending) {
    title = "Cancellation requested";
    intro = `We've sent your cancellation to the airline for <strong>${trip}</strong>. Airlines sometimes take a little while to confirm — we'll email you as soon as it's final.`;
    refundLine =
      "Any refund is confirmed by the airline once the cancellation is final.";
  } else if (partial) {
    title = "Part of your booking was cancelled";
    intro = `We cancelled part of <strong>${trip}</strong>, but at least one room couldn't be cancelled automatically. We're looking into it and will contact you.`;
    refundLine =
      customerRefund > 0
        ? `A refund of ${refund} for the cancelled part is on its way to your card.`
        : "No refund applies to the part that was cancelled.";
  } else if (credit) {
    title = "Your flight is cancelled";
    intro = `<strong>${trip}</strong> is cancelled.`;
    refundLine = `Instead of money back, ${creditAirline} gave you ${
      creditMoney ? `${creditMoney} in airline credit` : "airline credit"
    }. Use it to book a new flight directly with ${creditAirline}${
      creditExpiry ? ` before ${creditExpiry}` : " before it expires"
    }. Skyrio can't apply it yet. It's also saved on this trip in My Trips.`;
  } else {
    title = "Your trip is cancelled";
    intro = `<strong>${trip}</strong> is cancelled.`;
    refundLine =
      customerRefund > 0
        ? isHotel
          ? `A refund of ${refund} is on its way to the card you paid with. It usually appears in 5–10 business days.`
          : `The airline is refunding ${refund} to the card you paid with. It usually appears in 5–10 business days.`
        : `Under the ${
            isHotel ? "hotel's" : "airline's"
          } cancellation policy for this booking, no refund applies.`;
  }

  const html = renderEmail({
    preheader: pending
      ? `Cancellation requested for ${tripDetails}`
      : `${tripDetails} is cancelled`,
    title,
    introHtml: `${name ? `Hi ${esc(name)}, ` : ""}${intro}`,
    bodyHtml: detailBox(
      credit ? "AIRLINE CREDIT" : "REFUND",
      (credit
        ? (creditMoney
            ? kvRow("Airline credit", esc(creditMoney), { highlight: true })
            : "") +
          credit.vouchers
            .filter((v) => v.code)
            .map((v) => kvRow("Credit code", esc(v.code)))
            .join("") +
          (creditExpiry ? kvRow("Use by", esc(creditExpiry)) : "")
        : "") +
        (!pending && !credit && customerRefund > 0
          ? kvRow("Refund amount", esc(refund), { highlight: true })
          : "") +
        (!pending && fee ? kvRow("Cancellation fee", esc(fee)) : "") +
        subLine(esc(refundLine)) +
        (bookingId ? noteLine(`Skyrio booking ID: ${esc(bookingId)}`) : "")
    ),
    cta: { label: "View my trips", url: TRIPS_URL },
  });

  const text = `${title}

${name ? `Hi ${name}, ` : ""}${intro.replace(/<[^>]+>/g, "")}

${
  credit
    ? `${creditMoney ? `Airline credit: ${creditMoney}\n` : ""}${credit.vouchers
        .filter((v) => v.code)
        .map((v) => `Credit code: ${v.code}\n`)
        .join("")}${creditExpiry ? `Use by: ${creditExpiry}\n` : ""}`
    : ""
}${
    !pending && !credit && customerRefund > 0
      ? `Refund amount: ${refund}\n`
      : ""
  }${!pending && fee ? `Cancellation fee: ${fee}\n` : ""}${refundLine}
${bookingId ? `Skyrio booking ID: ${bookingId}` : ""}${textFooter}`;

  return sendEmail({
    to,
    subject: pending
      ? `Cancellation requested: ${tripDetails}`
      : credit
      ? `Cancelled: ${tripDetails} — airline credit inside`
      : `Cancelled: ${tripDetails}`,
    html,
    text,
    tag: "cancellation",
  });
}

/**
 * Refund issued — sent when Stripe confirms a refund went out (hotels).
 */
export async function sendRefundIssuedEmail({
  to,
  name,
  tripDetails,
  amount,
  currency = "USD",
  bookingId,
}) {
  const refund = formatMoney(amount, currency);
  const html = renderEmail({
    preheader: `Your refund of ${refund || ""} is on its way`,
    title: "Your refund is on its way",
    introHtml: `${name ? `Hi ${esc(name)}, ` : ""}we've issued your refund${
      tripDetails ? ` for <strong>${esc(tripDetails)}</strong>` : ""
    }.`,
    bodyHtml: detailBox(
      "REFUND",
      kvRow("Amount", esc(refund || "—"), { highlight: true }) +
        subLine(
          "It goes back to the card you paid with and usually appears in 5–10 business days, depending on your bank."
        ) +
        (bookingId ? noteLine(`Skyrio booking ID: ${esc(bookingId)}`) : "")
    ),
    cta: { label: "View my trips", url: TRIPS_URL },
  });
  const text = `Your refund is on its way.

${name ? `Hi ${name}, ` : ""}we've issued your refund${
    tripDetails ? ` for ${tripDetails}` : ""
  }.
Amount: ${refund || "—"}
It goes back to the card you paid with and usually appears in 5–10 business days.
${bookingId ? `Skyrio booking ID: ${bookingId}` : ""}${textFooter}`;

  return sendEmail({
    to,
    subject: `Refund issued: ${refund || ""}`.trim(),
    html,
    text,
    tag: "refund",
  });
}

/**
 * Cancellation REQUEST received — automatic terms weren't available, so a
 * person will confirm the terms. Nothing has been cancelled yet.
 */
export async function sendCancellationRequestEmail({
  to,
  name,
  tripDetails,
  bookingId,
}) {
  const html = renderEmail({
    preheader: `We received your cancellation request for ${tripDetails}`,
    title: "We received your cancellation request",
    introHtml: `${
      name ? `Hi ${esc(name)}, ` : ""
    }we've received your request to cancel <strong>${esc(
      tripDetails
    )}</strong>.`,
    bodyHtml: detailBox(
      "WHAT HAPPENS NEXT",
      subLine(
        "Your trip is <strong>not cancelled yet</strong>. We'll confirm the terms with the airline or hotel and contact you first."
      ) + (bookingId ? noteLine(`Skyrio booking ID: ${esc(bookingId)}`) : "")
    ),
    cta: { label: "View my trips", url: TRIPS_URL },
  });
  const text = `We received your cancellation request.

${
  name ? `Hi ${name}, ` : ""
}we've received your request to cancel ${tripDetails}.

Your trip is NOT cancelled yet. We'll confirm the terms with the airline or hotel and contact you first.
${bookingId ? `Skyrio booking ID: ${bookingId}` : ""}${textFooter}`;
  return sendEmail({
    to,
    subject: `Cancellation request received: ${tripDetails}`,
    html,
    text,
    tag: "cancel-request",
  });
}

/** Internal alert to the support inbox about a new cancellation request. */
export async function sendCancellationRequestAlert({
  booking,
  travelerEmail,
  reason,
}) {
  const supportTo = process.env.SUPPORT_EMAIL;
  if (!supportTo) return { ok: false, error: "SUPPORT_EMAIL not set" };
  // Same rule as the admin dashboard: waiting could cost the traveler money
  // if it was booked in the last 24h (free-cancel window) or leaves soon.
  const now = Date.now();
  const booked = new Date(booking.paidAt || booking.createdAt).getTime();
  const startRaw =
    booking.dates?.start ||
    booking.hotelStay?.rooms?.[0]?.checkin ||
    booking.flight?.departureDate ||
    booking.flight?.departDate;
  const start = startRaw ? new Date(startRaw).getTime() : NaN;
  const urgentWhy =
    now - booked < 24 * 3600 * 1000
      ? "Booked in the last 24 hours — the airline's free-cancel window may still be open."
      : Number.isFinite(start) && start - now < 3 * 24 * 3600 * 1000
      ? "The trip starts within 3 days."
      : null;
  const text = `${
    urgentWhy ? `URGENT: ${urgentWhy}\n\n` : ""
  }New cancellation request — action needed.

Trip: ${booking.tripDetails}
Type: ${booking.type}
Skyrio booking ID: ${booking._id}
Traveler: ${booking.name || "—"} <${travelerEmail || "—"}>
Paid: ${booking.totalAmount ?? booking.total ?? "—"} ${
    booking.totalCurrency || ""
  }
Traveler's note: ${reason || "(none)"}

Automatic cancellation terms weren't available. Confirm terms with the supplier, contact the traveler, then cancel and mark the request resolved in /admin/bookings.`;
  return sendEmail({
    to: supportTo,
    subject: `${
      urgentWhy ? "[URGENT]" : "[Action needed]"
    } Cancellation request: ${booking.tripDetails}`,
    html: `<pre style="font-family:Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap">${esc(
      text
    )}</pre>`,
    text,
    tag: "cancel-request-alert",
  });
}

/**
 * Two days before check-in: a short reminder of money the HOTEL collects
 * (deposit, cash, fees), so travelers aren't surprised at the desk.
 * Only sent when the hotel actually listed such a charge.
 */
export async function sendHotelChargesReminder({ to, guestName, hotelName, checkin, stay, bookingId }) {
  const lines = atHotelLines(stay);
  if (!to || !lines.length) return { ok: false, skipped: true };
  const when = formatDate(checkin);
  const manageLink = /^[a-f0-9]{24}$/i.test(String(bookingId || "")) ? manageUrlFor(bookingId) : null;
  const html = renderEmail({
    preheader: `Before you check in at ${hotelName || "your hotel"}`,
    title: "Before you check in",
    introHtml: `Hi${guestName ? ` <strong>${esc(guestName)}</strong>` : ""}! Your stay at <strong>${esc(
      hotelName || "your hotel"
    )}</strong>${when ? ` starts ${esc(when)}` : " is coming up"}. The hotel collects this itself, so plan ahead:`,
    bodyHtml:
      detailBox(
        "AT THE HOTEL",
        lines
          .map((l) => noteLine(l.bold ? `<strong>${esc(l.bold)}</strong> ${esc(l.text)}` : esc(l.text)))
          .join("")
      ) +
      noteLine(
        "Your room is already paid to Skyrio. If the hotel asks you to pay for the room again, contact Skyrio first."
      ),
    cta: manageLink ? { label: "View booking", url: manageLink } : { label: "View my trips", url: TRIPS_URL },
  });
  const text = `Before you check in${guestName ? `, ${guestName}` : ""}

Your stay at ${hotelName || "your hotel"}${when ? ` starts ${when}` : " is coming up"}. The hotel collects this itself:

${lines.map((l) => `${l.bold ? `${l.bold} ` : ""}${l.text}`).join("\n")}

Your room is already paid to Skyrio. If the hotel asks you to pay for the room again, contact Skyrio first.${
    manageLink ? `\n\nView booking: ${manageLink}` : ""
  }${textFooter}`;
  return sendEmail({
    to,
    subject: `Before you check in: ${hotelName || "your hotel"}`,
    html,
    text,
    tag: "hotel-charges-reminder",
  });
}

// "Your stay got cheaper": the same room now costs less and the stay can
// still be cancelled for free. Only real numbers from the check.
export async function sendStayPriceDropEmail({ to, guestName, hotelName, savings, currency, freeCancelUntil, bookingId }) {
  if (!to || !(savings > 0)) return { ok: false, skipped: true };
  const link = /^[a-f0-9]{24}$/i.test(String(bookingId || "")) ? manageUrlFor(bookingId) : TRIPS_URL;
  const amount = formatMoney(savings, currency);
  const until = freeCancelUntil ? formatDate(freeCancelUntil) : null;
  const html = renderEmail({
    preheader: `Your stay at ${hotelName || "your hotel"} is ${amount} cheaper now`,
    title: "Price Watch: your stay got cheaper",
    introHtml: `Hi${guestName ? ` <strong>${esc(guestName)}</strong>` : ""}! The same room at <strong>${esc(
      hotelName || "your hotel"
    )}</strong> now costs <strong>${esc(amount)}</strong> less than you paid.`,
    bodyHtml:
      noteLine(
        `Book the lower price, then Skyrio cancels your old booking for free${
          until ? ` (free cancellation until ${esc(until)})` : ""
        } and you get its full amount back.`
      ) +
      noteLine("Your card holds both amounts until the old refund arrives, usually 5–10 business days.") +
      noteLine("Prices change. The new price is checked again before you pay."),
    cta: { label: "See the lower price", url: link },
  });
  const text = `Price Watch: your stay got cheaper

The same room at ${hotelName || "your hotel"} now costs ${amount} less than you paid.

Book the lower price, then Skyrio cancels your old booking for free${until ? ` (free cancellation until ${until})` : ""} and you get its full amount back.
Your card holds both amounts until the old refund arrives, usually 5–10 business days.
Prices change. The new price is checked again before you pay.

See the lower price: ${link}${textFooter}`;
  return sendEmail({ to, subject: `Price Watch: your stay is ${amount} cheaper now`, html, text, tag: "stay-price-drop" });
}

/** "Your flight got cheaper" — same flights, lower fare, full refund on the old ticket. */
export async function sendFlightPriceDropEmail({ to, name, route, savings, currency, bookingId }) {
  if (!to || !(savings > 0)) return { ok: false, skipped: true };
  const link = /^[a-f0-9]{24}$/i.test(String(bookingId || "")) ? manageUrlFor(bookingId) : TRIPS_URL;
  const amount = formatMoney(savings, currency);
  const where = route || "your trip";
  const html = renderEmail({
    preheader: `The same flights for ${where} are ${amount} cheaper now`,
    title: "Price Watch: your flight got cheaper",
    introHtml: `Hi${name ? ` <strong>${esc(name)}</strong>` : ""}! The same flights for <strong>${esc(
      where
    )}</strong> now cost <strong>${esc(amount)}</strong> less than you paid.`,
    bodyHtml:
      noteLine(
        "Right now the airline would refund your current ticket in full. Book the lower fare and Skyrio cancels the old ticket for you."
      ) +
      noteLine("Your card holds both amounts until the old refund arrives, usually 5–10 business days.") +
      noteLine("Fares change fast. The fare and the refund are both checked again before anything happens. Seats aren't carried over."),
    cta: { label: "See the lower fare", url: link },
  });
  const text = `Price Watch: your flight got cheaper

The same flights for ${where} now cost ${amount} less than you paid.

Right now the airline would refund your current ticket in full. Book the lower fare and Skyrio cancels the old ticket for you.
Your card holds both amounts until the old refund arrives, usually 5–10 business days.
Fares change fast. The fare and the refund are both checked again before anything happens. Seats aren't carried over.

See the lower fare: ${link}${textFooter}`;
  return sendEmail({ to, subject: `Price Watch: your flight is ${amount} cheaper now`, html, text, tag: "flight-price-drop" });
}

/**
 * We said we'd cancel the old booking, but couldn't do it for free in the
 * end. Both bookings are active; say so plainly.
 */
export async function sendReplaceKeptEmail({ to, name, type, oldBookingId, newBookingId }) {
  if (!to) return { ok: false, skipped: true };
  const isFlight = type === "Flight";
  const thing = isFlight ? "ticket" : "booking";
  const who = isFlight ? "airline" : "hotel";
  const oldLink = /^[a-f0-9]{24}$/i.test(String(oldBookingId || "")) ? manageUrlFor(oldBookingId) : TRIPS_URL;
  const newLink = /^[a-f0-9]{24}$/i.test(String(newBookingId || "")) ? manageUrlFor(newBookingId) : TRIPS_URL;
  const html = renderEmail({
    preheader: `Your old ${thing} is still active`,
    title: `Your old ${thing} is still active`,
    introHtml: `Hi${name ? ` <strong>${esc(name)}</strong>` : ""}. We couldn't cancel your old ${thing} for free: the ${who} no longer offers a full refund on it. <strong>You now have two active bookings.</strong>`,
    bodyHtml:
      noteLine(`Open each one to see what cancelling it would cost now, then keep the one you want.`) +
      noteLine(`The ${who} sets these rules, not Skyrio. Reply to this email if you need help.`),
    cta: { label: `See your old ${thing}`, url: oldLink },
  });
  const text = `Your old ${thing} is still active

We couldn't cancel your old ${thing} for free: the ${who} no longer offers a full refund on it. You now have two active bookings.
Open each one to see what cancelling it would cost now, then keep the one you want.
The ${who} sets these rules, not Skyrio. Reply to this email if you need help.

Old ${thing}: ${oldLink}
New ${thing}: ${newLink}${textFooter}`;
  return sendEmail({ to, subject: `Your old ${thing} is still active`, html, text, tag: "replace-kept" });
}
