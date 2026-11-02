// backend/services/manageEmails.js
// The email sent from the Find my booking page: one secure link to manage
// or cancel a booking. Same light/dark-safe layout as every Skyrio email.
import {
  renderEmail,
  sendEmail,
  detailBox,
  bigLine,
  subLine,
  noteLine,
  esc,
} from "./emailLayout.js";
import { manageUrlFor } from "./manageLink.js";

const dayText = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
};

export function sendManageLinkEmail({ to, booking }) {
  const isHotel = booking.type === "Hotel";
  const room = booking.hotelStay?.rooms?.[0];
  const f = booking.flight || {};
  const title = isHotel
    ? room?.name || booking.tripDetails || "Your stay"
    : f.origin && f.destination
    ? `${f.origin} → ${f.destination}${f.airline ? ` · ${f.airline}` : ""}`
    : booking.tripDetails || "Your flight";
  const start = dayText(booking.dates?.start);
  const end = dayText(booking.dates?.end);
  const name = String(booking.name || "").split(" ")[0];

  return sendEmail({
    to,
    tag: "booking-manage-link",
    subject: `Manage your Skyrio booking: ${title}`,
    html: renderEmail({
      preheader: "Your secure link to view or cancel this booking.",
      title: "Here's your booking",
      introHtml: `Hi ${esc(
        name || "there"
      )}, use the button below to view or cancel this booking. You don't need an account.`,
      bodyHtml:
        detailBox(
          isHotel ? "YOUR STAY" : "YOUR FLIGHT",
          [
            bigLine(esc(title)),
            start
              ? subLine(esc(end && end !== start ? `${start} → ${end}` : start))
              : "",
          ].join("")
        ) +
        noteLine(
          "This link only works for this booking. Didn't ask for it? You can ignore this email. Nothing changes unless you confirm a cancellation."
        ),
      cta: { label: "Manage or cancel", url: manageUrlFor(booking._id) },
    }),
  });
}
