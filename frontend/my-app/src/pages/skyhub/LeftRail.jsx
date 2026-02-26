import React from "react";
import { NavLink } from "react-router-dom";

export default function LeftRail() {
  return (
    <div className="leftRail glassCard">
      <img src="/avatar.jpg" alt="Profile" />

      <h3 className="leftRail-name">user</h3>
      <p className="leftRail-meta">XP Level 1</p>

      <nav className="leftRail-nav">
        {/* ✅ NEW: Home / Discover */}
        <NavLink
          to="/"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <button type="button">Home</button>
        </NavLink>

        <NavLink
          to="/skyhub/moments"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <button type="button">Moments</button>
        </NavLink>

        <NavLink
          to="/skyhub/circles"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <button type="button">Circles</button>
        </NavLink>

        <NavLink
          to="/skyhub/dms"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <button type="button">DMs</button>
        </NavLink>

        <NavLink
          to="/skyhub/insights"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <button type="button">Insights</button>
        </NavLink>

        <NavLink
          to="/skyhub/saved"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <button type="button">Saved</button>
        </NavLink>
      </nav>
    </div>
  );
}
