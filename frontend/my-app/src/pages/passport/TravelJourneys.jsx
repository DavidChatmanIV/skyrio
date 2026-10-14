// Renders the "Travel Journeys" card on the Digital Passport.
// Combines the user's own bookings with their Sync Together group trips,
// hides cancelled ones, and splits them into Upcoming / Stamped.

import React, { useEffect, useMemo, useState } from "react";
import { Card, Skeleton } from "antd";
import { Plane, BedDouble, Compass, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

// 👉 Trim each list to the one route that works once you've confirmed it in the console.
const BOOKINGS_ENDPOINTS = [
  "/api/bookings/mine",
  "/api/bookings/my",
  "/api/bookings/me",
  "/api/bookings/user",
  "/api/bookings",
  "/api/trips/mine",
  "/api/trips",
  "/api/saved-trips",
];

const SYNC_ENDPOINTS = [
  "/api/sync-together/mine",
  "/api/sync-together/trips",
  "/api/sync-together",
  "/api/sync/trips",
  "/api/sync/mine",
  "/api/sync",
  "/api/groups/mine",
  "/api/group-trips",
];

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
const fmt = (d) =>
  d
    ? d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

// Tries each path in order; returns the first array found, or null.
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
    pick(b.departureDate, b.startDate, b.checkIn, flight.departureDate)
  );
  const end =
    toDate(pick(b.returnDate, b.endDate, b.checkOut, flight.returnDate)) ||
    start;
  return {
    id: `b-${b._id || b.id}`,
    kind: "booking",
    type: String(pick(b.type, b.kind, b.category, "flight")).toLowerCase(),
    title:
      origin && destination
        ? `${origin} → ${destination}`
        : destination || b.title || "Trip",
    subtitle: pick(b.airline, flight.airline, b.hotel?.name, b.providerName),
    groupRef: String(
      pick(
        b.syncTripId,
        b.syncId,
        b.groupId,
        b.groupTripId,
        b.syncTrip?._id,
        ""
      )
    ),
    start,
    end,
    status: String(pick(b.status, "confirmed")).toLowerCase(),
  };
}

function normalizeSync(t) {
  const members = pick(t.members, t.participants, t.travelers, []);
  const memberCount = Array.isArray(members)
    ? members.length
    : Number(t.memberCount || 0);
  const destination = pick(
    t.destination,
    t.destinationName,
    t.city,
    t.location
  );
  const start = toDate(
    pick(t.startDate, t.departureDate, t.dates?.start, t.checkIn)
  );
  const end =
    toDate(pick(t.endDate, t.returnDate, t.dates?.end, t.checkOut)) || start;
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

// ── UI pieces ──
function TypeIcon({ type }) {
  const props = { size: 18, color: "#ff8a2a" };
  if (type === "group") return <Users {...props} />;
  if (type.includes("hotel") || type.includes("stay"))
    return <BedDouble {...props} />;
  if (type.includes("excursion") || type.includes("activity"))
    return <Compass {...props} />;
  return <Plane {...props} />;
}

function Chip({ children, tone = "muted" }) {
  const tones = {
    orange: { color: "#ff8a2a", border: "1px solid rgba(255,138,42,0.4)" },
    purple: { color: "#b9a2ff", border: "1px solid rgba(139,92,255,0.45)" },
    muted: {
      color: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(255,255,255,0.15)",
    },
  };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: 999,
        flexShrink: 0,
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}

function JourneyStamp({ j, onOpen }) {
  const completed = j.stage === "completed";
  const isGroup = j.kind === "sync";
  return (
    <div
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        cursor: onOpen ? "pointer" : "default",
        background: completed
          ? "rgba(255,138,42,0.08)"
          : "rgba(255,255,255,0.03)",
        border: completed
          ? "1px solid rgba(255,138,42,0.35)"
          : isGroup
          ? "1px dashed rgba(139,92,255,0.4)"
          : "1px dashed rgba(255,255,255,0.15)",
        opacity: completed ? 1 : 0.9,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isGroup
            ? "rgba(139,92,255,0.14)"
            : "rgba(255,138,42,0.12)",
          border: isGroup
            ? "1px solid rgba(139,92,255,0.3)"
            : "1px solid rgba(255,138,42,0.22)",
        }}
      >
        <TypeIcon type={j.type} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          {j.title}
        </div>
        <div
          style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}
        >
          {[
            j.subtitle,
            j.start &&
              `${fmt(j.start)}${
                j.end && j.end > j.start ? ` → ${fmt(j.end)}` : ""
              }`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {isGroup && <Chip tone="purple">Sync Together</Chip>}
        <Chip tone={completed ? "orange" : "muted"}>
          {completed ? "Stamped" : "Upcoming"}
        </Chip>
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

  const upcoming = journeys.filter((j) => j.stage === "upcoming");
  const completed = journeys.filter((j) => j.stage === "completed").reverse();

  // 👉 Adjust if your Sync Together detail route differs
  const openJourney = (j) =>
    j.kind === "sync" ? () => navigate(`/sync-together/${j.rawId}`) : undefined;

  const sectionLabel = (text) => (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.35)",
        margin: "4px 0 10px",
      }}
    >
      {text}
    </div>
  );

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
      <div className="pp-journeysHeader">
        <div className="pp-journeysTitle">Travel Journeys</div>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        emptyBox("Couldn't load your journeys right now.")
      ) : journeys.length === 0 ? (
        emptyBox("Your journeys will appear here after your first booking")
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {upcoming.length > 0 && (
            <div>
              {sectionLabel(`Upcoming · ${upcoming.length}`)}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {upcoming.map((j) => (
                  <JourneyStamp key={j.id} j={j} onOpen={openJourney(j)} />
                ))}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              {sectionLabel(`Stamped · ${completed.length}`)}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {completed.map((j) => (
                  <JourneyStamp key={j.id} j={j} onOpen={openJourney(j)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
