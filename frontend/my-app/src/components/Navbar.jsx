import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Badge, Button, Space } from "antd";
import {
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
  CloseOutlined,
  BellOutlined,
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
  if (pathname.startsWith("/saved-trips")) return "saved";
  return "";
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthed, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // ── Fetch unread notification count every 60s ──
  useEffect(() => {
    if (!isAuthed) return;
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${
            import.meta.env.VITE_API_URL || ""
          }/api/notifications?unread=true&limit=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }
        );
        const data = await res.json();
        setUnreadCount(data?.unreadCount ?? data?.total ?? 0);
      } catch {
        /* ignore */
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [isAuthed]);

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
                  {/* ── Saved Trips heart icon ── */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/saved-trips")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      position: "relative",
                      padding: "4px 8px",
                      fontSize: 18,
                      lineHeight: 1,
                      color:
                        activeKey === "saved"
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.7)",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#ff8a2a")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        activeKey === "saved"
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.7)")
                    }
                    title="Saved Trips"
                  >
                    ❤️
                  </button>

                  {/* ── Notifications bell ── */}
                  <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/passport")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 8px",
                        fontSize: 18,
                        lineHeight: 1,
                        color: "rgba(255,255,255,0.7)",
                        transition: "color 0.2s",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#ff8a2a")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "rgba(255,255,255,0.7)")
                      }
                      title="Notifications"
                    >
                      <BellOutlined />
                    </button>
                  </Badge>

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

          {/* ── MOBILE MENU ── */}
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

              {/* Saved Trips in mobile menu */}
              {isAuthed && (
                <button
                  type="button"
                  className={`sk-mobile-link ${
                    activeKey === "saved" ? "active" : ""
                  }`}
                  onClick={() => handleNavigate("/saved-trips")}
                >
                  ❤️ Saved Trips
                </button>
              )}

              {isAuthed && (
                <button
                  type="button"
                  className="sk-mobile-link"
                  onClick={() => handleNavigate("/passport")}
                >
                  🔔 Notifications{" "}
                  {unreadCount > 0 && (
                    <span
                      style={{
                        background: "#ff4d6d",
                        color: "#fff",
                        borderRadius: 99,
                        fontSize: 10,
                        padding: "1px 6px",
                        marginLeft: 6,
                        fontWeight: 700,
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}

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
                      onClick={() => navigate("/register")}
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
