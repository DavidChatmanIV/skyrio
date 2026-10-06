// backend/services/email.js
// Account, group-trip and flight-confirmation emails. All use the shared
// layout in ./emailLayout.js (light-first, solid colors, table layout) so
// they stay readable in light mode AND dark mode on every mail app —
// including Gmail on iPhone, which recolors emails itself in dark mode.
//
// Exports and inputs are unchanged from the previous version.

import {
  renderEmail,
  sendEmail,
  detailBox,
  bigLine,
  subLine,
  kvRow,
  esc,
  formatMoney,
  APP_URL,
} from "./emailLayout.js";

const SIGNOFF = "\n\nSent by Skyrio - Plan smarter. Travel better.";

/**
 * Trip invitation
 */
export async function sendTripInvite({
  to,
  inviterName,
  tripTitle,
  destination,
  inviteCode,
  memberNames,
}) {
  const joinUrl = `${APP_URL}/sync-together/join/${inviteCode}`;
  const html = renderEmail({
    preheader: `${inviterName} invited you to a trip${
      destination ? ` to ${destination}` : ""
    }`,
    title: "You're invited to a group trip!",
    introHtml: `<strong>${esc(inviterName)}</strong> wants you to join a trip${
      destination ? ` to <strong>${esc(destination)}</strong>` : ""
    }.`,
    bodyHtml: detailBox(
      "TRIP",
      bigLine(
        `${esc(tripTitle || "Untitled Trip")}${
          destination ? ` → ${esc(destination)}` : ""
        }`
      ) + (memberNames ? subLine(`Travelers: ${esc(memberNames)}`) : "")
    ),
    cta: { label: "View Trip &amp; Join", url: joinUrl },
    footerNote: `Or use invite code: <strong>${esc(
      inviteCode
    )}</strong><br>You received this because ${esc(
      inviterName
    )} added you to a group trip.`,
  });
  const text = `${inviterName} invited you to a trip${
    destination ? ` to ${destination}` : ""
  } on Skyrio.

Trip: ${tripTitle || "Untitled Trip"}${destination ? ` -> ${destination}` : ""}
${memberNames ? `Travelers: ${memberNames}\n` : ""}
View and join: ${joinUrl}
Or use invite code: ${inviteCode}${SIGNOFF}`;

  return sendEmail({
    to,
    subject: `${inviterName} invited you to a trip${
      destination ? ` to ${destination}` : ""
    } on Skyrio`,
    html,
    text,
    tag: "invite",
  });
}

/**
 * Plan ready for review
 */
export async function sendPlanReady({
  to,
  tripTitle,
  destination,
  plannerName,
  groupUrl,
}) {
  const html = renderEmail({
    preheader: `A plan for ${tripTitle} is ready to review`,
    title: "Your trip plan is ready!",
    introHtml: `<strong>${esc(
      plannerName
    )}</strong> generated a plan for <strong>${esc(tripTitle)}${
      destination ? ` → ${esc(destination)}` : ""
    }</strong>. Review it and approve!`,
    cta: { label: "Review Plan", url: groupUrl },
  });
  const text = `${plannerName} generated a plan for ${tripTitle}${
    destination ? ` -> ${destination}` : ""
  }. Review it and approve!

Review the plan: ${groupUrl}${SIGNOFF}`;

  return sendEmail({
    to,
    subject: `Trip plan ready: ${tripTitle}${
      destination ? ` → ${destination}` : ""
    }`,
    html,
    text,
    tag: "plan-ready",
  });
}

/**
 * A group trip was deleted
 */
export async function sendTripDeleted({
  to,
  tripTitle,
  destination,
  ownerName,
}) {
  const name = `${tripTitle || "Untitled Trip"}${
    destination ? ` → ${destination}` : ""
  }`;
  const html = renderEmail({
    preheader: `${ownerName} deleted ${tripTitle || "a trip"}`,
    title: "This trip has been deleted",
    introHtml: `<strong>${esc(ownerName)}</strong> deleted <strong>${esc(
      name
    )}</strong>. There's nothing further you need to do — this group trip no longer exists.`,
  });
  const text = `${ownerName} deleted ${tripTitle || "Untitled Trip"}${
    destination ? ` -> ${destination}` : ""
  }.

There's nothing further you need to do - this group trip no longer exists.${SIGNOFF}`;

  return sendEmail({
    to,
    subject: `Trip deleted: ${tripTitle || "Untitled Trip"}`,
    html,
    text,
    tag: "trip-deleted",
  });
}

/**
 * Removed from a group trip
 */
