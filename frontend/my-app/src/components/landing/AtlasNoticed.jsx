// Home page, signed in: "Next trip" (their soonest booking) and
// "Your travel style" — a small, quiet card on the home page for signed-in
// travelers. Shows up to 3 true things from their own trips and what Atlas
// learned (GET /api/atlas/for-you). Nothing shows for new travelers, when
// "Let Atlas learn" is off, or for 30 days after they hide it.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Plane,
  Moon,
  CalendarDays,
  Users,
  X,
  BedDouble,
  CloudSun,
  TriangleAlert,
  ChevronRight,
} from "lucide-react";
import { atlasApi } from "@/components/Atlas/atlasApi";

const HIDE_KEY = "skyrio_atlas_noticed_hidden_until";
const HIDE_DAYS = 30;
const ICONS = {
  plane: Plane,
  moon: Moon,
  calendar: CalendarDays,
  users: Users,
  spark: Sparkles,
};

const hiddenNow = () => {
  try {
    return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
};

const CSS = `
.an { position: relative; margin: 22px auto 0; max-width: 560px; padding: 16px 18px; border-radius: 18px; text-align: left; color: #fff;
  background: linear-gradient(135deg, rgba(92,52,160,.55), rgba(60,32,96,.55)); border: 1px solid rgba(255,255,255,.18);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 10px 30px rgba(20,8,40,.35); }
.an-head { display: flex; align-items: center; gap: 8px; padding-right: 30px; }
.an-head b { font-size: 14.5px; }
.an-head svg { color: #ffb347; flex-shrink: 0; }
.an-sub { margin: 4px 0 10px; font-size: 13px; color: rgba(255,255,255,.72); }
.an-x { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 999px;
  border: 0; background: transparent; color: rgba(255,255,255,.7); cursor: pointer; }
.an-x:hover { color: #fff; background: rgba(255,255,255,.1); }
.an-x:focus-visible, .an-btn:focus-visible, .an-link:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.an-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.an-list li { display: flex; gap: 10px; align-items: flex-start; }
.an-list svg { color: #c9b8ff; flex-shrink: 0; margin-top: 2px; }
.an-text { font-size: 14px; font-weight: 600; line-height: 1.35; }
.an-src { display: block; font-size: 12px; font-weight: 500; color: rgba(255,255,255,.6); }
.an-foot { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.an-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 999px; cursor: pointer;
  font: inherit; font-size: 13.5px; font-weight: 700; color: #fff; background: rgba(255,138,42,.18); border: 1px solid rgba(255,179,71,.6); }
.an-btn:hover { background: rgba(255,138,42,.3); }
.an-link { display: inline-flex; align-items: center; min-height: 36px; margin: 0; padding: 0 4px; font-size: 13.5px; font-weight: 700; line-height: 1; color: #ffb347; text-decoration: none; white-space: nowrap; }
.an-link:hover { text-decoration: underline; }
.nt { display: flex; align-items: center; gap: 12px; margin: 22px auto 0; max-width: 560px; padding: 14px 16px; border-radius: 18px; text-align: left; color: #fff; text-decoration: none;
  background: linear-gradient(135deg, rgba(92,52,160,.55), rgba(60,32,96,.55)); border: 1px solid rgba(255,179,71,.35);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 10px 30px rgba(20,8,40,.35); }
.an-stack a.nt, .an-stack a.nt:hover, .an-stack a.nt:active, .an-stack a.nt:visited { color: #fff; }
.an-stack a.an-link, .an-stack a.an-link:hover, .an-stack a.an-link:active, .an-stack a.an-link:visited { color: #ffb347; }
.nt, .an-link { -webkit-tap-highlight-color: transparent; }
@media (hover: hover) { .nt:hover { border-color: rgba(255,179,71,.7); } }
.nt:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.nt-icon { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.nt-body { flex: 1; min-width: 0; }
.nt-label { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #ffb347; }
.nt-main { display: block; margin-top: 2px; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nt-line { display: flex; align-items: flex-start; gap: 6px; margin-top: 4px; font-size: 13px; color: rgba(255,255,255,.78); }
.nt-line svg { flex: none; margin-top: 2px; color: #c9b8ff; }
.nt-line.warn svg { color: #ffb347; }
.nt-fine { display: block; margin: 2px 0 0 20px; font-size: 12px; color: rgba(255,255,255,.6); }
.nt > svg { flex: none; color: rgba(255,255,255,.6); }
.an-stack .an { margin-top: 12px; }
`;

export default function AtlasNoticed({ onAsk }) {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(hiddenNow);

  useEffect(() => {
    let alive = true;
    atlasApi("/api/atlas/for-you")
      .then(({ ok, data: d }) => alive && ok && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const trip = data?.nextTrip || null;
  const showStyle = !hidden && data?.enabled && data.lines?.length > 0;
  if (!trip && !showStyle) return null;

  const hide = () => {
    try {
      localStorage.setItem(
        HIDE_KEY,
        String(Date.now() + HIDE_DAYS * 86_400_000),
      );
    } catch {
      /* private mode: hidden for this visit only */
    }
    setHidden(true);
  };

  return (
    <div className="an-stack">
      <style>{CSS}</style>
      {trip && <NextTrip trip={trip} />}
      {showStyle && (
        <section className="an" aria-labelledby="an-title">
          <div className="an-head">
            <Sparkles size={16} aria-hidden="true" />
            <b id="an-title">Your travel style</b>
          </div>
          <button
            type="button"
            className="an-x"
            onClick={hide}
            aria-label="Hide for 30 days"
            title="Hide for 30 days"
          >
            <X size={16} aria-hidden="true" />
          </button>
          <p className="an-sub">Atlas uses this to suggest trips for you.</p>
          <ul className="an-list">
            {data.lines.map((l) => {
              const Icon = ICONS[l.icon] || Sparkles;
              return (
                <li key={l.key}>
                  <Icon size={16} aria-hidden="true" />
                  <span className="an-text">
                    {l.text}
                    <span className="an-src">{l.source}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="an-foot">
            {data.ask && (
              <button
                type="button"
                className="an-btn"
                onClick={() => onAsk?.(data.ask)}
              >
                <Sparkles size={14} aria-hidden="true" /> Get trip ideas
              </button>
            )}
            <Link
              to="/settings/atlas"
              className="an-link"
              aria-label="Edit what Atlas knows"
            >
              Edit
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

const when = (n) => (n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`);
const fmtDay = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// "Next trip" — the traveler's own soonest booking. The forecast only
// shows within ~5 days, labeled as a forecast.
function NextTrip({ trip }) {
  const Icon = trip.type === "Hotel" ? BedDouble : Plane;
  const fc = trip.forecast;
  return (
    <Link
      to={`/manage-booking/${trip.id}`}
      className="nt"
      aria-label={`Next trip: ${trip.place}, ${fmtDay(trip.date)}. View trip.`}
    >
      <span className="nt-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="nt-body">
        <span className="nt-label">Next trip · {when(trip.daysAway)}</span>
        <span className="nt-main">
          {trip.place} · {fmtDay(trip.date)}
        </span>
        {trip.warning ? (
          <span className="nt-line warn">
            <TriangleAlert size={14} aria-hidden="true" /> {trip.warning} there.
            Check your airline&apos;s app.
          </span>
        ) : fc ? (
          <>
            <span className="nt-line">
              <CloudSun size={14} aria-hidden="true" /> Forecast:{" "}
              {fc.condition.toLowerCase()}, high about {fc.highF}°F,{" "}
              {fc.rainChancePct}% chance of rain
            </span>
            <span className="nt-fine">Forecasts can change.</span>
          </>
        ) : null}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}
