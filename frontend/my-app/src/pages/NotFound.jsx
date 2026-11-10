// ─────────────────────────────────────────────────────────────
// 404 — "We couldn't find that page"
//
// Skyrio-styled (purple glass, SVG icon, no emoji) with clear ways back.
// It also quietly tells you WHICH link was broken: the missing address and
// the page the person came from are sent once as a guest bug report, so it
// shows up in the admin dashboard under Feedback. No account or XP involved.
// ─────────────────────────────────────────────────────────────
import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "";

const CSS = `
.nf-wrap { min-height: calc(100vh - 140px); display: flex; align-items: center; justify-content: center; padding: 24px 16px 120px; }
.nf-card {
  position: relative; width: 100%; max-width: 440px; text-align: center; color: #fff;
  padding: 34px 26px 26px; border-radius: 22px; overflow: hidden;
  background: linear-gradient(160deg, rgba(74,40,112,.6) 0%, rgba(34,18,62,.7) 100%);
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 18px 44px rgba(12,4,28,.38);
  backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%);
}
.nf-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .nf-card { background: rgba(52,28,90,.96); }
}
.nf-icon { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 20px; display: flex;
  align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(135deg, #ff8a2a, #7c5cfc); box-shadow: 0 10px 26px rgba(124,92,252,.35); }
.nf-code { font-size: 12px; font-weight: 800; letter-spacing: .2em; color: #ffb347; }
.nf-title { margin: 6px 0 8px; font-size: 24px; font-weight: 800; line-height: 1.2; }
.nf-sub { margin: 0 0 22px; font-size: 14.5px; line-height: 1.55; color: rgba(255,255,255,.75); }
.nf-actions { display: grid; gap: 10px; }
.nf-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px;
  border-radius: 14px; font: inherit; font-size: 15px; font-weight: 800; text-decoration: none;
  cursor: pointer; border: 0; }
.nf-btn--main, .nf-btn--main:hover, .nf-btn--main:visited { color: #1a0e06 !important;
  background: linear-gradient(135deg, #ff8a2a, #ffb347); }
.nf-btn--alt, .nf-btn--alt:hover, .nf-btn--alt:visited { color: #fff !important;
  background: rgba(124,92,252,.22); border: 1px solid rgba(167,139,250,.45); }
.nf-back { margin-top: 14px; background: none; border: 0; color: rgba(255,255,255,.7);
  font: inherit; font-size: 13.5px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.nf-back:hover { color: #fff; }
.nf-btn:focus-visible, .nf-back:focus-visible { outline: 2px solid #ffb347; outline-offset: 3px; }
`;

function CompassIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

export default function NotFound() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const path = `${pathname}${search}`;

  // Report the broken link once per address per visit.
  useEffect(() => {
    const key = `skyrio_404_reported:${path}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: still report */
    }
    const from = document.referrer || "(typed or bookmarked)";
    // No Authorization header on purpose: this goes in as a guest report,
    // so it never awards XP.
    fetch(`${API}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bug",
        message: `Page not found: ${path}\nCame from: ${from}`,
        page: path.slice(0, 200),
      }),
    }).catch(() => {});
  }, [path]);

  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <div className="nf-wrap">
      <style>{CSS}</style>
      <div className="nf-card" role="main" aria-labelledby="nf-title">
        <div className="nf-icon">
          <CompassIcon />
        </div>
        <div className="nf-code">404</div>
        <h1 className="nf-title" id="nf-title">
          Page not found
        </h1>
        <p className="nf-sub">
          The link may be old or mistyped. We&apos;ve told our team.
        </p>
        <div className="nf-actions">
          <Link to="/" className="nf-btn nf-btn--main">
            Go home
          </Link>
          <Link to="/booking" className="nf-btn nf-btn--alt">
            Plan a trip
          </Link>
        </div>
        {canGoBack && (
          <button
            type="button"
            className="nf-back"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        )}
      </div>
    </div>
  );
}
