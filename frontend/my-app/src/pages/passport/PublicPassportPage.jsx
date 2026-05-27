import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plane,
  MapPin,
  Music,
  Share2,
  Award,
  Zap,
  ChevronRight,
  Globe,
  Calendar,
  Compass,
  Play,
  Map,
  ExternalLink,
  Copy,
  Check,
  X,
  Link,
  Users,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import FollowButton from "./FollowButton";
import passportBg from "../../assets/DigitalPassport/worldmap.png";

// ── Same CSS as DigitalPassportPage ──
import "../../styles/profile-passport.css";

const API = import.meta.env.VITE_API_URL || "";

/* ── Badge config — identical to DigitalPassportPage ── */
const BADGE_CONFIG = {
  Explorer: {
    color: "#7c5cfc",
    glow: "rgba(124,92,252,0.35)",
    next: "Adventurer",
    icon: "🧭",
  },
  Adventurer: {
    color: "#ff8a2a",
    glow: "rgba(255,138,42,0.35)",
    next: "Nomad",
    icon: "🏔️",
  },
  Nomad: {
    color: "#00b8d9",
    glow: "rgba(0,184,217,0.35)",
    next: "Legend",
    icon: "🌍",
  },
  Legend: {
    color: "#f0c040",
    glow: "rgba(240,192,64,0.35)",
    next: null,
    icon: "👑",
  },
};
const DEFAULT_BADGE = {
  color: "#7c5cfc",
  glow: "rgba(124,92,252,0.35)",
  next: "Adventurer",
  icon: "🧭",
};

/* ── YouTube helpers ── */
function extractYouTubeId(url) {
  try {
    if (!url) return null;
    if (url.includes("youtu.be/"))
      return url.split("youtu.be/")[1].split("?")[0];
    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
}
const getYouTubeEmbedUrl = (url) => {
  const id = extractYouTubeId(url);
  return id
    ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
    : null;
};
const getYouTubeThumbnail = (url) => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

/* ── Skeleton ── */
function Skeleton({ w = "100%", h = 16, radius = 8 }) {
  return (
    <div
      className="pp-pub-skeleton"
      style={{ width: w, height: h, borderRadius: radius }}
    />
  );
}

/* ── Not found ── */
function NotFound({ username, onSignup }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <Plane
        size={48}
        color="rgba(255,255,255,0.12)"
        style={{ marginBottom: 16 }}
      />
      <h2
        style={{
          fontFamily: "Syne,sans-serif",
          fontSize: 24,
          fontWeight: 800,
          color: "#fff",
          marginBottom: 8,
        }}
      >
        @{username} hasn't landed yet
      </h2>
      <p
        style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 15,
          marginBottom: 32,
        }}
      >
        This passport doesn't exist — but yours could.
      </p>
      <button
        onClick={onSignup}
        className="pp-pub-btn-primary"
        style={{
          padding: "14px 32px",
          fontSize: 15,
          fontWeight: 800,
          borderRadius: 999,
          boxShadow: "0 8px 28px rgba(255,138,42,0.35)",
        }}
      >
        Claim your passport →
      </button>
    </div>
  );
}

/* ── Section label ── */
function SectionLabel({ icon: Icon, label }) {
  return (
    <div className="pp-pub-section-label">
      {Icon && <Icon size={13} color="#ff8a2a" />}
      <span>{label}</span>
    </div>
  );
}

