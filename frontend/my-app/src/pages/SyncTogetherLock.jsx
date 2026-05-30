/**
 * SyncTogetherLock.jsx
 * ─────────────────────
 * Login wall for Sync Together — shown to logged-out users.
 * Same two-column pattern as your PassportLocked page.
 *
 * INSTALL:
 *   1. Save to: src/pages/SyncTogetherLock.jsx
 *   2. In AppRoutes.jsx, update the sync-together route:
 *
 *      import SyncTogetherLock from "./pages/SyncTogetherLock";
 *
 *      // Replace the current sync-together route with:
 *      <Route path="sync-together" element={
 *        user ? <SyncTogether /> : <SyncTogetherLock />
 *      } />
 *
 *      // Get `user` from your auth context, e.g.:
 *      const { user } = useAuth();
 */

import { useNavigate } from "react-router-dom";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function LockIcon({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="18"
      height="18"
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

function MapIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M21 3l-7 7-4-4-7 7" />
      <path d="M3 21l7-7 4 4 7-7" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg
      width="18"
      height="18"
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

// ─── Features list ────────────────────────────────────────────────────────────
const FEATURES = [
  { Icon: UsersIcon, text: "Invite friends and family to your trip group" },
  { Icon: MapIcon, text: "Build a shared itinerary everyone can see and edit" },
  { Icon: ChatIcon, text: "Group chat to coordinate without leaving Skyrio" },
  { Icon: SplitIcon, text: "Split planning so no one person carries the load" },
  { Icon: PlaneIcon, text: "Book flights and hotels as a group in one place" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: "100vh",
    background: "#09071a",
    color: "#f0edff",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
  },
  inner: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    width: "100%",
    maxWidth: 900,
  },
  // Left card — lock + headline
  leftCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    minHeight: 320,
    position: "relative",
    overflow: "hidden",
  },
  leftGlow: {
    position: "absolute",
    top: "30%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: 260,
    height: 260,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(255,138,42,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  lockWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: "rgba(255,138,42,0.10)",
    border: "1px solid rgba(255,138,42,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ff8a2a",
    marginBottom: 24,
    position: "relative",
    zIndex: 1,
  },
  leftTitle: {
    fontSize: 28,
    fontWeight: 800,
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "-0.5px",
    color: "#f0edff",
    margin: "0 0 12px",
    position: "relative",
    zIndex: 1,
  },
  leftSub: {
    fontSize: 15,
    color: "rgba(240,237,255,0.5)",
    lineHeight: 1.6,
    maxWidth: 300,
    margin: 0,
    position: "relative",
    zIndex: 1,
  },

  // Right card — features + CTA
  rightCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "13px 16px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    color: "rgba(240,237,255,0.75)",
    fontSize: 14,
    lineHeight: 1.4,
  },
  featureIcon: {
    color: "#ff8a2a",
    flexShrink: 0,
  },
  cta: {
    width: "100%",
    padding: "16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
    color: "#1a0d04",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 4,
    boxShadow: "0 8px 24px rgba(255,138,42,0.35)",
    transition: "filter .2s, transform .2s",
  },
  signin: {
    textAlign: "center",
    fontSize: 14,
    color: "rgba(240,237,255,0.4)",
    marginTop: 4,
  },
  signinLink: {
    color: "#ff8a2a",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    marginLeft: 4,
  },
};

export default function SyncTogetherLock() {
  const navigate = useNavigate();

  return (
    <div style={s.root}>
      <div style={s.inner}>
        {/* ── Left: lock + headline ── */}
        <div style={s.leftCard}>
          <div style={s.leftGlow} />
          <div style={s.lockWrap}>
            <LockIcon size={36} />
          </div>
          <h2 style={s.leftTitle}>
            Plan your next
            <br />
            group trip together.
          </h2>
          <p style={s.leftSub}>
            Create a free account to start a group trip, invite your crew, and
            coordinate everything in one place.
          </p>
        </div>

        {/* ── Right: features + CTA ── */}
        <div style={s.rightCard}>
          {FEATURES.map(({ Icon, text }) => (
            <div key={text} style={s.featureRow}>
              <span style={s.featureIcon}>
                <Icon />
              </span>
              {text}
            </div>
          ))}

          <button
            style={s.cta}
            onClick={() => navigate("/register?next=/sync-together")}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.08)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Create a free account — it's free
          </button>

          <div style={s.signin}>
            Already a member?
            <span
              style={s.signinLink}
              onClick={() => navigate("/login?next=/sync-together")}
            >
              Sign in
            </span>
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 700px) {
          .stlock-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
