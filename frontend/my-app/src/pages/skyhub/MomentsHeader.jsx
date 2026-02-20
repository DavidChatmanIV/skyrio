import React, { useEffect, useMemo, useRef, useState } from "react";

export default function MomentsHeader({ onCreatePost }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState(null);

  const fileRef = useRef(null);

  const canPost = useMemo(() => {
    const hasText = text.trim().length > 0;
    const hasImg = !!imageDataUrl;
    return hasText || hasImg;
  }, [text, imageDataUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closeAndReset = () => {
    setOpen(false);
    setText("");
    setImageDataUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePickImage = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // simple guard: images only
    if (!f.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result || ""));
    reader.readAsDataURL(f);
  };

  const handlePost = () => {
    if (!canPost) return;
    onCreatePost?.({ text, imageUrl: imageDataUrl });
    closeAndReset();
  };

  return (
    <header className="skyhub-header">
      {/* Composer bar (like mock) */}
      <div
        className="skyhub-composer"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
      >
        <div className="skyhub-composerIcon" aria-hidden="true">
          +
        </div>
        <div className="skyhub-composerText">
          Share a moment from your trip...
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="skyhub-modalOverlay" onMouseDown={closeAndReset}>
          <div
            className="skyhub-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="skyhub-modalTop">
              <div className="skyhub-modalTitle">Create a Moment</div>
              <button
                className="skyhub-xBtn"
                type="button"
                onClick={closeAndReset}
              >
                ✕
              </button>
            </div>

            <textarea
              className="skyhub-textarea"
              rows={4}
              placeholder="Share a moment from your trip..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {/* image preview */}
            {imageDataUrl && (
              <div className="skyhub-previewWrap">
                <img
                  className="skyhub-previewImg"
                  src={imageDataUrl}
                  alt="Upload preview"
                />
                <button
                  className="skyhub-removeImg"
                  type="button"
                  onClick={() => setImageDataUrl(null)}
                >
                  Remove image
                </button>
              </div>
            )}

            <div className="skyhub-modalActions">
              <input
                ref={fileRef}
                className="skyhub-fileInput"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              <button
                className="skyhub-btn skyhub-btnGhost"
                type="button"
                onClick={handlePickImage}
              >
                Image upload
              </button>

              <div className="skyhub-actionsSpacer" />

              <button
                className="skyhub-btn skyhub-btnPrimary"
                type="button"
                disabled={!canPost}
                onClick={handlePost}
              >
                Post to SkyHub
              </button>
            </div>

            <div className="skyhub-modalHint">
              Earn +15 XP for posting a Moment.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}