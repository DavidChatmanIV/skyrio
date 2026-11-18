import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import LaunchTravelerBadge, {
  LAUNCH_TRAVELER_NAME,
} from "@/components/LaunchTravelerBadge";

// Passport card for the Launch Traveler badge. Shows one of three states:
//   earned  → the badge
//   pending → "on its way", unlocks when the trip starts
//   window open, not booked yet → how to earn it
// Nothing shows outside the launch window if you don't have it.

// Every date on this card uses one short format: 1/15/27. The launch
// window is set in UTC on the server, so show the same days.
const fmtDay = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
        timeZone: "UTC",
      })
    : "";

// Whole days from today until a date (0 = today), or null.
const daysUntil = (d) => {
  const t = Date.parse(d || "");
  if (!Number.isFinite(t)) return null;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return Math.max(0, Math.ceil((t - today) / 86400000));
};
const inDays = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

// "1/15/27 – 4/15/27"
const fmtRange = (a, b) => (a && b ? `${fmtDay(a)} – ${fmtDay(b)}` : "");

// Three steps, so it's clear the badge needs a trip taken, not just booked.
function Steps({ done }) {
  const steps = ["Book", "Travel", "Unlock"];
  return (
    <ol
      aria-label="Steps to earn the badge"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        listStyle: "none",
        padding: 0,
        margin: "12px 0 0",
        flexWrap: "wrap",
      }}
    >
      {steps.map((label, i) => {
        const isDone = i < done;
        const isNext = i === done;
        return (
          <li key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: isDone ? "#1a0e06" : isNext ? "#fff" : "rgba(255,255,255,0.6)",
                background: isDone
                  ? "linear-gradient(90deg, #ffb347, #ff8a2a)"
                  : isNext
                  ? "rgba(255,138,42,0.14)"
                  : "rgba(255,255,255,0.05)",
                border: isDone
                  ? "1px solid transparent"
                  : isNext
                  ? "1px solid rgba(255,138,42,0.55)"
                  : "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {isDone && (
                <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {label}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" style={{ width: 10, height: 1, background: "rgba(255,255,255,0.25)" }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const box = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  padding: "16px 18px",
  borderRadius: 18,
  background:
    "linear-gradient(160deg, rgba(255,138,42,0.10) 0%, rgba(139,92,255,0.12) 100%)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  color: "#fff",
  marginTop: 14,
};
const title = { fontWeight: 700, fontSize: 15, lineHeight: 1.25 };
const sub = { fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 4, lineHeight: 1.45 };
const pill = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.3,
  padding: "2px 8px",
  borderRadius: 999,
  marginLeft: 8,
  verticalAlign: "middle",
};

export default function LaunchTravelerCard({ token }) {
  const [data, setData] = useState(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    const ctrl = new AbortController();
    fetch(apiUrl("/api/xp/launch-traveler"), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setData(j))
      .catch(() => {});
    return () => ctrl.abort();
  }, [token]);

  if (!data) return null;
  const name = data.name || LAUNCH_TRAVELER_NAME;
  const win = data.window;

  if (data.status === "earned") {
    return (
      <div
        style={{
          ...box,
          border: "1px solid rgba(255,138,42,0.45)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 24px rgba(255,138,42,0.18)",
        }}
      >
        <LaunchTravelerBadge size={56} />
        <div>
          <div style={title}>{name}</div>
          <div style={sub}>
            Booked and traveled at Skyrio's launch.
            {data.trip ? ` ${data.trip}.` : ""}
          </div>
          <div style={{ ...sub, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            {[data.earnedAt && `Earned ${fmtDay(data.earnedAt)}`, `+${data.xp} XP added`]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <Steps done={3} />
        </div>
      </div>
    );
  }

  if (data.status === "pending") {
    return (
      <div style={box}>
        <LaunchTravelerBadge size={52} muted />
        <div style={{ minWidth: 0 }}>
          <div style={title}>
            {name}
            <span
              style={{
                ...pill,
                background: "rgba(255,179,71,0.16)",
                color: "#ffb347",
                border: "1px solid rgba(255,179,71,0.35)",
              }}
            >
              On its way
            </span>
          </div>
          {data.trip && <div style={{ ...sub, color: "#fff" }}>{data.trip}</div>}
          <div style={sub}>
            {data.unlocksAt
              ? `Unlocks ${inDays(daysUntil(data.unlocksAt))} (${fmtDay(data.unlocksAt)}), when your trip starts.`
              : "Unlocks when your trip starts."}{" "}
            +{data.xp} XP.
          </div>
          <Steps done={1} />
          <div style={{ ...sub, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            Cancelled or refunded trips don't count.
          </div>
        </div>
      </div>
    );
  }

  if (!win?.open) return null;

  return (
    <div style={box}>
      <LaunchTravelerBadge size={52} muted />
      <div style={{ minWidth: 0 }}>
        <div style={title}>Earn the {name} badge</div>
        <div style={sub}>
          Book by {fmtDay(win.end)} and take the trip to get the badge and +
          {data.xp} XP. Only during launch.
        </div>
        {daysUntil(win.end) != null && (
          <div style={{ ...sub, color: "#ffb347", fontWeight: 600 }}>
            {daysUntil(win.end) === 0
              ? "Last day to book."
              : `${daysUntil(win.end)} day${daysUntil(win.end) === 1 ? "" : "s"} left to book.`}
          </div>
        )}
        <Steps done={0} />
        <Link
          to="/booking?tab=Flights"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 40,
            marginTop: 12,
            padding: "0 18px",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 14,
            color: "#1a0e06",
            textDecoration: "none",
            background: "linear-gradient(90deg, #ff8a2a, #ffb347)",
          }}
        >
          Find a trip
        </Link>
        <br />
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          style={{
            marginTop: 10,
            padding: 0,
            background: "none",
            border: "none",
            color: "#ffb347",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showRules ? "Hide rules" : "Rules"}
        </button>
        {showRules && (
          <ul style={{ ...sub, margin: "8px 0 0", paddingLeft: 18 }}>
            <li>Book {fmtRange(win.start, win.end)}.</li>
            <li>Trips ${data.minSpend}+ paid on Skyrio.</li>
            <li>It unlocks when your trip starts.</li>
            <li>Cancelled, refunded or disputed trips don't count.</li>
            <li>One per traveler. Same bonus on every plan.</li>
          </ul>
        )}
      </div>
    </div>
  );
}
