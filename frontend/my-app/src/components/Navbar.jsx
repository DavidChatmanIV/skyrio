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
  // Sync Together — a group of people
  sync: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.5 14.2A5 5 0 0 1 21 19" />
    </Svg>
  ),
  // My trips — suitcase
  trips: (p) => (
    <Svg {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </Svg>
  ),
  chevron: (p) => (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  ),
  chevronDown: (p) => (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  gift: (p) => (
    <Svg {...p}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </Svg>
  ),
};

const NAV_ITEMS = [
  { key: "discover", label: "Discover", path: "/", hint: "Plan a trip" },
  { key: "book", label: "Book", path: "/booking", hint: "Flights & stays" },
  { key: "skyhub", label: "SkyHub", path: "/skyhub", hint: "Traveler posts" },
  { key: "passport", label: "Passport", path: "/passport", hint: "XP & trips" },
];

// Desktop bar: the 4 main pages, Passport included so it's one click away.
// My trips, Rewards, Admin and Log out live in the profile menu.
const DESKTOP_NAV = NAV_ITEMS;

function getActiveKey(pathname) {
  if (pathname === "/" || pathname === "/home") return "discover";
  if (pathname.startsWith("/booking")) return "book";
  if (pathname.startsWith("/skyhub")) return "skyhub";
  if (pathname.startsWith("/passport")) return "passport";
  if (pathname.startsWith("/saved-trips")) return "saved";
  return "";
}

/* Sync Together isn't a main tab, but it's what sets Skyrio apart, so it
   gets its own standout button in the top bar and at the top of the
   phone menu. */
const SYNC_CSS = `
  .sk-sync-cta {
    display: inline-flex; align-items: center; gap: 7px;
    height: 36px; padding: 0 14px 0 11px; border-radius: 999px;
    font-size: 13.5px; font-weight: 700; white-space: nowrap;
    color: #fff; text-decoration: none;
    background: linear-gradient(135deg, rgba(255,138,42,0.22), rgba(124,92,252,0.30));
    border: 1px solid rgba(255,138,42,0.55);
    box-shadow: 0 0 0 0 rgba(255,138,42,0), 0 6px 18px rgba(124,92,252,0.22);
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    margin-right: 6px;
  }
  .sk-sync-cta:hover { color: #fff; border-color: #ff8a2a; transform: translateY(-1px);
    box-shadow: 0 0 0 3px rgba(255,138,42,0.18), 0 8px 22px rgba(124,92,252,0.32); }
  .sk-sync-cta:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .sk-sync-cta.is-on { background: linear-gradient(135deg, #ff8a2a, #7c5cfc); border-color: transparent; }
  .sk-sync-cta__new {
    font-size: 9.5px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase;
    padding: 2px 6px; border-radius: 999px; background: #ff8a2a; color: #1a0e06;
  }
  .sk-sync-cta.is-on .sk-sync-cta__new { background: #fff; }
  /* Icon and label always side by side. A broader rule in Navbar.css
     (links in the actions area) was turning this into a block, so the
     icon sat on top of the text. These selectors are more specific. */
  .sk-navbar .sk-nav-actions .sk-sync-cta {
    display: inline-flex !important; flex-direction: row !important;
    flex-wrap: nowrap !important; align-items: center !important;
    justify-content: center; line-height: 1; width: auto; min-width: 0;
  }
  .sk-navbar .sk-nav-actions .sk-sync-cta > svg {
    display: block; flex-shrink: 0; margin: 0;
  }
  .sk-navbar .sk-nav-actions .sk-sync-cta > span {
    display: inline-block; margin: 0; line-height: 1;
  }
  @media (max-width: 1024px) {
    .sk-navbar .sk-nav-actions .sk-sync-cta > .sk-sync-cta__label { display: none; }
  }
  /* Tablet widths: keep the button, drop the badge so the bar fits */
  @media (max-width: 1180px) { .sk-sync-cta__new { display: none; } }
  @media (max-width: 1024px) { .sk-sync-cta__label { display: none; } .sk-sync-cta { padding: 0 11px; } }

  /* Phone menu: My Trips is where you view and cancel bookings. Testers
     couldn't find it under the small heart at the bottom of the menu. */
  .sk-mobile-trips {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; margin: 0; border-radius: 14px;
    color: #fff; text-decoration: none;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  }
  .sk-mobile-trips.is-on { border-color: #ff8a2a; }
  /* Lifted above neighbors (tiles, menu decorations) so a tap always lands. */
  .sk-mobile-trips, .sk-mobile-sync {
    position: relative; z-index: 5; cursor: pointer;
    touch-action: manipulation; -webkit-tap-highlight-color: rgba(255,138,42,0.2);
  }
  .sk-mobile-trips:active, .sk-mobile-sync:active { transform: scale(0.99); }
  .sk-mobile-trips *, .sk-mobile-sync * { pointer-events: none; }
  .sk-mobile-trips__text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sk-mobile-trips__title { font-weight: 700; font-size: 14.5px; }
  .sk-mobile-trips__sub { font-size: 12px; color: rgba(255,255,255,0.6); }
  /* Desktop: a labeled "My Trips" button, so finding where to view or
     cancel a flight or hotel doesn't depend on spotting the heart icon. */
  .sk-trips-btn {
    display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 13px;
    border-radius: 999px; font-size: 13.5px; font-weight: 700; white-space: nowrap;
    color: #fff; text-decoration: none;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16);
    transition: border-color .15s, background .15s;
  }
  .sk-trips-btn:hover { color: #fff; border-color: #ff8a2a; background: rgba(255,138,42,0.10); }
  .sk-trips-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .sk-trips-btn.is-on { border-color: #ff8a2a; background: rgba(255,138,42,0.16); }
  @media (max-width: 1100px) { .sk-trips-btn__label { display: none; } .sk-trips-btn { padding: 0 10px; } }
  /* My booking uses the Sync Together pill (sk-sync-cta) so they match */
  /* Narrow screens: the phone menu has "Find my booking" instead */
  @media (max-width: 1100px) { .sk-navbar .sk-nav-actions .sk-sync-cta.sk-guest-trips { display: none !important; } }

  /* Profile menu: photo button → Passport, My Trips, Rewards, Admin, Log out */
  .sk-profile { position: relative; }
  .sk-profile-btn {
    display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 8px 0 4px;
    border-radius: 999px; cursor: pointer; color: rgba(255,255,255,0.75);
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    transition: border-color .15s, background .15s;
  }
  .sk-profile-btn:hover, .sk-profile-btn[aria-expanded="true"], .sk-profile-btn.is-on {
    border-color: #ff8a2a; background: rgba(255,138,42,0.12); color: #fff;
  }
  .sk-profile-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  /* First name beside the photo so it reads as the account button.
     Smaller laptops: photo + arrow only, to keep the bar on one line. */
  .sk-profile-name { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; font-weight: 700; color: #fff; }
  @media (max-width: 1240px) { .sk-profile-name { display: none; } }
  .sk-profile-menu {
    position: absolute; right: 0; top: calc(100% + 10px); z-index: 1200; width: 260px;
    padding: 8px; border-radius: 16px; box-sizing: border-box;
    background: rgba(22,14,44,0.97); border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  }
  .sk-profile-head { display: flex; align-items: center; gap: 10px; padding: 8px 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 6px; }
  .sk-profile-head b { display: block; color: #fff; font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sk-profile-head span { display: block; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ffb347; }
  .sk-profile-item {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px; border-radius: 10px;
    color: rgba(255,255,255,0.88); text-decoration: none; font: inherit; font-size: 14px; font-weight: 600;
    background: none; border: 0; cursor: pointer; text-align: left; box-sizing: border-box;
  }
  .sk-profile-item:hover, .sk-profile-item:focus-visible { background: rgba(255,255,255,0.07); color: #fff; outline: none; }
  .sk-profile-item svg { color: #ffb347; flex-shrink: 0; }
  .sk-profile-item small { display: block; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.5); }
  .sk-profile-item.is-out svg { color: rgba(255,255,255,0.6); }
  .sk-profile-sep { height: 1px; margin: 6px 4px; background: rgba(255,255,255,0.08); }

  .sk-mobile-sync {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; margin: 0; border-radius: 16px;
    color: #fff; text-decoration: none;
    background: linear-gradient(135deg, rgba(255,138,42,0.20), rgba(124,92,252,0.28));
    border: 1px solid rgba(255,138,42,0.5);
  }
  .sk-mobile-sync.is-on { border-color: #ff8a2a; }
  .sk-mobile-sync__icon {
    width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #ff8a2a, #7c5cfc);
  }
  .sk-mobile-sync__text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sk-mobile-sync__title { font-weight: 800; font-size: 15px; }
  .sk-mobile-sync__sub { font-size: 12.5px; color: rgba(255,255,255,0.65); }

  /* ── Phone menu (clean list) ── */
  .sk-m { gap: 8px !important; }
  .sk-m-user, .sk-m-sync {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px;
    color: #fff; text-decoration: none; touch-action: manipulation;
  }
  .sk-m-user { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); }
  .sk-m-sync { background: linear-gradient(135deg, rgba(255,138,42,0.18), rgba(124,92,252,0.24)); border: 1px solid rgba(255,138,42,0.45); }
  .sk-m-sync.is-on { border-color: #ff8a2a; }
  .sk-m-user > svg, .sk-m-sync > svg { color: rgba(255,255,255,0.55); flex-shrink: 0; }
  .sk-m-syncIcon { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #ff8a2a, #7c5cfc); }
  .sk-m-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sk-m-title { font-size: 15px; font-weight: 700; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sk-m-sub { font-size: 12.5px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sk-m-list { display: flex; flex-direction: column; padding: 4px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
  .sk-m-row, .sk-m-list .nf-root .nf-menuRow {
    display: flex !important; align-items: center; gap: 12px; min-height: 46px !important; padding: 0 12px !important;
    border-radius: 10px !important; border: 0 !important; background: none !important;
    color: rgba(255,255,255,0.88) !important; text-decoration: none; font-size: 15px; font-weight: 600;
    touch-action: manipulation; width: 100%; box-sizing: border-box;
  }
  .sk-m-row svg, .sk-m-list .nf-root .nf-menuRow svg { color: #ffb347; flex-shrink: 0; }
  .sk-m-row:active { background: rgba(255,255,255,0.08) !important; }
  .sk-m-row.is-on { color: #fff !important; background: rgba(255,138,42,0.16) !important; box-shadow: inset 3px 0 0 #ff8a2a; }
  .sk-m-actions { padding-top: 4px; display: flex; flex-direction: column; gap: 8px; }
  .sk-m-logout {
    display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 46px;
    border-radius: 12px; cursor: pointer; font: inherit; font-size: 15px; font-weight: 700;
    color: rgba(255,255,255,0.85); background: transparent; border: 1px solid rgba(255,255,255,0.18);
  }
  .sk-m-logout:active { background: rgba(255,255,255,0.06); }
  @media (max-width: 360px) {
    .sk-m-row, .sk-m-list .nf-root .nf-menuRow { min-height: 42px !important; font-size: 14px; }
    .sk-m-title { font-size: 14px; }
  }

  /* The menu rows are width:100% plus padding; without border-box the
     user card and rows stuck out past the menu's right edge on phones. */
  .sk-mobile-menu, .sk-mobile-menu * { box-sizing: border-box; }
  .sk-mobile-menu > * { max-width: 100%; min-width: 0; }

  /* Never wider than the screen: on the Galaxy Fold cover screen the bar
     ran past the right edge and the menu button was cut off. The logo
     side may shrink (wordmark trims with "…"); the menu button never does. */
  .sk-navbar-shell { max-width: min(var(--sk-nav-max, 1240px), 100%); }
  .sk-navbar { max-width: 100%; min-width: 0; box-sizing: border-box; }
  .sk-brand { min-width: 0; overflow: hidden; }
  .sk-brand-wordmark { overflow: hidden; text-overflow: ellipsis; }
  .sk-mobile-trigger { flex-shrink: 0; }
  @media (max-width: 991px) {
    .sk-navbar { grid-template-columns: minmax(0, 1fr) auto !important; }
  }

  /* Narrow phones (Galaxy Fold cover screen ~280–344px, iPhone SE 320px) */
  @media (max-width: 360px) {
    .sk-navbar-wrap { padding-left: 8px !important; padding-right: 8px !important; }
    .sk-mobile-menu { padding: 10px; gap: 8px; }
    .sk-mobile-user { padding: 8px 10px 8px 8px; min-height: 52px; gap: 10px; }
    .sk-mobile-sync, .sk-mobile-trips { padding: 10px 12px; gap: 10px; }
    .sk-mobile-sync__icon { width: 34px; height: 34px; border-radius: 10px; }
    .sk-mobile-sync__title, .sk-mobile-trips__title { font-size: 14px; }
    .sk-mobile-sync__sub, .sk-mobile-trips__sub { font-size: 11.5px; }
    .sk-mobile-grid { gap: 6px; }
    .sk-mobile-tile { min-height: 64px; padding: 10px 12px; }
    .sk-mobile-tile svg { margin-bottom: 4px; }
    .sk-mobile-tileLabel { font-size: 14px; }
    .sk-brand-wordmark { font-size: 1rem; }
  }
`;

// ── Admin email — only this account sees the admin link ──
// (The admin pages must still check the role on the server.)
const ADMIN_EMAIL = "skyrioofficial@gmail.com";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthed, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
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

  const firstName = (displayName || "").trim().split(/\s+/)[0] || "Account";

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
  const isSync = location.pathname.startsWith("/sync-together");

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
    setProfileOpen(false);
  }, [location.pathname]);

  // Profile menu: close on outside click or Escape
  useEffect(() => {
    if (!profileOpen) return undefined;
    const onDown = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setProfileOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setProfileOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  // Phone menu cards: always close the menu and go. (Tapping My trips while
  // already on My trips used to leave the menu open, so nothing seemed to
  // happen.)
  const goFromMenu = (e, to) => {
    e.preventDefault();
    setMobileOpen(false);
    if (location.pathname !== to) navigate(to);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileOpen(false);
    setProfileOpen(false);
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
      <style>{SYNC_CSS}</style>
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
            {DESKTOP_NAV.map((item) => {
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
              <Link
                to="/sync-together"
                className={`sk-sync-cta${isSync ? " is-on" : ""}`}
                aria-current={isSync ? "page" : undefined}
                aria-label="Sync Together: plan a group trip"
                title="Plan a group trip — everyone pays their own share"
              >
                <Icon.sync size={17} />
                <span className="sk-sync-cta__label">Sync Together</span>
              </Link>
              {isAuthed ? (
                <div className="sk-authed-actions">
                  <Notifications />

                  {/* Profile menu: personal pages + log out */}
                  <div className="sk-profile" ref={profileRef}>
                    <button
                      type="button"
                      className={`sk-profile-btn${isSaved ? " is-on" : ""}`}
                      onClick={() => setProfileOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={profileOpen}
                      aria-label={`Account menu for ${displayName}: trips, rewards and log out`}
                      title="Your account, trips and log out"
                    >
                      {userAvatar(32)}
                      <span className="sk-profile-name">{firstName}</span>
                      <Icon.chevronDown size={15} />
                    </button>
                    {profileOpen && (
                      <div className="sk-profile-menu" role="menu">
                        <div className="sk-profile-head">
                          {userAvatar(36)}
                          <div style={{ minWidth: 0 }}>
                            <b>{displayName}</b>
                            {rank && <span>{rank}</span>}
                          </div>
                        </div>
                        <Link
                          to="/passport"
                          className="sk-profile-item"
                          role="menuitem"
                        >
                          <Icon.passport size={18} />
                          <span>
                            Passport
                            <small>XP, stamps and your profile</small>
                          </span>
                        </Link>
                        <Link
                          to="/saved-trips"
                          className="sk-profile-item"
                          role="menuitem"
                        >
                          <Icon.trips size={18} />
                          <span>
                            My Trips
                            <small>View or cancel a booking</small>
                          </span>
                        </Link>
                        <Link
                          to="/passport/rewards"
                          className="sk-profile-item"
                          role="menuitem"
                        >
                          <Icon.gift size={18} />
                          <span>Passport Rewards</span>
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin/login"
                            className="sk-profile-item"
                            role="menuitem"
                          >
                            <Icon.settings size={18} />
                            <span>Admin dashboard</span>
                          </Link>
                        )}
                        <div className="sk-profile-sep" />
                        <button
                          type="button"
                          className="sk-profile-item is-out"
                          role="menuitem"
                          onClick={handleLogout}
                        >
                          <Icon.logout size={18} />
                          <span>Log out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="sk-guest-actions">
                  <Link
                    to="/find-booking"
                    className={`sk-sync-cta sk-guest-trips${
                      location.pathname.startsWith("/find-booking")
                        ? " is-on"
                        : ""
                    }`}
                    aria-current={
                      location.pathname.startsWith("/find-booking")
                        ? "page"
                        : undefined
                    }
                    title="Booked without an account? View or cancel it here."
                  >
                    <Icon.trips size={17} />
                    <span className="sk-sync-cta__label">My booking</span>
                  </Link>
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

          {/* ── MOBILE MENU ──
              One clean list: you, Sync Together, the pages, then
              notifications/admin, then log out. Same row style throughout. */}
          {mobileOpen && (
            <div className="sk-mobile-menu sk-m" id="sk-mobile-menu">
              {isAuthed && (
                <Link
                  to="/passport"
                  className="sk-m-user"
                  onClick={(e) => goFromMenu(e, "/passport")}
                >
                  {userAvatar(40)}
                  <span className="sk-m-text">
                    <span className="sk-m-title">{displayName}</span>
                    <span className="sk-m-sub">
                      {rank ? `${rank} · ` : ""}View your Passport
                    </span>
                  </span>
                  <Icon.chevron size={18} />
                </Link>
              )}

              <Link
                to="/sync-together"
                className={`sk-m-sync${isSync ? " is-on" : ""}`}
                aria-current={isSync ? "page" : undefined}
                onClick={(e) => goFromMenu(e, "/sync-together")}
              >
                <span className="sk-m-syncIcon">
                  <Icon.sync size={19} />
                </span>
                <span className="sk-m-text">
                  <span className="sk-m-title">Sync Together</span>
                  <span className="sk-m-sub">Plan a group trip</span>
                </span>
                <Icon.chevron size={18} />
              </Link>

              <div className="sk-m-list">
                {[
                  ...NAV_ITEMS.map((item) => ({
                    key: item.key,
                    to: item.path,
                    label: item.label,
                    NavIcon: Icon[item.key],
                    active: activeKey === item.key,
                  })),
                  {
                    key: "trips",
                    to: isAuthed ? "/saved-trips" : "/find-booking",
                    label: isAuthed ? "My Trips" : "Find my booking",
                    NavIcon: Icon.trips,
                    active: isSaved,
                  },
                ].map(({ key, to, label, NavIcon, active }) => (
                  <Link
                    key={key}
                    to={to}
                    className={`sk-m-row${active ? " is-on" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => goFromMenu(e, to)}
                  >
                    <NavIcon size={19} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>

              {isAuthed && (
                <div className="sk-m-list sk-m-list--minor">
                  {/* Opens the same notifications sheet as the desktop bell */}
                  <Notifications variant="menu" />
                  {isAdmin && (
                    <Link
                      to="/admin/login"
                      className="sk-m-row"
                      onClick={(e) => goFromMenu(e, "/admin/login")}
                    >
                      <Icon.settings size={19} />
                      <span>Admin dashboard</span>
                    </Link>
                  )}
                </div>
              )}

              <div className="sk-m-actions">
                {isAuthed ? (
                  <button
                    type="button"
                    className="sk-m-logout"
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
