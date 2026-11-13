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
      <div style={box}>
        <LaunchTravelerBadge size={52} />
        <div>
          <div style={title}>{name}</div>
          <div style={sub}>
            You booked during Skyrio's launch and took the trip. Never offered
            again.
          </div>
          {data.earnedAt && (
            <div style={{ ...sub, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Earned {fmtDay(data.earnedAt)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (data.status === "pending") {
    return (
      <div style={box}>
        <LaunchTravelerBadge size={52} muted />
        <div>
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
            Unlocks with +{data.xp} XP when your trip starts
            {data.unlocksAt ? ` (about ${fmtDay(data.unlocksAt)})` : ""}.
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
          Book a trip by {fmtDay(win.end)} and take it. You get the badge and +
          {data.xp} XP. Never offered again.
        </div>
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          style={{
            marginTop: 8,
            padding: 0,
            background: "none",
            border: "none",
            color: "#ffb347",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showRules ? "Hide the rules" : "How it works"}
        </button>
        {showRules && (
          <ul style={{ ...sub, margin: "8px 0 0", paddingLeft: 18 }}>
            <li>
              Book between {fmtDay(win.start)} and {fmtDay(win.end)}.
            </li>
            <li>Trips of ${data.minSpend}+ paid on Skyrio count.</li>
            <li>It unlocks when your trip starts.</li>
            <li>Cancelled, refunded or disputed trips don't count.</li>
            <li>One per traveler. Same bonus on every plan.</li>
          </ul>
        )}
      </div>
    </div>
  );
}
