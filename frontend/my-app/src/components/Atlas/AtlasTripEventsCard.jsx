// "During your trip": up to 3 real Ticketmaster events and up to 3 Viator
// tours Atlas found for the trip's city and dates. Every link comes from
// Ticketmaster's or Viator's own data. Skyrio sells neither; nothing here
// changes the trip.
import dayjs from "dayjs";
import { Ticket, ExternalLink, Compass, Star, Clock } from "lucide-react";

const money = (n, cur = "USD") => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${Math.round(v)}`;
  }
};

const realLink = (x) => /^https:\/\//.test(String(x?.url || ""));
const goodEvents = (a) => (Array.isArray(a?.events) ? a.events : []).filter((e) => e?.name && realLink(e)).slice(0, 3);
const goodTours = (a) => (Array.isArray(a?.excursions) ? a.excursions : []).filter((x) => x?.title && realLink(x)).slice(0, 3);

export const isTripEventsAction = (a) =>
  a?.type === "trip_events" && (goodEvents(a).length > 0 || goodTours(a).length > 0);

export default function AtlasTripEventsCard({ action }) {
  const events = goodEvents(action);
  const tours = goodTours(action);
  return (
    <section className="ap-card" aria-label="During your trip">
      <div className="ap-card__top">
        {events.length ? <Ticket size={16} aria-hidden="true" /> : <Compass size={16} aria-hidden="true" />}
        <div>
          <div className="ap-card__eyebrow">During your trip</div>
          <div className="ap-card__trip">
            {action.place ? `Happening in ${action.place}` : "Happening while you're there"}
          </div>
        </div>
      </div>
      <div className="ap-card__body">
        {events.length > 0 && (
          <div className="ap-tev__group">
            <div className="ap-tev__label">Events</div>
            <ul className="ap-tev">
              {events.map((e) => {
                const when = e.date
                  ? dayjs(`${e.date}T${e.time || "12:00"}`).format(e.time ? "ddd, MMM D · h:mm A" : "ddd, MMM D")
                  : "";
                const price = e.priceFrom != null ? money(e.priceFrom, e.currency) : null;
                return (
                  <li key={`${e.name}-${e.date}`} className="ap-tev__row">
                    <div className="ap-tev__name">{e.name}</div>
                    <div className="ap-tev__meta">
                      {[when, e.venue].filter(Boolean).join(" · ")}
                      {e.status ? ` · ${e.status}` : ""}
                      {price ? ` · from ${price}` : ""}
                    </div>
                    <a className="ap-card__btn is-primary ap-tev__buy" href={e.url} target="_blank" rel="noopener noreferrer">
                      Buy on Ticketmaster <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="ap-card__note">Tickets are sold by Ticketmaster, not Skyrio.</div>
          </div>
        )}
        {tours.length > 0 && (
          <div className="ap-tev__group">
            <div className="ap-tev__label">Things to do</div>
            <ul className="ap-tev">
              {tours.map((x) => {
                const price = x.priceFrom != null ? money(x.priceFrom, x.currency) : null;
                return (
                  <li key={x.title} className="ap-tev__row">
                    <div className="ap-tev__name">{x.title}</div>
                    <div className="ap-tev__meta">
                      {x.rating ? (
                        <span className="ap-tev__bit">
                          <Star size={11} aria-hidden="true" fill="#ffb347" color="#ffb347" /> {x.rating.toFixed(1)}
                          {x.reviewCount ? ` (${x.reviewCount.toLocaleString("en-US")})` : ""}
                        </span>
                      ) : null}
                      {x.duration ? (
                        <span className="ap-tev__bit">
                          <Clock size={11} aria-hidden="true" /> {x.duration}
                        </span>
                      ) : null}
                      {price ? <span className="ap-tev__bit">from {price}</span> : null}
                      {x.freeCancellation ? <span className="ap-tev__bit">Free cancellation</span> : null}
                    </div>
                    <a className="ap-card__btn is-primary ap-tev__buy" href={x.url} target="_blank" rel="noopener noreferrer">
                      View on Viator <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="ap-card__note">Booked on Viator, not Skyrio.</div>
          </div>
        )}
        <div className="ap-card__note">Your trip stays the same unless you add something.</div>
      </div>
    </section>
  );
}
