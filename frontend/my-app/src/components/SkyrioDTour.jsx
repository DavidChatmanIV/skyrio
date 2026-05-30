/**
 * SkyrioDTour.jsx
 * ───────────────
 * Onboarding tour for Skyrio users.
 * Uses ReactDOM.createPortal + body scroll lock for iOS Safari fix.
 *
 * Save to: src/components/SkyrioDTour.jsx
 *
 * To reset for testing:
 *   localStorage.removeItem("skyrio_tour_done") then refresh.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function PlaneIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function SearchIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21L16.65 16.65" />
    </svg>
  );
}

function SkyHubIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function BookmarkIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21L12 16L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PassportIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="2" width="18" height="20" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6 18h12" />
      <path d="M6 14h12" />
    </svg>
  );
}

function GroupIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  );
}

function RobotIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.5" />
      <rect x="8" y="5.5" width="8" height="5.5" rx="2" opacity=".9" />
      <circle cx="10" cy="14" r="1.5" fill="#FFD060" />
      <circle cx="14" cy="14" r="1.5" fill="#FFD060" />
      <rect
        x="10"
        y="17"
        width="4"
        height="1.2"
        rx=".6"
        fill="#1a0d04"
        opacity=".55"
      />
      <line
        x1="12"
        y1="5.5"
        x2="12"
        y2="3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3" r="1.3" />
      <line
        x1="5.5"
        y1="13"
        x2="3.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="18.5"
        y1="13"
        x2="20.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RocketIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// ─── Tour steps ───────────────────────────────────────────────────────────────
const STEPS = [
  {
    Icon: PlaneIcon,
    title: "Welcome to Skyrio",
    body: "A new way to travel — smarter, together. Let's show you around in 30 seconds.",
    tip: null,
  },
  {
    Icon: SearchIcon,
    title: "Search flights, hotels & more",
    body: "Use the search bar to find flights, hotels, car rentals, and excursions — all in one place. No jumping between tabs.",
    tip: "Tip: Atlas, your AI travel assistant, can search for you in plain English.",
  },
  {
    Icon: SkyHubIcon,
    title: "SkyHub — Your Travel Feed",
    body: "SkyHub is Skyrio's social space. Share travel moments, follow other explorers, and discover trips through your community's eyes.",
    tip: "Tip: Post a moment from any trip to earn XP and inspire other travelers.",
  },
  {
    Icon: BookmarkIcon,
    title: "Save & plan your trips",
    body: "Hit the bookmark icon on any result to save it. Your saved trips live in the Saved Trips section — organised, shareable, and ready to book.",
    tip: "Tip: Each save earns you XP on your Digital Passport.",
  },
  {
    Icon: PassportIcon,
    title: "Your Digital Passport",
    body: "Your Digital Passport is your Skyrio profile — not an official travel document. Every booking, save, and adventure earns XP and unlocks badges that show up here as you explore the world.",
    tip: "Tip: Check your passport from the profile menu anytime.",
  },
  {
    Icon: GroupIcon,
    title: "Sync Together",
    body: "Planning a trip with friends or family? Sync Together lets your group coordinate in one place — shared itineraries, group decisions, and split planning without the back-and-forth texts.",
    tip: "Tip: Find Sync Together in the booking page to start or join a group trip.",
  },
  {
    Icon: RobotIcon,
    title: "Meet Atlas",
    body: "Atlas is your AI travel assistant. Ask it anything — 'Find me a beach trip under $800' or 'What's the weather in Tokyo in March?' It handles the research so you can focus on the adventure.",
    tip: "Tip: If Atlas can't solve your issue, tap 'Need help?' and our team steps in.",
  },
  {
    Icon: RocketIcon,
    title: "You're ready to fly.",
    body: "That's everything you need to know. Start by searching your first destination — your next adventure is one search away.",
    tip: null,
    isLast: true,
  },
];

const ORANGE = "#ff8a2a";
const ORANGE2 = "#ffb066";
const PURPLE = "#7c5cfc";

// ─── Body scroll lock helpers (iOS Safari fix) ────────────────────────────────
let _scrollY = 0;

function lockScroll() {
  _scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${_scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";
  document.body.style.width = "100%";
}

function unlockScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  document.body.style.width = "";
  window.scrollTo(0, _scrollY);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SkyrioDTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("skyrio_tour_done");
    if (!dismissed) {
      const t = setTimeout(() => {
        setVisible(true);
        lockScroll(); // iOS Safari: prevent background scroll
      }, 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Cleanup on unmount just in case
  useEffect(() => {
    return () => {
      unlockScroll();
    };
  }, []);

  function skipForNow() {
    unlockScroll();
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setStep(0);
    }, 300);
  }

  function neverShow() {
    unlockScroll();
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem("skyrio_tour_done", "1");
      setVisible(false);
      setExiting(false);
      setStep(0);
    }, 300);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else skipForNow();
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = current.Icon;

  return createPortal(
    <>
      <style>{`
        @keyframes dtFadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes dtFadeOut  { from { opacity:1 } to { opacity:0 } }
        @keyframes dtSlideIn  { from { opacity:0; transform:translate(-50%,-48%) scale(.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
        @keyframes dtSlideOut { from { opacity:1; transform:translate(-50%,-50%) scale(1) } to { opacity:0; transform:translate(-50%,-52%) scale(.96) } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={skipForNow}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2147483640,
          background: "rgba(0,0,0,0.88)",
          WebkitTapHighlightColor: "transparent",
          animation: exiting
            ? "dtFadeOut .3s ease forwards"
            : "dtFadeIn .3s ease",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 2147483647,
          width: "min(480px, 92vw)",
          maxHeight: "85dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: "#120f2a",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20,
          boxShadow: "0 40px 100px rgba(0,0,0,0.95)",
          animation: exiting
            ? "dtSlideOut .3s ease forwards"
            : "dtSlideIn .35s cubic-bezier(.22,1,.36,1)",
          fontFamily: "'DM Sans', sans-serif",
          color: "#f0edff",
          // Critical for iOS: create new stacking context
          willChange: "transform",
          isolation: "isolate",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE})`,
            width: `${progress}%`,
            transition: "width .4s ease",
            borderRadius: "20px 20px 0 0",
            flexShrink: 0,
          }}
        />

        {/* Dots + close */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px 0",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i === step
                      ? ORANGE
                      : i < step
                      ? PURPLE
                      : "rgba(255,255,255,0.15)",
                  transition: "all .3s ease",
                }}
              />
            ))}
          </div>
          <button
            onClick={skipForNow}
            style={{
              background: "none",
              border: "none",
              color: "rgba(240,237,255,0.5)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: "4px 8px",
              WebkitTapHighlightColor: "transparent",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px 32px" }}>
          {/* Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,138,42,0.15)",
              border: "1px solid rgba(255,138,42,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ORANGE,
              marginBottom: 20,
              flexShrink: 0,
            }}
          >
            <StepIcon size={28} />
          </div>

          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 22,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            {current.title}
          </h2>

          <p
            style={{
              margin: "0 0 16px",
              fontSize: 15,
              color: "rgba(240,237,255,0.80)",
              lineHeight: 1.65,
            }}
          >
            {current.body}
          </p>

          {current.tip && (
            <div
              style={{
                background: "rgba(255,138,42,0.12)",
                border: "1px solid rgba(255,138,42,0.30)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: ORANGE2,
                marginBottom: 8,
              }}
            >
              {current.tip}
            </div>
          )}

          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.25)",
              margin: "14px 0 20px",
              textAlign: "right",
            }}
          >
            {step + 1} / {STEPS.length}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {step > 0 && (
              <button
                onClick={prev}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "none",
                  color: "rgba(240,237,255,0.6)",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 44,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={skipForNow}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(240,237,255,0.6)",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Skip for now
            </button>
            <button
              onClick={next}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: current.isLast
                  ? `linear-gradient(135deg, ${ORANGE}, ${ORANGE2})`
                  : `linear-gradient(135deg, ${ORANGE}, ${PURPLE})`,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(255,138,42,0.35)",
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {current.isLast ? "Let's go →" : "Next →"}
            </button>
          </div>

          {/* Don't show again */}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={neverShow}
              style={{
                background: "none",
                border: "none",
                color: "rgba(240,237,255,0.28)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                padding: "8px 16px",
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Don't show again
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
