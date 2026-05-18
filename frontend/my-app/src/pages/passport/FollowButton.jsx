import React, { useState, useCallback, useRef } from "react";
import { Plane } from "lucide-react";
import { apiUrl } from "@/lib/api";

/**
 * Props:
 *   userId       — string  (target user id to follow/unfollow)
 *   isFollowing  — boolean (initial state)
 *   size         — "default" | "small"  (small for list rows)
 *   token        — string  (auth bearer token)
 *   onToggle     — (newState: boolean) => void  (called after successful toggle)
 */

const ANIM_CSS = `
@keyframes skyrioPlaneUp {
  0%   { transform: translateY(0) rotate(-45deg); opacity: 1; }
  60%  { transform: translateY(-10px) rotate(-45deg); opacity: 1; }
  100% { transform: translateY(-16px) rotate(-45deg); opacity: 0; }
}
@keyframes skyrioPulseRing {
  0%   { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.8); opacity: 0; }
}
.skyrio-fb:focus-visible {
  outline: 2px solid #ff8a2a;
  outline-offset: 2px;
}
`;

export default function FollowButton({
  userId,
  isFollowing: initialFollowing = false,
  size = "default",
  token,
  onToggle,
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [hover, setHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const cooldown = useRef(false);

  const isSmall = size === "small";

  const handleClick = useCallback(async () => {
    if (loading || cooldown.current || !userId) return;
    cooldown.current = true;
    setTimeout(() => {
      cooldown.current = false;
    }, 600);

    const willFollow = !following;

    // Optimistic update
    setFollowing(willFollow);
    if (willFollow) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 500);
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/follow/${userId}`), {
        method: willFollow ? "POST" : "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        setFollowing(!willFollow);
        return;
      }

      onToggle?.(willFollow);
    } catch {
      setFollowing(!willFollow);
    } finally {
      setLoading(false);
    }
  }, [following, loading, userId, token, onToggle]);

  // ── Style logic ──
  const height = isSmall ? 30 : 36;
  const px = isSmall ? 14 : 20;
  const fontSize = isSmall ? 12 : 13;
  const iconSize = isSmall ? 12 : 14;

  const showUnfollow = following && hover;

  const baseStyle = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height,
    padding: `0 ${px}px`,
    borderRadius: 999,
    border: "none",
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    fontSize,
    letterSpacing: "0.01em",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    opacity: loading ? 0.7 : 1,
  };

  let btnStyle;

  if (!following) {
    // "Follow" — gradient orange border, transparent fill
    btnStyle = {
      ...baseStyle,
      background: hover
        ? "linear-gradient(135deg, rgba(255,138,42,0.15), rgba(139,92,255,0.15))"
        : "transparent",
      color: "#ff8a2a",
      boxShadow: `inset 0 0 0 1.5px ${
        hover ? "#ff8a2a" : "rgba(255,138,42,0.45)"
      }`,
    };
  } else if (showUnfollow) {
    // "Unfollow" — red tint on hover
    btnStyle = {
      ...baseStyle,
      background: "rgba(255,77,79,0.1)",
      color: "#ff4d4f",
      boxShadow: "inset 0 0 0 1.5px rgba(255,77,79,0.4)",
    };
  } else {
    // "Following" — subtle filled state
    btnStyle = {
      ...baseStyle,
      background: "rgba(255,138,42,0.12)",
      color: "rgba(255,255,255,0.85)",
      boxShadow: "inset 0 0 0 1.5px rgba(255,138,42,0.2)",
    };
  }

  const label = !following ? "Follow" : showUnfollow ? "Unfollow" : "Following";

  return (
    <>
      <style>{ANIM_CSS}</style>
      <button
        type="button"
        className="skyrio-fb"
        style={btnStyle}
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={loading}
        aria-label={
          following ? "Unfollow this traveler" : "Follow this traveler"
        }
      >
        <span style={{ display: "inline-flex", position: "relative" }}>
          <Plane
            size={iconSize}
            style={{
              transform: "rotate(-45deg)",
              transition: "color 0.2s",
              ...(animating
                ? { animation: "skyrioPlaneUp 0.5s ease-out forwards" }
                : {}),
            }}
          />
          {animating && (
            <Plane
              size={iconSize}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: "rotate(-45deg)",
                opacity: 0,
              }}
            />
          )}
        </span>

        <span>{label}</span>

        {animating && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              border: "2px solid rgba(255,138,42,0.4)",
              animation: "skyrioPulseRing 0.5s ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}
      </button>
    </>
  );
}
