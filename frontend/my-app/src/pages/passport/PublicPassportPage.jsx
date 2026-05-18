import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plane,
  MapPin,
  Music,
  Share2,
  Award,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import FollowButton from "./FollowButton";
import FollowStats from "./FollowStats";

const API = import.meta.env.VITE_API_URL || "";

// ── Badge config ──────────────────────────────────────────────
const BADGE_CONFIG = {
  Explorer: {
    color: "#7c5cfc",
    glow: "rgba(124,92,252,0.35)",
    next: "Adventurer",
  },
  Adventurer: {
    color: "#ff8a2a",
    glow: "rgba(255,138,42,0.35)",
    next: "Nomad",
  },
  Nomad: { color: "#00b8d9", glow: "rgba(0,184,217,0.35)", next: "Legend" },
  Legend: { color: "#f0c040", glow: "rgba(240,192,64,0.35)", next: null },
};

const DEFAULT_BADGE = {
  color: "#7c5cfc",
  glow: "rgba(124,92,252,0.35)",
  next: "Adventurer",
};

// ── YouTube embed helper ──────────────────────────────────────
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

// ── Skeleton ─────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, radius = 8, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 75%)",
        backgroundSize: "600px 100%",
        animation: "ppSkeleton 1.4s linear infinite",
        ...style,
      }}
    />
  );
}

