// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useCallback, useEffect, useRef } from "react";
import { message as antdMessage } from "antd";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

// Flight + Stay and Cars sit up front (testers didn't find them under "More").
// Its key stays "Packages" so ?tab=Packages links keep working.
export const PRIMARY_TABS = [
  { key: "Flights", label: "Flights" },
  { key: "Stays", label: "Stays" },
  { key: "Cars", label: "Cars" },
  { key: "Packages", label: "Flight + Stay" },
  { key: "Saved", label: "Saved" },
];

// Cars is live via Duffel Cars and sits up front with Flights and Stays.
// `comingSoon: true` on any tab still renders it disabled with a "Soon" badge.
export const MORE_TABS = [
  { key: "Excursions", label: "Excursions" },
  { key: "Events", label: "Events" },
  { key: "Last-Minute", label: "Last-Minute" },
];

export function BookingTabBar({ value, onChange }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const moreRef = useRef(null);
  const menuRef = useRef(null);
  const isMoreActive = MORE_TABS.some((t) => t.key === value);

  // The menu is rendered on <body> (a portal) and placed under the More
  // button. Inside the tab bar it got clipped on phones, where the bar
  // scrolls sideways — so More looked dead.
  const placeMenu = useCallback(() => {
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 220;
    const left = Math.max(
      12,
      Math.min(r.right - width, window.innerWidth - width - 12)
    );
    setMenuPos({ top: r.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    placeMenu();
    const outside = (e) => {
      if (
        moreRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return;
      setMoreOpen(false);
    };
    const close = () => setMoreOpen(false);
    const onKey = (e) => e.key === "Escape" && close();
    // pointerdown covers mouse AND touch
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [moreOpen, placeMenu]);

  const handleSelect = (t) => {
    if (t.comingSoon) {
      antdMessage.info(`${t.label} is coming soon — stay tuned!`);
      setMoreOpen(false);
      return;
    }
    onChange(t.key);
    setMoreOpen(false);
  };

  return (
    <div className="sk-tab-bar">
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`sk-tab-btn${value === t.key ? " is-active" : ""}`}
          onClick={() => handleSelect(t)}
        >
          {t.label}
        </button>
      ))}
      <div className="sk-tab-more" ref={moreRef}>
        <button
          type="button"
          className={`sk-tab-more-btn${moreOpen ? " is-open" : ""}${
            isMoreActive ? " has-active" : ""
          }`}
          onClick={() => {
            if (!moreOpen) placeMenu();
            setMoreOpen((v) => !v);
          }}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          {isMoreActive
            ? MORE_TABS.find((t) => t.key === value)?.label
            : "More"}
          <span
            style={{
              fontSize: 9,
              opacity: 0.6,
              display: "inline-block",
              transition: "transform 0.18s",
              transform: moreOpen ? "rotate(180deg)" : "none",
            }}
          >
            ▾
          </span>
        </button>
        {moreOpen &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              className="sk-tab-more-menu sk-tab-more-menu--portal"
              role="menu"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
            >
              {MORE_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="menuitem"
                  className={`sk-tab-more-item${
                    value === t.key ? " is-active" : ""
                  }${t.comingSoon ? " is-disabled" : ""}`}
                  onClick={() => handleSelect(t)}
                  aria-disabled={t.comingSoon || undefined}
                  title={t.comingSoon ? `${t.label} — coming soon` : undefined}
                >
                  <span className="sk-tab-more-item-label">{t.label}</span>
                  {t.comingSoon && (
                    <span className="sk-soon-badge">
                      <Clock size={9} className="sk-soon-badge-icon" />
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
