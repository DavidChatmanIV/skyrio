import React, { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Input,
  Modal,
  Radio,
  Spin,
  message,
} from "antd";
import {
  SendOutlined,
  MoreOutlined,
  DeleteOutlined,
  FlagOutlined,
} from "@ant-design/icons";
import { apiUrl } from "@/lib/api";

const { TextArea } = Input;

// Sends your login with every SkyHub request (comments need it).
function skyFetch(path, opts = {}) {
  const token = localStorage.getItem("token");
  return fetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

const REASONS = [
  { value: "spam", label: "Spam or ads" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "scam", label: "Scam or fraud" },
  { value: "child_safety", label: "Involves a child's safety" },
  { value: "self_harm", label: "Someone may hurt themselves" },
  { value: "other", label: "Something else" },
];

export default function SkyHubCommentDrawer({
  open,
  onClose,
  post,
  refreshPostComments,
}) {
  const [comments, setComments] = useState([]);
  const [isPhone, setIsPhone] = useState(
    typeof window !== "undefined" && window.innerWidth < 600
  );
  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (!open || !post?.id) return;
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post?.id]);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const res = await skyFetch(`/api/skyhub/posts/${post.id}/comments`);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load comments");
      }

      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      console.error("fetchComments error:", err);
      message.error(err.message || "Failed to load comments.");
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!localStorage.getItem("token")) {
      message.info("Log in to comment.");
      return;
    }
    if (!commentText.trim()) {
      message.warning("Write a comment first.");
      return;
    }

    try {
      setPostingComment(true);

      const res = await skyFetch(`/api/skyhub/posts/${post.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: commentText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to post comment");
      }

      setCommentText("");
      setComments(data.comments || []);
      refreshPostComments?.(post.id, data.commentCount);
      message.success("Comment added.");
    } catch (err) {
      console.error("handlePostComment error:", err);
      message.error(err.message || "Could not post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  const deleteComment = (comment) =>
    Modal.confirm({
      className: "skyhub-modal",
      title: "Delete this comment?",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await skyFetch(`/api/skyhub/comments/${comment._id}`, {
            method: "DELETE",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data?.message || "Couldn't delete the comment.");
          setComments((list) => list.filter((c) => c._id !== comment._id));
          refreshPostComments?.(post.id, data.commentCount);
        } catch (err) {
          message.error(err.message);
        }
      },
    });

  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState("spam");
  const sendReport = async () => {
    try {
      const res = await skyFetch(
        `/api/skyhub/comments/${reporting._id}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message || "Couldn't report the comment.");
      message.success(data.message || "Thanks for reporting.");
      setReporting(null);
    } catch (err) {
      message.error(err.message);
    }
  };

  // You can delete your own comments, and any comment on your own post.
  const canDelete = (c) => c.isMine || post?.isMine;

  const previewPhoto = post?.images?.[0] || post?.image || "";
  const commentCount = comments.length;

  return (
    <Drawer
      title={commentCount ? `Comments (${commentCount})` : "Comments"}
      placement="right"
      // Full screen on phones, side panel on desktop.
      width={isPhone ? "100%" : 440}
      // Above the Skyrio top bar, which was covering the header and close button.
      zIndex={2000}
      onClose={onClose}
      open={open}
      className="skyhub-commentDrawer skyhub-drawer"
      rootClassName="skyhub-drawer"
      destroyOnClose
    >
      <div className="skyhub-commentDrawerInner">
        {post ? (
          <div className="skyhub-commentPostPreview skyhub-drawerPreview">
            <div className="skyhub-drawerPreview__head">
              <span className="skyhub-drawerPreview__author">
                {post.author}
              </span>
              {post.destination && (
                <span className="skyhub-drawerPreview__dest">
                  📍 {post.destination}
                </span>
              )}
              {post.timeAgo && (
                <span className="skyhub-drawerPreview__time">
                  · {post.timeAgo}
                </span>
              )}
            </div>
            <div className="skyhub-drawerPreview__body">
              {post.text && (
                <p className="skyhub-drawerPreview__text">{post.text}</p>
              )}
              {previewPhoto && (
                <img
                  className="skyhub-drawerPreview__photo"
                  src={previewPhoto}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
          </div>
        ) : null}

        <div className="skyhub-commentComposer">
          <TextArea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              localStorage.getItem("token")
                ? "Write a helpful reply..."
                : "Log in to reply"
            }
            maxLength={600}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />

          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handlePostComment}
            loading={postingComment}
            className="skyhub-primaryBtn"
          >
            Add Comment
          </Button>
        </div>

        <div className="skyhub-commentList">
          {loadingComments ? (
            <div className="skyhub-commentLoading">
              <Spin />
            </div>
          ) : comments.length ? (
            comments.map((comment) => (
              <div
                key={comment._id || comment.id}
                className="skyhub-commentItem"
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "12px 0",
                }}
              >
                {typeof comment.avatar === "string" &&
                comment.avatar.startsWith("http") ? (
                  <Avatar
                    className="skyhub-commentAvatar"
                    src={comment.avatar}
                    alt=""
                  />
                ) : (
                  <Avatar className="skyhub-commentAvatar">
                    {(comment.author || "U").slice(0, 2).toUpperCase()}
                  </Avatar>
                )}

                <div
                  className="skyhub-commentContent"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div
                    className="skyhub-commentMeta"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="skyhub-commentAuthor"
                      style={{ fontWeight: 700, color: "#fff" }}
                    >
                      {comment.author || "Traveler"}
                    </span>
                    <span
                      aria-hidden="true"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      ·
                    </span>
                    <span
                      className="skyhub-commentTime"
                      style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}
                    >
                      {comment.timeAgo || "just now"}
                    </span>
                    <Dropdown
                      trigger={["click"]}
                      placement="bottomRight"
                      overlayClassName="skyhub-menu"
                      menu={{
                        items: [
                          ...(canDelete(comment)
                            ? [
                                {
                                  key: "delete",
                                  icon: <DeleteOutlined />,
                                  label: "Delete",
                                  danger: true,
                                  onClick: () => deleteComment(comment),
                                },
                              ]
                            : []),
                          ...(!comment.isMine
                            ? [
                                {
                                  key: "report",
                                  icon: <FlagOutlined />,
                                  label: "Report",
                                  onClick: () => {
                                    if (!localStorage.getItem("token"))
                                      return message.info("Log in to report.");
                                    setReason("spam");
                                    setReporting(comment);
                                  },
                                },
                              ]
                            : []),
                        ],
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Comment options"
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: 0,
                          color: "inherit",
                          opacity: 0.6,
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        <MoreOutlined />
                      </button>
                    </Dropdown>
                  </div>

                  <p
                    className="skyhub-commentText"
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {comment.text}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="skyhub-drawerEmpty">
              <div className="skyhub-drawerEmpty__icon" aria-hidden="true">
                💬
              </div>
              <div className="skyhub-drawerEmpty__title">No comments yet</div>
              <div className="skyhub-drawerEmpty__sub">
                Be the first to reply
                {post?.author ? ` to ${post.author.split(" ")[0]}` : ""}.
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!reporting}
        title="Report this comment"
        className="skyhub-modal"
        onCancel={() => setReporting(null)}
        onOk={sendReport}
        okText="Send report"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Radio.Group
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {REASONS.map((r) => (
            <Radio key={r.value} value={r.value}>
              {r.label}
            </Radio>
          ))}
        </Radio.Group>
      </Modal>
    </Drawer>
  );
}
