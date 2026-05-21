import React, { useState } from "react";
import {
  HeartOutlined,
  HeartFilled,
  MessageOutlined,
  RetweetOutlined,
  StarOutlined,
  StarFilled,
  ShareAltOutlined,
  MoreOutlined,
  EnvironmentOutlined,
  FlagOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";

const TYPE_META = {
  Tip: { emoji: "💡", color: "#fbbf24" },
  Story: { emoji: "📖", color: "#34d399" },
  Question: { emoji: "❓", color: "#60a5fa" },
  Photo: { emoji: "📷", color: "#f472b6" },
  "Join Trip": { emoji: "✈️", color: "#a78bfa" },
};

function PostAvatar({ post }) {
  const looksLikeUrl = (s) =>
    typeof s === "string" &&
    (s.startsWith("http") || s.startsWith("/") || s.startsWith("data:"));
  if (looksLikeUrl(post.avatar)) {
    return (
      <img
        src={post.avatar}
        alt={post.author}
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.1)",
        }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  }
  const colours = [
    "#ff8a2a",
    "#7c3aed",
    "#0ea5e9",
    "#10b981",
    "#e11d48",
    "#f59e0b",
  ];
  const idx = (post.author || "T").charCodeAt(0) % colours.length;
  const initials = (post.author || "T").slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: colours[idx],
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 15,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

function ImageGrid({ images }) {
  const [failed, setFailed] = useState({});
  if (!images || images.length === 0) return null;
  const visible = images.filter((_, i) => !failed[i]);
  if (visible.length === 0) return null;
  const mark = (i) => setFailed((f) => ({ ...f, [i]: true }));
  const base = {
    objectFit: "cover",
    width: "100%",
    height: "100%",
    display: "block",
  };

  if (visible.length === 1)
    return (
      <div style={{ borderRadius: 12, overflow: "hidden", marginTop: 10 }}>
        <img
          src={visible[0]}
          alt="post"
          onError={() => mark(0)}
          style={{ ...base, height: 260, borderRadius: 12 }}
        />
      </div>
    );

  if (visible.length === 2)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 3,
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 10,
          height: 200,
        }}
      >
        {visible.map((src, i) => (
          <img key={i} src={src} onError={() => mark(i)} style={base} alt="" />
        ))}
      </div>
    );

  if (visible.length === 3)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 3,
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 10,
          height: 220,
        }}
      >
        <img
          src={visible[0]}
          onError={() => mark(0)}
          style={{ ...base, gridRow: "1/3" }}
          alt=""
        />
        <img src={visible[1]} onError={() => mark(1)} style={base} alt="" />
        <img src={visible[2]} onError={() => mark(2)} style={base} alt="" />
      </div>
    );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 3,
        borderRadius: 12,
        overflow: "hidden",
        marginTop: 10,
        height: 240,
      }}
    >
      {visible.slice(0, 4).map((src, i) => (
        <img key={i} src={src} onError={() => mark(i)} style={base} alt="" />
      ))}
    </div>
  );
}

function ActionBtn({ icon, count, onClick, active, activeColor = "#ff8a2a" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 8px",
        borderRadius: 99,
        fontSize: 13,
        color: active ? activeColor : "rgba(255,255,255,0.35)",
        fontWeight: active ? 700 : 400,
        transition: "color 0.15s",
      }}
    >
      <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
      {count !== undefined && count !== null && (
        <span style={{ fontSize: 13 }}>
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}
    </button>
  );
}

export default function SkyHubFeedCard({
  post,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onReportPost,
}) {
  const meta = TYPE_META[post.type] || TYPE_META.Story;
  const menuItems = [
    {
      key: "report",
      icon: <FlagOutlined />,
      label: "Report post",
      danger: true,
      onClick: () => onReportPost?.(post),
    },
  ];

  return (
    <div
      style={{
        background: "rgba(30, 18, 58, 0.65)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "14px 16px 10px",
        marginBottom: 8,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <PostAvatar post={post} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
                  {post.author}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                  {post.username}
                </span>
                {post.verified && (
                  <span style={{ fontSize: 12, color: "#60a5fa" }}>✓</span>
                )}
                <span
                  style={{
                    fontSize: 10,
                    background: "rgba(255,138,42,0.15)",
                    color: "#ff8a2a",
                    border: "1px solid rgba(255,138,42,0.3)",
                    borderRadius: 99,
                    padding: "1px 7px",
                    fontWeight: 700,
                  }}
                >
                  {post.badge || "Explorer"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    marginLeft: "auto",
                  }}
                >
                  {post.timeAgo}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 3,
                  flexWrap: "wrap",
                }}
              >
                {post.destination && (
                  <>
                    <EnvironmentOutlined
                      style={{ fontSize: 11, color: "#ff8a2a" }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: "#ff8a2a",
                        fontWeight: 600,
                      }}
                    >
                      {post.destination}
                    </span>
                  </>
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: meta.color,
                    background: `${meta.color}18`,
                    borderRadius: 99,
                    padding: "1px 7px",
                    border: `1px solid ${meta.color}30`,
                  }}
                >
                  {meta.emoji} {post.type}
                </span>
              </div>
            </div>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 6px",
                  color: "rgba(255,255,255,0.25)",
                  flexShrink: 0,
                }}
              >
                <MoreOutlined style={{ fontSize: 18 }} />
              </button>
            </Dropdown>
          </div>

          {/* Body */}
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 15,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.88)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {post.text}
          </p>

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 13,
                    color: "#ff8a2a",
                    fontWeight: 600,
                    background: "rgba(255,138,42,0.1)",
                    borderRadius: 99,
                    padding: "2px 9px",
                  }}
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}

          {/* Images */}
          <ImageGrid images={post.images} />

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              maxWidth: 320,
            }}
          >
            <ActionBtn
              icon={<MessageOutlined />}
              count={post.comments}
              onClick={() => onOpenComments?.(post)}
            />
            <ActionBtn icon={<RetweetOutlined />} count={post.shares} />
            <ActionBtn
              icon={post.liked ? <HeartFilled /> : <HeartOutlined />}
              count={post.likes}
              onClick={() => onToggleLike?.(post.id)}
              active={post.liked}
              activeColor="#e11d48"
            />
            <ActionBtn
              icon={post.saved ? <StarFilled /> : <StarOutlined />}
              count={post.saves}
              onClick={() => onToggleSave?.(post.id)}
              active={post.saved}
              activeColor="#a78bfa"
            />
            <ActionBtn icon={<ShareAltOutlined />} />
          </div>
        </div>
      </div>
    </div>
  );
}
