import React, { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────

function IconMorning({ size = 28, active = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      {/* Horizon line */}
      <line
        x1="4"
        y1="20"
        x2="24"
        y2="20"
        stroke={active ? "#FFB347" : "rgba(255,255,255,0.45)"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Sun rising — half above horizon */}
      <path
        d="M14 20 A6 6 0 0 1 8 20"
        stroke={active ? "#FFB347" : "rgba(255,255,255,0.55)"}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M14 20 A6 6 0 0 0 20 20"
        stroke={active ? "#FFB347" : "rgba(255,255,255,0.55)"}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Sun rays */}
      <g
        stroke={active ? "#FFB347" : "rgba(255,255,255,0.45)"}
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line x1="14" y1="11" x2="14" y2="9" />
        <line x1="8.5" y1="13.5" x2="7.1" y2="12.1" />
        <line x1="19.5" y1="13.5" x2="20.9" y2="12.1" />
        <line x1="6" y1="20" x2="4" y2="20" />
        <line x1="22" y1="20" x2="24" y2="20" />
      </g>
    </svg>
  );
}

function IconAfternoon({ size = 28, active = false }) {
  const c = active ? "#FFB347" : "rgba(255,255,255,0.55)";
  const cr = active ? "#FFB347" : "rgba(255,255,255,0.45)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="14" cy="14" r="5" stroke={c} strokeWidth="1.5" />
      <g stroke={cr} strokeWidth="1.5" strokeLinecap="round">
        <line x1="14" y1="4" x2="14" y2="6.5" />
        <line x1="14" y1="21.5" x2="14" y2="24" />
        <line x1="4" y1="14" x2="6.5" y2="14" />
        <line x1="21.5" y1="14" x2="24" y2="14" />
        <line x1="7.2" y1="7.2" x2="9" y2="9" />
        <line x1="19" y1="19" x2="20.8" y2="20.8" />
        <line x1="20.8" y1="7.2" x2="19" y2="9" />
        <line x1="9" y1="19" x2="7.2" y2="20.8" />
      </g>
    </svg>
  );
}

function IconEvening({ size = 28, active = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      {/* Moon crescent */}
      <path
        d="M18 14.5A7 7 0 1 1 11.5 8a5 5 0 0 0 6.5 6.5z"
        stroke={active ? "#b39ddb" : "rgba(255,255,255,0.55)"}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Stars */}
      <g fill={active ? "#b39ddb" : "rgba(255,255,255,0.4)"}>
        <circle cx="21" cy="8" r="1" />
        <circle cx="23" cy="12" r="0.75" />
        <circle cx="20" cy="5" r="0.6" />
      </g>
    </svg>
  );
}

