import React, { useEffect, useState } from "react";
import { Avatar, Button, Drawer, Empty, Input, Spin, message } from "antd";
import { SendOutlined } from "@ant-design/icons";

const { TextArea } = Input;

export default function SkyHubCommentDrawer({
  open,
  onClose,
  post,
  refreshPostComments,
}) {
  const [comments, setComments] = useState([]);
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
      const res = await fetch(`/api/skyhub/posts/${post.id}/comments`, {
        credentials: "include",
      });

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
    if (!commentText.trim()) {
      message.warning("Write a comment first.");
      return;
    }

    try {
      setPostingComment(true);

      const res = await fetch(`/api/skyhub/posts/${post.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
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

  return (
    <Drawer
      title={
        post ? `Comments • ${post.destination || post.author}` : "Comments"
      }
      placement="right"
      width={420}
      onClose={onClose}
      open={open}
      className="skyhub-commentDrawer"
    >
      <div className="skyhub-commentDrawerInner">
        {post ? (
          <div className="skyhub-commentPostPreview">
            <div className="skyhub-commentPreviewAuthor">{post.author}</div>
            <p className="skyhub-commentPreviewText">{post.text}</p>
          </div>
        ) : null}

        <div className="skyhub-commentComposer">
          <TextArea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a helpful reply..."
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
              >
                <Avatar className="skyhub-commentAvatar">
                  {comment.avatar || "U"}
                </Avatar>

                <div className="skyhub-commentContent">
                  <div className="skyhub-commentMeta">
                    <span className="skyhub-commentAuthor">
                      {comment.author || "User"}
                    </span>
                    <span className="skyhub-commentTime">
                      {comment.timeAgo || "now"}
                    </span>
                  </div>

                  <p className="skyhub-commentText">{comment.text}</p>
                </div>
              </div>
            ))
          ) : (
            <Empty description="No comments yet" />
          )}
        </div>
      </div>
    </Drawer>
  );
}