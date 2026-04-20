import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Space } from "antd";
import {
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import skyrioLogo from "@/assets/logo/skyrio-logo-transparent.png";
import "@/styles/Navbar.css";

const NAV_ITEMS = [
  { key: "discover", label: "Discover", path: "/" },
  { key: "book", label: "Book", path: "/booking" },
  { key: "skyhub", label: "SkyHub", path: "/skyhub" },
  { key: "passport", label: "Passport", path: "/passport" },
];

function getActiveKey(pathname) {
  if (pathname === "/" || pathname === "/home") return "discover";
  if (pathname.startsWith("/booking")) return "book";
  if (pathname.startsWith("/skyhub")) return "skyhub";
  if (pathname.startsWith("/passport")) return "passport";
  return "";
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthed, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileOpen(false);
  };

  return (
    <header className={`sk-navbar-wrap ${scrolled ? "is-scrolled" : ""}`}>
      <div className="sk-navbar-shell">
        <nav className="sk-navbar" ref={menuRef}>
          {/* ── BRAND ── */}
          <Link to="/" className="sk-brand" aria-label="Skyrio home">
            <img src={skyrioLogo} alt="Skyrio" className="sk-brand-img" />
            <span className="sk-brand-wordmark">Skyrio</span>
          </Link>

          {/* ── DESKTOP NAV LINKS ── */}
          <div className="sk-nav-links" role="navigation" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`sk-nav-link ${
                  activeKey === item.key ? "active" : ""
                }`}
                onClick={() => handleNavigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* ── DESKTOP ACTIONS ── */}
          <div className="sk-nav-actions">
            <div className="sk-nav-actions-desktop">
              {isAuthed ? (
                <Space size={8}>
                  <button
                    type="button"
                    className="sk-nav-user"
                    onClick={() => handleNavigate("/passport")}
                  >
                    <Avatar
                      size={32}
                      style={{
                        backgroundColor: "#7c5cfc",
                        fontSize: 13,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </Avatar>
                    <span className="sk-nav-username">{displayName}</span>
                  </button>
                  <Button
                    className="sk-btn sk-btn-logout"
                    icon={<LogoutOutlined />}
                    onClick={handleLogout}
                  >
                    Log out
                  </Button>
                </Space>
              ) : (
                <Space size={8}>
                  <Button
                    className="sk-btn sk-btn-ghost"
                    onClick={() => navigate("/login")}
                  >
                    Log in
                  </Button>
                  <Button
                    className="sk-btn sk-btn-primary"
                    onClick={() => navigate("/register")}
                  >
                    Sign up
                  </Button>
                </Space>
              )}
            </div>

            {/* ── MOBILE TRIGGER ── */}
            <button
              type="button"
              className="sk-mobile-trigger"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <CloseOutlined /> : <MenuOutlined />}
            </button>
          </div>

          {/* ── MOBILE MENU — pure CSS, no Drawer ── */}
          {mobileOpen && (
            <div className="sk-mobile-menu">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`sk-mobile-link ${
                    activeKey === item.key ? "active" : ""
                  }`}
                  onClick={() => handleNavigate(item.path)}
                >
                  {item.label}
                </button>
              ))}

              <div className="sk-mobile-actions">
                {isAuthed ? (
                  <>
                    <button
                      type="button"
                      className="sk-mobile-user"
                      onClick={() => handleNavigate("/passport")}
                    >
                      <Avatar
                        size={28}
                        style={{ backgroundColor: "#7c5cfc", fontSize: 12 }}
                      >
                        {initials}
                      </Avatar>
                      <span>{displayName}</span>
                    </button>
                    <Button
                      block
                      className="sk-btn sk-btn-logout"
                      icon={<LogoutOutlined />}
                      onClick={handleLogout}
                    >
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      block
                      className="sk-btn sk-btn-ghost"
                      icon={<UserOutlined />}
                      onClick={() => handleNavigate("/login")}
                    >
                      Log in
                    </Button>
                    <Button
                      block
                      className="sk-btn sk-btn-primary"
                      onClick={() => handleNavigate("/register")}
                    >
                      Sign up
                    </Button>
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
