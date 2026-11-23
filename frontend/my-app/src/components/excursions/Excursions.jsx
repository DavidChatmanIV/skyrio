import React, { useMemo } from "react";
import { Button } from "antd";
import { MapPin, Star } from "lucide-react";
import SaveTripButton from "@/components/trips/SaveTripButton";

// ─────────────────────────────────────────────────────────────
// ExcursionCard
// Rebuilt to match the exact markup/classes flights & hotels use
// (sk-result-card, sk-resultTitle, sk-tagRow, etc.) instead of
// raw antd Card/Typography/Tag/Rate, which render with antd's
// default LIGHT theme (white bg, black text) — that mismatch is
// why the old cards looked out of place against Skyrio's dark
// glass design.
// ─────────────────────────────────────────────────────────────
export default function ExcursionCard({ excursion, onSaveTrip }) {
  const title = useMemo(() => excursion?.title || "Experience", [excursion]);
  const location = useMemo(
    () => excursion?.destination || "Destination",
    [excursion]
  );
  const price = useMemo(() => {
    const p = excursion?.price;
    return typeof p === "number" ? p.toFixed(0) : p ? String(p) : null;
  }, [excursion]);

  return (
    <div className="sk-result-card" style={{ marginBottom: 14 }}>
      <div className="sk-resultRow">
        <div
          className="sk-thumb"
          style={
            excursion?.image
              ? {
                  backgroundImage: `url(${excursion.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="sk-resultMain">
          <div className="sk-resultTop">
            <div>
              <div className="sk-resultTitle">{title}</div>
              <div className="sk-resultMeta">
                <span className="sk-metaItem">
                  <MapPin
                    size={12}
                    style={{ marginRight: 3, verticalAlign: "middle" }}
                  />
                  {location}
                </span>
                {excursion?.duration && (
                  <>
                    <span className="sk-metaDot">·</span>
                    <span className="sk-metaItem">{excursion.duration}</span>
                  </>
                )}
                {excursion?.rating != null && (
                  <>
                    <span className="sk-metaDot">·</span>
                    <span className="sk-metaItem">
                      <Star
                        size={12}
                        fill="#FFB347"
                        color="#FFB347"
                        style={{ marginRight: 3, verticalAlign: "middle" }}
                      />
                      {excursion.rating.toFixed(1)}
                      {excursion?.reviewCount
                        ? ` (${excursion.reviewCount.toLocaleString()})`
                        : ""}
                    </span>
                  </>
                )}
              </div>
              {excursion?.shortDescription && (
                <div className="sk-pickedWhy">{excursion.shortDescription}</div>
              )}
            </div>

            <div className="sk-resultRight">
              <div className="sk-priceLine">
                <span className="sk-priceAmt">{price ? `$${price}` : "—"}</span>
                <span className="sk-priceSub">
                  {excursion?.currency || "USD"}
                </span>
              </div>
              <SaveTripButton
                size="small"
                variant="ghost"
                label="Save"
                tripData={{
                  tripType: "excursion",
                  title,
                  destination: excursion?.destination,
                  price: excursion?.price ?? 0,
                  currency: excursion?.currency || "USD",
                  metadata: {
                    excursionId: excursion?.id,
                    category: excursion?.category,
                  },
                }}
                onSaveConfirmed={() => onSaveTrip?.(excursion)}
              />
              {/* A real link, not window.open (blank tab in Chrome on iPhone). */}
              <Button
                className="sk-btn-orange"
                size="small"
                href={excursion?.bookingUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!excursion?.bookingUrl}
              >
                View on Viator
              </Button>
            </div>
          </div>

          <div className="sk-tagRow">
            {excursion?.category && (
              <span className="sk-tag sk-tag-orange">{excursion.category}</span>
            )}
            {excursion?.cancellable && (
              <span className="sk-tag sk-tag-good">Free cancellation</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
