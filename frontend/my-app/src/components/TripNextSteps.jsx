// "What's next for your trip": shown after a flight or stay is booked, so
// the traveler is walked to the next piece (stay → car → things to do),
// each already filled in. Purple glass to match Skyrio.
import { BedDouble, Car, Compass, Ticket, Check, ArrowRight } from "lucide-react";
import { nextLinks } from "@/lib/tripNext";

const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

const CSS = `
.tns { margin: 20px auto 0; width: 100%; max-width: 560px; text-align: left; padding: 18px 16px 14px;
  border-radius: 18px; color: #fff; position: relative; overflow: hidden;
  background: linear-gradient(160deg, rgba(74,40,112,.58) 0%, rgba(34,18,62,.66) 100%);
  border: 1px solid rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.1); }
.tns::before { content: ""; position: absolute; top: 0; left: 20px; right: 20px; height: 3px;
  border-radius: 0 0 3px 3px; background: linear-gradient(90deg, #ff8a2a, #ffb347 50%, #8b5cf6); }
.tns__eyebrow { font: 700 10.5px ui-monospace, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; color: #ffb347; }
.tns__title { margin: 4px 0 2px; font-size: 18px; font-weight: 800; }
.tns__budget { margin: 0 0 10px; font-size: 13.5px; color: rgba(255,255,255,.78); }
.tns__budget b { color: #fff; }
.tns__list { display: grid; gap: 8px; margin-top: 10px; }
.tns__row, .tns__row:visited { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 10px 12px;
  border-radius: 14px; text-decoration: none !important; color: #fff !important;
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); }
.tns__row.is-next { background: linear-gradient(135deg, #ff8a2a, #ffb347); color: #1a0e06 !important; border-color: transparent;
  box-shadow: 0 10px 26px rgba(255,138,42,.35); }
.tns__row.is-done { opacity: .7; }
.tns__icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: rgba(255,255,255,.1); }
.tns__row.is-next .tns__icon { background: rgba(26,14,6,.12); }
.tns__text { flex: 1; min-width: 0; display: grid; }
.tns__text b { font-size: 15px; }
.tns__text small { font-size: 12.5px; opacity: .8; }
.tns__go { flex-shrink: 0; }
.tns__note { margin: 10px 2px 0; font-size: 12px; color: rgba(255,255,255,.6); }
@media (hover: hover) { .tns__row:hover { border-color: rgba(255,179,71,.6); } }
.tns__row:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
`;

const nights = (a, b) => {
  const x = Date.parse(String(a || "").slice(0, 10)), y = Date.parse(String(b || "").slice(0, 10));
  return Number.isFinite(x) && Number.isFinite(y) && y > x ? Math.round((y - x) / 86400000) : null;
};
const shortDate = (v) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

/**
 * trip: from lib/tripNext (city, code, arriveAt, leaveAt, adults, budget, spent, have)
 * Rows: Stay (unless booked) → Car → Things to do → Events. The first one
 * not done yet is the highlighted "next" step.
 */
export default function TripNextSteps({ trip, onNavigate }) {
  if (!trip?.city) return null;
  const links = nextLinks(trip);
  const have = trip.have || {};
  const n = nights(trip.arriveAt, trip.leaveAt);
  const dates = trip.arriveAt && trip.leaveAt ? `${shortDate(trip.arriveAt)} – ${shortDate(trip.leaveAt)}` : "";
  const left = trip.budget ? trip.budget - (Number(trip.spent) || 0) : null;

  const rows = [
    !have.stay && {
      key: "stay",
      to: links.stay,
      Icon: BedDouble,
      title: `Find a place to stay in ${trip.city}`,
      sub: [dates, n ? `${n} night${n === 1 ? "" : "s"}` : "", "check-in the day you land"].filter(Boolean).join(" · "),
    },
    !have.car && {
      key: "car",
      to: links.car,
      Icon: Car,
      title: `Rent a car${trip.code ? ` at ${trip.code}` : ""}`,
      sub: "Pick up after you land · paid to the rental company at pickup",
    },
    {
      key: "things",
      to: links.things,
      Icon: Compass,
      title: "Things to do",
      sub: "Tours and activities for your dates",
    },
    {
      key: "events",
      to: links.events,
      Icon: Ticket,
      title: "Events while you're there",
      sub: "Concerts, games and shows · tickets on Ticketmaster",
    },
  ].filter(Boolean);

  return (
    <section className="tns" aria-label="Next steps for your trip">
      <style>{CSS}</style>
      <div className="tns__eyebrow">Your trip to {trip.city}</div>
      <div className="tns__title">
        {have.flight && have.stay ? "Flight and stay done. Anything else?" : have.stay ? "Stay booked. What's next?" : "Flight booked. What's next?"}
      </div>
      {left != null && (
        <p className="tns__budget">
          {left >= 0 ? (
            <>
              <b>{usd(left)} left</b> of your {usd(trip.budget)} budget
            </>
          ) : (
            <>
              <b>{usd(-left)} over</b> your {usd(trip.budget)} budget
            </>
          )}
        </p>
      )}
      <div className="tns__list">
        {have.flight && (
          <div className="tns__row is-done" aria-label="Flight booked">
            <span className="tns__icon">
              <Check size={18} aria-hidden="true" />
            </span>
            <span className="tns__text">
              <b>Flight</b>
              <small>Booked</small>
            </span>
          </div>
        )}
        {have.stay && (
          <div className="tns__row is-done" aria-label="Stay booked">
            <span className="tns__icon">
              <Check size={18} aria-hidden="true" />
            </span>
            <span className="tns__text">
              <b>Stay</b>
              <small>Booked</small>
            </span>
          </div>
        )}
        {rows.map((r, i) => (
          // A full page load on purpose: the Book page reads these links
          // when it opens (tab, city, dates, auto-search), and checkout
          // screens sit on top of it.
          <a key={r.key} href={r.to} className={`tns__row${i === 0 ? " is-next" : ""}`} onClick={onNavigate}>
            <span className="tns__icon">
              <r.Icon size={18} aria-hidden="true" />
            </span>
            <span className="tns__text">
              <b>{i === 0 ? `Next: ${r.title}` : r.title}</b>
              {r.sub && <small>{r.sub}</small>}
            </span>
            <ArrowRight className="tns__go" size={18} aria-hidden="true" />
          </a>
        ))}
      </div>
      <p className="tns__note">Each one is booked and paid on its own. Nothing is added until you choose it.</p>
    </section>
  );
}
