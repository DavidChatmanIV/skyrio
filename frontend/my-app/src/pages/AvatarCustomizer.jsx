import React, { useRef, useState } from "react";
import { Avatar, Button, Space, Select, Typography, message } from "antd";
import {
  UploadOutlined,
  UserOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/useAuth";
import { apiUrl } from "@/lib/api";

const { Text } = Typography;

/**
 * AvatarCustomizer — FIXED VERSION
 *
 * Changes from original:
 * 1. Uploads file to /api/uploads/image (same as DigitalPassportPage)
 * 2. Saves avatar URL to /api/profile/update
 * 3. Updates AuthContext user + localStorage so it persists on refresh
 * 4. Falls back to base64 preview while upload is in progress
 *
 * Props:
 *  - avatar: { avatarUrl: string|null, borderStyle: string }
 *  - onAvatarChange: (nextAvatar) => void
 *  - borderStyles: Record<string, React.CSSProperties>
 */
const AvatarCustomizer = ({ avatar, onAvatarChange, borderStyles }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { token, setUser } = useAuth();

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      message.error("Please choose an image file.");
      return;
    }

    // Step 1: Show a local base64 preview immediately while uploading
    const reader = new FileReader();
    reader.onload = () => {
      onAvatarChange({ ...avatar, avatarUrl: reader.result });
    };
    reader.readAsDataURL(file);

    // Step 2: Upload to server + persist
    setUploading(true);
    try {
      // Upload the image file
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(apiUrl("/api/uploads/image"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || "Upload failed");

      const avatarUrl = uploadData.url;

      // Save to profile
      const profileRes = await fetch(apiUrl("/api/profile/update"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ avatar: avatarUrl }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok)
        throw new Error(profileData.message || "Failed to save avatar");

      // Update the parent component with the real CDN URL (not base64)
      onAvatarChange({ ...avatar, avatarUrl });

      // ✅ FIX: Update AuthContext + localStorage so refresh doesn't lose the photo
      if (setUser) {
        setUser((prev) => ({ ...prev, avatar: avatarUrl }));
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          localStorage.setItem(
            "user",
            JSON.stringify({ ...stored, avatar: avatarUrl })
          );
        } catch {
          /* ignore */
        }
      }

      message.success("Avatar updated ✓");
    } catch (err) {
      message.error(err.message || "Avatar upload failed");
      // Revert preview back to previous avatar on failure
      onAvatarChange({ ...avatar });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBorderChange = (value) => {
    onAvatarChange({ ...avatar, borderStyle: value });
  };

  const borderStyle =
    borderStyles?.[avatar?.borderStyle] || borderStyles?.None || {};

  return (
    <div>
      <Space size="large" align="center" wrap>
        {/* Avatar preview */}
        <div style={{ display: "grid", placeItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Avatar
              size={88}
              icon={!avatar?.avatarUrl && <UserOutlined />}
              src={avatar?.avatarUrl}
              style={{
                borderRadius: "9999px",
                background: "#f8fafc",
                opacity: uploading ? 0.6 : 1,
                transition: "opacity 0.2s",
                ...borderStyle,
              }}
            />
            {uploading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "9999px",
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                <LoadingOutlined style={{ color: "#ff8a2a", fontSize: 22 }} />
              </div>
            )}
          </div>
          <Text type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
            {uploading ? "Uploading..." : "Preview (same as header)"}
          </Text>
        </div>

        <Space direction="vertical" size={8}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: "none" }}
          />

          <Button
            icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
            onClick={handlePick}
            disabled={uploading}
            style={{ minHeight: 44 }}
          >
            {uploading ? "Uploading..." : "Upload Avatar"}
          </Button>

          <div>
            <Text style={{ marginRight: 8 }}>Border Style:</Text>
            <Select
              value={avatar?.borderStyle}
              style={{ width: 160 }}
              onChange={handleBorderChange}
              options={Object.keys(borderStyles || {}).map((k) => ({
                value: k,
                label: k,
              }))}
            />
          </div>
        </Space>
      </Space>
    </div>
  );
};

export default AvatarCustomizer;
