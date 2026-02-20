import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/SkyHubInsights.css";

/**
 * SkyHubInsights — simple "launch view" snapshot
 * Uses SkyHub glass language, but scoped styles live in SkyHubInsights.css
 */
export default function SkyHubInsights() {
  const navigate = useNavigate();

  const stats = useMemo(
    () => [
      { label: "Moments Posted", value: 12 },
      { label: "Total Likes", value: 184 },
      { label: "Comments", value: 43 },
      { label: "Cities Visited", value: 5 },
    ],
    []
  );

  const topPlaces = useMemo(
    () => [
      { name: "Kyoto, Japan", pct: 38 },
      { name: "Okinawa, Japan", pct: 22 },
      { name: "Santorini, Greece", pct: 18 },
      { name: "Medellín, Colombia", pct: 12 },
    ],
    []
  );

  const tags = useMemo(
    () => ["#Kyoto", "#GoldenHour", "#BeachDays", "#HiddenGems", "#FoodFinds"],
    []
  );

  return (
    <div className="shins-page">
      {/* cinematic glass frame like SkyHubFeed */}
      <div className="shins-frame">
        {/* header */}
        <div className="shins-head">
          <div>
            <div className="shins-titleRow">
              <h2 className="shins-title">Insights</h2>
              <span className="shins-badge">Launch View</span>
            </div>
            <div className="shins-sub">
              A quick snapshot of your travel activity
            </div>
          </div>

          <div className="shins-actions">
            <button
              className="skyhub-btn skyhub-btnPrimary"
              type="button"
              onClick={() => navigate("/passport")}
            >
              View Passport
            </button>
            <button
              className="skyhub-btn"
              type="button"
              onClick={() => navigate("/skyhub/moments")}
            >
              Back to Moments
            </button>
          </div>
        </div>

        {/* body grid */}
        <div className="shins-grid">
          {/* left: KPI tiles */}
          <section className="shins-card">
            <div className="shins-cardTitle">Your Week</div>
            <div className="shins-kpis">
              {stats.map((s) => (
                <div key={s.label} className="shins-kpi">
                  <div className="shins-kpiValue">{s.value}</div>
                  <div className="shins-kpiLabel">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="shins-tip">
              <div className="shins-tipTitle">Quick Tip</div>
              <div className="shins-tipText">
                Post <b>3 moments</b> this week to unlock a new badge in Digital
                Passport.
              </div>
            </div>
          </section>

          {/* right: places + tags */}
          <section className="shins-card">
            <div className="shins-cardTitle">Top Places</div>
            <div className="shins-muted">Where your moments hit the most</div>

            <div className="shins-placeList">
              {topPlaces.map((p) => (
                <div key={p.name} className="shins-placeRow">
                  <div className="shins-placeName">{p.name}</div>

                  <div className="shins-placeRight">
                    <div className="shins-bar">
                      <div
                        className="shins-fill"
                        style={{ width: `${p.pct}%` }}
                        aria-label={`${p.name} ${p.pct}%`}
                      />
                    </div>
                    <div className="shins-pct">{p.pct}%</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="shins-divider" />

            <div className="shins-cardTitle">Top Tags</div>
            <div className="shins-tagRow">
              {tags.map((t) => (
                <span key={t} className="shins-tag">
                  {t}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}