// src/pages/passport/TravelJourneys.jsx
// Renders the "Travel Journeys" card on the Digital Passport.
// Loads the user's bookings from the SAME endpoint the Saved Trips page uses,
// hides cancelled ones, and splits them into Upcoming / Completed stamps.

import React, { useEffect, useMemo, useState } from "react";
import { Card, Skeleton } from "antd";
import { Plane, BedDouble, Compass } from "lucide-react";
import { apiUrl } from "@/lib/api";

// 👉 Set this to whatever endpoint SavedTripsPage.jsx fetches.
const BOOKINGS_ENDPOINT = "/api/bookings/mine";

// ── Defensive field readers (works with a few common Booking shapes) ──
const pick = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== "");

function normalize(b) {
  const flight = b.flight || b.details || {};
  const type = String(pick(b.type, b.kind, b.category, "flight")).toLowerCase();
  const origin = pick(b.origin, b.from, flight.origin, flight.from);
  const destination = pick(
    b.destination,
    b.to,
    flight.destination,
    flight.to,
    b.hotel?.city,
    b.city
  );
  const start = pick(
    b.departureDate,
    b.startDate,
    b.checkIn,
    flight.departureDate
  );
  const end = pick(
    b.returnDate,
    b.endDate,
    b.checkOut,
    flight.returnDate,
    start
  );
  const status = String(pick(b.status, "confirmed")).toLowerCase();

  return {
    id: String(b._id || b.id),
    type,
    title:
      origin && destination
        ? `${origin} → ${destination}`
        : destination || b.title || "Trip",
    provider: pick(b.airline, flight.airline, b.hotel?.name, b.providerName),
    start: start ? new Date(start) : null,
    end: end ? new Date(end) : null,
    status,
  };
}

const fmt = (d) =>
  d
    ? d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

function TypeIcon({ type }) {
  const props = { size: 18, color: "#ff8a2a" };
  if (type.includes("hotel") || type.includes("stay"))
    return <BedDouble {...props} />;
  if (type.includes("excursion") || type.includes("activity"))
    return <Compass {...props} />;
  return <Plane {...props} />;
}

function JourneyStamp({ j }) {
  const completed = j.stage === "completed";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: completed
          ? "rgba(255,138,42,0.08)"
          : "rgba(255,255,255,0.03)",
        border: completed
          ? "1px solid rgba(255,138,42,0.35)"
          : "1px dashed rgba(255,255,255,0.15)",
        opacity: completed ? 1 : 0.85,
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
          background: "rgba(255,138,42,0.12)",
          border: "1px solid rgba(255,138,42,0.22)",
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
            j.provider,
            j.start &&
              `${fmt(j.start)}${
                j.end && j.end > j.start ? ` → ${fmt(j.end)}` : ""
              }`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: 999,
          flexShrink: 0,
          color: completed ? "#ff8a2a" : "rgba(255,255,255,0.55)",
          border: completed
            ? "1px solid rgba(255,138,42,0.4)"
            : "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {completed ? "Stamped" : "Upcoming"}
      </span>
    </div>
  );
}

export default function TravelJourneys({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(apiUrl(BOOKINGS_ENDPOINT), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Accept { bookings: [] }, { trips: [] }, { data: [] } or a bare array
        const list = Array.isArray(data)
          ? data
          : data?.bookings || data?.trips || data?.data || [];
        setBookings(list);
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
    return bookings
      .map(normalize)
      .filter(
        (j) =>
          !["cancelled", "canceled", "refunded", "failed", "pending"].includes(
            j.status
          )
      )
      .map((j) => ({
        ...j,
        stage: j.end && j.end < now ? "completed" : "upcoming",
      }))
      .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));
  }, [bookings]);

  const upcoming = journeys.filter((j) => j.stage === "upcoming");
  const completed = journeys.filter((j) => j.stage === "completed").reverse();

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

  return (
    <Card variant="borderless" className="pp-card pp-journeysCard">
      <div className="pp-journeysHeader">
        <div className="pp-journeysTitle">Travel Journeys</div>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        <div className="pp-journeysEmpty">
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              opacity: 0.5,
              fontSize: 14,
            }}
          >
            Couldn't load your journeys right now.
          </div>
        </div>
      ) : journeys.length === 0 ? (
        <div className="pp-journeysEmpty">
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              opacity: 0.5,
              fontSize: 14,
            }}
          >
            Your journeys will appear here after your first booking
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {upcoming.length > 0 && (
            <div>
              {sectionLabel(`Upcoming · ${upcoming.length}`)}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {upcoming.map((j) => (
                  <JourneyStamp key={j.id} j={j} />
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
                  <JourneyStamp key={j.id} j={j} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
