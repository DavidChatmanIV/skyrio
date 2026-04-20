import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import AtlasChat from "../components/Atlas/AtlasChat";
import { useAtlasContext } from "../components/Atlas/AtlasContext";
import CookieBanner from "../components/CookieBanner";
import "../styles/AppLayout.css";
import "../styles/skyrio-theme.css";

function themeForPath(pathname) {
  if (pathname.startsWith("/booking")) return "sk-theme-book";
  if (pathname.startsWith("/passport")) return "sk-theme-passport";
  if (pathname.startsWith("/skyhub")) return "sk-theme-social";
  return "sk-theme-discover";
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const { atlasDestination } = useAtlasContext();

  const isLanding = pathname === "/";
  const isSkyHub = pathname.startsWith("/skyhub");

  const shellClass = [
    "osq-shell",
    !isLanding && themeForPath(pathname),
    isSkyHub && "osq-shell--skyhub",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <Navbar />
      <main className={`osq-main ${isSkyHub ? "osq-main--flush" : ""}`}>
        <Outlet />
      </main>
      {!isSkyHub && (
        <footer className="osq-footer">
          © {new Date().getFullYear()} Skyrio
        </footer>
      )}
      <AtlasChat destination={atlasDestination} />
      <CookieBanner />
    </div>
  );
}
