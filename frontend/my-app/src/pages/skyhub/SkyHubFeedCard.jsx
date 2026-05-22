import React, { useState } from "react";
import { Dropdown } from "antd";
import {
  MoreOutlined,
  FlagOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

const TYPE_META = {
  Tip: { e: "💡", c: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  Question: { e: "❓", c: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  Story: { e: "📖", c: "#34d399", bg: "rgba(52,211,153,0.1)" },
  Photo: { e: "📷", c: "#f472b6", bg: "rgba(244,114,182,0.1)" },
  "Join Trip": { e: "✈️", c: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
};

const AV_COLORS = [
  "linear-gradient(135deg,#ff7a35,#e05010)",
  "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  "linear-gradient(135deg,#10b981,#065f46)",
  "linear-gradient(135deg,#f59e0b,#b45309)",
];

function Avatar({ name, avatarUrl, size = 44 }) {
  const init = (name || "T").slice(0, 2).toUpperCase();
  const color = AV_COLORS[(name || "T").charCodeAt(0) % AV_COLORS.length];
  if (
    avatarUrl &&
    typeof avatarUrl === "string" &&
    avatarUrl.startsWith("http")
  ) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.15)",
        }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.34,
        color: "#fff",
        userSelect: "none",
      }}
    >
      {init}
    </div>
  );
}

// ── Twitter-style image grid ───────────────────────────────
function ImageGrid({ images }) {
  const [failed, setFailed] = useState({});
  if (!images?.length) return null;
  const vis = images.filter((_, i) => !failed[i]);
  if (!vis.length) return null;
  const fail = (i) => setFailed((f) => ({ ...f, [i]: true }));
  const img = (src, i, style = {}) => (
    <img
      key={i}
      src={src}
      alt=""
      loading="lazy"
      onError={() => fail(i)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        ...style,
      }}
    />
  );
  const wrap = (children, gridStyle = {}) => (
    <div
      style={{
        marginTop: 10,
        borderRadius: 12,
        overflow: "hidden",
        ...gridStyle,
      }}
    >
      {children}
    </div>
  );
  if (vis.length === 1)
    return wrap(img(vis[0], 0, { height: 280, borderRadius: 12 }));
  if (vis.length === 2)
    return wrap(
      vis.map((s, i) => img(s, i)),
      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, height: 210 }
    );
  if (vis.length === 3)
    return wrap(
      vis.map((s, i) => img(s, i, i === 0 ? { gridRow: "1/3" } : {})),
      {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 3,
        height: 230,
      }
    );
  return wrap(
    vis.slice(0, 4).map((s, i) => img(s, i)),
    {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: 3,
      height: 230,
    }
  );
}

function fmt(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : n;
}

export default function SkyHubFeedCard({
  post,
  currentUserId,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onReportPost,
  onDeletePost,
}) {
  const tm = TYPE_META[post.type] || TYPE_META.Story;
  // The backend returns username:"you" or "@you" ONLY for the logged-in user's own posts.
  // That is the single reliable signal — no ID matching needed.
  const rawUsername = (post.username || "").replace(/^@/, "").toLowerCase();
  const isOwner =
    rawUsername === "you" ||
    (() => {
      if (!currentUserId) return false;
      const parts = String(currentUserId).split("|");
      const myMongoId = parts[0] || "";
      const myUsername = (parts[1] || parts[0] || "").toLowerCase();
      return (
        (post.authorId && String(post.authorId) === myMongoId) ||
        (myUsername && rawUsername && rawUsername === myUsername)
      );
    })();

  const menuItems = isOwner
    ? [
        {
          key: "delete",
          icon: <DeleteOutlined />,
          label: "Delete post",
          danger: true,
          onClick: () => onDeletePost?.(post.id),
        },
      ]
    : [
        {
          key: "report",
          icon: <FlagOutlined />,
          label: "Report post",
          danger: true,
          onClick: () => onReportPost?.(post),
        },
      ];

  return (
    <div className="skyhub-feedCard">
      <div className="skyhub-feedCard__top">
        <Avatar name={post.author} avatarUrl={post.avatar} size={44} />

        <div className="skyhub-feedCard__head">
          <div className="skyhub-feedCard__line1">
            <span className="skyhub-feedCard__name">{post.author}</span>
            <span className="skyhub-feedCard__handle">{post.username}</span>
            {post.badge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(255,122,53,0.12)",
                  color: "#ff7a35",
                  border: "1px solid rgba(255,122,53,0.22)",
                }}
              >
                {post.badge}
              </span>
            )}
            <span className="skyhub-feedCard__time">{post.timeAgo}</span>
          </div>

          {(post.destination || post.type) && (
            <div className="skyhub-feedCard__location">
              {post.destination && (
                <>
                  <EnvironmentOutlined
                    style={{ fontSize: 11, color: "#ff7a35" }}
                  />
                  <span style={{ color: "#ff7a35", fontWeight: 600 }}>
                    {post.destination}
                  </span>
                </>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "2px 8px",
                  background: tm.bg,
                  color: tm.c,
                  border: `1px solid ${tm.c}30`,
                  marginLeft: 4,
                }}
              >
                {tm.e} {post.type}
              </span>
            </div>
          )}
        </div>

        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{ items: menuItems }}
        >
          <button className="skyhub-feedCard__menu">
            <MoreOutlined />
          </button>
        </Dropdown>
      </div>

      <div className="skyhub-feedCard__body">
        <p className="skyhub-feedCard__text">{post.text}</p>

        {post.tags?.length > 0 && (
          <div className="skyhub-feedCard__tags">
            {post.tags.map((t) => (
              <span key={t} className="skyhub-feedCard__tag">
                {t.startsWith("#") ? t : `#${t}`}
              </span>
            ))}
          </div>
        )}

        {/* Image grid — uses images[] array */}
        <ImageGrid images={post.images} />

        {/* Legacy single image fallback */}
        {!post.images?.length && post.image && (
          <div className="skyhub-feedCard__media">
            <img
              src={post.image}
              alt="post"
              onError={(e) => {
                e.target.parentElement.style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      <div className="skyhub-feedCard__footer">
        <div className="skyhub-feedCard__actions">
          <button
            className="skyhub-feedCard__action"
            onClick={() => onOpenComments?.(post)}
          >
            💬 <span>{fmt(post.comments)}</span>
          </button>
          <button className="skyhub-feedCard__action">
            🔁 <span>{fmt(post.shares)}</span>
          </button>
          <button
            className={`skyhub-feedCard__action${
              post.liked ? " is-liked" : ""
            }`}
            onClick={() => onToggleLike?.(post.id)}
          >
            {post.liked ? "❤️" : "🤍"} <span>{fmt(post.likes)}</span>
          </button>
          <button
            className={`skyhub-feedCard__action${
              post.saved ? " is-bookmarked" : ""
            }`}
            onClick={() => onToggleSave?.(post.id)}
          >
            {post.saved ? "🔖" : "🏷️"} <span>{fmt(post.saves)}</span>
          </button>
          <button className="skyhub-feedCard__action">↗️</button>
        </div>
      </div>
    </div>
  );
}