export async function sendMemberRemoved({
  to,
  tripTitle,
  destination,
  ownerName,
}) {
  const name = `${tripTitle || "Untitled Trip"}${
    destination ? ` → ${destination}` : ""
  }`;
  const html = renderEmail({
    preheader: `You were removed from ${tripTitle || "a trip"}`,
    title: "You've been removed from a trip",
    introHtml: `<strong>${esc(
      ownerName
    )}</strong> removed you from <strong>${esc(
      name
    )}</strong>. You won't receive further updates about this trip.`,
  });
  const text = `${ownerName} removed you from ${tripTitle || "Untitled Trip"}${
    destination ? ` -> ${destination}` : ""
  }.

You won't receive further updates about this trip.${SIGNOFF}`;

  return sendEmail({
    to,
    subject: `You've been removed from ${tripTitle || "a trip"}`,
    html,
    text,
    tag: "member-removed",
  });
}

/**
 * Password reset
 */
export async function sendPasswordReset({ to, resetUrl }) {
  const html = renderEmail({
    preheader: "Reset your Skyrio password (link expires in 1 hour)",
    title: "Reset your password",
    introHtml:
      "Click the button below to reset your Skyrio password. This link expires in <strong>1 hour</strong>.",
    cta: { label: "Reset Password", url: resetUrl },
    footerNote: "If you didn't request this, you can safely ignore this email.",
  });
  const text = `Reset your Skyrio password.

Click the link below (expires in 1 hour):
${resetUrl}

If you didn't request this, you can safely ignore this email.${SIGNOFF}`;

  return sendEmail({
    to,
    subject: "Reset your Skyrio password",
    html,
    text,
    tag: "password-reset",
  });
}

/**
 * Email verification
 */
export async function sendVerificationEmail({ to, verifyUrl }) {
  const html = renderEmail({
    preheader: "Verify your Skyrio email (link expires in 24 hours)",
    title: "Verify your email ✈️",
    introHtml:
      "Click below to verify your Skyrio account. This link expires in <strong>24 hours</strong>.",
    cta: { label: "Verify Email", url: verifyUrl },
    footerNote: "If you didn't create a Skyrio account, ignore this email.",
  });
  const text = `Verify your Skyrio email.

Click the link below (expires in 24 hours):
${verifyUrl}

If you didn't create a Skyrio account, ignore this email.${SIGNOFF}`;

  return sendEmail({
    to,
    subject: "Verify your Skyrio email",
    html,
    text,
    tag: "verify",
  });
}

// ─────────────────────────────────────────────────────────────
// Flight booking confirmation (+ .ics calendar attachment)
// ─────────────────────────────────────────────────────────────

// Flight times arrive as local airport times with no timezone. They're
// written as "floating" calendar times (no Z, no TZID): calendars show them
// as-is in the viewer's clock — honestly imprecise rather than confidently
// wrong, until airport timezone data is available.
function toICSDateTime(isoLocal) {
  return String(isoLocal).replace(/[-:]/g, "").split(".")[0].replace(/Z$/, "");
}

function escapeICSText(str = "") {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildFlightICS({
  confirmationNumber,
  airline,
  flightNumber,
  origin,
  destination,
  originName,
  destinationName,
  departureAt,
  arrivalAt,
  returnDepartureAt,
  returnArrivalAt,
  returnFlightNumber,
}) {
  const now = toICSDateTime(new Date().toISOString());
  const events = [];

  if (departureAt && arrivalAt) {
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:${confirmationNumber}-outbound@myskyrio.com`,
        `DTSTAMP:${now}Z`,
        `DTSTART:${toICSDateTime(departureAt)}`,
        `DTEND:${toICSDateTime(arrivalAt)}`,
        `SUMMARY:${escapeICSText(
          `Flight ${origin} → ${destination}${
            flightNumber ? ` (${airline || ""} ${flightNumber})`.trim() : ""
          }`
        )}`,
        `DESCRIPTION:${escapeICSText(
          `Reference: ${confirmationNumber}\nAirline: ${
            airline || "N/A"
          }\nFlight: ${flightNumber || "N/A"}`
        )}`,
        `LOCATION:${escapeICSText(originName || origin)}`,
        "END:VEVENT",
      ].join("\r\n")
    );
  }

  if (returnDepartureAt && returnArrivalAt) {
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:${confirmationNumber}-return@myskyrio.com`,
        `DTSTAMP:${now}Z`,
        `DTSTART:${toICSDateTime(returnDepartureAt)}`,
        `DTEND:${toICSDateTime(returnArrivalAt)}`,
        `SUMMARY:${escapeICSText(
          `Flight ${destination} → ${origin}${
            returnFlightNumber
              ? ` (${airline || ""} ${returnFlightNumber})`.trim()
              : ""
          }`
        )}`,
        `DESCRIPTION:${escapeICSText(
          `Reference: ${confirmationNumber}\nAirline: ${
            airline || "N/A"
          }\nFlight: ${returnFlightNumber || "N/A"}`
        )}`,
        `LOCATION:${escapeICSText(destinationName || destination)}`,
        "END:VEVENT",
      ].join("\r\n")
    );
  }

  if (!events.length) return null;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skyrio//Booking Confirmation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function formatDisplay(isoLocal) {
  if (!isoLocal) return "";
  // Treat as local airport time: strip any zone so it isn't shifted.
  const d = new Date(String(isoLocal).replace(/Z$|[+-]\d{2}:?\d{2}$/, ""));
  if (Number.isNaN(d.getTime())) return String(isoLocal);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Flight booking confirmation.
 * confirmationIsAirline: true when confirmationNumber is the airline's own
 * code (PNR). Otherwise it's labeled "Booking reference" so travelers don't
 * mistake an internal ID for the code the airline asks for.
 */
