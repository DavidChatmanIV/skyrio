import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  MessageOutlined,
  TeamOutlined,
  IdcardOutlined,
  BookOutlined,
} from "@ant-design/icons";

const items = [
  { key: "home", label: "Home", to: "/", icon: <HomeOutlined /> },
  { key: "dms", label: "DMs", to: "/dm", icon: <MessageOutlined /> },
  { key: "circles", label: "Circles", to: "/circles", icon: <TeamOutlined /> },
  {
    key: "passport",
    label: "Passport",
    to: "/passport",
    icon: <IdcardOutlined />,
  },
  { key: "saved", label: "Saved", to: "/saved", icon: <BookOutlined /> },
];

export default function LeftRail() {
  const { pathname } = useLocation();

  return (
    <aside className="sh-leftRail">
      <div className="sh-leftTitle">Your Space</div>

      <nav className="sh-leftNav" aria-label="Primary navigation">
        {items.map((item) => {
          const isHome = item.to === "/";
          const active = isHome
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(item.to + "/");

          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={`sh-leftItem ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="sh-leftIcon">{item.icon}</span>
              <span className="sh-leftLabel">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}