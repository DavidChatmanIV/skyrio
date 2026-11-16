// "During your trip": 2–3 real Ticketmaster events Atlas found for the trip's
// city and dates. Every link comes from Ticketmaster's data. Tickets are
// sold by Ticketmaster; nothing here changes the trip.
import dayjs from "dayjs";
import { Ticket, ExternalLink } from "lucide-react";

const money = (n, cur = "USD") => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${Math.round(v)}`;
  }
};

export const isTripEventsAction = (a) =>
  a?.type === "trip_events" &&
  Array.isArray(a.events) &&
  a.events.some((e) => e?.name && /^https:\/\//.test(String(e.url || "")));

export default function AtlasTripEventsCard({ action }) {
  const events = action.events
    .filter((e) => e?.name && /^https:\/\//.test(String(e.url || "")))
    .slice(0, 3);
  return (
    <section className="ap-card" aria-label="Events during your trip">
      <div className="ap-card__top">
        <Ticket size={16} aria-hidden="true" />
        <div>
          <div className="ap-card__eyebrow">During your trip</div>
          <div className="ap-card__trip">
            {action.place ? `Happening in ${action.place}` : "Happening while you're there"}
          </div>
        </div>
      </div>
      <div className="ap-card__body">
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
        <div className="ap-card__note">
          Tickets are sold by Ticketmaster, not Skyrio. Your trip stays the same.
        </div>
      </div>
    </section>
  );
}
