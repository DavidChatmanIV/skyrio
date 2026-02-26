import React from "react";
import "@/styles/RightRail.css";
import travelMap from "@/assets/skyhub/travel-map.png";

export default function RightRail() {
  return (
    <div className="glassCard">
      <div className="travelMapTitle">Travel Map</div>

      <img src={travelMap} alt="Travel Map" className="travelMapImage" />

      <div className="rightRail-title">Recent Places</div>

      <div className="rightRail-place">Tokyo</div>
      <div className="rightRail-place">Paris</div>
      <div className="rightRail-place">Bali</div>
    </div>
  );
}
