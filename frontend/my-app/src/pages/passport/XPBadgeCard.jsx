import React, { useEffect, useState } from "react";
import { Card, Progress, Typography } from "antd";
import SkyrioBadgeIcon from "../../components/dashboard/SkyrioBadgeIcon";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";

const { Text } = Typography;

const CARD_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

// Maps the real 8-tier ladder (backend/config/xpRules.js: Explorer,
// Adventurer, Voyager, Navigator, Trailblazer, Globetrotter, Elite, Legend)
// down to whichever icon `type` values SkyrioBadgeIcon is already known to
// support. This component previously only ever passed "sparkle" | "globe" |
// "firstFlight" | "explorer" | "pin" (via its own disconnected 6-tier
// badgeTitles list), so those five are the only ones confirmed safe here —
// I don't have SkyrioBadgeIcon's source, so I can't confirm it supports
// anything beyond what was already in use. "Globetrotter" gets an exact
// name match; everything else below is an approximation since there's no
// real correspondence between the two naming schemes. Share
// SkyrioBadgeIcon.jsx if you want this made more precise.
function iconForTier(tierName) {
  switch (tierName) {
    case "Explorer":
      return "explorer";
    case "Adventurer":
      return "pin";
    case "Voyager":
      return "pin";
    case "Navigator":
      return "firstFlight";
    case "Trailblazer":
      return "firstFlight";
    case "Globetrotter":
      return "globe";
    case "Elite":
      return "sparkle";
    case "Legend":
      return "sparkle";
    default:
      return "explorer";
  }
}

export default function XPBadgeCard() {
  const { token, isAuthed } = useAuth();

  const [loading, setLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [tierName, setTierName] = useState("Explorer");
  const [nextTierName, setNextTierName] = useState(null);
  const [progressPct, setProgressPct] = useState(0);
  const [xpToNext, setXpToNext] = useState(0);

  // Same self-fetch pattern as SkyHubPassportCard.jsx — real data from
  // /api/xp/me instead of local-only state that resets to 0 on every
  // refresh and has no connection to the actual account.
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
        setXpToNext(
          data?.nextTier ? Math.max(0, data.nextTier.min - realXp) : 0
        );
      } catch {
        // Keep defaults rather than show a broken state for one failed
        // fetch — next mount/refresh will try again.
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  return (
    <Card
      title={
        <span style={{ color: "#fff", fontWeight: 700 }}>
          🏆 XP & Badge Progress
        </span>
      }
      variant="borderless"
      className="xp-badge-card"
      style={CARD_STYLE}
      loading={loading}
    >
      <Text strong style={{ color: "#fff", fontSize: 15 }}>
        {xp.toLocaleString()} XP — {tierName}
      </Text>

      <div
        className="xp-badge-iconWrap"
        style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}
      >
        <SkyrioBadgeIcon type={iconForTier(tierName)} size={74} />
      </div>

      {nextTierName ? (
        <>
          <Progress
            percent={progressPct}
            showInfo={false}
            strokeColor={{ "0%": "#ff8a2a", "100%": "#ffb347" }}
            trailColor="rgba(255,255,255,0.1)"
            className="xp-badge-progress"
          />
          <Text
            className="xp-badge-sub"
            style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}
          >
            {xpToNext.toLocaleString()} XP to {nextTierName}
          </Text>
        </>
      ) : (
        <Text
          className="xp-badge-sub"
          style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600 }}
        >
          {tierName} — you've reached the top rank!
        </Text>
      )}
    </Card>
  );
}
