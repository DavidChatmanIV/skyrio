import React, { useState, useEffect } from "react";
import { Share2, X, Award, Link2 } from "lucide-react";
import { XP_TIERS } from "@/config/xpConfig";
import { TierMedal } from "@/components/passport/TierIcon";

const BADGE_CONFIG = {
  Explorer: { color: "#7c5cfc", emoji: "🌍" },
  Adventurer: { color: "#ff8a2a", emoji: "🏔" },
  Nomad: { color: "#00b8d9", emoji: "✈️" },
  Legend: { color: "#f0c040", emoji: "👑" },
};

const STORAGE_PREFIX = "skyrio_shared_rank_";

// Public site for share links — never share a localhost URL.
// Add VITE_PUBLIC_SITE_URL=https://myskyrio.com to frontend .env (and Vercel).
const PUBLIC_SITE =
  import.meta.env.VITE_PUBLIC_SITE_URL ||
  (window.location.hostname === "localhost"
    ? "https://myskyrio.com"
    : window.location.origin);

// Copy that works even where navigator.clipboard is blocked.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/**
 * badge — rank name from getTier(totalEarned).name
 * xp    — pass LIFETIME XP (totalEarned from useXPSystem), not the spendable balance
 */
export default function ShareRankPrompt({ badge, username, xp = 0 }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState(null); // "copied" | "shared" | "failed" | null

  // Colors/icons come from the real tier ladder, so every rank gets its own look.
  const tier = XP_TIERS.find((t) => t.name === badge);
  const config = tier
    ? { color: tier.color, emoji: tier.icon }
    : BADGE_CONFIG[badge] || BADGE_CONFIG.Explorer;
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

  const url = `${PUBLIC_SITE}/u/${encodeURIComponent(username || "")}`;
  const text = `I just hit ${badge} rank on Skyrio ✦ ${Number(
    xp
  ).toLocaleString()} XP and counting. Check out my travel passport:`;

  const flash = (s) => {
    setStatus(s);
    setTimeout(() => setStatus(null), 3000);
  };

  const markShared = () => {
    try {
      localStorage.setItem(storageKey, "shared");
    } catch {}
  };

  // navigator.share() is called FIRST (no await before it), so the browser still
  // counts it as the user's click. Any failure falls back to copying the link,
  // so the button can never silently do nothing again.
  const handleShare = async (e) => {
    e?.stopPropagation();
    const data = { title: `${badge} on Skyrio`, text, url };

    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        markShared();
        flash("shared");
        setTimeout(() => setVisible(false), 1200);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // user closed the share sheet
        console.warn(
          "[ShareRankPrompt] native share failed, copying instead:",
          err
        );
      }
    }

    if (await copyText(`${text} ${url}`)) {
      markShared();
      flash("copied");
    } else {
      flash("failed");
    }
  };

  const handleCopyLink = async (e) => {
    e.stopPropagation();
    if (await copyText(url)) {
      markShared();
      flash("copied");
    } else flash("failed");
  };

  const enc = encodeURIComponent;
  const quickLinks = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(
        url
      )}`,
    },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { label: "Text", href: `sms:?&body=${enc(`${text} ${url}`)}` },
  ];

  const chipStyle = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 0",
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "DM Sans, sans-serif",
    textDecoration: "none",
    cursor: "pointer",
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
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
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
          aria-label="Close"
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
          {tier ? (
            <TierMedal tier={tier} size={48} />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${config.color}, rgba(255,138,42,0.6))`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Award size={22} color="#fff" />
            </div>
          )}
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
          {Number(xp).toLocaleString()} lifetime XP. Your rank is yours to keep
          — redeeming rewards never lowers it. Share your passport and invite
          friends to join Skyrio.
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
          {status === "copied"
            ? "Link copied — paste it anywhere!"
            : status === "shared"
            ? "Shared! ✦"
            : `Share my ${badge} passport`}
        </button>

        {/* Always-available options, in case native share isn't supported */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={handleCopyLink} style={chipStyle}>
            <Link2 size={13} /> Copy link
          </button>
          {quickLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.label === "Text" ? undefined : "_blank"}
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                markShared();
              }}
              style={chipStyle}
            >
              {l.label}
            </a>
          ))}
        </div>

        {status === "failed" && (
          <p
            role="status"
            style={{
              fontSize: 12,
              color: "#fca5a5",
              margin: "0 0 10px",
              wordBreak: "break-all",
            }}
          >
            Couldn't copy automatically. Your link: {url}
          </p>
        )}

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
