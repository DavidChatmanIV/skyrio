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
  Pause,
  ExternalLink,
  Sparkles,
  Map,
  Heart,
  Copy,
  Check,
  X,
  Link,
  Users,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import FollowButton from "./FollowButton";

const API = import.meta.env.VITE_API_URL || "";

/* ═══════════════════════════════════════════════════════════════
   Badge configuration
   ═══════════════════════════════════════════════════════════════ */
const BADGE_CONFIG = {
  Explorer: {
    color: "#7c5cfc",
    glow: "rgba(124,92,252,0.35)",
    next: "Adventurer",
    icon: "🧭",
    tier: 1,
  },
  Adventurer: {
    color: "#ff8a2a",
    glow: "rgba(255,138,42,0.35)",
    next: "Nomad",
    icon: "🏔️",
    tier: 2,
  },
  Nomad: {
    color: "#00b8d9",
    glow: "rgba(0,184,217,0.35)",
    next: "Legend",
    icon: "🌍",
    tier: 3,
  },
  Legend: {
    color: "#f0c040",
    glow: "rgba(240,192,64,0.35)",
    next: null,
    icon: "👑",
    tier: 4,
  },
};

const DEFAULT_BADGE = {
  color: "#7c5cfc",
  glow: "rgba(124,92,252,0.35)",
  next: "Adventurer",
  icon: "🧭",
  tier: 1,
};

/* ═══════════════════════════════════════════════════════════════
   YouTube helpers
   ═══════════════════════════════════════════════════════════════ */
