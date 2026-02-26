import React, { useMemo, useState } from "react";
import { Modal } from "antd";
import "@/styles/PostCard.css";

export default function PostCard({ post }) {
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    const n = (post?.name || "User").trim();
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [post?.name]);

  return (
    <>
      <div className="post-card">
        {/* Header */}
        <div className="post-header">
          {post?.avatar ? (
            <img className="post-avatar" src={post.avatar} alt="avatar" />
          ) : (
            <div className="post-avatarFallback">{initials}</div>
          )}

          <div className="post-meta">
            <div className="post-nameRow">
              <div className="post-name">
                {post?.name || "User"}
                <span className="post-time"> • {post?.time || "now"}</span>
              </div>
            </div>

            <div className="post-sub">
              <span className="post-handle">@{post?.username || "user"}</span>
              <span className="post-dot">•</span>
              <span className="post-loc">{post?.location || "Somewhere"}</span>
            </div>
          </div>
        </div>

        {/* Text */}
        {post?.text && <div className="post-text">{post.text}</div>}

        {/* ✅ Image */}
        {post?.image && (
          <button className="post-imageBtn" onClick={() => setOpen(true)}>
            <img className="post-image" src={post.image} alt="moment" />
          </button>
        )}

        {/* Actions */}
        <div className="post-actions">
          <button className="post-actionBtn">❤️ Like</button>
          <button className="post-actionBtn">💬 Comment</button>
          <button className="post-actionBtn">🔁 Share</button>
          <button className="post-actionBtn">🔖 Save</button>
        </div>
      </div>

      {/* ✅ Image Modal */}
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        width={860}
        className="post-imageModal"
      >
        <div className="post-modalWrap">
          <img className="post-modalImg" src={post?.image} alt="moment large" />
          <div className="post-modalCaption">
            <div className="post-modalTitle">
              {post?.name}{" "}
              <span className="post-modalTime">• {post?.time}</span>
            </div>
            <div className="post-modalText">{post?.text}</div>
          </div>
        </div>
      </Modal>
    </>
  );
}
