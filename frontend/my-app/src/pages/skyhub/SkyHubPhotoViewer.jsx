// ─────────────────────────────────────────────────────────────
// SkyHub photo viewer — click (or tap) any photo in a post to see it
// full-size. Works for every post without changing the feed cards: it
// listens for clicks on photos inside .skyhub-feedCard.
//
//   - whole photo, never cropped
//   - arrows / swipe-free buttons for posts with several photos
//   - Esc, the X, or a click outside closes it
//   - the Atlas and Help buttons hide while it's open
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const CSS = `
.skyhub-feedCard .skyhub-feedCard__media img,
.skyhub-feedCard img.sh-zoomable { cursor: zoom-in; }
html.sh-viewer-open .ap-fab-wrapper,
html.sh-viewer-open [data-sr-root] { display: none !important; }
.sh-viewer { position: fixed; inset: 0; z-index: 2000000; display: flex; align-items: center; justify-content: center;
  background: rgba(14,6,28,.92); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); padding: 56px 16px 64px; }
.sh-viewer img { max-width: min(1200px, 100%); max-height: 100%; object-fit: contain; border-radius: 12px;
  box-shadow: 0 24px 70px rgba(0,0,0,.6); background: rgba(255,255,255,.04); }
.sh-viewer button { position: absolute; display: flex; align-items: center; justify-content: center; cursor: pointer;
  width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,.25);
  background: rgba(74,40,112,.8); color: #fff; }
.sh-viewer button:hover { background: rgba(124,92,252,.6); }
.sh-viewer button:focus-visible { outline: 2px solid #ffb347; outline-offset: 2px; }
.sh-viewer__close { top: 14px; right: 14px; }
.sh-viewer__prev { left: 14px; top: 50%; transform: translateY(-50%); }
.sh-viewer__next { right: 14px; top: 50%; transform: translateY(-50%); }
.sh-viewer__count { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  font-size: 13px; font-weight: 700; color: rgba(255,255,255,.85); }
`;

// Big enough to be a post photo (avatars and icons are small).
const isPostPhoto = (img) =>
  img.closest(".skyhub-feedCard") && img.getBoundingClientRect().width >= 120;

export default function SkyHubPhotoViewer() {
  const [view, setView] = useState(null); // { srcs, i }

  // Open from any photo click inside a feed card.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented) return; // the card handled it itself
      const img = e.target?.closest?.("img");
      if (!img || !isPostPhoto(img)) return;
      const card = img.closest(".skyhub-feedCard");
      const imgs = [...card.querySelectorAll("img")].filter(isPostPhoto);
      const srcs = imgs.map((x) => x.currentSrc || x.src);
      const i = Math.max(0, imgs.indexOf(img));
      e.preventDefault();
      e.stopPropagation();
      setView({ srcs, i });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const close = useCallback(() => setView(null), []);
  const step = useCallback(
    (d) =>
      setView((v) =>
        v ? { ...v, i: (v.i + d + v.srcs.length) % v.srcs.length } : v
      ),
    []
  );

  useEffect(() => {
    if (!view) return undefined;
    const root = document.documentElement;
    root.classList.add("sh-viewer-open");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("sh-viewer-open");
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [view, close, step]);

  return (
    <>
      <style>{CSS}</style>
      {view &&
        createPortal(
          <div
            className="sh-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Photo"
            onClick={(e) => e.target === e.currentTarget && close()}
          >
            <img src={view.srcs[view.i]} alt="" />
            <button
              type="button"
              className="sh-viewer__close"
              onClick={close}
              aria-label="Close photo"
              autoFocus
            >
              <X size={20} aria-hidden="true" />
            </button>
            {view.srcs.length > 1 && (
              <>
                <button
                  type="button"
                  className="sh-viewer__prev"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="sh-viewer__next"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
                <div className="sh-viewer__count">
                  {view.i + 1} / {view.srcs.length}
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