function IconXP({ size = 16, double = false, trophy = false, active = false }) {
  const color = active ? "#FFB347" : "rgba(255,255,255,0.7)";
  if (trophy) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 2h8v5a4 4 0 0 1-8 0V2z"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M4 4H2a2 2 0 0 0 2 4M12 4h2a2 2 0 0 1-2 4"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="11"
          x2="8"
          y2="13"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <line
          x1="5"
          y1="14"
          x2="11"
          y2="14"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size * (double ? 1 : 1)}
      viewBox={`0 0 ${double ? 20 : 12} 16`}
      fill="none"
      aria-hidden="true"
    >
      {double && (
        <path
          d="M2 12 L6 2 L9 8 L12 4 L15 12"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {!double && (
        <path
          d="M6 1L7.5 5.5H12L8.25 8.5L9.75 13L6 10L2.25 13L3.75 8.5L0 5.5H4.5L6 1Z"
          stroke={color}
          strokeWidth="1.2"
          fill={active ? "rgba(255,179,71,0.2)" : "none"}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// Zap bolt SVG
function Bolt({ size = 13, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M7.5 1L2 7.5h4.5L5 12l6.5-6.5H7L7.5 1z"
        fill={color}
        stroke={color}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Filter dropdown wrapper
// ─────────────────────────────────────────────
function FilterDropdown({ label, active, badge, children, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "7px 14px",
          borderRadius: 999,
          border: active
            ? "1.5px solid rgba(255,179,71,0.7)"
            : "1.5px solid rgba(255,255,255,0.15)",
          background: active
            ? "rgba(255,179,71,0.12)"
            : "rgba(255,255,255,0.06)",
          color: active ? "#FFB347" : "rgba(255,255,255,0.8)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {badge && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#FFB347",
              color: "#1a1020",
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {badge}
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            opacity: 0.55,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 999,
            minWidth: 200,
            background: "rgba(22, 14, 36, 0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06) inset",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            overflow: "hidden",
            padding: "16px",
          }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Apply button
// ─────────────────────────────────────────────
function ApplyBtn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        marginTop: 14,
        padding: "9px 0",
        borderRadius: 999,
        border: "none",
        background: "linear-gradient(90deg, #ff8a2a, #FFB347)",
        color: "#fff",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        letterSpacing: "0.01em",
      }}
    >
      Apply
    </button>
  );
}

// ─────────────────────────────────────────────
// Panel label
// ─────────────────────────────────────────────
function PanelLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Radio option row
// ─────────────────────────────────────────────
function RadioRow({ checked, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 4px",
        background: "none",
        border: "none",
        cursor: "pointer",
        borderRadius: 8,
        color: checked ? "#FFB347" : "rgba(255,255,255,0.75)",
        fontWeight: checked ? 600 : 400,
        fontSize: 14,
        textAlign: "left",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {/* Custom radio circle */}
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          flexShrink: 0,
          border: checked
            ? "2px solid #FFB347"
            : "2px solid rgba(255,255,255,0.25)",
          background: checked ? "rgba(255,179,71,0.2)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#FFB347",
            }}
          />
        )}
      </span>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Individual filter panels
// ─────────────────────────────────────────────

function PricePanel({ value, onChange, close }) {
  const [local, setLocal] = useState(value);
  const opts = [
    { val: "any", label: "Any price" },
    { val: 300, label: "Under $300" },
    { val: 500, label: "Under $500" },
    { val: 800, label: "Under $800" },
    { val: 1200, label: "Under $1,200" },
  ];
  return (
    <>
      <PanelLabel>Max Price</PanelLabel>
      {opts.map((o) => (
        <RadioRow
          key={o.val}
          checked={local === o.val}
          onClick={() => setLocal(o.val)}
        >
          {o.label}
        </RadioRow>
      ))}
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </>
  );
}

function StopsPanel({ value, onChange, close }) {
  const [local, setLocal] = useState(value);
  const opts = [
    { val: "any", label: "Any stops" },
    { val: 0, label: "Nonstop only" },
    { val: 1, label: "1 stop or fewer" },
    { val: 2, label: "2+ stops" },
  ];
  return (
    <>
      <PanelLabel>Stops</PanelLabel>
      {opts.map((o) => (
        <RadioRow
          key={o.val}
          checked={local === o.val}
          onClick={() => setLocal(o.val)}
        >
          {o.label}
        </RadioRow>
      ))}
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </>
  );
}

function TimePanel({ value, onChange, close }) {
  const [local, setLocal] = useState(value);
  const slots = [
    { val: "morning", label: "Morning", sub: "5am – 12pm", Icon: IconMorning },
    {
      val: "afternoon",
      label: "Afternoon",
      sub: "12pm – 6pm",
      Icon: IconAfternoon,
    },
    {
      val: "evening",
      label: "Evening",
      sub: "6pm – midnight",
      Icon: IconEvening,
    },
  ];
  return (
    <>
      <PanelLabel>Departure Time</PanelLabel>
      <div style={{ display: "flex", gap: 8 }}>
        {slots.map(({ val, label, sub, Icon }) => {
          const active = local === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => setLocal(active ? "any" : val)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "12px 8px",
                borderRadius: 12,
                border: active
                  ? "1.5px solid rgba(255,179,71,0.6)"
                  : "1.5px solid rgba(255,255,255,0.1)",
                background: active
                  ? "rgba(255,179,71,0.1)"
                  : "rgba(255,255,255,0.04)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <Icon size={28} active={active} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? "#FFB347" : "rgba(255,255,255,0.8)",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.38)",
                  lineHeight: 1.3,
                  textAlign: "center",
                }}
              >
                {sub}
              </span>
            </button>
          );
        })}
      </div>
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </>
  );
}

function AirlinePanel({ value, onChange, close, airlines }) {
  const [local, setLocal] = useState(value);
  return (
    <>
      <PanelLabel>Airline</PanelLabel>
      <RadioRow checked={local === "any"} onClick={() => setLocal("any")}>
        Any airline
      </RadioRow>
      {airlines.map((a) => (
        <RadioRow key={a} checked={local === a} onClick={() => setLocal(a)}>
          {a}
        </RadioRow>
      ))}
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </>
  );
}

