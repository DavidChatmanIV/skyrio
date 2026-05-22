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
    width="14"
    height="14"
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
    width="14"
    height="14"
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

export default function SkyHubActiveTravelers({
  travelers = [],
  loading,
  onViewAll,
}) {
  // Show nothing (no fallback) — only real users from the database
  const list = travelers;

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
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ecff" }}>
              Active Travelers
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(240,236,255,0.4)",
                marginTop: 1,
              }}
            >
              {list.length > 0
                ? `${list.length} online now`
                : "Join the community"}
            </div>
          </div>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
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
            View all <ChevronRight />
          </button>
        )}
      </div>

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
      ) : list.length === 0 ? (
        <div style={{ padding: "20px 16px", textAlign: "center" }}>
          <div style={{ marginBottom: 8 }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(240,236,255,0.2)"
              strokeWidth="1.5"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div style={{ fontSize: 12, color: "rgba(240,236,255,0.35)" }}>
            No active travelers yet
          </div>
        </div>
      ) : (
        list.map((t, i) => {
          const name = t.name || t.authorName || "Traveler";
          const location = t.location || t.destination || "";
          const badge = t.badge || "Explorer";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                borderBottom:
                  i < list.length - 1
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
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar name={name} avatar={t.avatar} size={36} idx={i} />
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#22c55e",
                    border: "1.5px solid rgba(20,12,42,0.9)",
                  }}
                />
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
                {location && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(240,236,255,0.4)",
                      marginTop: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span style={{ color: "rgba(240,236,255,0.3)" }}>
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
                  background: "rgba(255,122,53,0.12)",
                  color: "#ff9f6b",
                  border: "1px solid rgba(255,122,53,0.2)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {badge}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
