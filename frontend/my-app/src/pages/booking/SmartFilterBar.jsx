import React, { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────
// Popular airlines — shown in the Airline dropdown BEFORE a search,
// so travelers can pre-pick a carrier. Values are IATA codes, which
// applyFilters in BookingPage matches against flight.ownerCode.
// ─────────────────────────────────────────────
const POPULAR_AIRLINES = [
  { value: "AA", label: "American Airlines" },
  { value: "AS", label: "Alaska Airlines" },
  { value: "B6", label: "JetBlue" },
  { value: "DL", label: "Delta Air Lines" },
  { value: "F9", label: "Frontier Airlines" },
  { value: "NK", label: "Spirit Airlines" },
  { value: "UA", label: "United Airlines" },
  { value: "WN", label: "Southwest Airlines" },
];

const NOT_ON_ROUTE = " (not on this route)";

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
export function FilterDropdown({
  label,
  active,
  badge,
  children,
  onOpen,
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  };

  return (
    // When open, this wrapper is lifted above the Sort row and quick chips below it.
    // Those use backdrop-filter, which creates their own stacking layers — without
    // this, the panel's z-index only counted inside its own row and text showed through.
    <div
      style={{ position: "relative", zIndex: open ? 1000 : "auto" }}
      ref={ref}
    >
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
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
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          style={{
            opacity: 0.6,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            zIndex: 1000,
            minWidth: 200,
            maxWidth: "calc(100vw - 32px)",
            // Solid, not translucent — nothing behind it should show through.
            background: "#160e24",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            boxShadow:
              "0 12px 40px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06) inset",
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
export function ApplyBtn({ onClick }) {
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
export function PanelLabel({ children }) {
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
export function RadioRow({ checked, onClick, children }) {
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

// airlines: [{ value: "AS", label: "Alaska Airlines" }, ...]
// Never empty — popular carriers before a search, the route's carriers after.
function AirlinePanel({ value, onChange, close, airlines, isPreSearch }) {
  const [local, setLocal] = useState(value);
  return (
    <>
      <PanelLabel>Airline</PanelLabel>
      {isPreSearch && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            margin: "-6px 0 8px",
            lineHeight: 1.4,
          }}
        >
          Popular airlines. After you search, you'll see the airlines on your
          route.
        </div>
      )}
      <RadioRow checked={local === "any"} onClick={() => setLocal("any")}>
        Any airline
      </RadioRow>
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {airlines.map((a) => (
          <RadioRow
            key={a.value}
            checked={local === a.value}
            onClick={() => setLocal(a.value)}
          >
            {a.label}
          </RadioRow>
        ))}
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

function XPPanel({ value, onChange, close }) {
  const [local, setLocal] = useState(value);
  const opts = [
    {
      val: "any",
      label: "Any XP",
      icon: null,
    },
    // Must match getBookingXP() in config/xpRules.js:
    // nonstop = 150, 1 stop = 135, 2+ stops = 120 (before plan multiplier).
    {
      val: 135,
      label: "High XP (135+)",
      icon: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          <Bolt size={13} color="#FFB347" />
        </span>
      ),
    },
    {
      val: 150,
      label: "Max XP (150)",
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
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          margin: "-6px 0 8px",
          lineHeight: 1.4,
        }}
      >
        XP you earn for booking. Nonstop flights earn the most.
      </div>
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
  // All hooks run BEFORE the `visible` check. Returning early above them made the
  // hook count change when switching Flights ↔ Stays, which React treats as a crash.
  const isPreSearch = flightResults.length === 0;

  const airlines = useMemo(() => {
    // Before a search: popular carriers, so the filter can be set up front.
    if (isPreSearch) return POPULAR_AIRLINES;

    // After a search: only the airlines actually on this route, keyed by code.
    const byCode = new Map();
    flightResults.forEach((f) => {
      const value = f.ownerCode || f.owner;
      if (value && !byCode.has(value))
        byCode.set(value, { value, label: f.owner || value });
    });
    const list = [...byCode.values()].sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    // Keep a pre-picked airline visible even if it doesn't fly this route,
    // so the user can see why there are no results and switch it off.
    if (filters.airline !== "any" && !byCode.has(filters.airline)) {
      const picked = POPULAR_AIRLINES.find((a) => a.value === filters.airline);
      list.unshift(
        picked
          ? { ...picked, label: `${picked.label}${NOT_ON_ROUTE}` }
          : { value: filters.airline, label: filters.airline }
      );
    }
    return list;
  }, [flightResults, isPreSearch, filters.airline]);

  const update = (key) => (val) => onChange({ ...filters, [key]: val });

  // Labels: just the filter name when nothing is picked; "Name · value" when it is.
  const timeLabel = useMemo(() => {
    if (filters.time === "any") return "Time";
    const map = {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
    };
    return `Time · ${map[filters.time] ?? filters.time}`;
  }, [filters.time]);

  const priceLabel = useMemo(() => {
    if (filters.price === "any") return "Price";
    return `Price · Under $${Number(filters.price).toLocaleString()}`;
  }, [filters.price]);

  const stopsLabel = useMemo(() => {
    if (filters.stops === "any") return "Stops";
    const s = Number(filters.stops);
    if (s === 0) return "Stops · Nonstop";
    if (s === 1) return "Stops · 1 or fewer";
    return "Stops · 2+";
  }, [filters.stops]);

  const airlineLabel = useMemo(() => {
    if (filters.airline === "any") return "Airline";
    const match =
      airlines.find((a) => a.value === filters.airline) ||
      POPULAR_AIRLINES.find((a) => a.value === filters.airline);
    const name = match
      ? match.label.replace(NOT_ON_ROUTE, "")
      : filters.airline;
    return `Airline · ${name}`;
  }, [filters.airline, airlines]);

  const xpLabel = useMemo(() => {
    if (filters.xp === "any")
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          XP Value <Bolt size={12} color="currentColor" />
        </span>
      );
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        XP <Bolt size={12} color="#FFB347" />{" "}
        {Number(filters.xp) >= 150 ? "150" : `${filters.xp}+`}
      </span>
    );
  }, [filters.xp]);

  if (!visible) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        padding: "12px 0 4px",
        width: "100%",
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

      <FilterDropdown
        label={airlineLabel}
        active={filters.airline !== "any"}
        align="right"
      >
        {(close) => (
          <AirlinePanel
            value={filters.airline}
            onChange={update("airline")}
            close={close}
            airlines={airlines}
            isPreSearch={isPreSearch}
          />
        )}
      </FilterDropdown>

      <FilterDropdown
        label={xpLabel}
        active={filters.xp !== "any"}
        align="right"
      >
        {(close) => (
          <XPPanel value={filters.xp} onChange={update("xp")} close={close} />
        )}
      </FilterDropdown>
    </div>
  );
}
