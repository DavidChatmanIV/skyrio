import React from "react";
import { useNavigate } from "react-router-dom";

export default function CirclesPage() {
  const navigate = useNavigate();

  return (
    <div
      className="skyhub-content"
      style={{ position: "relative", zIndex: 50 }}
    >
      <div className="skyhub-panel">
        <div className="skyhub-panelTitle">Circles</div>
        <div className="skyhub-panelSub">
          Small groups for planning trips together, sharing updates, and keeping
          your travel crew close.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            className="skyhub-btn"
            onClick={() => navigate("/skyhub/moments")}
          >
            ← Back to Moments
          </button>

          <button type="button" className="skyhub-btn" disabled>
            Notify me (soon)
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Coming soon. This will unlock after the March launch.
        </div>
      </div>
    </div>
  );
}