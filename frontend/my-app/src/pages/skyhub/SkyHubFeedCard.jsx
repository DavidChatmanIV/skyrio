import React, { useState } from "react";
import { Dropdown } from "antd";
import {
  MoreOutlined,
  FlagOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

// ── Post type config ──────────────────────────────────────────
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

// ── Avatar ─────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 44 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const init = (name || "T").slice(0, 2).toUpperCase();
  const color = AV_COLORS[(name || "T").charCodeAt(0) % AV_COLORS.length];

  if (
    avatarUrl &&
    typeof avatarUrl === "string" &&
    avatarUrl.startsWith("http") &&
    !imgFailed
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
        onError={() => setImgFailed(true)}
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
        fontSize: Math.round(size * 0.34),
        color: "#fff",
        userSelect: "none",
      }}
    >
      {init}
    </div>
  );
}

// ── Image grid (1–4 photos, Twitter layout) ───────────────────
function ImageGrid({ images }) {
  const [failed, setFailed] = useState({});
  if (!images?.length) return null;
  const vis = images.filter((_, i) => !failed[i]);
  if (!vis.length) return null;
  const fail = (i) => setFailed((f) => ({ ...f, [i]: true }));

  const Img = ({ src, i, xStyle = {} }) => (
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
        ...xStyle,
      }}
    />
  );

  if (vis.length === 1)
    return (
      <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden" }}>
        <Img src={vis[0]} i={0} xStyle={{ height: 280, borderRadius: 12 }} />
      </div>
    );
  if (vis.length === 2)
    return (
      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 3,
          height: 210,
        }}
      >
        {vis.map((s, i) => (
          <Img key={i} src={s} i={i} />
        ))}
      </div>
    );
  if (vis.length === 3)
    return (
      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 3,
          height: 230,
        }}
      >
        {vis.map((s, i) => (
          <Img
            key={i}
            src={s}
            i={i}
            xStyle={i === 0 ? { gridRow: "1/3" } : {}}
          />
        ))}
      </div>
    );
  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 12,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 3,
        height: 230,
      }}
    >
      {vis.slice(0, 4).map((s, i) => (
        <Img key={i} src={s} i={i} />
      ))}
    </div>
  );
}

// ── Number formatter ───────────────────────────────────────────
function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "m";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ── Feed Card ──────────────────────────────────────────────────
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

  // Ownership check — backend returns "you" for logged-in user's posts
  const rawUsername = (post.username || "").replace(/^@/, "").toLowerCase();
  const isOwner =
    rawUsername === "you" ||
    (() => {
      if (!currentUserId) return false;
      const parts = String(currentUserId).split("|");
      const myMongoId = parts[0] || "";
      const myUsername = (parts[1] || "").toLowerCase();
      return (
        (post.authorId && String(post.authorId) === myMongoId) ||
        (myUsername && rawUsername === myUsername)
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
          {/* Name row */}
          <div className="skyhub-feedCard__line1">
            <span className="skyhub-feedCard__name">{post.author}</span>
            <span className="skyhub-feedCard__handle">{post.username}</span>
            {post.verified && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#38bdf8"
                style={{ flexShrink: 0 }}
              >
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            )}
            <span className="skyhub-feedCard__time">{post.timeAgo}</span>
          </div>

          {/* Location + type pill */}
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
                  marginLeft: post.destination ? 4 : 0,
                  background: tm.bg,
                  color: tm.c,
                  border: `1px solid ${tm.c}30`,
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
          <button
            className="skyhub-feedCard__menu"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreOutlined />
          </button>
        </Dropdown>
      </div>

      {/* Body */}
      <div className="skyhub-feedCard__body">
        {post.text && <p className="skyhub-feedCard__text">{post.text}</p>}

        {post.tags?.length > 0 && (
          <div className="skyhub-feedCard__tags">
            {post.tags.map((t) => (
              <span key={t} className="skyhub-feedCard__tag">
                {t.startsWith("#") ? t : `#${t}`}
              </span>
            ))}
          </div>
        )}

        {/* Images — array takes priority, single image as fallback */}
        {post.images?.length > 0 ? (
          <ImageGrid images={post.images} />
        ) : post.image ? (
          <div className="skyhub-feedCard__media">
            <img
              src={post.image}
              alt=""
              onError={(e) => {
                e.target.parentElement.style.display = "none";
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Footer actions */}
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
