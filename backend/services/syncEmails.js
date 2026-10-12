// backend/services/syncEmails.js
// Sync Together emails: reminders and shared-room updates.
// Built on the same light/dark-safe layout as every other Skyrio email.

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
  APP_URL,
  TRIPS_URL,
} from "./emailLayout.js";

export const groupUrl = (groupId) => `${APP_URL}/sync-together/${groupId}`;

const cents = (n, currency) => formatMoney((Number(n) || 0) / 100, String(currency || "USD").toUpperCase());

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(String(v).length === 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtDeadline(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function roomBox(room) {
  return detailBox(
    "THE ROOM",
    [
      bigLine(esc(room?.name || "Hotel stay")),
      room?.roomName ? subLine(esc(`${room.roomName}${room.boardName ? ` · ${room.boardName}` : ""}`)) : "",
      room?.checkin ? subLine(esc(`${fmtDate(room.checkin)} → ${fmtDate(room.checkout)}`)) : "",
    ].join("")
  );
}

// ── "Your part of the trip is still open" ──
export function sendGroupReminder({ to, name, organizerName, tripTitle, destination, groupId, needs = [] }) {
  const list = needs.length
    ? detailBox("STILL TO DO", needs.map((n) => subLine(`• ${esc(n)}`)).join(""))
    : "";
  return sendEmail({
    to,
    tag: "sync-reminder",
    subject: `Reminder: finish your part of ${tripTitle || "the group trip"}`,
    html: renderEmail({
      preheader: `${organizerName || "Your organizer"} sent a reminder about ${tripTitle || "your trip"}`,
      title: "Your group is waiting on you ⏰",
      introHtml: `Hi ${esc(name || "there")}, <strong>${esc(organizerName || "your organizer")}</strong> sent a reminder about <strong>${esc(tripTitle || "your trip")}</strong>${destination ? ` to ${esc(destination)}` : ""}.`,
      bodyHtml: list,
      cta: { label: "Open the trip", url: groupUrl(groupId) },
      footerNote: "Everyone books and pays for their own part, so nobody is charged for you.",
    }),
  });
}

// ── A shared room was set up and this person has a share to hold ──
export function sendShareRequested({ to, name, organizerName, room, shareCents, currency, people, deadline, groupId }) {
  return sendEmail({
    to,
    tag: "shared-room-requested",
    subject: `Hold your share of the room at ${room?.name || "the hotel"}`,
    html: renderEmail({
      preheader: `Your share is ${cents(shareCents, currency)}. Hold it by ${fmtDeadline(deadline)}.`,
      title: "You're sharing a room 🛏️",
      introHtml: `Hi ${esc(name || "there")}, <strong>${esc(organizerName || "your organizer")}</strong> picked a room for ${people} people. Put a hold on your card for your share.`,
      bodyHtml:
        roomBox(room) +
        detailBox(
          "YOUR SHARE",
          kvRow("Amount", cents(shareCents, currency), { highlight: true }) +
            kvRow("Hold it by", esc(fmtDeadline(deadline))) +
            noteLine("Your card is held, not charged. Nobody is charged until everyone has put a hold in. If someone doesn't by the deadline, every hold is released.")
        ),
      cta: { label: "Hold my share", url: groupUrl(groupId) },
    }),
  });
}

// ── Everyone held → the room is booked and each card charged ──
export function sendSharedRoomBooked({ to, name, room, shareCents, currency, people, confirmationCode, bookingId }) {
  return sendEmail({
    to,
    tag: "shared-room-booked",
    subject: `Your shared room at ${room?.name || "the hotel"} is booked`,
    html: renderEmail({
      preheader: `Everyone's in — the room is booked. You paid ${cents(shareCents, currency)}.`,
      title: "Everyone's in. Room booked! 🏨",
      introHtml: `Hi ${esc(name || "there")}, all ${people} people held their share, so the room is booked.`,
      bodyHtml:
        roomBox(room) +
        detailBox(
          "",
          kvRow("You paid", cents(shareCents, currency), { highlight: true }) +
            (confirmationCode ? kvRow("Hotel confirmation", esc(confirmationCode)) : "") +
            (bookingId ? kvRow("Skyrio booking ID", esc(String(bookingId).slice(-10))) : "") +
            noteLine("Only the trip organizer can cancel a shared room. If it's cancelled, each person is refunded their share of whatever the hotel refunds.")
        ),
      cta: { label: "View my trips", url: TRIPS_URL },
    }),
  });
}

// ── Holds released — nobody was charged ──
const RELEASE_COPY = {
  expired: "Not everyone held their share before the deadline.",
  released: "The organizer released the room.",
  member_left: "Someone sharing the room left the trip.",
  price_changed: "The hotel raised the price before everyone was in.",
  sold_out: "The hotel no longer has this room.",
  failed: "The hotel couldn't confirm the room.",
};
export function sendSharedRoomReleased({ to, name, room, reason, groupId }) {
  return sendEmail({
    to,
    tag: "shared-room-released",
    subject: `Shared room released — you weren't charged`,
    html: renderEmail({
      preheader: "Your hold has been released. Nothing was charged.",
      title: "Room released — no charge",
      introHtml: `Hi ${esc(name || "there")}, ${esc(RELEASE_COPY[reason] || RELEASE_COPY.released)} Your hold has been released and you weren't charged.`,
      bodyHtml: roomBox(room) + noteLine("A released hold usually disappears from your card within a few days, depending on your bank."),
      cta: { label: "Open the trip", url: groupUrl(groupId) },
    }),
  });
}

// ── Organizer cancelled a booked shared room ──
export function sendSharedRoomCancelled({ to, name, room, refundCents, currency, organizerName }) {
  return sendEmail({
    to,
    tag: "shared-room-cancelled",
    subject: `Shared room at ${room?.name || "the hotel"} cancelled`,
    html: renderEmail({
      preheader: refundCents > 0 ? `Your refund: ${cents(refundCents, currency)}` : "No refund applies under the hotel's policy",
      title: "Shared room cancelled",
      introHtml: `Hi ${esc(name || "there")}, ${esc(organizerName || "the organizer")} cancelled the shared room.`,
      bodyHtml:
        roomBox(room) +
        detailBox(
          "YOUR REFUND",
          kvRow("Amount", refundCents > 0 ? cents(refundCents, currency) : "None", { highlight: refundCents > 0 }) +
            noteLine(
              refundCents > 0
                ? "Your share of the hotel's refund goes back to the card you paid with, usually in 5–10 business days."
                : "Under the hotel's cancellation policy, no refund applies."
            )
        ),
      cta: { label: "View my trips", url: TRIPS_URL },
    }),
  });
}

// ── Automatic: deadline is close and this person hasn't held their share ──
export function sendShareDeadlineReminder({ to, name, room, shareCents, currency, deadline, groupId, heldCount, people, hoursLeft }) {
  const urgent = hoursLeft <= 6;
  return sendEmail({
    to,
    tag: "shared-room-deadline",
    subject: urgent
      ? `Last call: hold your share of ${room?.name || "the room"} (about ${hoursLeft}h left)`
      : `Reminder: hold your share of ${room?.name || "the room"} by tomorrow`,
    html: renderEmail({
      preheader: `${heldCount} of ${people} have held their share. The room is released at ${fmtDeadline(deadline)} if not everyone is in.`,
      title: urgent ? "Last call for the shared room ⏳" : "Your group is waiting on your share 🛏️",
      introHtml: `Hi ${esc(name || "there")}, ${heldCount} of ${people} people have held their share. If everyone isn't in by the deadline, the room is released for everyone.`,
      bodyHtml:
        roomBox(room) +
        detailBox(
          "YOUR SHARE",
          kvRow("Amount", cents(shareCents, currency), { highlight: true }) +
            kvRow("Deadline", esc(fmtDeadline(deadline))) +
            noteLine("Your card is held, not charged, until everyone is in.")
        ),
      cta: { label: "Hold my share", url: groupUrl(groupId) },
    }),
  });
}

// ── Everyone on the trip has booked a flight and a room ──
export function sendEveryoneBooked({ to, name, tripTitle, destination, arrivals = [], groupId }) {
  const fmt = (v) => {
    if (!v) return "No flight time";
    const d = new Date(String(v).slice(0, 16));
    return Number.isNaN(d.getTime())
      ? String(v)
      : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  return sendEmail({
    to,
    tag: "sync-everyone-booked",
    subject: `Everyone's booked for ${tripTitle || "your trip"} 🎉`,
    html: renderEmail({
      preheader: `Every traveler has booked their flight and room${destination ? ` for ${destination}` : ""}.`,
      title: "Everyone's booked! 🎉",
      introHtml: `Hi ${esc(name || "there")}, every traveler on <strong>${esc(tripTitle || "your trip")}</strong> has booked their flight and room.`,
      bodyHtml: arrivals.length
        ? detailBox("WHO LANDS WHEN", arrivals.map((a) => kvRow(esc(a.name), esc(fmt(a.arrivesAt)))).join("") + noteLine("Times are local to the arrival airport."))
        : "",
      cta: { label: "Open the trip", url: groupUrl(groupId) },
      footerNote: "Your own confirmation email has your booking details. You can cancel your own part anytime from My Trips.",
    }),
  });
}
