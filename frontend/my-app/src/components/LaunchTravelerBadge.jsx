import { useId } from "react";

// Launch Traveler badge: for travelers who booked during Skyrio's launch
// window and took the trip. One mark used everywhere (Passport card, public
// passport, admin), so it always looks the same.

export const LAUNCH_TRAVELER_NAME = "Launch Traveler";

/** Round medal: orange→purple ring, plane taking off, launch spark. */
export default function LaunchTravelerBadge({ size = 44, muted = false, title }) {
  const raw = useId().replace(/:/g, "");
  const ring = `ltRing${raw}`;
  const face = `ltFace${raw}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title || LAUNCH_TRAVELER_NAME}
      style={{ flex: "0 0 auto", opacity: muted ? 0.55 : 1, filter: muted ? "grayscale(0.6)" : "none" }}
    >
      <title>{title || LAUNCH_TRAVELER_NAME}</title>
      <defs>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="50%" stopColor="#ff8a2a" />
          <stop offset="100%" stopColor="#8b5cff" />
        </linearGradient>
        <radialGradient id={face} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#4a2a86" />
          <stop offset="100%" stopColor="#24124a" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${ring})`} />
      <circle cx="24" cy="24" r="18.5" fill={`url(#${face})`} />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
      {/* climb path */}
      <path
        d="M12 33 C 18 32, 24 28, 30 21"
        fill="none"
        stroke="rgba(255,179,71,0.55)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="1.2 2.6"
      />
      {/* plane, nose up and to the right */}
      <g transform="translate(31 19) rotate(-40) translate(-8 -8)">
        <path
          d="M14.2 9.1v-1.2L9.4 4.9V1.7A.9.9 0 0 0 8.5.8a.9.9 0 0 0-.9.9v3.2L2.8 7.9v1.2l4.8-1.5v3.3l-1.2.9v.9l2.1-.6 2.1.6v-.9l-1.2-.9V7.6z"
          transform="rotate(90 8 8)"
          fill="#ffffff"
        />
      </g>
      {/* launch spark */}
      <path
        d="M15 14.5l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z"
        fill="#ffb347"
      />
    </svg>
  );
}
