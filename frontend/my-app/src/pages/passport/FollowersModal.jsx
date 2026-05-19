import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Spin } from "antd";
import { MapPin } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";
import FollowButton from "./FollowButton";

function UserRow({ user: u, myId, token, onNavigate }) {
  const display = u.name || u.username || "Traveler";
  const handle = u.username ? `@${u.username}` : "";
  const isMe = myId && String(u.id || u._id) === String(myId);
  const initial = (display[0] || "?").toUpperCase();
  const hasAvatar =
    u.avatar &&
    u.avatar !== "/default-avatar.png" &&
    u.avatarUrl !== "/default-avatar.png";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 20px",
        cursor: "pointer",
        transition: "background 0.15s",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Avatar — clickable */}
      <div
        onClick={() => u.username && onNavigate(u.username)}
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: hasAvatar
            ? "transparent"
            : "linear-gradient(135deg, rgba(124,92,252,0.4), rgba(255,138,42,0.4))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid rgba(255,138,42,0.2)",
        }}
      >
        {hasAvatar ? (
          <img
            src={u.avatar || u.avatarUrl}
            alt={display}
            style={{ width: 46, height: 46, objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            {initial}
          </span>
        )}
      </div>

      {/* Info — clickable */}
      <div
        onClick={() => u.username && onNavigate(u.username)}
        style={{ flex: 1, minWidth: 0 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {display}
          </span>
          {u.isOfficial && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,138,42,0.15)",
                color: "#ff8a2a",
                letterSpacing: "0.04em",
              }}
            >
              Official
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {handle}
        </div>
      </div>

      {/* Follow button — not clickable for self */}
      {!isMe && (
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <FollowButton
            userId={u.id || u._id}
            isFollowing={!!u.isFollowing}
            size="small"
            token={token}
          />
        </div>
      )}
    </div>
  );
}

export default function FollowersModal({ open, onClose, mode = "following" }) {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const myId = user?._id || user?.id || null;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      try {
        const url =
          mode === "followers"
            ? apiUrl("/api/passport/followers?limit=25")
            : apiUrl("/api/passport/following?limit=25");

        const res = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data?.ok) setItems(data.items || []);
      } catch (e) {
        console.error("FollowersModal load error:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, mode, token]);

  const handleNavigate = (username) => {
    onClose();
    navigate(`/u/${username}`);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      title={null}
      className="sk-followModal"
      styles={{
        content: {
          background: "rgba(22,18,40,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: 0,
          overflow: "hidden",
        },
        header: { display: "none" },
        body: { padding: 0 },
      }}
    >
      {/* Custom header */}
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "Syne, DM Sans, sans-serif",
          }}
        >
          {mode === "followers" ? "Followers" : "Following"}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          {items.length}{" "}
          {mode === "followers"
            ? items.length === 1
              ? "person"
              : "people"
            : ""}
        </span>
      </div>

      {/* List */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {loading ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "rgba(255,255,255,0.35)",
              fontSize: 14,
            }}
          >
            <Spin size="small" />
            <span>Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: "rgba(255,255,255,0.3)",
              fontSize: 14,
            }}
          >
            {mode === "followers"
              ? "No followers yet — share your passport!"
              : "Not following anyone yet — search for travelers!"}
          </div>
        ) : (
          items.map((u) => (
            <UserRow
              key={u.id || u._id}
              user={u}
              myId={myId}
              token={token}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
