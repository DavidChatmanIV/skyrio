import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import passportBg from "../../assets/DigitalPassport/worldmap.png";
import "../../styles/passport-locked.css";

// ── SVG Icons replacing all Apple emoji ──

function IconStar({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  );
}

function IconMedal({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="9" r="6" />
      <circle
        cx="12"
        cy="9"
        r="2.5"
        fill="currentColor"
        opacity="0.3"
        stroke="none"
      />
      <path d="M8.5 14.5L7 22L12 19L17 22L15.5 14.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconTag({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconPin({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconPlane({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

function IconBeach({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="17" cy="5" r="3" fill="#FFB347" />
      <path
        d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
        stroke="#4FC3F7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="8"
        x2="10"
        y2="18"
        stroke="#8D6E63"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 8C10 8 4 4 3 6.5C2 9 8 12 10 8Z"
        fill="#66BB6A"
        opacity="0.8"
      />
      <path
        d="M10 8C10 8 16 4 17 6.5C18 9 12 12 10 8Z"
        fill="#81C784"
        opacity="0.8"
      />
    </svg>
  );
}

function IconTower({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M12 2L12 22" />
      <path d="M8 22H16" />
      <path
        d="M9.5 6L12 2L14.5 6"
        fill="currentColor"
        opacity="0.2"
        stroke="none"
      />
      <path d="M10 10H14" />
      <path d="M9 14H15" />
      <path d="M8 18H16" />
    </svg>
  );
}

function IconMountain({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M8 21L1 21L8 6L11.5 12.5" />
      <path d="M14 21L23 21L16 6L12.5 12.5" />
    </svg>
  );
}

function IconGlobe({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconFlag({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <line
        x1="5"
        y1="4"
        x2="5"
        y2="22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 4H18L15 9L18 14H5"
        fill="currentColor"
        opacity="0.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkle({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  );
}

const PERKS = [
  { Icon: IconStar, text: "Earn XP on every flight, hotel, and activity" },
  { Icon: IconMedal, text: "Unlock badges and level up your traveller rank" },
  { Icon: IconTag, text: "Redeem XP for real discounts on future bookings" },
  { Icon: IconPin, text: "Save trips and build your personal travel map" },
  { Icon: IconPlane, text: "Get personalised AI trip recommendations" },
];

const PREVIEW_STATS = [
  { val: "2,840", label: "XP Earned" },
  { val: "12", label: "Trips Saved" },
  { val: "15%", label: "Discount" },
];

const PREVIEW_BADGES = [
  { Icon: IconBeach, label: "Beach" },
  { Icon: IconTower, label: "Tower" },
  { Icon: IconMountain, label: "Mountain" },
  { Icon: IconGlobe, label: "Globe" },
  { Icon: IconPlane, label: "Flights" },
  { Icon: IconFlag, label: "Flag" },
];

export default function PassportLockedPage() {
  const nav = useNavigate();

  return (
    <div className="passport-page">
      <div
        className="passport-bg"
        style={{
          backgroundImage: `url(${passportBg})`,
          filter: "blur(4px) brightness(0.5) saturate(0.8)",
        }}
        aria-hidden="true"
      />
      <div className="passport-content">
        <div className="plk-page">
          <div className="plk-inner">
            <div className="plk-hero">
              <h1 className="plk-title">Your Travel Profile</h1>
              <p className="plk-sub">
                Your travel identity — XP, badges, and exclusive rewards.
              </p>
            </div>

            <div className="plk-layout">
              <div className="plk-preview" aria-hidden="true">
                <div className="plk-blur">
                  <div className="plk-blur-topbar">
                    <span className="plk-blur-name">Explorer's Profile</span>
                    <span className="plk-blur-level">
                      Level 7 <IconSparkle size={12} />
                    </span>
                  </div>
                  <div className="plk-blur-stats">
                    {PREVIEW_STATS.map((s) => (
                      <div key={s.label} className="plk-blur-stat">
                        <div className="plk-blur-val">{s.val}</div>
                        <div className="plk-blur-label">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="plk-blur-badges">
                    {PREVIEW_BADGES.map((b, i) => (
                      <div key={i} className="plk-blur-badge">
                        <b.Icon size={20} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="plk-overlay">
                  <div className="plk-lock-icon">
                    <Lock size={32} strokeWidth={1.5} />
                  </div>
                  <h2 className="plk-lock-title">Your profile awaits</h2>
                  <p className="plk-lock-sub">
                    Create a free account to unlock your profile, earn XP on
                    every booking, and access exclusive travel discounts.
                  </p>
                </div>
              </div>

              <div className="plk-cta-panel">
                <div className="plk-perks">
                  {PERKS.map((p) => (
                    <div key={p.text} className="plk-perk">
                      <span className="plk-perk-icon">
                        <p.Icon size={16} />
                      </span>
                      <span className="plk-perk-text">{p.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  className="plk-cta"
                  onClick={() =>
                    nav("/register", { state: { redirectTo: "/passport" } })
                  }
                >
                  Create your boarding pass — it's free
                </button>

                <p className="plk-signin">
                  Already a member?{" "}
                  <button
                    className="plk-signin-link"
                    onClick={() =>
                      nav("/login", { state: { redirectTo: "/passport" } })
                    }
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
