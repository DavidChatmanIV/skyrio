import React, { useState } from "react";
import { Dropdown } from "antd";
import {
  MoreOutlined,
  FlagOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

/* ── SVG Icons (no emojis) ─────────────────────────────────── */
const CommentIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const RepeatIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
);
const HeartIcon = ({ filled }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "#ef4444" : "none"}
    stroke={filled ? "#ef4444" : "currentColor"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);
const BookmarkIcon = ({ filled }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "#a78bfa" : "none"}
    stroke={filled ? "#a78bfa" : "currentColor"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);
const ShareIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const TipIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);
const QuestionIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const BookIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
  </svg>
);
const CameraIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const PlaneIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
  </svg>
);
const VerifiedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#38bdf8">
    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

/* ── Type config with SVG icons ────────────────────────────── */
const TYPE_META = {
  Tip: {
    icon: <TipIcon />,
    c: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    label: "Tip",
  },
  Question: {
    icon: <QuestionIcon />,
    c: "#38bdf8",
    bg: "rgba(56,189,248,0.12)",
    label: "Question",
  },
  Story: {
    icon: <BookIcon />,
    c: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    label: "Story",
  },
  Photo: {
    icon: <CameraIcon />,
    c: "#f472b6",
    bg: "rgba(244,114,182,0.12)",
    label: "Photo",
  },
  "Join Trip": {
    icon: <PlaneIcon />,
    c: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    label: "Join Trip",
  },
};

const AV_COLORS = [
  "linear-gradient(135deg,#ff6b2b,#c94f10)",
  "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  "linear-gradient(135deg,#9333ea,#6d28d9)",
  "linear-gradient(135deg,#10b981,#065f46)",
  "linear-gradient(135deg,#f59e0b,#b45309)",
];

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, avatarUrl, size = 44 }) {
  const [failed, setFailed] = useState(false);
  const init = (name || "T").slice(0, 2).toUpperCase();
  const color = AV_COLORS[(name || "T").charCodeAt(0) % AV_COLORS.length];
  if (
    avatarUrl &&
    typeof avatarUrl === "string" &&
    avatarUrl.startsWith("http") &&
    !failed
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
        onError={() => setFailed(true)}
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

/* ── Image grid ─────────────────────────────────────────────── */
function ImageGrid({ images }) {
  const [failed, setFailed] = useState({});
  if (!images?.length) return null;
  const vis = images.filter((_, i) => !failed[i]);
  if (!vis.length) return null;
  const fail = (i) => setFailed((f) => ({ ...f, [i]: true }));
  const Img = ({ src, i, xStyle = {} }) => (
    <img
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
  const grid = (cols, rows, h) => ({
    display: "grid",
    gridTemplateColumns: cols,
    gridTemplateRows: rows,
    gap: 3,
    height: h,
  });
  if (vis.length === 2)
    return (
      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          overflow: "hidden",
          ...grid("1fr 1fr", "1fr", 210),
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
          ...grid("1fr 1fr", "1fr 1fr", 230),
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
        ...grid("1fr 1fr", "1fr 1fr", 230),
      }}
    >
      {vis.slice(0, 4).map((s, i) => (
        <Img key={i} src={s} i={i} />
      ))}
    </div>
  );
}

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "m";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/* ── Feed Card ──────────────────────────────────────────────── */
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

  // Ownership — backend returns "you" for logged-in user's posts
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
            {post.verified && <VerifiedIcon />}
            <span className="skyhub-feedCard__time">{post.timeAgo}</span>
          </div>

          {/* Location + type */}
          {(post.destination || post.type) && (
            <div className="skyhub-feedCard__location">
              {post.destination && (
                <>
                  <EnvironmentOutlined
                    style={{ fontSize: 11, color: "#ff6b2b" }}
                  />
                  <span style={{ color: "#ff6b2b", fontWeight: 600 }}>
                    {post.destination}
                  </span>
                </>
              )}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
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
                <span style={{ color: tm.c }}>{tm.icon}</span>
                {tm.label}
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

      {/* Actions — all SVG, no emojis */}
      <div className="skyhub-feedCard__footer">
        <div className="skyhub-feedCard__actions">
          <button
            className="skyhub-feedCard__action"
            onClick={() => onOpenComments?.(post)}
          >
            <CommentIcon />
            <span>{fmt(post.comments)}</span>
          </button>

          <button className="skyhub-feedCard__action">
            <RepeatIcon />
            <span>{fmt(post.shares)}</span>
          </button>

          <button
            className={`skyhub-feedCard__action${
              post.liked ? " is-liked" : ""
            }`}
            onClick={() => onToggleLike?.(post.id)}
          >
            <HeartIcon filled={post.liked} />
            <span>{fmt(post.likes)}</span>
          </button>

          <button
            className={`skyhub-feedCard__action${
              post.saved ? " is-bookmarked" : ""
            }`}
            onClick={() => onToggleSave?.(post.id)}
          >
            <BookmarkIcon filled={post.saved} />
            <span>{fmt(post.saves)}</span>
          </button>

          <button className="skyhub-feedCard__action">
            <ShareIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
