// "Atlas noticed" — a small, quiet card on the home page for signed-in
// travelers. Shows up to 3 true things from their own trips and what Atlas
// learned (GET /api/atlas/for-you). Nothing shows for new travelers, when
// "Let Atlas learn" is off, or for 30 days after they hide it.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Plane, Moon, CalendarDays, Users, X, ArrowRight } from "lucide-react";
import { atlasApi } from "@/components/Atlas/atlasApi";

const HIDE_KEY = "skyrio_atlas_noticed_hidden_until";
const HIDE_DAYS = 30;
const ICONS = { plane: Plane, moon: Moon, calendar: CalendarDays, users: Users, spark: Sparkles };

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
.an-link { font-size: 13px; font-weight: 700; color: #ffb347; text-decoration: none; white-space: nowrap; }
.an-link:hover { text-decoration: underline; }
`;

export default function AtlasNoticed({ onAsk }) {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(hiddenNow);

  useEffect(() => {
    if (hidden) return undefined;
    let alive = true;
    atlasApi("/api/atlas/for-you")
      .then(({ ok, data: d }) => alive && ok && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [hidden]);

  if (hidden || !data?.enabled || !data.lines?.length) return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      /* private mode: hidden for this visit only */
    }
    setHidden(true);
  };

  return (
    <section className="an" aria-labelledby="an-title">
      <style>{CSS}</style>
      <div className="an-head">
        <Sparkles size={16} aria-hidden="true" />
        <b id="an-title">Atlas noticed</b>
      </div>
      <button type="button" className="an-x" onClick={hide} aria-label="Hide for 30 days" title="Hide for 30 days">
        <X size={16} aria-hidden="true" />
      </button>
      <p className="an-sub">Atlas uses this to suggest trips that fit you.</p>
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
          <button type="button" className="an-btn" onClick={() => onAsk?.(data.ask)}>
            <Sparkles size={14} aria-hidden="true" /> Get trip ideas
          </button>
        )}
        <Link to="/settings/atlas" className="an-link">
          See or change this <ArrowRight size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />
        </Link>
      </div>
    </section>
  );
}
