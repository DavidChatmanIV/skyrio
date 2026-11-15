// Tidy place names so the same city always looks and groups the same:
//   "newark nj" / "Newark Nj" / "newark, new jersey"  → "Newark, NJ"
// Same rules as backend/services/placeName.js — keep them in sync.
const STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};
const BY_NAME = new Map(Object.entries(STATES).map(([ab, n]) => [n.toLowerCase(), ab]));
const SMALL = new Set(["of", "de", "la", "del", "da", "do", "the", "and", "on", "upon", "en"]);

const stateCode = (s) => {
  const t = String(s || "").trim();
  if (/^[A-Za-z]{2}$/.test(t) && STATES[t.toUpperCase()]) return t.toUpperCase();
  return BY_NAME.get(t.toLowerCase()) || null;
};

// Only re-case words typed all-lower or ALL-CAPS; keep "McAllen", "LaGuardia".
function niceCase(s) {
  return s
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      const mixed = /[a-z]/.test(w) && /[A-Z]/.test(w) && w !== w[0].toUpperCase() + w.slice(1).toLowerCase();
      if (mixed) return w;
      const lw = w.toLowerCase();
      if (i > 0 && SMALL.has(lw)) return lw;
      return lw.replace(/(^|[-'’.])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
    })
    .join(" ");
}

export function tidyPlace(raw) {
  let s = String(raw || "").replace(/\s+/g, " ").trim().replace(/^[,\s]+|[,\s]+$/g, "");
  if (!s) return "";
  let parts = s.split(",").map((p) => p.trim()).filter(Boolean);

  // "Newark NJ" / "Newark New Jersey" (no comma): split the state off the end.
  if (parts.length === 1) {
    const words = parts[0].split(" ");
    for (const n of [2, 1]) {
      if (words.length > n) {
        const code = stateCode(words.slice(-n).join(" "));
        if (code) {
          parts = [words.slice(0, -n).join(" "), code];
          break;
        }
      }
    }
  }
  return parts
    .map((p, i) => {
      if (i > 0) {
        const code = stateCode(p);
        if (code) return code;
        if (/^[A-Za-z]{2,3}$/.test(p) && p === p.toUpperCase()) return p; // "UK", "USA"
      }
      return niceCase(p);
    })
    .join(", ")
    .slice(0, 120);
}

/** Same place → same key ("Newark Nj" and "newark, NJ" group together). */
export const placeKey = (raw) => tidyPlace(raw).toLowerCase();

