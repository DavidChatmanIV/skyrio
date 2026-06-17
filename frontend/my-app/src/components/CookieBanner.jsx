import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const ORANGE = "#ff8a2a";
const ORANGE2 = "#ffb066";

function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iP(ad|hone|od)/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS/.test(ua)
  );
}

function CookieIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <circle cx="12" cy="12" r="10" fill={ORANGE} opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke={ORANGE} strokeWidth="1.5" />
      <circle cx="9" cy="9.5" r="1.2" fill={ORANGE} />
      <circle cx="14.5" cy="8" r="0.9" fill={ORANGE2} />
      <circle cx="15" cy="13.5" r="1.2" fill={ORANGE} />
      <circle cx="10" cy="14.5" r="0.8" fill={ORANGE2} />
      <circle cx="12.5" cy="11" r="0.7" fill={ORANGE} />
      <path
        d="M8.5 7.5 Q9 6.5 10 7"
        stroke={ORANGE2}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const isSafariRef = useRef(false);
  const scrollYRef = useRef(0);

  useEffect(() => {
    isSafariRef.current = isIOSSafari();
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) setVisible(true);
  }, []);

  const dismiss = (value) => {
    localStorage.setItem("cookieConsent", value);
    setVisible(false);
  };

  if (!visible) return null;

  return createPortal(
    <div
      style={{
        position: isSafariRef.current ? "absolute" : "fixed",
        bottom: isSafariRef.current
          ? `${
              -(
                scrollYRef.current ||
                (typeof window !== "undefined" ? window.scrollY : 0)
              ) + 20
            }px`
          : 20,
        left: 20,
        right: 20,
        zIndex: 2147483647,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 480,
          background: "#120f2a",
          border: "1px solid rgba(255, 138, 42, 0.25)",
          borderRadius: 16,
          padding: "16px 20px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <CookieIcon />
          <span
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.5,
            }}
          >
            We use cookies to enhance your experience saving trips, showing XP,
            and keeping you logged in.
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => dismiss("false")}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              color: "rgba(255,255,255,0.6)",
              fontWeight: 600,
              fontSize: 13,
              padding: "7px 16px",
              minHeight: 44,
              cursor: "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Decline
          </button>
          <button
            onClick={() => dismiss("true")}
            style={{
              background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE2})`,
              border: "none",
              borderRadius: 999,
              color: "#1a0d04",
              fontWeight: 700,
              fontSize: 13,
              padding: "7px 16px",
              minHeight: 44,
              cursor: "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Got it ✓
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
