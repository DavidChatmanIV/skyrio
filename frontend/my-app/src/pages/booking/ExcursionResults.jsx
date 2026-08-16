import React, { useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import skyrioLogo from "@/assets/logo/skyrio-logo-transparent.png";
import ExcursionCard from "./ExcursionCard";

// ─────────────────────────────────────────────────────────────
// Loading steps shown under the Skyrio logo while searching —
// mirrors ATLAS_LOADING_STEPS / FlightSkeleton in BookingPage.jsx
// so the loading state feels identical across tabs.
// ─────────────────────────────────────────────────────────────
const EXCURSION_LOADING_STEPS = [
  "Scanning live experiences…",
  "Comparing tours & activities…",
  "Filtering by rating + value…",
  "Ranking best picks for you…",
  "Almost there…",
];

function IconWarning({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ff8a2a"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginRight: 4,
      }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ExcursionSkeleton — same visual language as FlightSkeleton in
// BookingPage.jsx (Skyrio logo, glow ring, rotating copy, shimmer
// cards), reusing the sk-search-loading__* classes already
// defined globally in BookingPage.css.
// ─────────────────────────────────────────────────────────────
function ExcursionSkeleton() {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(
      () => setStepIdx((i) => (i + 1) % EXCURSION_LOADING_STEPS.length),
      1800
    );
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="sk-search-loading">
      <div className="sk-search-loading__logo-wrap">
        <div className="sk-search-loading__glow" />
        <div className="sk-search-loading__ring" />
        <div className="sk-search-loading__ring-2" />
        <img
          src={skyrioLogo}
          alt="Skyrio"
          className="sk-search-loading__logo"
        />
      </div>
      <div className="sk-search-loading__label">Skyrio AI active</div>
      <div className="sk-search-loading__copy">
        {EXCURSION_LOADING_STEPS[stepIdx]}
      </div>
      <div className="sk-search-loading__sub">
        Finding the best experiences for your trip.
      </div>
      <div className="sk-search-loading__bar">
        <div className="sk-search-loading__bar-fill" />
      </div>
      <div className="sk-flight-skeleton">
        {[1, 2, 3].map((i) => (
          <div key={i} className="sk-skeleton-card">
            <div className="sk-skeleton-thumb sk-shimmer" />
            <div className="sk-skeleton-body">
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "52%" }}
              />
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "38%", marginTop: 8 }}
              />
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "28%", marginTop: 8 }}
              />
            </div>
            <div className="sk-skeleton-price sk-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExcursionResults({
  results = [],
  loading = false,
  error = null,
  destination = null,
}) {
  const hasResults = useMemo(
    () => Array.isArray(results) && results.length > 0,
    [results]
  );

  if (loading) return <ExcursionSkeleton />;

  return (
    <>
      {error && (
        <div className="sk-search-error">
          <IconWarning size={14} /> {error}
        </div>
      )}

      {!hasResults && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "52px 24px",
            color: "rgba(255,255,255,0.38)",
            fontSize: 14,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <Compass
              size={40}
              strokeWidth={1.25}
              color="rgba(255,255,255,0.28)"
            />
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 17,
              color: "rgba(255,255,255,0.75)",
              letterSpacing: "-0.01em",
              marginBottom: 7,
            }}
          >
            Ready when you are
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 300,
              color: "rgba(255,255,255,0.38)",
            }}
          >
            Enter a destination above to find tours & experiences
          </div>
        </div>
      )}

      {hasResults &&
        results.map((excursion) => (
          <ExcursionCard
            key={excursion.id}
            excursion={excursion}
            fallbackDestination={destination}
          />
        ))}
    </>
  );
}