export async function sendBookingConfirmation({
  to,
  passengerName,
  confirmationNumber,
  confirmationIsAirline = false,
  airline,
  flightNumber,
  returnFlightNumber,
  origin,
  destination,
  originName,
  destinationName,
  departureAt,
  arrivalAt,
  returnDepartureAt,
  returnArrivalAt,
  totalAmount,
  currency = "USD",
  cabinClass,
}) {
  const isRoundTrip = Boolean(returnDepartureAt);
  const total = totalAmount != null ? formatMoney(totalAmount, currency) : null;
  const refLabel = confirmationIsAirline
    ? "Airline confirmation"
    : "Booking reference";

  const legLine = (when, num) =>
    subLine(
      `${esc(formatDisplay(when))}${airline ? ` · ${esc(airline)}` : ""}${
        num ? ` ${esc(num)}` : ""
      }`
    );

  const bodyHtml =
    detailBox(
      "DEPARTING",
      bigLine(`${esc(origin)} → ${esc(destination)}`) +
        legLine(departureAt, flightNumber)
    ) +
    (isRoundTrip
      ? detailBox(
          "RETURNING",
          bigLine(`${esc(destination)} → ${esc(origin)}`) +
            legLine(returnDepartureAt, returnFlightNumber)
        )
      : "") +
    detailBox(
      "",
      kvRow(refLabel, esc(confirmationNumber)) +
        (cabinClass ? kvRow("Cabin", esc(cabinClass)) : "") +
        (total ? kvRow("Total paid", esc(total), { highlight: true }) : "")
    );

  const ics = buildFlightICS({
    confirmationNumber,
    airline,
    flightNumber,
    origin,
    destination,
    originName,
    destinationName,
    departureAt,
    arrivalAt,
    returnDepartureAt,
    returnArrivalAt,
    returnFlightNumber,
  });

  const html = renderEmail({
    preheader: `${origin} → ${destination}${
      isRoundTrip ? " round trip" : ""
    } is confirmed`,
    title: "You're booked! ✈️",
    introHtml: `Thanks${
      passengerName ? `, <strong>${esc(passengerName)}</strong>` : ""
    }! Your flight${isRoundTrip ? "s are" : " is"} confirmed.`,
    bodyHtml,
    cta: { label: "View my trips", url: `${APP_URL}/saved-trips` },
    footerNote: ics
      ? "Open the attached calendar file to add this trip to your calendar."
      : "",
  });

  const text = `You're booked!${
    passengerName ? ` Thanks, ${passengerName}.` : ""
  }

Departing: ${origin} -> ${destination}
${formatDisplay(departureAt)}${airline ? ` · ${airline}` : ""}${
    flightNumber ? ` ${flightNumber}` : ""
  }
${
  isRoundTrip
    ? `\nReturning: ${destination} -> ${origin}\n${formatDisplay(
        returnDepartureAt
      )}${airline ? ` · ${airline}` : ""}${
        returnFlightNumber ? ` ${returnFlightNumber}` : ""
      }\n`
    : ""
}
${refLabel}: ${confirmationNumber}
${cabinClass ? `Cabin: ${cabinClass}\n` : ""}${
    total ? `Total paid: ${total}\n` : ""
  }
View your trips: ${APP_URL}/saved-trips${SIGNOFF}`;

  return sendEmail({
    to,
    subject: `You're booked: ${origin} → ${destination}${
      isRoundTrip ? " (round trip)" : ""
    }`,
    html,
    text,
    attachments: ics
      ? [
          {
            filename: "flight-itinerary.ics",
            content: Buffer.from(ics, "utf-8").toString("base64"),
          },
        ]
      : undefined,
    tag: "flight-confirmation",
  });
}
