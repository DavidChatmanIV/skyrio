// src/components/profile/HomeAirportField.jsx
// "Home airport" section for the Digital Passport.
//  - New travelers: drop it into the profile set-up form.
//  - Existing travelers: drop it on the Passport page so they can add or
//    change it any time. If they already picked an airport on Discover
//    (saved only in that browser), it offers to put it on their passport.
// Picking an airport saves it — no extra Save button to forget.
import React, { useEffect, useState } from "react";
import { Home, Check, PlaneTakeoff, X } from "lucide-react";
import AirportInput from "@/pages/booking/AirportInput";
import {
  readHomeAirport,
  fetchHomeAirport,
  saveHomeAirport,
  clearHomeAirport,
} from "@/lib/homeAirport";

const CSS = `
.ha-card { all: unset; box-sizing: border-box; display: block; position: relative; overflow: visible;
  padding: 18px 18px 16px; border-radius: 18px; background: rgba(16,11,34,0.82);
  border: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: "DM Sans", system-ui, sans-serif; }
.ha-card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; border-radius: 18px 18px 0 0;
  background: linear-gradient(90deg,#ff8a2a,#ffb347 45%,#8b6cff); }
.ha-card.is-compact { padding: 14px; border-radius: 14px; }
.ha-card.is-compact::before { border-radius: 14px 14px 0 0; }
.ha-eyebrow { display: inline-flex; align-items: center; gap: 6px; font: 600 10.5px "JetBrains Mono", ui-monospace, monospace;
  letter-spacing: .18em; text-transform: uppercase; color: #ffb347; }
.ha-title { margin: 6px 0 2px; font-size: 17px; font-weight: 800; line-height: 1.3; }
.ha-sub { margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.72); }
.ha-input { border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14);
  padding: 4px 12px; }
.ha-input:focus-within { border-color: rgba(255,138,42,0.7); box-shadow: 0 0 0 3px rgba(255,138,42,0.15); }
.ha-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.ha-current { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-size: 13.5px; font-weight: 700; }
.ha-badge { width: 28px; height: 28px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 9px; background: rgba(52,211,153,0.14); color: #34d399; }
.ha-current small { display: block; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.65); }
.ha-btn { min-height: 34px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.18); background: transparent; color: rgba(255,255,255,0.85);
  font: 700 12.5px "DM Sans", system-ui, sans-serif; cursor: pointer; }
.ha-btn:hover { border-color: rgba(255,107,133,.6); color: #ff8fa3; }
.ha-btn.is-primary { border: 0; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; }
.ha-btn.is-primary:hover { filter: brightness(1.06); color: #1a0e06; }
.ha-found { margin-top: 12px; padding: 10px 12px; border-radius: 12px; border: 1px dashed rgba(255,179,71,0.5);
  background: rgba(255,138,42,0.08); display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-wrap: wrap; font-size: 13px; color: rgba(255,255,255,0.85); }
.ha-found b { color: #ffb347; }
.ha-note { margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.62); }
.ha-note.is-warn { color: #ffb347; }
.ha-card :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
`;

const label = (ap) => (ap ? `${ap.city} (${ap.code})` : "");

export default function HomeAirportField({ compact = false, onSaved }) {
  const [home, setHome] = useState(null); // what's on the passport
  const [found, setFound] = useState(null); // picked on Discover, not saved yet
  const [display, setDisplay] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    const local = readHomeAirport();
    fetchHomeAirport().then(({ homeAirport, onAccount }) => {
      if (!alive) return;
      if (onAccount && homeAirport) {
        setHome(homeAirport);
        setDisplay(label(homeAirport));
      } else if (onAccount && !homeAirport && local) {
        // Older account: picked an airport on Discover before passports
        // had one. Offer it instead of saving it silently.
        setFound(local);
      } else if (!onAccount && homeAirport) {
        setHome(homeAirport);
        setDisplay(label(homeAirport));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = async (ap) => {
    const { homeAirport, synced } = await saveHomeAirport(ap);
    if (!homeAirport) return;
    setHome(homeAirport);
    setFound(null);
    setDisplay(label(homeAirport));
    setNote(
      synced
        ? { text: "Saved to your passport. Flight searches will start here." }
        : {
            text: "Saved on this device. We couldn't reach your account, so it'll only show here for now.",
            warn: true,
          }
    );
    onSaved?.(homeAirport);
  };

  const remove = async () => {
    await clearHomeAirport();
    setHome(null);
    setDisplay("");
    setNote({
      text: "Removed. Flight searches will start with an empty From box.",
    });
    onSaved?.(null);
  };

  return (
    <section
      className={`ha-card${compact ? " is-compact" : ""}`}
      aria-labelledby="ha-title"
    >
      <style>{CSS}</style>
      <span className="ha-eyebrow">
        <Home size={12} aria-hidden="true" /> Home airport
      </span>
      <h3 className="ha-title" id="ha-title">
        Which airport is closest to you?
      </h3>
      <p className="ha-sub">
        Flight searches start here. You can always fly from somewhere else.
      </p>

      <div className="ha-input">
        <AirportInput
          value={display}
          placeholder="City or airport, e.g. Newark"
          onChange={(ap) => save(ap)}
        />
      </div>

      {found && !home && (
        <div className="ha-found" role="status">
          <span>
            You picked <b>{label(found)}</b> on Discover. Add it to your
            passport?
          </span>
          <button
            type="button"
            className="ha-btn is-primary"
            onClick={() => save(found)}
          >
            <Check size={14} aria-hidden="true" /> Add it
          </button>
        </div>
      )}

      {home && (
        <div className="ha-row">
          <span className="ha-current">
            <span className="ha-badge" aria-hidden="true">
              <PlaneTakeoff size={15} />
            </span>
            <span>
              {label(home)}
              <small>Your home airport</small>
            </span>
          </span>
          <button
            type="button"
            className="ha-btn"
            onClick={remove}
            aria-label={`Remove ${label(home)} as your home airport`}
          >
            <X size={13} aria-hidden="true" /> Remove
          </button>
        </div>
      )}

      {!loading && note && (
        <p className={`ha-note${note.warn ? " is-warn" : ""}`} role="status">
          {note.text}
        </p>
      )}
    </section>
  );
}
