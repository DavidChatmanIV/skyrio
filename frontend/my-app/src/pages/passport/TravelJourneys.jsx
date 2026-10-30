// Renders the "Travel Journeys" card on the Digital Passport.
// Combines the user's own bookings with their Sync Together group trips,
// hides cancelled ones, and splits them into Upcoming / Stamped.

import React, { useEffect, useMemo, useState } from "react";
import { Card, Skeleton } from "antd";
import { Plane, BedDouble, Compass, Users } from "lucide-react";
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
        b.groupId,
        ""
      )
    ),
    start,
    end,
    status: String(pick(b.status, "confirmed")).toLowerCase(),
  };
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
.tj-filter { position:relative; display:inline-flex; align-items:center; }
.tj-filter select { appearance:none; -webkit-appearance:none; height:34px; padding:0 32px 0 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff; font-family:"DM Sans",sans-serif; font-size:13px; font-weight:600; cursor:pointer; }
.tj-filter select:hover { border-color:rgba(255,138,42,0.5); }
.tj-filter select:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }
.tj-filter select option { background:#1a1233; color:#fff; }
.tj-filter svg { position:absolute; right:11px; pointer-events:none; color:rgba(255,255,255,0.7); }
.tj-section + .tj-section { margin-top:16px; }
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
.tj-row__stub { flex-shrink:0; display:flex; align-items:center; gap:6px; padding:8px 12px; border-left:2px dashed rgba(255,255,255,0.14); }

.tj-tag { display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 8px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.72); white-space:nowrap; }
.tj-tag--stamped { color:#ffb347; border-color:rgba(255,138,42,0.45); background:rgba(255,138,42,0.1); }
.tj-tag--group { color:#c4b5fd; border-color:rgba(139,92,255,0.45); background:rgba(139,92,255,0.12); }

.tj-more { all:unset; box-sizing:border-box; margin-top:8px; width:100%; min-height:38px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:10px; border:1px dashed rgba(255,255,255,0.18); color:rgba(255,255,255,0.8); font-size:13px; font-weight:700; cursor:pointer; }
.tj-more:hover { border-color:rgba(255,138,42,0.5); color:#ffb347; }
.tj-more:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }

@media (max-width: 600px) {
  .tj-filter select { height:32px; font-size:12.5px; }
  .tj-row__main { padding:8px 10px; gap:9px; }
  .tj-row__icon { width:26px; height:26px; }
  .tj-row__name { font-size:13px; }
  .tj-row__meta { font-size:11.5px; }
  .tj-row__stub { flex-direction:column; align-items:flex-end; justify-content:center; gap:4px; padding:8px 10px; }
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

const isGroupJourney = (j) => j.kind === "sync" || !!j.groupRef;
const isStayType = (t) => t.includes("hotel") || t.includes("stay");
const isActivityType = (t) => t.includes("excursion") || t.includes("activity");

function TypeIcon({ type }) {
  const props = { size: 15 };
  if (type === "group") return <Users {...props} />;
  if (isStayType(type)) return <BedDouble {...props} />;
  if (isActivityType(type)) return <Compass {...props} />;
  return <Plane {...props} />;
}

function JourneyStamp({ j, onOpen }) {
  const completed = j.stage === "completed";
  const group = isGroupJourney(j);
  const dates =
    j.start &&
    `${fmt(j.start)}${j.end && j.end > j.start ? ` → ${fmt(j.end)}` : ""}`;
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
          {(j.subtitle || dates) && (
            <div className="tj-row__meta">
              {j.subtitle && <span>{j.subtitle}</span>}
              {dates && <span>{dates}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="tj-row__stub">
        {group && <span className="tj-tag tj-tag--group">Group</span>}
        <span className={`tj-tag${completed ? " tj-tag--stamped" : ""}`}>
          {completed ? "Stamped" : "Upcoming"}
        </span>
      </div>
    </Tag>
  );
}

// One section (Upcoming / Stamped) that shows 3 and expands
function JourneySection({ label, items, openJourney }) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 3;
  if (!items.length) return null;
  const visible = showAll ? items : items.slice(0, PREVIEW);
  const hidden = items.length - visible.length;
  return (
    <div className="tj-section">
      <div className="tj-label">
        {label} · {items.length}
      </div>
      <div className="tj-list">
        {visible.map((j) => (
          <JourneyStamp key={j.id} j={j} onOpen={openJourney(j)} />
        ))}
      </div>
      {items.length > PREVIEW && (
        <button
          type="button"
          className="tj-more"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
        >
          {showAll ? "Show fewer" : `Show ${hidden} more`}
          <Chevron flip={showAll} />
        </button>
      )}
    </div>
  );
}

const FILTERS = [
  { value: "all", label: "All journeys", test: () => true },
  { value: "solo", label: "Solo", test: (j) => !isGroupJourney(j) },
  { value: "group", label: "Group trips", test: isGroupJourney },
  {
    value: "flights",
    label: "Flights",
    test: (j) =>
      j.kind === "booking" && !isStayType(j.type) && !isActivityType(j.type),
  },
  { value: "stays", label: "Hotels", test: (j) => isStayType(j.type) },
  {
    value: "activities",
    label: "Excursions",
    test: (j) => isActivityType(j.type),
  },
];

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

  // Filter options only list what you actually have, with counts
  const [filter, setFilter] = useState("all");
  const filterOptions = useMemo(
    () =>
      FILTERS.map((f) => ({
        ...f,
        count: journeys.filter(f.test).length,
      })).filter((f) => f.value === "all" || f.count > 0),
    [journeys]
  );
  const active =
    filterOptions.find((f) => f.value === filter) || filterOptions[0];
  const shown = active ? journeys.filter(active.test) : journeys;

  const upcoming = shown.filter((j) => j.stage === "upcoming");
  const completed = shown.filter((j) => j.stage === "completed").reverse();

  // NOTE: Adjust if your Sync Together detail route differs
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
          <label className="tj-filter">
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              Filter journeys
            </span>
            <select
              value={active?.value || "all"}
              onChange={(e) => setFilter(e.target.value)}
            >
              {filterOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label} ({f.count})
                </option>
              ))}
            </select>
            <Chevron />
          </label>
        )}
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        emptyBox("Couldn't load your journeys right now.")
      ) : journeys.length === 0 ? (
        emptyBox("Your journeys will appear here after your first booking")
      ) : (
        <div>
          <JourneySection
            key={`up-${active?.value}`}
            label="Upcoming"
            items={upcoming}
            openJourney={openJourney}
          />
          <JourneySection
            key={`done-${active?.value}`}
            label="Stamped"
            items={completed}
            openJourney={openJourney}
          />
        </div>
      )}
    </Card>
  );
}
