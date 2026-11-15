// src/pages/AtlasLearningPage.jsx
// Settings > "What Atlas knows". Route: /settings/atlas
// See, edit, pause or delete anything Atlas learned, or turn learning off.
// Same look as the home page: purple glass, warm orange, serif title.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Plane,
  BedDouble,
  Wallet,
  Compass,
  Ticket,
  Users,
  Utensils,
  MessageCircle,
  Pencil,
  Pause,
  Play,
  Trash2,
  ShieldCheck,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import { atlasApi } from "@/components/Atlas/atlasApi";

const CATEGORY = {
  flights: ["Flights", Plane],
  hotels: ["Hotels", BedDouble],
  budget: ["Budget", Wallet],
  trip_style: ["Trip style", Compass],
  activities: ["Things to do", Ticket],
  travel_party: ["Who you travel with", Users],
  food: ["Food", Utensils],
  communication: ["How Atlas talks to you", MessageCircle],
};

const CSS = `
.alp2 { max-width: 640px; margin: 0 auto; padding: 20px 16px 140px; color: #fff; font-family: "DM Sans", system-ui, sans-serif; box-sizing: border-box; }
.alp2 *, .alp2 *::before, .alp2 *::after { box-sizing: border-box; }
.alp2-back { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; margin: 0 0 14px; padding: 0 14px 0 10px; border-radius: 999px; font-size: 14px; font-weight: 700; color: #fff; text-decoration: none; background: rgba(60,32,96,.5); border: 1px solid rgba(255,255,255,.2); }
.alp2-back svg { color: #ffb347; }
.alp2-back:hover { border-color: #ffb347; }
.alp2-back:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.alp2-top { display: flex; flex-direction: column; align-items: flex-start; }
.alp2-kicker { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #ffb347; background: rgba(10,6,23,.45); border: 1px solid rgba(255,255,255,.2); }
.alp2-title { margin: 14px 0 0; font-family: "Playfair Display", "Syne", Georgia, serif; font-size: clamp(30px, 6vw, 44px); line-height: 1.08; font-weight: 800; letter-spacing: -.01em; }
.alp2-title em { font-style: normal; background: linear-gradient(135deg, #ff8a2a, #ffb347 55%, #c4b5fd); -webkit-background-clip: text; background-clip: text; color: transparent; }
.alp2-sub { margin: 10px 0 22px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,.78); }
.alp2-card { border-radius: 18px; padding: 16px 18px; background: linear-gradient(135deg, rgba(92,52,160,.5), rgba(60,32,96,.5)); border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 10px 30px rgba(20,8,40,.3); }
.alp2-toggle { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.alp2-toggle b { display: block; font-size: 16px; }
.alp2-toggle span { display: block; margin-top: 3px; font-size: 13.5px; color: rgba(255,255,255,.72); }
.alp2-switch { flex: none; width: 50px; height: 30px; border-radius: 999px; border: 0; padding: 3px; cursor: pointer; background: rgba(255,255,255,.18); transition: background .2s; }
.alp2-switch i { display: block; width: 24px; height: 24px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.alp2-switch.on { background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.alp2-switch.on i { transform: translateX(20px); }
.alp2-label { display: flex; align-items: center; gap: 8px; margin: 26px 0 10px; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #ffb347; }
.alp2-list { display: grid; gap: 10px; }
.alp2-item.off { opacity: .6; }
.alp2-text { font-size: 16px; font-weight: 600; line-height: 1.35; }
.alp2-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.alp2-chip { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,.85); background: rgba(255,255,255,.1); }
.alp2-chip.warm { color: #ffd29a; background: rgba(255,138,42,.16); }
.alp2-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.alp2-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 700; color: #fff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); }
.alp2-btn:hover { border-color: #ffb347; }
.alp2-btn.primary { color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); border-color: transparent; }
.alp2-btn.danger { color: #ffb4a6; border-color: rgba(255,143,122,.45); }
.alp2-btn.danger:hover { border-color: #ff8f7a; }
.alp2-btn.danger-solid { color: #fff; background: #c2412d; border-color: transparent; }
.alp2-btn:focus-visible, .alp2-switch:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.alp2-btn:disabled { opacity: .6; cursor: default; }
.alp2-input { width: 100%; padding: 12px 14px; border-radius: 12px; font: inherit; font-size: 16px; color: #fff; background: rgba(10,6,23,.35); border: 1px solid rgba(255,255,255,.25); }
.alp2-input:focus { outline: none; border-color: #ffb347; }
.alp2-empty { display: flex; gap: 12px; align-items: flex-start; margin-top: 18px; font-size: 14.5px; line-height: 1.45; color: rgba(255,255,255,.82); }
.alp2-empty svg { color: #ffb347; flex: none; margin-top: 2px; }
.alp2-clear { margin-top: 30px; }
.alp2-clear p { margin: 0 0 10px; font-size: 14px; color: rgba(255,255,255,.82); }
.alp2-foot { display: flex; align-items: center; gap: 8px; margin-top: 26px; font-size: 13px; color: rgba(255,255,255,.7); }
.alp2-foot svg { color: #6ee7a8; flex: none; }
.alp2-err { margin-top: 12px; font-size: 13.5px; color: #ffb4a6; }
`;

