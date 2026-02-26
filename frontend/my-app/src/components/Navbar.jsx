import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";
import {
  Avatar,
  Dropdown,
  Button,
  Drawer,
  message,
  Modal,
  Typography,
  Space,
} from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";

import "../styles/Navbar.css";
import logo from "../assets/logo/skyrio-logo-mark-512.png";

import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/useAuthModal";

const { Title, Text } = Typography;

const navItems = [
  { label: "Discover", to: "/" },
  { label: "Book", to: "/booking" },
  { label: "SkyHub", to: "/skyhub" },
  { label: "Passport", to: "/passport" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const auth = useAuth();
  const authModal = useAuthModal();

  const isAuthed = auth?.isAuthed;
  const user = auth?.user;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Gate Exit modal
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutAnimating, setLogoutAnimating] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navTheme = useMemo(() => {
    if (pathname.startsWith("/passport")) return "theme-passport";
    if (pathname.startsWith("/booking")) return "theme-book";
    if (pathname.startsWith("/skyhub")) return "theme-skyhub";
    return "theme-discover";
  }, [pathname]);

  const go = (to) => {
    setDrawerOpen(false);
    navigate(to);
  };

  const handleLogout = () => {
    setDrawerOpen(false);
    auth?.logout?.();
    message.success("See you next trip ✈️");
    navigate("/");
  };

  const openLogoutGate = () => {
    setDrawerOpen(false);
    setLogoutOpen(true);
  };

  const confirmGateExit = () => {
    if (logoutAnimating) return;

    setLogoutAnimating(true);

    if (typeof document !== "undefined") {
      document.body.classList.add("sk-gate-exit");
    }

    window.setTimeout(() => {
      document?.body?.classList?.remove("sk-gate-exit");

      setLogoutOpen(false);
      setLogoutAnimating(false);

      handleLogout();
    }, 900);
  };

  const cancelGateExit = () => {
    if (logoutAnimating) return;
    setLogoutOpen(false);
  };

  const openAuth = (mode) => {
    setDrawerOpen(false);

    const fn =
      authModal?.openAuthModal ||
      authModal?.open ||
      authModal?.show ||
      authModal?.setOpen;

    if (typeof fn === "function") {
      try {
        fn({ mode });
        return;
      } catch {
        // fallthrough
      }
    }

    navigate(mode === "signup" ? "/signup" : "/login");
  };

  return (
    <>
      <header className={`sk-nav ${navTheme} ${scrolled ? "is-compact" : ""}`}>
        <div className="sk-nav-inner">
          {/* LEFT */}
          <div className="sk-left">
            <button
              className="sk-brand"
              onClick={() => go("/")}
              aria-label="Skyrio Home"
              type="button"
            >
              <span className="sk-brandMark" aria-hidden="true">
                <span className="sk-logoWrap">
                  <img src={logo} alt="Skyrio" className="sk-logoImg" />
                </span>
              </span>

              <span className="sk-brandText">
                <span className="sk-brandName">Skyrio</span>
                <span className="sk-brandTag">Plan smarter</span>
              </span>
            </button>
          </div>

          {/* CENTER */}
          <nav className="sk-centerNav" aria-label="Primary navigation">
            <div className="sk-navPills" role="list">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sk-link ${isActive ? "is-active" : ""}`
                  }
                  role="listitem"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* RIGHT */}
          <div className="sk-right">
            {!isAuthed ? (
              <>
                <Button
                  className="sk-btnGhost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openAuth("login");
                  }}
                >
                  Log in
                </Button>

                <Button
                  type="primary"
                  className="sk-btnPrimary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openAuth("signup");
                  }}
                >
                  Sign up
                </Button>
              </>
            ) : (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "logout",
                      icon: <LogoutOutlined />,
                      label: "Log out",
                      onClick: openLogoutGate,
                    },
                  ],
                }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <button
                  type="button"
                  className="sk-avatarBtn"
                  aria-label="Account menu"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Avatar
                    size={36}
                    icon={<UserOutlined />}
                    src={user?.avatarUrl}
                  />
                </button>
              </Dropdown>
            )}

            <Button
              className="sk-mobileMenuBtn"
              icon={<MenuOutlined />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDrawerOpen(true);
              }}
              aria-label="Open menu"
            />
          </div>
        </div>

        {/* Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Menu"
          placement="right"
        >
          <div style={{ display: "grid", gap: 10 }}>
            {navItems.map((item) => (
              <Button key={item.to} block onClick={() => go(item.to)}>
                {item.label}
              </Button>
            ))}

            {!isAuthed ? (
              <>
                <Button
                  className="sk-btnGhost"
                  onClick={() => openAuth("login")}
                  block
                >
                  Log in
                </Button>
                <Button
                  type="primary"
                  className="sk-btnPrimary"
                  onClick={() => openAuth("signup")}
                  block
                >
                  Sign up
                </Button>
              </>
            ) : (
              <Button
                className="sk-btnGhost"
                icon={<LogoutOutlined />}
                onClick={openLogoutGate}
                block
              >
                Log out
              </Button>
            )}
          </div>
        </Drawer>
      </header>

      {/* Gate Exit Modal */}
      <Modal
        open={logoutOpen}
        onCancel={cancelGateExit}
        footer={null}
        centered
        width={520}
        closable={!logoutAnimating}
        maskClosable={!logoutAnimating}
        className="sk-exitModal"
      >
        <div className="sk-exitWrap">
          <div className="sk-exitTop">
            <div className="sk-exitBadge">
              <span className="sk-dot" />
              Gate Exit
            </div>

            <Title level={3} className="sk-exitTitle">
              Leaving Skyrio?
            </Title>

            <Text className="sk-exitSub">
              You’ll be signed out and returned to guest mode.
            </Text>
          </div>

          <div className="sk-exitActions">
            <Space>
              <Button
                className="sk-btn sk-btn-ghost"
                onClick={cancelGateExit}
                disabled={logoutAnimating}
              >
                Stay
              </Button>

              <Button
                className="sk-btn sk-btn-cta"
                onClick={confirmGateExit}
                loading={logoutAnimating}
                icon={<LogoutOutlined />}
              >
                Exit &amp; Log out <ArrowRightOutlined />
              </Button>
            </Space>

            <div className="sk-exitHint">
              Tip: you can log back in anytime from the top right.
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
