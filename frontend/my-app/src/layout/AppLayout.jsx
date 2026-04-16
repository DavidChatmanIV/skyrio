import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import AtlasChat from "../components/Atlas/AtlasChat";
import { useAtlasContext } from "../components/Atlas/AtlasContext";
import "../styles/AppLayout.css";
import "../styles/skyrio-theme.css";

function themeForPath(pathname) {
  if (pathname.startsWith("/booking")) return "sk-theme-book";
  if (pathname.startsWith("/passport")) return "sk-theme-passport";
  if (pathname.startsWith("/skyhub")) return "sk-theme-social";
  return "sk-theme-discover";
}

export default function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { atlasDestination } = useAtlasContext();
  const [scrolled, setScrolled] = useState(false);

  const isLanding = pathname === "/";
  const isSkyHub = pathname.startsWith("/skyhub");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const role = user?.role || "user";
  const isAdmin = role === "admin" || role === "manager";

  const authMeta = useMemo(
    () => ({
      isAuthenticated: !!user,
      displayName:
        user?.name ||
        user?.username ||
        (user?.email ? user.email.split("@")[0] : "Explorer"),
      isAdmin,
      role,
    }),
    [user, isAdmin, role]
  );

  const shellClass = [
    "osq-shell",
    !isLanding && themeForPath(pathname),
    isSkyHub && "osq-shell--skyhub",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <Navbar scrolled={scrolled} {...authMeta} />

      <main className={`osq-main ${isSkyHub ? "osq-main--flush" : ""}`}>
        <Outlet />
      </main>

      {!isSkyHub && (
        <footer className="osq-footer">
          © {new Date().getFullYear()} Skyrio
        </footer>
      )}

      {/* Atlas AI — global, floats on every page, destination-aware */}
      <AtlasChat destination={atlasDestination} />
    </div>
  );
}