async function api(path = "", method = "GET", body) {
  const { ok, data } = await atlasApi(`/api/atlas/learning${path}`, {
    method,
    body,
  });
  if (!ok) throw new Error(data?.error || "failed");
  return data;
}

export default function AtlasLearningPage() {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // { id, text }
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    api()
      .then(setData)
      .catch(() => setLoadErr(true));
  }, []);

  // Runs a change; shows a short message if it didn't go through.
  const run = (what, fn) => async () => {
    setErr("");
    try {
      await fn();
    } catch {
      setErr(`Couldn't ${what}. Try again.`);
    }
  };

  if (loadErr)
    return (
      <div className="alp2">
        <style>{CSS}</style>
        <div className="alp2-top">
          <Link to="/" className="alp2-back">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </Link>
        </div>
        <p className="alp2-err">Couldn't load this page. Try again.</p>
      </div>
    );
  if (!data)
    return (
      <div className="alp2">
        <style>{CSS}</style>
        <div className="alp2-top">
          <Link to="/" className="alp2-back">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </Link>
        </div>
        <p className="alp2-sub">Loading…</p>
      </div>
    );

  const patch = (item) =>
    setData((d) => ({
      ...d,
      items: d.items.map((x) => (x.id === item.id ? item : x)),
    }));

  const toggleEnabled = run("save", async () => {
    const r = await api("/settings", "PUT", { enabled: !data.enabled });
    setData((d) => ({ ...d, enabled: r.enabled }));
  });
  const toggleItem = (item) =>
    run("save", async () =>
      patch(await api(`/${item.id}`, "PATCH", { active: !item.active })),
    );
  const saveEdit = run("save", async () => {
    patch(await api(`/${editing.id}`, "PATCH", { text: editing.text }));
    setEditing(null);
  });
  const remove = (item) =>
    run("delete", async () => {
      await api(`/${item.id}`, "DELETE");
      setData((d) => ({
        ...d,
        items: d.items.filter((x) => x.id !== item.id),
      }));
    });
  const clearAll = run("delete", async () => {
    await api("", "DELETE");
    setData((d) => ({ ...d, items: [] }));
    setConfirmClear(false);
  });

  const grouped = data.categories
    .map((c) => [c, data.items.filter((i) => i.category === c)])
    .filter(([, items]) => items.length);

  return (
    <div className="alp2">
      <style>{CSS}</style>

      <div className="alp2-top">
        <Link to="/" className="alp2-back">
          <ArrowLeft size={16} aria-hidden="true" /> Home
        </Link>
        <span className="alp2-kicker">
          <Sparkles size={14} aria-hidden="true" /> Atlas
        </span>
      </div>
      <h1 className="alp2-title">
        What Atlas <em>knows</em>
      </h1>
      <p className="alp2-sub">
        Atlas learns from your trips and what you tell it. Change or delete
        anything here.
      </p>

      <div className="alp2-card alp2-toggle">
        <div>
          <b>Let Atlas learn</b>
          <span>
            {data.enabled
              ? "On. Atlas uses this to suggest trips."
              : "Off. Atlas won't learn or use anything below."}
          </span>
        </div>
        <button
          type="button"
          className={`alp2-switch${data.enabled ? " on" : ""}`}
          onClick={toggleEnabled}
          role="switch"
          aria-checked={data.enabled}
          aria-label="Let Atlas learn"
        >
          <i />
        </button>
      </div>

      {err && (
        <p className="alp2-err" role="alert">
          {err}
        </p>
      )}

      {!grouped.length && (
        <div className="alp2-card alp2-empty">
          <Sparkles size={18} aria-hidden="true" />
          <span>
            Nothing yet. Book a trip or tell Atlas how you like to travel.
          </span>
        </div>
      )}

      {grouped.map(([cat, items]) => {
        const [label, Icon] = CATEGORY[cat] || [cat, Sparkles];
        return (
          <section key={cat} aria-label={label}>
            <h2 className="alp2-label">
              <Icon size={15} aria-hidden="true" /> {label}
            </h2>
            <div className="alp2-list">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`alp2-card alp2-item${item.active ? "" : " off"}`}
                >
                  {editing?.id === item.id ? (
                    <>
                      <input
                        className="alp2-input"
                        value={editing.text}
                        maxLength={200}
                        autoFocus
                        aria-label="Edit"
                        onChange={(e) =>
                          setEditing({ ...editing, text: e.target.value })
                        }
                      />
                      <div className="alp2-actions">
                        <button
                          type="button"
                          className="alp2-btn primary"
                          onClick={saveEdit}
                          disabled={!editing.text.trim()}
                        >
                          <Check size={15} aria-hidden="true" /> Save
                        </button>
                        <button
                          type="button"
                          className="alp2-btn"
                          onClick={() => setEditing(null)}
                        >
                          <X size={15} aria-hidden="true" /> Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="alp2-text">{item.text}</div>
                      <div className="alp2-chips">
                        <span className="alp2-chip">{item.sourceLabel}</span>
                        <span className="alp2-chip warm">
                          {item.active ? item.strength : "Paused"}
                        </span>
                      </div>
                      <div className="alp2-actions">
                        <button
                          type="button"
                          className="alp2-btn"
                          onClick={() =>
                            setEditing({ id: item.id, text: item.text })
                          }
                        >
                          <Pencil size={14} aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          className="alp2-btn"
                          onClick={toggleItem(item)}
                        >
                          {item.active ? (
                            <Pause size={14} aria-hidden="true" />
                          ) : (
                            <Play size={14} aria-hidden="true" />
                          )}
                          {item.active ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          className="alp2-btn danger"
                          onClick={remove(item)}
                        >
                          <Trash2 size={14} aria-hidden="true" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {data.items.length > 0 && (
        <div className="alp2-clear">
          {confirmClear ? (
            <div className="alp2-card">
              <p>Delete everything Atlas learned? This can't be undone.</p>
              <div className="alp2-actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="alp2-btn danger-solid"
                  onClick={clearAll}
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete all
                </button>
                <button
                  type="button"
                  className="alp2-btn"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="alp2-btn danger"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={14} aria-hidden="true" /> Delete everything
            </button>
          )}
        </div>
      )}

      <p className="alp2-foot">
        <ShieldCheck size={15} aria-hidden="true" /> Atlas never saves health,
        religion, money or other private details.
      </p>
    </div>
  );
}
