import React, { useMemo, useState } from "react";
import {
  MapPin,
  Star,
  Clock,
  Check,
  ExternalLink,
  Compass,
} from "lucide-react";
import SaveTripButton from "@/components/trips/SaveTripButton";

// ─────────────────────────────────────────────────────────────
// ExcursionCard
//
// Photo on the left (on top on phones), then: title, one line of facts
// (where · how long · rating), a short muted description, real tags
// only, and a footer with the price and actions. Nothing is shown that
// Viator didn't send — no placeholder category, no guessed price.
// ─────────────────────────────────────────────────────────────

const CSS = `
  .sk-xc {
    display: flex; min-height: 190px; margin-bottom: 14px; border-radius: 18px; overflow: hidden;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.10);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
  }
  .sk-xc:hover { border-color: rgba(249,115,22,0.35); transform: translateY(-1px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
  .sk-xc-photo { position: relative; width: 220px; flex-shrink: 0; background: rgba(255,255,255,0.06); }
  .sk-xc-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .sk-xc-photo-empty { position: absolute; inset: 0; display: flex; align-items: center;
    justify-content: center; color: rgba(255,255,255,0.25); }
  .sk-xc-body { flex: 1; min-width: 0; padding: 16px 18px 14px; display: flex; flex-direction: column; }
  .sk-xc-title { font-size: 17px; font-weight: 700; line-height: 1.3; color: #fff;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sk-xc-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-top: 6px;
    font-size: 13px; color: rgba(255,255,255,0.65); }
  .sk-xc-facts span { display: inline-flex; align-items: center; gap: 5px; }
  .sk-xc-desc { margin-top: 8px; font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,0.6);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sk-xc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .sk-xc-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600;
    padding: 3px 9px; border-radius: 999px; }
  .sk-xc-tag-good { color: #34d399; background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.3); }
  .sk-xc-tag-cat { color: rgba(255,255,255,0.8); background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.14); }
  .sk-xc-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
    flex-wrap: wrap; margin-top: auto; padding-top: 14px; }
  .sk-xc-price-from { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase;
    letter-spacing: .06em; font-weight: 600; }
  .sk-xc-price { font-size: 22px; font-weight: 800; color: #fff; line-height: 1.1; }
  .sk-xc-price small { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); margin-left: 4px; }
  .sk-xc-actions { display: flex; align-items: center; gap: 8px; }
  .sk-xc-view { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 16px;
    border-radius: 12px; border: 1px solid rgba(249,115,22,0.55); background: rgba(249,115,22,0.12);
    color: #ff8a2a; font: 700 13.5px/1 inherit; font-family: inherit; cursor: pointer;
    transition: background .15s ease, color .15s ease; white-space: nowrap; }
  .sk-xc-view:hover { background: rgba(249,115,22,0.22); color: #fff; }
  .sk-xc-view:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
  .sk-xc-view:disabled { opacity: .45; cursor: not-allowed; }
  @media (max-width: 640px) {
    .sk-xc { flex-direction: column; }
    .sk-xc-photo { width: 100%; height: 180px; }
    .sk-xc-body { padding: 14px 14px 12px; }
  }
  @media (prefers-reduced-motion: reduce) { .sk-xc, .sk-xc:hover { transition: none; transform: none; } }
`;

export default function ExcursionCard({ excursion, fallbackDestination }) {
  const [imgFailed, setImgFailed] = useState(false);
  const title = useMemo(() => excursion?.title || "Experience", [excursion]);

  // Viator product data doesn't reliably include a friendly destination
  // name — fall back to the city the person actually searched.
  const location = useMemo(
    () => excursion?.destination || fallbackDestination || null,
    [excursion, fallbackDestination]
  );

  const price = useMemo(() => {
    const p = Number(excursion?.price);
    if (!Number.isFinite(p) || p <= 0) return null;
    return Number.isInteger(p)
      ? p.toLocaleString("en-US")
      : p.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }, [excursion]);

  // Viator's `tags` are numeric category IDs, not labels. Only show a
  // category when it's a real word — never a made-up "Tour".
  const categoryLabel = useMemo(() => {
    const c = excursion?.category;
    return c && !/^[0-9]+$/.test(String(c).trim()) ? String(c) : null;
  }, [excursion]);

  const rating = Number(excursion?.rating);
  const reviews = Number(excursion?.reviewCount) || 0;

  function handleBook() {
    if (!excursion?.bookingUrl) return;
    window.open(excursion.bookingUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <article className="sk-xc" aria-label={title}>
      <style>{CSS}</style>

      <div className="sk-xc-photo">
        {excursion?.image && !imgFailed ? (
          <img
            src={excursion.image}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="sk-xc-photo-empty" aria-hidden="true">
            <Compass size={34} strokeWidth={1.4} />
          </div>
        )}
      </div>

      <div className="sk-xc-body">
        <h3 className="sk-xc-title" style={{ margin: 0 }} title={title}>
          {title}
        </h3>

        <div className="sk-xc-facts">
          {location && (
            <span>
              <MapPin size={13} aria-hidden="true" />
              {location}
            </span>
          )}
          {excursion?.duration && (
            <span>
              <Clock size={13} aria-hidden="true" />
              {excursion.duration}
            </span>
          )}
          {Number.isFinite(rating) && rating > 0 && (
            <span>
              <Star
                size={13}
                fill="#FFB347"
                color="#FFB347"
                aria-hidden="true"
              />
              <strong style={{ color: "#fff", fontWeight: 700 }}>
                {rating.toFixed(1)}
              </strong>
              {reviews > 0 &&
                ` (${reviews.toLocaleString("en-US")} review${
                  reviews === 1 ? "" : "s"
                })`}
            </span>
          )}
        </div>

        {excursion?.shortDescription && (
          <p className="sk-xc-desc" style={{ marginBottom: 0 }}>
            {excursion.shortDescription}
          </p>
        )}

        {(excursion?.cancellable || categoryLabel) && (
          <div className="sk-xc-tags">
            {excursion?.cancellable && (
              <span className="sk-xc-tag sk-xc-tag-good">
                <Check size={11} aria-hidden="true" /> Free cancellation
              </span>
            )}
            {categoryLabel && (
              <span className="sk-xc-tag sk-xc-tag-cat">{categoryLabel}</span>
            )}
          </div>
        )}

        <div className="sk-xc-foot">
          <div>
            {price ? (
              <>
                <div className="sk-xc-price-from">From</div>
                <div className="sk-xc-price">
                  ${price}
                  <small>{excursion?.currency || "USD"}</small>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                See price on Viator
              </div>
            )}
          </div>
          <div className="sk-xc-actions">
            <SaveTripButton
              size="small"
              variant="ghost"
              label="Save"
              tripData={{
                tripType: "excursion",
                title,
                destination: location,
                price: excursion?.price ?? 0,
                currency: excursion?.currency || "USD",
                metadata: {
                  excursionId: excursion?.id,
                  category: categoryLabel,
                },
              }}
            />
            <button
              type="button"
              className="sk-xc-view"
              onClick={handleBook}
              disabled={!excursion?.bookingUrl}
              aria-label={`View ${title} on Viator (opens in a new tab)`}
            >
              View on Viator <ExternalLink size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
