// ─────────────────────────────────────────────────────────────
// TripGenerator — "Make me a trip" (from tester feedback: "a button that
// generates trips… if I don't like it, I hit the button again… if I like
// some of it, I edit it. Stupid fast and easy.")
//
//   [Make me a trip]  → one trip card: place, dates, est. total
//   Shuffle           → a different trip (keeps whatever is locked)
//   Lock              → keep the place and/or the dates on shuffle
//   Edit              → tap the place or dates to change them
//   Book this trip    → Book page, flight first then the stay (package)
//
// Uses /api/atlas/suggest (the same engine as the landing page ideas).
// Totals there are AI ESTIMATES, so the card always says "est." and the
// real price only shows on the Book page search. Nothing is booked here.
//
// Self-contained: own styles (tg- prefix), lucide icons, guests welcome.
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Shuffle,
  Lock,
  Unlock,
  Plane,
  BedDouble,
  MapPin,
  CalendarDays,
  ArrowRight,
  Loader2,
  Pencil,
  Check,
} from "lucide-react";
import { readHomeAirport } from "@/lib/homeAirport";

const API = import.meta.env.VITE_API_URL || "";

const BUDGETS = [
  ["", "Any budget"],
  ["600", "Under $600"],
  ["1200", "Under $1,200"],
  ["2500", "Under $2,500"],
];
const VIBES = ["Beach", "City", "Food", "Outdoors", "Chill", "Party"];
const WHO = [
  [1, "Just me"],
  [2, "2 people"],
  [3, "3 people"],
  [4, "4 people"],
];

const CSS = `
.tg { margin: 26px auto 0; max-width: 720px; text-align: left; color: #fff; font-family: "DM Sans", system-ui, sans-serif; }
.tg *, .tg *::before, .tg *::after { box-sizing: border-box; }
.tg-glass { position: relative; overflow: hidden; border-radius: 20px;
  background: linear-gradient(160deg, rgba(74,40,112,.62), rgba(34,18,62,.74));
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 18px 44px rgba(12,4,28,.38);
  backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); }
.tg-glass::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .tg-glass { background: linear-gradient(160deg, rgba(56,30,88,.96), rgba(28,14,52,.97)); }
}
.tg-panel { padding: 16px; }
.tg-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tg-sel { min-height: 38px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.06); color: #fff; font: 600 13.5px "DM Sans", sans-serif; }
.tg-sel option { background: #2a1650; color: #fff; }
.tg-from { width: 92px; text-transform: uppercase; }
.tg-chip { min-height: 34px; padding: 0 12px; border-radius: 999px; cursor: pointer; font: 700 13px "DM Sans", sans-serif;
  color: rgba(255,255,255,.85); background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.16); }
.tg-chip.is-on { color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); border-color: transparent; }
.tg-go { width: 100%; margin-top: 12px; min-height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border: 0; border-radius: 14px; cursor: pointer; font: 800 16px "DM Sans", sans-serif; color: #1a0e06;
  background: linear-gradient(135deg, #ff8a2a, #ffb347); box-shadow: 0 10px 26px rgba(255,138,42,.32); }
.tg-go:disabled { opacity: .7; cursor: default; }
.tg-spin { animation: tgSpin 1s linear infinite; }
@keyframes tgSpin { to { transform: rotate(360deg); } }

.tg-card { margin-top: 12px; padding: 18px; animation: tgIn .25s ease both; }
@keyframes tgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.tg-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.tg-fit { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .06em;
  text-transform: uppercase; color: #ffb347; background: rgba(255,138,42,.14); border: 1px solid rgba(255,138,42,.3); }
.tg-place { margin: 8px 0 2px; font-size: 24px; font-weight: 800; line-height: 1.15; }
.tg-sum { margin: 0; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,.78); }
.tg-total { text-align: right; flex-shrink: 0; }
.tg-total b { display: block; font-size: 22px; color: #ffb347; font-variant-numeric: tabular-nums; }
.tg-total small { font-size: 11.5px; color: rgba(255,255,255,.6); }
.tg-parts { margin-top: 14px; display: grid; gap: 8px; }
.tg-part { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); font-size: 14px; }
.tg-part > svg { color: #ffb347; flex-shrink: 0; }
.tg-part__main { flex: 1; min-width: 0; }
.tg-part__main b { display: block; }
.tg-part__main span { font-size: 12.5px; color: rgba(255,255,255,.65); }
.tg-part.is-locked { border-color: rgba(255,179,71,.55); background: rgba(255,138,42,.08); }
.tg-icon { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: transparent; color: rgba(255,255,255,.8); cursor: pointer; }
.tg-icon.is-on { color: #1a0e06; background: #ffb347; border-color: #ffb347; }
.tg-icon:focus-visible, .tg-chip:focus-visible, .tg-go:focus-visible, .tg-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.tg-edit { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.tg-edit input { min-height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,.22);
  background: rgba(255,255,255,.07); color: #fff; font: 600 13.5px "DM Sans", sans-serif; color-scheme: dark; }
.tg-actions { margin-top: 14px; display: flex; gap: 8px; }
.tg-btn { flex: 1; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px;
  cursor: pointer; font: 800 14.5px "DM Sans", sans-serif; }
.tg-btn--ghost { color: #fff; background: transparent; border: 1px solid rgba(255,255,255,.28); }
.tg-btn--ghost:hover { border-color: #ffb347; color: #ffb347; }
.tg-btn--main { color: #fff; border: 0; background: linear-gradient(135deg, #7c5cfc, #9b6bff 55%, #c084fc); box-shadow: 0 10px 26px rgba(124,92,252,.4); }
.tg-fine { margin: 10px 0 0; font-size: 12px; color: rgba(255,255,255,.6); }
.tg-err { margin-top: 10px; font-size: 13px; color: #ff9db0; }
@media (max-width: 520px) {
  .tg-place { font-size: 21px; }
  .tg-actions { flex-direction: column-reverse; }
}
@media (prefers-reduced-motion: reduce) { .tg-card { animation: none; } .tg-spin { animation: none; } }
`;

