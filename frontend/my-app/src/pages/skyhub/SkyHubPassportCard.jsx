import React from "react";
import "@/styles/SkyHubPassportCard.css";

export default function SkyHubPassportCard() {
  return (
    <section className="skyhub-sideCard skyhub-passportCard">
      <div className="skyhub-sideTitle">Your Digital Passport</div>
      <div className="skyhub-passportXP">2,340</div>
      <div className="skyhub-passportMeta">XP · Explorer</div>
      <p className="skyhub-sideSubtext">660 XP to Voyager — keep sharing ✦</p>
    </section>
  );
}