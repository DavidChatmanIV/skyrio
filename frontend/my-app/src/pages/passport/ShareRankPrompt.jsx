import React, { useState, useEffect } from "react";
import { Share2, X, Award } from "lucide-react";

const BADGE_CONFIG = {
  Explorer: { color: "#7c5cfc", emoji: "🌍" },
  Adventurer: { color: "#ff8a2a", emoji: "🏔" },
  Nomad: { color: "#00b8d9", emoji: "✈️" },
  Legend: { color: "#f0c040", emoji: "👑" },
};

const STORAGE_PREFIX = "skyrio_shared_rank_";

export default function ShareRankPrompt({ badge, username, xp }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = BADGE_CONFIG[badge] || BADGE_CONFIG.Explorer;
  const storageKey = `${STORAGE_PREFIX}${badge}`;

  // Show prompt when user reaches a new badge they haven't shared yet
  useEffect(() => {
    if (!badge || !username) return;
    try {
      if (localStorage.getItem(storageKey)) return; // already shared/dismissed
      // Only show for non-Explorer ranks (Explorer is the starting rank)
      if (badge === "Explorer") return;
      // Small delay so page settles
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [badge, username, storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {}
    setVisible(false);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${username}`;
    const text = `I just hit ${badge} rank on Skyrio ✦ ${xp.toLocaleString()} XP and counting. Check out my travel passport:`;

    try {
      if (navigator.share) {
        await navigator.share({ title: `${badge} on Skyrio`, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      try {
        localStorage.setItem(storageKey, "shared");
      } catch {}
    } catch {
      /* user cancelled */
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 1200,
          animation: "srFadeIn 0.2s ease forwards",
        }}
        aria-hidden="true"
      />

      {/* Prompt */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1201,
          width: "min(420px, calc(100vw - 32px))",
          background: "rgba(14,8,30,0.98)",
          border: `1px solid ${config.color}44`,
          borderRadius: 20,
          padding: "24px 22px 20px",
          boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${config.color}22`,
          backdropFilter: "blur(32px)",
          animation: "srSlideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) forwards",
        }}
      >
        <style>{`
          @keyframes srFadeIn  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes srSlideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        `}</style>

        {/* Close */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
          }}
        >
          <X size={14} />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${config.color}, rgba(255,138,42,0.6))`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 20px ${config.color}55`,
              flexShrink: 0,
            }}
          >
            <Award size={22} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: config.color,
                marginBottom: 3,
              }}
            >
              New rank unlocked
            </div>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {badge} ✦
            </div>
          </div>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          You've hit <strong style={{ color: "#fff" }}>{badge}</strong> with{" "}
          {xp.toLocaleString()} XP. Share your passport — let others see your
          rank and join Skyrio.
        </p>

        <button
          onClick={handleShare}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "13px 20px",
            borderRadius: 12,
            border: "none",
            background: `linear-gradient(135deg, ${config.color}, #ff8a2a)`,
            color: "#fff",
            fontFamily: "DM Sans, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: `0 6px 20px ${config.color}44`,
            marginBottom: 10,
          }}
        >
          <Share2 size={15} />
          {copied ? "Link copied to clipboard!" : `Share my ${badge} passport`}
        </button>

        <button
          onClick={dismiss}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 12,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          Maybe later
        </button>
      </div>
    </>
  );
}
