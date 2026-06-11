import React, { useState } from "react";

// ── Tier config ───────────────────────────────────────────────
export const TIER_CONFIG = {
  orange: {
    color: "#ff8a2a",
    glow: "rgba(255,138,42,0.5)",
    label: "Verified Traveler",
    sub: "Reached 1,000 followers",
  },
  blue: {
    color: "#4da6ff",
    glow: "rgba(77,166,255,0.5)",
    label: "Notable Traveler",
    sub: "Reached 5,000 followers",
  },
  purple: {
    color: "#7c5cfc",
    glow: "rgba(124,92,252,0.5)",
    label: "Skyrio Founder",
    sub: "The one who built this",
  },
};

// ── Plane SVG ─────────────────────────────────────────────────
function PlaneSVG({ color, size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1l3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

/**
 * PlaneBadge
 * @param {string|null} tier   - "orange" | "blue" | "purple" | null
 * @param {number}      size   - icon px size (default 16)
 * @param {boolean}     noTip  - suppress tooltip
 */
export default function PlaneBadge({ tier, size = 16, noTip = false }) {
  const [hovered, setHovered] = useState(false);
  if (!tier || !TIER_CONFIG[tier]) return null;
  const { color, glow, label, sub } = TIER_CONFIG[tier];

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size + 8,
          height: size + 8,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          filter: hovered ? `drop-shadow(0 0 6px ${glow})` : "none",
          transition: "filter 0.2s ease",
          cursor: "default",
          flexShrink: 0,
        }}
      >
        <PlaneSVG color={color} size={size} />
      </span>

      {!noTip && hovered && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            background: "rgba(14,10,30,0.97)",
            border: `1px solid ${color}40`,
            borderRadius: 10,
            padding: "8px 12px",
            zIndex: 99999,
            pointerEvents: "none",
            boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}20`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color,
              lineHeight: 1.3,
              fontFamily: "inherit",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
              fontFamily: "inherit",
            }}
          >
            {sub}
          </div>
          <span
            style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 8,
              height: 8,
              background: "rgba(14,10,30,0.97)",
              border: `1px solid ${color}40`,
              borderTop: "none",
              borderLeft: "none",
            }}
          />
        </span>
      )}
    </span>
  );
}

// ── Pending badge shown to the owner while awaiting review ────
export function PlaneBadgePending({ size = 14 }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size + 8,
          height: size + 8,
          borderRadius: "50%",
          cursor: "default",
          opacity: 0.5,
        }}
      >
        <PlaneSVG color="#ff8a2a" size={size} />
      </span>
      {hovered && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            background: "rgba(14,10,30,0.97)",
            border: "1px solid rgba(255,138,42,0.25)",
            borderRadius: 10,
            padding: "8px 12px",
            zIndex: 99999,
            pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#ff8a2a",
              fontFamily: "inherit",
            }}
          >
            Verification under review
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
              fontFamily: "inherit",
            }}
          >
            You hit the follower threshold — we'll confirm shortly
          </div>
          <span
            style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 8,
              height: 8,
              background: "rgba(14,10,30,0.97)",
              border: "1px solid rgba(255,138,42,0.25)",
              borderTop: "none",
              borderLeft: "none",
            }}
          />
        </span>
      )}
    </span>
  );
}