const fmtDay = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";
const nightsBetween = (a, b) =>
  Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function TripGenerator() {
  const navigate = useNavigate();
  const home = (() => {
    try {
      return readHomeAirport() || null;
    } catch {
      return null;
    }
  })();

  const [from, setFrom] = useState(home?.code || "EWR");
  const [budget, setBudget] = useState("");
  const [who, setWho] = useState(1);
  const [vibe, setVibe] = useState("");

  const [trip, setTrip] = useState(null);
  const [lockPlace, setLockPlace] = useState(false);
  const [lockDates, setLockDates] = useState(false);
  const [editing, setEditing] = useState(null); // "place" | "dates" | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Suggestions not shown yet, and places already shown (so Shuffle doesn't repeat).
  const queue = useRef([]);
  const seen = useRef([]);

  const buildPrompt = useCallback(
    (current) => {
      const parts = [];
      if (lockPlace && current) parts.push(`A trip to ${current.trip}.`);
      else
        parts.push(
          vibe
            ? `A ${vibe.toLowerCase()} trip somewhere great.`
            : "Surprise me with a great trip."
        );
      parts.push(
        who === 1 ? "Traveling solo." : `For ${who} people, total for everyone.`
      );
      if (budget) parts.push(`Total under $${budget}.`);
      if (lockDates && current)
        parts.push(
          `Use exactly these dates: depart ${current.depart}, return ${current.return}.`
        );
      if (!lockPlace && seen.current.length)
        parts.push(`Not these places: ${seen.current.slice(-8).join("; ")}.`);
      if (lockPlace && current)
        parts.push("Pick different dates or a different style of trip.");
      return parts.join(" ").slice(0, 480);
    },
    [lockPlace, lockDates, vibe, who, budget]
  );

  const show = (next, current) => {
    // Locked parts win over whatever came back.
    const merged = { ...next };
    if (current && lockPlace) {
      // Atlas suggested somewhere else: keep the locked place, and don't
      // show that other place's blurb or price as if it were this one.
      if (next.destCode !== current.destCode) {
        merged.fit = current.fit;
        merged.summary = current.summary;
        merged.total = null;
      }
      merged.trip = current.trip;
      merged.destCode = current.destCode;
    }
    if (current && lockDates) {
      merged.depart = current.depart;
      merged.return = current.return;
      merged.nights = nightsBetween(current.depart, current.return);
    }
    seen.current = [...seen.current, merged.trip];
    setTrip(merged);
    setEditing(null);
  };

  const generate = async () => {
    const current = trip;
    setError("");
    // Nothing locked and ideas left over: instant.
    if (!lockPlace && !lockDates && queue.current.length) {
      show(queue.current.shift(), current);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/atlas/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildPrompt(current),
          homeCode: String(from || "")
            .toUpperCase()
            .slice(0, 3),
          homeCity: home?.city || undefined,
          filters: {
            ...(budget ? { budget: `under $${budget}` } : {}),
            ...(who === 1
              ? { type: "solo" }
              : who === 2
              ? {}
              : { type: "group" }),
          },
          count: lockPlace || lockDates ? 1 : 3,
          // A new list every time (not the 1-hour cache).
          promptHistory: ["Shuffle: a different trip", String(Date.now())],
        }),
      });
      const data = await res.json().catch(() => ({}));
      const list = (
        Array.isArray(data.suggestions) ? data.suggestions : []
      ).filter((s) => s.kind !== "hotel" && s.destCode);
      if (!res.ok || !list.length)
        throw new Error(data.error || "Atlas couldn't make a trip. Try again.");
      show(list[0], current);
      if (!lockPlace && !lockDates) queue.current = list.slice(1);
    } catch (e) {
      setError(e.message || "Atlas couldn't make a trip. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Settings changed → old leftovers no longer fit.
  const change = (setter) => (v) => {
    queue.current = [];
    setter(v);
  };

  const bookIt = () => {
    if (!trip) return;
    const p = new URLSearchParams({
      kind: "package",
      tab: "Flights",
      from: String(from || "").toUpperCase(),
      to: trip.destCode,
      toName: trip.trip,
      depart: trip.depart,
      return: trip.return,
      adults: String(who),
      rooms: String(who > 2 ? Math.ceil(who / 2) : 1),
      auto: "1",
    });
    navigate(`/booking?${p.toString()}`);
  };

  const nights = trip ? nightsBetween(trip.depart, trip.return) : 0;

  return (
    <div className="tg">
      <style>{CSS}</style>
      <div className="tg-glass tg-panel">
        <div className="tg-row" role="group" aria-label="Trip options">
          <input
            className="tg-sel tg-from"
            value={from}
            onChange={(e) =>
              change(setFrom)(
                e.target.value.replace(/[^a-z]/gi, "").slice(0, 3)
              )
            }
            aria-label="Flying from (airport code)"
            placeholder="From"
          />
          <select
            className="tg-sel"
            value={budget}
            onChange={(e) => change(setBudget)(e.target.value)}
            aria-label="Budget"
          >
            {BUDGETS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            className="tg-sel"
            value={who}
            onChange={(e) => change(setWho)(Number(e.target.value))}
            aria-label="Who's going"
          >
            {WHO.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div
          className="tg-row"
          style={{ marginTop: 8 }}
          role="group"
          aria-label="Vibe (optional)"
        >
          {VIBES.map((v) => (
            <button
              key={v}
              type="button"
              className={`tg-chip${vibe === v ? " is-on" : ""}`}
              aria-pressed={vibe === v}
              onClick={() => change(setVibe)(vibe === v ? "" : v)}
            >
              {v}
            </button>
          ))}
        </div>
        {/* After the first trip, Shuffle lives on the trip card. */}
        {!trip && (
          <button
            type="button"
            className="tg-go"
            onClick={generate}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={18} className="tg-spin" aria-hidden="true" />
            ) : trip ? (
              <Shuffle size={18} aria-hidden="true" />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            {busy ? "Making your trip…" : trip ? "Shuffle" : "Make me a trip"}
          </button>
        )}
        {error && (
          <div className="tg-err" role="alert">
            {error}
          </div>
        )}
      </div>

      {trip && (
        <div
          className="tg-glass tg-card"
          aria-live="polite"
          key={`${trip.trip}-${trip.depart}`}
        >
          <div className="tg-top">
            <div style={{ minWidth: 0 }}>
              {trip.fit && <span className="tg-fit">{trip.fit}</span>}
              <div className="tg-place">{trip.trip}</div>
              {trip.summary && <p className="tg-sum">{trip.summary}</p>}
            </div>
            {Number.isFinite(trip.total) && trip.total > 0 && (
              <div className="tg-total">
                <b>{usd(trip.total)}</b>
                <small>est. for {who === 1 ? "you" : `${who} people`}</small>
              </div>
            )}
          </div>

          <div className="tg-parts">
            {/* Place */}
            <div className={`tg-part${lockPlace ? " is-locked" : ""}`}>
              <MapPin size={17} aria-hidden="true" />
              <div className="tg-part__main">
                <b>{trip.trip}</b>
                {editing === "place" ? (
                  <PlaceEdit
                    trip={trip}
                    onSave={(name, code) => {
                      setTrip({
                        ...trip,
                        trip: name,
                        destCode: code,
                        total: null,
                        fit: "",
                        summary: "",
                      });
                      setLockPlace(true);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <span>
                    {trip.destCode ? `Airport ${trip.destCode}` : "Destination"}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="tg-icon"
                aria-label="Change the place"
                onClick={() => setEditing(editing === "place" ? null : "place")}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className={`tg-icon${lockPlace ? " is-on" : ""}`}
                aria-pressed={lockPlace}
                aria-label={
                  lockPlace
                    ? "Unlock the place"
                    : "Keep this place when I shuffle"
                }
                title={
                  lockPlace
                    ? "Locked: Shuffle keeps this place"
                    : "Lock this place"
                }
                onClick={() => setLockPlace((v) => !v)}
              >
                {lockPlace ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
            </div>

            {/* Dates */}
            <div className={`tg-part${lockDates ? " is-locked" : ""}`}>
              <CalendarDays size={17} aria-hidden="true" />
              <div className="tg-part__main">
                <b>
                  {fmtDay(trip.depart)} – {fmtDay(trip.return)}
                </b>
                {editing === "dates" ? (
                  <DatesEdit
                    trip={trip}
                    onSave={(depart, ret) => {
                      setTrip({ ...trip, depart, return: ret, total: null });
                      setLockDates(true);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <span>
                    {nights} night{nights !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="tg-icon"
                aria-label="Change the dates"
                onClick={() => setEditing(editing === "dates" ? null : "dates")}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className={`tg-icon${lockDates ? " is-on" : ""}`}
                aria-pressed={lockDates}
                aria-label={
                  lockDates
                    ? "Unlock the dates"
                    : "Keep these dates when I shuffle"
                }
                title={
                  lockDates
                    ? "Locked: Shuffle keeps these dates"
                    : "Lock these dates"
                }
                onClick={() => setLockDates((v) => !v)}
              >
                {lockDates ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
            </div>

            {/* What gets booked */}
            <div className="tg-part">
              <Plane size={17} aria-hidden="true" />
              <div className="tg-part__main">
                <b>
                  {String(from || "").toUpperCase()} → {trip.destCode}
                </b>
                <span>
                  Round-trip flight, then a hotel for {nights} night
                  {nights !== 1 ? "s" : ""}
                </span>
              </div>
              <BedDouble
                size={17}
                aria-hidden="true"
                style={{ color: "#ffb347" }}
              />
            </div>
          </div>

          <div className="tg-actions">
            <button
              type="button"
              className="tg-btn tg-btn--ghost"
              onClick={generate}
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={16} className="tg-spin" aria-hidden="true" />
              ) : (
                <Shuffle size={16} aria-hidden="true" />
              )}{" "}
              {busy ? "Shuffling…" : "Shuffle"}
            </button>
            <button
              type="button"
              className="tg-btn tg-btn--main"
              onClick={bookIt}
            >
              Book this trip <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="tg-fine">
            {trip.total ? "Estimated total. " : ""}Live prices show on the next
            step. Nothing is booked until you pay.
          </p>
        </div>
      )}
    </div>
  );
}

function PlaceEdit({ trip, onSave }) {
  const [name, setName] = useState(trip.trip);
  const [code, setCode] = useState(trip.destCode || "");
  const ok = name.trim() && /^[A-Za-z]{3}$/.test(code);
  return (
    <div className="tg-edit">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Place"
        placeholder="City"
        style={{ flex: 1, minWidth: 120 }}
      />
      <input
        value={code}
        onChange={(e) =>
          setCode(
            e.target.value
              .replace(/[^a-z]/gi, "")
              .slice(0, 3)
              .toUpperCase()
          )
        }
        aria-label="Airport code"
        placeholder="Code"
        style={{ width: 70 }}
      />
      <button
        type="button"
        className="tg-icon is-on"
        aria-label="Save place"
        disabled={!ok}
        onClick={() => onSave(name.trim(), code.toUpperCase())}
      >
        <Check size={14} />
      </button>
    </div>
  );
}

function DatesEdit({ trip, onSave }) {
  const [depart, setDepart] = useState(trip.depart);
  const [ret, setRet] = useState(trip.return);
  const today = new Date().toISOString().slice(0, 10);
  const ok = depart >= today && ret > depart;
  return (
    <div className="tg-edit">
      <input
        type="date"
        value={depart}
        min={today}
        onChange={(e) => setDepart(e.target.value)}
        aria-label="Depart"
      />
      <input
        type="date"
        value={ret}
        min={depart}
        onChange={(e) => setRet(e.target.value)}
        aria-label="Return"
      />
      <button
        type="button"
        className="tg-icon is-on"
        aria-label="Save dates"
        disabled={!ok}
        onClick={() => onSave(depart, ret)}
      >
        <Check size={14} />
      </button>
    </div>
  );
}
