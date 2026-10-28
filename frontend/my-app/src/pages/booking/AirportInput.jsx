import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Plane, CornerDownRight } from "lucide-react";
import { searchAirports } from "@/data/airportData";
import "@/styles/AirportInput.css";

/**
 * AirportInput
 *
 * Props:
 *   value       – controlled display string e.g. "New York (JFK)"
 *   onChange    – (airport) => void — called with the full airport object
 *   placeholder – string
 *   className   – extra className on the wrapper
 *
 * Uses React Portal to render the dropdown directly into document.body,
 * bypassing any parent stacking context (overflow, transform, z-index).
 *
 * n5/n6: Surfaces nearby metro airports in a distinct "Also nearby" section
 * when the top result belongs to a multi-airport metro area.
 */
export default function AirportInput({
  value,
  onChange,
  placeholder = "City or airport",
  className = "",
}) {
  const [inputVal, setInputVal] = useState(value || "");
  const [results, setResults] = useState([]);
  const [nearby, setNearby] = useState(null); // { label, airports }
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Sync controlled value from parent
  useEffect(() => {
    setInputVal(value || "");
  }, [value]);

  // Recalculate dropdown position whenever it opens or window resizes
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const updatePos = () => {
      const rect = inputRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      // Wide enough for long airport names, never past the screen edges.
      const width = Math.min(Math.max(400, rect.width), vw - 32);
      const left = Math.max(16, Math.min(rect.left, vw - width - 16));
      setDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: left + window.scrollX,
        width,
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      const dropdown = document.querySelector(".sk-airport-dropdown-portal");
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        (!dropdown || !dropdown.contains(e.target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setInputVal(val);
    // ✅ n5/n6: searchAirports now returns { results, nearby }
    const { results: found, nearby: nearbyAirports } = searchAirports(val);
    setResults(found);
    setNearby(nearbyAirports);
    setOpen(found.length > 0 || !!nearbyAirports);
  }, []);

  const handleSelect = useCallback(
    (airport) => {
      const display = `${airport.city} (${airport.code})`;
      setInputVal(display);
      setOpen(false);
      setResults([]);
      setNearby(null);
      onChange?.(airport);
    },
    [onChange]
  );

  // Group primary results by city for multi-airport cities
  const grouped = results.reduce((acc, airport) => {
    const key = airport.city;
    if (!acc[key]) acc[key] = [];
    acc[key].push(airport);
    return acc;
  }, {});

  const hasContent = results.length > 0 || !!nearby;

  const renderOption = (ap, { sub = false, nearbyRow = false } = {}) => (
    <button
      key={ap.code}
      type="button"
      className={`sk-airport-option${sub ? " is-sub" : ""}${
        nearbyRow ? " sk-airport-option--nearby" : ""
      }`}
      title={`${ap.city} – ${ap.name} (${ap.code})`}
      onMouseDown={(e) => {
        e.preventDefault();
        handleSelect(ap);
      }}
    >
      <span
        className={`sk-airport-arrow${
          nearbyRow ? " sk-airport-arrow--nearby" : ""
        }`}
        aria-hidden="true"
      >
        {sub ? (
          <CornerDownRight size={14} />
        ) : nearbyRow ? (
          <MapPin size={14} />
        ) : (
          <Plane size={14} />
        )}
      </span>
      <span className="sk-airport-text">
        <span className="sk-airport-name">{sub ? ap.name : ap.city}</span>
        <span className="sk-airport-dist">
          {[sub ? null : ap.name, ap.distance].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span
        className={`sk-airport-code${
          nearbyRow ? " sk-airport-code--nearby" : ""
        }`}
      >
        {ap.code}
      </span>
    </button>
  );

  const dropdown =
    open && hasContent
      ? createPortal(
          <div
            className="sk-airport-dropdown sk-airport-dropdown-portal"
            style={{
              position: "absolute",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
          >
            {/* ── Primary results ── */}
            {Object.entries(grouped).map(([city, airports]) => (
              <div key={city} className="sk-airport-group">
                {airports.length > 1 && (
                  <div className="sk-airport-city-header">
                    <MapPin size={11} aria-hidden="true" /> {city}
                  </div>
                )}
                {airports.map((ap) =>
                  renderOption(ap, { sub: airports.length > 1 })
                )}
              </div>
            ))}

            {/* ✅ n5/n6: Nearby airports section */}
            {nearby && nearby.airports.length > 0 && (
              <div className="sk-airport-nearby">
                <div className="sk-airport-nearby-header">
                  <MapPin
                    size={11}
                    style={{ marginRight: 5 }}
                    aria-hidden="true"
                  />
                  Also nearby · {nearby.label}
                </div>
                {nearby.airports.map((ap) =>
                  renderOption(ap, { nearbyRow: true })
                )}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={wrapRef} className={`sk-airport-wrap ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="sk-glass-input sk-airport-input"
        value={inputVal}
        onChange={handleChange}
        onFocus={() => {
          if (results.length > 0 || nearby) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {dropdown}
    </div>
  );
}
