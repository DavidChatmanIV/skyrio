import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import skyrioLogo from "@/assets/logo/skyrio-logo-transparent.png";
import Notifications from "@/components/Notifications";
import "@/styles/Navbar.css";

/* ── Icons (stroke SVG — one family across the navbar) ─────────── */
function Svg({ size = 18, fill = "none", children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
const Icon = {
  // Discover — compass
  discover: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </Svg>
  ),
  // Book — boarding pass
  book: (p) => (
    <Svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" />
      <path d="M15 5v14" strokeDasharray="2 2.5" />
    </Svg>
  ),
  // SkyHub — postcard
  skyhub: (p) => (
    <Svg {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M13 8v8M15.5 8.5h3v3h-3zM5.5 10h5M5.5 13h5" />
    </Svg>
  ),
  // Passport — passport book
  passport: (p) => (
    <Svg {...p}>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 16.5h6" />
    </Svg>
  ),
  heart: ({ filled, ...p }) => (
    <Svg {...p} fill={filled ? "currentColor" : "none"}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </Svg>
  ),
  logout: (p) => (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Svg>
  ),
  settings: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  ),
  login: (p) => (
    <Svg {...p}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </Svg>
  ),
  chevron: (p) => (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  ),
};

const NAV_ITEMS = [
  { key: "discover", label: "Discover", path: "/", hint: "Plan a trip" },
  { key: "book", label: "Book", path: "/booking", hint: "Flights & stays" },
  { key: "skyhub", label: "SkyHub", path: "/skyhub", hint: "Traveler posts" },
  { key: "passport", label: "Passport", path: "/passport", hint: "XP & trips" },
];

function getActiveKey(pathname) {
  if (pathname === "/" || pathname === "/home") return "discover";
  if (pathname.startsWith("/booking")) return "book";
  if (pathname.startsWith("/skyhub")) return "skyhub";
  if (pathname.startsWith("/passport")) return "passport";
  if (pathname.startsWith("/saved-trips")) return "saved";
  return "";
}

// ── Admin email — only this account sees the admin link ──
// (The admin pages must still check the role on the server.)
const ADMIN_EMAIL = "skyrioofficial@gmail.com";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthed, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const activeKey = useMemo(
    () => getActiveKey(location.pathname),
    [location.pathname]
  );

  const displayName = useMemo(() => {
    if (!user) return null;
    return (
      user.name || user.username || user.email?.split("@")[0] || "Explorer"
    );
  }, [user]);

  const initials = useMemo(() => {
    if (!displayName) return "?";
    return displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [displayName]);

  // Rank from the user record (lifetime XP) — only shown when it's there
  const rank = user?.levelLabel || null;
  const avatarSrc =
    user?.avatar && user.avatar !== "/default-avatar.png"
      ? user.avatar
      : undefined;

  const isAdmin = isAuthed && user?.email === ADMIN_EMAIL;
  const isSaved = activeKey === "saved";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on outside tap / Escape; lock the page behind it
  useEffect(() => {
    if (!mobileOpen) return;
    const onDown = (e) => {
      // The notifications sheet opens on top of the page (outside the menu);
      // tapping inside it must not close the menu underneath.
      if (e.target.closest?.(".nf-panel, .nf-sheetScrim")) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape" && !document.querySelector(".nf-panel")) {
        setMobileOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileOpen(false);
  };

  const userAvatar = (size) => (
    <Avatar
      size={size}
      src={avatarSrc}
      className="sk-avatar"
      style={{ fontSize: Math.round(size * 0.4), fontWeight: 700 }}
    >
      {!avatarSrc ? initials : null}
    </Avatar>
  );

  return (
    <header className={`sk-navbar-wrap ${scrolled ? "is-scrolled" : ""}`}>
      {mobileOpen && <div className="sk-mobile-backdrop" aria-hidden="true" />}
      <div className="sk-navbar-shell">
        <nav className="sk-navbar" ref={menuRef} aria-label="Main">
          {/* ── BRAND ── */}
          <Link to="/" className="sk-brand" aria-label="Skyrio home">
            <img src={skyrioLogo} alt="" className="sk-brand-img" />
            <span className="sk-brand-wordmark">Skyrio</span>
          </Link>

          {/* ── DESKTOP NAV LINKS ── */}
          <div className="sk-nav-links">
            {NAV_ITEMS.map((item) => {
              const NavIcon = Icon[item.key];
              const active = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`sk-nav-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* ── DESKTOP ACTIONS ── */}
          <div className="sk-nav-actions">
            <div className="sk-nav-actions-desktop">
              {isAuthed ? (
                <div className="sk-authed-actions">
                  <Link
                    to="/saved-trips"
                    className={`sk-icon-btn ${isSaved ? "is-on" : ""}`}
                    aria-label="Saved trips"
                    aria-current={isSaved ? "page" : undefined}
                    title="Saved trips"
                  >
                    <Icon.heart size={19} filled={isSaved} />
                  </Link>

                  <Notifications />

                  <Link
                    to="/passport"
                    className="sk-nav-user"
                    title="My Passport"
                  >
                    {userAvatar(30)}
                    <span className="sk-nav-userText">
                      <span className="sk-nav-username">{displayName}</span>
                      {rank && <span className="sk-nav-rank">{rank}</span>}
                    </span>
                  </Link>

                  <button
                    type="button"
                    className="sk-icon-btn sk-logout-icon"
                    onClick={handleLogout}
                    aria-label="Log out"
                    title="Log out"
                  >
                    <Icon.logout size={18} />
                  </button>

                  {isAdmin && (
                    <Link
                      to="/admin/login"
                      className="sk-admin-btn"
                      title="Admin dashboard"
                    >
                      <Icon.settings size={13} /> Admin
                    </Link>
                  )}
                </div>
              ) : (
                <div className="sk-guest-actions">
                  <Link to="/login" className="sk-nav-cta is-ghost">
                    Log in
                  </Link>
                  <Link to="/register" className="sk-nav-cta">
                    Sign up free
                  </Link>
                </div>
              )}
            </div>

            {/* ── MOBILE TRIGGER ── */}
            <button
              ref={triggerRef}
              type="button"
              className={`sk-mobile-trigger ${mobileOpen ? "is-open" : ""}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="sk-mobile-menu"
            >
              <span className="sk-burger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>

          {/* ── MOBILE MENU ── */}
          {mobileOpen && (
            <div className="sk-mobile-menu" id="sk-mobile-menu">
              {isAuthed && (
                <Link to="/passport" className="sk-mobile-user">
                  {userAvatar(40)}
                  <span className="sk-mobile-userText">
                    <span className="sk-mobile-userName">{displayName}</span>
                    <span className="sk-mobile-userSub">
                      {rank ? `${rank} · ` : ""}View your Passport
                    </span>
                  </span>
                  <Icon.chevron size={18} />
                </Link>
              )}

              <div className="sk-mobile-grid">
                {NAV_ITEMS.map((item) => {
                  const NavIcon = Icon[item.key];
                  const active = activeKey === item.key;
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      className={`sk-mobile-tile ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <NavIcon size={20} />
                      <span className="sk-mobile-tileLabel">{item.label}</span>
                      <span className="sk-mobile-tileHint">{item.hint}</span>
                    </Link>
                  );
                })}
              </div>

              {isAuthed && (
                <div className="sk-mobile-list">
                  <Link
                    to="/saved-trips"
                    className={`sk-mobile-link ${isSaved ? "active" : ""}`}
                    aria-current={isSaved ? "page" : undefined}
                  >
                    <Icon.heart size={19} filled={isSaved} />
                    <span>Saved trips</span>
                  </Link>

                  {/* Opens the same notifications sheet as the desktop bell */}
                  <Notifications variant="menu" />

                  {isAdmin && (
                    <Link
                      to="/admin/login"
                      className="sk-mobile-link"
                      data-admin="true"
                    >
                      <Icon.settings size={18} />
                      <span>Admin dashboard</span>
                    </Link>
                  )}
                </div>
              )}

              <div className="sk-mobile-actions">
                {isAuthed ? (
                  <button
                    type="button"
                    className="sk-nav-cta is-ghost is-block"
                    onClick={handleLogout}
                  >
                    <Icon.logout size={17} /> Log out
                  </button>
                ) : (
                  <>
                    <Link to="/register" className="sk-nav-cta is-block">
                      Sign up free
                    </Link>
                    <Link to="/login" className="sk-nav-cta is-ghost is-block">
                      <Icon.login size={17} /> Log in
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
