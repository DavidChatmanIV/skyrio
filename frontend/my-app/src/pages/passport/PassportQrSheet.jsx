// "Share my passport" sheet: a Skyrio boarding-pass card with a QR code
// that opens the traveler's public passport (/u/username), where people
// can follow them. Share it anywhere, save the image, or scan a friend's.
//
// The card is one SVG, so what's on screen and the saved image match.
// The QR uses high error correction, so the photo in the middle doesn't
// stop it from scanning.

import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  X,
  Share2,
  Download,
  Link2,
  Check,
  Instagram,
  Facebook,
  Twitter,
  MessageCircle,
  MessageSquareText,
  ScanLine,
} from "lucide-react";

const W = 640;
const H = 900;
const ORANGE = "#ff8a2a";
const AMBER = "#ffb347";
const PURPLE = "#9b5cff";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const initialsOf = (name) =>
  String(name || "S")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "S";

// Photo as a data URL, so the saved image can include it. Null if the
// photo host won't allow it; the card then shows initials.
async function toDataUrl(src) {
  if (!src || src === "/default-avatar.png") return null;
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** The whole card as an SVG string. */
export function buildPassCardSvg({ url, name, username, tier, docNo, photo }) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const box = 392; // QR area
  const ox = (W - box) / 2;
  const oy = 190;
  const cell = box / n;
  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  // Room in the middle for the photo (stays well under what level H fixes).
  const mid = n / 2;
  const hole = n * 0.2;
  const inHole = (r, c) => Math.abs(r + 0.5 - mid) < hole / 2 + 0.6 && Math.abs(c + 0.5 - mid) < hole / 2 + 0.6;

  let dots = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || isFinder(r, c) || inHole(r, c)) continue;
      // Soft rounded squares: round dots look nice but some scanners
      // misread them; these read on every scanner we tested.
      const x = ox + c * cell + cell * 0.04;
      const y = oy + r * cell + cell * 0.04;
      const sz = cell * 0.92;
      dots += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${sz.toFixed(2)}" height="${sz.toFixed(2)}" rx="${(cell * 0.27).toFixed(2)}"/>`;
    }
  }
  const finder = (r, c) => {
    const x = ox + c * cell;
    const y = oy + r * cell;
    const s = cell * 7;
    return `
      <rect x="${x + cell * 0.5}" y="${y + cell * 0.5}" width="${s - cell}" height="${s - cell}" rx="${cell * 1.1}" fill="none" stroke="#3b1a78" stroke-width="${cell}"/>
      <rect x="${x + cell * 2}" y="${y + cell * 2}" width="${cell * 3}" height="${cell * 3}" rx="${cell * 0.6}" fill="#c2410c"/>`;
  };

  const pr = hole * cell * 0.5 + 4; // photo radius
  const pcx = W / 2;
  const pcy = oy + box / 2;
  const photoSvg = photo
    ? `<clipPath id="pc"><circle cx="${pcx}" cy="${pcy}" r="${pr}"/></clipPath>
       <image href="${photo}" x="${pcx - pr}" y="${pcy - pr}" width="${pr * 2}" height="${pr * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`
    : `<circle cx="${pcx}" cy="${pcy}" r="${pr}" fill="url(#band)"/>
       <text x="${pcx}" y="${pcy + 12}" text-anchor="middle" font-size="34" font-weight="800" fill="#fff" font-family="DM Sans, Arial, sans-serif">${esc(initialsOf(name))}</text>`;

  const panelY = oy - 38;
  const stubY = oy + box + 60; // perforation line
  const field = (x, label, value) => `
    <text x="${x}" y="${stubY + 150}" font-size="15" letter-spacing="2" fill="rgba(255,255,255,0.55)" font-family="DM Sans, Arial, sans-serif">${label}</text>
    <text x="${x}" y="${stubY + 180}" font-size="22" font-weight="700" fill="#fff" font-family="DM Sans, Arial, sans-serif">${esc(value)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#341b66"/><stop offset="1" stop-color="#1d0f3e"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ORANGE}"/><stop offset="0.5" stop-color="${AMBER}"/><stop offset="1" stop-color="${PURPLE}"/>
    </linearGradient>
    <linearGradient id="qrg" gradientUnits="userSpaceOnUse" x1="${ox}" y1="${oy}" x2="${ox + box}" y2="${oy + box}">
      <stop offset="0" stop-color="#c2410c"/><stop offset="1" stop-color="#4c1d95"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="44" fill="url(#bg)"/>
  <rect width="${W}" height="120" rx="44" fill="url(#band)"/>
  <rect y="76" width="${W}" height="44" fill="url(#band)"/>
  <text x="48" y="74" font-size="34" font-weight="800" letter-spacing="1" fill="#1a0d04" font-family="DM Sans, Arial, sans-serif">SKYRIO</text>
  <text x="${W - 48}" y="72" text-anchor="end" font-size="16" font-weight="700" letter-spacing="3" fill="#1a0d04" font-family="DM Sans, Arial, sans-serif">DIGITAL PASSPORT</text>
  <rect x="${ox - 38}" y="${panelY}" width="${box + 76}" height="${box + 76}" rx="36" fill="#ffffff"/>
  <g fill="url(#qrg)">${dots}</g>
  ${finder(0, 0)}${finder(0, n - 7)}${finder(n - 7, 0)}
  <circle cx="${pcx}" cy="${pcy}" r="${pr + 8}" fill="#ffffff"/>
  ${photoSvg}
  <line x1="56" y1="${stubY}" x2="${W - 56}" y2="${stubY}" stroke="rgba(255,255,255,0.28)" stroke-width="3" stroke-dasharray="10 12"/>
  <circle cx="0" cy="${stubY}" r="26" fill="#120a26"/>
  <circle cx="${W}" cy="${stubY}" r="26" fill="#120a26"/>
  <text x="48" y="${stubY + 62}" font-size="36" font-weight="800" fill="#fff" font-family="DM Sans, Arial, sans-serif">${esc(String(name || username).slice(0, 26))}</text>
  <text x="48" y="${stubY + 98}" font-size="22" fill="${AMBER}" font-weight="600" font-family="DM Sans, Arial, sans-serif">@${esc(username)}</text>
  ${field(48, "TIER", tier || "Explorer")}
  ${field(250, "PASSPORT NO.", docNo || "")}
  ${field(470, "SCAN TO", "Follow")}
</svg>`;
}

