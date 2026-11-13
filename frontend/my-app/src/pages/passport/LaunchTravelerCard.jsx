import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import LaunchTravelerBadge, {
  LAUNCH_TRAVELER_NAME,
} from "@/components/LaunchTravelerBadge";

// Passport card for the Launch Traveler badge. Shows one of three states:
//   earned  → the badge
//   pending → "on its way", unlocks when the trip starts
//   window open, not booked yet → how to earn it
// Nothing shows outside the launch window if you don't have it.

const fmtDay = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        // The launch window is set in UTC on the server; show the same days.
        timeZone: "UTC",
      })
    : "";

// "Jan 15 – Apr 15, 2027" (year once when both dates share it).
const fmtRange = (a, b) => {
  if (!a || !b) return "";
  const sameYear =
    new Date(a).getUTCFullYear() === new Date(b).getUTCFullYear();
  const start = new Date(a).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
  return `${start} – ${fmtDay(b)}`;
};

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
          </div>
          <div style={{ ...sub, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            {data.earnedAt && `Earned ${fmtDay(data.earnedAt)}`}
          </div>
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
          <div style={sub}>
            {data.unlocksAt
              ? `Unlocks around ${fmtDay(data.unlocksAt)}.`
              : "Unlocks after your trip starts."}{" "}
            +{data.xp} XP.
          </div>
          <Steps done={1} />
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
          Book by {fmtDay(win.end)} and take the trip. +{data.xp} XP. Launch
          only.
        </div>
        <Steps done={0} />
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
            <li>Cancelled or refunded trips don't qualify.</li>
            <li>One per account.</li>
          </ul>
        )}
      </div>
    </div>
  );
}
