import React, { useMemo } from "react";
import { Button } from "antd";
import { MapPin, Star } from "lucide-react";
import SaveTripButton from "@/components/trips/SaveTripButton";

// ─────────────────────────────────────────────────────────────
// ExcursionCard
// ─────────────────────────────────────────────────────────────
export default function ExcursionCard({ excursion, fallbackDestination }) {
  const title = useMemo(() => excursion?.title || "Experience", [excursion]);

  // Viator product data doesn't reliably include a friendly
  // destination name — fall back to the city the person actually
  // searched rather than showing a literal "Destination" placeholder.
  const location = useMemo(
    () => excursion?.destination || fallbackDestination || null,
    [excursion, fallbackDestination]
  );

  const price = useMemo(() => {
    const p = excursion?.price;
    return typeof p === "number" ? p.toFixed(0) : p ? String(p) : null;
  }, [excursion]);

  // Viator's `tags` field is an array of numeric category IDs, not
  // display-ready labels — filter those out so we don't render raw
  // numbers like "11929" as if they were a category name. Fall back
  // to "Tour" so the tag row is never empty — Hotel cards always
  // show at least Refundable/Non-refundable in this same spot, and
  // an empty tag row here left a visible gap by comparison.
  const categoryLabel = useMemo(() => {
    const c = excursion?.category;
    if (c && !/^[0-9]+$/.test(String(c).trim())) return c;
    return "Tour";
  }, [excursion]);

  function handleBook() {
    if (!excursion?.bookingUrl) return;
    window.open(excursion.bookingUrl, "_blank", "noopener,noreferrer");
  }

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
                {location && (
                  <span className="sk-metaItem">
                    <MapPin
                      size={12}
                      style={{ marginRight: 3, verticalAlign: "middle" }}
                    />
                    {location}
                  </span>
                )}
                {excursion?.duration && (
                  <>
                    {location && <span className="sk-metaDot">·</span>}
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
                  destination: location,
                  price: excursion?.price ?? 0,
                  currency: excursion?.currency || "USD",
                  metadata: {
                    excursionId: excursion?.id,
                    category: categoryLabel,
                  },
                }}
              />
              <Button
                className="sk-btn-orange"
                size="small"
                onClick={handleBook}
              >
                View on Viator
              </Button>
            </div>
          </div>

          <div className="sk-tagRow">
            <span className="sk-tag sk-tag-orange">{categoryLabel}</span>
            {excursion?.cancellable && (
              <span className="sk-tag sk-tag-good">Free cancellation</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
