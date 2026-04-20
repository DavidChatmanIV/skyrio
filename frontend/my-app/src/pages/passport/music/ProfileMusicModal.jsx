import React, { useEffect, useMemo, useState } from "react";
import { Modal, Space, Typography, Input, Button, message } from "antd";

const { Text } = Typography;

export const SKYRIO_PROFILE_MUSIC_KEY = "skyrio_profile_music_v1";

function detectProvider(link) {
  const v = String(link || "").toLowerCase();
  if (v.includes("spotify.com")) return "spotify";
  if (v.includes("music.apple.com") || v.includes("apple.com/music"))
    return "apple";
  if (v.includes("youtu.be") || v.includes("youtube.com")) return "youtube";
  return "link";
}

function placeholderFromProvider(p) {
  if (p === "spotify") return "Paste Spotify track/playlist/album URL…";
  if (p === "apple") return "Paste Apple Music song/album/playlist URL…";
  if (p === "youtube") return "Paste YouTube / YouTube Music URL…";
  return "Paste a music link (Spotify / Apple Music / YouTube)…";
}

function iconFromProvider(p) {
  if (p === "spotify") return "🎵";
  if (p === "apple") return "🎶";
  if (p === "youtube") return "▶️";
  return "🎵";
}

export default function ProfileMusicModal({ open, onClose, onSave, value }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    if (value?.url) {
      setUrl(value.url);
      return;
    }
    try {
      const raw = localStorage.getItem(SKYRIO_PROFILE_MUSIC_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.url) setUrl(saved.url);
    } catch {
      /* ignore */
    }
  }, [open, value?.url]);

  const provider = useMemo(() => detectProvider(url), [url]);
  const placeholder = useMemo(
    () => placeholderFromProvider(provider),
    [provider]
  );
  const icon = useMemo(() => iconFromProvider(provider), [provider]);

  const save = () => {
    const trimmed = (url || "").trim();
    if (!trimmed) return message.error("Add a link first.");
    const payload = {
      provider,
      url: trimmed,
      name: `${icon} My Travel Soundtrack`,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SKYRIO_PROFILE_MUSIC_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    message.success("Profile music saved ✓");
    onSave?.(payload);
    onClose?.();
  };

  const clear = () => {
    try {
      localStorage.removeItem(SKYRIO_PROFILE_MUSIC_KEY);
    } catch {
      /* ignore */
    }
    setUrl("");
    message.success("Profile music removed.");
    onSave?.(null);
  };

  return (
    <Modal
      title={
        <span style={{ color: "#fff", fontWeight: 700 }}>🎵 Profile Music</span>
      }
      open={!!open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      styles={{
        content: {
          background: "rgba(18, 10, 36, 0.97)",
          border: "1px solid rgba(255, 138, 42, 0.2)",
          borderRadius: 16,
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        },
        mask: {
          backdropFilter: "blur(8px)",
        },
      }}
    >
      <Space
        direction="vertical"
        size={16}
        style={{ width: "100%", paddingTop: 8 }}
      >
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Add your travel theme song. Paste a link from Spotify, Apple Music, or
          YouTube.
        </Text>

        {/* ── Provider detected badge ── */}
        {url.trim() && provider !== "link" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(255,138,42,0.15)",
              border: "1px solid rgba(255,138,42,0.3)",
              fontSize: 12,
              color: "#ffb066",
              fontWeight: 700,
            }}
          >
            {icon} {provider.charAt(0).toUpperCase() + provider.slice(1)}{" "}
            detected
          </div>
        )}

        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          allowClear
          size="large"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            color: "#fff",
          }}
        />

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          Examples: open.spotify.com/track/... · music.apple.com/... ·
          youtube.com/watch?v=...
        </div>

        <Space wrap>
          <Button
            type="primary"
            onClick={save}
            style={{
              background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
              border: "none",
              borderRadius: 999,
              color: "#1a0d04",
              fontWeight: 700,
              height: 38,
              padding: "0 22px",
            }}
          >
            Save
          </Button>
          <Button
            onClick={clear}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              height: 38,
              padding: "0 22px",
            }}
          >
            Remove
          </Button>
          <Button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              fontWeight: 600,
              height: 38,
            }}
          >
            Cancel
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}