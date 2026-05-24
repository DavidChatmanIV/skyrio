import React from "react";

// XP levels matching the Skyrio Passport page
const LEVELS = [
  { name: "Explorer", min: 0, next: 3000 },
  { name: "Voyager", min: 3000, next: 7500 },
  { name: "Navigator", min: 7500, next: 15000 },
  { name: "Pioneer", min: 15000, next: 30000 },
  { name: "Legend", min: 30000, next: null },
];

function getLevel(xp = 0) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

export default function SkyHubPassportCard({ currentUser }) {
  // Use data already in the AuthContext — no extra API call needed.
  // currentUser comes from AuthProvider which already called /api/profile/me.
  const xp = currentUser?.xp || currentUser?.passport || 0;
  const name = currentUser?.name || "Traveler";
  const badge = currentUser?.badge || getLevel(xp).name;
  const level = getLevel(xp);
  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.name === level.name) + 1];
  const pct = level.next
    ? Math.min(
        100,
        Math.round(((xp - level.min) / (level.next - level.min)) * 100)
      )
    : 100;
  const xpToNext = level.next ? level.next - xp : 0;

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(30,16,60,0.92) 0%, rgba(20,10,40,0.92) 100%)",
        border: "1px solid rgba(255,255,255,0.11)",
        borderRadius: 16,
        padding: "18px 16px",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          letterSpacing: "0.09em",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
        Your Digital Passport
      </div>

      {/* XP number */}
      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          letterSpacing: "-2px",
          marginBottom: 10,
          fontFamily: "'Sora', 'Outfit', sans-serif",
        }}
      >
        {xp.toLocaleString()}
      </div>

      {/* Level badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 99,
          marginBottom: 14,
          background: "rgba(139,92,246,0.18)",
          border: "1px solid rgba(139,92,246,0.32)",
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>
          XP · {level.name}
        </span>
      </div>

      {/* Progress bar */}
      {level.next ? (
        <>
          <div
            style={{
              height: 5,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 7,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 99,
                background: "linear-gradient(90deg, #ff7a35, #8b5cf6)",
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {xpToNext.toLocaleString()} XP to {nextLevel?.name} — keep sharing ✦
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>
          🏆 Legend — you've reached the top!
        </div>
      )}
    </div>
  );
}
