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

export default function ProfileMusicModal({ open, onClose, onSave, value }) {
  const [url, setUrl] = useState("");

  // If parent passes current value, we can preload it.
  // Otherwise we load from localStorage on open.
  useEffect(() => {
    if (!open) return;

    // Priority 1: prop value
    if (value?.url) {
      setUrl(value.url);
      return;
    }

    // Priority 2: localStorage
    try {
      const raw = localStorage.getItem(SKYRIO_PROFILE_MUSIC_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.url) setUrl(saved.url);
    } catch {
      // ignore
    }
  }, [open, value?.url]);

  const provider = useMemo(() => detectProvider(url), [url]);
  const placeholder = useMemo(
    () => placeholderFromProvider(provider),
    [provider]
  );

  const save = () => {
    const trimmed = (url || "").trim();
    if (!trimmed) return message.error("Add a link first.");

    const payload = {
      provider,
      url: trimmed,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(SKYRIO_PROFILE_MUSIC_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }

    message.success("Saved your profile music.");
    onSave?.(payload);
    onClose?.();
  };

  const clear = () => {
    try {
      localStorage.removeItem(SKYRIO_PROFILE_MUSIC_KEY);
    } catch {
      // ignore
    }
    setUrl("");
    message.success("Cleared profile music.");
    onSave?.(null);
  };

  return (
    <Modal
      title="🎵 Profile Music"
      open={!!open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      wrapClassName="sk-musicModal"
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Text style={{ color: "rgba(255,255,255,.85)" }}>
          Soft launch: add one profile theme song link. (Spotify / Apple Music /
          YouTube)
        </Text>

        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          allowClear
        />

        <Space wrap>
          <Button type="primary" onClick={save}>
            Save
          </Button>
          <Button onClick={clear} danger>
            Remove
          </Button>
          <Button onClick={onClose} type="text">
            Cancel
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}