// ── Not found state ───────────────────────────────────────────
function NotFound({ username, onSignup }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        <Plane size={48} color="rgba(255,255,255,0.2)" />
      </div>
      <h2
        style={{
          fontFamily: "Syne, sans-serif",
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
          color: "rgba(255,255,255,0.45)",
          fontSize: 15,
          marginBottom: 32,
        }}
      >
        This passport doesn't exist — but yours could.
      </p>
      <button
        onClick={onSignup}
        style={{
          padding: "14px 32px",
          borderRadius: 999,
          border: "none",
          background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
          color: "#1b1024",
          fontFamily: "DM Sans, sans-serif",
          fontSize: 15,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Claim your passport →
      </button>
    </div>
  );
}

export default function PublicPassportPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: authUser, token, isAuthed } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // Is this my own profile?
  const isOwnProfile = useMemo(() => {
    if (!authUser || !profile) return false;
    const myUsername = authUser.username || "";
    return myUsername.toLowerCase() === (profile.username || "").toLowerCase();
  }, [authUser, profile]);

  const badge = useMemo(
    () => BADGE_CONFIG[profile?.badge] || DEFAULT_BADGE,
    [profile?.badge]
  );
  const embedUrl = useMemo(
    () => getYouTubeEmbedUrl(profile?.profileMusic?.url),
    [profile?.profileMusic?.url]
  );

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
          // Backend may return data.user or data.profile
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

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.name || username}'s Skyrio Passport`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const goSignup = () => navigate(`/register?ref=passport&from=${username}`);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 20% 0%, rgba(124,92,252,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 10%, rgba(255,138,42,0.12) 0%, transparent 50%), #09071a",
        color: "#fff",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      <style>{`
        @keyframes ppSkeleton { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        @keyframes ppFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ppPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes ppSpin { to { transform: rotate(360deg); } }
        .pp-pub-card { animation: ppFadeUp 0.4s ease forwards; }
        .pp-pub-card:nth-child(2) { animation-delay: 0.08s; }
        .pp-pub-card:nth-child(3) { animation-delay: 0.16s; }
        .pp-pub-card:nth-child(4) { animation-delay: 0.24s; }
        .pp-vibe-chip:hover { transform: translateY(-2px); }
      `}</style>

      {/* ── Top bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plane size={13} color="#1b1024" />
          </div>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: 16,
              color: "#fff",
            }}
          >
            Skyrio
          </span>
        </button>
        {!isAuthed ? (
          <button
            onClick={goSignup}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
              color: "#1b1024",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Get your passport →
          </button>
        ) : (
          <button
            onClick={() => navigate("/passport")}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,138,42,0.4)",
              background: "rgba(255,138,42,0.1)",
              color: "#ff8a2a",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            My Passport
          </button>
        )}
      </div>

      <div
        style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 96px" }}
      >
        {/* ── Loading ── */}
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
                <Skeleton w="60%" h={20} />
                <Skeleton w="40%" h={14} />
              </div>
            </div>
            <Skeleton h={120} radius={16} />
            <Skeleton h={80} radius={16} />
          </div>
        )}

        {/* ── Not found ── */}
        {!loading && notFound && (
          <NotFound username={username} onSignup={goSignup} />
        )}

        {/* ── Profile ── */}
        {!loading && !notFound && profile && (
          <>
            {/* ── Profile card ── */}
            <div
              className="pp-pub-card"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.name}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: `2px solid ${badge.color}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${badge.color}, rgba(255,138,42,0.4))`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                          fontWeight: 800,
                        }}
                      >
                        {(profile.name ||
                          profile.username ||
                          "?")[0].toUpperCase()}
                      </div>
                    )}
                    {/* Badge ring */}
                    <div
                      style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: "50%",
                        border: `2px solid ${badge.color}`,
                        boxShadow: `0 0 12px ${badge.glow}`,
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Syne, sans-serif",
                          fontSize: 20,
                          fontWeight: 800,
                          color: "#fff",
                          lineHeight: 1.1,
                        }}
                      >
                        {profile.name || profile.username}
                      </div>

                      {/* ✅ Follow button — only for logged-in visitors on someone else's profile */}
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
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.45)",
                        marginTop: 4,
                      }}
                    >
                      @{profile.username}
                    </div>
                    {profile.city && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 6,
                          fontSize: 12,
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        <MapPin size={11} />
                        {profile.city}
                      </div>
                    )}

                    {/* ✅ Follower / following counts */}
                    <FollowStats
                      followers={profile.followersCount || 0}
                      following={profile.followingCount || 0}
                      loading={false}
                    />
                  </div>
                </div>

                {/* Share button */}
                <button
                  onClick={handleShare}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                    flexShrink: 0,
                    transition: "all 0.18s",
                  }}
                >
                  <Share2 size={13} />
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>

              {profile.bio && (
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    fontStyle: "italic",
                    lineHeight: 1.6,
                    marginBottom: 20,
                  }}
                >
                  "{profile.bio}"
                </p>
              )}

              {/* ── Rank display ── */}
              <div
                style={{
                  background: `linear-gradient(135deg, rgba(${badge.color
                    .replace("#", "")
                    .match(/.{2}/g)
                    .map((h) => parseInt(h, 16))
                    .join(",")}, 0.12), rgba(255,138,42,0.08))`,
                  border: `1px solid ${badge.color}33`,
                  borderRadius: 14,
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <Award size={18} color={badge.color} />
                    <div>
                      <div
                        style={{
                          fontFamily: "Syne, sans-serif",
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
                          color: "rgba(255,255,255,0.4)",
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
                      <Zap size={13} color="#ff8a2a" />
                      <span
                        style={{
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 800,
                          fontSize: 18,
                          color: "#fff",
                        }}
                      >
                        {(profile.xp || 0).toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                    >
                      XP earned
                    </div>
                  </div>
                </div>

                {/* XP progress bar */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.35)",
                      marginBottom: 6,
                    }}
                  >
                    <span>{profile.badge || "Explorer"}</span>
                    {badge.next && <span>{badge.next} ✦</span>}
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, profile.xpPercent || 0)}%`,
                        background: `linear-gradient(90deg, ${badge.color}, #ff8a2a)`,
                        borderRadius: 99,
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Travel vibes ── */}
            {profile.travelVibes?.length > 0 && (
              <div
                className="pp-pub-card"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20,
                  padding: "18px 20px",
                  marginBottom: 16,
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
                  Travel vibe
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {profile.travelVibes.map((vibe) => (
                    <span
                      key={vibe}
                      className="pp-vibe-chip"
                      style={{
                        padding: "7px 14px",
                        borderRadius: 999,
                        background: "rgba(255,138,42,0.1)",
                        border: "1px solid rgba(255,138,42,0.25)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#ffb066",
                        transition: "transform 0.18s",
                        display: "inline-block",
                        textTransform: "capitalize",
                      }}
                    >
                      {vibe}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Travel soundtrack ── */}
            {embedUrl && (
              <div
                className="pp-pub-card"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20,
                  padding: "18px 20px",
                  marginBottom: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Music size={14} color="#ff8a2a" />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    Travel soundtrack
                  </span>
                </div>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(255,138,42,0.15)",
                  }}
                >
                  <iframe
                    width="100%"
                    height="180"
                    src={embedUrl}
                    title="Travel Soundtrack"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ display: "block" }}
                  />
                </div>
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
                  marginBottom: 24,
                }}
              >
                {profile.tripsCount > 0 && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Syne, sans-serif",
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
                        color: "rgba(255,255,255,0.4)",
                        marginTop: 2,
                      }}
                    >
                      trips saved
                    </div>
                  </div>
                )}
                {profile.joinedAt && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Syne, sans-serif",
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
                        color: "rgba(255,255,255,0.4)",
                        marginTop: 2,
                      }}
                    >
                      member since
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── VIRALITY CTA (only for non-authed visitors) ── */}
            {!isAuthed && (
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(124,92,252,0.2), rgba(255,138,42,0.15))",
                  border: "1px solid rgba(255,138,42,0.3)",
                  borderRadius: 20,
                  padding: "28px 24px",
                  textAlign: "center",
                }}
              >
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
                    fontFamily: "Syne, sans-serif",
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
                    color: "rgba(255,255,255,0.5)",
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
                  style={{
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
                    boxShadow: "0 8px 28px rgba(255,138,42,0.38)",
                    transition: "filter 0.18s, transform 0.18s",
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
                  Get your free passport
                  <ChevronRight size={16} />
                </button>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.25)",
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
  );
}
