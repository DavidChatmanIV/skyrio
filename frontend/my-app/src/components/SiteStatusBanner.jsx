import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useSiteStatus from "@/lib/useSiteStatus";

// Site-wide travel alert, posted from Admin → Travel alerts. Shows on every
// page under the navbar. Info and warning alerts can be hidden for the rest
// of the visit; critical ones stay.

const DISMISS_KEY = "sk_alert_dismissed";

const TONE = {
  info: {
    bg: "linear-gradient(90deg, rgba(139,92,255,0.22), rgba(86,48,130,0.30))",
    border: "rgba(167,139,250,0.45)",
    icon: "#c4b5fd",
  },
  warning: {
    bg: "linear-gradient(90deg, rgba(255,138,42,0.20), rgba(139,92,255,0.20))",
    border: "rgba(255,179,71,0.55)",
    icon: "#ffb347",
  },
  critical: {
    bg: "linear-gradient(90deg, rgba(248,113,113,0.24), rgba(139,92,255,0.18))",
    border: "rgba(248,113,113,0.6)",
    icon: "#fca5a5",
  },
};

function AlertIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "0 0 auto", marginTop: 1 }}>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5z" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill={color} />
    </svg>
  );
}

// `preview` (admin): show this alert instead of the live one, no hide button.
export default function SiteStatusBanner({ preview = null }) {
  const live = useSiteStatus();
  const status = preview || live;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) || "";
    } catch {
      return "";
    }
  });

  // A new or edited alert shows again.
  const key = status?.active ? `${status.id}:${status.updatedAt}` : "";
  useEffect(() => {
    if (key && dismissed && dismissed !== key) setDismissed("");
  }, [key, dismissed]);

  if (!status?.active) return null;
  const critical = status.severity === "critical";
  if (!preview && !critical && dismissed === key) return null;
  const tone = TONE[status.severity] || TONE.warning;
  const paused = Object.entries(status.paused || {})
    .filter(([, v]) => v)
    .map(([k]) => ({ flights: "flight", hotels: "stay", cars: "car rental" }[k]));

  const hide = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, key);
    } catch {
      /* private mode: hide for this page view only */
    }
    setDismissed(key);
  };

  return (
    <div
      role={critical ? "alert" : "status"}
      aria-live="polite"
      style={{
        position: "relative",
        zIndex: 5,
        margin: preview ? 0 : "10px auto 0",
        width: preview ? "100%" : "min(1120px, calc(100% - 32px))",
        boxSizing: "border-box",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        color: "#fff",
      }}
    >
      <AlertIcon color={tone.icon} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
          {status.title}
          {status.areas ? (
            <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.7)" }}> · {status.areas}</span>
          ) : null}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
          {status.message}
          {paused.length > 0 && (
            <> New {paused.join(" and ")} bookings are paused for now.</>
          )}{" "}
          <Link
            to={status.helpPath || "/travel-disruptions"}
            onClick={preview ? (e) => e.preventDefault() : undefined}
            style={{ color: "#ffb347", fontWeight: 700, whiteSpace: "nowrap" }}
          >
            What to do
          </Link>
        </div>
      </div>
      {!critical && !preview && (
        <button
          type="button"
          onClick={hide}
          aria-label="Hide this alert"
          style={{
            flex: "0 0 auto",
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
