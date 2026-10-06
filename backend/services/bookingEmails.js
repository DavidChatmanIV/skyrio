// backend/services/bookingEmails.js
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

const textFooter = `\n\nView your trips: ${TRIPS_URL}\nQuestions? ${SUPPORT_EMAIL}\n\nSent by Skyrio - Plan smarter. Travel better.`;

/**
 * Hotel booking confirmation.
 * rooms: [{ name, roomName, boardName, address, checkin, checkout, guestName, confirmationCode }]
 * totalAmount: the EXACT amount charged.
 */
export async function sendHotelConfirmation({
  to,
  guestName,
  rooms = [],
  totalAmount,
  currency = "USD",
  bookingId,
}) {
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
          kvRow("Check-in", esc(formatDate(r.checkin) || "—")) +
          kvRow("Check-out", esc(formatDate(r.checkout) || "—")) +
          (r.guestName ? kvRow("Guest", esc(r.guestName)) : "") +
          (r.confirmationCode
            ? kvRow("Hotel confirmation", esc(r.confirmationCode))
            : "")
      )
    )
    .join("");

  const html = renderEmail({
    preheader: `${first.name || "Your hotel"} is confirmed${
      formatDate(first.checkin) ? ` for ${formatDate(first.checkin)}` : ""
    }`,
    title: "Your stay is booked! 🏨",
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
      ),
    cta: { label: "View my trips", url: TRIPS_URL },
  });

  const text = `Your stay is booked!${guestName ? ` Thanks, ${guestName}.` : ""}

${rooms
  .map(
    (r, i) => `${rooms.length > 1 ? `Room ${i + 1}: ` : ""}${r.name}
${r.address ? `${r.address}\n` : ""}${[r.roomName, r.boardName]
      .filter(Boolean)
      .join(" · ")}
Check-in: ${formatDate(r.checkin) || "—"}
Check-out: ${formatDate(r.checkout) || "—"}
${r.guestName ? `Guest: ${r.guestName}\n` : ""}${
      r.confirmationCode ? `Hotel confirmation: ${r.confirmationCode}\n` : ""
    }`
  )
  .join("\n")}
${total ? `Total charged: ${total}\n` : ""}${
    bookingId ? `Skyrio booking ID: ${bookingId}` : ""
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
}) {
  const isHotel = type === "Hotel";
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
      "REFUND",
      (!pending && customerRefund > 0
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

${!pending && customerRefund > 0 ? `Refund amount: ${refund}\n` : ""}${
    !pending && fee ? `Cancellation fee: ${fee}\n` : ""
  }${refundLine}
${bookingId ? `Skyrio booking ID: ${bookingId}` : ""}${textFooter}`;

  return sendEmail({
    to,
    subject: pending
      ? `Cancellation requested: ${tripDetails}`
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
    title: "Your refund is on its way 💸",
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
