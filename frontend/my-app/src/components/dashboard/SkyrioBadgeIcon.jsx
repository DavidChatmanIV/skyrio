import React from "react";

export default function SkyrioBadgeIcon({
  type = "explorer",
  size = 72,
  className = "",
}) {
  // This component draws in a 24x24 coordinate system.
  // If you pass size=72, it scales cleanly.
  const base = {
    width: size,
    height: size,
    fill: "none",
    stroke: "url(#skyrioGrad)",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: `skyrio-badge-icon ${className}`.trim(),
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
  };

  switch (type) {
    // 🧭 Explorer (compass)
    case "explorer":
      return (
        <svg {...base} aria-label="Explorer badge icon">
          <circle cx="12" cy="12" r="10" />
          <polygon points="12 6 15 15 12 13 9 15 12 6" />
        </svg>
      );

    // 🌍 Globe Collector
    case "globe":
      return (
        <svg {...base} aria-label="Globe badge icon">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <ellipse cx="12" cy="12" rx="4" ry="10" />
        </svg>
      );

    // 🧾 Budget Master (receipt/card)
    case "budget":
      return (
        <svg {...base} aria-label="Budget badge icon">
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <line x1="8" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="13" y2="14" />
        </svg>
      );

    // ✅ Planner Pro (clipboard check)
    case "planner":
      return (
        <svg {...base} aria-label="Planner badge icon">
          <rect x="7" y="4" width="10" height="4" rx="1" />
          <rect x="6" y="7" width="12" height="14" rx="2" />
          <polyline points="8.5 14 10.8 16.3 15.8 11.3" />
        </svg>
      );

    // 🛡️ Verified Traveler (shield/check)
    case "verified":
      return (
        <svg {...base} aria-label="Verified badge icon">
          <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
          <polyline points="8.5 12.5 11 15 16 10" />
        </svg>
      );

    // 🤝 Community Helper (heart + hand vibe)
    case "helper":
      return (
        <svg {...base} aria-label="Helper badge icon">
          <path d="M12 21s-7-4.6-9.2-9C1.2 8.6 3.3 6 6 6c1.6 0 3 .8 3.9 2 1-1.2 2.3-2 4-2 2.7 0 4.8 2.6 3.2 6-2.2 4.4-9.1 9-9.1 9z" />
          <path d="M4 16c2.2 0 3.2-1.4 4.6-1.4S11 16 12.5 16s2.8-1.4 4.5-1.4S20 16 20 16" />
        </svg>
      );

    // 🏷️ Deal Hunter (tag)
    case "deal":
      return (
        <svg {...base} aria-label="Deal badge icon">
          <path d="M20 13l-7 7-11-11V2h7L20 13z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      );

    // ✈️ First Flight (plane)
    case "firstFlight":
      return (
        <svg {...base} aria-label="First flight badge icon">
          <path d="M2 16l20-6-20-6 6 6h8-8l-6 6z" />
          <line x1="9" y1="10" x2="9" y2="14" />
        </svg>
      );

    // 🌙 Night Owl (moon)
    case "nightOwl":
      return (
        <svg {...base} aria-label="Night owl badge icon">
          <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z" />
          <circle cx="16.8" cy="7.2" r="0.8" />
        </svg>
      );

    // 🔥 Limited (flame)
    case "limited":
      return (
        <svg {...base} aria-label="Limited badge icon">
          <path d="M12 2C10 6 6 9 6 14a6 6 0 0 0 12 0c0-5-4-8-6-12z" />
          <path d="M10.5 20c-1.5-1-2.5-2.5-2.5-4.2 0-1.8 1-3.1 2.1-4.3.4 1.5 1.5 2.4 2.6 3.3 1 .8 1.8 1.6 1.8 3 0 1.2-.5 2.2-1.5 2.2" />
        </svg>
      );

    // 📍 Pin
    case "pin":
      return (
        <svg {...base} aria-label="Pin badge icon">
          <path d="M12 22s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      );

    // ✨ Sparkle
    case "sparkle":
      return (
        <svg {...base} aria-label="Sparkle badge icon">
          <path d="M12 2l1.2 5.1L18 8.3l-4.8 1.2L12 15l-1.2-5.5L6 8.3l4.8-1.2L12 2z" />
          <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14z" />
        </svg>
      );

    default:
      // fallback to explorer so we never render null
      return (
        <svg {...base} aria-label="Badge icon">
          <circle cx="12" cy="12" r="10" />
          <polygon points="12 6 15 15 12 13 9 15 12 6" />
        </svg>
      );
  }
}