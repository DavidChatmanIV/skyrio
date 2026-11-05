import React from "react";

const AV_BG = [
  "linear-gradient(135deg,#ff7a35,#c94f10)",
  "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  "linear-gradient(135deg,#10b981,#065f46)",
  "linear-gradient(135deg,#f59e0b,#b45309)",
];

const UsersIcon = () => (
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
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const PinIcon = () => (
  <svg
    width="11"
    height="11"
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

function Avatar({ name, avatar, size = 36, idx = 0 }) {
  const init = (name || "?").slice(0, 2).toUpperCase();
  if (avatar)
    return (
      <img
        src={avatar}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.12)",
        }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: AV_BG[idx % AV_BG.length],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.33,
        color: "#fff",
      }}
    >
      {init}
    </div>
  );
}

// travelers: who to show now. total: how many in all. onPick(traveler):
// tapping a row opens their public Passport.
export default function SkyHubActiveTravelers({
  travelers = [],
  total = travelers.length,
  expanded = false,
  loading,
  onViewAll,
  onPick,
}) {
  const canExpand = onViewAll && (expanded || total > travelers.length);
  return (
    <div
      style={{
        position: "relative",
        background:
          "linear-gradient(160deg, rgba(74,40,112,0.6) 0%, rgba(34,18,62,0.7) 100%)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 44px rgba(12,4,28,0.38)",
        borderRadius: 16,
        backdropFilter: "blur(16px) saturate(150%)",
        WebkitBackdropFilter: "blur(16px) saturate(150%)",
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
            <UsersIcon />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Active Travelers
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.6)",
                marginTop: 1,
              }}
            >
              {/* They've posted recently; we don't know who's online. */}
              {total > 0 ? "Posted recently" : "Join the community"}
            </div>
          </div>
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={onViewAll}
            aria-expanded={expanded}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              color: "#ffb347",
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "4px 0",
              fontFamily: "inherit",
            }}
          >
            {expanded ? "Show less" : `See all ${total}`}
            <span
              style={{
                display: "inline-flex",
                transform: expanded ? "rotate(-90deg)" : "rotate(90deg)",
                transition: "transform .15s",
              }}
            >
              <ChevronRight />
            </span>
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
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Loading...
        </div>
      ) : travelers.length === 0 ? (
        /* Clean empty state — no fake traveler names */
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ marginBottom: 8, color: "rgba(255,255,255,0.3)" }}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
            }}
          >
            No active travelers yet.
            <br />
            Be the first to explore!
          </div>
        </div>
      ) : (
        travelers.map((t, i) => {
          const name = t.name || t.authorName || "Traveler";
          const location = t.location || t.destination || "";
          const badge = t.badge || "Explorer";
          const canOpen = Boolean(onPick && t.username);
          return (
            <button
              type="button"
              key={i}
              disabled={!canOpen}
              onClick={() => canOpen && onPick(t)}
              aria-label={canOpen ? `Open ${name}'s Passport` : name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "11px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  i < travelers.length - 1
                    ? "1px solid rgba(255,255,255,0.07)"
                    : "none",
                cursor: canOpen ? "pointer" : "default",
                transition: "background 0.12s",
                textAlign: "left",
                fontFamily: "inherit",
                color: "inherit",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar name={name} avatar={t.avatar} size={36} idx={i} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
                {location && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.6)",
                      marginTop: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      <PinIcon />
                    </span>
                    {location}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  background: "rgba(255,122,53,0.12)",
                  color: "#ff9f6b",
                  border: "1px solid rgba(255,122,53,0.2)",
                }}
              >
                {badge}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