function extractYouTubeId(url) {
  try {
    if (!url) return null;
    if (url.includes("youtu.be/"))
      return url.split("youtu.be/")[1].split("?")[0];
    const u = new URL(url);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function getYouTubeEmbedUrl(url) {
  const id = extractYouTubeId(url);
  return id
    ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
    : null;
}

function getYouTubeThumbnail(url) {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/* ═══════════════════════════════════════════════════════════════
   Skeleton loader
   ═══════════════════════════════════════════════════════════════ */
function Skeleton({ w = "100%", h = 16, radius = 8, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
        backgroundSize: "600px 100%",
        animation: "ppSkeleton 1.4s linear infinite",
        ...style,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Not‑found state
   ═══════════════════════════════════════════════════════════════ */
function NotFound({ username, onSignup }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        <Plane size={48} color="rgba(255,255,255,0.15)" />
      </div>
      <h2 style={styles.notFoundTitle}>@{username} hasn't landed yet</h2>
      <p style={styles.notFoundSub}>
        This passport doesn't exist — but yours could.
      </p>
      <button onClick={onSignup} style={styles.ctaPrimary}>
        Claim your passport →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section label component
   ═══════════════════════════════════════════════════════════════ */
function SectionLabel({ icon: Icon, label }) {
  return (
    <div style={styles.sectionLabel}>
      {Icon && <Icon size={13} color="#ff8a2a" />}
      <span>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Music player card
   ═══════════════════════════════════════════════════════════════ */
function MusicCard({ profileMusic, embedUrl }) {
  const [expanded, setExpanded] = useState(false);
  const thumbnail = getYouTubeThumbnail(profileMusic?.url);

  if (!embedUrl) return null;

  return (
    <div className="pp-pub-card" style={styles.card}>
      <SectionLabel icon={Music} label="Travel Soundtrack" />

      {/* Compact preview */}
      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
              position: "relative",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {thumbnail && (
              <img
                src={thumbnail}
                alt="Music thumbnail"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
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

          {/* Animated bars */}
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
      )}

      {/* Expanded YouTube player */}
      {expanded && (
        <div>
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(255,138,42,0.15)",
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

/* ═══════════════════════════════════════════════════════════════
   Journey card (individual trip)
   ═══════════════════════════════════════════════════════════════ */
function JourneyCard({ journey, badgeColor }) {
  return (
    <div
      className="pp-journey-card"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        transition: "border-color 0.2s, background 0.2s",
        cursor: "default",
      }}
    >
      {/* Stamp icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${badgeColor}22, rgba(255,138,42,0.12))`,
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
            fontFamily: "Syne, sans-serif",
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

/* ═══════════════════════════════════════════════════════════════
   Stamp grid — visual passport‑stamp motif
   ═══════════════════════════════════════════════════════════════ */
function StampGrid({ destinations, badgeColor }) {
  if (!destinations || destinations.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {destinations.map((dest, i) => (
        <div
          key={i}
          className="pp-stamp"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1.5px dashed ${badgeColor}55`,
            background: `${badgeColor}0a`,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "Syne, sans-serif",
            letterSpacing: "0.03em",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "transform 0.18s",
          }}
        >
          <MapPin size={10} color={badgeColor} />
          {dest}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Follow list modal — Twitter‑style followers / following list
   ═══════════════════════════════════════════════════════════════ */
function FollowListModal({
  tab,
  userId,
  username: profileUsername,
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

    // Try the follow endpoint first (primary), then profile fallback
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
          if (!res.ok) {
            console.warn(`[FollowListModal] ${res.status} from ${url}`);
            continue;
          }
          const data = await res.json();
          if (cancelled) return;

          // Accept multiple response shapes
          const users =
            data.users || data.followers || data.following || data.data || [];

          if (data.ok !== false && Array.isArray(users)) {
            console.log(
              `[FollowListModal] ✓ loaded ${users.length} ${tab} from ${url}`
            );
            setList(users);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn(`[FollowListModal] failed ${url}:`, err.message);
        }
      }
      // All endpoints failed
      if (!cancelled) {
        console.error(
          `[FollowListModal] All endpoints failed for ${tab}. Tried:`,
          endpoints
        );
        setError(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, tab, token]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Build profile path by replacing current username in URL with target username
  const buildProfilePath = (targetUsername) => {
    if (!targetUsername) return "/";
    const path = window.location.pathname;
    if (profileUsername && path.includes(profileUsername)) {
      return path.replace(profileUsername, targetUsername);
    }
    // Fallback: replace last path segment
    const parts = path.split("/").filter(Boolean);
    parts[parts.length - 1] = targetUsername;
    return "/" + parts.join("/");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 200,
          animation: "ppFadeIn 0.2s ease forwards",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "80vh",
          background: "#13101f",
          borderRadius: "20px 20px 0 0",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          animation: "ppSlideUp 0.3s ease forwards",
        }}
      >
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
                fontFamily: "Syne, sans-serif",
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
                background: "rgba(255,255,255,0.06)",
                border: "none",
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

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 0 }}>
            {["followers", "following"].map((t) => (
              <button
                key={t}
                onClick={() => onSwitchTab(t)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  borderBottom:
                    tab === t ? "2px solid #ff8a2a" : "2px solid transparent",
                  color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                  textTransform: "capitalize",
                  transition: "color 0.18s",
                }}
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
          {loading && (
            <div style={{ padding: "20px" }}>
              {[1, 2, 3, 4].map((i) => (
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
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                Couldn't load {tab}.
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 11,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Make sure your backend has a GET endpoint like
                <br />
                <code style={{ color: "rgba(255,138,42,0.6)" }}>
                  /api/follow/:userId/{tab}
                </code>
              </div>
              <button
                onClick={() => {
                  setError(false);
                  setLoading(true);
                  // re-trigger the effect
                  onSwitchTab(tab === "followers" ? "following" : "followers");
                  setTimeout(() => onSwitchTab(tab), 50);
                }}
                style={{
                  padding: "8px 20px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <Users
                size={32}
                color="rgba(255,255,255,0.12)"
                style={{ marginBottom: 12 }}
              />
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 14,
                }}
              >
                No {tab} yet
              </div>
            </div>
          )}

          {!loading &&
            !error &&
            list.map((user) => {
              const uid = user.username || user.handle || "";
              const displayName = user.name || user.displayName || uid;
              const avatarUrl = user.avatar || user.profileImage || null;

              return (
                <button
                  key={user._id || user.id || uid}
                  onClick={() => {
                    onClose();
                    onNavigate(buildProfilePath(uid));
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
                    fontFamily: "DM Sans, sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  {/* Avatar */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "1.5px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #7c5cfc, rgba(255,138,42,0.5))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {displayName[0].toUpperCase()}
                    </div>
                  )}

                  {/* Name + handle */}
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
                    {user.bio && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.35)",
                          marginTop: 3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {user.bio}
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    size={16}
                    color="rgba(255,255,255,0.2)"
                    style={{ flexShrink: 0 }}
                  />
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main page component
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
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [followListTab, setFollowListTab] = useState(null); // null | 'followers' | 'following'
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

  /* ── Close share popover on outside click ── */
  useEffect(() => {
    if (!showSharePopover) return;
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShowSharePopover(false);
        setCopied(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSharePopover]);

  /* ── Fetch profile ── */
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
        if (!data.ok) {
          setNotFound(true);
        } else {
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
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        followersCount: (prev.followersCount || 0) + (nowFollowing ? 1 : -1),
      };
    });
  }, []);

  const profileUrl = typeof window !== "undefined" ? window.location.href : "";

  const toggleSharePopover = () => {
    setShowSharePopover((prev) => !prev);
    setCopied(false);
  };

  const copyUrl = async () => {
    const url = profileUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // fallback: select the input so user can manually copy
      }
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${profile?.name || username}'s Skyrio Passport`,
        url: profileUrl,
      });
    } catch {}
    setShowSharePopover(false);
  };

  const goSignup = () => navigate(`/register?ref=passport&from=${username}`);

  /* ── Derived data ── */
  const journeys = profile?.journeys || profile?.trips || [];
  const destinations = profile?.destinations || profile?.visitedCities || [];

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes ppSkeleton {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes ppFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ppMusicBar {
          from { height: 4px; }
          to   { height: 18px; }
        }
        @keyframes ppFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes ppBorderGlow {
          0%, 100% { border-color: rgba(255,138,42,0.2); }
          50%      { border-color: rgba(255,138,42,0.5); }
        }
        @keyframes ppFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ppSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .pp-pub-card {
          opacity: 0;
          animation: ppFadeUp 0.5s ease forwards;
        }
        .pp-pub-card:nth-child(1) { animation-delay: 0.05s; }
        .pp-pub-card:nth-child(2) { animation-delay: 0.12s; }
        .pp-pub-card:nth-child(3) { animation-delay: 0.19s; }
        .pp-pub-card:nth-child(4) { animation-delay: 0.26s; }
        .pp-pub-card:nth-child(5) { animation-delay: 0.33s; }
        .pp-pub-card:nth-child(6) { animation-delay: 0.40s; }
        .pp-vibe-chip:hover { transform: translateY(-2px) scale(1.04); }
        .pp-stamp:hover { transform: scale(1.05); }
        .pp-journey-card:hover {
          border-color: rgba(255,138,42,0.25) !important;
          background: rgba(255,255,255,0.05) !important;
        }
      `}</style>

      {/* ═══════ Top bar ═══════ */}
      <div style={styles.topBar}>
        <button onClick={() => navigate("/")} style={styles.logoBtn}>
          <div style={styles.logoIcon}>
            <Plane size={13} color="#1b1024" />
          </div>
          <span style={styles.logoText}>Skyrio</span>
        </button>
        {!isAuthed ? (
          <button onClick={goSignup} style={styles.topCtaPrimary}>
            Get your passport →
          </button>
        ) : (
          <button
            onClick={() => navigate("/passport")}
            style={styles.topCtaSecondary}
          >
            My Passport
          </button>
        )}
      </div>

      {/* ═══════ Content ═══════ */}
      <div style={styles.container}>
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
            <Skeleton h={140} radius={20} />
            <Skeleton h={80} radius={20} />
            <Skeleton h={100} radius={20} />
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <NotFound username={username} onSignup={goSignup} />
        )}

        {/* ═══════ Profile loaded ═══════ */}
        {!loading && !notFound && profile && (
          <>
            {/* ── Passport header card ── */}
            <div className="pp-pub-card" style={styles.heroCard}>
              {/* Decorative passport watermark */}
              <div style={styles.watermark}>
                <Globe
                  size={180}
                  color="rgba(255,255,255,0.015)"
                  strokeWidth={0.5}
                />
              </div>

              <div style={styles.heroTop}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
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
                          background: `linear-gradient(135deg, ${badge.color}, rgba(255,138,42,0.5))`,
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
                    {/* Badge ring glow */}
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
                    {/* Badge tier dot */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: badge.color,
                        border: "2.5px solid #13101f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                      }}
                    >
                      {badge.icon}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={styles.displayName}>
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
                    <div style={styles.handle}>@{profile.username}</div>
                    {profile.city && (
                      <div style={styles.location}>
                        <MapPin size={11} />
                        {profile.city}
                      </div>
                    )}
                    {/* Tappable follower / following counts */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() => setFollowListTab("followers")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontFamily: "DM Sans, sans-serif",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: "#fff",
                          }}
                        >
                          {profile.followersCount || 0}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
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
                        onClick={() => setFollowListTab("following")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontFamily: "DM Sans, sans-serif",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: "#fff",
                          }}
                        >
                          {profile.followingCount || 0}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          Following
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Share button + popover */}
                <div
                  ref={shareRef}
                  style={{ position: "relative", flexShrink: 0 }}
                >
                  <button onClick={toggleSharePopover} style={styles.shareBtn}>
                    <Share2 size={13} />
                    Share
                  </button>

                  {showSharePopover && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: 280,
                        background: "rgba(22,18,40,0.97)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 14,
                        padding: 16,
                        zIndex: 100,
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                        backdropFilter: "blur(16px)",
                        animation: "ppFadeUp 0.2s ease forwards",
                      }}
                    >
                      {/* Close */}
                      <button
                        onClick={() => {
                          setShowSharePopover(false);
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
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: 10,
                          letterSpacing: "0.03em",
                        }}
                      >
                        Share this passport
                      </div>

                      {/* URL display + copy */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.10)",
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
                            color: "rgba(255,255,255,0.6)",
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

                      {/* Native share (if available) */}
                      {typeof navigator !== "undefined" && navigator.share && (
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
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "background 0.18s",
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
              {profile.bio && <p style={styles.bio}>"{profile.bio}"</p>}

              {/* ── Rank / XP section ── */}
              <div
                style={{ ...styles.rankBox, borderColor: `${badge.color}33` }}
              >
                <div style={styles.rankTop}>
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
                      <div style={{ ...styles.rankTitle, color: badge.color }}>
                        {profile.badge || "Explorer"}
                      </div>
                      <div style={styles.rankSub}>Skyrio rank</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={styles.xpRow}>
                      <Zap size={14} color="#ff8a2a" />
                      <span style={styles.xpVal}>
                        {(profile.xp || 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={styles.rankSub}>XP earned</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 12 }}>
                  <div style={styles.progressLabels}>
                    <span>{profile.badge || "Explorer"}</span>
                    {badge.next && <span>{badge.next} ✦</span>}
                  </div>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(100, profile.xpPercent || 0)}%`,
                        background: `linear-gradient(90deg, ${badge.color}, #ff8a2a)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Travel vibes ── */}
            {profile.travelVibes?.length > 0 && (
              <div className="pp-pub-card" style={styles.card}>
                <SectionLabel icon={Compass} label="Travel Vibe" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {profile.travelVibes.map((vibe) => (
                    <span
                      key={vibe}
                      className="pp-vibe-chip"
                      style={styles.vibeChip}
                    >
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

            {/* ── Travel journeys ── */}
            {journeys.length > 0 && (
              <div className="pp-pub-card" style={styles.card}>
                <SectionLabel icon={Map} label="Travel Journeys" />
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
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

            {/* ── Passport stamps (destinations) ── */}
            {destinations.length > 0 && (
              <div className="pp-pub-card" style={styles.card}>
                <SectionLabel icon={Globe} label="Passport Stamps" />
                <StampGrid
                  destinations={destinations}
                  badgeColor={badge.color}
                />
              </div>
            )}

            {/* ── Stats row ── */}
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
                  marginBottom: 20,
                }}
              >
                {profile.tripsCount > 0 && (
                  <div style={styles.statBox}>
                    <div style={styles.statVal}>{profile.tripsCount}</div>
                    <div style={styles.statLabel}>trips saved</div>
                  </div>
                )}
                {profile.joinedAt && (
                  <div style={styles.statBox}>
                    <div style={styles.statVal}>
                      {new Date(profile.joinedAt).getFullYear()}
                    </div>
                    <div style={styles.statLabel}>member since</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Virality CTA ── */}
            {!isAuthed && (
              <div className="pp-pub-card" style={styles.ctaCard}>
                <div style={styles.ctaBadge}>✦ Skyrio Passport</div>
                <h3 style={styles.ctaTitle}>What rank would you be?</h3>
                <p style={styles.ctaDesc}>
                  {profile.name || profile.username} is a{" "}
                  <strong style={{ color: badge.color }}>
                    {profile.badge || "Explorer"}
                  </strong>{" "}
                  on Skyrio. Search flights, earn XP, and find out where you'd
                  rank.
                </p>
                <button
                  onClick={goSignup}
                  style={styles.ctaPrimary}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = "brightness(1.08)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "";
                    e.currentTarget.style.transform = "";
                  }}
                >
                  Get your free passport
                  <ChevronRight size={16} />
                </button>
                <div style={styles.ctaFootnote}>
                  Free forever · No credit card required
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════ Follow list modal ═══════ */}
      {followListTab && profile && (
        <FollowListModal
          tab={followListTab}
          userId={profile._id || profile.id}
          username={profile.username}
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

/* ═══════════════════════════════════════════════════════════════
   Styles object
   ═══════════════════════════════════════════════════════════════ */
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(ellipse at 20% 0%, rgba(124,92,252,0.15) 0%, transparent 55%), " +
      "radial-gradient(ellipse at 80% 10%, rgba(255,138,42,0.10) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 100%, rgba(124,92,252,0.06) 0%, transparent 40%), " +
      "#09071a",
    color: "#fff",
    fontFamily: "DM Sans, sans-serif",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "rgba(9,7,26,0.75)",
  },

  logoBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "Syne, sans-serif",
    fontWeight: 800,
    fontSize: 16,
    color: "#fff",
  },

  topCtaPrimary: {
    padding: "8px 18px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
    color: "#1b1024",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "DM Sans, sans-serif",
  },
  topCtaSecondary: {
    padding: "8px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,138,42,0.4)",
    background: "rgba(255,138,42,0.1)",
    color: "#ff8a2a",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "DM Sans, sans-serif",
  },

  container: {
    maxWidth: 560,
    margin: "0 auto",
    padding: "28px 20px 96px",
  },

  /* Hero card */
  heroCard: {
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: "26px 24px",
    marginBottom: 14,
    position: "relative",
  },
  watermark: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 180,
    height: 180,
    pointerEvents: "none",
    overflow: "hidden",
    borderRadius: "0 22px 0 0",
  },
  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
    position: "relative",
    zIndex: 1,
  },
  displayName: {
    fontFamily: "Syne, sans-serif",
    fontSize: 20,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.1,
  },
  handle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.40)",
    marginTop: 4,
  },
  location: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
  },
  shareBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "DM Sans, sans-serif",
    flexShrink: 0,
    transition: "all 0.18s",
  },
  bio: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    fontStyle: "italic",
    lineHeight: 1.65,
    marginBottom: 20,
    position: "relative",
    zIndex: 1,
  },

  /* Rank box */
  rankBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid",
    borderRadius: 16,
    padding: "16px 18px",
    position: "relative",
    zIndex: 1,
  },
  rankTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rankTitle: {
    fontFamily: "Syne, sans-serif",
    fontSize: 16,
    fontWeight: 800,
  },
  rankSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 1,
  },
  xpRow: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    justifyContent: "flex-end",
  },
  xpVal: {
    fontFamily: "Syne, sans-serif",
    fontWeight: 800,
    fontSize: 18,
    color: "#fff",
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "rgba(255,255,255,0.30)",
    marginBottom: 6,
  },
  progressTrack: {
    height: 5,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    transition: "width 0.8s ease",
  },

  /* Generic card */
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "18px 20px",
    marginBottom: 14,
  },

  /* Section label */
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
    marginBottom: 14,
  },

  /* Vibe chip */
  vibeChip: {
    padding: "7px 14px",
    borderRadius: 999,
    background: "rgba(255,138,42,0.08)",
    border: "1px solid rgba(255,138,42,0.22)",
    fontSize: 13,
    fontWeight: 600,
    color: "#ffb066",
    transition: "transform 0.18s",
    display: "inline-block",
    textTransform: "capitalize",
    cursor: "default",
  },

  /* Stats */
  statBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "16px 16px",
    textAlign: "center",
  },
  statVal: {
    fontFamily: "Syne, sans-serif",
    fontSize: 24,
    fontWeight: 800,
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 3,
  },

  /* CTA card */
  ctaCard: {
    background:
      "linear-gradient(135deg, rgba(124,92,252,0.16), rgba(255,138,42,0.12))",
    border: "1px solid rgba(255,138,42,0.28)",
    borderRadius: 22,
    padding: "30px 24px",
    textAlign: "center",
  },
  ctaBadge: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#ff8a2a",
    marginBottom: 12,
  },
  ctaTitle: {
    fontFamily: "Syne, sans-serif",
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.2,
    marginBottom: 10,
  },
  ctaDesc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.6,
    marginBottom: 24,
    maxWidth: 340,
    margin: "0 auto 24px",
  },
  ctaPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "15px 32px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
    color: "#1b1024",
    fontFamily: "DM Sans, sans-serif",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 28px rgba(255,138,42,0.35)",
    transition: "filter 0.18s, transform 0.18s",
  },
  ctaFootnote: {
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.22)",
  },

  /* Not found */
  notFoundTitle: {
    fontFamily: "Syne, sans-serif",
    fontSize: 24,
    fontWeight: 800,
    color: "#fff",
    marginBottom: 8,
  },
  notFoundSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    marginBottom: 32,
  },
};
