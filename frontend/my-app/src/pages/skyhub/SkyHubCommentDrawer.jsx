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
import { MoreOutlined, DeleteOutlined, FlagOutlined } from "@ant-design/icons";
import { apiUrl } from "@/lib/api";
import { SkyHubJoinCard } from "./SkyHubJoinPrompt";
import "@/styles/skyhub-comments.css";

const { TextArea } = Input;

// The Skyrio top bar and the Atlas AI button sit above z-index 2000, which hid
// the drawer header and covered the comments. Keep the drawer above both.
const DRAWER_Z = 10000;
// Phones: the drawer is full screen and has its own "← SkyHub" back
// button, so it sits ABOVE the site's top bar (z-index 99999). Below it,
// the top bar covered the drawer's header and the back button was gone.
const PHONE_DRAWER_Z = 100001;
const MODAL_Z = 100101; // above the drawer on every screen size
const MAX_LEN = 600;

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

// "Kevin Monangai" -> "KM", "Kevin" -> "K"
function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "T";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Photos saved on our own server come back as "/uploads/..."
const photoUrl = (u) =>
  typeof u === "string" && u.startsWith("/") ? apiUrl(u) : u;

// Bottom edge of the site's top bar, so the drawer starts below it.
// Measured instead of fighting z-index: the nav stacks above the drawer
// on some pages and was hiding the "Comments" header and close button.
function topBarBottom() {
  try {
    const candidates = document.querySelectorAll(
      "header, nav, [class*='navbar' i], [class*='topbar' i]"
    );
    let bottom = 0;
    for (const el of candidates) {
      if (el.closest(".ant-drawer")) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      // Only bars pinned to the top and spanning most of the width
      if (r.top > 4 || r.height < 20 || r.height > 160) continue;
      if (r.width < window.innerWidth * 0.6) continue;
      bottom = Math.max(bottom, Math.round(r.bottom));
    }
    return bottom;
  } catch {
    return 0;
  }
}

function UserAvatar({ name, src, size = 36 }) {
  const url = photoUrl(src);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const hasPhoto =
    !broken && typeof url === "string" && /^https?:\/\//.test(url);
  return hasPhoto ? (
    <Avatar
      className="skyhubC-avatar"
      size={size}
      src={url}
      alt=""
      onError={() => {
        setBroken(true);
        return false;
      }}
    />
  ) : (
    <Avatar className="skyhubC-avatar skyhubC-avatar--initials" size={size}>
      {initials(name)}
    </Avatar>
  );
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

/* ── SVG icons (no emoji) ── */
const svgProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  viewBox: "0 0 24 24",
};

