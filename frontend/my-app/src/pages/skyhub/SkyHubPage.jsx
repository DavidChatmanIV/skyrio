import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useContext,
} from "react";
import { Badge, Button, Input, Modal, Radio, message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  GlobalOutlined,
  FireOutlined,
  EnvironmentOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

import "@/styles/SkyHubPage.css";
import heroBeach from "@/assets/skyhub/beach.png";
import { skyhubFilters, skyhubTabs } from "./skyhubData";
import SkyHubComposer from "./SkyHubComposer";
import SkyHubSearch from "./SkyHubSearch";
import SkyHubLocalBanner from "./SkyHubLocalBanner";
import SkyHubFeedCard from "./SkyHubFeedCard";
import SkyHubCommentDrawer from "./SkyHubCommentDrawer";
import SkyHubPassportCard from "./SkyHubPassportCard";
import SkyHubTrendingDestinations from "./SkyHubTrendingDestinations";
import SkyHubActiveTravelers from "./SkyHubActiveTravelers";
import SkyHubStanding from "./SkyHubStanding";
import { apiUrl } from "@/lib/api";
import { AuthContext } from "@/context/AuthContext";

/* ── Logged-in requests ─────────────────────────────────────────
   SkyHub knows who you are from the same login token the rest of
   Skyrio uses — without it every action was anonymous. */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function skyFetch(path, opts = {}) {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: authHeaders(opts.headers || {}),
  });
}

// Reads a response even when the server sent back HTML or nothing
// (e.g. a 413 "file too large" page), so we can show a real reason.
async function readJson(res) {
  const raw = await res.text().catch(() => "");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { message: raw && raw.length < 200 ? raw : "" };
  }
}

function uploadErrorMessage(status, data) {
  if (data?.message || data?.error) return data.message || data.error;
  if (status === 413) return "That photo is too large.";
  if (status === 401 || status === 403) return "Log in again to upload photos.";
  if (status === 404) return "Photo upload isn't available right now.";
  if (status === 429) return "Too many uploads — wait a minute and try again.";
  return "Upload failed.";
}

// Keep in sync with REPORT_REASONS in backend/services/skyhubModeration.js
const REPORT_REASONS = [
  { value: "spam", label: "Spam or ads" },
  { value: "scam", label: "Scam or fake tour" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "nudity", label: "Nudity or sexual content" },
  {
    value: "intimate_image",
    label: "Intimate image shared without consent",
    urgent: true,
  },
  { value: "child_safety", label: "Involves a child's safety", urgent: true },
  { value: "self_harm", label: "Someone may hurt themselves" },
  { value: "misinformation", label: "False or misleading info" },
  { value: "other", label: "Something else" },
];

// Shown under the reasons when one needs extra context.
const REASON_HINTS = {
  intimate_image: (
    <>
      We'll hide it right away. If it's an image of you, you can also send a{" "}
      <a href="/skyhub/report-content" style={{ color: "#ff9555" }}>
        formal removal request
      </a>
      . We act on those within 48 hours.
    </>
  ),
  child_safety: (
    <>
      We'll hide it right away and review it urgently. Please don't share or
      download it. If a child is in immediate danger, call 911. You can also
      report to the{" "}
      <a
        href="https://report.cybertip.org"
        target="_blank"
        rel="noreferrer"
        style={{ color: "#ff9555" }}
      >
        NCMEC CyberTipline
      </a>
      .
    </>
  ),
  self_harm: (
    <>
      We'll reach out to them with support, not a penalty. If someone is in
      immediate danger, call 911. In the US you can call or text <b>988</b> any
      time.
    </>
  ),
};

// Plain-English reasons a post didn't earn XP (from the anti-cheat service).
const XP_REASONS = {
  too_short:
    "No XP this time: write a little more (or add a photo) to earn XP.",
  daily_cap:
    "You've reached today's XP limit for posts. Keep sharing, it resets tomorrow.",
  cap: "You've reached today's XP limit for posts. Keep sharing, it resets tomorrow.",
  cap_reached:
    "You've reached today's XP limit for posts. Keep sharing, it resets tomorrow.",
  duplicate: "You already earned XP for this post.",
  already_awarded: "You already earned XP for this post.",
};

