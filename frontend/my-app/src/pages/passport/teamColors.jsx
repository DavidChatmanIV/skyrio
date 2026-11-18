// "Team Colors" Passport cover: your team's two colors, for any sport, on
// Skyrio's dark-purple passport. The colors go on the accents (border,
// header, labels, sport lines); the base stays Skyrio, and the text always
// stays readable whatever two colors are picked.
//
// No team names or logos anywhere: presets are named by their colors only,
// and anyone can pick any two colors.
// Same lists as backend/config/passportCovers.js (TEAM_PATTERNS, hex check).

export const TEAM_PRESETS = [
  { name: "Purple & Gold", primary: "#552583", secondary: "#FDB927" },
  { name: "Navy & Orange", primary: "#0C2340", secondary: "#F26B21" },
  { name: "Green & Gold", primary: "#203731", secondary: "#FFB612" },
  { name: "Red & Black", primary: "#C8102E", secondary: "#111111" },
  { name: "Royal & White", primary: "#0047AB", secondary: "#FFFFFF" },
  { name: "Teal & Black", primary: "#00788C", secondary: "#101820" },
  { name: "Black & Silver", primary: "#101010", secondary: "#A5ACAF" },
  { name: "Maroon & Gold", primary: "#7A0019", secondary: "#FFC72C" },
  { name: "Kelly Green & White", primary: "#007A33", secondary: "#FFFFFF" },
  { name: "Crimson & Cream", primary: "#9E1B32", secondary: "#F1E6D2" },
  { name: "Sky Blue & Navy", primary: "#6CACE4", secondary: "#0B2265" },
  { name: "Orange & Black", primary: "#FA4616", secondary: "#111111" },
];

export const TEAM_PATTERNS = [
  { key: "none", label: "Plain" },
  { key: "stripes", label: "Jersey stripes" },
  { key: "court", label: "Basketball" },
  { key: "field", label: "Football" },
  { key: "pitch", label: "Soccer" },
  { key: "diamond", label: "Baseball" },
  { key: "rink", label: "Hockey" },
];

export const DEFAULT_TEAM = { primary: "#552583", secondary: "#FDB927", pattern: "stripes" };

const HEX = /^#[0-9a-f]{6}$/i;
/** Only real colors and known patterns get through. */
export function cleanTeam(t) {
  return {
    primary: HEX.test(t?.primary || "") ? t.primary.toUpperCase() : DEFAULT_TEAM.primary,
    secondary: HEX.test(t?.secondary || "") ? t.secondary.toUpperCase() : DEFAULT_TEAM.secondary,
    pattern: TEAM_PATTERNS.some((p) => p.key === t?.pattern) ? t.pattern : DEFAULT_TEAM.pattern,
  };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Relative luminance (WCAG).
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};
const alpha = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;
const SKYRIO_BASE = "#1a1233";
const SKYRIO_ORANGE = "#ffb347";

/**
 * The accent that reads on the dark passport: the brighter of the two team
 * colors, lifted toward white until it's light enough. Both dark (navy and
 * black)? Skyrio orange.
 */
export function teamAccent({ primary, secondary }) {
  const pick = lum(secondary) >= lum(primary) ? secondary : primary;
  if (lum(pick) < 0.03) return SKYRIO_ORANGE;
  let c = pick;
  for (let i = 0; i < 6 && lum(c) < 0.32; i++) c = mix(c, "#ffffff", 0.25);
  return c;
}

