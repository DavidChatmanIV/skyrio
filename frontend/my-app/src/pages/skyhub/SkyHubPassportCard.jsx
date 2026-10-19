import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";
import { getTier, getNextTier, getTierProgress } from "@/config/xpConfig";
import TierIcon, { TierMedal } from "@/components/passport/TierIcon";

/**
 * SkyHubPassportCard
 *
 * Rank comes from LIFETIME XP (totalEarned), never the spendable balance —
 * same rule as the Passport page and Rewards page, so all three always agree.
 * Tier math uses config/xpConfig.js, which mirrors backend/config/xpRules.js.
 */
export default function SkyHubPassportCard({ currentUser }) {
  const { token, isAuthed } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [lifetime, setLifetime] = useState(0); // drives rank
  const [balance, setBalance] = useState(0); // spendable

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
        const spendable = Number(data?.xp ?? 0);
        setBalance(spendable);
        // Lifetime can never be lower than the balance (guards old accounts).
        setLifetime(
          Math.max(
            Number(data?.totalEarned ?? data?.xpTotalEarned ?? 0),
            spendable
          )
        );
      } catch {
        if (!mounted) return;
        const fallback = Number(currentUser?.xp || 0);
        setBalance(fallback);
        setLifetime(
          Math.max(Number(currentUser?.xpTotalEarned || 0), fallback)
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  if (!currentUser || loading)
    return (
      <div style={styles.shell}>
        <div
          style={{ ...styles.skel, height: 12, width: "60%", marginBottom: 16 }}
        />
        <div
          style={{ ...styles.skel, height: 40, width: "45%", marginBottom: 12 }}
        />
        <div style={{ ...styles.skel, height: 5 }} />
      </div>
    );

  const tier = getTier(lifetime);
  const next = getNextTier(lifetime);
  const pct = getTierProgress(lifetime);

  return (
    <div style={{ ...styles.shell, borderColor: `${tier.color}40` }}>
      {/* Header */}
      <div style={styles.eyebrow}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
        Your Digital Passport
      </div>

      {/* Rank */}
      <div style={styles.rankRow}>
        <TierMedal tier={tier} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...styles.rankName, color: "#fff" }}>{tier.name}</div>
          <div style={styles.sub}>
            <span style={{ color: "#fff", fontWeight: 700 }}>
              {lifetime.toLocaleString()}
            </span>{" "}
            lifetime XP
          </div>
        </div>
      </div>

      {/* Progress to next rank */}
      {next ? (
        <>
          <div style={styles.track}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 99,
                background: `linear-gradient(90deg, ${tier.color}, #ff8a2a)`,
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <div
            style={{
              ...styles.sub,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {(next.min - lifetime).toLocaleString()} XP to
            <TierIcon tier={next} size={13} />
            <span style={{ color: next.color, fontWeight: 700 }}>
              {next.name}
            </span>
          </div>
        </>
      ) : (
        <div style={{ ...styles.sub, color: "#fbbf24", fontWeight: 700 }}>
          {tier.name} — you've reached the top!
        </div>
      )}

      {/* Spendable — clearly separate from rank */}
      <button
        type="button"
        onClick={() => navigate("/passport/rewards")}
        style={styles.wallet}
        title="Spending XP on rewards never lowers your rank"
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffb066"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
          </svg>
          <b style={{ color: "#ffb066" }}>{balance.toLocaleString()} XP</b> to
          spend
        </span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

const styles = {
  shell: {
    background:
      "linear-gradient(135deg,rgba(30,16,60,0.92),rgba(20,10,40,0.92))",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 16,
    padding: "18px 16px",
    backdropFilter: "blur(16px)",
  },
  skel: { borderRadius: 8, background: "rgba(255,255,255,0.06)" },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  rankRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  rankName: {
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: "-0.5px",
    fontFamily: "'Sora','Outfit',sans-serif",
  },
  sub: { fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 3 },
  track: {
    height: 5,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 7,
  },
  wallet: {
    marginTop: 14,
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,138,42,0.25)",
    background: "rgba(255,138,42,0.08)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    fontFamily: "inherit",
    cursor: "pointer",
  },
};
