import React from "react";
import { Outlet, NavLink } from "react-router-dom";

import "@/styles/skyhub.css";
import "@/styles/SkyHubLayout.css";
import "@/styles/LeftRail.css";
import "@/styles/SkyHubFeed.css";
import "@/styles/PostCard.css";

import beachBg from "@/assets/skyhub/beach.png";
import LeftRail from "./LeftRail";

export default function SkyHubLayout() {
  return (
    <div className="skyhub-page" style={{ "--skyhub-bg": `url(${beachBg})` }}>
      <div className="skyhub-shell">
        {/* LEFT */}
        <aside className="skyhub-left">
          <div className="skyhub-leftCol">
            <LeftRail />
          </div>
        </aside>

        {/* CENTER */}
        <main className="skyhub-main">
          <div className="skyhub-topbar">
            <div className="skyhub-topTitle">
              <span className="skyhub-cloud">☁️</span>
              <span className="skyhub-title">SkyHub</span>
            </div>

            {/* ORANGE PILL TABS */}
            <div className="skyhub-tabs">
              <NavLink
                to="/skyhub/moments"
                className={({ isActive }) =>
                  `skyhub-tab ${isActive ? "is-active" : ""}`
                }
              >
                Moments
              </NavLink>

              <NavLink
                to="/skyhub/insights"
                className={({ isActive }) =>
                  `skyhub-tab ${isActive ? "is-active" : ""}`
                }
              >
                Insights
              </NavLink>
            </div>
          </div>

          <div className="skyhub-content">
            <Outlet />
          </div>
        </main>

        {/* RIGHT spacer (like mock negative space) */}
        <aside className="skyhub-right" />
      </div>
    </div>
  );
}