const PinIcon = () => (
  <svg width="12" height="12" strokeWidth="2.2" {...svgProps}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ChatIcon = () => (
  <svg width="32" height="32" strokeWidth="1.5" {...svgProps}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const BackIcon = () => (
  <svg width="20" height="20" strokeWidth="2.2" {...svgProps}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" strokeWidth="2.2" {...svgProps}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" strokeWidth="2.2" {...svgProps}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

export default function SkyHubCommentDrawer({
  open,
  onClose,
  post,
  refreshPostComments,
  onNeedAccount, // opens the "create a profile" prompt on SkyHubPage
}) {
  const [comments, setComments] = useState([]);
  const [isPhone, setIsPhone] = useState(
    typeof window !== "undefined" && window.innerWidth < 600
  );
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState("spam");

  const loggedIn = !!localStorage.getItem("token");

  // Desktop: keep the side panel below the top bar (re-measured on open
  // and resize). Phones cover the whole screen instead (see PHONE_DRAWER_Z).
  const [navOffset, setNavOffset] = useState(0);
  useEffect(() => {
    if (!open || isPhone) {
      setNavOffset(0);
      return;
    }
    const measure = () => setNavOffset(topBarBottom());
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, isPhone]);

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open || !post?.id) return;
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post?.id]);

  // Phone back button / back swipe closes the comments instead of leaving
  // SkyHub. We add one history entry while the drawer is open and remove it
  // when the drawer closes another way (back arrow, X, tapping outside).
  useEffect(() => {
    if (!open) return;
    let pushed = false;
    // Deferred so React StrictMode's double-run in dev doesn't push twice.
    const t = setTimeout(() => {
      window.history.pushState(
        { ...(window.history.state || {}), skyhubComments: true },
        ""
      );
      pushed = true;
    }, 0);
    const onPop = () => {
      pushed = false;
      onClose?.();
    };
    window.addEventListener("popstate", onPop);
    document.body.classList.add("skyhub-commentsOpen");
    return () => {
      clearTimeout(t);
      window.removeEventListener("popstate", onPop);
      document.body.classList.remove("skyhub-commentsOpen");
      // Only step back if we're still on our own entry (not if the user
      // navigated somewhere else, like a traveler's profile).
      if (pushed && window.history.state?.skyhubComments) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const res = await skyFetch(`/api/skyhub/posts/${post.id}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load comments");
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
      onNeedAccount?.("comment");
      return;
    }
    if (!commentText.trim() || postingComment) return;

    try {
      setPostingComment(true);
      const res = await skyFetch(`/api/skyhub/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to post comment");

      setCommentText("");
      setComments(data.comments || []);
      refreshPostComments?.(post.id, data.commentCount);
      message.success("Comment posted.");
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
      zIndex: MODAL_Z,
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
  const canSend = !!commentText.trim() && !postingComment;

  const header = isPhone ? (
    <div className="skyhubC-header">
      <button
        type="button"
        className="skyhubC-back"
        onClick={onClose}
        aria-label="Back to SkyHub"
      >
        <BackIcon />
        <span>SkyHub</span>
      </button>
      <span className="skyhubC-title">
        Comments{commentCount ? <em> · {commentCount}</em> : null}
      </span>
      <span className="skyhubC-headerSpacer" aria-hidden="true" />
    </div>
  ) : (
    <div className="skyhubC-header">
      <span className="skyhubC-title">
        Comments{commentCount ? <em> · {commentCount}</em> : null}
      </span>
      <button
        type="button"
        className="skyhubC-close"
        onClick={onClose}
        aria-label="Close comments"
      >
        <CloseIcon />
      </button>
    </div>
  );

  const composer = loggedIn ? (
    <div className="skyhubC-composer">
      <TextArea
        className="skyhubC-input"
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter posts; plain Enter makes a new line.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handlePostComment();
          }
        }}
        placeholder="Write a comment…"
        maxLength={MAX_LEN}
        autoSize={{ minRows: 1, maxRows: 5 }}
        aria-label="Write a comment"
      />
      <div className="skyhubC-composerRow">
        <span
          className={`skyhubC-count${
            commentText.length > MAX_LEN - 50 ? " is-near" : ""
          }`}
        >
          {commentText.length ? `${commentText.length}/${MAX_LEN}` : ""}
        </span>
        <Button
          type="primary"
          className="skyhubC-send"
          icon={<SendIcon />}
          onClick={handlePostComment}
          loading={postingComment}
          disabled={!canSend}
        >
          Post
        </Button>
      </div>
    </div>
  ) : (
    // Logged out: read every comment, but replying needs a profile
    <div className="skyhubC-composer skyhubC-composer--join">
      <SkyHubJoinCard />
    </div>
  );

  return (
    <Drawer
      title={header}
      closable={false}
      placement="right"
      // Full screen on phones, side panel on desktop.
      width={isPhone ? "100%" : 440}
      zIndex={isPhone ? PHONE_DRAWER_Z : DRAWER_Z}
      rootStyle={!isPhone && navOffset ? { top: navOffset } : undefined}
      onClose={onClose}
      open={open}
      className="skyhub-commentDrawer skyhub-drawer skyhubC"
      rootClassName="skyhub-drawer skyhubC-root"
      footer={composer}
      destroyOnHidden
    >
      {post ? (
        <article className="skyhubC-postcard">
          <div className="skyhubC-postcardHead">
            <UserAvatar
              name={post.author}
              src={post.authorAvatar || post.avatar}
              size={32}
            />
            <div className="skyhubC-postcardWho">
              <span className="skyhubC-name">{post.author}</span>
              <span className="skyhubC-sub">
                {post.destination && (
                  <span className="skyhubC-pill">
                    <PinIcon />
                    {post.destination}
                  </span>
                )}
                {post.timeAgo && (
                  <span className="skyhubC-time">{post.timeAgo}</span>
                )}
              </span>
            </div>
          </div>
          {post.text && <p className="skyhubC-postText">{post.text}</p>}
          {previewPhoto && (
            <img
              className="skyhubC-postPhoto"
              src={photoUrl(previewPhoto)}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </article>
      ) : null}

      <div className="skyhubC-list">
        {loadingComments ? (
          <div className="skyhubC-loading">
            <Spin />
          </div>
        ) : commentCount ? (
          comments.map((comment) => {
            const menuItems = [
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
                        if (!localStorage.getItem("token")) {
                          if (onNeedAccount)
                            return onNeedAccount("report comments");
                          return message.info("Log in to report.");
                        }
                        setReason("spam");
                        setReporting(comment);
                      },
                    },
                  ]
                : []),
            ];

            return (
              <div key={comment._id || comment.id} className="skyhubC-item">
                <UserAvatar name={comment.author} src={comment.avatar} />
                <div className="skyhubC-itemBody">
                  <div className="skyhubC-itemMeta">
                    <span className="skyhubC-name">
                      {comment.author || "Traveler"}
                    </span>
                    <span className="skyhubC-time">
                      {comment.timeAgo || "just now"}
                    </span>
                    {menuItems.length > 0 && (
                      <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        overlayClassName="skyhub-menu"
                        menu={{ items: menuItems }}
                      >
                        <button
                          type="button"
                          className="skyhubC-more"
                          aria-label="Comment options"
                        >
                          <MoreOutlined />
                        </button>
                      </Dropdown>
                    )}
                  </div>
                  <p className="skyhubC-text">{comment.text}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="skyhubC-empty">
            <div className="skyhubC-emptyIcon" aria-hidden="true">
              <ChatIcon />
            </div>
            <div className="skyhubC-emptyTitle">No comments yet</div>
            <div className="skyhubC-emptySub">
              {loggedIn
                ? `Be the first to reply${
                    post?.author ? ` to ${post.author.split(" ")[0]}` : ""
                  }.`
                : "Create a profile to be the first to reply."}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!reporting}
        title="Report this comment"
        className="skyhub-modal"
        zIndex={MODAL_Z}
        onCancel={() => setReporting(null)}
        onOk={sendReport}
        okText="Send report"
        okButtonProps={{ danger: true }}
        destroyOnHidden
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
