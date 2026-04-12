import React, { useEffect, useMemo, useState } from "react";
import { Button, Drawer, Grid, Space } from "antd";
import { MenuOutlined, UserOutlined } from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import skyrioLogo from "@/assets/logo/skyrio-logo-transparent.png";
import "@/styles/Navbar.css";

const { useBreakpoint } = Grid;

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
  return "discover";
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const activeKey = useMemo(
    () => getActiveKey(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      <header className={`sk-navbar-wrap ${scrolled ? "is-scrolled" : ""}`}>
        <div className="sk-navbar-shell">
          <nav className="sk-navbar">
            {/* ── COL 1: BRAND ── */}
            <Link to="/" className="sk-brand" aria-label="Skyrio home">
              <img src={skyrioLogo} alt="Skyrio" className="sk-brand-img" />
              <span className="sk-brand-wordmark">Skyrio</span>
            </Link>

            {/* ── COL 2: NAV LINKS (centered) ── */}
            {screens.md && (
              <div
                className="sk-nav-links"
                role="navigation"
                aria-label="Primary"
              >
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
            )}

            {/* ── COL 3: ACTIONS ── */}
            <div className="sk-nav-actions">
              {screens.md ? (
                <Space size={8}>
                  <Button
                    className="sk-btn sk-btn-ghost"
                    onClick={() => navigate("/login")}
                  >
                    Log in
                  </Button>
                  <Button
                    className="sk-btn sk-btn-primary"
                    onClick={() => navigate("/signup")}
                  >
                    Sign up
                  </Button>
                </Space>
              ) : (
                <Button
                  className="sk-mobile-trigger"
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open navigation menu"
                />
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      <Drawer
        title={
          <div className="sk-drawer-header">
            <img src={skyrioLogo} alt="Skyrio" className="sk-drawer-logo" />
            <span className="sk-drawer-name">Skyrio</span>
          </div>
        }
        placement="right"
        closable
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        className="sk-mobile-drawer"
        width={280}
      >
        <div className="sk-mobile-nav">
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
              onClick={() => handleNavigate("/signup")}
            >
              Sign up
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}