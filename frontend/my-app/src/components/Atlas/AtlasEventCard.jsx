// Event card in the Atlas chat (from the show_event tool).
// "Buy on Ticketmaster" opens Ticketmaster (Skyrio doesn't sell tickets).
// "Plan a trip around it" asks Atlas to find flights + a hotel for the
// day before → day after.
import dayjs from "dayjs";
import { Ticket, ExternalLink, Plane, MapPin, CalendarDays } from "lucide-react";

const money = (n, cur = "USD") => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${Math.round(v)}`;
  }
};

export default function AtlasEventCard({ action }) {
  const when = action.date
    ? dayjs(`${action.date}T${action.time || "12:00"}`).format(action.time ? "ddd, MMM D · h:mm A" : "ddd, MMM D")
    : "Date TBA";
  const where = [action.venue, [action.city, action.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const price = action.priceFrom != null ? money(action.priceFrom, action.currency) : null;

  const planTrip = () => {
    const d = action.tripDates;
    const dates = d?.departDate && d?.returnDate ? ` from ${d.departDate} to ${d.returnDate}` : "";
    window.dispatchEvent(
      new CustomEvent("skyrio:open-atlas", {
        detail: {
          mode: "chat",
          message: `Plan a trip around ${action.name} in ${action.city || "that city"}${dates}. Find me flights and a hotel.`,
        },
      })
    );
  };

  return (
    <section className="ap-card" aria-label={`Event: ${action.name}`}>
      {action.image && (
        <img
          src={action.image}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 10, display: "block" }}
        />
      )}
      <div className="ap-card__top">
        <Ticket size={16} aria-hidden="true" />
        <div>
          <div className="ap-card__eyebrow">Event</div>
          <div className="ap-card__trip">{action.name}</div>
        </div>
      </div>
      <div className="ap-card__body">
        <div className="ap-card__rows">
          <div className="ap-card__row">
            <CalendarDays size={13} className="ap-inline-icon" aria-hidden="true" /> {when}
          </div>
          {where && (
            <div className="ap-card__row">
              <MapPin size={13} className="ap-inline-icon" aria-hidden="true" /> {where}
            </div>
          )}
          {price && (
            <div className="ap-card__row">
              Tickets from <b>{price}</b>
            </div>
          )}
        </div>
        <div className="ap-card__note">Tickets are sold by Ticketmaster, not Skyrio.</div>
        <div className="ap-card__btns">
          <a className="ap-card__btn is-primary" href={action.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            Buy on Ticketmaster <ExternalLink size={12} aria-hidden="true" />
          </a>
          <button type="button" className="ap-card__btn" onClick={planTrip}>
            <Plane size={13} aria-hidden="true" /> Plan a trip around it
          </button>
        </div>
      </div>
    </section>
  );
}
