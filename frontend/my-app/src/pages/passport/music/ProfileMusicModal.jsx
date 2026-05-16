import React, { useEffect, useMemo, useState } from "react";
import { Modal, Space, Typography, Input, Button, message } from "antd";

const { Text } = Typography;

export const SKYRIO_PROFILE_MUSIC_KEY = "skyrio_profile_music_v1";

const API = import.meta.env.VITE_API_URL || "";

function detectProvider(link) {
  const v = String(link || "").toLowerCase();
  if (v.includes("youtu.be") || v.includes("youtube.com")) return "youtube";
  return "link";
}

function getYouTubeEmbedUrl(url) {
  try {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    const u = new URL(url);
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
  } catch {}
  return null;
}

function getToken() {
  return localStorage.getItem("token") || "";
}

// ── Write to localStorage cache ──────────────────────────────
function cacheMusic(payload) {
  try {
    if (payload) {
      localStorage.setItem(SKYRIO_PROFILE_MUSIC_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(SKYRIO_PROFILE_MUSIC_KEY);
    }
  } catch {
    /* ignore */
  }
}

// ── Read from localStorage cache ─────────────────────────────
function readCache() {
  try {
    const raw = localStorage.getItem(SKYRIO_PROFILE_MUSIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.url ? parsed : null;
  } catch {
    return null;
  }
}

export default function ProfileMusicModal({ open, onClose, onSave, value }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── On open: seed from prop → cache → API ────────────────
  useEffect(() => {
    if (!open) return;

    // 1. Immediate seed from prop or cache (no flicker)
    const seed = value?.url || readCache()?.url || "";
    setUrl(seed);

    // 2. Fetch canonical value from API
    const token = getToken();
    if (!token) return;

    setLoading(true);
    fetch(`${API}/api/profile/music`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.music?.url) {
          setUrl(data.music.url);
          cacheMusic(data.music);
        }
      })
      .catch(() => {
        /* silent — cache already seeded */
      })
      .finally(() => setLoading(false));
  }, [open, value?.url]);

  const provider = useMemo(() => detectProvider(url), [url]);

  // ── Save ─────────────────────────────────────────────────
  const save = async () => {
    const trimmed = (url || "").trim();
    if (!trimmed) return message.error("Add a YouTube link first.");
    if (provider !== "youtube")
      return message.error("Please paste a valid YouTube link.");

    const payload = {
      provider,
      url: trimmed,
      name: "▶️ My Travel Soundtrack",
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const token = getToken();

      // ✅ Save to API so all devices stay in sync
      if (token) {
        const res = await fetch(`${API}/api/profile/music`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ music: payload }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to save music");
        }
      }

      // ✅ Also write to cache for instant display on reload
      cacheMusic(payload);

      message.success("Profile music saved ✓");
      onSave?.(payload);
      onClose?.();
    } catch (err) {
      message.error(err.message || "Could not save music. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Remove ────────────────────────────────────────────────
  const clear = async () => {
    setSaving(true);
    try {
      const token = getToken();

      // ✅ Remove from API
      if (token) {
        await fetch(`${API}/api/profile/music`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {
          /* silent */
        });
      }

      // ✅ Clear cache
      cacheMusic(null);
      setUrl("");

      message.success("Profile music removed.");
      onSave?.(null);
    } finally {
      setSaving(false);
    }
  };

  const embedUrl =
    provider === "youtube" && url.trim()
      ? getYouTubeEmbedUrl(url.trim())
      : null;

  return (
    <Modal
      title={
        <span style={{ color: "#fff", fontWeight: 700 }}>▶️ Profile Music</span>
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
        mask: { backdropFilter: "blur(8px)" },
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
          Add your travel theme song. Paste a YouTube link below.
        </Text>

        {/* Loading indicator */}
        {loading && (
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
            Loading your saved music…
          </Text>
        )}

        {/* Provider badge */}
        {url.trim() && provider === "youtube" && (
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
            ▶️ YouTube detected
          </div>
        )}

        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube link (youtube.com/watch?v=... or youtu.be/...)"
          allowClear
          size="large"
          disabled={loading}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            color: "#fff",
          }}
        />

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          Saved music syncs across all your devices.
        </div>

        {/* YouTube preview */}
        {embedUrl && (
          <div
            style={{
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255,138,42,0.2)",
            }}
          >
            <iframe
              width="100%"
              height="200"
              src={embedUrl}
              title="YouTube Music Preview"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <Space wrap>
          <Button
            type="primary"
            onClick={save}
            loading={saving}
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
            loading={saving}
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
