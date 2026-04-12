import React, { useState, useRef, useEffect, useCallback } from "react";
import { EnvironmentOutlined } from "@ant-design/icons";
import { searchAirports } from "@/data/airportData";
import "@/styles/AirportInput.css";

/**
 * AirportInput
 * Props:
 *   value       – controlled display string e.g. "New York (JFK)"
 *   onChange    – (airport) => void — called with the full airport object
 *   placeholder – string
 *   className   – extra className on the wrapper
 */
export default function AirportInput({
  value,
  onChange,
  placeholder = "City or airport",
  className = "",
}) {
  const [inputVal, setInputVal] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Sync controlled value from parent
  useEffect(() => {
    setInputVal(value || "");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setInputVal(val);
    const found = searchAirports(val);
    setResults(found);
    setOpen(found.length > 0);
  }, []);

  const handleSelect = useCallback(
    (airport) => {
      const display = `${airport.city} (${airport.code})`;
      setInputVal(display);
      setOpen(false);
      setResults([]);
      onChange?.(airport);
    },
    [onChange]
  );

  // Group results by city — multi-airport cities get a header row
  const grouped = results.reduce((acc, airport) => {
    const key = airport.city;
    if (!acc[key]) acc[key] = [];
    acc[key].push(airport);
    return acc;
  }, {});

  return (
    <div ref={wrapRef} className={`sk-airport-wrap ${className}`}>
      <input
        type="text"
        className="sk-glass-input sk-airport-input"
        value={inputVal}
        onChange={handleChange}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      {open && (
        <div className="sk-airport-dropdown">
          {Object.entries(grouped).map(([city, airports]) => (
            <div key={city} className="sk-airport-group">
              {/* City header only when 2+ airports in same city */}
              {airports.length > 1 && (
                <div className="sk-airport-city-header">
                  <EnvironmentOutlined /> {city}
                </div>
              )}

              {airports.map((ap) => (
                <button
                  key={ap.code}
                  type="button"
                  className={`sk-airport-option ${
                    airports.length > 1 ? "is-sub" : ""
                  }`}
                  onMouseDown={(e) => {
                    // Prevent blur before click registers
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
        </div>
      )}
    </div>
  );
}