// src/pages/AtlasLearningPage.jsx
// Settings > "What Atlas knows about you". Route: /settings/atlas
import { useEffect, useState } from "react";
import { atlasApi } from "@/components/Atlas/atlasApi";
import "@/styles/atlas-booking-card.css";

const CATEGORY_LABEL = {
  flights: "Flights",
  hotels: "Hotels",
  budget: "Budget",
  trip_style: "Trip style",
  activities: "Activities",
  travel_party: "Who you travel with",
  food: "Food",
  communication: "How Atlas talks to you",
};

async function api(path = "", method = "GET", body) {
  const { data } = await atlasApi(`/api/atlas/learning${path}`, { method, body });
  return data;
}

export default function AtlasLearningPage() {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // { id, text }
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    api().then(setData);
  }, []);

  if (!data) return <div className="alp"><p className="abc-hold">Loading…</p></div>;

  const patch = (item) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? item : x)) }));

  async function toggleEnabled() {
    const r = await api("/settings", "PUT", { enabled: !data.enabled });
    setData((d) => ({ ...d, enabled: r.enabled }));
  }
  async function toggleItem(item) {
    patch(await api(`/${item.id}`, "PATCH", { active: !item.active }));
  }
  async function saveEdit() {
    patch(await api(`/${editing.id}`, "PATCH", { text: editing.text }));
    setEditing(null);
  }
  async function remove(item) {
    await api(`/${item.id}`, "DELETE");
    setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== item.id) }));
  }
  async function clearAll() {
    await api("", "DELETE");
    setData((d) => ({ ...d, items: [] }));
    setConfirmClear(false);
  }

  const grouped = data.categories
    .map((c) => [c, data.items.filter((i) => i.category === c)])
    .filter(([, items]) => items.length);

  return (
    <div className="alp">
      <h1 className="alp-title">What Atlas knows about you</h1>
      <p className="alp-sub">
        Atlas learns from your trips, the options you pick, and what you tell it, so it can suggest better trips over time.
        You can change or delete anything here.
      </p>

      <div className="abc-card alp-toggle">
        <div>
          <div className="abc-title">Let Atlas learn</div>
          <p className="abc-hold">
            {data.enabled
              ? "On. Atlas uses what it learns to rank options and make suggestions."
              : "Off. Atlas won't learn anything new or use what's below."}
          </p>
        </div>
        <button className={`alp-switch ${data.enabled ? "on" : ""}`} onClick={toggleEnabled} aria-pressed={data.enabled} aria-label="Let Atlas learn">
          <span />
        </button>
      </div>

      {!grouped.length && (
        <p className="alp-empty">Nothing yet. Book a trip or tell Atlas how you like to travel, and it'll show up here.</p>
      )}

      {grouped.map(([cat, items]) => (
        <section key={cat} className="alp-section">
          <h2>{CATEGORY_LABEL[cat] || cat}</h2>
          {items.map((item) => (
            <div key={item.id} className={`abc-card alp-item ${item.active ? "" : "off"}`}>
              {editing?.id === item.id ? (
                <>
                  <input
                    className="alp-input"
                    value={editing.text}
                    maxLength={200}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  />
                  <div className="abc-actions">
                    <button className="abc-btn abc-primary" onClick={saveEdit}>Save</button>
                    <button className="abc-btn abc-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="alp-text">{item.text}</div>
                  <div className="alp-meta">
                    {item.sourceLabel} · {item.strength}
                    {!item.active && " · Paused"}
                  </div>
                  <div className="alp-actions">
                    <button className="apc-link" onClick={() => setEditing({ id: item.id, text: item.text })}>Edit</button>
                    <button className="apc-link" onClick={() => toggleItem(item)}>{item.active ? "Pause" : "Resume"}</button>
                    <button className="apc-link alp-danger" onClick={() => remove(item)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>
      ))}

      {data.items.length > 0 && (
        <div className="alp-clear">
          {confirmClear ? (
            <>
              <p className="abc-hold">Delete everything Atlas has learned? This can't be undone.</p>
              <div className="abc-actions">
                <button className="abc-btn alp-danger-btn" onClick={clearAll}>Delete all</button>
                <button className="abc-btn abc-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <button className="apc-link alp-danger" onClick={() => setConfirmClear(true)}>Delete everything Atlas learned</button>
          )}
        </div>
      )}

      <p className="alp-foot">Atlas never learns health, religion, money, or other sensitive details.</p>
    </div>
  );
}
