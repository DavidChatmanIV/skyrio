import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Avatar,
  Button,
  Progress,
  Skeleton,
  Tag,
  Modal,
  Input,
  App,
} from "antd";
import {
  UserOutlined,
  ShareAltOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  EditOutlined,
  DeleteOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Star,
  Award,
  Tag as LucideTag,
  MapPin,
  Plane,
  Lock,
  Camera,
  Loader2,
  Circle,
  Search,
  X,
} from "lucide-react";
import { io } from "socket.io-client";

import "../../styles/profile-passport.css";
import "../../styles/passport-locked.css";

const SPIN_STYLE = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .ant-input-textarea-show-count::after,
  .ant-input-data-count,
  .ant-input-textarea .ant-input-data-count {
    color: rgba(255,255,255,0.45) !important;
  }
`;
import passportBg from "../../assets/DigitalPassport/worldmap.png";

import ProfileMusicModal, {
  SKYRIO_PROFILE_MUSIC_KEY,
} from "./music/ProfileMusicModal";

import FollowersModal from "./FollowersModal";
import FollowStats from "./FollowStats";
import FollowButton from "./FollowButton";
import { useAuth } from "../../auth/useAuth";
import RewardsOptInPrompt from "../../components/rewards/RewardsOptInPrompt";
import useRewardsOptInPrompt from "../../hooks/useRewardsOptInPrompt";
import { apiUrl } from "@/lib/api";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import ShareRankPrompt from "./ShareRankPrompt";
import PlaneBadge, { PlaneBadgePending } from "./PlaneBadge";

const { Title, Text } = Typography;

const API = import.meta.env.VITE_API_URL || "";

function safeEmailPrefix(email) {
  if (!email) return "";
  const idx = email.indexOf("@");
  return idx > 0 ? email.slice(0, idx) : email;
}

const LOCK_PERKS = [
  {
    icon: <Star size={16} />,
    text: "Earn XP on every flight, hotel, and activity",
  },
  {
    icon: <Award size={16} />,
    text: "Unlock badges and level up your traveller rank",
  },
  {
    icon: <LucideTag size={16} />,
    text: "Redeem XP for real discounts on future bookings",
  },
  {
    icon: <MapPin size={16} />,
    text: "Save trips and build your personal travel map",
  },
  {
    icon: <Plane size={16} />,
    text: "Get personalised AI trip recommendations",
  },
];

const PREVIEW_STATS = [
  { val: "2,840", label: "XP Earned" },
  { val: "12", label: "Trips Saved" },
  { val: "15%", label: "Discount" },
];

const PREVIEW_BADGES = ["🏖️", "🗼", "🏔️", "🌏", "✈️", "🎌"];

// ── Travel vibe options ──────────────────────────────────────
const VIBE_OPTIONS = [
  "Beach",
  "Adventure",
  "Food",
  "Culture",
  "Nightlife",
  "Nature",
  "Solo",
  "Luxury",
  "Budget",
  "Road Trip",
  "Wellness",
  "Photography",
  "Music",
  "History",
  "Backpacking",
];

function getYouTubeEmbedUrl(url) {
  try {
    if (!url) return null;
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split("?")[0];
      if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
    }
    const u = new URL(url);
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
  } catch {}
  return null;
}

function isYouTubeUrl(url) {
  const v = String(url || "").toLowerCase();
  return v.includes("youtu.be") || v.includes("youtube.com");
}

// ── Inline Traveler Search ───────────────────────────────────
function InlineTravelerSearch({ token, onFollowChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // FIX 7: clear debounce timer on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(
    async (q) => {
      if (!q || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          apiUrl(`/api/follow/search?q=${encodeURIComponent(q)}&limit=8`),
          {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const data = await res.json();
        if (data?.ok) setResults(data.users || []);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 300);
  };

  const handleFollowToggle = useCallback(
    (userId, nowFollowing) => {
      setResults((prev) =>
        prev.map((u) =>
          String(u._id || u.id) === String(userId)
            ? { ...u, isFollowing: nowFollowing }
            : u
        )
      );
      onFollowChange?.(nowFollowing);
    },
    [onFollowChange]
  );

  const showDropdown = focused && query.length >= 2;

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          border: focused
            ? "1px solid rgba(255,138,42,0.4)"
            : "1px solid rgba(255,255,255,0.08)",
          transition: "border-color 0.2s",
        }}
      >
        <Search size={16} color="rgba(255,255,255,0.35)" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          placeholder="Search travelers..."
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            color: "#fff",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              display: "flex",
            }}
          >
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "rgba(22,18,40,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            maxHeight: 380,
            overflowY: "auto",
            backdropFilter: "blur(20px)",
          }}
        >
          {loading && (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              No travelers found for "{query}"
            </div>
          )}
          {!loading &&
            results.map((u) => (
              <div
                key={u._id || u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  onClick={() => {
                    setFocused(false);
                    navigate(`/u/${u.username}`);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    background:
                      "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(255,138,42,0.3))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {u.avatar && u.avatar !== "/default-avatar.png" ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      style={{ width: 40, height: 40, objectFit: "cover" }}
                    />
                  ) : (
                    <span
                      style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}
                    >
                      {(u.name || u.username || "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div
                  onClick={() => {
                    setFocused(false);
                    navigate(`/u/${u.username}`);
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.name || u.username}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>@{u.username}</span>
                    {/* Show badge in search results if the user is verified */}
                    {u.verifiedTier && (
                      <PlaneBadge tier={u.verifiedTier} size={12} />
                    )}
                  </div>
                </div>
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0 }}
                >
                  <FollowButton
                    userId={u._id || u.id}
                    isFollowing={!!u.isFollowing}
                    size="small"
                    token={token}
                    onToggle={(nowFollowing) =>
                      handleFollowToggle(u._id || u.id, nowFollowing)
                    }
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Locked state ─────────────────────────────────────────────
function PassportLocked() {
  const navigate = useNavigate();
  return (
    <div className="passport-page">
      <div
        className="passport-bg"
        style={{
          backgroundImage: `url(${passportBg})`,
          filter: "blur(4px) brightness(0.5) saturate(0.8)",
        }}
        aria-hidden="true"
      />
      <div className="passport-content">
        <div className="plk-page">
          <div className="plk-inner">
            <div className="plk-hero">
              <h1 className="plk-title">Digital Passport</h1>
              <p className="plk-sub">
                Your travel identity — XP, badges, and exclusive rewards.
              </p>
            </div>
            <div className="plk-layout">
              <div className="plk-preview" aria-hidden="true">
                <div className="plk-blur">
                  <div className="plk-blur-topbar">
                    <span className="plk-blur-name">Explorer's Passport</span>
                    <span className="plk-blur-level">Level 7 ✦</span>
                  </div>
                  <div className="plk-blur-stats">
                    {PREVIEW_STATS.map((s) => (
                      <div key={s.label} className="plk-blur-stat">
                        <div className="plk-blur-val">{s.val}</div>
                        <div className="plk-blur-label">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="plk-blur-badges">
                    {PREVIEW_BADGES.map((b, i) => (
                      <div key={i} className="plk-blur-badge">
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="plk-overlay">
                  <div className="plk-lock-icon">
                    <Lock size={32} strokeWidth={1.5} />
                  </div>
                  <h2 className="plk-lock-title">Your passport awaits</h2>
                  <p className="plk-lock-sub">
                    Create a free account to unlock your stats, badges, and
                    travel history.
                  </p>
                </div>
              </div>
              <div className="plk-cta-panel">
                <div className="plk-perks">
                  {LOCK_PERKS.map((p) => (
                    <div key={p.text} className="plk-perk">
                      <span className="plk-perk-icon">{p.icon}</span>
                      <span className="plk-perk-text">{p.text}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="plk-cta"
                  onClick={() =>
                    navigate("/register", {
                      state: { redirectTo: "/passport" },
                    })
                  }
                >
                  Create your boarding pass — it's free
                </button>
                <p className="plk-signin">
                  Already a member?{" "}
                  <button
                    className="plk-signin-link"
                    onClick={() =>
                      navigate("/login", { state: { redirectTo: "/passport" } })
                    }
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

// ── Referral share SVG icons ──────────────────────────────────
function SharePlaneIcon({ size = 16, color = "#ff8a2a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.25.25 0 0 1 0 .5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.289z" />
    </svg>
  );
}
function ShareGlobeIcon({ size = 16, color = "#ff8a2a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M21.721 12.752a9.711 9.711 0 0 0-.945-5.003 12.754 12.754 0 0 1-4.339 2.708 18.991 18.991 0 0 1-.214 4.772 17.165 17.165 0 0 0 5.498-2.477zM14.634 15.55a17.324 17.324 0 0 0 .332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 0 0 .332 4.647 17.385 17.385 0 0 0 5.268 0zM9.772 17.119a18.963 18.963 0 0 0 4.456 0A17.182 17.182 0 0 1 12 21.724a17.18 17.18 0 0 1-2.228-4.605zM7.777 15.23a18.87 18.87 0 0 1-.214-4.774 12.753 12.753 0 0 1-4.34-2.708 9.711 9.711 0 0 0-.944 5.004 17.165 17.165 0 0 0 5.498 2.477zM21.356 14.752a9.765 9.765 0 0 1-7.478 6.817 18.64 18.64 0 0 0 1.988-4.718 18.627 18.627 0 0 0 5.49-2.098zM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 0 0 1.988 4.718 9.765 9.765 0 0 1-7.478-6.816zM13.878 2.43a9.755 9.755 0 0 1 6.116 3.986 11.267 11.267 0 0 1-3.746 2.504 18.63 18.63 0 0 0-2.37-6.49zM12 2.276a17.152 17.152 0 0 1 2.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0 1 12 2.276zM10.122 2.43a18.629 18.629 0 0 0-2.37 6.49 11.266 11.266 0 0 1-3.746-2.504 9.754 9.754 0 0 1 6.116-3.985z" />
    </svg>
  );
}
function ShareGiftIcon({ size = 16, color = "#ff8a2a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75a1.875 1.875 0 0 1 1.875-1.875h.375A3.375 3.375 0 0 1 9.375 3zM15 6.75h1.875A1.875 1.875 0 0 1 18.75 8.625v.75A1.875 1.875 0 0 1 16.875 11.25H12.75V6.75H15zM11.25 12.75H3v6.375C3 20.496 3.504 21 4.125 21h7.125v-8.25zM12.75 21h7.125A1.125 1.125 0 0 0 21 19.875V12.75h-8.25V21zM14.625 3a3.375 3.375 0 0 1 3.375 3.375h.375A1.875 1.875 0 0 1 20.25 8.25v.75a1.875 1.875 0 0 1-1.875 1.875H14.625V6.75H12.75V3h1.875z" />
    </svg>
  );
}

// ── Referral Share Modal ──────────────────────────────────────
function PassportShareModal({ user, token, apiUrl, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const username = user?.username || "";
  const referralUrl = `${window.location.origin}/u/${username}?ref=${username}`;

  const REWARDS = [
    { Icon: SharePlaneIcon, label: "You share your link", xp: "+10 XP" },
    { Icon: ShareGlobeIcon, label: "Friend signs up", xp: "+50 XP to you" },
    {
      Icon: ShareGiftIcon,
      label: "Friend's welcome bonus",
      xp: "+25 XP to them",
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    // Grant share XP
    fetch(apiUrl("/api/profile/share-xp"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).catch(() => {});
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${user?.username}'s Skyrio Passport`,
        text: "Join me on Skyrio and earn bonus XP! ✈️",
        url: referralUrl,
      });
      fetch(apiUrl("/api/profile/share-xp"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }).catch(() => {});
    } catch {}
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#16103a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px 40px",
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.15)",
            margin: "0 auto 20px",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>
              Share your passport
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
              }}
            >
              Earn XP every time someone joins through your link
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* XP reward rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {REWARDS.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: "rgba(255,138,42,0.12)",
                    border: "1px solid rgba(255,138,42,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <r.Icon size={16} color="#ff8a2a" />
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {r.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#ff8a2a",
                  background: "rgba(255,138,42,0.12)",
                  border: "1px solid rgba(255,138,42,0.22)",
                  borderRadius: 20,
                  padding: "3px 10px",
                }}
              >
                {r.xp}
              </span>
            </div>
          ))}
        </div>

        {/* Link row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 12,
            padding: "10px 12px",
            marginBottom: 10,
          }}
        >
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2}
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <div
            style={{
              flex: 1,
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {referralUrl}
          </div>
          <button
            onClick={copyLink}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              background: copied
                ? "rgba(72,199,142,0.15)"
                : "rgba(255,138,42,0.15)",
              color: copied ? "#48c78e" : "#ff8a2a",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              transition: "all 0.18s",
            }}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>

        {/* Native share */}
        {typeof navigator !== "undefined" && navigator.share && (
          <button
            onClick={nativeShare}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            More share options…
          </button>
        )}
      </div>
    </>
  );
}

