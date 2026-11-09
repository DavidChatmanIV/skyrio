import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plane,
  BedDouble,
  CalendarDays,
  Hash,
  Receipt,
  AlertTriangle,
  Clock,
  X,
  Search,
  Users,
  User,
  Ticket,
  Copy,
  RotateCcw,
  ChevronDown,
  TrendingDown,
  Check,
  RefreshCw,
  Mail,
} from "lucide-react";
import SavedTrips from "../components/SavedTrips";

const API = import.meta.env.VITE_API_URL || "";

/* ── Styles (single drop-in file; matches the boarding pass / tickets) ── */
export const MT_CSS = `
.mt { min-height: 100vh; max-width: 980px; margin: 0 auto; padding: 24px 20px 72px; color: #fff; font-family: "DM Sans", system-ui, sans-serif; }
.mt button { font-family: inherit; }
.mt :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
.mt-mono { font-family: ui-monospace,"SFMono-Regular","JetBrains Mono",Menlo,Consolas,monospace; }

.mt-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; }
.mt-kicker { font-size: 11.5px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #ffb347; }
.mt-title { margin: 6px 0 4px; font-size: clamp(28px,4vw,40px); font-weight: 800; letter-spacing: -0.02em; }
.mt-sub { margin: 0; font-size: 14.5px; color: rgba(255,255,255,0.78); }
.mt-cta { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 999px; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; font-size: 14.5px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 22px rgba(255,138,42,.32); }
.mt-cta:hover { filter: brightness(1.06); }

.mt-section { margin-top: 26px; }
.mt-sectionHead { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.mt-h2 { margin: 0; font-size: 20px; font-weight: 800; }
.mt-h2sub { margin: 2px 0 0; font-size: 13px; color: rgba(255,255,255,0.7); }

.mt-tabs { display: inline-flex; gap: 4px; padding: 3px; border-radius: 999px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); }
.mt-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: rgba(255,255,255,0.78); font-size: 13px; font-weight: 700; cursor: pointer; }
.mt-tab span { font-size: 11px; opacity: .8; }
.mt-tab.is-on { background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; }

.mt-list { display: flex; flex-direction: column; gap: 10px; }
.mt-card { display: flex; align-items: stretch; border-radius: 18px; background: linear-gradient(160deg, rgba(74,40,112,0.6), rgba(34,18,62,0.7)); border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 14px 40px rgba(0,0,0,0.28); overflow: hidden; }
.mt-card.is-cancelled { opacity: .85; }
.mt-card.is-cancelled .mt-thumb { filter: grayscale(.7); }
.mt-main { flex: 1; min-width: 0; display: flex; gap: 14px; padding: 14px 16px; }
.mt-thumb { flex-shrink: 0; width: 60px; height: 60px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ffb347; background: linear-gradient(135deg, rgba(255,138,42,.22), rgba(139,108,255,.22)); border: 1px solid rgba(255,138,42,.28); background-size: cover; background-position: center; }
.mt-body { min-width: 0; flex: 1; }
.mt-name { font-size: 15.5px; font-weight: 800; line-height: 1.3; }
.mt-sub2 { margin-top: 2px; font-size: 13px; color: rgba(255,255,255,0.72); }
.mt-meta { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: rgba(255,255,255,0.75); }
.mt-meta > span { display: inline-flex; align-items: center; gap: 5px; }
.mt-meta b { color: #fff; font-weight: 700; }
.mt-note { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; font-size: 12.5px; line-height: 1.45; }
.mt-note svg { flex-shrink: 0; margin-top: 2px; }
.mt-kind { display: inline-flex; align-items: center; gap: 5px; margin: 6px 0 2px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; border: 1px solid rgba(255,255,255,0.16); color: rgba(255,255,255,0.78); background: rgba(255,255,255,0.04); max-width: 100%; }
.mt-kind span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mt-kind.is-group { color: #c4b5fd; border-color: rgba(167,139,250,.45); background: rgba(139,108,255,.14); cursor: pointer; }
.mt-kind.is-group:hover { border-color: #c4b5fd; color: #fff; }
.mt-card.is-focus { border-color: #ff8a2a; box-shadow: 0 0 0 2px rgba(255,138,42,.55), 0 14px 40px rgba(0,0,0,0.28); animation: mtFocus 1.6s ease 2; }
@keyframes mtFocus { 50% { box-shadow: 0 0 0 6px rgba(255,138,42,.18), 0 14px 40px rgba(0,0,0,0.28); } }
.mt-credit { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(110,231,168,.07); border: 1px solid rgba(110,231,168,.3); font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,.85); }
.mt-credit b { color: #6ee7a8; }
.mt-creditHead { display: flex; align-items: center; gap: 6px; font-weight: 800; color: #6ee7a8; font-size: 13px; }
.mt-code { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 3px 4px 3px 10px; border-radius: 8px; background: rgba(0,0,0,.3); border: 1px dashed rgba(255,255,255,.25); }
.mt-code button { display: inline-flex; align-items: center; gap: 4px; min-height: 26px; padding: 0 8px; border: 0; border-radius: 6px; background: rgba(255,255,255,.08); color: #fff; font-size: 11.5px; font-weight: 700; cursor: pointer; }
.mt-note.is-warn { color: #ffc27a; }
/* Cancellation progress */
.mt-track { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,138,42,.07); border: 1px solid rgba(255,179,71,.3); }
.mt-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
.mt-steps li { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; font-size: 11.5px; font-weight: 700; color: rgba(255,255,255,.55); }
.mt-steps li::before { content: ""; position: absolute; top: 11px; left: calc(-50% + 14px); right: calc(50% + 14px); height: 2px; background: rgba(255,255,255,.15); }
.mt-steps li:first-child::before { display: none; }
.mt-steps li.is-done::before, .mt-steps li.is-now::before { background: #ffb347; }
.mt-dot { position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,.25); background: rgba(34,18,62,.9); color: #1a0e06; }
.mt-steps li.is-done { color: #fff; }
.mt-steps li.is-done .mt-dot { background: #ffb347; border-color: #ffb347; }
.mt-steps li.is-now { color: #ffb347; }
.mt-steps li.is-now .mt-dot { border-color: #ffb347; box-shadow: 0 0 0 4px rgba(255,179,71,.18); }
.mt-steps li.is-now .mt-dot::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #ffb347; animation: mtPulse 1.4s ease-in-out infinite; }
@keyframes mtPulse { 50% { opacity: .35; } }
.mt-trackText { margin-top: 8px; font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,.82); }
.mt-trackText b { color: #fff; }
.mt-trackActs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.mt-trackActs .mt-btn { min-height: 32px; font-size: 12px; }
.mt-trackActs a.mt-btn { text-decoration: none; }
.mt-spin { animation: mtSpin 1s linear infinite; }
@keyframes mtSpin { to { transform: rotate(360deg); } }
.mt-note.is-good { color: #6ee7a8; }
.mt-note.is-muted { color: rgba(255,255,255,0.68); }
.mt-note a { color: #ffb347; }

.mt-stub { flex-shrink: 0; width: 150px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 14px 16px; border-left: 2px dashed rgba(255,255,255,0.14); }
.mt-pill { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); white-space: nowrap; }
.mt-pill.is-green { color: #6ee7a8; border-color: rgba(110,231,168,.4); background: rgba(110,231,168,.1); }
.mt-pill.is-orange { color: #ffc27a; border-color: rgba(255,138,42,.45); background: rgba(255,138,42,.12); }
.mt-pill.is-red { color: #ff8fa3; border-color: rgba(255,107,133,.45); background: rgba(255,107,133,.1); }
.mt-price { font-size: 17px; font-weight: 800; color: #ff9a47; font-variant-numeric: tabular-nums; }
.mt-priceLabel { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,0.6); text-align: right; }
.mt-actions { display: flex; flex-direction: column; align-items: stretch; gap: 6px; width: 100%; }
.mt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: rgba(255,255,255,0.88); font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.mt-btn:hover { border-color: rgba(255,138,42,.55); color: #ffb347; }
/* Cancel is easy to spot without hovering (testers couldn't find it). */
.mt-btn.is-danger { border-color: rgba(255,107,133,.45); color: #ff9db0; background: rgba(255,107,133,.06); }
.mt-btn.is-danger:hover { border-color: rgba(255,107,133,.8); color: #fff; background: rgba(255,107,133,.16); }
.mt-howto { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(255,138,42,.08); border: 1px solid rgba(255,138,42,.3); font-size: 13.5px; line-height: 1.55; color: rgba(255,255,255,.88); max-width: 620px; }
.mt-howto svg { flex-shrink: 0; margin-top: 2px; color: #ffb347; }
.mt-howto a { color: #ffb347; font-weight: 700; }

.mt-more { width: 100%; min-height: 40px; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; border: 1px dashed rgba(255,255,255,0.2); background: transparent; color: rgba(255,255,255,0.82); font-size: 13.5px; font-weight: 700; cursor: pointer; }
.mt-more:hover { border-color: rgba(255,138,42,.55); color: #ffb347; }
.mt-link { border: 0; background: none; padding: 4px 0; color: #ffb347; font-size: 13px; font-weight: 700; cursor: pointer; }
.mt-link:hover { color: #fff; }

.mt-empty { padding: 26px 18px; border-radius: 16px; border: 2px dashed rgba(255,255,255,0.14); text-align: center; font-size: 13.5px; color: rgba(255,255,255,0.72); }
.mt-empty b { display: block; margin-bottom: 4px; font-size: 15px; color: #fff; }
.mt-skel { height: 96px; border-radius: 18px; background: linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04)); background-size: 200% 100%; animation: mtShimmer 1.2s linear infinite; }
.mt-error { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 12px; background: rgba(255,107,133,.08); border: 1px solid rgba(255,107,133,.3); color: #ff9db0; font-size: 13.5px; }

/* Cancel modal */
.mt-modalScrim { position: fixed; inset: 0; z-index: 2000; background: rgba(5,3,12,0.72); display: flex; align-items: center; justify-content: center; padding: 20px; }
.mt-modal { position: relative; width: 100%; max-width: 460px; max-height: calc(100dvh - 40px); overflow-y: auto; border-radius: 22px; padding: 24px; background: linear-gradient(160deg, rgba(74,40,112,0.98), rgba(34,18,62,0.98)); border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 30px 80px rgba(0,0,0,0.6); color: #fff; font-family: "DM Sans", system-ui, sans-serif; }
.mt-modal::before { content: ""; position: absolute; top: 0; left: 24px; right: 24px; height: 3px; border-radius: 0 0 3px 3px; background: linear-gradient(90deg,#ff8a2a,#ffb347,#8b6cff); }
.mt-modal h2 { margin: 0 0 4px; font-size: 19px; font-weight: 800; }
.mt-modal .mt-modalSub { margin: 0 0 16px; font-size: 13px; color: rgba(255,255,255,0.7); }
.mt-quote { margin-bottom: 16px; padding: 12px 14px; border-radius: 14px; border: 1px dashed rgba(255,255,255,0.18); font-size: 14px; line-height: 1.7; }
.mt-quote .mt-row { display: flex; justify-content: space-between; gap: 10px; }
.mt-quote .mt-fine { margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.65); line-height: 1.5; }
.mt-modal textarea { width: 100%; box-sizing: border-box; margin-bottom: 14px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,0.16); color: #fff; font: inherit; font-size: 14px; resize: vertical; }
.mt-modalBtns { display: flex; gap: 10px; }
.mt-modalBtns > button { flex: 1; min-height: 46px; border-radius: 999px; font-size: 14px; font-weight: 800; cursor: pointer; }
.mt-keep { border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #fff; }
.mt-danger { border: 1px solid rgba(255,107,133,.55); background: rgba(255,107,133,.12); color: #ff8fa3; }
.mt-danger:disabled, .mt-keep:disabled { opacity: .5; cursor: default; }
.mt-final { margin: 0 0 14px; padding: 14px; border-radius: 14px; background: rgba(255,107,133,.08); border: 1px solid rgba(255,107,133,.35); }
.mt-final h3 { margin: 0 0 8px; font-size: 15px; font-weight: 800; color: #fff; }
.mt-final ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,.88); }
.mt-final b { color: #fff; }
.mt-understand { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 14px; font-size: 13.5px; line-height: 1.45; color: #fff; cursor: pointer; }
.mt-understand input { width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; accent-color: #ff6b85; }
.mt-done { width: 100%; min-height: 46px; border: 0; border-radius: 999px; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; font-weight: 800; cursor: pointer; }

@media (max-width: 640px) {
  .mt { padding: 16px 12px 64px; }
  .mt-card { flex-direction: column; }
  .mt-main { padding: 12px 14px; gap: 12px; }
  .mt-thumb { width: 48px; height: 48px; border-radius: 12px; }
  .mt-stub { width: auto; flex-direction: row; align-items: center; padding: 10px 14px; border-left: 0; border-top: 2px dashed rgba(255,255,255,0.12); }
  .mt-priceLabel { text-align: left; }
  .mt-actions { flex-direction: row; width: auto; }
  .mt-cta { width: 100%; justify-content: center; }
  .mt-modalScrim { align-items: flex-end; padding: 0; }
  .mt-modal { max-width: none; border-radius: 22px 22px 0 0; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
}
@keyframes mtShimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .mt-skel, .mt-card.is-focus, .mt-steps li.is-now .mt-dot::after { animation: none; } }
`;

