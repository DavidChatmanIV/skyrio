// Renders the "Travel Journeys" card on the Digital Passport.
// Combines the user's own bookings with their Sync Together group trips,
// hides cancelled ones.
//
// Four tabs, one list each, so each list does one job:
//   - Bookings: upcoming flights and hotels, with any trips being
//     cancelled in their own short "Cancelling" section (status, how long
//     since it was sent, and a Track link to the full tracker in My trips)
//   - Group trips: Sync Together trips being planned (tap to open)
//   - Past trips: trips already taken (each earns a passport stamp)
//   - Cancel a trip: the bookings that can be cancelled, each with a
//     Cancel button (same flow as My trips: the refund estimate shows
//     before anything is cancelled)

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Skeleton } from "antd";
import {
  Plane,
  BedDouble,
  Compass,
  Users,
  ChevronRight,
  X,
  Clock,
  Check,
  AlertTriangle,
} from "lucide-react";
import { CancelTripModal, MT_CSS } from "@/pages/SavedTripsPage";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

// The real routes (see routes/bookings.routes.js and
// routes/api/syncTogether.routes.js).
const BOOKINGS_ENDPOINTS = ["/api/bookings?mine=1&limit=100"];
const SYNC_ENDPOINTS = ["/api/sync-together/my-trips"];

const HIDDEN_STATUSES = [
  "cancelled",
  "canceled",
  "refunded",
  "failed",
  "pending",
  "archived",
  "deleted",
];

// ── Helpers ──
const pick = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== "");
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
// Dates are stored as midnight UTC — format in UTC so travelers in New York
// don't see the day before their real trip date.
const fmt = (d) =>
  d
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
// "Hotel · 2026-11-20 → 2026-11-24 · shared room" → "Hotel · shared room"
const stripDates = (t) =>
  String(t || "")
    .replace(/\s*·\s*\d{4}-\d{2}-\d{2}\s*(→|->|–|-)\s*\d{4}-\d{2}-\d{2}/g, "")
    .trim();

