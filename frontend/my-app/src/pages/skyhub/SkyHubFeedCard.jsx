import React, { useState } from "react";
import { Dropdown } from "antd";
import {
  MoreOutlined,
  FlagOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

/* ── SVG Icons ─────────────────────────────────────────────── */
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
    fill={filled ? "#f87171" : "none"}
    stroke={filled ? "#f87171" : "currentColor"}
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
const VerifiedIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="#38bdf8"
    style={{ flexShrink: 0 }}
  >
    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

/* ── Type config ────────────────────────────────────────────── */
const TYPE_CONFIG = {
  Tip: { cssClass: "tp-Tip", label: "Tip", icon: "◎" },
  Question: { cssClass: "tp-Question", label: "Question", icon: "?" },
  Story: { cssClass: "tp-Story", label: "Story", icon: "≡" },
  Photo: { cssClass: "tp-Photo", label: "Photo", icon: "▣" },
  "Join Trip": { cssClass: "tp-Join-Trip", label: "Join Trip", icon: "→" },
};

/* Avatar color variants matching CSS classes */
const AVATAR_VARIANTS = [
  "is-orange",
  "is-blue",
  "is-purple",
  "is-orange",
  "is-blue",
];

/* ── Image grid ─────────────────────────────────────────────── */
function ImageGrid({ images }) {
  const [failed, setFailed] = useState({});
  if (!images?.length) return null;
  const vis = images.filter((_, i) => !failed[i]);
  if (!vis.length) return null;
  const fail = (i) => setFailed((f) => ({ ...f, [i]: true }));
  const imgStyle = (extra = {}) => ({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    ...extra,
  });
  if (vis.length === 1)
    return (
      <div
        style={{
          marginTop: 12,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <img
          src={vis[0]}
          alt=""
          loading="lazy"
          onError={() => fail(0)}
          style={{ ...imgStyle(), height: 280 }}
        />
      </div>
    );
  const grid = {
    display: "grid",
    gap: 3,
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  };
  if (vis.length === 2)
    return (
      <div style={{ ...grid, gridTemplateColumns: "1fr 1fr", height: 210 }}>
        {vis.map((s, i) => (
          <img
            key={i}
            src={s}
            alt=""
            loading="lazy"
            onError={() => fail(i)}
            style={imgStyle()}
          />
        ))}
      </div>
    );
  if (vis.length === 3)
    return (
      <div
        style={{
          ...grid,
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          height: 230,
        }}
      >
        {vis.map((s, i) => (
          <img
            key={i}
            src={s}
            alt=""
            loading="lazy"
            onError={() => fail(i)}
            style={imgStyle(i === 0 ? { gridRow: "1/3" } : {})}
          />
        ))}
      </div>
    );
  return (
    <div
      style={{
        ...grid,
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        height: 230,
      }}
    >
      {vis.slice(0, 4).map((s, i) => (
        <img
          key={i}
          src={s}
          alt=""
          loading="lazy"
          onError={() => fail(i)}
          style={imgStyle()}
        />
      ))}
    </div>
  );
}

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "m";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n || 0);
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
  const tc = TYPE_CONFIG[post.type] || TYPE_CONFIG.Story;

  // Determine avatar color variant from author name
  const avatarVariant =
    AVATAR_VARIANTS[
      (post.author || "T").charCodeAt(0) % AVATAR_VARIANTS.length
    ];

  // Ownership check
  const rawUsername = (post.username || "").replace(/^@/, "").toLowerCase();
  const isOwner =
    rawUsername === "you" ||
    (() => {
      if (!currentUserId) return false;
      const [myId, myUser] = String(currentUserId).split("|");
      return (
        (post.authorId && String(post.authorId) === myId) ||
        (myUser && rawUsername === myUser.toLowerCase())
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
    /* data-type unlocks the colored left accent bar from CSS */
    <article className="skyhub-feedCard" data-type={post.type}>
      <div className="skyhub-feedCard__top">
        {/* Avatar — uses CSS class system (rounded square like Notion/Discord) */}
        <div className={`skyhub-feedCard__avatar ${avatarVariant}`}>
          {post.avatar ? (
            <img
              src={post.avatar}
              alt={post.author}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            (post.author || "T").slice(0, 2).toUpperCase()
          )}
        </div>

        <div className="skyhub-feedCard__head">
          {/* Name row */}
          <div className="skyhub-feedCard__line1">
            <span className="skyhub-feedCard__name">{post.author}</span>
            <span className="skyhub-feedCard__handle">{post.username}</span>
            {post.verified && <VerifiedIcon />}
            <span className="skyhub-feedCard__time">{post.timeAgo}</span>
          </div>

          {/* Location + type pill using CSS tp-{Type} classes */}
          {(post.destination || post.type) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              {post.destination && (
                <span className="skyhub-feedCard__location">
                  <EnvironmentOutlined style={{ fontSize: 11 }} />
                  {post.destination}
                </span>
              )}
              {/* Uses CSS class for per-type coloring */}
              <span className={`skyhub-feedCard__typepill ${tc.cssClass}`}>
                {tc.icon} {tc.label}
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

      {/* Body — uses CSS margin-left to align under avatar */}
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

        {/* Images */}
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

      {/* Footer — uses CSS margin-left to align under avatar */}
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
    </article>
  );
}
