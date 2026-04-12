import React from "react";
import "@/styles/SkyHubActiveTravelers.css";

function getTravelerInitials(name = "Traveler") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getTravelerAvatarClass(seed = "") {
  const classes = [
    "skyhub-avatar-orange",
    "skyhub-avatar-blue",
    "skyhub-avatar-green",
    "skyhub-avatar-purple",
    "skyhub-avatar-pink",
  ];

  let total = 0;
  for (let i = 0; i < seed.length; i += 1) {
    total += seed.charCodeAt(i);
  }

  return classes[total % classes.length];
}

export default function SkyHubActiveTravelers({ travelers = [] }) {
  return (
    <section className="skyhub-sideCard">
      <div className="skyhub-sideHeader">
        <h3 className="skyhub-sideTitle">Active Travelers</h3>
        <button type="button" className="skyhub-sideLink">
          View all →
        </button>
      </div>

      <div className="skyhub-activeTravelerList">
        {travelers.length ? (
          travelers.map((traveler) => (
            <button
              key={traveler.id}
              type="button"
              className="skyhub-activeTravelerItem"
            >
              <div
                className={`skyhub-activeTravelerAvatar ${getTravelerAvatarClass(
                  traveler.name || traveler.username || "Traveler"
                )}`}
              >
                {traveler.avatar
                  ? traveler.avatar
                  : getTravelerInitials(
                      traveler.name || traveler.username || "Traveler"
                    )}
                <span className="skyhub-onlineDot" />
              </div>

              <div className="skyhub-activeTravelerMeta">
                <div className="skyhub-activeTravelerTopRow">
                  <div className="skyhub-activeTravelerName">
                    {traveler.name || "Traveler"}
                  </div>
                  {traveler.badge ? (
                    <span className="skyhub-activeTravelerBadge">
                      {traveler.badge}
                    </span>
                  ) : null}
                </div>

                <div className="skyhub-activeTravelerSub">
                  {traveler.username
                    ? `@${String(traveler.username).replace(/^@/, "")}`
                    : "@traveler"}
                </div>

                <div className="skyhub-activeTravelerInfoRow">
                  {traveler.location ? (
                    <span>{traveler.location}</span>
                  ) : (
                    <span>Traveling now</span>
                  )}

                  {traveler.status ? (
                    <span className="skyhub-activeTravelerStatus">
                      {traveler.status}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="skyhub-activeTravelerArrow">→</div>
            </button>
          ))
        ) : (
          <div className="skyhub-miniEmptyState">No active travelers yet.</div>
        )}
      </div>
    </section>
  );
}