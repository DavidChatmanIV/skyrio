// Passport stamps for completed trips.
//
// - stampSvg(): the round ink stamp as an SVG string (city on top, date at
//   the bottom). One source for both what shows on screen and the image
//   people save or share, so the two always match.
// - PassportStamp: renders that stamp in React.
// - shareCardSvg() / shareStampImage(): a 9:16 Story card with the stamp,
//   saved as a PNG and handed to the phone's share sheet (or downloaded).

import React from "react";

// A few ink colours. Each place always gets the same one.
const INKS = ["#0F8A7E", "#C2410C", "#1D4ED8", "#9D174D", "#6D28D9"];

export function stampInk(place = "") {
  let h = 0;
  for (const ch of String(place).toUpperCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return INKS[h % INKS.length];
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "NOV 19 2026" (UTC, like the rest of Travel Journeys)
export function stampDate(d) {
  if (!d) return "";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .replace(",", "")
    .toUpperCase();
}

// Short, stamp-sized place name: "Miami trip" or "Miami International
// Airport" -> "MIAMI". Long names keep the first word so it fits the ring.
const AIRPORT_WORDS = /\b(international|intl|airport|int'l|regional|municipal)\b/gi;
export function stampPlace(j) {
  const fromTitle = String(j.title || "")
    .replace(/^trip to\s+/i, "")
    .replace(/\s+(group\s+)?trip$/i, "");
  const raw =
    j.kind === "sync" && fromTitle && !/→/.test(fromTitle) ? fromTitle : j.place || fromTitle || "Trip";
  const clean = String(raw)
    .split(/[,→·(/-]/)[0]
    .replace(AIRPORT_WORDS, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!clean) return "TRIP";
  return clean.length > 15 ? clean.split(" ")[0].slice(0, 15) : clean;
}

let uid = 0;

// The stamp itself, drawn in a 120 x 120 box.
export function stampSvg({ place, date, ink, size = 120, id }) {
  const arcId = `st-arc-${id ?? ++uid}`;
  const fontSize = place.length > 12 ? 8.5 : place.length > 9 ? 9.5 : 11;
  const spacing = place.length > 12 ? 1.5 : 2.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${esc(
    `${place} stamp, ${date}`
  )}">
<defs><path id="${arcId}" d="M22,62 a38,38 0 1,1 76,0"/></defs>
<g fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">
<circle cx="60" cy="60" r="55" stroke-width="3.5"/>
<circle cx="60" cy="60" r="46" stroke-width="1.4" stroke-dasharray="3 3"/>
<path transform="translate(48 46)" stroke-width="1.8" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
</g>
<text font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${fontSize}" font-weight="700" fill="${ink}" letter-spacing="${spacing}"><textPath href="#${arcId}" startOffset="50%" text-anchor="middle">${esc(
    place
  )}</textPath></text>
<text x="60" y="88" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="9" font-weight="700" fill="${ink}" letter-spacing="1">${esc(
    date
  )}</text>
<text x="60" y="100" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="6" font-weight="700" fill="${ink}" letter-spacing="2">SKYRIO</text>
</svg>`;
}

// Stamp on a small piece of passport paper.
export function PassportStamp({ place, date, ink, size = 96, tilt = -8, className = "" }) {
  return (
    <span
      className={`ps-paper ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      <span
        className="ps-ink"
        style={{ transform: `rotate(${tilt}deg)` }}
        // Built from escaped strings above, never raw user HTML.
        dangerouslySetInnerHTML={{ __html: stampSvg({ place, date, ink, size }) }}
      />
    </span>
  );
}

// 1080 x 1920 Story card.
export function shareCardSvg({ place, date, ink, title, dates, travelers }) {
  const stamp = stampSvg({ place, date, ink, size: 560, id: "share" })
    .replace("<svg ", '<svg x="260" y="560" ');
  const font = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#2A1650"/><stop offset="0.55" stop-color="#130C30"/><stop offset="1" stop-color="#3A1A2E"/></linearGradient></defs>
<rect width="1080" height="1920" fill="url(#bg)"/>
<text x="540" y="330" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="34" font-weight="700" letter-spacing="10" fill="#F6C453">MY SKYRIO PASSPORT</text>
<text x="540" y="430" text-anchor="middle" font-family="${font}" font-size="76" font-weight="800" fill="#FFFFFF">New stamp unlocked</text>
<g transform="rotate(4 540 840)"><rect x="210" y="510" width="660" height="660" rx="64" fill="#F3EAD8"/></g>
<g transform="rotate(-8 540 840)">${stamp}</g>
<text x="540" y="1330" text-anchor="middle" font-family="${font}" font-size="60" font-weight="800" fill="#FFFFFF">${esc(title)}</text>
<text x="540" y="1405" text-anchor="middle" font-family="${font}" font-size="38" fill="#CBBEDD">${esc(
    [dates, travelers].filter(Boolean).join(" · ")
  )}</text>
<text x="540" y="1700" text-anchor="middle" font-family="${font}" font-size="40" font-weight="700" fill="#FFFFFF">Planned with Skyrio</text>
<text x="540" y="1760" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="30" letter-spacing="6" fill="#9C8BB8">MYSKYRIO.COM</text>
</svg>`;
}

// Turns the card into a PNG, then opens the share sheet (phones) or
// downloads it (computers). Returns "shared" | "saved" | "cancelled".
export async function shareStampImage(card, fileName = "skyrio-stamp.png", link = "https://myskyrio.com") {
  const svg = shareCardSvg(card);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: card.title, text: `Planned with Skyrio ✈️ ${link}` });
        return "shared";
      } catch (e) {
        if (e?.name === "AbortError") return "cancelled";
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return "saved";
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const STAMP_CSS = `
.ps-paper { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; border-radius:16px; background:#F3EAD8; box-shadow:inset 0 0 0 1px #E2D3B5; }
.ps-ink { display:inline-flex; opacity:.92; }
.ps-ink svg { display:block; }

.ps-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }
.ps-card { all:unset; box-sizing:border-box; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 10px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); text-align:center; transition:border-color .18s, background .18s; }
.ps-card:hover { border-color:rgba(255,138,42,0.45); background:rgba(255,138,42,0.06); }
.ps-card:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }
.ps-card__name { color:#fff; font-size:13.5px; font-weight:700; line-height:1.3; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ps-card__meta { font-size:12px; color:rgba(255,255,255,0.68); }
.ps-next { box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:150px; padding:12px; border-radius:16px; border:2px dashed rgba(255,255,255,0.18); color:rgba(255,255,255,0.6); font-size:12.5px; font-weight:700; text-align:center; }

.ps-sheet-bg { position:fixed; inset:0; z-index:1000; background:rgba(10,6,24,0.78); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; }
.ps-sheet { width:100%; max-width:380px; max-height:calc(100vh - 32px); overflow:auto; box-sizing:border-box; padding:28px 22px 22px; border-radius:24px; background:radial-gradient(circle at 50% 30%, #4A2A55 0%, #1B1233 70%); border:1px solid rgba(255,255,255,0.12); color:#fff; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; }
.ps-sheet__kicker { font-family:ui-monospace,Menlo,monospace; font-size:11px; font-weight:700; letter-spacing:.2em; color:#F6C453; }
.ps-sheet__title { margin:0; font-size:24px; font-weight:800; line-height:1.15; }
.ps-sheet__meta { font-size:13.5px; color:rgba(255,255,255,0.75); }
.ps-tip { margin:2px 0 0; font-size:12.5px; line-height:1.45; color:rgba(255,255,255,0.7); }
.ps-tip b { color:#fff; }
.ps-sheet__btns { width:100%; display:flex; flex-direction:column; gap:8px; margin-top:6px; }
.ps-btn { all:unset; box-sizing:border-box; cursor:pointer; min-height:48px; display:flex; align-items:center; justify-content:center; gap:8px; border-radius:14px; font-size:15px; font-weight:800; }
.ps-btn--main { background:linear-gradient(135deg,#ff8a2a,#ffb347); color:#1a0e06; }
.ps-btn--ghost { border:1px solid rgba(255,255,255,0.2); color:#fff; font-weight:700; }
.ps-btn:focus-visible { outline:2px solid #ffb347; outline-offset:2px; }
.ps-btn[disabled] { opacity:.6; cursor:default; }
.ps-slam { animation:psSlam .55s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes psSlam { 0% { transform:scale(1.8) rotate(8deg); opacity:0; } 60% { transform:scale(.94) rotate(-2deg); opacity:1; } 100% { transform:scale(1) rotate(0); } }
@media (prefers-reduced-motion: reduce) { .ps-slam { animation:none; } }
`;