/* ── Helpers — every value shown comes from the saved booking record ── */
// Trip dates are stored as midnight UTC. Formatting in UTC keeps New York
// travelers from seeing the day before their real date.
export const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
};

export const fmtMoney = (amount, currency) =>
  amount != null && Number.isFinite(Number(amount))
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(Number(amount))
    : null;

// "EWR → MIA · 2026-10-23 · round trip" → "EWR → MIA · round trip"
export const stripDates = (t) =>
  String(t || "")
    .replace(
      /\s*·\s*\d{4}-\d{2}-\d{2}(\s*(→|->|–|-)\s*\d{4}-\d{2}-\d{2})?/g,
      ""
    )
    .trim();

export function confirmationCodeOf(b) {
  return (
    b.confirmationCodes?.[0] ||
    b.flight?.bookingRef ||
    b.hotelStay?.confirmation?.find((c) => c?.hotelConfirmationCode)
      ?.hotelConfirmationCode ||
    null
  );
}

function isUpcoming(b) {
  const end = b.dates?.end || b.dates?.start;
  if (!end) return true;
  return new Date(end).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

const hasOpenCancelRequest = (b) => b.cancelRequest?.status === "open";

/* ── "Check today's price": search the same trip again on Book ──
   Same route (or hotel), same travelers, same cabin. Upcoming trips use the
   same dates; past trips use the same length starting 3 weeks from today.
   What was paid goes along so Book can show "You paid · Today from".
   It's only sent when the search really matches (all adults, known route),
   so the comparison is never apples to oranges. */
const DAY = 24 * 60 * 60 * 1000;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
export function priceCheckLink(b) {
  const isHotel = b.type === "Hotel";
  const start = b.dates?.start ? new Date(b.dates.start) : null;
  const end = b.dates?.end ? new Date(b.dates.end) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const nights =
    end && !Number.isNaN(end.getTime())
      ? Math.max(1, Math.round((end - start) / DAY))
      : null;
  const upcoming = start.getTime() > Date.now() + DAY;
  const depart = upcoming ? start : new Date(Date.now() + 21 * DAY);
  const ret = nights ? new Date(depart.getTime() + nights * DAY) : null;

  const p = new URLSearchParams({ auto: "1", depart: isoDay(depart) });
  if (ret) p.set("return", isoDay(ret));
  if (!upcoming) p.set("newDates", "1");

  const paid = Number(b.totalAmount ?? b.total);
  let comparable = paid > 0;

  if (isHotel) {
    const room = b.hotelStay?.rooms?.[0] || {};
    // Search the city, not the street ("1601 Biscayne Blvd, Miami" → "Miami").
    const addrParts = String(room.address || "")
      .split(",")
      .map((x) => x.replace(/\b\d{5}(-\d{4})?\b/, "").trim())
      .filter(Boolean);
    const cityFromAddress =
      addrParts.length > 1 ? addrParts.slice(1).join(", ") : addrParts[0];
    const where = room.city || cityFromAddress || room.name;
    if (!where || !ret) return null;
    const rooms = b.hotelStay?.rooms?.length || 1;
    p.set("tab", "Stays");
    p.set("city", where);
    p.set("rooms", String(rooms));
    p.set(
      "adults",
      String(Math.max(rooms, Number(room.adults) * rooms || rooms))
    );
    if (room.name) p.set("hotelName", room.name);
  } else {
    const f = b.flight || {};
    const m = String(b.tripDetails || "").match(
      /([A-Z]{3})\s*(?:→|->)\s*([A-Z]{3})/
    );
    const from = f.origin || m?.[1];
    const to = f.destination || m?.[2];
    if (!from || !to) return null;
    const pax = Array.isArray(b.passengers) ? b.passengers : [];
    const adults = pax.length
      ? pax.filter((x) => !x.type || /adult|ADT/i.test(x.type)).length
      : Number(b.travelers) || 1;
    // Children or infants on the booking: still search, but don't compare
    // (the search below is adults only).
    if (pax.length && adults !== pax.length) comparable = false;
    p.set("tab", "Flights");
    p.set("from", from);
    p.set("to", to);
    p.set("adults", String(Math.max(1, adults)));
    if (f.cabin) p.set("cabin", String(f.cabin).toLowerCase());
    if (/one[\s-]?way/i.test(b.tripDetails || "")) p.delete("return");
    if (f.airline) p.set("airline", f.airline);
  }

  if (comparable) {
    p.set("paid", String(Math.round(paid * 100) / 100));
    p.set("paidCur", b.totalCurrency || "USD");
    const bookedOn = b.paidAt || b.createdAt;
    if (bookedOn) p.set("bookedOn", isoDay(bookedOn));
  }
  return `/booking?${p.toString()}`;
}

/* Cancelled trips you've cleared from this list. The booking record itself
   is never deleted (it's your receipt) — it's just hidden here.
   Saved on the server (booking.hiddenByUser) so it syncs across devices.
   The browser copy below is only a fallback if the server can't be reached. */
const HIDDEN_KEY = "skyrio_hidden_bookings";
const readHidden = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const writeHidden = (set) => {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
  } catch {
    /* fine — it just won't be remembered */
  }
};

