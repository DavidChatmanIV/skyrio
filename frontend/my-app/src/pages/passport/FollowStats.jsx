import React, { useMemo } from "react";

/**
 * Props:
 *   followers   — number
 *   following   — number
 *   loading     — boolean (shows placeholder dashes)
 *   onClickFollowers — () => void
 *   onClickFollowing — () => void
 */

function formatCount(n) {
  if (n == null) return "0";
  const v = Number(n);
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (v >= 10_000) {
    const k = v / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  if (v >= 1_000) return v.toLocaleString();
  return String(v);
}

const STYLES = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    marginTop: 12,
    flexWrap: "wrap",
  },
  btn: {
    background: "none",
    border: "none",
    padding: "4px 0",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "baseline",
    gap: 5,
    fontFamily: "inherit",
    transition: "opacity 0.15s ease",
  },
  count: {
    fontWeight: 700,
    fontSize: 15,
    color: "#ffffffed", // near-white, matches Skyrio headings
    lineHeight: 1,
  },
  label: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.45)", // Skyrio muted text
    fontWeight: 400,
    lineHeight: 1,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: "50%",
    background: "rgba(255,138,42,0.4)", // Skyrio orange, subtle
    flexShrink: 0,
    alignSelf: "center",
  },
  placeholder: {
    display: "inline-block",
    width: 24,
    height: 14,
    borderRadius: 4,
    background: "rgba(255,255,255,0.08)",
    animation: "skyrioFollowPulse 1.4s ease-in-out infinite",
  },
};

export default function FollowStats({
  followers = 0,
  following = 0,
  loading = false,
  onClickFollowers,
  onClickFollowing,
}) {
  const followersDisplay = useMemo(() => formatCount(followers), [followers]);
  const followingDisplay = useMemo(() => formatCount(following), [following]);

  return (
    <>
      <style>{`
        @keyframes skyrioFollowPulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
        .skyrio-follow-btn:hover .skyrio-follow-count {
          color: #ff8a2a !important;
        }
        .skyrio-follow-btn:hover .skyrio-follow-label {
          color: rgba(255, 255, 255, 0.65) !important;
        }
        .skyrio-follow-btn:active {
          opacity: 0.7;
        }
      `}</style>

      <div style={STYLES.row}>
        <button
          type="button"
          className="skyrio-follow-btn"
          style={STYLES.btn}
          onClick={onClickFollowers}
        >
          {loading ? (
            <span style={STYLES.placeholder} />
          ) : (
            <span className="skyrio-follow-count" style={STYLES.count}>
              {followersDisplay}
            </span>
          )}
          <span className="skyrio-follow-label" style={STYLES.label}>
            {followers === 1 ? "Follower" : "Followers"}
          </span>
        </button>

        <span style={STYLES.dot} />

        <button
          type="button"
          className="skyrio-follow-btn"
          style={STYLES.btn}
          onClick={onClickFollowing}
        >
          {loading ? (
            <span style={STYLES.placeholder} />
          ) : (
            <span className="skyrio-follow-count" style={STYLES.count}>
              {followingDisplay}
            </span>
          )}
          <span className="skyrio-follow-label" style={STYLES.label}>
            Following
          </span>
        </button>
      </div>
    </>
  );
}
