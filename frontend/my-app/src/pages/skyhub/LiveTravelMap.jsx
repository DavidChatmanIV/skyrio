import React from "react";
import "@/styles/LiveTravelMap.css";
import travelMap from "@/assets/skyhub/travel-map.png";

const recentPlaces = ["Tokyo", "Paris", "Bali"];

export default function LiveTravelMap() {
  return (
    <div className="liveMapCard glassCard">
      <div className="liveMapHeader">
        <h3>Travel Map</h3>
        <span className="liveBadge">Live</span>
      </div>

      <div className="liveMapVisual">
        <img src={travelMap} alt="Travel Map" className="liveMapImage" />

        <div className="mapGlow glow1" />
        <div className="mapGlow glow2" />
      </div>

      <div className="mapSection">
        <div className="mapLabel">Recent Places</div>
        <div className="mapPlaces">
          {recentPlaces.map((place) => (
            <div key={place} className="mapPlace">
              {place}
            </div>
          ))}
        </div>
      </div>

      <div className="mapInsight">
        <div className="mapLabel">Trending Route</div>
        <p>Tokyo → Kyoto is trending this week 🔥</p>
      </div>

      <div className="mapHint">
        Live pins, friends, and hidden gems coming soon.
      </div>
    </div>
  );
}