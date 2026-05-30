/**
 * SkyrioDTour.jsx
 * ───────────────
 * Onboarding tour — works on iOS Safari, Android Chrome, and Desktop.
 *
 * iOS Safari fix: instead of locking body scroll (which breaks fixed),
 * we use a fullscreen overlay div that handles its own scroll prevention.
 *
 * Save to: src/components/SkyrioDTour.jsx
 * Reset: localStorage.removeItem("skyrio_tour_done") then refresh.
 */

import { useState, useEffect, useRef } from "react";
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

// ─── Detect iOS Safari ────────────────────────────────────────────────────────
function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iP(ad|hone|od)/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  return isIOS && isSafari;
}

export default function SkyrioDTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const overlayRef = useRef(null);
  const scrollYRef = useRef(0);
  const isSafariRef = useRef(false);

  useEffect(() => {
    isSafariRef.current = isIOSSafari();

    const dismissed = localStorage.getItem("skyrio_tour_done");
    if (dismissed) return;

    const t = setTimeout(() => {
      setVisible(true);

      if (isSafariRef.current) {
        // iOS Safari: DO NOT lock body — it breaks position:fixed
        // The overlay itself handles scroll prevention via touch events
      } else {
        // Android Chrome + Desktop: standard body lock
        scrollYRef.current = window.scrollY || window.pageYOffset;
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollYRef.current}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
      }
    }, 2000);

    return () => clearTimeout(t);
  }, []);

  function unlock() {
    if (!isSafariRef.current) {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollYRef.current);
    }
  }

  function skipForNow() {
    unlock();
    setVisible(false);
    setStep(0);
  }

  function neverShow() {
    unlock();
    localStorage.setItem("skyrio_tour_done", "1");
    setVisible(false);
    setStep(0);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else skipForNow();
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  // Prevent background scroll on iOS Safari via touch events
  function handleOverlayTouch(e) {
    // Allow scrolling inside the card itself
    if (overlayRef.current && !overlayRef.current.contains(e.target)) {
      e.preventDefault();
    }
  }

  if (!visible) return null;

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = current.Icon;

  return createPortal(
    <div
      onTouchMove={handleOverlayTouch}
      onClick={skipForNow}
      style={{
        // iOS Safari: use position absolute with full page coverage
        // so it doesn't depend on body scroll state
        position: isSafariRef.current ? "absolute" : "fixed",
        top: isSafariRef.current
          ? `${scrollYRef.current || window.scrollY}px`
          : 0,
        left: 0,
        width: "100vw",
        height: isSafariRef.current ? "100vh" : "100vh",
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        overflowY: "hidden",
      }}
    >
      {/* Card */}
      <div
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: "#120f2a",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20,
          boxShadow: "0 40px 100px rgba(0,0,0,0.95)",
          fontFamily: "'DM Sans', sans-serif",
          color: "#f0edff",
          overscrollBehavior: "contain",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: "20px 20px 0 0",
            background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE})`,
            width: `${progress}%`,
            transition: "width .4s ease",
          }}
        />

        {/* Dots + close */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 20px 0",
          }}
        >
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 16 : 6,
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
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
              padding: "4px 8px",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 28px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(255,138,42,0.15)",
              border: "1px solid rgba(255,138,42,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ORANGE,
              marginBottom: 16,
            }}
          >
            <StepIcon size={26} />
          </div>

          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.4px",
            }}
          >
            {current.title}
          </h2>

          <p
            style={{
              margin: "0 0 14px",
              fontSize: 14,
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
              fontSize: 11,
              color: "rgba(255,255,255,0.22)",
              margin: "12px 0 18px",
              textAlign: "right",
            }}
          >
            {step + 1} / {STEPS.length}
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {step > 0 && (
              <button
                onClick={prev}
                style={{
                  padding: "0 16px",
                  borderRadius: 10,
                  minHeight: 48,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "none",
                  color: "rgba(240,237,255,0.6)",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={skipForNow}
              style={{
                padding: "0 14px",
                borderRadius: 10,
                minHeight: 48,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(240,237,255,0.6)",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              Skip for now
            </button>
            <button
              onClick={next}
              style={{
                padding: "0 22px",
                borderRadius: 10,
                minHeight: 48,
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
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {current.isLast ? "Let's go →" : "Next →"}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 18 }}>
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
                padding: "8px 12px",
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              Don't show again
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
