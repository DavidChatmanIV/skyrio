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
// Totals there are AI ESTIMATES, labeled "est.". When Skyrio's own fare
// checks (/api/deals/fares, real fares found in the last day) have the
// same place and dates, the card shows that REAL price instead, a small
// route map, and "Lower than usual on Skyrio" when it's a clear dip.
// Test (sandbox) fares are never shown as real. Nothing is booked here.
//
// Self-contained: own styles (tg- prefix), lucide icons, guests welcome.
// ─────────────────────────────────────────────────────────────
import useForYou from "@/lib/useForYou";
import { useAuth } from "@/auth/useAuth";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import {
  readHomeAirport,
  saveHomeAirport,
  fetchHomeAirport,
  HOME_AIRPORT_EVENT,
} from "@/lib/homeAirport";
import AirportInput from "@/pages/booking/AirportInput";
import { lazyPart } from "@/utils/lazyPart";

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
.tg-real { margin-top: 12px; padding: 12px 14px; border-radius: 14px; display: grid; gap: 6px;
  background: rgba(110,231,168,.08); border: 1px solid rgba(110,231,168,.3); font-size: 13.5px; color: #fff; }
.tg-real__line { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.tg-real__line span { color: rgba(255,255,255,.82); }
.tg-real small { color: rgba(255,255,255,.62); font-size: 12px; line-height: 1.45; }
.tg-previewNote { margin: 10px 0 0; padding: 8px 12px; border-radius: 12px; font-size: 12.5px; line-height: 1.45;
  color: #ffd1a1; background: rgba(255,179,71,.1); border: 1px dashed rgba(255,179,71,.5); }
.tg-real.is-test { background: rgba(255,179,71,.08); border-color: rgba(255,179,71,.45); }
.tg-real.is-test .tg-real__badge { color: #ffb347 !important; }
.tg-real__badge { font-size: 11.5px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase;
  color: #6ee7a8 !important; }
.tg-real__low { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 800;
  color: #0f2a1e !important; background: linear-gradient(90deg, #6ee7a8, #a7f3d0); }
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
.tg-fromWrap { flex: 1 1 100%; min-width: 0; }
.tg-fromWrap .sk-airport-wrap { width: 100%; }
.tg-fromWrap .sk-airport-input { width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 16px; border-radius: 999px; font: 700 15px "DM Sans", sans-serif; color: #fff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); }
.tg-fromWrap .sk-airport-input::placeholder { color: rgba(255,255,255,.6); font-weight: 600; }
.tg-fromWrap .sk-airport-input:focus { outline: none; border-color: #ffb347; }
.tg-homeHint { margin: 10px 0 0; font: 600 13px "DM Sans", sans-serif; color: rgba(255,255,255,.75); }
.tg-style { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 8px 12px; border-radius: 14px; border: 1px dashed rgba(255,179,71,.4); background: rgba(255,255,255,.04); }
.tg-style.is-on { border-style: solid; border-color: rgba(255,179,71,.5); background: rgba(255,138,42,.1); }
.tg-styleToggle { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 36px; padding: 0; border: 0; background: none; color: rgba(255,255,255,.8); font: 600 13.5px "DM Sans", sans-serif; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.tg-styleToggle svg { flex: none; color: #ffb347; }
.tg-style:not(.is-on) .tg-styleToggle { color: rgba(255,255,255,.6); }
.tg-style:not(.is-on) .tg-styleToggle b { text-decoration: line-through; }
.tg-styleToggle b { color: #fff; font-weight: 700; }
.tg-styleEdit { flex: none; font: 800 13px "DM Sans", sans-serif; color: #ffb347; text-decoration: none; }
.tg-styleToggle:focus-visible, .tg-styleEdit:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; border-radius: 6px; }
.tg-guestHint { margin: 12px 0 0; font: 500 13px "DM Sans", sans-serif; color: rgba(255,255,255,.62); text-align: center; }
.tg-guestLink, .tg-guestLink:visited, .tg-guestLink:hover, .tg-guestLink:active { font: 700 13px "DM Sans", sans-serif; color: #ffb347; text-decoration: none; }
.tg-guestLink:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; border-radius: 4px; }
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
const MiniRouteMap = lazyPart(() => import("@/components/MiniRouteMap"), null);
// "3 hours ago" for when Skyrio found a fare.
function foundAgo(at) {
  const ms = Date.now() - Date.parse(at || "");
  if (!Number.isFinite(ms) || ms < 0) return "recently";
  const h = Math.round(ms / 3600000);
  if (h < 1) return "less than an hour ago";
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

export default function TripGenerator() {
  const navigate = useNavigate();
  // Home airport: this browser's copy, kept fresh from the account.
  const [home, setHome] = useState(() => readHomeAirport());
  useEffect(() => {
    const onChange = () => setHome(readHomeAirport());
    window.addEventListener(HOME_AIRPORT_EVENT, onChange);
    return () => window.removeEventListener(HOME_AIRPORT_EVENT, onChange);
  }, []);

  // Where trips start: signed in → your home airport. Guests start empty
  // and pick one (no made-up default, nothing left over from another login).
  const [fromAp, setFromAp] = useState(null);
  const pickedFrom = useRef(false); // they chose an airport themselves
  const from = fromAp?.code || "";
  const [homeSaved, setHomeSaved] = useState(false);
  const [homeErr, setHomeErr] = useState(false);
  const [budget, setBudget] = useState("");
  const [who, setWho] = useState(1);
  const [vibe, setVibe] = useState("");

  // What Atlas knows about how you travel (signed in, learning on).
  const forYou = useForYou();
  const { isAuthed } = useAuth();
  const homeCode = home?.code || "";
  useEffect(() => {
    if (isAuthed && !homeCode) fetchHomeAirport().catch(() => {});
  }, [isAuthed, homeCode]);
  useEffect(() => {
    if (pickedFrom.current) return;
    setFromAp(isAuthed && homeCode ? readHomeAirport() : null);
  }, [isAuthed, homeCode]);
  const styleLines = forYou?.enabled ? (forYou.lines || []).map((l) => l.text).filter(Boolean) : [];
  const [useStyle, setUseStyle] = useState(true);
  const styleOn = useStyle && styleLines.length > 0;

  const [trip, setTrip] = useState(null);
  const [lockPlace, setLockPlace] = useState(false);
  const [lockDates, setLockDates] = useState(false);
  const [editing, setEditing] = useState(null); // "place" | "dates" | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Real fares Skyrio found in the last day from this airport (and nearby
  // ones). Empty while they're test prices, so estimates stay labeled.
  const [fares, setFares] = useState([]);
  // Preview with TEST fares (sandbox), only in a browser that opened the
  // site with ?farePreview=1 (?farePreview=0 turns it off). Everything is
  // labeled "Test price" so it can never pass for a real one.
  const [farePreview] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("farePreview");
      if (q === "1") sessionStorage.setItem("skyrio_fare_preview", "1");
      if (q === "0") sessionStorage.removeItem("skyrio_fare_preview");
      return sessionStorage.getItem("skyrio_fare_preview") === "1";
    } catch {
      return false;
    }
  });
  const [testFares, setTestFares] = useState(false);
  // Preview only: how many test fares came back for this airport (or "error").
  const [previewCount, setPreviewCount] = useState(null);
  useEffect(() => {
    setFares([]);
    setTestFares(false);
    setPreviewCount(null);
    if (!from) return;
    const controller = new AbortController();
    fetch(`${API}/api/deals/fares?origin=${encodeURIComponent(from)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.fares)) {
          if (farePreview) setPreviewCount("error");
          return;
        }
        if (farePreview) setPreviewCount(d.fares.length);
        if (!d.preview) setFares(d.fares);
        else if (farePreview) {
          setFares(d.fares);
          setTestFares(true);
        }
      })
      .catch((e) => {
        if (farePreview && e?.name !== "AbortError") setPreviewCount("error");
      });
    return () => controller.abort();
  }, [from, farePreview]);
  // The real fare for exactly this place and these dates, if Skyrio has one.
  const realFor = (t) =>
    t
      ? fares.find((f) => f.destination === t.destCode && f.departDate === t.depart && f.returnDate === t.return) ||
        null
      : null;
  // Places with a real fare that fits the budget (flight for everyone; with
  // the hotel too when it's one traveler and Skyrio has the hotel price).
  const fareHints = () => {
    const max = Number(budget) || Infinity;
    return fares
      .filter((f) => !seen.current.includes(f.city))
      .filter((f) => (who === 1 && f.tripTotal ? f.tripTotal : f.price * who) <= max)
      .sort((a, b) => Number(b.lowerThanUsual) - Number(a.lowerThanUsual) || a.price - b.price)
      .slice(0, 8)
      .map((f) => ({ destCode: f.destination, city: f.city, depart: f.departDate, return: f.returnDate, price: f.price }));
  };

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
      if (styleOn)
        parts.push(`How I travel: ${styleLines.slice(0, 3).join("; ")}.`);
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
    [lockPlace, lockDates, vibe, who, budget, styleOn, styleLines.join("|")] // eslint-disable-line react-hooks/exhaustive-deps
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

  // Real-fare trips: the first trip and every other Shuffle come straight
  // from a fare Skyrio found (that exact city and dates), so the card can
  // show its real price. Atlas only writes the description.
  const fareTurn = useRef(0);
  const pickFare = () => {
    const max = Number(budget) || Infinity;
    const fit = fares
      .filter((f) => !seen.current.includes(f.city))
      .filter((f) => (who === 1 && f.tripTotal ? f.tripTotal : f.price * who) <= max)

    if (!fit.length) return null;
    // Clear dips first, then a little variety among the cheapest few.
    const low = fit.filter((f) => f.lowerThanUsual);
    const pool = (low.length ? low : [...fit].sort((a, b) => a.price - b.price)).slice(0, 4);
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const tripFromFare = async (f) => {
    let blurb = {};
    try {
      const res = await fetch(`${API}/api/atlas/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `A trip to ${f.city}. Use exactly these dates: depart ${f.departDate}, return ${f.returnDate}.${
            vibe ? ` A ${vibe.toLowerCase()} trip.` : ""
          } ${who === 1 ? "Traveling solo." : `For ${who} people.`}`.slice(0, 480),
          homeCode: String(from || "").toUpperCase().slice(0, 3),
          homeCity: home?.city || undefined,
          count: 1,
          promptHistory: ["Real fare trip", String(Date.now())],
        }),
      });
      const data = await res.json().catch(() => ({}));
      const s = (Array.isArray(data.suggestions) ? data.suggestions : [])[0];
      if (s && s.destCode === f.destination) blurb = { fit: s.fit, summary: s.summary };
    } catch {
      /* the real fare still shows, just without a description */
    }
    return {
      kind: "trip",
      trip: f.city,
      destCode: f.destination,
      depart: f.departDate,
      return: f.returnDate,
      nights: nightsBetween(f.departDate, f.returnDate),
      total: null, // the real price shows instead of an estimate
      ...blurb,
    };
  };

  const generate = async () => {
    const current = trip;
    setError("");
    if (!from) {
      setError("Pick the airport you're flying from.");
      return;
    }
    if (!lockPlace && !lockDates && fares.length && fareTurn.current++ % 2 === 0) {
      const f = pickFare();
      if (f) {
        setBusy(true);
        try {
          show(await tripFromFare(f), current);
        } finally {
          setBusy(false);
        }
        return;
      }
    }
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
          ...(fares.length && !lockDates ? { realFares: fareHints() } : {}),
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
    const real = realFor(trip);
    const p = new URLSearchParams({
      kind: "package",
      tab: "Flights",
      // The real fare may be from a nearby airport (e.g. JFK for EWR).
      from: (real?.fromCode || String(from || "")).toUpperCase(),
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
  const real = realFor(trip);
  // A real total only when it's everything for one traveler (flight + the
  // hotel Skyrio priced for 1 room, fees paid at the hotel included).
  const realTotal = real && who === 1 && real.tripTotal ? real.tripTotal : null;

  return (
    <div className="tg">
      <style>{CSS}</style>
      <div className="tg-glass tg-panel">
        <div className="tg-row" role="group" aria-label="Trip options">
          <div className="tg-fromWrap" aria-label="Flying from">
            <AirportInput
              value={fromAp ? `${fromAp.city || fromAp.code} (${fromAp.code})` : ""}
              onChange={(ap) => {
                pickedFrom.current = true;
                change(setFromAp)(ap?.code ? { code: ap.code, city: ap.city, name: ap.name } : null);
                setHomeSaved(false);
                setHomeErr(false);
                if (ap?.code) setError("");
              }}
              placeholder="Flying from?"
            />
          </div>
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
        {isAuthed && fromAp?.code && (fromAp.code !== home?.code || homeSaved) && (
          <p className="tg-homeHint">
            {homeSaved ? (
              <>Saved. {fromAp.code} is your home airport.</>
            ) : (
              <button
                type="button"
                className="tg-guestLink"
                onClick={async () => {
                  setHomeErr(false);
                  const r = await saveHomeAirport(fromAp);
                  if (r?.synced) setHomeSaved(true);
                  else setHomeErr(true);
                }}
              >
                {homeErr ? "Couldn't save it. Try again." : `Make ${fromAp.code} my home airport`}
              </button>
            )}
          </p>
        )}
        {/* Your travel style, from what Atlas learned. One tap turns it off. */}
        {styleLines.length > 0 && (
          <div className={`tg-style${styleOn ? " is-on" : ""}`}>
            <button
              type="button"
              className="tg-styleToggle"
              role="switch"
              aria-checked={styleOn}
              onClick={() => change(setUseStyle)(!useStyle)}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>
                {styleOn ? "Using your style: " : "Not using your style: "}
                <b>{styleLines[0].charAt(0).toLowerCase() + styleLines[0].slice(1)}</b>
                {styleLines.length > 1 ? ` + ${styleLines.length - 1} more` : ""}
              </span>
            </button>
            <Link to="/settings/atlas" className="tg-styleEdit">
              Edit
            </Link>
          </div>
        )}
        {/* Guests: one quiet line that this gets personal with an account. */}
        {!isAuthed && (
          <p className="tg-guestHint">
            With an account, Atlas learns how you travel.{" "}
            <Link to="/login" state={{ redirectTo: "/" }} className="tg-guestLink">
              Log in
            </Link>
          </p>
        )}
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

      {/* Preview mode only (?farePreview=1): is there test data to show? */}
      {farePreview && from && previewCount !== null && (
        <div className="tg-previewNote" role="note">
          {previewCount === "error"
            ? "Preview: couldn't load test fares."
            : previewCount > 0
            ? `Preview: ${previewCount} test fare${previewCount === 1 ? "" : "s"} from ${String(from).toUpperCase()}. Make me a trip uses them first.`
            : `Preview: no test fares from ${String(from).toUpperCase()} yet. The fare checks may be off (DEAL_SCAN_ENABLED on Render).`}
        </div>
      )}

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
            {realTotal ? (
              <div className="tg-total">
                <b>{usd(realTotal)}</b>
                <small>{testFares ? "test price · " : ""}flight + hotel for you</small>
              </div>
            ) : (
              Number.isFinite(trip.total) &&
              trip.total > 0 && (
                <div className="tg-total">
                  <b>{usd(trip.total)}</b>
                  <small>est. for {who === 1 ? "you" : `${who} people`}</small>
                </div>
              )
            )}
          </div>

          {/* Real prices Skyrio found for this exact trip. */}
          {real && (
            <div className={`tg-real${testFares ? " is-test" : ""}`}>
              <div className="tg-real__line">
                <span className="tg-real__badge">
                  {testFares ? "Test price (preview, not real)" : "Real Skyrio price"}
                </span>
                {real.lowerThanUsual && <span className="tg-real__low">Lower than usual on Skyrio</span>}
              </div>
              <div className="tg-real__line">
                <span>
                  Flight {real.fromCode} → {real.destination}
                  {real.stops === 0 ? " · nonstop" : ""}
                  {real.airline ? ` · ${real.airline}` : ""}
                </span>
                <b>{usd(real.price)} round trip{who > 1 ? " per person" : ""}</b>
              </div>
              {realTotal && real.hotel && (
                <div className="tg-real__line">
                  <span>Hotel · {real.hotel.name}</span>
                  <b>{usd(real.hotel.price + (real.hotel.payAtHotel || 0))}</b>
                </div>
              )}
              {realTotal && real.hotel?.payAtHotel > 0 && (
                <small>
                  Includes {usd(real.hotel.payAtHotel)} in fees paid at the hotel.
                </small>
              )}
              {real.usual && (
                <small>
                  This flight is usually {usd(real.usual.low)}–{usd(real.usual.high)} on Skyrio.
                </small>
              )}
              <small>Found {foundAgo(real.foundAt)}.</small>
              <MiniRouteMap
                from={real.from}
                to={[real.lat, real.lng]}
                label={`Map: ${real.fromCode} to ${real.city}`}
              />
            </div>
          )}

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
                  {(real?.fromCode || String(from || "")).toUpperCase()} → {trip.destCode}
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
            {real && testFares
              ? "Preview with test prices from Skyrio's sandbox. These aren't real prices."
              : real
              ? "Prices Skyrio found in the last day. Fares change, so the next step checks live prices before you pay."
              : `${trip.total ? "Estimated total. " : ""}Live prices show on the next step.`}{" "}
            Nothing is booked until you pay.
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