function XPPanel({ value, onChange, close }) {
  const [local, setLocal] = useState(value);
  const opts = [
    {
      val: "any",
      label: "Any XP",
      icon: null,
    },
    {
      val: 60,
      label: "High XP (60+)",
      icon: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          <Bolt size={13} color="#FFB347" />
        </span>
      ),
    },
    {
      val: 100,
      label: "Epic XP (100+)",
      icon: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
          <Bolt size={13} color="#FFB347" />
          <Bolt size={13} color="#FFB347" />
        </span>
      ),
    },
    {
      val: 150,
      label: "Legend tier (150+)",
      icon: (
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={{ display: "inline-block", verticalAlign: "middle" }}
        >
          <path
            d="M4 2h8v5a4 4 0 0 1-8 0V2z"
            stroke="#FFB347"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M4 4H2a2 2 0 0 0 2 4M12 4h2a2 2 0 0 1-2 4"
            stroke="#FFB347"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="11"
            x2="8"
            y2="13"
            stroke="#FFB347"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <line
            x1="5"
            y1="14"
            x2="11"
            y2="14"
            stroke="#FFB347"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];
  return (
    <>
      <PanelLabel>Minimum XP Value</PanelLabel>
      {opts.map((o) => (
        <RadioRow
          key={o.val}
          checked={local === o.val}
          onClick={() => setLocal(o.val)}
        >
          {o.icon && (
            <span style={{ minWidth: 24, display: "inline-flex" }}>
              {o.icon}
            </span>
          )}
          {o.label}
        </RadioRow>
      ))}
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// Main SmartFilterBar
// ─────────────────────────────────────────────
export default function SmartFilterBar({
  filters,
  onChange,
  flightResults = [],
  visible = true,
}) {
  if (!visible) return null;

  const airlines = useMemo(() => {
    const set = new Set(flightResults.map((f) => f.owner).filter(Boolean));
    return [...set].sort();
  }, [flightResults]);

  const update = (key) => (val) => onChange({ ...filters, [key]: val });

  const timeLabel = useMemo(() => {
    if (filters.time === "any") return "Time ·";
    const map = {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
    };
    return `Time · ${map[filters.time] ?? filters.time}`;
  }, [filters.time]);

  const priceLabel = useMemo(() => {
    if (filters.price === "any") return "Price ·";
    return `Price · <$${Number(filters.price).toLocaleString()}`;
  }, [filters.price]);

  const stopsLabel = useMemo(() => {
    if (filters.stops === "any") return "Stops ·";
    if (filters.stops === 0) return "Stops · Nonstop";
    if (filters.stops === 2) return "Stops · 2+";
    return `Stops · ${filters.stops}`;
  }, [filters.stops]);

  const airlineLabel = useMemo(() => {
    if (filters.airline === "any") return "Airline ·";
    return `Airline · ${filters.airline}`;
  }, [filters.airline]);

  const xpLabel = useMemo(() => {
    if (filters.xp === "any")
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          XP Value <Bolt size={12} color="currentColor" /> ·
        </span>
      );
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        XP <Bolt size={12} color="#FFB347" /> {filters.xp}+
      </span>
    );
  }, [filters.xp]);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "12px 0 4px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          alignSelf: "center",
          marginRight: 4,
        }}
      >
        FILTERS
      </div>

      <FilterDropdown label={priceLabel} active={filters.price !== "any"}>
        {(close) => (
          <PricePanel
            value={filters.price}
            onChange={update("price")}
            close={close}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={stopsLabel} active={filters.stops !== "any"}>
        {(close) => (
          <StopsPanel
            value={filters.stops}
            onChange={update("stops")}
            close={close}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={timeLabel} active={filters.time !== "any"}>
        {(close) => (
          <TimePanel
            value={filters.time}
            onChange={update("time")}
            close={close}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={airlineLabel} active={filters.airline !== "any"}>
        {(close) => (
          <AirlinePanel
            value={filters.airline}
            onChange={update("airline")}
            close={close}
            airlines={airlines}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={xpLabel} active={filters.xp !== "any"}>
        {(close) => (
          <XPPanel value={filters.xp} onChange={update("xp")} close={close} />
        )}
      </FilterDropdown>
    </div>
  );
}
