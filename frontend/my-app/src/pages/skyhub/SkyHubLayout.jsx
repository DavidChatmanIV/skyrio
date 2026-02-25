import React from "react";
import { Outlet } from "react-router-dom";

import "@/styles/skyhub.css";
import "@/styles/SkyHubLayout.css";

import LeftRail from "./LeftRail";
import RightRail from "./RightRail";

import beachBg from "../../assets/skyhub/beach.png";

export default function SkyHubLayout() {
  return (
    <div
      className="skyhub-page"
      style={{
        "--skyhub-bg": `url(${beachBg})`,
        "--skyhub-top": "var(--nav-h)",
      }}
    >
      <div className="skyhub-shell">
        <aside className="skyhub-left">
          <LeftRail />
        </aside>

        <main className="skyhub-main">
          <Outlet />
        </main>

        <aside className="skyhub-right">
          <RightRail />
        </aside>
      </div>
    </div>
  );
}