// Loads the list from the route; returns the array, or null.
async function fetchFirstList(paths, { token, signal, label, keys }) {
  const failures = [];
  for (const path of paths) {
    const res = await fetch(apiUrl(path), {
      credentials: "include",
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      failures.push(`${path} → ${res.status}`);
      continue;
    }
    const data = await res.json().catch(() => null);
    const arr = Array.isArray(data)
      ? data
      : keys.map((k) => data?.[k]).find(Array.isArray);
    if (Array.isArray(arr)) {
      console.info(
        `[TravelJourneys] ${label}: loaded ${arr.length} from ${path}`,
        arr[0]
      );
      return arr;
    }
    failures.push(`${path} → 200 but no array in response`);
  }
  console.warn(`[TravelJourneys] ${label}: no endpoint worked:`, failures);
  return null;
}

// ── Normalizers ──
function normalizeBooking(b) {
  const flight = b.flight || b.details || {};
  const origin = pick(b.origin, b.from, flight.origin, flight.from);
  const destination = pick(
    b.destination,
    b.to,
    flight.destination,
    flight.to,
    b.hotel?.city,
    b.city
  );
  const start = toDate(
    pick(
      b.departureDate,
      b.startDate,
      b.checkIn,
      b.checkInDate,
      flight.departureDate,
      b.dates?.start
    )
  );
  const end =
    toDate(
      pick(
        b.returnDate,
        b.endDate,
        b.checkOut,
        b.checkOutDate,
        flight.returnDate,
        b.dates?.end
      )
    ) || start;
  const type = String(pick(b.type, b.kind, b.category, "flight")).toLowerCase();
  const hotelName = pick(b.hotelName, b.hotel?.name);
  const isStay = type.includes("hotel") || type.includes("stay");
  return {
    id: `b-${b._id || b.id}`,
    kind: "booking",
    type,
    title:
      isStay && hotelName
        ? hotelName
        : origin && destination
        ? `${origin} → ${destination}`
        : stripDates(b.tripDetails) ||
          hotelName ||
          destination ||
          b.title ||
          (isStay ? "Hotel stay" : "Trip"),
    subtitle: isStay
      ? pick(destination !== hotelName ? destination : null, b.providerName)
      : pick(b.airline, flight.airline, b.providerName),
    // Which Sync Together trip this booking belongs to, so a member's
    // share shows once (as the group stamp), not twice.
    groupRef: String(
      pick(
        b.syncTrip?.id,
        b.syncGroup,
        b.flight?.groupId,
        b.sharedRoom?.groupId,
        b.syncTripId,
        b.groupId
      ) ?? ""
    ),
    start,
    end,
    status: String(pick(b.status, "confirmed")).toLowerCase(),
    // What the cancel flow needs (same as My trips).
    booking: {
      _id: b._id || b.id,
      type: b.type,
      tripDetails: b.tripDetails,
      totalCurrency: b.totalCurrency,
      status: b.status,
      sharedRoom: b.sharedRoom,
    },
    // When the cancellation was sent (for "Sent 2 days ago").
    cancelSentAt: toDate(pick(b.cancellation?.at, b.cancelledAt, b.updatedAt)),
  };
}

// Same 2-day mark as My trips: after that it's "taking longer".
const STUCK_HOURS = 48;
function sentAgo(d) {
  if (!d) return "";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? "Sent just now" : `Sent ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Sent ${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `Sent ${days} day${days === 1 ? "" : "s"} ago`;
}

function normalizeSync(t) {
  // members[] doesn't include the organizer, so add 1. People who
  // declined aren't counted.
  const members = (
    pick(t.members, t.participants, t.travelers, []) || []
  ).filter((m) => m?.status !== "declined");
  const memberCount = Array.isArray(members)
    ? members.length + 1
    : Number(t.memberCount || 0);
  const destination = pick(
    t.destination,
    t.destinationName,
    t.city,
    t.location
  );
  const start = toDate(
    pick(
      t.dateRangeStart,
      t.startDate,
      t.departureDate,
      t.dates?.start,
      t.checkIn
    )
  );
  const end =
    toDate(
      pick(t.dateRangeEnd, t.endDate, t.returnDate, t.dates?.end, t.checkOut)
    ) || start;
  const id = String(t._id || t.id);
  return {
    id: `s-${id}`,
    rawId: id,
    kind: "sync",
    type: "group",
    title: pick(
      t.name,
      t.title,
      destination && `Trip to ${destination}`,
      "Group trip"
    ),
    subtitle: [
      destination && t.name ? destination : null,
      memberCount ? `${memberCount} travelers` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    start,
    end,
    status: String(pick(t.status, "active")).toLowerCase(),
  };
}

// ── Styles (single drop-in file; matches the Upcoming trips list) ──
const TJ_CSS = `
.tj-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 12px; margin-bottom:12px; }
.tj-tabs { display:flex; gap:4px; width:100%; padding:3px; border-radius:999px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); overflow-x:auto; scrollbar-width:none; }
.tj-tabs::-webkit-scrollbar { display:none; }
.tj-tab--cancel { color:#ff9db0 !important; }
.tj-tab--cancel[aria-selected="true"] { color:#fff !important; background:linear-gradient(135deg,#e5484d,#ff6b85) !important; }
.tj-tab { all:unset; cursor:pointer; padding:6px 14px; border-radius:999px; font-size:13px; font-weight:700; color:rgba(255,255,255,0.65); white-space:nowrap; }
.tj-tab { flex:1 0 auto; text-align:center; display:inline-flex !important; align-items:center; justify-content:center; gap:4px; }
.tj-tab[aria-selected="true"] { color:#1a0e06; background:linear-gradient(135deg,#ff8a2a,#ffb347); }
.tj-tab:focus-visible { outline:2px solid #ffb347; outline-offset:2px; }
.tj-tab b { font-weight:800; opacity:.75; margin-left:4px; }
.tj-action { flex-shrink:0; display:flex; align-items:center; padding:0 12px; }
.tj-go { color:rgba(255,255,255,0.5); }
.tj-row.is-link:hover .tj-go { color:#ffb347; }
.tj-help { margin:-4px 0 12px; font-size:13px; line-height:1.5; color:rgba(255,255,255,0.68); }
.tj-note { margin-top:5px; font-size:12px; line-height:1.45; color:#ffc27a; }
.tj-foot { margin-top:12px; display:flex; justify-content:center; }
.tj-section + .tj-section { margin-top:16px; }
.tj-cancel { display:inline-flex; align-items:center; gap:4px; min-height:30px; padding:0 11px; border-radius:999px; border:1px solid rgba(255,107,133,.5); background:rgba(255,107,133,.08); color:#ff9db0; font:inherit; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; }
.tj-cancel:hover { border-color:rgba(255,107,133,.85); background:rgba(255,107,133,.18); color:#fff; }
.tj-cancel:focus-visible { outline:2px solid #ff9db0; outline-offset:2px; }
.tj-pending { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; font-weight:700; color:#ffc27a; white-space:nowrap; }
.tj-all { all:unset; cursor:pointer; display:inline-flex; align-items:center; gap:2px; font-size:12.5px; font-weight:700; color:#ffb347; }
.tj-all:hover { color:#fff; }
.tj-label { font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.6); margin:0 0 8px; }
.tj-list { display:flex; flex-direction:column; gap:8px; }

.tj-row { all:unset; box-sizing:border-box; display:flex; align-items:stretch; width:100%; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); transition:border-color .18s, background .18s; }
.tj-row.is-link { cursor:pointer; }
.tj-row.is-link:hover { border-color:rgba(255,138,42,0.45); background:rgba(255,138,42,0.06); }
.tj-row:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }
.tj-row.is-stamped { background:rgba(255,138,42,0.06); border-color:rgba(255,138,42,0.3); }
.tj-row__main { flex:1; min-width:0; display:flex; align-items:center; gap:10px; padding:9px 12px; }
.tj-row__icon { flex-shrink:0; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#ffb347; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.28); }
.tj-row__icon.is-group { color:#c4b5fd; background:rgba(139,92,255,0.14); border-color:rgba(139,92,255,0.35); }
.tj-row__body { min-width:0; flex:1; }
.tj-row__name { color:#fff; font-size:13.5px; font-weight:700; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tj-row__meta { margin-top:3px; display:flex; flex-wrap:wrap; align-items:center; gap:3px 10px; font-size:12px; color:rgba(255,255,255,0.68); }
.tj-row__meta > span { display:inline-flex; align-items:center; gap:4px; }

.tj-tag { display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 8px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.72); white-space:nowrap; }
.tj-tag--stamped { color:#ffb347; border-color:rgba(255,138,42,0.45); background:rgba(255,138,42,0.1); }

.tj-cxl { border-color:rgba(255,194,122,0.28); background:rgba(255,179,71,0.05); }
.tj-cxl.is-stuck { border-color:rgba(255,107,133,0.4); background:rgba(255,107,133,0.06); }
.tj-cxl__status { margin-top:4px; display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; font-size:12px; color:#ffc27a; }
.tj-cxl.is-stuck .tj-cxl__status { color:#ff9db0; }
.tj-steps { display:flex; align-items:center; gap:4px; }
.tj-step { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:rgba(255,255,255,0.45); white-space:nowrap; }
.tj-step i { width:14px; height:14px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; border:1.5px solid rgba(255,255,255,0.3); }
.tj-step.is-done { color:#6ee7a8; }
.tj-step.is-done i { border-color:#6ee7a8; background:rgba(110,231,168,0.15); color:#6ee7a8; }
.tj-step.is-now { color:#ffc27a; }
.tj-step.is-now i { border-color:#ffc27a; }
.tj-step.is-now i::after { content:""; width:6px; height:6px; border-radius:50%; background:#ffc27a; animation:tjPulse 1.4s ease-in-out infinite; }
.tj-stepline { width:14px; height:1.5px; background:rgba(255,255,255,0.2); }
@keyframes tjPulse { 50% { opacity:.3; } }
@media (prefers-reduced-motion: reduce) { .tj-step.is-now i::after { animation:none; } }
.tj-track { display:inline-flex; align-items:center; gap:2px; min-height:30px; padding:0 11px; border-radius:999px; border:1px solid rgba(255,194,122,.5); background:rgba(255,179,71,.1); color:#ffc27a; font:inherit; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; }
.tj-track:hover { border-color:#ffb347; color:#fff; }
.tj-track:focus-visible { outline:2px solid #ffb347; outline-offset:2px; }
/* Phones: dots only, except the step it's on now */
@media (max-width: 420px) { .tj-steps .tj-step:not(.is-now) > span { display:none; } .tj-stepline { width:8px; } }

.tj-more { all:unset; box-sizing:border-box; margin-top:8px; width:100%; min-height:38px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:10px; border:1px dashed rgba(255,255,255,0.18); color:rgba(255,255,255,0.8); font-size:13px; font-weight:700; cursor:pointer; }
.tj-more:hover { border-color:rgba(255,138,42,0.5); color:#ffb347; }
.tj-more:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }

/* Narrow phones: the Group / Upcoming tags move under the trip name
   instead of squeezing it into a thin column. */
/* Phones: the 4 tabs sit in a 2 x 2 grid so all of them, including
   Cancel a trip, are visible without sideways scrolling. */
@media (max-width: 520px) {
  .tj-tabs { display:grid; grid-template-columns:1fr 1fr; border-radius:14px; overflow:visible; }
  .tj-tab { border-radius:10px !important; padding:8px 6px !important; }
}
@media (max-width: 420px) {
  .tj-tab { padding:6px 11px; font-size:12.5px; }
  /* Keep the action on the right; the name may wrap to 2 lines. */
  .tj-row__name { white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .tj-action { padding:0 10px 0 4px; }
  .tj-cancel { padding:0 9px; }
}
@media (max-width: 600px) {
    .tj-row__main { padding:8px 10px; gap:9px; }
  .tj-row__icon { width:26px; height:26px; }
  .tj-row__name { font-size:13px; }
  .tj-row__meta { font-size:11.5px; }
  }
`;

function Chevron({ flip }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={flip ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const isStayType = (t) => t.includes("hotel") || t.includes("stay");
const isActivityType = (t) => t.includes("excursion") || t.includes("activity");

function TypeIcon({ type }) {
  const props = { size: 15 };
  if (type === "group") return <Users {...props} />;
  if (isStayType(type)) return <BedDouble {...props} />;
  if (isActivityType(type)) return <Compass {...props} />;
  return <Plane {...props} />;
}

// One trip: icon, name, a short details line, and one action on the right.
function JourneyRow({ j, onOpen, onCancel }) {
  const completed = j.stage === "completed";
  const dates =
    j.start &&
    `${fmt(j.start)}${j.end && j.end > j.start ? ` → ${fmt(j.end)}` : ""}`;
  const meta = [j.kind === "sync" ? "Group trip" : null, j.subtitle, dates]
    .filter(Boolean)
    .join(" · ");
  const canCancel =
    onCancel &&
    !completed &&
    j.kind !== "sync" &&
    j.status === "confirmed" &&
    !j.booking?.sharedRoom;
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button", onClick: onOpen } : {})}
      className={`tj-row${onOpen ? " is-link" : ""}${
        completed ? " is-stamped" : ""
      }`}
    >
      <div className="tj-row__main">
        <span className={`tj-row__icon${j.kind === "sync" ? " is-group" : ""}`}>
          <TypeIcon type={j.type} />
        </span>
        <div className="tj-row__body">
          <div className="tj-row__name" title={j.title}>
            {j.title}
          </div>
          {meta && <div className="tj-row__meta">{meta}</div>}
          {j.status === "cancel_pending" && !completed && (
            <div className="tj-note">
              Cancellation sent. The {isStayType(j.type) ? "hotel" : "airline"}{" "}
              is confirming it, usually within a few hours to a couple of days.
              We&apos;ll notify you when it&apos;s done.
            </div>
          )}
        </div>
      </div>
      <div className="tj-action">
        {completed ? (
          <span className="tj-tag tj-tag--stamped">Stamped</span>
        ) : j.status === "cancel_pending" ? (
          <span className="tj-pending">
            <Clock size={12} aria-hidden="true" /> Cancelling
          </span>
        ) : canCancel ? (
          <button
            type="button"
            className="tj-cancel"
            onClick={() => onCancel(j)}
            aria-label={`Cancel ${j.title}`}
          >
            <X size={13} aria-hidden="true" /> Cancel
          </button>
        ) : onOpen ? (
          <ChevronRight className="tj-go" size={18} aria-hidden="true" />
        ) : null}
      </div>
    </Tag>
  );
}

// A trip being cancelled: one short status line, a 3-step tracker and a
// Track link to the full details in My trips. Replaces the long
// paragraph that repeated on every row.
function CancellingRow({ j, onTrack }) {
  const place = isStayType(j.type) ? "hotel" : "airline";
  const hours = j.cancelSentAt
    ? (Date.now() - j.cancelSentAt.getTime()) / 3600000
    : 0;
  const stuck = hours >= STUCK_HOURS;
  const dates =
    j.start &&
    `${fmt(j.start)}${j.end && j.end > j.start ? ` → ${fmt(j.end)}` : ""}`;
  return (
    <div className={`tj-row tj-cxl${stuck ? " is-stuck" : ""}`}>
      <div className="tj-row__main">
        <span className="tj-row__icon">
          <TypeIcon type={j.type} />
        </span>
        <div className="tj-row__body">
          <div className="tj-row__name" title={j.title}>
            {j.title}
          </div>
          <div className="tj-row__meta">
            {[j.subtitle, dates].filter(Boolean).join(" · ")}
          </div>
          <div className="tj-cxl__status">
            <span
              className="tj-steps"
              aria-label={`Cancellation sent. Waiting for the ${place}.`}
            >
              <span className="tj-step is-done">
                <i>
                  <Check size={9} strokeWidth={3} aria-hidden="true" />
                </i>
                <span>Sent</span>
              </span>
              <span className="tj-stepline" aria-hidden="true" />
              <span className="tj-step is-now">
                <i />
                <span>{place === "hotel" ? "Hotel" : "Airline"} confirms</span>
              </span>
              <span className="tj-stepline" aria-hidden="true" />
              <span className="tj-step">
                <i />
                <span>Refund</span>
              </span>
            </span>
            <span>
              {stuck ? (
                <>
                  <AlertTriangle
                    size={12}
                    aria-hidden="true"
                    style={{ verticalAlign: -2 }}
                  />{" "}
                  Taking longer than usual. We&apos;re checking with the {place}
                  .
                </>
              ) : (
                sentAgo(j.cancelSentAt)
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="tj-action">
        <button
          type="button"
          className="tj-track"
          onClick={onTrack}
          aria-label={`Track the cancellation of ${j.title}`}
        >
          Track <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ── Main ──
export default function TravelJourneys({ token }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [syncTrips, setSyncTrips] = useState([]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const opts = { token, signal: controller.signal };
        const [b, s] = await Promise.all([
          fetchFirstList(BOOKINGS_ENDPOINTS, {
            ...opts,
            label: "bookings",
            keys: ["bookings", "trips", "data", "items"],
          }),
          fetchFirstList(SYNC_ENDPOINTS, {
            ...opts,
            label: "sync trips",
            keys: ["trips", "syncTrips", "groups", "data", "items"],
          }),
        ]);
        // Only show the error state if BOTH sources failed
        if (!b && !s) throw new Error("no endpoint");
        setBookings(b || []);
        setSyncTrips(s || []);
      } catch (e) {
        if (e.name !== "AbortError") setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token]);

  const journeys = useMemo(() => {
    const now = new Date();
    const groups = syncTrips
      .map(normalizeSync)
      .filter((j) => !HIDDEN_STATUSES.includes(j.status));
    const groupIds = new Set(groups.map((g) => g.rawId));

    // A member's share of a group trip shows once, as the group stamp — not twice
    const solo = bookings
      .map(normalizeBooking)
      .filter((j) => !HIDDEN_STATUSES.includes(j.status))
      .filter((j) => !(j.groupRef && groupIds.has(j.groupRef)));

    return [...solo, ...groups]
      .map((j) => ({
        ...j,
        stage: j.end && j.end < now ? "completed" : "upcoming",
      }))
      .sort(
        (a, b) =>
          (a.start?.getTime() || Infinity) - (b.start?.getTime() || Infinity)
      );
  }, [bookings, syncTrips]);

  const upcomingAll = journeys.filter(
    (j) => j.stage === "upcoming" && j.kind !== "sync"
  );
  // Trips being cancelled get their own short section, so they don't
  // read like active bookings.
  const cancellingTrips = upcomingAll.filter(
    (j) => j.status === "cancel_pending"
  );
  const upcomingBookings = upcomingAll.filter(
    (j) => j.status !== "cancel_pending"
  );
  const groupTrips = journeys.filter(
    (j) => j.stage === "upcoming" && j.kind === "sync"
  );
  const completed = journeys.filter((j) => j.stage === "completed").reverse();
  // Bookings that can be cancelled (or are being cancelled) online.
  const cancellable = upcomingBookings.filter(
    (j) => !j.booking?.sharedRoom && j.status === "confirmed"
  );
  const TABS = [
    {
      key: "bookings",
      label: "Bookings",
      items: upcomingBookings,
      help: "Your upcoming flights and hotels.",
      empty: cancellingTrips.length
        ? "No other upcoming trips."
        : "No upcoming flights or hotels yet.",
    },
    {
      key: "group",
      label: "Group trips",
      items: groupTrips,
      help: "Trips you're planning with friends. Tap one to open it.",
      empty: "No group trips yet. Start one from Sync Together.",
    },
    {
      key: "past",
      label: "Past trips",
      items: completed,
      help: "Trips you've already taken. Each one earns a stamp on your passport.",
      empty: "No past trips yet. After each trip, it shows here.",
    },
    {
      key: "cancel",
      label: "Cancel a trip",
      items: cancellable,
      help: "Pick a booking to cancel. You'll see your refund estimate before anything is cancelled.",
      empty: "Nothing to cancel right now.",
    },
  ];
  const [tab, setTab] = useState(null);
  const firstWithItems = TABS.find(
    (t) =>
      t.key !== "cancel" &&
      (t.items.length || (t.key === "bookings" && cancellingTrips.length))
  );
  const activeTab = tab || firstWithItems?.key || "bookings";
  const current = TABS.find((t) => t.key === activeTab) || TABS[0];
  const list = current.items;
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 4;
  const visible = showAll ? list : list.slice(0, PREVIEW);
  // Trips being cancelled show above the list on Bookings and Cancel a trip.
  const showCancelling =
    cancellingTrips.length > 0 &&
    (activeTab === "bookings" || activeTab === "cancel");

  // Cancel right here (same modal as My trips). Once done, update the row.
  const [cancelling, setCancelling] = useState(null);
  const onCancelDone = (updated) => {
    if (!updated?._id) return;
    setBookings((list) =>
      list.map((b) =>
        String(b._id || b.id) === String(updated._id)
          ? { ...b, status: updated.status || b.status }
          : b
      )
    );
  };

  const openJourney = (j) =>
    j.kind === "sync" ? () => navigate(`/sync-together/${j.rawId}`) : undefined;

  const emptyBox = (text) => (
    <div className="pp-journeysEmpty">
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          opacity: 0.5,
          fontSize: 14,
        }}
      >
        {text}
      </div>
    </div>
  );

  return (
    <Card variant="borderless" className="pp-card pp-journeysCard">
      <style>{TJ_CSS}</style>
      <div className="pp-journeysHeader tj-head">
        <div className="pp-journeysTitle">Travel Journeys</div>
        {!loading && !error && journeys.length > 0 && (
          <div className="tj-tabs" role="tablist" aria-label="Travel Journeys">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className={`tj-tab${
                  t.key === "cancel" ? " tj-tab--cancel" : ""
                }`}
                aria-selected={activeTab === t.key}
                onClick={() => {
                  setTab(t.key);
                  setShowAll(false);
                }}
              >
                {t.key === "cancel" && <X size={13} aria-hidden="true" />}
                {t.label}
                {t.key !== "cancel" && <b>{t.items.length}</b>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && journeys.length > 0 && (
        <p className="tj-help">{current.help}</p>
      )}

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        emptyBox("Couldn't load your journeys right now.")
      ) : journeys.length === 0 ? (
        emptyBox("Your journeys will appear here after your first booking.")
      ) : list.length === 0 && !showCancelling ? (
        emptyBox(current.empty)
      ) : (
        <>
          {showCancelling && (
            <div className="tj-section">
              <div className="tj-label">
                Cancelling · {cancellingTrips.length}
              </div>
              <div className="tj-list">
                {cancellingTrips.map((j) => (
                  <CancellingRow
                    key={j.id}
                    j={j}
                    onTrack={() =>
                      navigate(`/saved-trips?booking=${j.booking._id}`)
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {list.length > 0 && (
            <div className="tj-section">
              {showCancelling && activeTab === "bookings" && (
                <div className="tj-label">Upcoming · {list.length}</div>
              )}
              <div className="tj-list" role="tabpanel">
                {visible.map((j) => (
                  <JourneyRow
                    key={j.id}
                    j={j}
                    onOpen={openJourney(j)}
                    onCancel={
                      activeTab === "cancel"
                        ? (x) => setCancelling(x.booking)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {list.length === 0 && activeTab === "cancel" && (
            <p className="tj-help" style={{ marginTop: 12 }}>
              {current.empty}
            </p>
          )}
          {list.length > PREVIEW && (
            <button
              type="button"
              className="tj-more"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll ? "Show fewer" : `Show ${list.length - PREVIEW} more`}
              <Chevron flip={showAll} />
            </button>
          )}
          {(activeTab === "bookings" || activeTab === "cancel") && (
            <div className="tj-foot">
              <button
                type="button"
                className="tj-all"
                onClick={() => navigate("/saved-trips")}
              >
                All bookings in My Trips{" "}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
      {/* Rendered on <body> so the card's blur/transform can't trap the
          full-screen sheet inside the card. */}
      {cancelling &&
        createPortal(
          <>
            <style>{MT_CSS}</style>
            <CancelTripModal
              booking={cancelling}
              onClose={() => setCancelling(null)}
              onDone={onCancelDone}
            />
          </>,
          document.body
        )}
    </Card>
  );
}
