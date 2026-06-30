import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AtlasPanel from "../components/Atlas/AtlasPanel";
import { useAtlasContext } from "../components/Atlas/AtlasContext";
import CookieBanner from "../components/CookieBanner";
import SkyrioDTour from "../components/SkyrioDTour";
import SupportWidget from "../pages/SupportWidget";
import heroBg from "@/assets/landing/skyrio-cosmic.jpg";
import bookingHeroImg from "@/assets/Booking/skyrio-hero.jpg";
import heroBeach from "@/assets/skyhub/beach.png";
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

  const isLanding = pathname === "/";
  const isSkyHub = pathname.startsWith("/skyhub");
  const isBooking = pathname.startsWith("/booking");

  const shellClass = [
    "osq-shell",
    !isLanding && themeForPath(pathname),
    isSkyHub && "osq-shell--skyhub",
    isLanding && "osq-shell--landing",
    isBooking && "osq-shell--book",
  ]
    .filter(Boolean)
    .join(" ");

  const shellHeroImg = isLanding
    ? heroBg
    : isBooking
    ? bookingHeroImg
    : isSkyHub
    ? heroBeach
    : null;

  return (
    <>
      <div
        className={shellClass}
        style={
          shellHeroImg ? { "--sk-hero-bg": `url(${shellHeroImg})` } : undefined
        }
      >
        <Navbar />

        <main className={`osq-main ${isSkyHub ? "osq-main--flush" : ""}`}>
          <Outlet />
        </main>

        {/* ── Footer — hidden on SkyHub only ── */}
        {!isSkyHub && <Footer />}

        <AtlasPanel />
        <CookieBanner />
      </div>

      {/* ── Outside shell so position:fixed works correctly on mobile ── */}
      <SkyrioDTour />
      <SupportWidget />
    </>
  );
}