/** The cover's CSS for these colors (all values come from cleanTeam). */
// Each passport's colors only apply to that passport (a page can show more
// than one, e.g. the picker's preview next to the real one).
export const teamKey = (team) => {
  const t = cleanTeam(team);
  return `${t.primary}${t.secondary}`.replace(/#/g, "");
};

export function teamCoverCss(team) {
  const { primary, secondary } = cleanTeam(team);
  const T = `.pdp--team[data-team="${teamKey(team)}"]`;
  const accent = teamAccent({ primary, secondary });
  // The base is Skyrio's dark purple, tinted with the team's main color.
  const deep = mix(primary, SKYRIO_BASE, 0.55);
  const deeper = mix(primary, SKYRIO_BASE, 0.8);
  return `
${T}.pdp {
  --pdp-gold: ${alpha(accent, 0.92)};
  --pdp-gold-dim: ${alpha(accent, 0.66)};
  --pdp-line: ${alpha(accent, 0.3)};
  background:
    radial-gradient(110% 80% at 88% 0%, ${alpha(secondary, 0.3)}, transparent 58%),
    radial-gradient(90% 70% at 0% 100%, ${alpha(primary, 0.35)}, transparent 60%),
    linear-gradient(160deg, ${deep} 0%, ${deeper} 52%, ${SKYRIO_BASE} 100%) !important;
  border-color: ${alpha(accent, 0.6)} !important;
  box-shadow: 0 0 0 1px ${alpha(accent, 0.28)}, 0 22px 54px rgba(0,0,0,0.45) !important;
}
${T} .pdp-guilloche path { stroke: ${alpha(accent, 0.13)} !important; }
${T} .pdp-head {
  background: linear-gradient(90deg, ${alpha(primary, 0.55)}, ${alpha(secondary, 0.28)}) !important;
  border-bottom: 3px solid ${alpha(secondary, 0.85)};
  box-shadow: inset 0 -6px 0 -3px ${alpha(primary, 0.9)};
}
${T} .pdp-label { color: ${accent} !important; }
${T} .pdp-name { color: #ffffff !important; }
${T} .pdp-mrz { color: ${alpha(mix(accent, "#ffffff", 0.4), 0.8)} !important; }
.pdp > svg.pdp-sport { position: absolute !important; inset: 0; width: 100%; height: 100%; pointer-events: none; fill: none; }
`;
}

/** The sport's lines, faint, behind the passport's text. */
export function SportLines({ team }) {
  const { primary, secondary, pattern } = cleanTeam(team);
  if (pattern === "none") return null;
  const accent = teamAccent({ primary, secondary });
  const line = { stroke: alpha(accent, 0.2), strokeWidth: 2 };
  const thin = { stroke: alpha(accent, 0.14), strokeWidth: 1.4 };
  const art = {
    // Two jersey sleeve stripes across the lower corner.
    stripes: (
      <g>
        <path d="M-40 520 L640 120" stroke={alpha(secondary, 0.22)} strokeWidth="26" />
        <path d="M-40 575 L640 175" stroke={alpha(primary, 0.4)} strokeWidth="14" />
      </g>
    ),
    court: (
      <g {...line}>
        <rect x="20" y="20" width="560" height="560" rx="6" />
        <line x1="20" y1="300" x2="580" y2="300" />
        <circle cx="300" cy="300" r="70" />
        <path d="M150 580 V430 H450 V580" />
        <path d="M120 580 A180 180 0 0 1 480 580" />
      </g>
    ),
    field: (
      <g {...thin}>
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={30 + i * 54} y1="20" x2={30 + i * 54} y2="580" />
        ))}
        <rect x="20" y="20" width="560" height="560" {...line} />
      </g>
    ),
    pitch: (
      <g {...line}>
        <rect x="20" y="20" width="560" height="560" />
        <line x1="300" y1="20" x2="300" y2="580" />
        <circle cx="300" cy="300" r="80" />
        <rect x="20" y="190" width="90" height="220" />
        <rect x="490" y="190" width="90" height="220" />
      </g>
    ),
    diamond: (
      <g {...line}>
        <path d="M300 560 L120 380 L300 200 L480 380 Z" />
        <circle cx="300" cy="380" r="22" />
        <path d="M300 560 L-60 200 M300 560 L660 200" {...thin} />
      </g>
    ),
    rink: (
      <g {...line}>
        <rect x="20" y="20" width="560" height="560" rx="120" />
        <line x1="300" y1="20" x2="300" y2="580" stroke={alpha(secondary, 0.3)} strokeWidth="5" />
        <line x1="180" y1="20" x2="180" y2="580" {...thin} />
        <line x1="420" y1="20" x2="420" y2="580" {...thin} />
        <circle cx="300" cy="300" r="70" />
      </g>
    ),
  }[pattern];
  return (
    <svg className="pdp-sport" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {art}
    </svg>
  );
}
