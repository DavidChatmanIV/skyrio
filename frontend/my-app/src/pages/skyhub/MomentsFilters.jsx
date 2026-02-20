import React from "react";

const TABS = ["Friends", "Trips", "Community"];

export default function MomentsFilters({
  value = "Friends",
  onChange = () => {},
}) {
  return (
    <div className="sh-momentsFilters">
      <div
        className="sh-filterTabs"
        role="tablist"
        aria-label="Moments filters"
      >
        {TABS.map((tab) => {
          const active = value === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              className={`sh-filterTab ${active ? "is-active" : ""}`}
              onClick={() => onChange(tab)}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
