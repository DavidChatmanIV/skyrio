import React, { useState, useRef, useEffect, useCallback } from "react";

const STOP_OPTIONS = [
  { label: "Any stops", value: "any" },
  { label: "Nonstop only", value: 0 },
  { label: "1 stop max", value: 1 },
  { label: "2+ stops", value: 2 },
];

const XP_OPTIONS = [
  { label: "Any", value: "any" },
  { label: "⚡ High XP (60+)", value: 60 },
  { label: "⚡⚡ Epic XP (100+)", value: 100 },
  { label: "🏆 Legend tier (150+)", value: 150 },
];

const TIME_SLOTS = [
  { emoji: "🌅", name: "Morning", sublabel: "5am – 12pm", value: "morning" },
  {
    emoji: "🌇",
    name: "Afternoon",
    sublabel: "12pm – 6pm",
    value: "afternoon",
  },
  {
    emoji: "🌙",
    name: "Evening",
    sublabel: "6pm – midnight",
    value: "evening",
  },
];

/* ── Generic dropdown pill wrapper ── */
function FilterDropdown({ label, isActive, children, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="skf-pill-wrap" ref={ref}>
      <button
        type="button"
        className={`skf-pill ${isActive ? "skf-pill--active" : ""} ${
          open ? "skf-pill--open" : ""
        }`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className="skf-pill-label">{label}</span>
        {isActive && (
          <span
            className="skf-pill-clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
              setOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label="Clear filter"
          >
            ×
          </span>
        )}
        <span className={`skf-pill-caret ${open ? "skf-pill-caret--up" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="skf-dropdown" onClick={(e) => e.stopPropagation()}>
          {children}
          <button
            type="button"
            className="skf-apply-btn"
            onClick={() => setOpen(false)}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Price slider ── */
function PriceFilter({ value, onChange }) {
  const [local, setLocal] = useState(value === "any" ? 2000 : value);
  return (
    <div className="skf-inner">
      <div className="skf-section-title">Max price per person</div>
      <div className="skf-price-val">${Number(local).toLocaleString()}</div>
      <input
        type="range"
        className="skf-range"
        min={50}
        max={5000}
        step={50}
        value={local}
        onChange={(e) => {
          const v = Number(e.target.value);
          setLocal(v);
          onChange(v);
        }}
      />
      <div className="skf-range-labels">
        <span>$50</span>
        <span>$5,000+</span>
      </div>
    </div>
  );
}

/* ── Stops radios ── */
function StopsFilter({ value, onChange }) {
  return (
    <div className="skf-inner">
      <div className="skf-section-title">Number of stops</div>
      {STOP_OPTIONS.map((opt) => (
        <label key={String(opt.value)} className="skf-radio-row">
          <input
            type="radio"
            name="stops"
            className="skf-radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ── Time visual toggle tiles ── */
function TimeFilter({ value, onChange }) {
  return (
    <div className="skf-inner skf-inner--wide">
      <div className="skf-section-title">Departure time</div>
      <div className="skf-time-grid">
        {TIME_SLOTS.map((slot) => {
          const active = value === slot.value;
          return (
            <button
              key={slot.value}
              type="button"
              className={`skf-time-tile ${
                active ? "skf-time-tile--active" : ""
              }`}
              onClick={() => onChange(active ? "any" : slot.value)}
            >
              <span className="skf-time-icon">{slot.emoji}</span>
              <span className="skf-time-name">{slot.name}</span>
              <span className="skf-time-sub">{slot.sublabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Airline radios (dynamic from results) ── */
function AirlineFilter({ value, onChange, airlines }) {
  const all = ["any", ...airlines];
  return (
    <div className="skf-inner">
      <div className="skf-section-title">Airline</div>
      {all.map((a) => (
        <label key={a} className="skf-radio-row">
          <input
            type="radio"
            name="airline"
            className="skf-radio"
            checked={value === a}
            onChange={() => onChange(a)}
          />
          <span>{a === "any" ? "Any airline" : a}</span>
        </label>
      ))}
    </div>
  );
}

/* ── XP radios ── */
function XpFilter({ value, onChange }) {
  return (
    <div className="skf-inner">
      <div className="skf-section-title">Minimum XP value</div>
      {XP_OPTIONS.map((opt) => (
        <label key={String(opt.value)} className="skf-radio-row">
          <input
            type="radio"
            name="xp"
            className="skf-radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN EXPORT
──────────────────────────────────────────── */
export default function SmartFilterBar({
  filters,
  onChange,
  flightResults = [],
  visible,
}) {
  const airlines = [
    ...new Set(flightResults.map((f) => f.owner).filter(Boolean)),
  ];

  const update = useCallback(
    (key, val) => onChange({ ...filters, [key]: val }),
    [filters, onChange]
  );

  const clear = useCallback(
    (key) => onChange({ ...filters, [key]: "any" }),
    [filters, onChange]
  );

  const clearAll = useCallback(
    () =>
      onChange({
        price: "any",
        stops: "any",
        time: "any",
        airline: "any",
        xp: "any",
      }),
    [onChange]
  );

  const activeCount = Object.values(filters).filter((v) => v !== "any").length;

  if (!visible) return null;

  /* Dynamic pill labels */
  const priceLabel =
    filters.price !== "any"
      ? `Price ≤ $${Number(filters.price).toLocaleString()}`
      : "Price";
  const stopsLabel =
    filters.stops !== "any"
      ? STOP_OPTIONS.find((o) => o.value === filters.stops)?.label ?? "Stops"
      : "Stops";
  const timeSlot = TIME_SLOTS.find((s) => s.value === filters.time);
  const timeLabel =
    filters.time !== "any" ? `${timeSlot?.emoji} ${timeSlot?.name}` : "Time";
  const airlineLabel = filters.airline !== "any" ? filters.airline : "Airline";
  const xpLabel =
    filters.xp !== "any"
      ? XP_OPTIONS.find((o) => o.value === filters.xp)?.label ?? "XP Value ⚡"
      : "XP Value ⚡";

  return (
    <div className="skf-bar">
      <div className="skf-bar-inner">
        <span className="skf-bar-label">
          Filters
          {activeCount > 0 && (
            <span className="skf-active-badge">{activeCount}</span>
          )}
        </span>

        <div className="skf-pills">
          <FilterDropdown
            label={priceLabel}
            isActive={filters.price !== "any"}
            onClear={() => clear("price")}
          >
            <PriceFilter
              value={filters.price}
              onChange={(v) => update("price", v)}
            />
          </FilterDropdown>

          <FilterDropdown
            label={stopsLabel}
            isActive={filters.stops !== "any"}
            onClear={() => clear("stops")}
          >
            <StopsFilter
              value={filters.stops}
              onChange={(v) => update("stops", v)}
            />
          </FilterDropdown>

          <FilterDropdown
            label={timeLabel}
            isActive={filters.time !== "any"}
            onClear={() => clear("time")}
          >
            <TimeFilter
              value={filters.time}
              onChange={(v) => update("time", v)}
            />
          </FilterDropdown>

          <FilterDropdown
            label={airlineLabel}
            isActive={filters.airline !== "any"}
            onClear={() => clear("airline")}
          >
            <AirlineFilter
              value={filters.airline}
              onChange={(v) => update("airline", v)}
              airlines={airlines}
            />
          </FilterDropdown>

          <FilterDropdown
            label={xpLabel}
            isActive={filters.xp !== "any"}
            onClear={() => clear("xp")}
          >
            <XpFilter value={filters.xp} onChange={(v) => update("xp", v)} />
          </FilterDropdown>
        </div>

        {activeCount > 0 && (
          <button type="button" className="skf-clear-all" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}