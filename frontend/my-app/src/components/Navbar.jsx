import React, { useEffect, useMemo, useState } from "react";
import { Button, Drawer, Grid, Space } from "antd";
import { MenuOutlined, RocketOutlined, UserOutlined } from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
          <div className="sk-navbar">
            <div className="sk-navbar-left">
              <Link to="/" className="sk-brand" aria-label="Skyrio home">
                <div className="sk-brand-mark">
                  <RocketOutlined />
                </div>

                <div className="sk-brand-copy">
                  <span className="sk-brand-name">Skyrio</span>
                  <span className="sk-brand-tag">Plan smarter</span>
                </div>
              </Link>
            </div>

            {screens.md && (
              <nav className="sk-navbar-center" aria-label="Primary">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeKey === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`sk-nav-pill ${isActive ? "active" : ""}`}
                      onClick={() => handleNavigate(item.path)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="sk-navbar-right">
              {screens.md ? (
                <Space size={12}>
                  <Button
                    className="sk-btn sk-btn-ghost"
                    shape="round"
                    onClick={() => navigate("/login")}
                  >
                    Log in
                  </Button>

                  <Button
                    className="sk-btn sk-btn-primary"
                    shape="round"
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
          </div>
        </div>
      </header>

      <Drawer
        title={
          <div className="sk-mobile-drawer-title">
            <div className="sk-brand-mark small">
              <RocketOutlined />
            </div>
            <span>Skyrio</span>
          </div>
        }
        placement="right"
        closable
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        className="sk-mobile-drawer"
      >
        <div className="sk-mobile-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = activeKey === item.key;

            return (
              <button
                key={item.key}
                type="button"
                className={`sk-mobile-link ${isActive ? "active" : ""}`}
                onClick={() => handleNavigate(item.path)}
              >
                {item.label}
              </button>
            );
          })}

          <div className="sk-mobile-actions">
            <Button
              block
              className="sk-btn sk-btn-ghost"
              shape="round"
              icon={<UserOutlined />}
              onClick={() => handleNavigate("/login")}
            >
              Log in
            </Button>

            <Button
              block
              className="sk-btn sk-btn-primary"
              shape="round"
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