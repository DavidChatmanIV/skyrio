import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { EnvironmentOutlined } from "@ant-design/icons";
import { MapPin } from "lucide-react";
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
      setDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: Math.max(320, rect.width),
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
                    <EnvironmentOutlined /> {city}
                  </div>
                )}
                {airports.map((ap) => (
                  <button
                    key={ap.code}
                    type="button"
                    className={`sk-airport-option${
                      airports.length > 1 ? " is-sub" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(ap);
                    }}
                  >
                    <div className="sk-airport-left">
                      <span className="sk-airport-arrow">
                        {airports.length > 1 ? "↳" : "✈"}
                      </span>
                      <div>
                        <div className="sk-airport-name">
                          {airports.length > 1
                            ? `${ap.name} (${ap.code})`
                            : `${ap.city} – ${ap.name} (${ap.code})`}
                        </div>
                        <div className="sk-airport-dist">{ap.distance}</div>
                      </div>
                    </div>
                    <span className="sk-airport-code">{ap.code}</span>
                  </button>
                ))}
              </div>
            ))}

            {/* ✅ n5/n6: Nearby airports section */}
            {nearby && nearby.airports.length > 0 && (
              <div className="sk-airport-nearby">
                <div className="sk-airport-nearby-header">
                  <MapPin size={11} style={{ marginRight: 5 }} />
                  Also nearby · {nearby.label}
                </div>
                {nearby.airports.map((ap) => (
                  <button
                    key={ap.code}
                    type="button"
                    className="sk-airport-option sk-airport-option--nearby"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(ap);
                    }}
                  >
                    <div className="sk-airport-left">
                      <span className="sk-airport-arrow sk-airport-arrow--nearby">
                        ~
                      </span>
                      <div>
                        <div className="sk-airport-name">
                          {ap.city} – {ap.name} ({ap.code})
                        </div>
                        <div className="sk-airport-dist">{ap.distance}</div>
                      </div>
                    </div>
                    <span className="sk-airport-code sk-airport-code--nearby">
                      {ap.code}
                    </span>
                  </button>
                ))}
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