// Is a post's destination in or around your city? Matches the city name,
// or its state/region ("Newark, NJ" counts as near "Orange, NJ").
function isNear(destination, city) {
  const d = ` ${(destination || "").toLowerCase()} `;
  if (!d.trim() || !city?.name) return false;
  if (d.includes(city.name.toLowerCase())) return true;
  if (
    city.region &&
    city.region.length > 3 &&
    d.includes(city.region.toLowerCase())
  )
    return true;
  const code = (city.regionCode || "").toLowerCase();
  return code.length === 2 && new RegExp(`[ ,]${code}[ ,.]`).test(d);
}

/* ── Data helpers ─────────────────────────────────────────────── */
// Photos saved on our own server come back as "/uploads/..."; the page runs
// on a different port, so point them at the API.
const photoUrl = (u) =>
  typeof u === "string" && u.startsWith("/") ? apiUrl(u) : u;

function mapBackendPost(post) {
  return {
    id: post._id,
    authorId: post.authorId || post.userId || null,
    isMine: !!post.isMine,
    underReview: !!post.underReview,
    author: post.authorName || "Traveler",
    username: post.username ? `@${post.username}` : "@traveler",
    avatar: post.avatar || null,
    verified: !!post.verified,
    badge: post.authorBadge || "Explorer",
    type: post.type || "Story",
    destination: post.destination || "",
    timeAgo: post.timeAgo || "just now",
    edited: !!post.edited,
    editedAt: post.editedAt || null,
    text: post.text || "",
    image: photoUrl(post.image || ""),
    images: (Array.isArray(post.images) && post.images.length > 0
      ? post.images
      : post.image
      ? [post.image]
      : []
    ).map(photoUrl),
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
      badge: p.badge || "Explorer",
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
  const auth = useContext(AuthContext);
  const authUser = auth?.user;

  // The page's own copy of your XP. The server sends the new total after
  // every post/delete, so the hero pill and Passport card update instantly
  // even if AuthContext has no way to update the user.
  const [liveXp, setLiveXp] = useState(null);
  useEffect(() => setLiveXp(null), [authUser?._id, authUser?.id]);

  // Puts the server's new XP total into the logged-in user so the hero pill
  // and Passport card update right away (no refresh needed).
  const applyXp = useCallback(
    (xp) => {
      if (!xp || typeof xp.total !== "number") return;
      setLiveXp(xp.total);
      // Lets the navbar or any other XP display listen in.
      window.dispatchEvent(new CustomEvent("skyrio:xp", { detail: xp }));
      if (typeof auth?.setUser === "function") {
        auth.setUser((prev) =>
          prev
            ? { ...prev, xp: xp.total, pendingXp: xp.pending ?? prev.pendingXp }
            : prev
        );
      } else if (typeof auth?.updateUser === "function") {
        auth.updateUser({ xp: xp.total, pendingXp: xp.pending });
      }
      try {
        const saved = JSON.parse(localStorage.getItem("user") || "null");
        if (saved)
          localStorage.setItem(
            "user",
            JSON.stringify({ ...saved, xp: xp.total })
          );
      } catch {
        /* storage unavailable — the context update is enough */
      }
    },
    [auth]
  );

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
        xp: liveXp ?? (authUser.xp || authUser.passport || 0),
        badge: authUser.badge || "Explorer",
      }
    : null;

  const [activeTab, setActiveTab] = useState("forYou");
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchValue, setSearchValue] = useState("");
  const [searchScope, setSearchScope] = useState("all");

  // Where you're exploring from — drives the Radar chip and the Nearby tab.
  // Kept in this browser only (a convenience, not account data).
  const [localCity, setLocalCity] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("skyhub.city") || "null");
    } catch {
      return null;
    }
  });
  const [cityPickerSignal, setCityPickerSignal] = useState(0);
  const changeCity = (c) => {
    setLocalCity(c);
    try {
      localStorage.setItem("skyhub.city", JSON.stringify(c));
    } catch {
      /* fine — it just won't be remembered */
    }
    if (c) message.success(`Exploring from ${c.label || c.name}`);
  };
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
      const res = await skyFetch("/api/skyhub/feed");
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
        const s = debouncedSearch.trim().toLowerCase();
        const inText = (post.text || "").toLowerCase().includes(s);
        const inPlace = (post.destination || "").toLowerCase().includes(s);
        const inPerson =
          (post.author || "").toLowerCase().includes(s) ||
          (post.username || "").toLowerCase().includes(s.replace(/^@?/, "@"));
        const inTags = (post.tags || [])
          .join(" ")
          .toLowerCase()
          .includes(s.replace(/^#/, ""));
        const ms =
          !s ||
          (searchScope === "places"
            ? inPlace
            : searchScope === "travelers"
            ? inPerson
            : searchScope === "tips"
            ? inText || inTags
            : inText || inPlace || inPerson || inTags);
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
            mt = localCity
              ? isNear(post.destination, localCity)
              : !!post.destination?.trim();
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
    [
      posts,
      debouncedSearch,
      searchScope,
      activeFilter,
      activeTab,
      myUsername,
      myId,
      localCity,
    ]
  );

  // Empty-state copy: invites the first post/question/etc. without
  // flagging the product itself as unfinished or in-testing.
  const EMPTY = {
    forYou: {
      icon: "globe",
      title: "No postcards yet",
      sub: "Be the first to send one: a tip, question, or story from your trip.",
      cta: "Write a postcard",
    },
    following: {
      icon: "edit",
      title: "Your posts will show up here",
      sub: "Nothing posted yet — once you share something, it'll appear in this tab.",
      cta: "Create a post",
    },
    nearby: localCity
      ? {
          icon: "pin",
          title: `Nothing near ${localCity.name} yet`,
          sub: `Know a spot in ${localCity.name}? Share it and be the local everyone follows.`,
          cta: `Post about ${localCity.name}`,
        }
      : {
          icon: "pin",
          title: "No destination posts yet",
          sub: "Be the first to tag a destination and help other travelers find it.",
          cta: "Post about a destination",
        },
    questions: {
      icon: "chat",
      title: "No questions yet",
      sub: "Ask something — your question could be the one that kicks off the conversation.",
      cta: "Ask a question",
    },
    trips: {
      icon: "plane",
      title: "No trips shared yet",
      sub: "Share a trip idea or story to get the conversation started.",
      cta: "Share a trip",
    },
  };
  const empty = EMPTY[activeTab] || EMPTY.forYou;

  const FEED_TITLES = {
    forYou: "Community postcards",
    following: "Your Posts",
    nearby: localCity ? `Near ${localCity.name}` : "Destination Posts",
    questions: "Questions",
    trips: "Trips & Stories",
  };

  /* Handlers */
  const handleCreatePost = async () => {
    if (!currentUser) {
      message.info("Log in to post on SkyHub.");
      return false;
    }
    if (!composerText.trim() && composerPhotos.length === 0) {
      message.warning("Write something or add a photo before posting.");
      return false;
    }
    try {
      setCreatingPost(true);
      let urls = [];
      if (composerPhotos.length > 0) {
        const res = await Promise.allSettled(
          composerPhotos.map(async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            // No Content-Type header here — the browser must set it for FormData.
            const r = await skyFetch("/api/uploads/image?purpose=post", {
              method: "POST",
              body: fd,
            });
            const d = await readJson(r);
            if (!r.ok) throw new Error(uploadErrorMessage(r.status, d));
            const url =
              d.url || d.secure_url || d.location || d.file?.url || d.data?.url;
            if (!url)
              throw new Error("Upload finished but no photo link came back.");
            return url;
          })
        );
        urls = res.filter((r) => r.status === "fulfilled").map((r) => r.value);
        const failures = res.filter((r) => r.status === "rejected");
        failures.forEach((f) =>
          console.error("[skyhub] photo upload failed:", f.reason)
        );

        // Every photo failed: stop here so the photos stay in the composer
        // and nothing gets posted without them.
        if (!urls.length) {
          message.error(
            failures[0]?.reason?.message || "Your photo couldn't be uploaded."
          );
          return false;
        }
        if (failures.length)
          message.warning(
            `${failures.length} photo${
              failures.length > 1 ? "s" : ""
            } failed to upload: ${
              failures[0].reason?.message || "unknown error"
            }`
          );
      }
      const res = await skyFetch("/api/skyhub/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: composerText.trim(),
          type: activePostType,
          destination: destination.trim(),
          images: urls,
          image: urls[0] || "",
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.message || "Failed to create post");
      // Use the photos the server actually saved, so what you see now is
      // what everyone sees after a refresh.
      if (urls.length && !(data.post.images || []).length) {
        message.warning("Your photo didn't save with the post.");
      }
      const enriched = {
        ...data.post,
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
      applyXp(data.xp);
      if (data.xp?.awarded && data.xp.amount > 0) {
        message.success(`Postcard sent! +${data.xp.amount} XP`);
      } else {
        message.success("Postcard sent!");
        const why = XP_REASONS[data.xp?.reason];
        if (why) message.info(why, 4);
        if (data.xp?.reason)
          console.info("[skyhub] post earned no XP:", data.xp.reason);
      }
      if (data.xp?.rankUp) {
        const rank =
          data.xp.rankUp.name || data.xp.rankUp.label || data.xp.rankUp;
        message.success(`New rank unlocked: ${rank} 🎉`, 4);
      }
      return true;
    } catch (err) {
      message.error(err.message || "Could not create post.");
      return false;
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (id) => {
    try {
      if (!currentUser) return message.info("Log in to like posts.");
      const res = await skyFetch(`/api/skyhub/posts/${id}/like`, {
        method: "POST",
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
      if (!currentUser) return message.info("Log in to save posts.");
      const res = await skyFetch(`/api/skyhub/posts/${id}/save`, {
        method: "POST",
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

  // ── Edit ──
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const handleEditPost = (post) => {
    setEditText(post.text || "");
    setEditDestination(post.destination || "");
    setEditingPost(post);
  };
  const saveEdit = async () => {
    if (!editingPost) return;
    const hasPhotos = (editingPost.images || []).length > 0;
    if (!editText.trim() && !hasPhotos) {
      message.warning("A post needs text or a photo.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await skyFetch(`/api/skyhub/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editText.trim(),
          destination: editDestination.trim(),
        }),
      });
      const data = await readJson(res);
      if (!res.ok)
        throw new Error(data?.message || "Couldn't save your changes.");
      const updated = mapBackendPost({
        ...data.post,
        authorName: data.post.authorName || editingPost.author,
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, ...updated } : p))
      );
      setEditingPost(null);
      message.success("Post updated.");
    } catch (err) {
      message.error(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = (id) =>
    Modal.confirm({
      className: "skyhub-modal",
      title: "Delete this post?",
      content: "It and its comments will be removed for everyone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await skyFetch(`/api/skyhub/posts/${id}`, {
            method: "DELETE",
          });
          const data = await readJson(res);
          if (!res.ok)
            throw new Error(data?.message || "Couldn't delete the post.");
          setPosts((prev) => prev.filter((p) => p.id !== id));
          applyXp(data.xp);
          message.success("Post deleted.");
        } catch (err) {
          message.error(err.message);
        }
      },
    });

  const handleOpenComments = (post) => {
    setActiveCommentPost(post);
    setCommentDrawerOpen(true);
  };

  // Report: pick a reason first, so the team knows what to look for.
  const [reportPost, setReportPost] = useState(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const handleReportPost = (post) => {
    if (!currentUser) return message.info("Log in to report posts.");
    setReportReason("spam");
    setReportDetails("");
    setReportPost(post);
  };
  const submitReport = async () => {
    if (!reportPost) return;
    setReportSending(true);
    try {
      const res = await skyFetch(`/api/skyhub/posts/${reportPost.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not report post.");
      message.success(
        data.message || "Thanks for reporting. Our team will review it."
      );
      setReportPost(null);
    } catch (err) {
      message.error(err.message);
    } finally {
      setReportSending(false);
    }
  };

  // Block: you won't see each other's posts or comments anymore.
  const handleBlockUser = (post) => {
    if (!currentUser) return message.info("Log in to block travelers.");
    if (!post.authorId) return;
    Modal.confirm({
      className: "skyhub-modal",
      title: `Block ${post.author}?`,
      content:
        "You won't see each other's posts or comments on SkyHub, and you'll both be unfollowed. They won't be told. You can unblock anytime.",
      okText: "Block",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await skyFetch(
            `/api/skyhub/users/${post.authorId}/block`,
            { method: "POST" }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data?.message || "Couldn't block this traveler.");
          setPosts((prev) =>
            prev.filter((p) => String(p.authorId) !== String(post.authorId))
          );
          message.success(`${post.author} is blocked.`);
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const refreshPostComments = (id, count) =>
    setPosts((p) =>
      p.map((x) =>
        x.id === id
          ? { ...x, comments: typeof count === "number" ? count : x.comments }
          : x
      )
    );

  const focusComposer = () => {
    const composer = document.getElementById("skyhub-composer");
    composer?.scrollIntoView({ behavior: "smooth", block: "center" });
    composer?.querySelector("textarea")?.focus({ preventScroll: true });
  };

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
    <div className="skyhub-page sh-postcards">
      {/* ══ HERO — slim banner, not a full-screen splash ══ */}
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
                  marginBottom: 12,
                  padding: "6px 12px 6px 6px",
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
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background:
                        "linear-gradient(135deg,var(--sh-orange),#9333ea)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 11,
                      color: "#fff",
                    }}
                  >
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1.2,
                    }}
                  >
                    {currentUser.name.split(" ")[0]}
                  </div>
                  <div
                    style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}
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

            <div className="skyhub-eyebrow">
              SkyHub · Postcards from the road
            </div>
            <h1 className="skyhub-pageTitle">
              Your trip, sent as a{" "}
              <span className="shPC-accent">postcard.</span>
            </h1>
            <p className="skyhub-pageSubtitle">
              Share where you are, what you found, and what you&rsquo;d tell a
              friend. Every post lands in the SkyHub mailbag for other
              travelers.
            </p>
            <button type="button" className="shPC-cta" onClick={focusComposer}>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 2 11 13" />
                <path d="m22 2-7 20-4-9-9-4z" />
              </svg>
              {posts.length ? "Send a postcard" : "Send the first postcard"}
            </button>
            {/* Bullet list (Trending conversations / Destination discovery /
                Real traveler questions) removed — decorative, added height
                without helping a first-time visitor act. */}
          </div>

          <div className="skyhub-headerActions">
            <SkyHubSearch
              value={searchValue}
              onChange={setSearchValue}
              scope={searchScope}
              onScopeChange={setSearchScope}
              onSubmit={() => {
                setDebouncedSearch(searchValue);
                setTimeout(scrollToFeed, 60);
              }}
              posts={posts}
              trending={trendingDestinations}
              resultCount={debouncedSearch ? visiblePosts.length : undefined}
              city={localCity}
              onCityClick={() => setCityPickerSignal((n) => n + 1)}
            />
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

            <SkyHubLocalBanner
              city={localCity}
              onCityChange={(c) => {
                changeCity(c);
                setActiveTab("nearby");
                setActiveFilter("All");
              }}
              suggestions={trendingDestinations.map((t) => t.name)}
              openSignal={cityPickerSignal}
            />

            <SkyHubStanding signedIn={!!currentUser} />

            <div className="shPC-postcard">
              <div className="shPC-postcardHead">
                <span className="shPC-label">
                  Postcard
                  {currentUser ? ` · from @${currentUser.username}` : ""}
                </span>
                <span className="shPC-stamp" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2 11 13" />
                    <path d="m22 2-7 20-4-9-9-4z" />
                  </svg>
                </span>
              </div>
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
            </div>

            <section className="skyhub-feedSection">
              <div className="skyhub-feedSectionHeader">
                <div>
                  <h2 className="skyhub-sectionTitle">
                    {FEED_TITLES[activeTab] || "Community postcards"}
                  </h2>
                  <p className="skyhub-sectionSubtext">
                    {debouncedSearch
                      ? `${visiblePosts.length} result${
                          visiblePosts.length !== 1 ? "s" : ""
                        } for "${debouncedSearch}"`
                      : "Postcards from travelers: real tips, stories and questions."}{" "}
                    <a
                      href="/skyhub/guidelines"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/skyhub/guidelines");
                      }}
                      style={{
                        color: "var(--sh-orange2, #ff9555)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Community guidelines
                    </a>
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
                      onEditPost={handleEditPost}
                      onDeletePost={handleDeletePost}
                      onBlockUser={handleBlockUser}
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
                    <Button
                      type="primary"
                      onClick={focusComposer}
                      style={{ marginTop: 16 }}
                    >
                      {empty.cta}
                    </Button>
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

      <Modal
        open={!!editingPost}
        title="Edit post"
        className="skyhub-modal"
        onCancel={() => setEditingPost(null)}
        onOk={saveEdit}
        okText="Save"
        okButtonProps={{ loading: savingEdit }}
        destroyOnClose
      >
        <Input.TextArea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={1200}
          showCount
          autoSize={{ minRows: 4, maxRows: 10 }}
          placeholder="What do you want to say?"
          aria-label="Post text"
        />
        <Input
          value={editDestination}
          onChange={(e) => setEditDestination(e.target.value)}
          maxLength={120}
          prefix={<EnvironmentOutlined style={{ color: "#ff8a2a" }} />}
          placeholder="Destination or city"
          aria-label="Destination"
          style={{ marginTop: 16 }}
        />
        {(editingPost?.images || []).length > 0 && (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: 12,
              opacity: 0.6,
            }}
          >
            Photos can't be changed after posting.
          </p>
        )}
      </Modal>

      <Modal
        open={!!reportPost}
        title="Report this post"
        className="skyhub-modal"
        onCancel={() => setReportPost(null)}
        onOk={submitReport}
        okText="Send report"
        okButtonProps={{ loading: reportSending, danger: true }}
        destroyOnClose
      >
        <p style={{ marginBottom: 12, opacity: 0.75 }}>
          What's wrong with it? Reports are anonymous — the person won't know it
          was you.
        </p>
        <Radio.Group
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {REPORT_REASONS.map((r) => (
            <Radio key={r.value} value={r.value}>
              {r.label}
              {r.urgent && (
                <span className="shReport__urgent">Hidden right away</span>
              )}
            </Radio>
          ))}
        </Radio.Group>
        {REASON_HINTS[reportReason] && (
          <div className="shReport__hint">{REASON_HINTS[reportReason]}</div>
        )}
        <Input.TextArea
          id="skyhub-report-details"
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Anything else we should know? (optional)"
          style={{ marginTop: 14 }}
        />
      </Modal>

      <SkyHubCommentDrawer
        open={commentDrawerOpen}
        onClose={() => setCommentDrawerOpen(false)}
        post={activeCommentPost}
        refreshPostComments={refreshPostComments}
      />
    </div>
  );
}
