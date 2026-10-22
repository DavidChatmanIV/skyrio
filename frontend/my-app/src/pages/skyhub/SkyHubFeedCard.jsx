import React, { useState } from "react";
import { Dropdown, message } from "antd";
import {
  MoreOutlined,
  FlagOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  StopOutlined,
  EyeInvisibleOutlined,
} from "@ant-design/icons";

/* ── Stroke SVG icons (replace the emoji) ── */
function Svg({ size = 15, fill = "none", children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {children}
    </svg>
  );
}
const Icon = {
  tip: (p) => (
    <Svg {...p}>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
    </Svg>
  ),
  question: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
    </Svg>
  ),
  story: (p) => (
    <Svg {...p}>
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </Svg>
  ),
  photo: (p) => (
    <Svg {...p}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  ),
  plane: (p) => (
    <Svg {...p}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </Svg>
  ),
  shield: (p) => (
    <Svg {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  comment: (p) => (
    <Svg {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  ),
  heart: ({ filled, ...p }) => (
    <Svg {...p} fill={filled ? "currentColor" : "none"}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </Svg>
  ),
  bookmark: ({ filled, ...p }) => (
    <Svg {...p} fill={filled ? "currentColor" : "none"}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  ),
  share: (p) => (
    <Svg {...p}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
    </Svg>
  ),
  userPlus: (p) => (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </Svg>
  ),
  userCheck: (p) => (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </Svg>
  ),
};

const TYPE_META = {
  Tip: { icon: Icon.tip, c: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  Question: { icon: Icon.question, c: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  Story: { icon: Icon.story, c: "#34d399", bg: "rgba(52,211,153,0.1)" },
  Photo: { icon: Icon.photo, c: "#f472b6", bg: "rgba(244,114,182,0.1)" },
  "Join Trip": { icon: Icon.plane, c: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
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
  onEditPost,
  onDeletePost,
  onBlockUser,
  // Optional: pass this (and post.following) once the follow API exists.
  // Until then the Follow button stays hidden — no button that does nothing.
  onToggleFollow,
}) {
  const tm = TYPE_META[post.type] || TYPE_META.Story;
  const TypeIcon = tm.icon;
  // currentUserId = "mongoId|username" (both passed from SkyHubPage)
  // The backend often returns username:"you" for own posts — we treat that as own too.
  const parts = currentUserId ? String(currentUserId).split("|") : [];
  const myMongoId = parts[0] || "";
  const myUsername = (parts[1] || parts[0] || "").toLowerCase();
  const postUsername = (post.username || "").replace(/^@/, "").toLowerCase();
  // The server says whether this is your post (post.isMine). The id
  // match is a fallback for posts already on screen.
  const isOwner = !!(
    post.isMine ||
    (currentUserId && post.authorId && String(post.authorId) === myMongoId)
  );

  const handleShare = async () => {
    const url = `${window.location.origin}/skyhub`;
    const where = post.destination ? ` about ${post.destination}` : "";
    const text = `${post.author}'s SkyHub post${where}: ${(post.text || "")
      .slice(0, 140)
      .trim()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "SkyHub on Skyrio", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        message.success("Copied — paste it anywhere to share.");
      }
    } catch (err) {
      if (err?.name !== "AbortError")
        message.error("Couldn't share this post.");
    }
  };

  const menuItems = [
    ...(isOwner
      ? [
          {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit post",
            onClick: () => onEditPost?.(post),
          },
          {
            key: "delete",
            icon: <DeleteOutlined />,
            label: "Delete post",
            danger: true,
            onClick: () => onDeletePost?.(post.id),
          },
        ]
      : []),
    ...(!isOwner
      ? [
          {
            key: "report",
            icon: <FlagOutlined />,
            label: "Report post",
            onClick: () => onReportPost?.(post),
          },
          ...(post.authorId
            ? [
                {
                  key: "block",
                  icon: <StopOutlined />,
                  label: `Block ${post.username || post.author}`,
                  danger: true,
                  onClick: () => onBlockUser?.(post),
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <div className="skyhub-feedCard">
      <div className="skyhub-feedCard__top">
        <Avatar name={post.author} avatarUrl={post.avatar} size={44} />

        <div className="skyhub-feedCard__head">
          <div className="skyhub-feedCard__line1">
            <span className="skyhub-feedCard__name">{post.author}</span>
            <span className="skyhub-feedCard__handle">{post.username}</span>
            {onToggleFollow && !isOwner && post.authorId && (
              <button
                type="button"
                className={`skyhub-feedCard__follow${
                  post.following ? " is-following" : ""
                }`}
                onClick={() => onToggleFollow(post)}
                aria-pressed={!!post.following}
                aria-label={
                  post.following
                    ? `Unfollow ${post.author}`
                    : `Follow ${post.author}`
                }
              >
                {post.following ? (
                  <Icon.userCheck size={13} />
                ) : (
                  <Icon.userPlus size={13} />
                )}
                {post.following ? "Following" : "Follow"}
              </button>
            )}
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
            <span className="skyhub-feedCard__time">
              {post.timeAgo}
              {post.edited && (
                <span
                  title={
                    post.editedAt
                      ? `Edited ${new Date(post.editedAt).toLocaleString()}`
                      : "Edited"
                  }
                  style={{ marginLeft: 6 }}
                >
                  · edited
                </span>
              )}
            </span>
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
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <TypeIcon size={11} /> {post.type}
              </span>
            </div>
          )}
        </div>

        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          overlayClassName="skyhub-menu"
          menu={{ items: menuItems }}
        >
          <button
            type="button"
            className="skyhub-feedCard__menu"
            aria-label="Post options"
          >
            <MoreOutlined />
          </button>
        </Dropdown>
      </div>

      {post.underReview && (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            margin: "8px 0 0",
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.3)",
            color: "#fbbf24",
            fontSize: 12.5,
          }}
        >
          <EyeInvisibleOutlined />
          Only you can see this — it was reported and our team is reviewing it.
        </div>
      )}

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

        {/* Meetups with strangers: a quiet safety reminder (Couchsurfing-style) */}
        {post.type === "Join Trip" && !isOwner && (
          <div className="shMeetTip" role="note">
            <span style={{ color: "#c4b5fd", marginTop: 1 }}>
              <Icon.shield size={15} />
            </span>
            <span>
              Meeting up? Pick a public place, tell a friend your plans, and
              keep your hotel and room number to yourself.{" "}
              <a href="/skyhub/guidelines#meetups">Meetup safety</a>
            </span>
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
            type="button"
            className="skyhub-feedCard__action"
            onClick={() => onOpenComments?.(post)}
            aria-label={`Comments (${post.comments})`}
          >
            <Icon.comment /> <span>{fmt(post.comments)}</span>
          </button>
          <button
            type="button"
            className={`skyhub-feedCard__action${
              post.liked ? " is-liked" : ""
            }`}
            onClick={() => onToggleLike?.(post.id)}
            aria-pressed={!!post.liked}
            aria-label={`${post.liked ? "Unlike" : "Like"} (${post.likes})`}
          >
            <Icon.heart filled={post.liked} /> <span>{fmt(post.likes)}</span>
          </button>
          <button
            type="button"
            className={`skyhub-feedCard__action${
              post.saved ? " is-bookmarked" : ""
            }`}
            onClick={() => onToggleSave?.(post.id)}
            aria-pressed={!!post.saved}
            aria-label={`${post.saved ? "Unsave" : "Save"} (${post.saves})`}
          >
            <Icon.bookmark filled={post.saved} /> <span>{fmt(post.saves)}</span>
          </button>
          <button
            type="button"
            className="skyhub-feedCard__action"
            onClick={handleShare}
            aria-label="Share post"
          >
            <Icon.share /> <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}
