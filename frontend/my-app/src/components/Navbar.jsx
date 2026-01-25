import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { Avatar, Dropdown, Button, Drawer, message } from "antd";
import { UserOutlined, LogoutOutlined, MenuOutlined } from "@ant-design/icons";

import "../styles/Navbar.css";
import logo from "../assets/logo/skyrio-logo-mark-512.png";

import { useAuth, useAuthModal } from "../auth/AuthModalController";

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

  const isAuthed = !!auth?.isAuthed;
  const isGuest = !!auth?.isGuest;

  const user =
    auth?.user ||
    (() => {
      try {
        const raw = localStorage.getItem("user");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const displayName = useMemo(() => {
    return (
      user?.name ||
      user?.username ||
      (user?.email ? user.email.split("@")[0] : "") ||
      (isGuest ? "Guest" : "")
    );
  }, [user, isGuest]);

  // ✅ Themes per route
  const navTheme = useMemo(() => {
    if (pathname.startsWith("/passport")) return "theme-passport";
    if (pathname.startsWith("/booking")) return "theme-book";
    if (pathname.startsWith("/skyhub")) return "theme-skyhub"; // ✅ renamed
    return "theme-discover";
  }, [pathname]);

  const activeKey = useMemo(() => {
    const match = navItems.find((i) =>
      i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)
    );
    return match?.to || "/";
  }, [pathname]);

  const go = (to) => {
    setDrawerOpen(false);
    navigate(to);
  };

  const handleLogout = () => {
    setDrawerOpen(false);

    if (auth?.logout) auth.logout();
    else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    message.success("See you next trip ✈️");
    navigate("/");
  };

  const avatarMenu = {
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        onClick: () => navigate("/dashboard"),
      },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Log out",
        onClick: handleLogout,
      },
    ],
  };

  /* =========================================================
     ✅ Auth pages
  ========================================================= */

  const goLogin = () => {
    setDrawerOpen(false);
    authModal?.closeAuthModal?.();
    navigate("/login", { state: { from: pathname } });
  };

  const goSignup = () => {
    setDrawerOpen(false);
    authModal?.closeAuthModal?.();
    navigate("/register", { state: { from: pathname } });
  };

  /* ✅ Guard Passport: if blocked, route to auth PAGE (not modal) */
  const guardPassport = (eOrTo) => {
    const to =
      typeof eOrTo === "string"
        ? eOrTo
        : eOrTo?.currentTarget?.getAttribute("href");

    const isPassport = to === "/passport";
    if (!isPassport) return false;

    if (!isAuthed || isGuest) {
      if (eOrTo?.preventDefault) eOrTo.preventDefault();
      setDrawerOpen(false);

      if (isGuest) goSignup();
      else goLogin();

      return true;
    }

    return false;
  };

  return (
    <header className={`sk-nav ${navTheme} ${scrolled ? "is-compact" : ""}`}>
      <div className="sk-nav-inner">
        {/* LEFT */}
        <div className="sk-left">
          <button
            className="sk-brand"
            onClick={() => go("/")}
            type="button"
            aria-label="Go to homepage"
          >
            <span className="sk-logoWrap" aria-hidden="true">
              <img
                src={logo}
                alt="Skyrio"
                className="sk-logoImg"
                draggable="false"
              />
            </span>
          </button>
        </div>

        {/* CENTER (desktop nav) */}
        <nav className="sk-centerNav" aria-label="Primary">
          <div className="sk-navPills">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={(e) => {
                  if (item.to === "/passport") guardPassport(e);
                }}
                className={({ isActive }) =>
                  `sk-link ${isActive ? "is-active" : ""}`
                }
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
              <Button className="sk-btnGhost" onClick={goLogin}>
                Log in
              </Button>
              <Button
                type="primary"
                className="sk-btnPrimary"
                onClick={goSignup}
              >
                Sign up
              </Button>
            </>
          ) : (
            <div className="sk-user">
              <span className="sk-hello">
                Hey, {displayName}
                {isGuest ? " ✨" : ""}
              </span>

              {isGuest ? (
                <Button
                  type="primary"
                  className="sk-btnPrimary"
                  onClick={goSignup}
                >
                  Upgrade
                </Button>
              ) : (
                <Dropdown
                  menu={avatarMenu}
                  placement="bottomRight"
                  trigger={["click"]}
                  overlayClassName="sk-dropdown"
                  getPopupContainer={(node) => node.parentElement}
                >
                  <button
                    className="sk-avatarBtn"
                    type="button"
                    aria-label="Account menu"
                  >
                    <Avatar
                      size={36}
                      src={user?.avatarUrl}
                      icon={!user?.avatarUrl ? <UserOutlined /> : null}
                    />
                  </button>
                </Dropdown>
              )}
            </div>
          )}

          {/* MOBILE MENU BUTTON */}
          <Button
            className="sk-mobileMenuBtn"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          />
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="right"
        className="sk-mobileDrawer"
        title={null}
      >
        <div className="sk-drawerTop">
          <img className="sk-drawerLogo" src={logo} alt="Skyrio" />
          <div className="sk-drawerHello">
            {isAuthed
              ? `Hey, ${displayName}${isGuest ? " ✨" : ""}`
              : "Welcome"}
          </div>
        </div>

        <div className="sk-drawerLinks">
          {navItems.map((item) => (
            <button
              key={item.to}
              className={`sk-drawerLink ${
                activeKey === item.to ? "is-active" : ""
              }`}
              onClick={() => {
                if (item.to === "/passport") {
                  const blocked = guardPassport(item.to);
                  if (!blocked) go(item.to);
                } else {
                  go(item.to);
                }
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="sk-drawerActions">
          {!isAuthed ? (
            <>
              <Button block className="sk-btnGhost" onClick={goLogin}>
                Log in
              </Button>
              <Button
                block
                type="primary"
                className="sk-btnPrimary"
                onClick={goSignup}
              >
                Sign up
              </Button>
            </>
          ) : isGuest ? (
            <>
              <Button
                block
                type="primary"
                className="sk-btnPrimary"
                onClick={goSignup}
              >
                Upgrade
              </Button>
              <div className="sk-guestNote">
                You’re browsing as Guest. Create an account to save trips and
                earn XP.
              </div>
            </>
          ) : (
            <Button
              danger
              block
              onClick={handleLogout}
              icon={<LogoutOutlined />}
            >
              Log out
            </Button>
          )}
        </div>
      </Drawer>
    </header>
  );
}