/* ── Music card ── */
function MusicCard({ profileMusic, embedUrl }) {
  const [expanded, setExpanded] = useState(false);
  const thumbnail = getYouTubeThumbnail(profileMusic?.url);
  if (!embedUrl) return null;

  return (
    <div className="pp-pub-card pp-pub-section">
      <SectionLabel icon={Music} label="Travel Soundtrack" />
      {!expanded ? (
        <div className="pp-pub-music-row" onClick={() => setExpanded(true)}>
          <div className="pp-pub-music-thumb">
            {thumbnail && (
              <img
                src={thumbnail}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              <Play size={18} color="#fff" fill="#fff" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {profileMusic?.title || "Travel Soundtrack"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
              }}
            >
              Tap to play
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 2,
              height: 20,
            }}
          >
            {[10, 16, 8, 14, 12].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 2,
                  background: "#ff8a2a",
                  opacity: 0.5,
                  animation: `ppMusicBar 0.8s ease-in-out ${
                    i * 0.12
                  }s infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(255,138,42,0.2)",
              marginBottom: 10,
            }}
          >
            <iframe
              width="100%"
              height="200"
              src={embedUrl}
              title="Travel Soundtrack"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ display: "block" }}
            />
          </div>
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            ▲ Collapse
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Journey card ── */
function JourneyCard({ journey, badgeColor }) {
  return (
    <div className="pp-pub-journey-card">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `linear-gradient(135deg,${badgeColor}22,rgba(255,138,42,0.12))`,
          border: `1px solid ${badgeColor}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 20,
        }}
      >
        {journey.emoji || "✈️"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Syne,sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "#fff",
            marginBottom: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {journey.destination || journey.title || "Unknown Journey"}
        </div>
        {journey.dates && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              marginBottom: 4,
            }}
          >
            <Calendar size={10} />
            {journey.dates}
          </div>
        )}
        {journey.description && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {journey.description}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stamp grid ── */
function StampGrid({ destinations, badgeColor }) {
  if (!destinations?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {destinations.map((dest, i) => (
        <div
          key={i}
          className="pp-pub-stamp"
          style={{
            border: `1.5px dashed ${badgeColor}55`,
            background: `${badgeColor}0a`,
          }}
        >
          <MapPin size={10} color={badgeColor} />
          {dest}
        </div>
      ))}
    </div>
  );
}

/* ── Follow list modal ── */
function FollowListModal({
  tab,
  userId,
  profileName,
  token,
  onClose,
  onSwitchTab,
  onNavigate,
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId || !tab) return;
    setLoading(true);
    setError(false);
    setList([]);
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const opts = { credentials: "include", headers };
    const endpoints = [
      `${API}/api/follow/${userId}/${tab}`,
      `${API}/api/profile/${userId}/${tab}`,
    ];
    let cancelled = false;
    (async () => {
      for (const url of endpoints) {
        if (cancelled) return;
        try {
          const res = await fetch(url, opts);
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelled) return;
          const users =
            data.users || data.followers || data.following || data.data || [];
          if (data.ok !== false && Array.isArray(users)) {
            setList(users);
            setLoading(false);
            return;
          }
        } catch {}
      }
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, tab, token]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div className="pp-pub-modal-backdrop" onClick={onClose} />
      <div className="pp-pub-modal-sheet">
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 0",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: "Syne,sans-serif",
                fontWeight: 800,
                fontSize: 17,
                color: "#fff",
              }}
            >
              {profileName}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex" }}>
            {["followers", "following"].map((t) => (
              <button
                key={t}
                onClick={() => onSwitchTab(t)}
                className={`pp-pub-modal-tab${tab === t ? " is-active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {loading &&
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                }}
              >
                <Skeleton w={44} h={44} radius={22} />
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <Skeleton w="50%" h={14} />
                  <Skeleton w="30%" h={11} />
                </div>
              </div>
            ))}
          {!loading && error && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "rgba(255,255,255,0.4)",
                fontSize: 14,
              }}
            >
              Couldn't load {tab}.
            </div>
          )}
          {!loading && !error && list.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Users
                size={32}
                color="rgba(255,255,255,0.12)"
                style={{ marginBottom: 12 }}
              />
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                No {tab} yet
              </div>
            </div>
          )}
          {!loading &&
            !error &&
            list.map((user) => {
              const uid = user.username || user.handle || "";
              const displayName = user.name || user.displayName || uid;
              const avatarUrl = user.avatar || null;
              return (
                <button
                  key={user._id || user.id || uid}
                  onClick={() => {
                    onClose();
                    onNavigate(`/u/${uid}`);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 20px",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    textAlign: "left",
                    fontFamily: "DM Sans,sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      flexShrink: 0,
                      position: "relative",
                      background:
                        "linear-gradient(135deg,#7c5cfc,rgba(255,138,42,0.5))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#fff",
                      overflow: "hidden",
                      border: "1.5px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {displayName[0].toUpperCase()}
                    {avatarUrl && (
                      <img
                        src={avatarUrl}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.4)",
                        marginTop: 1,
                      }}
                    >
                      @{uid}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: "rgba(255,138,42,0.12)",
                      border: "1px solid rgba(255,138,42,0.25)",
                      color: "#ff8a2a",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    View <ChevronRight size={12} />
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */
export default function PublicPassportPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: authUser, token, isAuthed } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [followListTab, setFollowListTab] = useState(null);
  const shareRef = useRef(null);

  const isOwnProfile = useMemo(() => {
    if (!authUser || !profile) return false;
    return (
      (authUser.username || "").toLowerCase() ===
      (profile.username || "").toLowerCase()
    );
  }, [authUser, profile]);

  const badge = useMemo(
    () => BADGE_CONFIG[profile?.badge] || DEFAULT_BADGE,
    [profile?.badge]
  );
  const embedUrl = useMemo(
    () => getYouTubeEmbedUrl(profile?.profileMusic?.url),
    [profile?.profileMusic?.url]
  );
  const profileUrl = typeof window !== "undefined" ? window.location.href : "";

  /* close share popover on outside click */
  useEffect(() => {
    if (!showShare) return;
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShowShare(false);
        setCopied(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showShare]);

  /* fetch profile */
  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${API}/api/profile/public/${encodeURIComponent(username)}`, {
      credentials: "include",
      headers,
    })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (!data.ok) setNotFound(true);
        else {
          setProfile(data.profile || data.user);
          setIsFollowing(!!data.isFollowing);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [username, token]);

  const handleFollowToggle = useCallback((nowFollowing) => {
    setIsFollowing(nowFollowing);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            followersCount:
              (prev.followersCount || 0) + (nowFollowing ? 1 : -1),
          }
        : prev
    );
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = profileUrl;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${profile?.name || username}'s Skyrio Passport`,
        url: profileUrl,
      });
    } catch {}
    setShowShare(false);
  };

  const goSignup = () => navigate(`/register?ref=passport&from=${username}`);
  const journeys = profile?.journeys || profile?.trips || [];
  const destinations = profile?.destinations || profile?.visitedCities || [];

  return (
    /* Same outer shell as DigitalPassportPage */
    <div className="passport-page">
      {/* Same world map background as DigitalPassportPage */}
      <div
        className="passport-bg"
        style={{ backgroundImage: `url(${passportBg})` }}
        aria-hidden="true"
      />

      <div className="passport-content">
        {/* ── Top bar ── */}
        <div className="pp-pub-topbar">
          <button className="pp-pub-logo-btn" onClick={() => navigate("/")}>
            <div className="pp-pub-logo-icon">
              <Plane size={13} color="#1b1024" />
            </div>
            <span className="pp-pub-logo-text">Skyrio</span>
          </button>
          {!isAuthed ? (
            <button className="pp-pub-btn-primary" onClick={goSignup}>
              Get your passport →
            </button>
          ) : (
            <button
              className="pp-pub-btn-secondary"
              onClick={() => navigate("/passport")}
            >
              My Passport
            </button>
          )}
        </div>

        {/* ── Main scroll area ── */}
        <div className="pp-pub-container">
          {/* Loading */}
          {loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                paddingTop: 24,
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Skeleton w={80} h={80} radius={40} />
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <Skeleton w="60%" h={22} />
                  <Skeleton w="40%" h={14} />
                </div>
              </div>
              <Skeleton h={140} radius={22} />
              <Skeleton h={80} radius={22} />
              <Skeleton h={100} radius={22} />
            </div>
          )}

          {/* Not found */}
          {!loading && notFound && (
            <NotFound username={username} onSignup={goSignup} />
          )}

          {/* ── Profile loaded ── */}
          {!loading && !notFound && profile && (
            <>
              {/* ── Hero card ── */}
              <div className="pp-pub-card pp-pub-hero">
                {/* Watermark */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 180,
                    height: 180,
                    pointerEvents: "none",
                    overflow: "hidden",
                    borderRadius: "0 22px 0 0",
                    opacity: 0.5,
                  }}
                >
                  <Globe
                    size={180}
                    color="rgba(255,255,255,0.018)"
                    strokeWidth={0.5}
                  />
                </div>

                {/* Top row: avatar + meta + share */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 20,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 16 }}
                  >
                    {/* Avatar */}
                    <div className="pp-pub-avatar-wrap">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          style={{
                            width: 76,
                            height: 76,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: `2.5px solid ${badge.color}`,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 76,
                            height: 76,
                            borderRadius: "50%",
                            background: `linear-gradient(135deg,${badge.color},rgba(255,138,42,0.5))`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 30,
                            fontWeight: 800,
                            color: "#fff",
                          }}
                        >
                          {(profile.name ||
                            profile.username ||
                            "?")[0].toUpperCase()}
                        </div>
                      )}
                      {/* Glow ring */}
                      <div
                        style={{
                          position: "absolute",
                          inset: -4,
                          borderRadius: "50%",
                          border: `2px solid ${badge.color}`,
                          boxShadow: `0 0 18px ${badge.glow}`,
                          pointerEvents: "none",
                        }}
                      />
                      {/* Badge dot */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: badge.color,
                          border: "2.5px solid rgba(8,8,22,0.9)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                        }}
                      >
                        {badge.icon}
                      </div>
                    </div>

                    {/* Name / handle / location / follow counts */}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div className="pp-pub-name">
                          {profile.name || profile.username}
                        </div>
                        {isAuthed && !isOwnProfile && (
                          <FollowButton
                            userId={profile._id || profile.id}
                            isFollowing={isFollowing}
                            size="small"
                            token={token}
                            onToggle={handleFollowToggle}
                          />
                        )}
                      </div>
                      <div className="pp-pub-handle">@{profile.username}</div>
                      {profile.city && (
                        <div className="pp-pub-location">
                          <MapPin size={11} />
                          {profile.city}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          marginTop: 8,
                        }}
                      >
                        <button
                          className="pp-pub-follow-stat"
                          onClick={() => setFollowListTab("followers")}
                        >
                          <strong>{profile.followersCount || 0}</strong>
                          <span>
                            {(profile.followersCount || 0) === 1
                              ? "Follower"
                              : "Followers"}
                          </span>
                        </button>
                        <span
                          style={{
                            color: "rgba(255,255,255,0.15)",
                            fontSize: 10,
                          }}
                        >
                          ·
                        </span>
                        <button
                          className="pp-pub-follow-stat"
                          onClick={() => setFollowListTab("following")}
                        >
                          <strong>{profile.followingCount || 0}</strong>
                          <span>Following</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Share */}
                  <div
                    ref={shareRef}
                    style={{ position: "relative", flexShrink: 0 }}
                  >
                    <button
                      className="pp-pub-share-btn"
                      onClick={() => {
                        setShowShare((p) => !p);
                        setCopied(false);
                      }}
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                    {showShare && (
                      <div className="pp-pub-share-popover">
                        <button
                          onClick={() => {
                            setShowShare(false);
                            setCopied(false);
                          }}
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            background: "none",
                            border: "none",
                            color: "rgba(255,255,255,0.35)",
                            cursor: "pointer",
                            padding: 4,
                          }}
                        >
                          <X size={14} />
                        </button>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.45)",
                            marginBottom: 10,
                            letterSpacing: "0.03em",
                          }}
                        >
                          Share this passport
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: 10,
                            padding: "8px 10px",
                            marginBottom: 10,
                          }}
                        >
                          <Link
                            size={12}
                            color="rgba(255,255,255,0.35)"
                            style={{ flexShrink: 0 }}
                          />
                          <div
                            style={{
                              flex: 1,
                              fontSize: 12,
                              color: "rgba(255,255,255,0.55)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              userSelect: "all",
                            }}
                          >
                            {profileUrl}
                          </div>
                          <button
                            onClick={copyUrl}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "5px 10px",
                              borderRadius: 8,
                              border: "none",
                              background: copied
                                ? "rgba(72,199,142,0.15)"
                                : "rgba(255,138,42,0.15)",
                              color: copied ? "#48c78e" : "#ff8a2a",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              flexShrink: 0,
                              transition: "all 0.18s",
                            }}
                          >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                        {typeof navigator !== "undefined" &&
                          navigator.share && (
                            <button
                              onClick={nativeShare}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "9px 0",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.09)",
                                background: "rgba(255,255,255,0.04)",
                                color: "rgba(255,255,255,0.55)",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              <ExternalLink size={13} />
                              More share options…
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && <p className="pp-pub-bio">"{profile.bio}"</p>}

                {/* Rank / XP box */}
                <div
                  className="pp-pub-rank-box"
                  style={{ borderColor: `${badge.color}33` }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: `${badge.color}18`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Award size={18} color={badge.color} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: "Syne,sans-serif",
                            fontSize: 16,
                            fontWeight: 800,
                            color: badge.color,
                          }}
                        >
                          {profile.badge || "Explorer"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(244,246,251,0.35)",
                            marginTop: 1,
                          }}
                        >
                          Skyrio rank
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Zap size={14} color="#ff8a2a" />
                        <span
                          style={{
                            fontFamily: "Syne,sans-serif",
                            fontWeight: 800,
                            fontSize: 18,
                            color: "#fff",
                          }}
                        >
                          {(profile.xp || 0).toLocaleString()}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(244,246,251,0.35)",
                          marginTop: 1,
                        }}
                      >
                        XP earned
                      </div>
                    </div>
                  </div>
                  <div className="pp-pub-progress-labels">
                    <span>{profile.badge || "Explorer"}</span>
                    {badge.next && <span>{badge.next} ✦</span>}
                  </div>
                  <div className="pp-pub-progress-track">
                    <div
                      className="pp-pub-progress-fill"
                      style={{
                        width: `${Math.min(100, profile.xpPercent || 0)}%`,
                        background: `linear-gradient(90deg,${badge.color},#ff8a2a)`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Travel vibes ── */}
              {profile.travelVibes?.length > 0 && (
                <div className="pp-pub-card pp-pub-section">
                  <SectionLabel icon={Compass} label="Travel Vibe" />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {profile.travelVibes.map((vibe) => (
                      <span key={vibe} className="pp-pub-vibe-chip">
                        {vibe}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Travel soundtrack ── */}
              <MusicCard
                profileMusic={profile.profileMusic}
                embedUrl={embedUrl}
              />

              {/* ── Journeys ── */}
              {journeys.length > 0 && (
                <div className="pp-pub-card pp-pub-section">
                  <SectionLabel icon={Map} label="Travel Journeys" />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {journeys.slice(0, 5).map((journey, i) => (
                      <JourneyCard
                        key={journey._id || i}
                        journey={journey}
                        badgeColor={badge.color}
                      />
                    ))}
                    {journeys.length > 5 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.3)",
                          textAlign: "center",
                          paddingTop: 4,
                        }}
                      >
                        + {journeys.length - 5} more journeys
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Passport stamps ── */}
              {destinations.length > 0 && (
                <div className="pp-pub-card pp-pub-section">
                  <SectionLabel icon={Globe} label="Passport Stamps" />
                  <StampGrid
                    destinations={destinations}
                    badgeColor={badge.color}
                  />
                </div>
              )}

              {/* ── Stats ── */}
              {(profile.tripsCount > 0 || profile.joinedAt) && (
                <div
                  className="pp-pub-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      profile.tripsCount > 0 && profile.joinedAt
                        ? "1fr 1fr"
                        : "1fr",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  {profile.tripsCount > 0 && (
                    <div className="pp-pub-stat-box">
                      <div
                        style={{
                          fontFamily: "Syne,sans-serif",
                          fontSize: 24,
                          fontWeight: 800,
                          color: "#fff",
                        }}
                      >
                        {profile.tripsCount}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(244,246,251,0.35)",
                          marginTop: 3,
                        }}
                      >
                        trips saved
                      </div>
                    </div>
                  )}
                  {profile.joinedAt && (
                    <div className="pp-pub-stat-box">
                      <div
                        style={{
                          fontFamily: "Syne,sans-serif",
                          fontSize: 24,
                          fontWeight: 800,
                          color: "#fff",
                        }}
                      >
                        {new Date(profile.joinedAt).getFullYear()}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(244,246,251,0.35)",
                          marginTop: 3,
                        }}
                      >
                        member since
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── CTA (logged-out) ── */}
              {!isAuthed && (
                <div className="pp-pub-card pp-pub-cta-card">
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#ff8a2a",
                      marginBottom: 12,
                    }}
                  >
                    ✦ Skyrio Passport
                  </div>
                  <h3
                    style={{
                      fontFamily: "Syne,sans-serif",
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#fff",
                      lineHeight: 1.2,
                      marginBottom: 10,
                    }}
                  >
                    What rank would you be?
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "rgba(244,246,251,0.5)",
                      lineHeight: 1.6,
                      marginBottom: 24,
                      maxWidth: 340,
                      margin: "0 auto 24px",
                    }}
                  >
                    {profile.name || profile.username} is a{" "}
                    <strong style={{ color: badge.color }}>
                      {profile.badge || "Explorer"}
                    </strong>{" "}
                    on Skyrio. Search flights, earn XP, and find out where you'd
                    rank.
                  </p>
                  <button
                    onClick={goSignup}
                    className="pp-pub-btn-primary"
                    style={{
                      padding: "15px 32px",
                      fontSize: 15,
                      fontWeight: 800,
                      borderRadius: 999,
                      boxShadow: "0 8px 28px rgba(255,138,42,0.35)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "brightness(1.08)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "";
                      e.currentTarget.style.transform = "";
                    }}
                  >
                    Get your free passport <ChevronRight size={16} />
                  </button>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "rgba(255,255,255,0.22)",
                    }}
                  >
                    Free forever · No credit card required
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Follow list modal */}
      {followListTab && profile && (
        <FollowListModal
          tab={followListTab}
          userId={profile._id || profile.id}
          profileName={profile.name || profile.username}
          token={token}
          onClose={() => setFollowListTab(null)}
          onSwitchTab={setFollowListTab}
          onNavigate={(path) => {
            setFollowListTab(null);
            navigate(path);
          }}
        />
      )}
    </div>
  );
}