export const STATUS = {
  confirmed: { label: "Confirmed", tone: "green" },
  cancel_pending: { label: "Cancelling", tone: "orange" },
  cancelled: { label: "Cancelled", tone: "red" },
};

/* ── Airline credit (the airline gave credit instead of money back) ── */
export function AirlineCredit({ credit, airline }) {
  const [copied, setCopied] = useState(null);
  const vouchers = credit.vouchers?.length ? credit.vouchers : [null];
  const who = airline || "the airline";
  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — the code is still on screen */
    }
  };
  return (
    <div className="mt-credit">
      <div className="mt-creditHead">
        <Ticket size={14} aria-hidden="true" />
        {credit.amount
          ? `${fmtMoney(credit.amount, credit.currency)} airline credit`
          : "Airline credit"}
      </div>
      <div>
        Credit instead of money back. Book directly with {who} to use it
        {vouchers[0]?.expiresAt
          ? ` before ${fmtDate(vouchers[0].expiresAt)}`
          : " before it expires"}
        . Skyrio can&apos;t apply it yet.
      </div>
      {vouchers
        .filter((v) => v?.code)
        .map((v) => (
          <div key={v.code} className="mt-code">
            <span className="mt-mono">{v.code}</span>
            <button type="button" onClick={() => copy(v.code)}>
              <Copy size={12} aria-hidden="true" />
              {copied === v.code ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
    </div>
  );
}

/* ── Cancellation progress ────────────────────────────────────────
   Sent → Airline confirming → Refund. Shown while a cancellation is in
   progress, and after it while a card refund is still on its way.
   After 48 hours still "confirming": a Contact support link with the
   booking details filled in. "Check status" asks the airline now. */
const SUPPORT_EMAIL = "skyrioofficial@gmail.com";
const STUCK_HOURS = 48;
const ago = (t) => {
  const h = Math.floor((Date.now() - new Date(t).getTime()) / 3600000);
  if (!Number.isFinite(h) || h < 1) return "less than an hour ago";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};

function CancelProgress({ b, onCheck }) {
  const isHotel = b.type === "Hotel";
  const place = isHotel ? "hotel" : "airline";
  const pending = b.status === "cancel_pending";
  const refundComing =
    b.status === "cancelled" &&
    b.refundAmount > 0 &&
    b.refundStatus !== "succeeded";
  const [checking, setChecking] = useState(false);
  const [checkedNote, setCheckedNote] = useState("");
  if (!pending && !refundComing) return null;

  const sentAt = b.cancellation?.at || b.updatedAt;
  const hours = sentAt
    ? (Date.now() - new Date(sentAt).getTime()) / 3600000
    : 0;
  const stuck = pending && hours >= STUCK_HOURS;
  const cur = b.cancellation?.currency || b.totalCurrency;
  const expected = Number(b.cancellation?.customerRefund);

  const steps = [
    { label: "Sent", state: "done" },
    {
      label: isHotel ? "Hotel confirms" : "Airline confirms",
      state: pending ? "now" : "done",
    },
    {
      label: "Refund",
      state: refundComing ? "now" : "todo",
    },
  ];

  const check = async () => {
    setChecking(true);
    setCheckedNote("");
    try {
      const updated = await onCheck?.(b);
      if (updated && updated.status !== b.status) return; // card re-renders
      setCheckedNote(`Checked just now. Still with the ${place}.`);
    } catch {
      setCheckedNote("Couldn't check right now. Try again in a minute.");
    } finally {
      setChecking(false);
    }
  };

  const mail = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Cancellation still pending · booking ${String(b._id).slice(-10)}`
  )}&body=${encodeURIComponent(
    `Hi Skyrio,\n\nMy cancellation is still pending.\n\nTrip: ${stripDates(
      b.tripDetails
    )}\nBooking ID: ${b._id}\nConfirmation: ${
      confirmationCodeOf(b) || "—"
    }\nCancellation sent: ${
      sentAt ? new Date(sentAt).toLocaleString("en-US") : "—"
    }\n\nThanks!`
  )}`;

  return (
    <div className="mt-track" role="status">
      <ol className="mt-steps" aria-label="Cancellation progress">
        {steps.map((st) => (
          <li key={st.label} className={`is-${st.state}`}>
            <span className="mt-dot" aria-hidden="true">
              {st.state === "done" && <Check size={13} strokeWidth={3} />}
            </span>
            {st.label}
          </li>
        ))}
      </ol>
      <div className="mt-trackText">
        {pending ? (
          <>
            Sent {sentAt ? ago(sentAt) : "recently"}. The {place} confirms it,
            usually within a few hours to 2 days.
            {expected > 0 && (
              <>
                {" "}
                Expected refund: <b>{fmtMoney(expected, cur)}</b>. The {place}{" "}
                sets the final amount.
              </>
            )}
            {stuck && (
              <>
                {" "}
                <b>Taking longer than usual.</b> We&apos;re checking with the{" "}
                {place}. Contact us if you need it sooner.
              </>
            )}
          </>
        ) : (
          <>
            Cancelled. <b>{fmtMoney(b.refundAmount, b.totalCurrency)}</b> is on
            its way to your card, usually 5–10 business days.
          </>
        )}
      </div>
      {pending && (
        <div className="mt-trackActs">
          {onCheck && (
            <button
              type="button"
              className="mt-btn"
              onClick={check}
              disabled={checking}
            >
              <RefreshCw
                size={13}
                aria-hidden="true"
                className={checking ? "mt-spin" : undefined}
              />
              {checking ? "Checking…" : "Check status"}
            </button>
          )}
          {stuck && (
            <a className="mt-btn" href={mail}>
              <Mail size={13} aria-hidden="true" /> Contact support
            </a>
          )}
        </div>
      )}
      {checkedNote && (
        <div className="mt-trackText" style={{ marginTop: 6 }}>
          {checkedNote}
        </div>
      )}
    </div>
  );
}

/* ── One booked trip ─────────────────────────────────────────────── */
function BookedTripCard({ b, onCancel, onRemove, onCheck, focused }) {
  const navigate = useNavigate();
  const isHotel = b.type === "Hotel";
  const room = b.hotelStay?.rooms?.[0];
  const code = confirmationCodeOf(b);
  const start = fmtDate(b.dates?.start);
  const end = fmtDate(b.dates?.end);
  const paid = fmtMoney(b.totalAmount ?? b.total, b.totalCurrency);
  const st = STATUS[b.status] || { label: b.status, tone: "orange" };
  const cancelled = b.status === "cancelled";
  const title = isHotel
    ? room?.name || stripDates(b.tripDetails)
    : stripDates(b.tripDetails);
  const subtitle = isHotel
    ? [room?.roomName, room?.boardName].filter(Boolean).join(" · ")
    : b.flight?.airline;
  // Today's price only makes sense on a trip you're keeping.
  const checkLink = b.status === "confirmed" ? priceCheckLink(b) : null;
  const canCancel =
    onCancel &&
    !b.sharedRoom &&
    b.status === "confirmed" &&
    isUpcoming(b) &&
    !hasOpenCancelRequest(b);

  return (
    <article
      id={`mt-booking-${b._id}`}
      className={`mt-card${cancelled ? " is-cancelled" : ""}${
        focused ? " is-focus" : ""
      }`}
    >
      <div className="mt-main">
        <div
          className="mt-thumb"
          style={
            room?.thumbnail
              ? { backgroundImage: `url(${room.thumbnail})` }
              : undefined
          }
          aria-hidden="true"
        >
          {!room?.thumbnail &&
            (isHotel ? <BedDouble size={24} /> : <Plane size={24} />)}
        </div>
        <div className="mt-body">
          <div className="mt-name">{title || "Trip"}</div>
          {subtitle && <div className="mt-sub2">{subtitle}</div>}
          {b.syncTrip ? (
            <button
              type="button"
              className="mt-kind is-group"
              onClick={() => navigate(`/sync-together/${b.syncTrip.id}`)}
              title="Open the group trip"
            >
              <Users size={12} aria-hidden="true" />
              <span>Sync Together · {b.syncTrip.title}</span>
            </button>
          ) : (
            <span className="mt-kind">
              <User size={12} aria-hidden="true" />
              <span>Solo trip</span>
            </span>
          )}
          <div className="mt-meta">
            {(start || end) && (
              <span>
                <CalendarDays size={13} aria-hidden="true" />
                {start}
                {end && end !== start ? ` → ${end}` : ""}
              </span>
            )}
            {code && (
              <span>
                <Hash size={13} aria-hidden="true" />
                {isHotel ? "Hotel conf." : "Airline conf."}{" "}
                <b className="mt-mono">{code}</b>
              </span>
            )}
          </div>

          {cancelled && b.cancellation?.airlineCredit && (
            <AirlineCredit
              credit={b.cancellation.airlineCredit}
              airline={b.flight?.airline}
            />
          )}
          <CancelProgress b={b} onCheck={onCheck} />
          {cancelled &&
            b.refundAmount > 0 &&
            b.refundStatus === "succeeded" && (
              <div className="mt-note is-good">
                <Receipt size={13} aria-hidden="true" />
                Refund {fmtMoney(b.refundAmount, b.totalCurrency)}{" "}
                {b.refundStatus === "succeeded"
                  ? "issued"
                  : "on its way to your card"}
              </div>
            )}
          {b.status === "confirmed" && hasOpenCancelRequest(b) && (
            <div className="mt-note is-warn">
              <Clock size={13} aria-hidden="true" />
              Cancellation requested. Our team will contact you before anything
              is cancelled.
            </div>
          )}
          {b.sharedRoom && b.status === "confirmed" && (
            <div className="mt-note is-muted">
              <Users size={13} aria-hidden="true" />
              <span>
                Shared room ({b.sharedRoom.people} people). Only the trip
                organizer can cancel it
                {b.sharedRoom.groupId ? (
                  <>
                    {" "}
                    —{" "}
                    <a href={`/sync-together/${b.sharedRoom.groupId}`}>
                      open the trip
                    </a>
                  </>
                ) : null}
                .
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-stub">
        <span className={`mt-pill is-${st.tone}`}>{st.label}</span>
        {paid && (
          <div>
            <div className="mt-priceLabel">Paid</div>
            <div className="mt-price">{paid}</div>
          </div>
        )}
        {(canCancel || checkLink || (cancelled && onRemove)) && (
          <div className="mt-actions">
            {checkLink && (
              <button
                type="button"
                className="mt-btn"
                onClick={() => navigate(checkLink)}
                title="Search this trip again and compare with what you paid"
              >
                <TrendingDown size={14} aria-hidden="true" /> Today&apos;s price
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="mt-btn is-danger"
                onClick={() => onCancel(b)}
                aria-label={`Cancel ${title || "this booking"}`}
              >
                <X size={14} aria-hidden="true" /> Cancel booking
              </button>
            )}
            {cancelled && onRemove && (
              <button
                type="button"
                className="mt-btn"
                onClick={() => onRemove(b)}
                aria-label={`Remove ${title} from this list`}
              >
                <X size={14} aria-hidden="true" /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Cancel flow — shows the real terms BEFORE anything is cancelled.
   If the airline/hotel can't give terms automatically, the traveler can
   send a cancellation REQUEST that a person handles — nothing is cancelled
   until the terms are confirmed with them. (Logic unchanged.) ── */
// authHeaders: optional. The Manage booking page passes the booking's
// manage-link header so guests (no account) can cancel too.
const SHEET_CSS = `
  html.sk-sheet-open .ap-fab-wrapper,
  html.sk-sheet-open [data-sr-root] { display: none !important; }
`;

export function CancelTripModal({ booking, onClose, onDone, authHeaders }) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [canRequest, setCanRequest] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  // Two steps: "Cancel trip" opens a final check (what happens + a box to
  // tick); only "Yes, cancel" there actually cancels.
  const [finalCheck, setFinalCheck] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(authHeaders || (token ? { Authorization: `Bearer ${token}` } : {})),
  };
  const cur = booking.totalCurrency || "USD";
  const place = booking.type === "Hotel" ? "hotel" : "airline";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/bookings/${booking._id}/cancel-quote`,
          { headers }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setCanRequest(Boolean(data.canRequest));
          throw new Error(data.message || "Couldn't load cancellation terms.");
        }
        if (!cancelled) {
          setQuote(data);
          // The booking changed since the page loaded (a cancellation is
          // already under way, or done): refresh the page behind the sheet
          // so it stops showing "Confirmed".
          if (
            data.cancellable === false &&
            data.status &&
            data.status !== booking.status
          )
            onDone?.({ _id: booking._id, status: data.status });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking._id]);

  // While this sheet is open, hide the Atlas and Help buttons so they
  // don't sit on top of "Cancel trip" on phones.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sk-sheet-open");
    return () => root.classList.remove("sk-sheet-open");
  }, []);

  // Esc closes (unless something is in flight)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // One plain line for the final check: what comes back, per the airline/hotel.
  const getBack = (() => {
    if (!quote) return null;
    if (quote.refundTo === "airline_credit")
      return quote.airlineCredit?.amount
        ? `${fmtMoney(
            quote.airlineCredit.amount,
            quote.airlineCredit.currency || quote.currency
          )} in airline credit (not money back to your card)`
        : "Airline credit (not money back to your card)";
    if (quote.estimatedRefund == null)
      return `A refund decided by the ${place} when it cancels`;
    if (Number(quote.estimatedRefund) <= 0) return "No refund";
    return `About ${fmtMoney(
      quote.estimatedRefund,
      quote.currency
    )} back to your card, usually in 5–10 business days`;
  })();

  const confirmCancel = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/bookings/${booking._id}/cancel`, {
        method: "POST",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202 && res.status !== 207) {
        throw new Error(data.message || "Cancellation failed.");
      }
      setResult(data);
      onDone?.(data.booking);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/api/bookings/${booking._id}/cancel-request`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ reason: requestNote }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "Couldn't send your request.");
      setRequested(true);
      onDone?.(data.booking);
    } catch (e) {
      setError(e.message);
      setCanRequest(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-modalScrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <style>{SHEET_CSS}</style>
      <div
        className="mt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mt-cancel-title"
      >
        <h2 id="mt-cancel-title">
          {requested ? "Request sent" : "Cancel this trip?"}
        </h2>
        <p className="mt-modalSub">{stripDates(booking.tripDetails)}</p>

        {requested ? (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
              Request received. We emailed you a copy. Your trip is{" "}
              <strong>not cancelled yet</strong>. We&apos;ll confirm the terms
              with the {place} and contact you first.
            </p>
            <button type="button" className="mt-done" onClick={onClose}>
              Done
            </button>
          </>
        ) : result ? (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
              {result.pending
                ? `Cancellation sent. The ${place} confirms it, usually within a few hours to 2 days. We'll notify you.`
                : result.airlineCredit
                ? `Cancelled. The airline gave you ${
                    result.airlineCredit.amount
                      ? `${fmtMoney(
                          result.airlineCredit.amount,
                          result.airlineCredit.currency || cur
                        )} in airline credit`
                      : "airline credit"
                  } instead of a refund. It's on this trip in My Trips.`
                : result.partial
                ? result.message
                : result.customerRefund > 0
                ? `Cancelled. A refund of ${fmtMoney(
                    result.customerRefund,
                    cur
                  )} is on its way to your card (usually 5–10 business days).`
                : "Cancelled. No refund under this booking's policy."}
            </p>
            <button type="button" className="mt-done" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            {!quote && !error && (
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                Checking the cancellation terms…
              </p>
            )}
            {quote && quote.cancellable === false && (
              <p
                className="mt-note is-warn"
                role="status"
                style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 16px" }}
              >
                <Clock size={15} aria-hidden="true" /> {quote.reason}
              </p>
            )}

            {quote && quote.cancellable !== false && (
              <div className="mt-quote">
                <div className="mt-row">
                  <span>You paid</span>
                  <strong>{fmtMoney(quote.paid, quote.currency)}</strong>
                </div>
                {quote.refundTo === "airline_credit" ? (
                  <div className="mt-row">
                    <span>You get back</span>
                    <strong style={{ color: "#ffc27a" }}>
                      {quote.airlineCredit?.amount
                        ? `${fmtMoney(
                            quote.airlineCredit.amount,
                            quote.airlineCredit.currency || quote.currency
                          )} airline credit`
                        : "Airline credit"}
                    </strong>
                  </div>
                ) : (
                  <div className="mt-row">
                    <span>Estimated refund</span>
                    <strong style={{ color: "#6ee7a8" }}>
                      {quote.estimatedRefund != null
                        ? fmtMoney(quote.estimatedRefund, quote.currency)
                        : `set by the ${place} at cancellation`}
                    </strong>
                  </div>
                )}
                {quote.estimatedFee != null && quote.estimatedFee > 0 && (
                  <div className="mt-row">
                    <span>Cancellation fee</span>
                    <span>{fmtMoney(quote.estimatedFee, quote.currency)}</span>
                  </div>
                )}
                {quote.note && <div className="mt-fine">{quote.note}</div>}
                <div className="mt-fine">
                  Set by the {place}, not Skyrio. This is their estimate; their
                  final answer applies.
                </div>
              </div>
            )}
            {error && (
              <div
                className={`mt-note ${canRequest ? "is-warn" : ""}`}
                style={{
                  marginBottom: 14,
                  color: canRequest ? undefined : "#ff9db0",
                }}
                role="alert"
              >
                <AlertTriangle size={14} aria-hidden="true" /> {error}
              </div>
            )}

            {canRequest ? (
              <>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,0.8)",
                    margin: "0 0 12px",
                  }}
                >
                  You can send a request instead. We&apos;ll check the terms
                  with the {place} and contact you <strong>before</strong>{" "}
                  anything is cancelled.
                </p>
                <label
                  htmlFor="mt-cancel-note"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                  }}
                >
                  Note for our team
                </label>
                <textarea
                  id="mt-cancel-note"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Anything we should know? (optional)"
                />
                <div className="mt-modalBtns">
                  <button
                    type="button"
                    className="mt-keep"
                    onClick={onClose}
                    disabled={busy}
                  >
                    Keep my trip
                  </button>
                  <button
                    type="button"
                    className="mt-danger"
                    onClick={sendRequest}
                    disabled={busy}
                  >
                    {busy ? "Sending…" : "Request cancellation"}
                  </button>
                </div>
              </>
            ) : quote && quote.cancellable === false ? (
              // Nothing to cancel here (already cancelled or in progress):
              // one clear button instead of a greyed-out "Cancel trip".
              <button type="button" className="mt-done" onClick={onClose}>
                Got it
              </button>
            ) : finalCheck ? (
              <>
                <div className="mt-final" role="alert">
                  <h3>Before you cancel</h3>
                  <ul>
                    <li>
                      <b>This can&rsquo;t be undone.</b>{" "}
                      {booking.type === "Hotel"
                        ? "Your room is released and may not be available again at this price."
                        : "Your seats are released and the fare may not be available again at this price."}
                    </li>
                    {booking.type !== "Hotel" && (
                      <li>
                        It cancels <b>every flight and every traveler</b> on
                        this booking, including the return if you booked a round
                        trip.
                      </li>
                    )}
                    {getBack && (
                      <li>
                        You get back: <b>{getBack}</b>. The {place} decides the
                        final amount, not Skyrio.
                      </li>
                    )}
                    {booking.type !== "Hotel" && (
                      <li>
                        Seats or bags you paid for usually aren&rsquo;t refunded
                        separately. The airline decides.
                      </li>
                    )}
                    {booking.syncGroup && (
                      <li>
                        Your Sync Together group will see that you cancelled.
                      </li>
                    )}
                  </ul>
                </div>
                <label className="mt-understand">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                  />
                  <span>
                    I understand this cancels my{" "}
                    {booking.type === "Hotel" ? "stay" : "flight"} and
                    can&rsquo;t be undone.
                  </span>
                </label>
                <div className="mt-modalBtns">
                  <button
                    type="button"
                    className="mt-keep"
                    onClick={() => {
                      setFinalCheck(false);
                      setUnderstood(false);
                    }}
                    disabled={busy}
                  >
                    Go back
                  </button>
                  <button
                    type="button"
                    className="mt-danger"
                    onClick={confirmCancel}
                    disabled={busy || !understood}
                  >
                    {busy ? "Cancelling…" : "Yes, cancel"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-modalBtns">
                <button
                  type="button"
                  className="mt-keep"
                  onClick={onClose}
                  disabled={busy}
                >
                  Keep my trip
                </button>
                <button
                  type="button"
                  className="mt-danger"
                  onClick={() => setFinalCheck(true)}
                  disabled={busy || !quote || quote.cancellable === false}
                >
                  Continue to cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Booked trips — the signed-in user's own bookings ─────────────── */
const PREVIEW_COUNT = 3;

function BookedTrips() {
  const [state, setState] = useState({ loading: true, items: [], error: "" });
  // ?booking=<id> — opened from a notification: show and highlight that trip
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("booking");
  const [focused, setFocused] = useState(null);
  const jumped = useRef(null);
  const [cancelling, setCancelling] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [showAll, setShowAll] = useState(false);
  const [hidden, setHidden] = useState(readHidden);
  const [lastRemoved, setLastRemoved] = useState(null);

  const replaceBooking = (updated) => {
    if (!updated?._id) return;
    setState((s) => ({
      ...s,
      items: s.items.map((b) =>
        b._id === updated._id ? { ...b, ...updated } : b
      ),
    }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          if (!cancelled) setState({ loading: false, items: [], error: "" });
          return;
        }
        const res = await fetch(`${API}/api/bookings?mine=1&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "Couldn't load your trips.");
        const items = (data.items || []).filter((b) =>
          ["confirmed", "cancel_pending", "cancelled"].includes(b.status)
        );
        if (!cancelled) setState({ loading: false, items, error: "" });
      } catch (e) {
        if (!cancelled)
          setState({ loading: false, items: [], error: e.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Upcoming and past only hold active trips; cancelled ones get their
     own tab (where they can be cleared). */
  const groups = useMemo(() => {
    // Trips you're keeping. Ones being cancelled get their own tab.
    const active = state.items.filter((b) => b.status === "confirmed");
    return {
      upcoming: active
        .filter(isUpcoming)
        .sort(
          (a, b) =>
            new Date(a.dates?.start || 0) - new Date(b.dates?.start || 0)
        ),
      past: active
        .filter((b) => !isUpcoming(b))
        .sort(
          (a, b) =>
            new Date(b.dates?.start || 0) - new Date(a.dates?.start || 0)
        ),
      cancelling: state.items
        .filter((b) => b.status === "cancel_pending")
        .sort(
          (a, b) =>
            new Date(b.cancellation?.at || b.updatedAt || 0) -
            new Date(a.cancellation?.at || a.updatedAt || 0)
        ),
      cancelled: state.items.filter(
        (b) =>
          b.status === "cancelled" &&
          // a trip opened from a notification shows even if you'd cleared it
          (b._id === focusId || (!b.hiddenByUser && !hidden.has(b._id)))
      ),
    };
  }, [state.items, hidden, focusId]);

  // Opened from a notification: switch to the right tab, show it, scroll
  // to it and highlight it for a moment.
  useEffect(() => {
    if (!focusId || state.loading || jumped.current === focusId) return;
    const key = ["upcoming", "cancelling", "past", "cancelled"].find((k) =>
      groups[k].some((b) => b._id === focusId)
    );
    if (!key) return; // not one of your trips (or not loaded)
    jumped.current = focusId;
    setTab(key);
    if (groups[key].findIndex((b) => b._id === focusId) >= PREVIEW_COUNT)
      setShowAll(true);
    setFocused(focusId);
    setTimeout(() => {
      document
        .getElementById(`mt-booking-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    setTimeout(() => setFocused(null), 4000);
  }, [focusId, state.loading, groups]);

  const tabs = [
    { key: "upcoming", label: "Upcoming" },
    { key: "cancelling", label: "Cancelling" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ].filter((t) => t.key === "upcoming" || groups[t.key].length > 0);
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "upcoming";
  const list = groups[activeTab];
  const visible = showAll ? list : list.slice(0, PREVIEW_COUNT);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });
  const markHidden = (ids, value) =>
    setState((s) => ({
      ...s,
      items: s.items.map((b) =>
        ids.includes(b._id) ? { ...b, hiddenByUser: value } : b
      ),
    }));
  // Server first; if it can't be reached, remember it in this browser.
  const hideLocally = (ids) => {
    const next = new Set([...hidden, ...ids]);
    setHidden(next);
    writeHidden(next);
  };

  const removeOne = async (b) => {
    markHidden([b._id], true);
    setLastRemoved([b._id]);
    try {
      const res = await fetch(`${API}/api/bookings/${b._id}/hide`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
    } catch {
      hideLocally([b._id]);
    }
  };
  const removeAllCancelled = async () => {
    const ids = groups.cancelled.map((b) => b._id);
    markHidden(ids, true);
    setLastRemoved(ids);
    try {
      const res = await fetch(`${API}/api/bookings/mine/hide-cancelled`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
    } catch {
      hideLocally(ids);
    }
  };
  const undoRemove = async () => {
    if (!lastRemoved) return;
    const ids = lastRemoved;
    setLastRemoved(null);
    markHidden(ids, false);
    const next = new Set(hidden);
    ids.forEach((id) => next.delete(id));
    setHidden(next);
    writeHidden(next);
    await Promise.allSettled(
      ids.map((id) =>
        fetch(`${API}/api/bookings/${id}/unhide`, {
          method: "PATCH",
          headers: authHeaders(),
        })
      )
    );
  };

  // "Check status": ask the airline now. Updates the card if it changed.
  const checkCancel = async (b) => {
    const res = await fetch(`${API}/api/bookings/${b._id}/check-cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.booking) throw new Error(data.message || "failed");
    replaceBooking(data.booking);
    return data.booking;
  };

  const emptyCopy = {
    cancelling: (
      <>
        <b>Nothing being cancelled</b>
        Trips you cancel show here until they&apos;re final.
      </>
    ),
    upcoming: (
      <>
        <b>No upcoming trips</b>
        Your next booking shows up here.
      </>
    ),
    past: (
      <>
        <b>No past trips yet</b>
        Trips move here after you travel.
      </>
    ),
    cancelled: (
      <>
        <b>Nothing here</b>
        Cancelled trips you clear won&apos;t show up again.
      </>
    ),
  };

  return (
    <section className="mt-section" aria-labelledby="mt-booked">
      <div className="mt-sectionHead">
        <div>
          <h2 className="mt-h2" id="mt-booked">
            Booked trips
          </h2>
          <p className="mt-h2sub">
            Your confirmation emails have the full details.
          </p>
        </div>
        {!state.loading && !state.error && state.items.length > 0 && (
          <div className="mt-tabs" role="tablist" aria-label="Booked trips">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                className={`mt-tab${activeTab === t.key ? " is-on" : ""}`}
                onClick={() => {
                  setTab(t.key);
                  setShowAll(false);
                }}
              >
                {t.label}{" "}
                <span className="mt-mono">{groups[t.key].length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {state.loading ? (
        <div className="mt-list">
          <div className="mt-skel" />
          <div className="mt-skel" />
        </div>
      ) : state.error ? (
        <div className="mt-error" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          {state.error}
        </div>
      ) : state.items.length === 0 ? (
        <div className="mt-empty">
          <b>No booked trips yet</b>
          Your bookings show up here.
        </div>
      ) : (
        <>
          {activeTab === "cancelled" && list.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                fontSize: 12.5,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              <span>
                Clearing only hides it. Records and refunds aren&apos;t
                affected.
              </span>
              <button
                type="button"
                className="mt-link"
                onClick={removeAllCancelled}
              >
                Clear all
              </button>
            </div>
          )}

          {list.length === 0 ? (
            <div className="mt-empty">{emptyCopy[activeTab]}</div>
          ) : (
            <div className="mt-list">
              {visible.map((b) => (
                <BookedTripCard
                  key={b._id}
                  b={b}
                  focused={focused === b._id}
                  onCancel={activeTab === "upcoming" ? setCancelling : null}
                  onRemove={removeOne}
                  onCheck={checkCancel}
                />
              ))}
            </div>
          )}

          {list.length > PREVIEW_COUNT && (
            <button
              type="button"
              className="mt-more"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll
                ? "Show fewer"
                : `Show ${list.length - PREVIEW_COUNT} more`}
              <ChevronDown
                size={15}
                style={showAll ? { transform: "rotate(180deg)" } : undefined}
              />
            </button>
          )}

          {lastRemoved && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 10,
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {lastRemoved.length === 1
                ? "Trip removed from this list."
                : `${lastRemoved.length} trips removed from this list.`}
              <button type="button" className="mt-link" onClick={undoRemove}>
                <RotateCcw
                  size={13}
                  style={{ verticalAlign: "-2px", marginRight: 4 }}
                  aria-hidden="true"
                />
                Undo
              </button>
            </div>
          )}
        </>
      )}

      {cancelling && (
        <CancelTripModal
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onDone={replaceBooking}
        />
      )}
    </section>
  );
}

export default function SavedTripsPage() {
  const navigate = useNavigate();

  return (
    <div className="mt">
      <style>{MT_CSS}</style>
      <header className="mt-head">
        <div>
          <div className="mt-kicker mt-mono">Your Skyrio</div>
          <h1 className="mt-title">My trips</h1>
          <p className="mt-sub">Booked trips and saved ideas.</p>
          <div className="mt-howto" role="note">
            <X size={16} aria-hidden="true" />
            <span>
              <b>Need to cancel?</b> Tap <b>Cancel booking</b> on the trip
              below. You&apos;ll see the refund first. No account?{" "}
              <a href="/find-booking">Find my booking</a>
            </span>
          </div>
        </div>
        <button
          type="button"
          className="mt-cta"
          onClick={() => navigate("/booking")}
        >
          <Search size={16} aria-hidden="true" /> Find more trips
        </button>
      </header>

      <BookedTrips />

      <section className="mt-section" aria-labelledby="mt-saved">
        <div className="mt-sectionHead">
          <div>
            <h2 className="mt-h2" id="mt-saved">
              Saved for later
            </h2>
            <p className="mt-h2sub">Compare and book when you&apos;re ready.</p>
          </div>
        </div>
        <SavedTrips />
      </section>
    </div>
  );
}
