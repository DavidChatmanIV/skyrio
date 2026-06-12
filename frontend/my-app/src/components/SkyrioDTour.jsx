/**
 * SkyrioDTour.jsx
 * Onboarding tour — iOS Safari, Android Chrome, Desktop.
 * Save to: src/components/SkyrioDTour.jsx
 * Reset:   localStorage.removeItem("skyrio_tour_done")
 */
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const ORANGE = "#ff8a2a";
const ORANGE2 = "#ffb066";
const PURPLE = "#7c5cfc";

// ─── Filled SVG Icons ─────────────────────────────────────────────────────────

function IconPlane({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.25.25 0 0 1 0 .5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.289z" />
    </svg>
  );
}

function IconSearch({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5zM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconGlobe({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M21.721 12.752a9.711 9.711 0 0 0-.945-5.003 12.754 12.754 0 0 1-4.339 2.708 18.991 18.991 0 0 1-.214 4.772 17.165 17.165 0 0 0 5.498-2.477zM14.634 15.55a17.324 17.324 0 0 0 .332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 0 0 .332 4.647 17.385 17.385 0 0 0 5.268 0zM9.772 17.119a18.963 18.963 0 0 0 4.456 0A17.182 17.182 0 0 1 12 21.724a17.18 17.18 0 0 1-2.228-4.605zM7.777 15.23a18.87 18.87 0 0 1-.214-4.774 12.753 12.753 0 0 1-4.34-2.708 9.711 9.711 0 0 0-.944 5.004 17.165 17.165 0 0 0 5.498 2.477zM21.356 14.752a9.765 9.765 0 0 1-7.478 6.817 18.64 18.64 0 0 0 1.988-4.718 18.627 18.627 0 0 0 5.49-2.098zM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 0 0 1.988 4.718 9.765 9.765 0 0 1-7.478-6.816zM13.878 2.43a9.755 9.755 0 0 1 6.116 3.986 11.267 11.267 0 0 1-3.746 2.504 18.63 18.63 0 0 0-2.37-6.49zM12 2.276a17.152 17.152 0 0 1 2.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0 1 12 2.276zM10.122 2.43a18.629 18.629 0 0 0-2.37 6.49 11.266 11.266 0 0 1-3.746-2.504 9.754 9.754 0 0 1 6.116-3.985z" />
    </svg>
  );
}

function IconBookmark({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconPassport({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15z" />
      <path
        fillRule="evenodd"
        d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconUsers({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0zM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0zM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003z" />
    </svg>
  );
}

function IconRobot({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        d="M11.25 3a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75zm0 0V4.5h1.5V3h-1.5zM3 9.75A2.25 2.25 0 0 1 5.25 7.5h13.5A2.25 2.25 0 0 1 21 9.75v7.5A2.25 2.25 0 0 1 18.75 19.5H5.25A2.25 2.25 0 0 1 3 17.25v-7.5zm6.75 2.25a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm3.75 3a.75.75 0 0 0-1.5 0v.75h-.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-.75V15zm2.25-1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM1.5 11.25a.75.75 0 0 1 .75-.75H3v3H2.25a.75.75 0 0 1-.75-.75v-1.5zM21 10.5h.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75H21v-3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconShare({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        d="M15.75 4.5a3 3 0 1 1 .825 2.066l-8.421 4.679a3.002 3.002 0 0 1 0 1.51l8.421 4.679a3 3 0 1 1-.729 1.31l-8.421-4.678a3 3 0 1 1 0-4.132l8.421-4.679a3 3 0 0 1-.096-.755z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconRocket({ size = 28, color = ORANGE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 0 1 .75.75c0 5.056-2.383 9.555-6.084 12.436A6.75 6.75 0 0 1 9.75 22.5a.75.75 0 0 1-.75-.75v-4.131A15.838 15.838 0 0 1 6.382 15H2.25a.75.75 0 0 1-.75-.75 6.75 6.75 0 0 1 7.815-6.666zM15 6.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5z"
        clipRule="evenodd"
      />
      <path d="M5.26 17.242a.75.75 0 1 0-.897-1.203 5.243 5.243 0 0 0-2.05 5.022.75.75 0 0 0 .625.627 5.243 5.243 0 0 0 5.022-2.051.75.75 0 1 0-1.202-.897 3.744 3.744 0 0 1-3.008 1.51c0-1.23.592-2.323 1.51-3.008z" />
    </svg>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    Icon: IconPlane,
    title: "Welcome to Skyrio",
    body: "A new way to travel — smarter, together. Let's show you around in 30 seconds.",
    tip: null,
  },
  {
    Icon: IconSearch,
    title: "Search flights, hotels & more",
    body: "Use the search bar to find flights, hotels, car rentals, and excursions — all in one place. No jumping between tabs.",
    tip: "Atlas, your AI travel assistant, can search for you in plain English.",
  },
  {
    Icon: IconGlobe,
    title: "SkyHub — Your Travel Feed",
    body: "SkyHub is Skyrio's social space. Share travel moments, follow other explorers, and discover trips through your community's eyes.",
    tip: "Post a moment from any trip to earn XP and inspire other travelers.",
  },
  {
    Icon: IconBookmark,
    title: "Save & plan your trips",
    body: "Hit the bookmark icon on any result to save it. Your saved trips live in the Saved Trips section — organised, shareable, and ready to book.",
    tip: "Each save earns you XP on your Digital Passport.",
  },
  {
    Icon: IconPassport,
    title: "Your Digital Passport",
    body: "Your Digital Passport is your Skyrio profile. Every booking, save, and adventure earns XP and unlocks badges that show up here as you explore the world.",
    tip: "Check your passport from the profile menu anytime.",
  },
  {
    Icon: IconUsers,
    title: "Sync Together",
    body: "Planning a trip with friends or family? Sync Together lets your group coordinate in one place — shared itineraries, group decisions, and split planning without the back-and-forth texts.",
    tip: "Find Sync Together in the booking page to start or join a group trip.",
  },
  {
    Icon: IconRobot,
    title: "Meet Atlas",
    body: "Atlas is your AI travel assistant. Ask it anything — 'Find me a beach trip under $800' or 'What's the weather in Tokyo in March?' It handles the research so you can focus on the adventure.",
    tip: "If Atlas can't solve your issue, tap 'Need help?' and our team steps in.",
  },
  {
    Icon: IconShare,
    title: "Share & Earn XP Together",
    body: "Love Skyrio? Share your passport link with friends and earn XP every time someone joins through your link. The more travelers in your crew, the more you all earn.",
    tip: "Go to your Passport → Share Passport to get your referral link.",
    rewards: [
      { emoji: "✈️", label: "You share your link", xp: "+10 XP" },
      { emoji: "🌍", label: "Friend signs up", xp: "+50 XP to you" },
      { emoji: "🎁", label: "Friend's welcome bonus", xp: "+25 XP to them" },
    ],
  },
  {
    Icon: IconRocket,
    title: "You're ready to fly.",
    body: "That's everything you need to know. Start by searching your first destination — your next adventure is one search away.",
    tip: null,
    isLast: true,
  },
];

// ─── iOS Safari detect ────────────────────────────────────────────────────────
function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iP(ad|hone|od)/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS/.test(ua)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SkyrioDTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const overlayRef = useRef(null);
  const scrollYRef = useRef(0);
  const isSafariRef = useRef(false);

  useEffect(() => {
    isSafariRef.current = isIOSSafari();
    if (localStorage.getItem("skyrio_tour_done")) return;
    const t = setTimeout(() => {
      setVisible(true);
      if (!isSafariRef.current) {
        scrollYRef.current = window.scrollY || window.pageYOffset;
        Object.assign(document.body.style, {
          overflow: "hidden",
          position: "fixed",
          top: `-${scrollYRef.current}px`,
          left: "0",
          right: "0",
          width: "100%",
        });
      }
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  function unlock() {
    if (!isSafariRef.current) {
      Object.assign(document.body.style, {
        overflow: "",
        position: "",
        top: "",
        left: "",
        right: "",
        width: "",
      });
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
    step < STEPS.length - 1 ? setStep((s) => s + 1) : skipForNow();
  }
  function prev() {
    step > 0 && setStep((s) => s - 1);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = current.Icon;

  return createPortal(
    <div
      onClick={skipForNow}
      onTouchMove={(e) => {
        if (overlayRef.current && !overlayRef.current.contains(e.target))
          e.preventDefault();
      }}
      style={{
        position: isSafariRef.current ? "absolute" : "fixed",
        top: isSafariRef.current
          ? `${scrollYRef.current || window.scrollY}px`
          : 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
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
          maxHeight: "88vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          background: "#120f2a",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 22,
          boxShadow: "0 40px 100px rgba(0,0,0,0.9)",
          fontFamily: "'DM Sans', sans-serif",
          color: "#f0edff",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: "22px 22px 0 0",
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
              cursor: "pointer",
              color: "rgba(240,237,255,0.45)",
              fontSize: 26,
              lineHeight: 1,
              padding: "4px 8px",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 28px" }}>
          {/* Icon badge */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              marginBottom: 18,
              background:
                "linear-gradient(135deg, rgba(255,138,42,0.2), rgba(124,92,252,0.15))",
              border: "1px solid rgba(255,138,42,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(255,138,42,0.15)",
            }}
          >
            <StepIcon size={28} color={ORANGE} />
          </div>

          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 21,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.4px",
            }}
          >
            {current.title}
          </h2>

          <p
            style={{
              margin: "0 0 16px",
              fontSize: 14,
              color: "rgba(240,237,255,0.78)",
              lineHeight: 1.7,
            }}
          >
            {current.body}
          </p>

          {/* Referral reward rows */}
          {current.rewards && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {current.rewards.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: 18 }}>{r.emoji}</span>
                    <span
                      style={{ fontSize: 13, color: "rgba(240,237,255,0.7)" }}
                    >
                      {r.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: ORANGE,
                      background: "rgba(255,138,42,0.12)",
                      border: "1px solid rgba(255,138,42,0.22)",
                      borderRadius: 20,
                      padding: "3px 10px",
                    }}
                  >
                    {r.xp}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tip */}
          {current.tip && (
            <div
              style={{
                background: "rgba(255,138,42,0.1)",
                border: "1px solid rgba(255,138,42,0.25)",
                borderRadius: 11,
                padding: "10px 14px",
                fontSize: 13,
                color: ORANGE2,
                lineHeight: 1.55,
                marginBottom: 8,
              }}
            >
              💡 {current.tip}
            </div>
          )}

          {/* Step counter */}
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              margin: "14px 0 18px",
              textAlign: "right",
            }}
          >
            {step + 1} / {STEPS.length}
          </p>

          {/* Buttons */}
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
                  borderRadius: 11,
                  minHeight: 48,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "none",
                  color: "rgba(240,237,255,0.55)",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={skipForNow}
              style={{
                padding: "0 14px",
                borderRadius: 11,
                minHeight: 48,
                border: "none",
                background: "rgba(255,255,255,0.07)",
                color: "rgba(240,237,255,0.55)",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Skip for now
            </button>
            <button
              onClick={next}
              style={{
                padding: "0 24px",
                borderRadius: 11,
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
                boxShadow: "0 4px 16px rgba(255,138,42,0.3)",
                WebkitTapHighlightColor: "transparent",
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
                color: "rgba(240,237,255,0.25)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                padding: "8px 12px",
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
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
