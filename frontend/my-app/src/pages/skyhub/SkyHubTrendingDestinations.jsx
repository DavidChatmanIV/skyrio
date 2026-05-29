import React from "react";

// SVG icons
const TrendIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const PinIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const ChevronRight = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default function SkyHubTrendingDestinations({
  items = [],
  loading,
  onSeeAll,
}) {
  return (
    <div
      style={{
        background: "rgba(20,12,42,0.85)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        backdropFilter: "blur(16px)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#ff7a35" }}>
            <TrendIcon />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ecff" }}>
              Trending Destinations
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(240,236,255,0.4)",
                marginTop: 1,
              }}
            >
              Most posted right now
            </div>
          </div>
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#ff7a35",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            See all <ChevronRight />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            fontSize: 13,
            color: "rgba(240,236,255,0.35)",
          }}
        >
          Loading...
        </div>
      ) : items.length === 0 ? (
        /* Empty state — no fake data */
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ marginBottom: 8, color: "rgba(240,236,255,0.18)" }}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(240,236,255,0.35)",
              lineHeight: 1.5,
            }}
          >
            Destinations appear here as
            <br />
            travelers start posting
          </div>
        </div>
      ) : (
        items.map((dest, i) => {
          const name = dest.name || dest.destination || dest.city || "Unknown";
          const posts = dest.posts || dest.postCount || 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                borderBottom:
                  i < items.length - 1
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "none",
                cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: "rgba(255,122,53,0.12)",
                  border: "1px solid rgba(255,122,53,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ff7a35",
                }}
              >
                <PinIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#f0ecff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(240,236,255,0.4)",
                    marginTop: 1,
                  }}
                >
                  {posts > 0
                    ? `${posts.toLocaleString()} posts`
                    : "Be first to post"}
                </div>
              </div>
              <span style={{ color: "rgba(240,236,255,0.25)", flexShrink: 0 }}>
                <ChevronRight />
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
