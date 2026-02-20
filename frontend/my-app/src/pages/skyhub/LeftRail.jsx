import React from "react";
import { NavLink } from "react-router-dom";

export default function LeftRail() {
  return (
    <>
      <div className="skyhub-brand">
        <div className="skyhub-brandLogo">☁️</div>
        <div>
          <div className="skyhub-brandName">SkyHub</div>
          <div className="skyhub-brandSub">Where travel stories live</div>
        </div>
      </div>

      <nav className="skyhub-nav">
        <NavLink
          to="/skyhub/moments"
          className={({ isActive }) =>
            `skyhub-navItem ${isActive ? "is-active" : ""}`
          }
        >
          <span className="skyhub-navIcon">🏠</span>
          <span className="skyhub-navLabel">Home</span>
        </NavLink>

        <NavLink
          to="/skyhub/dm"
          className={({ isActive }) =>
            `skyhub-navItem ${isActive ? "is-active" : ""}`
          }
        >
          <span className="skyhub-navIcon">💬</span>
          <span className="skyhub-navLabel">DMs</span>
        </NavLink>

        <NavLink
          to="/skyhub/circles"
          className={({ isActive }) =>
            `skyhub-navItem ${isActive ? "is-active" : ""}`
          }
        >
          <span className="skyhub-navIcon">🧑‍🤝‍🧑</span>
          <span className="skyhub-navLabel">Circles</span>
        </NavLink>

        <NavLink
          to="/passport"
          className={({ isActive }) =>
            `skyhub-navItem ${isActive ? "is-active" : ""}`
          }
        >
          <span className="skyhub-navIcon">🪪</span>
          <span className="skyhub-navLabel">Passport</span>
          <span className="skyhub-navCaret">›</span>
        </NavLink>

        <NavLink
          to="/skyhub/saved"
          className={({ isActive }) =>
            `skyhub-navItem ${isActive ? "is-active" : ""}`
          }
        >
          <span className="skyhub-navIcon">💾</span>
          <span className="skyhub-navLabel">Saved</span>
        </NavLink>
      </nav>
    </>
  );
}