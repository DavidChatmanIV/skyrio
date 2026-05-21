import React, { useRef, useState, useEffect } from "react";
import { Button, message } from "antd";
import {
  EnvironmentOutlined,
  CameraOutlined,
  CloseCircleFilled,
  SendOutlined,
} from "@ant-design/icons";

const POST_TYPES = ["Tip", "Question", "Story", "Photo", "Join Trip"];

export default function SkyHubComposer({
  composerText,
  setComposerText,
  activePostType,
  setActivePostType,
  destination,
  setDestination,
  onCreatePost,
  creatingPost,
  onPhotosChange,
  user = {},
}) {
  const fileRef = useRef(null);
  const [previews, setPreviews] = useState([]);
  const [files, setFiles] = useState([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), []); // eslint-disable-line

  const handleFileChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;
    const remaining = 4 - files.length;
    if (remaining <= 0) {
      message.warning("Max 4 photos per post.");
      return;
    }
    const accepted = incoming.slice(0, remaining);
    const newPreviews = accepted.map((f) => URL.createObjectURL(f));
    const nextFiles = [...files, ...accepted];
    const nextPreviews = [...previews, ...newPreviews];
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    onPhotosChange?.(nextFiles);
    e.target.value = "";
  };

  const removePhoto = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    const nextFiles = files.filter((_, i) => i !== idx);
    const nextPreviews = previews.filter((_, i) => i !== idx);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    onPhotosChange?.(nextFiles);
  };

  const handlePost = () => {
    if (!composerText.trim() && files.length === 0) {
      message.warning("Write something or add a photo.");
      return;
    }
    onCreatePost?.();
    previews.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviews([]);
  };

  const charsLeft = 280 - composerText.length;
  const canPost =
    (composerText.trim().length > 0 || files.length > 0) && !creatingPost;

  // Avatar
  const initials = (
    user?.initials || (user?.name ? user.name.slice(0, 2) : "ME")
  ).toUpperCase();
  const AvatarEl = user?.avatar ? (
    <img
      src={user.avatar}
      alt={user.name || "You"}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        border: "2px solid rgba(255,138,42,0.5)",
      }}
    />
  ) : (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        flexShrink: 0,
        background: "linear-gradient(135deg,#ff8a2a,#7c3aed)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 14,
        userSelect: "none",
        border: "2px solid rgba(255,138,42,0.3)",
      }}
    >
      {initials}
    </div>
  );

  return (
    <div
      style={{
        background: "rgba(30, 18, 58, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: focused
          ? "1px solid rgba(255,138,42,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: "14px 16px 12px",
        marginBottom: 10,
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {AvatarEl}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Post type pills — only when focused */}
          {focused && (
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
                paddingBottom: 8,
              }}
            >
              {POST_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivePostType(t)}
                  style={{
                    padding: "3px 12px",
                    borderRadius: 99,
                    whiteSpace: "nowrap",
                    border: "1px solid",
                    borderColor:
                      activePostType === t
                        ? "#ff8a2a"
                        : "rgba(255,255,255,0.15)",
                    background:
                      activePostType === t
                        ? "rgba(255,138,42,0.2)"
                        : "rgba(255,255,255,0.05)",
                    color:
                      activePostType === t
                        ? "#ff8a2a"
                        : "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Share a travel tip, story, question, or meetup idea..."
            rows={focused ? 3 : 2}
            maxLength={280}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 15,
              lineHeight: 1.55,
              color: "#fff",
              background: "transparent",
              fontFamily: "inherit",
              boxSizing: "border-box",
              caretColor: "#ff8a2a",
            }}
          />

          {/* Destination — only when focused */}
          {focused && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <EnvironmentOutlined style={{ color: "#ff8a2a", fontSize: 14 }} />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Add destination or city..."
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.65)",
                  background: "transparent",
                  fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {/* Image previews */}
          {previews.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              {previews.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img
                    src={src}
                    alt={`preview-${i}`}
                    style={{
                      width: previews.length === 1 ? "100%" : 80,
                      maxWidth: previews.length === 1 ? "100%" : 80,
                      height: previews.length === 1 ? 180 : 80,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "2px solid rgba(255,138,42,0.6)",
                    }}
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <CloseCircleFilled
                      style={{ fontSize: 20, color: "#ff4d4f" }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              borderTop: focused ? "1px solid rgba(255,255,255,0.07)" : "none",
              paddingTop: focused ? 10 : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={files.length >= 4}
                style={{
                  background: "none",
                  border: "none",
                  cursor: files.length < 4 ? "pointer" : "not-allowed",
                  color: files.length < 4 ? "#ff8a2a" : "rgba(255,255,255,0.2)",
                  fontSize: 20,
                  padding: "4px 6px",
                  display: "flex",
                  alignItems: "center",
                  transition: "color 0.15s",
                }}
                title="Add photos"
              >
                <CameraOutlined />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/webp"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              {focused && (
                <span
                  style={{
                    fontSize: 12,
                    color:
                      charsLeft < 30
                        ? charsLeft < 0
                          ? "#ff4d4f"
                          : "#ff8a2a"
                        : "rgba(255,255,255,0.25)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {charsLeft}
                </span>
              )}
            </div>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={creatingPost}
              disabled={!canPost}
              onClick={handlePost}
              style={{
                background: canPost ? "#ff8a2a" : "rgba(255,138,42,0.3)",
                borderColor: "transparent",
                borderRadius: 99,
                fontWeight: 700,
                fontSize: 14,
                height: 36,
                paddingInline: 20,
                color: canPost ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            >
              Post to SkyHub
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
