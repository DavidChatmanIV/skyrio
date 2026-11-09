// src/components/events/EventCard.jsx
// One event card. Price only shows when Ticketmaster actually provides it.

const CATEGORY_LABEL = { sports: "Sports", music: "Concert", shows: "Show", family: "Family", other: "Event" };

function formatDate(dateStr) {
  if (!dateStr) return "Date TBA";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "Time TBA";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatPrice(pr) {
  if (!pr) return null;
  const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: pr.currency || "USD", maximumFractionDigits: 0 });
  return `From ${fmt.format(pr.min)}`;
}

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);
const PlaneIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M10.5 13.5 3 11l1.5-1.5 8 1 4-4.5a2 2 0 0 1 3 3l-4.5 4 1 8L14.5 22l-2.5-7.5" />
  </svg>
);
const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);

export default function EventCard({ event, onPlanTrip, extra = null }) {
  const price = formatPrice(event.priceRange);
  const venue = event.venue;
  const canPlan = Boolean(onPlanTrip && venue && event.suggestedDates);
  const isChanged = event.status === "postponed" || event.status === "rescheduled";

  return (
    <article className="sk-event-card">
      <div className="sk-event-media">
        {event.image ? (
          <img src={event.image} alt="" loading="lazy" />
        ) : (
          <div className="sk-event-media-fallback" />
        )}
        <span className="sk-event-chip">{event.genre || CATEGORY_LABEL[event.category]}</span>
        {isChanged && <span className="sk-event-chip sk-event-chip--warn">{event.status === "postponed" ? "Postponed" : "Rescheduled"}</span>}
      </div>

      <div className="sk-event-body">
        <h3 className="sk-event-title">{event.name}</h3>

        <p className="sk-event-line">
          <CalendarIcon /> {formatDate(event.date)} · {formatTime(event.time)}
        </p>
        {venue && (
          <p className="sk-event-line">
            <PinIcon /> {venue.name}{venue.city ? `, ${venue.city}` : ""}
          </p>
        )}

        {price && <p className="sk-event-price">{price}</p>}

        <div className="sk-event-actions">
          {canPlan && (
            <button type="button" className="sk-event-btn sk-event-btn--primary" onClick={() => onPlanTrip(event)}>
              <PlaneIcon /> Plan a trip around it
            </button>
          )}
          {event.url && (
            <a className="sk-event-btn sk-event-btn--ghost" href={event.url} target="_blank" rel="noopener noreferrer">
              Buy on Ticketmaster <ExternalIcon />
            </a>
          )}
        </div>
        {extra && <div className="sk-event-extra">{extra}</div>}
      </div>
    </article>
  );
}
