import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  HeartOutlined,
  HeartFilled,
  MessageOutlined,
  RetweetOutlined,
  EnvironmentOutlined,
  BookOutlined,
  BookFilled,
  MoreOutlined,
  SendOutlined,
  ShareAltOutlined,
  FlagOutlined,
} from "@ant-design/icons";

/* ─────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────── */
function getInitials(name = "") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCount(value = 0) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

function timeAgo(dateValue) {
  if (!dateValue) return "now";
  const diff = Math.max(0, Date.now() - new Date(dateValue).getTime());
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

const BADGE_CLASS = {
  Nomad: "is-nomad",
  Explorer: "is-explorer",
  Voyager: "is-voyager",
  Trailblazer: "is-trailblazer",
  Legend: "is-legend",
};

const BADGE_ICON = {
  Nomad: "◎",
  Explorer: "⬡",
  Voyager: "✦",
  Trailblazer: "★",
  Legend: "◈",
};

function avatarClass(name = "") {
  const n = name.toLowerCase();
  if (n.length % 3 === 0) return "is-blue";
  if (n.length % 2 === 0) return "is-orange";
  return "is-purple";
}

const CONTENT_LIMIT = 240;

/* ─────────────────────────────────────────────────────────
   INLINE REPLY INPUT
───────────────────────────────────────────────────────── */
function ReplyInput({ onSubmit }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function handleKey(e) {
    if (e.key === "Enter" && val.trim()) submit();
  }

  function submit() {
    if (!val.trim()) return;
    onSubmit(val.trim());
    setVal("");
  }

  return (
    <div className="sh-replyInput">
      <input
        ref={ref}
        className="sh-replyField"
        placeholder="Write a reply…"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKey}
        maxLength={280}
      />
      <button className="sh-replySubmit" onClick={submit}>
        Reply
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CONTEXT DROPDOWN — wired to onReport callback
───────────────────────────────────────────────────────── */
function ContextMenu({ handle, onClose, onReport }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: `Follow ${handle}`, danger: false, action: onClose },
    { label: "Mute", danger: false, action: onClose },
    {
      label: "Copy link",
      danger: false,
      action: () => {
        navigator.clipboard?.writeText(window.location.href).catch(() => {});
        onClose();
      },
    },
    { label: "Not interested", danger: false, action: onClose },
    {
      label: "Report post",
      danger: true,
      icon: <FlagOutlined style={{ fontSize: 12 }} />,
      action: () => {
        onReport?.(); // ← calls handleReportPost in SkyHubPage
        onClose();
      },
    },
  ];

  return (
    <div className="skyhub-feedCard__dropdown" ref={ref}>
      {items.map((item) => (
        <button
          key={item.label}
          className={`skyhub-feedCard__dropdownItem${
            item.danger ? " is-danger" : ""
          }`}
          onClick={item.action}
          type="button"
        >
          {item.icon && <span style={{ marginRight: 6 }}>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
export default function SkyHubFeedCard({
  post,
  onLike,
  onComment,
  onRepost,
  onBookmark,
  onToggleLike, // ← SkyHubPage passes this
  onToggleSave, // ← SkyHubPage passes this
  onOpenComments, // ← SkyHubPage passes this
  onReportPost, // ← SkyHubPage passes this ✅ NOW WIRED
}) {
  const [liked, setLiked] = useState(Boolean(post?.liked));
  const [bookmarked, setBookmarked] = useState(
    Boolean(post?.bookmarked || post?.saved)
  );
  const [reposted, setReposted] = useState(false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [repostCount, setRepostCount] = useState(post?.reposts || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [localReplies, setLocalReplies] = useState([]);
  const [reported, setReported] = useState(false);

  const displayName = post?.user?.name || post?.author || "Traveler";
  const handle =
    post?.user?.handle || post?.username || post?.handle || "@traveler";
  const location = post?.location || post?.destination || "Somewhere amazing";
  const createdAt = post?.createdAt || post?.date;
  const text = post?.text || post?.caption || "";
  const commentCount = post?.comments || 0;
  const saves = post?.saves || 0;
  const image = post?.image || post?.imageUrl || "";
  const tags = post?.tags || [];
  const badge = post?.badge || post?.user?.badge || "Explorer";
  const verified = Boolean(post?.verified || post?.user?.verified);
  const hasStory = Boolean(post?.hasStory);
  const isThread = Boolean(post?.isThread);

  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const avClass = useMemo(() => avatarClass(displayName), [displayName]);
  const needsExpand = text.length > CONTENT_LIMIT;
  const displayText =
    needsExpand && !expanded ? text.slice(0, CONTENT_LIMIT) + "…" : text;
  const badgeClass = BADGE_CLASS[badge] || "is-explorer";
  const badgeIcon = BADGE_ICON[badge] || "⬡";

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    onLike?.(post, next);
    onToggleLike?.(post?.id || post?._id); // ← support both prop names
  }

  function handleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    onBookmark?.(post, next);
    onToggleSave?.(post?.id || post?._id);
  }

  function handleRepost() {
    const next = !reposted;
    setReposted(next);
    setRepostCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
  }

  function handleReply(text) {
    setLocalReplies((prev) => [
      ...prev,
      { id: Date.now(), author: "You", body: text },
    ]);
    setShowReply(false);
  }

  function handleComment() {
    setShowReply((v) => !v);
    onComment?.(post);
    onOpenComments?.(post); // ← opens drawer in SkyHubPage
  }

  // ── Report handler — calls SkyHubPage's handleReportPost ──
  function handleReport() {
    if (reported) return;
    setReported(true);
    onReportPost?.(post); // ← this is the key wire
  }

  return (
    <article
      className={`skyhub-feedCard sh-card sh-hover${
        isThread ? " is-thread" : ""
      } fade-in-up`}
    >
      {/* ── TOP ROW ── */}
      <div className="skyhub-feedCard__top">
        <div
          className={`skyhub-feedCard__avatar ${avClass}${
            hasStory ? " has-story" : ""
          }`}
          role="img"
          aria-label={displayName}
        >
          {post?.user?.avatar || post?.avatar ? (
            <img
              src={post?.user?.avatar || post?.avatar}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
        </div>

        <div className="skyhub-feedCard__head">
          <div className="skyhub-feedCard__line1">
            <span className="skyhub-feedCard__name">{displayName}</span>
            {verified && (
              <span className="skyhub-feedCard__verified" aria-label="Verified">
                ✓
              </span>
            )}
            <span className="skyhub-feedCard__handle">{handle}</span>
            <span
              className={`skyhub-feedCard__badge ${badgeClass}`}
              title={`${badge} — ${post?.xp ?? 0} XP`}
            >
              <span style={{ fontSize: "0.62rem" }}>{badgeIcon}</span>
              {badge}
            </span>
            <span className="skyhub-feedCard__dot">·</span>
            <span className="skyhub-feedCard__time">{timeAgo(createdAt)}</span>
          </div>
          <div className="skyhub-feedCard__location">
            <EnvironmentOutlined />
            <span>{location}</span>
          </div>
        </div>

        {/* ⋯ Menu */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            className="skyhub-feedCard__menu"
            aria-label="More actions"
            onClick={() => setShowMenu((v) => !v)}
          >
            <MoreOutlined />
          </button>
          {showMenu && (
            <ContextMenu
              handle={handle}
              onClose={() => setShowMenu(false)}
              onReport={handleReport} // ← wired
            />
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="skyhub-feedCard__body">
        <p className="skyhub-feedCard__text">
          {displayText}
          {needsExpand && (
            <button
              className="skyhub-feedCard__readMore"
              onClick={() => setExpanded((v) => !v)}
              type="button"
            >
              {expanded ? " Show less" : " Read more"}
            </button>
          )}
        </p>

        {image && !post?.images?.length && (
          <div className="skyhub-feedCard__media">
            <img src={image} alt="Travel post" />
          </div>
        )}

        {tags.length > 0 && (
          <div className="skyhub-feedCard__tags">
            {tags.map((tag) => (
              <span key={tag} className="skyhub-feedCard__tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Reported state */}
        {reported && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              fontSize: 12,
              color: "rgba(248,113,113,0.8)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FlagOutlined /> Post reported — thanks for helping keep SkyHub
            safe.
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="skyhub-feedCard__footer">
        <div className="skyhub-feedCard__actions">
          <button
            type="button"
            className={`skyhub-feedCard__action${liked ? " is-liked" : ""}`}
            onClick={handleLike}
            aria-label={liked ? "Unlike" : "Like"}
          >
            {liked ? <HeartFilled /> : <HeartOutlined />}
            <span>{formatCount(likeCount)}</span>
          </button>

          <button
            type="button"
            className={`skyhub-feedCard__action${
              showReply ? " is-active" : ""
            }`}
            onClick={handleComment}
            aria-label="Reply"
            style={
              showReply
                ? {
                    color: "var(--sh-purple)",
                    background: "var(--sh-purple-dim)",
                  }
                : {}
            }
          >
            <MessageOutlined />
            <span>{formatCount(commentCount + localReplies.length)}</span>
          </button>

          <button
            type="button"
            className="skyhub-feedCard__action"
            onClick={handleRepost}
            aria-label={reposted ? "Undo repost" : "Repost"}
            style={
              reposted
                ? {
                    color: "var(--sh-green)",
                    background: "rgba(34,197,94,0.1)",
                  }
                : {}
            }
          >
            <RetweetOutlined />
            <span>{formatCount(repostCount)}</span>
          </button>

          <button
            type="button"
            className={`skyhub-feedCard__action${
              bookmarked ? " is-bookmarked" : ""
            }`}
            onClick={handleBookmark}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {bookmarked ? <BookFilled /> : <BookOutlined />}
            <span>{formatCount(saves + (bookmarked ? 1 : 0))}</span>
          </button>

          <button
            type="button"
            className="skyhub-feedCard__action"
            aria-label="Share"
          >
            <ShareAltOutlined />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="skyhub-feedCard__bookCta"
            aria-label="Book this trip"
          >
            <SendOutlined style={{ fontSize: "0.8rem" }} />
            Book trip
          </button>
          <div className="skyhub-feedCard__meta">
            <span>{post?.postType || post?.type || "Travel Tip"}</span>
            <span>{post?.visibility || "Public"}</span>
          </div>
        </div>
      </div>

      {showReply && <ReplyInput onSubmit={handleReply} />}

      {localReplies.length > 0 && (
        <div className="sh-replies">
          {localReplies.map((r) => (
            <div key={r.id} className="sh-replyItem">
              <div
                className={`skyhub-feedCard__avatar ${avatarClass(r.author)}`}
                style={{
                  width: 28,
                  height: 28,
                  fontSize: "0.65rem",
                  flexShrink: 0,
                }}
              >
                {getInitials(r.author)}
              </div>
              <div>
                <span className="sh-replyItem__author">{r.author} </span>
                <span className="sh-replyItem__body">{r.body}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
