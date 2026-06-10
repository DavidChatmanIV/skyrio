import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useContext,
} from "react";
import { Badge, Button, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  GlobalOutlined,
  SearchOutlined,
  FireOutlined,
  EnvironmentOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

import "@/styles/SkyHubPage.css";
import heroBeach from "@/assets/skyhub/beach.png";
import { skyhubFilters, skyhubTabs } from "./skyhubData";
import SkyHubComposer from "./SkyHubComposer";
import SkyHubFeedCard from "./SkyHubFeedCard";
import SkyHubCommentDrawer from "./SkyHubCommentDrawer";
import SkyHubPassportCard from "./SkyHubPassportCard";
import SkyHubTrendingDestinations from "./SkyHubTrendingDestinations";
import SkyHubActiveTravelers from "./SkyHubActiveTravelers";
import { apiUrl } from "@/lib/api";
import { AuthContext } from "@/context/AuthContext";

/* ── Data helpers ─────────────────────────────────────────────── */
function mapBackendPost(post) {
  return {
    id: post._id,
    authorId: post.authorId || post.userId || null,
    author: post.authorName || "Traveler",
    username: post.username ? `@${post.username}` : "@traveler",
    avatar: post.avatar || null,
    verified: !!post.verified,
    type: post.type || "Story",
    destination: post.destination || "",
    timeAgo: post.timeAgo || "now",
    text: post.text || "",
    image: post.image || "",
    images:
      Array.isArray(post.images) && post.images.length > 0
        ? post.images
        : post.image
        ? [post.image]
        : [],
    likes: post.likesCount || 0,
    comments: post.commentsCount || 0,
    shares: post.sharesCount || 0,
    saves: post.savesCount || 0,
    tags: Array.isArray(post.tags) ? post.tags : [],
    helpful: !!post.helpful,
    liked: !!post.viewerHasLiked,
    saved: !!post.viewerHasSaved,
  };
}

function deriveTrending(posts) {
  const counts = {};
  posts.forEach((p) => {
    if (!p.destination?.trim()) return;
    counts[p.destination] = (counts[p.destination] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, cnt]) => ({
      name,
      posts: cnt,
      pct: Math.round((cnt / total) * 100),
    }));
}

function deriveActiveTravelers(posts) {
  const seen = new Set();
  return posts
    .filter((p) => {
      const key = p.authorId || p.username;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map((p) => ({
      name: p.author,
      username: p.username?.replace("@", ""),
      avatar: p.avatar,
      location: p.destination,
      badge: "Explorer",
    }));
}

function deriveTrendingTags(posts) {
  const counts = {};
  posts.forEach((p) => {
    (p.tags || []).forEach((t) => {
      const tag = t.startsWith("#") ? t : `#${t}`;
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, cnt]) => ({ tag, cnt }));
}

/* ── SVG Icons used inline ──────────────────────────────────── */
const TrendUpIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
const FireSvg = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
  </svg>
);
const HashIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);
const MapPinIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const SparkleIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ── Empty state icons ──────────────────────────────────────── */
function EmptyIcon({ type }) {
  const p = {
    width: 40,
    height: 40,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const icons = {
    globe: (
      <svg {...p}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    edit: (
      <svg {...p}>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    pin: (
      <svg {...p}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    chat: (
      <svg {...p}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    plane: (
      <svg {...p}>
        <path d="M22 2L11 13" />
        <path d="M22 2L15 22 11 13 2 9l20-7z" />
      </svg>
    ),
  };
  return icons[type] || icons.globe;
}

/* ── Featured Destination card ─────────────────────────────── */
function FeaturedCard({ destination, postCount, onExplore }) {
  if (!destination) return null;
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg,rgba(255,107,43,0.16),rgba(147,51,234,0.12))",
        border: "1px solid rgba(255,107,43,0.22)",
        borderRadius: 20,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        transition: "all 0.18s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 32px rgba(255,107,43,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      onClick={onExplore}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          flexShrink: 0,
          background: "linear-gradient(135deg,#ff6b2b,#9333ea)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ff9555",
        }}
      >
        <FireSvg />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "rgba(255,149,85,0.85)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 2,
          }}
        >
          Trending Now
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          {destination}
        </div>
        <div
          style={{ fontSize: 12, color: "rgba(240,236,255,0.5)", marginTop: 1 }}
        >
          {postCount} post{postCount !== 1 ? "s" : ""} · Active community
        </div>
      </div>
      <div
        style={{
          padding: "7px 14px",
          borderRadius: 99,
          flexShrink: 0,
          background: "rgba(255,107,43,0.18)",
          border: "1px solid rgba(255,107,43,0.32)",
          fontSize: 12,
          fontWeight: 700,
          color: "#ff9555",
        }}
      >
        Explore →
      </div>
    </div>
  );
}

/* ── Today's Hotspots ────────────────────────────────────────── */
function HotspotsWidget({ trending }) {
  if (!trending?.length) return null;
  return (
    <div
      style={{
        background: "rgba(13,10,30,0.75)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        overflow: "hidden",
        backdropFilter: "blur(24px)",
      }}
    >
      <div
        style={{
          padding: "13px 16px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: "var(--sh-orange2)" }}>
          <TrendUpIcon />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--sh-text)",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          Today's Hotspots
        </span>
      </div>
      {trending.map((d, i) => (
        <div
          key={i}
          style={{
            padding: "10px 16px",
            borderBottom:
              i < trending.length - 1
                ? "1px solid rgba(255,255,255,0.05)"
                : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 5,
            }}
          >
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--sh-text)" }}
            >
              {d.name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--sh-orange2)",
                background: "var(--sh-odim)",
                padding: "1px 8px",
                borderRadius: 99,
              }}
            >
              +{d.pct}%
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${d.pct}%`,
                background: "linear-gradient(90deg,var(--sh-orange),#9333ea)",
                borderRadius: 99,
                transition: "width 0.8s ease",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Trending Tags ────────────────────────────────────────────── */
function TrendingTagsWidget({ tags }) {
  if (!tags?.length) return null;
  return (
    <div
      style={{
        background: "rgba(13,10,30,0.75)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "13px 16px",
        backdropFilter: "blur(24px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 12,
        }}
      >
        <span style={{ color: "var(--sh-orange)" }}>
          <FireSvg />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--sh-text)",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          Trending
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {tags.map(({ tag, cnt }) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              borderRadius: 99,
              cursor: "pointer",
              background: "rgba(147,51,234,0.12)",
              border: "1px solid rgba(147,51,234,0.22)",
              transition: "all 0.14s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(147,51,234,0.22)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(147,51,234,0.12)")
            }
          >
            <span style={{ color: "#a78bfa" }}>
              <HashIcon />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#c084fc" }}>
              {tag.replace("#", "")}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(240,236,255,0.35)",
                background: "rgba(255,255,255,0.05)",
                padding: "0 5px",
                borderRadius: 99,
              }}
            >
              {cnt}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function SkyHubPage() {
  const navigate = useNavigate();
  const { user: authUser } = useContext(AuthContext);

  const currentUser = authUser
    ? {
        id: authUser._id || authUser.id,
        name:
          authUser.name || authUser.fullName || authUser.username || "Traveler",
        username:
          authUser.username || authUser.email?.split("@")[0] || "traveler",
        avatar:
          authUser.avatar ||
          authUser.profilePicture ||
          authUser.profileImage ||
          null,
        xp: authUser.xp || authUser.passport || 0,
        badge: authUser.badge || "Explorer",
      }
    : null;

  const [activeTab, setActiveTab] = useState("forYou");
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [composerText, setComposerText] = useState("");
  const [destination, setDestination] = useState("");
  const [activePostType, setActivePostType] = useState("Tip");
  const [composerPhotos, setComposerPhotos] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState(null);

  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(searchValue),
      250
    );
    return () => clearTimeout(debounceRef.current);
  }, [searchValue]);

  const fetchFeed = useCallback(async () => {
    try {
      setLoadingFeed(true);
      const res = await fetch(apiUrl("/api/skyhub/feed"), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load feed");
      setPosts(Array.isArray(data.posts) ? data.posts.map(mapBackendPost) : []);
    } catch (err) {
      message.error(err.message || "Could not load SkyHub feed.");
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const trendingDestinations = useMemo(() => deriveTrending(posts), [posts]);
  const activeTravelers = useMemo(() => deriveActiveTravelers(posts), [posts]);
  const trendingTags = useMemo(() => deriveTrendingTags(posts), [posts]);

  const liveStats = useMemo(() => {
    if (!posts.length) return null;
    const authors = new Set(
      posts.map((p) => p.authorId || p.username).filter(Boolean)
    );
    const countries = new Set(posts.map((p) => p.destination).filter(Boolean));
    return {
      travelers: authors.size,
      posts: posts.length,
      countries: countries.size,
    };
  }, [posts]);

  const myUsername = currentUser?.username?.toLowerCase();
  const myId = currentUser?.id;

  const visiblePosts = useMemo(
    () =>
      posts.filter((post) => {
        const s = debouncedSearch.toLowerCase();
        const ms =
          !s ||
          (post.text || "").toLowerCase().includes(s) ||
          (post.destination || "").toLowerCase().includes(s) ||
          (post.author || "").toLowerCase().includes(s) ||
          (post.tags || []).join(" ").toLowerCase().includes(s);
        const mf =
          activeFilter === "All" ||
          (post.tags || []).some(
            (t) => t.toLowerCase() === activeFilter.toLowerCase()
          ) ||
          (post.type || "").toLowerCase() === activeFilter.toLowerCase();
        let mt = true;
        switch (activeTab) {
          case "following":
            mt =
              (post.username || "").replace("@", "").toLowerCase() ===
                myUsername ||
              (post.authorId && String(post.authorId) === String(myId)) ||
              (post.username || "").replace("@", "").toLowerCase() === "you";
            break;
          case "nearby":
            mt = !!post.destination?.trim();
            break;
          case "questions":
            mt = post.type === "Question";
            break;
          case "trips":
            mt = post.type === "Join Trip" || post.type === "Story";
            break;
          default:
            mt = true;
        }
        return ms && mf && mt;
      }),
    [posts, debouncedSearch, activeFilter, activeTab, myUsername, myId]
  );

  const EMPTY = {
    forYou: {
      icon: "globe",
      title: "Nothing here yet",
      sub: "Be the first to share a tip, question, or story.",
    },
    following: {
      icon: "edit",
      title: "No posts yet",
      sub: "Posts you create will appear here.",
    },
    nearby: {
      icon: "pin",
      title: "No destination posts",
      sub: "Posts tagged with a destination will appear here.",
    },
    questions: {
      icon: "chat",
      title: "No questions yet",
      sub: "Ask the community anything about travel.",
    },
    trips: {
      icon: "plane",
      title: "No trips yet",
      sub: "Share a trip idea or story to get started.",
    },
  };
  const empty = EMPTY[activeTab] || EMPTY.forYou;

  const FEED_TITLES = {
    forYou: "Community Feed",
    following: "Your Posts",
    nearby: "Destination Posts",
    questions: "Questions",
    trips: "Trips & Stories",
  };

  /* Handlers */
  const handleCreatePost = async () => {
    if (!composerText.trim() && composerPhotos.length === 0) {
      message.warning("Write something or add a photo before posting.");
      return;
    }
    try {
      setCreatingPost(true);
      let urls = [];
      if (composerPhotos.length > 0) {
        const token = localStorage.getItem("token");
        const res = await Promise.allSettled(
          composerPhotos.map(async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            const r = await fetch(apiUrl("/api/uploads/image"), {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
              body: fd,
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || "Upload failed");
            return d.url;
          })
        );
        urls = res.filter((r) => r.status === "fulfilled").map((r) => r.value);
        const bad = res.filter((r) => r.status === "rejected").length;
        if (bad)
          message.warning(
            `${bad} photo${bad > 1 ? "s" : ""} failed to upload.`
          );
      }
      const res = await fetch(apiUrl("/api/skyhub/posts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: composerText.trim(),
          type: activePostType,
          destination: destination.trim(),
          images: urls,
          image: urls[0] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create post");
      const enriched = {
        ...data.post,
        images: urls.length ? urls : data.post.images || [],
        image: urls[0] || data.post.image || "",
        authorName: currentUser?.name || data.post.authorName,
        username: currentUser?.username || data.post.username,
        avatar: currentUser?.avatar || data.post.avatar,
        authorId: currentUser?.id || data.post.authorId,
      };
      setPosts((prev) => [mapBackendPost(enriched), ...prev]);
      setComposerText("");
      setDestination("");
      setActivePostType("Tip");
      setComposerPhotos([]);
      message.success("Posted to SkyHub!");
    } catch (err) {
      message.error(err.message || "Could not create post.");
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${id}/like`), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      setPosts((p) =>
        p.map((x) =>
          x.id === id
            ? { ...x, liked: !!data.liked, likes: data.likesCount ?? x.likes }
            : x
        )
      );
    } catch (err) {
      message.error(err.message || "Could not update like.");
    }
  };

  const handleToggleSave = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${id}/save`), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      setPosts((p) =>
        p.map((x) =>
          x.id === id
            ? { ...x, saved: !!data.saved, saves: data.savesCount ?? x.saves }
            : x
        )
      );
      message.success(data.saved ? "Saved." : "Removed from saved.");
    } catch (err) {
      message.error(err.message || "Could not update saved state.");
    }
  };

  const handleDeletePost = async (id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    message.success("Post deleted.");
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${id}`), {
        method: "DELETE",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!res.ok && res.status !== 404)
        console.warn("[skyhub] delete", res.status);
    } catch {
      /* UI already updated */
    }
  };

  const handleOpenComments = (post) => {
    setActiveCommentPost(post);
    setCommentDrawerOpen(true);
  };

  const handleReportPost = async (post) => {
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${post.id}/report`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: "User reported this post" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      message.success("Post reported. Thanks for keeping SkyHub safe.");
    } catch (err) {
      message.error(err.message || "Could not report post.");
    }
  };

  const refreshPostComments = (id, count) =>
    setPosts((p) =>
      p.map((x) =>
        x.id === id
          ? { ...x, comments: typeof count === "number" ? count : x.comments }
          : x
      )
    );

  const scrollToFeed = () =>
    document
      .querySelector(".skyhub-feedSection")
      ?.scrollIntoView({ behavior: "smooth" });

  const currentUserId = currentUser
    ? `${currentUser.id || ""}|${currentUser.username || ""}`
    : null;

  const topTrend = trendingDestinations[0] || null;

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div
      className="skyhub-page"
      style={{ backgroundImage: `url(${heroBeach})` }}
    >
      {/* ══ HERO ══ */}
      <header className="skyhub-topHeader">
        <div className="skyhub-topHeaderOverlay" />
        <div className="skyhub-topHeaderInner">
          <div className="skyhub-heroCopy">
            {/* Logged-in user pill */}
            {currentUser && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 18,
                  padding: "8px 14px 8px 8px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 99,
                  backdropFilter: "blur(12px)",
                }}
              >
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background:
                        "linear-gradient(135deg,var(--sh-orange),#9333ea)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1.2,
                    }}
                  >
                    {currentUser.name.split(" ")[0]}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}
                  >
                    @{currentUser.username} · {currentUser.xp.toLocaleString()}{" "}
                    XP
                  </div>
                </div>
                {/* Live badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(52,211,153,0.15)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#34d399",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#34d399",
                      display: "inline-block",
                    }}
                  />
                  LIVE
                </div>
              </div>
            )}

            <div className="skyhub-eyebrow">Skyrio Community</div>
            <h1 className="skyhub-pageTitle">SkyHub</h1>
            <p className="skyhub-pageSubtitle">
              Share travel experiences, ask smart questions, and help other
              travelers move better.
            </p>
            <div className="skyhub-heroStats">
              <div className="skyhub-heroStat">
                <FireOutlined />
                <span>Trending travel conversations</span>
              </div>
              <div className="skyhub-heroStat">
                <EnvironmentOutlined />
                <span>Destination discovery</span>
              </div>
              <div className="skyhub-heroStat">
                <QuestionCircleOutlined />
                <span>Real traveler questions</span>
              </div>
            </div>
          </div>

          <div className="skyhub-headerActions">
            <Input
              allowClear
              size="large"
              placeholder="Search destinations, tips, travelers..."
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={scrollToFeed}
              className="skyhub-searchInput"
            />
            <Button
              type="primary"
              icon={<GlobalOutlined />}
              className="skyhub-exploreBtn"
              onClick={scrollToFeed}
            >
              Explore SkyHub
            </Button>
          </div>
        </div>

        {/* Live stats */}
        {liveStats && (
          <div className="skyhub-topStats">
            <div className="skyhub-statItem">
              <strong>{liveStats.travelers.toLocaleString()}</strong>
              <span>Travelers</span>
            </div>
            <div className="skyhub-statItem">
              <strong>{liveStats.posts.toLocaleString()}</strong>
              <span>Posts</span>
            </div>
            {liveStats.countries > 0 && (
              <div className="skyhub-statItem">
                <strong>{liveStats.countries}+</strong>
                <span>Countries</span>
              </div>
            )}
            <div className="skyhub-onlinePill">
              {liveStats.travelers > 0
                ? `${liveStats.travelers} traveler${
                    liveStats.travelers !== 1 ? "s" : ""
                  } here`
                : "Be the first to post"}
            </div>
          </div>
        )}
      </header>

      {/* ══ MAIN ══ */}
      <main className="skyhub-main">
        {/* Sticky nav */}
        <div className="skyhub-navbar">
          <div className="skyhub-navbar-tabs">
            {skyhubTabs.map((tab) => (
              <button
                key={tab.value ?? tab}
                type="button"
                className={`skyhub-navbar-tab${
                  activeTab === (tab.value ?? tab) ? " is-active" : ""
                }`}
                onClick={() => setActiveTab(tab.value ?? tab)}
              >
                {tab.label ?? tab}
              </button>
            ))}
          </div>
          {/* Single scrolling row — no wrap on mobile */}
          <div className="skyhub-navbar-vibes" style={{ flexWrap: "nowrap" }}>
            {skyhubFilters
              .filter((f) => f !== "Team Travel")
              .map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`skyhub-vibe-chip${
                    activeFilter === filter ? " is-on" : ""
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
          </div>
        </div>

        {/* Content */}
        <section className="skyhub-contentGrid">
          <div className="skyhub-leftRail">
            {/* Featured trending destination */}
            {topTrend && (
              <FeaturedCard
                destination={topTrend.name}
                postCount={topTrend.posts}
                onExplore={() => {
                  setActiveTab("nearby");
                  setActiveFilter("All");
                  scrollToFeed();
                }}
              />
            )}

            <SkyHubComposer
              composerText={composerText}
              setComposerText={setComposerText}
              activePostType={activePostType}
              setActivePostType={setActivePostType}
              destination={destination}
              setDestination={setDestination}
              onCreatePost={handleCreatePost}
              creatingPost={creatingPost}
              onPhotosChange={setComposerPhotos}
              user={currentUser}
            />

            <section className="skyhub-feedSection">
              <div className="skyhub-feedSectionHeader">
                <div>
                  <h2 className="skyhub-sectionTitle">
                    {FEED_TITLES[activeTab] || "Community Feed"}
                  </h2>
                  <p className="skyhub-sectionSubtext">
                    {debouncedSearch
                      ? `${visiblePosts.length} result${
                          visiblePosts.length !== 1 ? "s" : ""
                        } for "${debouncedSearch}"`
                      : "Travel-first posts with real community insights."}
                  </p>
                </div>
                <Badge
                  count={visiblePosts.length}
                  style={{ backgroundColor: "var(--sh-orange)" }}
                />
              </div>

              <div className="skyhub-feedList">
                {loadingFeed ? (
                  <div className="skyhub-emptyState">
                    <div
                      style={{
                        marginBottom: 12,
                        color: "rgba(240,236,255,0.2)",
                      }}
                    >
                      <EmptyIcon type="plane" />
                    </div>
                    <h3>Loading SkyHub...</h3>
                    <p>Pulling in the latest travel conversations.</p>
                  </div>
                ) : visiblePosts.length ? (
                  visiblePosts.map((post) => (
                    <SkyHubFeedCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId}
                      onToggleLike={handleToggleLike}
                      onToggleSave={handleToggleSave}
                      onOpenComments={handleOpenComments}
                      onReportPost={handleReportPost}
                      onDeletePost={handleDeletePost}
                    />
                  ))
                ) : (
                  <div className="skyhub-emptyState">
                    <div
                      style={{
                        marginBottom: 12,
                        color: "rgba(240,236,255,0.2)",
                      }}
                    >
                      <EmptyIcon type={empty.icon} />
                    </div>
                    <h3>{empty.title}</h3>
                    <p>{empty.sub}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="skyhub-rightRail">
            <SkyHubPassportCard currentUser={currentUser} />

            {trendingTags.length > 0 && (
              <TrendingTagsWidget tags={trendingTags} />
            )}

            <SkyHubTrendingDestinations
              items={trendingDestinations}
              loading={loadingFeed}
              onSeeAll={() => navigate("/skyhub/destinations")}
            />

            {trendingDestinations.length > 0 && (
              <HotspotsWidget trending={trendingDestinations} />
            )}

            <SkyHubActiveTravelers
              travelers={activeTravelers}
              loading={loadingFeed}
              onViewAll={() => navigate("/skyhub/travelers")}
            />
          </aside>
        </section>
      </main>

      <SkyHubCommentDrawer
        open={commentDrawerOpen}
        onClose={() => setCommentDrawerOpen(false)}
        post={activeCommentPost}
        refreshPostComments={refreshPostComments}
      />
    </div>
  );
}
