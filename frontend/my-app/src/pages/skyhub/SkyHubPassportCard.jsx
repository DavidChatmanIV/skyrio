import React, { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";

/**
 * SkyHubPassportCard
 *
 * Used to compute its own local 5-tier ladder (Explorer/Voyager@3000/
 * Navigator@7500/Pioneer@15000/Legend@30000) — completely disconnected from
 * the real 8-tier system in backend/config/xpRules.js (Explorer/Adventurer@
 * 100/Voyager@300/Navigator@600/Trailblazer@1000/Globetrotter@1500/Elite@
 * 2500/Legend@4000). Voyager alone was off by 10x between the two. A user
 * at real-world "Globetrotter" (1500 XP) would have seen "Explorer" here.
 *
 * Fix: this now fetches the real tier from GET /api/xp/me (same backend
 * helper Passport already trusts) instead of carrying a fourth copy of the
 * ladder in the frontend — a frontend component can't import the backend's
 * config file directly anyway, so duplicating the thresholds by hand was
 * always going to drift out of sync again the next time the ladder changes.
 */
export default function SkyHubPassportCard({ currentUser }) {
  const { token, isAuthed } = useAuth();

  const [loading, setLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [tierName, setTierName] = useState("Explorer");
  const [nextTierName, setNextTierName] = useState(null);
  const [progressPct, setProgressPct] = useState(0);
  const [xpToNext, setXpToNext] = useState(0);

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/xp/me"), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("xp fetch failed");
        const data = await res.json();
        if (!mounted) return;

        const realXp = Number(data?.xp ?? 0);
        setXp(realXp);
        setTierName(String(data?.tier?.name ?? "Explorer"));
        setNextTierName(data?.nextTier?.name ?? null);
        setProgressPct(Number(data?.progress ?? 0));
        // GET /api/xp/me doesn't return xpToNext directly, but nextTier.min
        // is the same minXp getLevel() itself uses, so this matches exactly
        // what xpRules.js's own getLevel() would compute for xpToNext.
        setXpToNext(
          data?.nextTier ? Math.max(0, data.nextTier.min - realXp) : 0
        );
      } catch {
        if (!mounted) return;
        // Fetch failed — fall back to whatever currentUser already has
        // rather than showing nothing, even though we can't compute a real
        // tier client-side without the backend.
        setXp(Number(currentUser?.xp || currentUser?.passport || 0));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  // Show skeleton while we don't have a user yet, or while the real tier
  // fetch is still in flight — avoids a flash of "Explorer · 0%" before the
  // real numbers land.
  if (!currentUser || loading)
    return (
      <div
        style={{
          background: "rgba(20,12,42,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "18px 16px",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            height: 12,
            width: "60%",
            borderRadius: 6,
            background: "rgba(255,255,255,0.06)",
            marginBottom: 16,
          }}
        />
        <div
          style={{
            height: 40,
            width: "40%",
            borderRadius: 8,
            background: "rgba(255,255,255,0.06)",
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 5,
            borderRadius: 99,
            background: "rgba(255,255,255,0.06)",
          }}
        />
      </div>
    );

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg,rgba(30,16,60,0.92),rgba(20,10,40,0.92))",
        border: "1px solid rgba(255,255,255,0.11)",
        borderRadius: 16,
        padding: "18px 16px",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Header */}
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

      {/* XP */}
      <div
        style={{
          fontSize: 44,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          letterSpacing: "-2px",
          marginBottom: 10,
          fontFamily: "'Sora','Outfit',sans-serif",
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
          XP · {tierName}
        </span>
      </div>

      {/* Progress bar */}
      {nextTierName ? (
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
                width: `${progressPct}%`,
                borderRadius: 99,
                background: "linear-gradient(90deg,#ff7a35,#8b5cf6)",
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {xpToNext.toLocaleString()} XP to {nextTierName} — keep sharing
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "#fbbf24",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="8 21 12 17 16 21" />
            <path d="M5 3H19" />
            <path d="M5 3C5 3 4 13 12 13C20 13 19 3 19 3" />
            <line x1="12" y1="13" x2="12" y2="17" />
          </svg>
          {tierName} — you've reached the top!
        </div>
      )}
    </div>
  );
}
