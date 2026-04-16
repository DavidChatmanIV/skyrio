import { useNavigate } from "react-router-dom";
import "../styles/passport-locked.css";

const PERKS = [
  { icon: "⭐", text: "Earn XP on every flight, hotel, and activity" },
  { icon: "🏅", text: "Unlock badges and level up your traveller rank" },
  { icon: "🏷️", text: "Redeem XP for real discounts on future bookings" },
  { icon: "📍", text: "Save trips and build your personal travel map" },
  { icon: "✈️", text: "Get personalised AI trip recommendations" },
];

// Fake preview stats — purely visual behind the blur
const PREVIEW_STATS = [
  { val: "2,840", label: "XP Earned" },
  { val: "12", label: "Trips Saved" },
  { val: "15%", label: "Discount" },
];

const PREVIEW_BADGES = ["🏖️", "🗼", "🏔️", "🌏", "✈️", "🎌"];

export default function PassportLockedPage() {
  const nav = useNavigate();

  return (
    <div className="plk-page">
      <div className="plk-inner">
        <div className="plk-hero">
          <h1 className="plk-title">Digital Passport</h1>
          <p className="plk-sub">
            Your travel identity — XP, badges, and exclusive rewards.
          </p>
        </div>

        <div className="plk-preview">
          {/* ── Blurred preview behind lock ── */}
          <div className="plk-blur" aria-hidden="true">
            <div className="plk-blur-topbar">
              <span className="plk-blur-name">Explorer's Passport</span>
              <span className="plk-blur-level">Level 7 ✦</span>
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
                  {b}
                </div>
              ))}
            </div>
          </div>

          {/* ── Hard lock overlay ── */}
          <div className="plk-overlay">
            <div className="plk-lock-icon">🔒</div>
            <h2 className="plk-lock-title">Your passport awaits</h2>
            <p className="plk-lock-sub">
              Create a free account to unlock your Digital Passport, earn XP on
              every booking, and access exclusive travel discounts.
            </p>

            <div className="plk-perks">
              {PERKS.map((p) => (
                <div key={p.text} className="plk-perk">
                  <span className="plk-perk-icon">{p.icon}</span>
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
  );
}