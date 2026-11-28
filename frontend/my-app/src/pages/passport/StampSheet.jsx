// Full-screen view of one passport stamp.
// celebrate = true is the "Stamp earned" moment right after a trip ends
// (the stamp slams down); otherwise it's just opening a stamp to look at
// or share it.

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2 } from "lucide-react";
import { message } from "antd";
import {
  PassportStamp,
  STAMP_CSS,
  shareStampImage,
  stampDate,
  stampInk,
  stampPlace,
} from "./PassportStamp";

export default function StampSheet({ j, dates, celebrate, onClose }) {
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(null);
  const place = stampPlace(j);
  const date = stampDate(j.end || j.start);
  const ink = stampInk(place);
  const travelers = j.travelers > 1 ? `${j.travelers} travelers` : "";

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    setBusy(true);
    try {
      const r = await shareStampImage(
        { place, date, ink, title: j.title, dates, travelers },
        `skyrio-${place.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-stamp.png`
      );
      if (r === "saved") message.success("Stamp saved. Post it to your Story!");
    } catch {
      message.error("Couldn't make the image. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="ps-sheet-bg" onClick={onClose}>
      <style>{STAMP_CSS}</style>
      <div
        className="ps-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ps-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ps-sheet__kicker">
          {celebrate ? "TRIP COMPLETE" : "PASSPORT STAMP"}
        </div>
        <h2 id="ps-sheet-title" className="ps-sheet__title">
          {celebrate ? "New stamp earned!" : j.title}
        </h2>
        <PassportStamp
          place={place}
          date={date}
          ink={ink}
          size={200}
          className={celebrate ? "ps-slam" : ""}
        />
        {celebrate && <div style={{ fontSize: 17, fontWeight: 800 }}>{j.title}</div>}
        <div className="ps-sheet__meta">
          {[dates, travelers].filter(Boolean).join(" · ")}
        </div>
        <div className="ps-sheet__btns">
          <button type="button" className="ps-btn ps-btn--main" onClick={share} disabled={busy}>
            <Share2 size={17} aria-hidden="true" />
            {busy ? "Making your image…" : "Share my stamp"}
          </button>
          <button type="button" className="ps-btn ps-btn--ghost" onClick={onClose} ref={closeRef}>
            {celebrate ? "Nice!" : "Close"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
