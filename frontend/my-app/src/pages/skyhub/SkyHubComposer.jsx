import React, { useRef, useState, useCallback } from "react";
import "@/styles/SkyHubComposer.css";
import { Button, Input, Segmented, Tag, message } from "antd";
import {
  EnvironmentOutlined,
  SendOutlined,
  CompassOutlined,
  InfoCircleOutlined,
  CameraOutlined,
  CloseOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { skyhubPostTypes } from "./skyhubData";

const { TextArea } = Input;

const MAX_PHOTOS = 4;
const MAX_FILE_MB = 10;

export default function SkyHubComposer({
  composerText,
  setComposerText,
  activePostType,
  setActivePostType,
  destination,
  setDestination,
  onCreatePost,
  creatingPost = false,
  // Optional: parent receives selected File objects for upload
  onPhotosChange,
}) {
  const charCount = composerText.length;
  const maxRecommended = 280;

  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback(
    (files) => {
      const valid = Array.from(files).filter((f) => {
        if (!f.type.startsWith("image/")) {
          message.error(`${f.name} is not an image.`);
          return false;
        }
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
          message.error(`${f.name} exceeds ${MAX_FILE_MB}MB limit.`);
          return false;
        }
        return true;
      });

      const slots = MAX_PHOTOS - photos.length;
      if (slots <= 0) {
        message.warning(`Maximum ${MAX_PHOTOS} photos per post.`);
        return;
      }
      if (valid.length > slots) {
        message.warning(
          `Only ${slots} more photo${slots > 1 ? "s" : ""} allowed.`
        );
      }

      valid.slice(0, slots).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotos((prev) => {
            const next = [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                preview: e.target.result,
                file,
              },
            ];
            onPhotosChange?.(next.map((p) => p.file));
            return next;
          });
        };
        reader.readAsDataURL(file);
      });
    },
    [photos.length, onPhotosChange]
  );

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      onPhotosChange?.(next.map((p) => p.file));
      return next;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePost = () => {
    onCreatePost();
    setTimeout(() => {
      setPhotos([]);
      onPhotosChange?.([]);
    }, 300);
  };

  return (
    <section className="skyhub-composerCard">
      {/* ── Header ── */}
      <div className="skyhub-composerTop">
        <div className="skyhub-composerTitleWrap">
          <h2 className="skyhub-sectionTitle">Share with the community</h2>
          <p className="skyhub-sectionSubtext">
            Post travel tips, ask smart questions, and help other travelers move
            better.
          </p>
        </div>
      </div>

      {/* ── Post type ── */}
      <div className="skyhub-composerTypeRow">
        <div className="skyhub-toolbarLabel">Post type</div>
        <Segmented
          options={skyhubPostTypes}
          value={activePostType}
          onChange={setActivePostType}
          block
        />
      </div>

      {/* ── Inputs ── */}
      <div className="skyhub-composerInputs">
        <div className="skyhub-composerField">
          <div className="skyhub-composerFieldLabel">Destination</div>
          <Input
            size="large"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Add destination or city"
            prefix={<EnvironmentOutlined />}
            className="skyhub-input"
          />
        </div>

        <div className="skyhub-composerField">
          <div className="skyhub-composerFieldLabel">Your post</div>
          <TextArea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder="Share a travel tip, story, question, meetup idea, or something useful..."
            autoSize={{ minRows: 5, maxRows: 8 }}
            className="skyhub-textarea"
          />
        </div>

        {/* ── Photos ── */}
        <div className="skyhub-composerField">
          <div className="skyhub-composerFieldLabel">
            <PictureOutlined style={{ marginRight: 6 }} />
            Photos
            {photos.length > 0 && (
              <span className="skyhub-photoCount">
                {photos.length}/{MAX_PHOTOS}
              </span>
            )}
          </div>

          {/* Preview grid */}
          {photos.length > 0 && (
            <div className="skyhub-photoGrid">
              {photos.map((photo) => (
                <div key={photo.id} className="skyhub-photoThumb">
                  <img src={photo.preview} alt="" />
                  <button
                    type="button"
                    className="skyhub-photoRemove"
                    onClick={() => removePhoto(photo.id)}
                    aria-label="Remove photo"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  className="skyhub-photoAddMore"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="skyhub-photoAddMore-icon">+</span>
                  <span className="skyhub-photoAddMore-label">Add more</span>
                </button>
              )}
            </div>
          )}

          {/* Drop zone — shown when no photos */}
          {photos.length === 0 && (
            <div
              className={`skyhub-dropZone${isDragging ? " is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && fileInputRef.current?.click()
              }
            >
              <CameraOutlined className="skyhub-dropZone-icon" />
              <div className="skyhub-dropZone-title">
                Add photos to your post
              </div>
              <div className="skyhub-dropZone-sub">
                Tap to browse · or drag &amp; drop
              </div>
              <div className="skyhub-dropZone-hint">
                JPG, PNG, HEIC · max {MAX_FILE_MB}MB · up to {MAX_PHOTOS} photos
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* ── Meta row ── */}
      <div className="skyhub-composerMetaRow">
        <div className="skyhub-composerHints">
          <Tag className="skyhub-softTag" icon={<CompassOutlined />}>
            Travel-first
          </Tag>
          <Tag className="skyhub-softTag" icon={<InfoCircleOutlined />}>
            Helpful posts win
          </Tag>
          <Tag className="skyhub-softTag">{activePostType}</Tag>
        </div>
        <div
          className={`skyhub-charCount${
            charCount > maxRecommended ? " is-over" : ""
          }`}
        >
          {charCount}/{maxRecommended}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="skyhub-composerFooter">
        {/* Visible photo button — always in toolbar */}
        <div className="skyhub-composerToolbar">
          <button
            type="button"
            className="skyhub-toolbarBtn"
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length >= MAX_PHOTOS}
            title={
              photos.length >= MAX_PHOTOS
                ? `Max ${MAX_PHOTOS} photos`
                : "Add a photo"
            }
          >
            <CameraOutlined />
            <span>Photo</span>
            {photos.length > 0 && (
              <span className="skyhub-toolbarBtn-badge">{photos.length}</span>
            )}
          </button>
        </div>

        <div className="skyhub-composerFooterRight">
          <div className="skyhub-composerHelperText">
            Keep it useful, clear, and travel-related so the right people can
            find it.
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handlePost}
            className="skyhub-primaryBtn"
            loading={creatingPost}
            disabled={!composerText.trim() && photos.length === 0}
          >
            Post to SkyHub
          </Button>
        </div>
      </div>
    </section>
  );
}