function svgToPngBlob(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const scale = 2;
      const c = document.createElement("canvas");
      c.width = W * scale;
      c.height = H * scale;
      const ctx = c.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png");
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

const BTN = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "12px 6px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(160deg, rgba(86,48,130,0.55), rgba(44,24,82,0.72))",
  color: "#fff",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

export default function PassportQrSheet({
  user,
  name: nameProp,
  tier,
  docNo,
  publicSite,
  onShared,
  onClose,
}) {
  const username = user?.username || "";
  // Same name the passport page shows, so the card matches it.
  const name = nameProp || user?.name || user?.displayName || username;
  // ?ref= gives the friend +50 XP when they join (referral.routes.js).
  const link = `${publicSite}/u/${encodeURIComponent(username)}?ref=${encodeURIComponent(username)}`;
  const shortLink = `${publicSite.replace(/^https?:\/\//, "")}/u/${username}`;
  const pitch = "Follow my travels on Skyrio";

  const [photo, setPhoto] = useState(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    toDataUrl(user?.avatar).then((p) => live && setPhoto(p));
    return () => {
      live = false;
    };
  }, [user?.avatar]);

  // Lock the page and hide floating buttons while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("ap-is-open");
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove("ap-is-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const svg = useMemo(
    () => (username ? buildPassCardSvg({ url: link, name, username, tier, docNo, photo }) : ""),
    [link, name, username, tier, docNo, photo]
  );
  const svgUrl = useMemo(
    () => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ""),
    [svg]
  );

  const flash = (msg) => {
    setNote(msg);
    setTimeout(() => setNote(""), 3000);
  };
  const shared = () => onShared?.();

  const imageFile = async () => {
    const blob = await svgToPngBlob(svg);
    return new File([blob], `skyrio-passport-${username}.png`, { type: "image/png" });
  };

  const download = async () => {
    try {
      const file = await imageFile();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      flash("Saved. Post it anywhere.");
      shared();
    } catch {
      flash("Couldn't save the image. Try again.");
    }
  };

  // Native share sheet: every app on the phone (Instagram, TikTok, Snapchat…).
  const shareAnywhere = async ({ withImage = false } = {}) => {
    try {
      if (withImage) {
        const file = await imageFile();
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: `${pitch} ${link}` });
          shared();
          return;
        }
        // Can't share images here: save it instead.
        await download();
        flash("Saved. Open Instagram and add it to your story.");
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: `${name} on Skyrio`, text: pitch, url: link });
        shared();
        return;
      }
      await copy();
    } catch (err) {
      if (err?.name !== "AbortError") await copy();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      shared();
    } catch {
      window.prompt("Copy your passport link:", link);
    }
  };

  const openApp = (href) => {
    window.open(href, "_blank", "noopener,noreferrer");
    shared();
  };
  const text = encodeURIComponent(`${pitch} ${link}`);
  const PLATFORMS = [
    { label: "Instagram", Icon: Instagram, onClick: () => shareAnywhere({ withImage: true }) },
    { label: "WhatsApp", Icon: MessageCircle, onClick: () => openApp(`https://wa.me/?text=${text}`) },
    {
      label: "X",
      Icon: Twitter,
      onClick: () =>
        openApp(`https://twitter.com/intent/tweet?text=${encodeURIComponent(pitch)}&url=${encodeURIComponent(link)}`),
    },
    {
      label: "Facebook",
      Icon: Facebook,
      onClick: () => openApp(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`),
    },
    { label: "Messages", Icon: MessageSquareText, onClick: () => openApp(`sms:?&body=${text}`) },
    { label: "Save image", Icon: Download, onClick: download },
  ];

  const scan = async () => {
    // iPhone and most Androids scan straight from the Camera app, and the
    // link opens the friend's passport.
    flash("Open your Camera app and point it at a friend's Skyrio code.");
  };

  if (!username) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 2147483645, background: "rgba(10,4,24,0.7)" }}
      />
      <div
        role="dialog"
        aria-label="Share my Digital Passport"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2147483646,
          maxWidth: 520,
          margin: "0 auto",
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "linear-gradient(180deg, #2c1757 0%, #1d0f3e 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "24px 24px 0 0",
          padding: "14px 18px calc(22px + env(safe-area-inset-bottom, 0px))",
          fontFamily: "'DM Sans', sans-serif",
          color: "#fff",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Share my Digital Passport</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              Scan or tap to follow you on Skyrio.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.75)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* The card */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <img
            src={svgUrl}
            alt={`Skyrio passport QR code for @${username}`}
            style={{
              width: "min(300px, 78vw)",
              height: "auto",
              borderRadius: 22,
              boxShadow: "0 18px 44px rgba(124,58,237,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          />
        </div>

        {/* Main action: every app on the phone */}
        <button
          type="button"
          onClick={() => shareAnywhere()}
          style={{
            width: "100%",
            minHeight: 50,
            border: 0,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${ORANGE}, ${AMBER})`,
            color: "#1a0d04",
            fontWeight: 800,
            fontSize: 16,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          <Share2 size={18} aria-hidden="true" /> Share to any app
        </button>

        {/* Quick picks */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {PLATFORMS.map(({ label, Icon, onClick }) => (
            <button key={label} type="button" style={BTN} onClick={onClick}>
              <Icon size={20} color={AMBER} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Link */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(20,10,44,0.55)",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: 10,
          }}
        >
          <Link2 size={16} color="rgba(255,255,255,0.6)" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>
            {shortLink}
          </span>
          <button
            type="button"
            onClick={copy}
            style={{
              border: 0,
              background: "none",
              color: copied ? "#6ee7b7" : AMBER,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {copied ? <Check size={15} aria-hidden="true" /> : null}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          type="button"
          onClick={scan}
          style={{ ...BTN, flexDirection: "row", width: "100%", fontSize: 14, padding: "11px 12px" }}
        >
          <ScanLine size={18} color={AMBER} aria-hidden="true" /> Scan a friend&apos;s code
        </button>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 10, lineHeight: 1.45 }}>
          {note || "Share once a day for +10 XP. Friends who join with your link get +50 XP, and you get +150 XP when they book their first trip."}
        </div>
      </div>
    </>
  );
}