export default function DigitalPassportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, isAuthed, loading, setUser, logout } = useAuth();
  const rewardsOptIn = useRewardsOptInPrompt();
  const { message } = App.useApp();

  const myId = useMemo(() => user?._id || user?.id || null, [user]);

  const [musicOpen, setMusicOpen] = useState(false);
  const [profileMusic, setProfileMusic] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editVibes, setEditVibes] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [xpToastShown, setXpToastShown] = useState(false);

  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const DELETE_PHRASE = "DELETE";

  const [xpLoading, setXpLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [xpToNextBadge, setXpToNextBadge] = useState(0);
  const [nextBadgeName, setNextBadgeName] = useState("Explorer");
  const [currentBadge, setCurrentBadge] = useState("Explorer");
  const [badgePercent, setBadgePercent] = useState(0);
  const [xpIntoLevel, setXpIntoLevel] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(100);
  const [passportStats, setPassportStats] = useState({
    followers: 0,
    following: 0,
  });
  const [followOpen, setFollowOpen] = useState(false);
  const [followMode, setFollowMode] = useState("following");
  const [referralsCount, setReferralsCount] = useState(0);

  const socketRef = useRef(null);
  const avatarInputRef = useRef(null);

  const displayName = useMemo(() => {
    if (!user) return "Explorer";
    return (
      user.username || user.name || safeEmailPrefix(user.email) || "Explorer"
    );
  }, [user]);

  const handle = useMemo(() => {
    if (!user) return "@explorer";
    const base = user.username || safeEmailPrefix(user.email) || "explorer";
    return `@${String(base).toLowerCase()}`;
  }, [user]);

  const homeBaseLabel = useMemo(() => {
    const hb = user?.city || user?.homeBase;
    return hb && typeof hb === "string" ? hb : "Not set";
  }, [user?.city, user?.homeBase]);

  const xpGoal = useMemo(() => {
    const current = Number(xp || 0);
    const remaining = Number(xpToNextBadge || 0);
    const goal = remaining > 0 ? current + remaining : Math.max(100, current);
    return Math.max(1, goal);
  }, [xp, xpToNextBadge]);

  const xpPercent = useMemo(() => {
    const current = Number(xp || 0);
    return Math.max(0, Math.min(100, Math.round((current / xpGoal) * 100)));
  }, [xp, xpGoal]);

  // ── FIX: dirty check so Save Changes is only active when there are edits ──
  const isProfileDirty = useMemo(() => {
    if (!editOpen) return false;
    return (
      editUsername !== (user?.username || "") ||
      editBio !== (user?.bio || "") ||
      editCity !== (user?.city || user?.homeBase || "") ||
      JSON.stringify([...editVibes].sort()) !==
        JSON.stringify([...(user?.travelVibes || [])].sort())
    );
  }, [editOpen, editUsername, editBio, editCity, editVibes, user]);

  const handleSearchFollowChange = useCallback(() => {
    fetch(apiUrl("/api/passport/stats"), {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          setPassportStats({
            followers: Number(data?.stats?.followers ?? 0),
            following: Number(data?.stats?.following ?? 0),
          });
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!location?.state?.fromAuth) return;
    message.success(`Welcome aboard${user?.name ? `, ${user.name}` : ""} ✈️`);
    try {
      window.history.replaceState({}, document.title);
    } catch {}
  }, [location?.state?.fromAuth, user?.name]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SKYRIO_PROFILE_MUSIC_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.url) {
          if (!cached.provider && isYouTubeUrl(cached.url))
            cached.provider = "youtube";
          setProfileMusic(cached);
        }
      }
    } catch {}
    if (!token) return;
    // FIX 4: use apiUrl() consistently — avoids mismatches if apiUrl transforms the base URL
    fetch(apiUrl("/api/profile/music"), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.music?.url) {
          const m = data.music;
          if (!m.provider && isYouTubeUrl(m.url)) m.provider = "youtube";
          setProfileMusic(m);
          try {
            localStorage.setItem(SKYRIO_PROFILE_MUSIC_KEY, JSON.stringify(m));
          } catch {}
        } else if (data && data.music === null) {
          setProfileMusic(null);
          try {
            localStorage.removeItem(SKYRIO_PROFILE_MUSIC_KEY);
          } catch {}
        }
      })
      .catch(() => {});
  }, [token]);

  const handleMusicSave = useCallback((payload) => {
    // FIX 5: clone before mutating so callers aren't surprised by side-effects
    const safe = payload ? { ...payload } : null;
    if (safe && !safe.provider && isYouTubeUrl(safe.url))
      safe.provider = "youtube";
    setProfileMusic(safe);
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      setXpLoading(true);
      try {
        const res = await fetch(apiUrl("/api/profile/me"), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("profile fetch failed");
        const data = await res.json();
        if (!mounted) return;
        setXp(Number(data?.xp ?? data?.user?.xp ?? 0));
        setXpToNextBadge(Number(data?.xpToNextBadge ?? 0));
        setNextBadgeName(
          String(data?.nextBadge ?? data?.nextBadgeName ?? "Adventurer")
        );
        setCurrentBadge(String(data?.currentBadge ?? "Explorer"));
        setBadgePercent(Number(data?.badgePercent ?? 0));
        setXpIntoLevel(Number(data?.xpIntoLevel ?? 0));
        setXpNeeded(Number(data?.xpNeeded ?? 100));

        // Read referralsCount from /me so we don't need a separate /stats call
        if (data?.user?.referralsCount !== undefined) {
          setReferralsCount(Number(data.user.referralsCount) || 0);
        }

        // Sync verification fields from the fresh API response back into the
        // auth context. useAuth() reads from localStorage/JWT which won't have
        // verifiedTier until we push it here — this is why the badge was invisible.
        if (setUser && data?.user) {
          const tier = data.user.verifiedTier ?? null;
          const pending = data.user.verificationPending ?? false;
          setUser((prev) => {
            if (
              prev?.verifiedTier === tier &&
              prev?.verificationPending === pending
            )
              return prev;
            const updated = {
              ...prev,
              verifiedTier: tier,
              verificationPending: pending,
            };
            try {
              localStorage.setItem(
                "user",
                JSON.stringify({
                  ...JSON.parse(localStorage.getItem("user") || "{}"),
                  verifiedTier: tier,
                  verificationPending: pending,
                })
              );
            } catch {}
            return updated;
          });
        }
      } catch {
        if (!mounted) return;
        setXp(0);
        setXpToNextBadge(0);
        setNextBadgeName("Adventurer");
      } finally {
        if (mounted) setXpLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  useEffect(() => {
    // FIX 2: use sessionStorage so toast only fires once per browser session,
    // not on every React mount/unmount cycle
    const alreadyShown = sessionStorage.getItem("xp_toast_shown") === "1";
    if (xp > 0 && !xpToastShown && !xpLoading && !alreadyShown) {
      const timer = setTimeout(() => {
        message.success(`✦ ${xp} XP earned — keep exploring!`);
        setXpToastShown(true);
        try {
          sessionStorage.setItem("xp_toast_shown", "1");
        } catch {}
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [xp, xpLoading, xpToastShown]);

  useEffect(() => {
    if (!isAuthed) return;
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      setStatsLoading(true);
      try {
        const res = await fetch(apiUrl("/api/passport/stats"), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!mounted) return;
        if (data?.ok) {
          setPassportStats({
            followers: Number(data?.stats?.followers ?? 0),
            following: Number(data?.stats?.following ?? 0),
          });
        } else {
          setPassportStats({ followers: 0, following: 0 });
        }
      } catch {
        if (!mounted) return;
        setPassportStats({ followers: 0, following: 0 });
      } finally {
        if (mounted) setStatsLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  useEffect(() => {
    if (!myId || !isAuthed) return;
    if (!socketRef.current) {
      const SOCKET_URL = import.meta.env.VITE_API_URL || "";
      socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });
    }
    const s = socketRef.current;
    s.emit("auth:join", { userId: myId });
    const handler = (payload) => {
      if (!payload) return;
      setPassportStats((prev) => ({
        ...prev,
        followers:
          typeof payload.followers === "number"
            ? payload.followers
            : prev.followers,
        following:
          typeof payload.following === "number"
            ? payload.following
            : prev.following,
      }));
    };
    s.on("social:counts:update", handler);
    // FIX 1: disconnect socket on unmount to prevent memory leak
    return () => {
      s.off("social:counts:update", handler);
      s.disconnect();
      socketRef.current = null;
    };
  }, [myId, isAuthed]);

  const sharePassport = useCallback(async () => {
    const username = user?.username || safeEmailPrefix(user?.email);
    if (!username) {
      message.info("Set a username first to share your passport.");
      return;
    }
    // Append ?ref= so signups from this link are tracked back to this user
    const url = `${window.location.origin}/u/${username}?ref=${username}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${displayName}'s Skyrio Passport`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        message.success("Referral link copied! +10 XP when someone joins ✈️");
      }
      // Grant share XP (once per day — backend deduplicates)
      fetch(apiUrl("/api/profile/share-xp"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }).catch(() => {});
    } catch {}
  }, [user, displayName, token]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(apiUrl("/api/uploads/image"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      const profileRes = await fetch(apiUrl("/api/profile/update"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ avatar: data.url }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok)
        throw new Error(profileData.message || "Failed to save avatar");
      if (setUser) {
        setUser((prev) => ({ ...prev, avatar: data.url }));
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...JSON.parse(localStorage.getItem("user") || "{}"),
            avatar: data.url,
          })
        );
      }
      message.success("Avatar updated ✓");
    } catch (err) {
      message.error(err.message);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // ── FIX 6: client-side validation before hitting the API ──
  const handleSaveProfile = async () => {
    const trimmedUsername = editUsername.trim();
    if (trimmedUsername && trimmedUsername.length < 3) {
      message.error("Username must be at least 3 characters.");
      return;
    }
    setEditSaving(true);
    let saved = false;
    try {
      const payload = {
        username: editUsername.trim() || user?.username,
        bio: editBio.trim(),
        city: editCity.trim(),
        travelVibes: editVibes,
      };
      const res = await fetch(apiUrl("/api/profile/settings"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update");

      // Update local user state
      if (setUser) {
        setUser((prev) => ({
          ...prev,
          username: payload.username,
          city: payload.city,
          bio: payload.bio,
          travelVibes: editVibes,
        }));
        try {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...JSON.parse(localStorage.getItem("user") || "{}"),
              username: payload.username,
              city: payload.city,
              bio: payload.bio,
              travelVibes: editVibes,
            })
          );
        } catch {}
      }

      saved = true;
      message.success("Profile updated ✓");
    } catch (err) {
      message.error(err.message || "Failed to save. Please try again.");
    } finally {
      setEditSaving(false);
      // Only close if save succeeded; keep open on error so user can fix
      if (saved) setEditOpen(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput.trim().toUpperCase() !== DELETE_PHRASE) {
      message.error(`Type ${DELETE_PHRASE} to confirm.`);
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch(apiUrl("/api/user/delete"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete account");
      localStorage.clear();
      sessionStorage.clear();
      if (logout) await logout();
      setDeleteStep(0);
      setDeleteInput("");
      navigate("/", { replace: true });
      message.success("Your account has been deleted.");
    } catch (err) {
      message.error(
        err.message || "Could not delete account. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const youtubeEmbedUrl = useMemo(() => {
    if (!profileMusic?.url) return null;
    if (profileMusic.provider === "youtube" || isYouTubeUrl(profileMusic.url))
      return getYouTubeEmbedUrl(profileMusic.url);
    return null;
  }, [profileMusic]);

  if (loading) return null;
  if (!isAuthed) return <PassportLocked />;

  return (
    <div className="passport-page">
      <style>{SPIN_STYLE}</style>
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="skyrioGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF8C3C" />
            <stop offset="100%" stopColor="#8B5CFF" />
          </linearGradient>
        </defs>
      </svg>

      <div
        className="passport-bg"
        style={{ backgroundImage: `url(${passportBg})` }}
        aria-hidden="true"
      />

      <div className="passport-content">
        <RewardsOptInPrompt
          open={rewardsOptIn.open}
          onClose={rewardsOptIn.close}
          onConfirm={rewardsOptIn.confirm}
        />

        <div className="passport-scope">
          <div className="pp-page">
            <div className="pp-shell">
              <div className="pp-mockGrid">
                <div className="pp-mockMain">
                  <Card variant="borderless" className="pp-card pp-profileCard">
                    <div className="pp-profileRow">
                      <div
                        className="pp-profileAvatar"
                        style={{ position: "relative" }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          ref={avatarInputRef}
                          onChange={handleAvatarUpload}
                        />
                        <Avatar
                          size={92}
                          src={
                            user?.avatar &&
                            user.avatar !== "/default-avatar.png"
                              ? user.avatar
                              : undefined
                          }
                          icon={
                            !user?.avatar ||
                            user.avatar === "/default-avatar.png" ? (
                              <UserOutlined />
                            ) : undefined
                          }
                          onClick={() =>
                            !avatarUploading && avatarInputRef.current?.click()
                          }
                          style={{
                            cursor: avatarUploading ? "not-allowed" : "pointer",
                          }}
                        />
                        <div
                          onClick={() =>
                            !avatarUploading && avatarInputRef.current?.click()
                          }
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "#ff8a2a",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            cursor: avatarUploading ? "not-allowed" : "pointer",
                            border: "2px solid rgba(9,7,26,0.8)",
                            opacity: avatarUploading ? 0.6 : 1,
                          }}
                        >
                          {avatarUploading ? (
                            <Loader2
                              size={13}
                              style={{ animation: "spin 1s linear infinite" }}
                            />
                          ) : (
                            <Camera size={13} />
                          )}
                        </div>
                      </div>
                      <div className="pp-profileMeta">
                        <Title
                          level={2}
                          className="pp-title"
                          style={{ margin: 0 }}
                        >
                          {displayName}
                        </Title>
                        <Text className="pp-muted">
                          {handle}
                          {/* Verified plane badge — shows tier, pending, or nothing */}
                          {user?.verifiedTier ? (
                            <PlaneBadge tier={user.verifiedTier} size={15} />
                          ) : user?.verificationPending ? (
                            <PlaneBadgePending size={14} />
                          ) : null}{" "}
                          · {currentBadge}
                        </Text>
                        {user?.bio && (
                          <Text
                            style={{
                              display: "block",
                              marginTop: 6,
                              fontSize: 13,
                              color: "rgba(255,255,255,0.75)",
                              lineHeight: 1.5,
                              fontStyle: "italic",
                            }}
                          >
                            {user.bio}
                          </Text>
                        )}
                        <div style={{ marginTop: 10 }}>
                          <span className="pp-pill pp-pill--active">
                            <Circle
                              size={10}
                              fill="#ff8a2a"
                              stroke="none"
                              style={{
                                marginRight: 5,
                                verticalAlign: "middle",
                              }}
                            />
                            Passport Active
                          </span>
                        </div>
                        <FollowStats
                          followers={passportStats.followers}
                          following={passportStats.following}
                          loading={statsLoading}
                          onClickFollowers={() => {
                            setFollowMode("followers");
                            setFollowOpen(true);
                          }}
                          onClickFollowing={() => {
                            setFollowMode("following");
                            setFollowOpen(true);
                          }}
                        />
                        {/* Referral stat */}
                        {referralsCount > 0 && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            <span style={{ fontSize: 14 }}>✈️</span>
                            <span>
                              <span
                                style={{ fontWeight: 700, color: "#ff8a2a" }}
                              >
                                {referralsCount}
                              </span>{" "}
                              {referralsCount === 1 ? "traveler" : "travelers"}{" "}
                              joined via your passport
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="pp-profileRing">
                        {xpLoading ? (
                          <div style={{ width: 190 }}>
                            <Skeleton active paragraph={{ rows: 2 }} />
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Progress
                              type="dashboard"
                              percent={xpPercent}
                              strokeWidth={10}
                              className="pp-levelRing pp-levelRing--mock"
                              format={() => (
                                <div className="pp-levelText">
                                  <div className="pp-levelRole">
                                    {currentBadge}
                                  </div>
                                  <div className="pp-levelXp">{xp} XP</div>
                                </div>
                              )}
                            />
                            {nextBadgeName && (
                              <div style={{ width: "100%", maxWidth: 180 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 10,
                                    color: "rgba(255,255,255,0.45)",
                                    marginBottom: 4,
                                  }}
                                >
                                  <span>{currentBadge}</span>
                                  <span>{nextBadgeName} ✦</span>
                                </div>
                                <div
                                  style={{
                                    height: 4,
                                    background: "rgba(255,255,255,0.1)",
                                    borderRadius: 99,
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${badgePercent}%`,
                                      background:
                                        "linear-gradient(90deg, #ff8a2a, #ffb066)",
                                      borderRadius: 99,
                                      transition: "width 0.6s ease",
                                    }}
                                  />
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "rgba(255,255,255,0.35)",
                                    marginTop: 3,
                                    textAlign: "center",
                                  }}
                                >
                                  {xpIntoLevel} / {xpNeeded} XP
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  <div className="pp-homeBaseRow">
                    <span className="pp-homeBaseDot" />
                    <span className="pp-homeBaseLabel">Home Base</span>
                    <span className="pp-homeBaseSep">·</span>
                    <span className="pp-homeBaseValue">{homeBaseLabel}</span>
                  </div>

                  {/* ── Travel Vibes display ── */}
                  {user?.travelVibes?.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        padding: "0 4px",
                        marginBottom: 12,
                      }}
                    >
                      {user.travelVibes.map((vibe) => (
                        <span
                          key={vibe}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: "rgba(255,138,42,0.1)",
                            border: "1px solid rgba(255,138,42,0.25)",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#ffb066",
                            textTransform: "capitalize",
                          }}
                        >
                          {vibe}
                        </span>
                      ))}
                    </div>
                  )}

                  {profileMusic && (
                    <Card
                      variant="borderless"
                      className="pp-card pp-soundtrackCard"
                    >
                      <div className="pp-soundtrackRow">
                        <div
                          className="pp-soundtrackCover"
                          style={{
                            backgroundImage: profileMusic?.artworkUrl
                              ? `url(${profileMusic.artworkUrl})`
                              : "url(https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=1200&q=70)",
                          }}
                        />
                        <div className="pp-soundtrackMeta">
                          <div className="pp-soundtrackTitle">
                            Travel Soundtrack
                          </div>
                          <div className="pp-soundtrackSub">
                            {profileMusic?.name || "My Playlist"}
                          </div>
                        </div>
                      </div>
                      {youtubeEmbedUrl ? (
                        <div
                          style={{
                            marginTop: 12,
                            borderRadius: 10,
                            overflow: "hidden",
                            border: "1px solid rgba(255,138,42,0.2)",
                          }}
                        >
                          <iframe
                            width="100%"
                            height="200"
                            src={youtubeEmbedUrl}
                            title="Travel Soundtrack"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ display: "block" }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: 12,
                            padding: "12px 16px",
                            borderRadius: 10,
                            background: "rgba(255,138,42,0.08)",
                            border: "1px solid rgba(255,138,42,0.2)",
                            fontSize: 13,
                            color: "rgba(255,255,255,0.5)",
                            textAlign: "center",
                          }}
                        >
                          Tap "Profile Music" to update your song
                        </div>
                      )}
                    </Card>
                  )}

                  <Card
                    variant="borderless"
                    className="pp-card pp-journeysCard"
                  >
                    <div className="pp-journeysHeader">
                      <div className="pp-journeysTitle">Travel Journeys</div>
                    </div>
                    <div className="pp-journeysEmpty">
                      <div
                        style={{
                          padding: "32px 16px",
                          textAlign: "center",
                          opacity: 0.5,
                          fontSize: 14,
                        }}
                      >
                        Your journeys will appear here after your first booking
                      </div>
                    </div>
                  </Card>
                </div>

                {/* ── Sidebar ── */}
                <div className="pp-mockSide">
                  <Card
                    variant="borderless"
                    className="pp-card"
                    style={{
                      marginBottom: 12,
                      overflow: "visible",
                      position: "relative",
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.35)",
                        marginBottom: 12,
                      }}
                    >
                      Find Travelers
                    </div>
                    <InlineTravelerSearch
                      token={token}
                      onFollowChange={handleSearchFollowChange}
                    />
                  </Card>

                  <Card variant="borderless" className="pp-card pp-actionsCard">
                    <Title
                      level={3}
                      className="pp-title"
                      style={{ marginBottom: 4 }}
                    >
                      Digital Passport
                    </Title>
                    <div className="pp-actionsStack">
                      <Button
                        className="pp-actionBtn"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setEditUsername(user?.username || "");
                          setEditBio(user?.bio || "");
                          setEditCity(user?.city || user?.homeBase || "");
                          setEditVibes(user?.travelVibes || []);
                          setEditOpen(true);
                        }}
                      >
                        Edit Profile
                      </Button>
                      <Button
                        className="pp-actionBtn"
                        icon={
                          profileMusic ? (
                            <SoundOutlined />
                          ) : (
                            <PlayCircleOutlined />
                          )
                        }
                        onClick={() => setMusicOpen(true)}
                      >
                        {profileMusic ? "Profile Music" : "Add Profile Music"}
                      </Button>

                      <Button
                        className="pp-actionBtn"
                        icon={<ShareAltOutlined />}
                        onClick={() => setShowShare(true)}
                      >
                        Share Passport
                      </Button>
                    </div>
                    <Text className="pp-credentialHint">
                      This passport unlocks stamps, borders, and rewards.
                    </Text>
                    <Button
                      className="pp-upgradeBtn"
                      onClick={() => navigate("/membership")}
                    >
                      Upgrade your Passport
                    </Button>
                    <div
                      style={{
                        marginTop: 24,
                        paddingTop: 16,
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => setDeleteStep(1)}
                        style={{
                          width: "100%",
                          background: "transparent",
                          borderColor: "rgba(255,77,79,0.3)",
                          color: "rgba(255,100,100,0.7)",
                          borderRadius: 10,
                          height: 40,
                          fontSize: 13,
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#ff4d4f";
                          e.currentTarget.style.color = "#ff4d4f";
                          e.currentTarget.style.background =
                            "rgba(255,77,79,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            "rgba(255,77,79,0.3)";
                          e.currentTarget.style.color = "rgba(255,100,100,0.7)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        Delete Account
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
        <OnboardingModal user={user} token={token} />
      </div>

      <FollowersModal
        open={followOpen}
        onClose={() => setFollowOpen(false)}
        mode={followMode}
      />
      <ProfileMusicModal
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        onSave={handleMusicSave}
        value={profileMusic}
      />

      {/* ── Edit Profile Modal ── */}
      <Modal
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
        }}
        onOk={handleSaveProfile}
        confirmLoading={editSaving}
        title="Edit Profile"
        okText="Save Changes"
        cancelText="Cancel"
        // FIX: disable Save Changes when nothing has changed
        okButtonProps={{ disabled: !isProfileDirty || editSaving }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingTop: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 6,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              USERNAME
            </div>
            <Input
              value={editUsername}
              onChange={(e) =>
                setEditUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "")
                )
              }
              prefix={<span style={{ opacity: 0.5 }}>@</span>}
              placeholder="skyexplorer99"
              maxLength={30}
            />
            <div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>
              Letters, numbers, _ and . only · 3–30 characters
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 6,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              HOME BASE
            </div>
            <Input
              value={editCity}
              onChange={(e) => setEditCity(e.target.value)}
              placeholder="New York, Miami, London..."
              maxLength={60}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 6,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              BIO
            </div>
            <Input.TextArea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Tell the world about your travel style..."
              maxLength={160}
              rows={3}
              showCount
            />
          </div>

          {/* ── Travel Vibe picker ── */}
          <div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 8,
                opacity: 0.6,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              TRAVEL VIBE{" "}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                (pick up to 5)
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {VIBE_OPTIONS.map((vibe) => {
                const selected = editVibes.includes(vibe);
                return (
                  <button
                    key={vibe}
                    type="button"
                    onClick={() => {
                      setEditVibes((prev) =>
                        selected
                          ? prev.filter((v) => v !== vibe)
                          : prev.length < 5
                          ? [...prev, vibe]
                          : prev
                      );
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: selected
                        ? "1.5px solid #ff8a2a"
                        : "1px solid rgba(255,255,255,0.15)",
                      background: selected
                        ? "rgba(255,138,42,0.15)"
                        : "rgba(255,255,255,0.04)",
                      color: selected ? "#ff8a2a" : "rgba(255,255,255,0.55)",
                      fontSize: 13,
                      fontWeight: selected ? 700 : 500,
                      cursor:
                        !selected && editVibes.length >= 5
                          ? "not-allowed"
                          : "pointer",
                      opacity: !selected && editVibes.length >= 5 ? 0.4 : 1,
                      transition: "all 0.15s",
                      fontFamily: "inherit",
                    }}
                  >
                    {vibe}
                  </button>
                );
              })}
            </div>
            {editVibes.length > 0 && (
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6 }}>
                {editVibes.length}/5 selected
              </div>
            )}
          </div>

          {/* FIX: visual hint when there's nothing to save */}
          {!isProfileDirty && (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                textAlign: "center",
                paddingTop: 4,
              }}
            >
              No unsaved changes
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete Account — Step 1 ── */}
      <Modal
        open={deleteStep === 1}
        onCancel={() => setDeleteStep(0)}
        footer={null}
        title={
          <span
            style={{
              color: "#ff4d4f",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <WarningOutlined /> Delete Account
          </span>
        }
        centered
      >
        <div style={{ padding: "8px 0 16px" }}>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              marginBottom: 20,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            Are you sure you want to delete your Skyrio account?
          </p>
          <div
            style={{
              background: "rgba(255,77,79,0.06)",
              border: "1px solid rgba(255,77,79,0.2)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: "#ff4d4f",
                marginBottom: 8,
              }}
            >
              This will permanently delete:
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 2,
              }}
            >
              <li>Your profile, username, and bio</li>
              <li>All XP, badges, and Passport progress</li>
              <li>Your saved trips and bookings history</li>
              <li>All SkyHub posts and community activity</li>
            </ul>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              This action is permanent and cannot be undone.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button block onClick={() => setDeleteStep(0)} style={{ flex: 1 }}>
              Keep my account
            </Button>
            <Button
              danger
              block
              onClick={() => {
                setDeleteStep(2);
                setDeleteInput("");
              }}
              style={{ flex: 1 }}
            >
              Yes, delete it
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Account — Step 2 ── */}
      <Modal
        open={deleteStep === 2}
        onCancel={() => {
          setDeleteStep(0);
          setDeleteInput("");
        }}
        footer={null}
        title={
          <span
            style={{
              color: "#ff4d4f",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <WarningOutlined /> Confirm Deletion
          </span>
        }
        centered
      >
        <div style={{ padding: "8px 0 16px" }}>
          <p
            style={{
              fontSize: 14,
              marginBottom: 16,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            Type{" "}
            <strong style={{ color: "#ff4d4f", letterSpacing: 1 }}>
              DELETE
            </strong>{" "}
            below to permanently delete your account.
          </p>
          <Input
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="Type DELETE to confirm"
            size="large"
            status={
              deleteInput && deleteInput.toUpperCase() !== DELETE_PHRASE
                ? "error"
                : ""
            }
            style={{ marginBottom: 20, letterSpacing: 1, fontWeight: 600 }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              block
              onClick={() => {
                setDeleteStep(0);
                setDeleteInput("");
              }}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              danger
              block
              loading={deleteLoading}
              disabled={deleteInput.trim().toUpperCase() !== DELETE_PHRASE}
              onClick={handleDeleteAccount}
              style={{ flex: 1 }}
            >
              Delete my account
            </Button>
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              textAlign: "center",
            }}
          >
            This will immediately log you out and delete all your data.
          </div>
        </div>
      </Modal>

      {/* Referral share modal */}
      {showShare && (
        <PassportShareModal
          user={user}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setShowShare(false)}
        />
      )}

      <ShareRankPrompt
        badge={currentBadge}
        username={user?.username || safeEmailPrefix(user?.email)}
        xp={xp}
      />
    </div>
  );
}
