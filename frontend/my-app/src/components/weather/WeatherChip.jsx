import React from "react";

export default function WeatherChip({
  loading,
  temp,
  label,
  high,
  low,
  emoji = "🌡️",
  localTime,
  compact = false,
}) {
  // If no data, render nothing (keeps landing page clean)
  if (!loading && (temp == null || !label)) return null;

  return (
    <div className={`sk-weatherChip ${compact ? "is-compact" : ""}`}>
      {loading ? (
        <span className="sk-weatherSkeleton" />
      ) : (
        <>
          <span className="sk-weatherEmoji" aria-hidden="true">
            {emoji}
          </span>
          <span className="sk-weatherTemp">{temp}°</span>
          <span className="sk-weatherLabel">{label}</span>
          {high != null && low != null && (
            <span className="sk-weatherHiLo">
              H:{high}° / L:{low}°
            </span>
          )}
          {localTime && !compact && (
            <span className="sk-weatherTime">{localTime} local</span>
          )}
        </>
      )}
    </div>
  );
}
