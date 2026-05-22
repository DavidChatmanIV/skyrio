import React, { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

const LEVELS = [
  { name: "Explorer", min: 0, next: 3000 },
  { name: "Voyager", min: 3000, next: 7500 },
  { name: "Navigator", min: 7500, next: 15000 },
  { name: "Pioneer", min: 15000, next: 30000 },
  { name: "Legend", min: 30000, next: null },
];

function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

export default function SkyHubPassportCard({ currentUser }) {
  const [passport, setPassport] = useState(null);

  useEffect(() => {
    // Fetch fresh passport data directly from the passport endpoint
    const load = async () => {
      try {
        const res = await fetch(apiUrl("/api/passport"), {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) setPassport(data);
      } catch {
        /* non-critical */
      }
    };
    load();
  }, []);

  // Prefer live passport data, fall back to currentUser prop
  const xp = passport?.xp ?? currentUser?.xp ?? 0;
  const badge = passport?.badge ?? currentUser?.badge ?? "Explorer";
  const level = getLevel(xp);
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
          "linear-gradient(135deg, rgba(30,16,60,0.9) 0%, rgba(20,10,40,0.9) 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 18,
        padding: "20px 18px",
        backdropFilter: "blur(16px)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        Your Digital Passport
      </div>

      <div
        style={{
          fontSize: 44,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          letterSpacing: "-2px",
          marginBottom: 10,
        }}
      >
        {xp.toLocaleString()}
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 99,
          background: "rgba(139,92,246,0.18)",
          border: "1px solid rgba(139,92,246,0.35)",
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>
          ✈️ XP · {level.name}
        </span>
      </div>

      {/* Progress bar */}
      {level.next && (
        <div>
          <div
            style={{
              height: 5,
              background: "rgba(255,255,255,0.1)",
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
                background: "linear-gradient(90deg,#ff7a35,#a855f7)",
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            {xpToNext.toLocaleString()} XP to{" "}
            {LEVELS[LEVELS.findIndex((l) => l.name === level.name) + 1]?.name} —
            keep sharing ✦
          </div>
        </div>
      )}
      {!level.next && (
        <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>
          🏆 Max level reached — you're a Legend!
        </div>
      )}
    </div>
  );
}
