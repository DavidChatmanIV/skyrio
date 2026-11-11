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
import SkyHubPhotoViewer from "./SkyHubPhotoViewer";
import SkyHubStanding from "./SkyHubStanding";
import { SkyHubJoinModal, SkyHubJoinCard } from "./SkyHubJoinPrompt";
import { apiUrl } from "@/lib/api";
import { AuthContext } from "@/context/AuthContext";
import { getAdminToken, adminTokenHeader } from "@/lib/adminAuth";

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
  if (status === 429) return "Too many uploads. Wait a minute.";
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
      <a
        href="/skyhub/report-content?kind=intimate"
        style={{ color: "#ff9555" }}
      >
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
  too_short: "No XP yet. Write a bit more or add a photo.",
  daily_cap: "Daily post XP reached. It resets tomorrow.",
  cap: "Daily post XP reached. It resets tomorrow.",
  cap_reached: "Daily post XP reached. It resets tomorrow.",
  duplicate: "You already earned XP for this post.",
  already_awarded: "You already earned XP for this post.",
};

// Backup for the Nearby tab, used only if the server's map search can't
// run (e.g. it couldn't find your city). Matches the city name, or its
// state/region ("Newark, NJ" counts as near "Orange, NJ").
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

// How far the Nearby tab looks around your city.
const NEARBY_MILES = 25;

// null/""/undefined → NaN, so a missing coordinate never becomes 0.
const num = (v) =>
  v === null || v === undefined || v === "" ? NaN : Number(v);

// The server request for the Nearby tab: exact coordinates if the city
// picker saved them, plus the place name so the server can look it up
// on the map when it has no coordinates.
function nearbyUrl(city) {
  if (!city?.name) return null;
  const params = new URLSearchParams({
    scope: "nearby",
    miles: String(NEARBY_MILES),
  });
  const lat = num(city.lat ?? city.latitude);
  const lng = num(city.lng ?? city.lon ?? city.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }
  const place = [
    city.name,
    city.regionCode || city.region,
    city.countryCode || city.country,
  ]
    .filter(Boolean)
    .join(", ");
  params.set("place", place);
  return `/api/skyhub/feed?${params.toString()}`;
}

// Topics you can put on a postcard — the TOPIC filter chips minus "All",
// so every filter matches something a traveler can actually choose.
const postTopics = skyhubFilters.filter(
  (f) => f !== "All" && f !== "Team Travel"
);

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
    avatar: photoUrl(post.avatar) || null,
    verified: !!post.verified,
    badge: post.authorBadge || "Explorer",
    type: post.type || "Story",
    // One of the TOPIC chips (Budget, Food, ...) chosen on the postcard
    topic: post.topic || "",
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
    following: !!post.viewerFollowsAuthor,
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
        // Profile photos saved on our server come back as "/uploads/...":
        // point them at the API, or the post box shows a broken image.
        avatar:
          photoUrl(
            authUser.avatar ||
              authUser.profilePicture ||
              authUser.profileImage ||
              ""
          ) || null,
        xp: liveXp ?? (authUser.xp || authUser.passport || 0),
        // Rank from lifetime XP, computed by the server (User.getXPLevel)
        badge: authUser.levelLabel || authUser.badge || "Explorer",
      }
    : null;

  // Logged-out visitors can read everything; any action opens a
  // "create a profile" prompt that brings them back to SkyHub.
  const [joinAction, setJoinAction] = useState(null);
  const askToJoin = (action) => setJoinAction(action);

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
  // Nearby tab: "local" = near your city, "global" = every post that names a place
  const [nearbyScope, setNearbyScope] = useState("local");
  const nearbyLocal = !!localCity && nearbyScope === "local";
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
  // Optional topic picked on the postcard — same list as the TOPIC filter
  const [postTopic, setPostTopic] = useState("");
  // Browsing Food? A new postcard starts tagged Food (still changeable).
  useEffect(() => {
    if (!composerText.trim()) {
      setPostTopic(activeFilter === "All" ? "" : activeFilter);
    }
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // ── Following tab: posts from people you follow (fetched on demand) ──
  const [followingPosts, setFollowingPosts] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const fetchFollowingFeed = useCallback(async () => {
    try {
      setLoadingFollowing(true);
      const res = await skyFetch("/api/skyhub/feed?scope=following");
      const data = await readJson(res);
      if (!res.ok)
        throw new Error(data?.message || "Couldn't load posts you follow.");
      setFollowingPosts(
        Array.isArray(data.posts) ? data.posts.map(mapBackendPost) : []
      );
    } catch (err) {
      message.error(err.message || "Couldn't load posts you follow.");
    } finally {
      setLoadingFollowing(false);
    }
  }, []);
  useEffect(() => {
    if (activeTab === "following" && authUser) fetchFollowingFeed();
  }, [activeTab, authUser, fetchFollowingFeed]);

  // ── Nearby tab: the server finds posts within NEARBY_MILES of your city ──
  // If that search can't run (city not found on the map), we fall back to
  // matching the city/state name in each post's destination.
  const [nearbyPosts, setNearbyPosts] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyFailed, setNearbyFailed] = useState(false);
  const nearbyPath = useMemo(() => nearbyUrl(localCity), [localCity]);
  const fetchNearbyFeed = useCallback(async () => {
    if (!nearbyPath) return;
    try {
      setLoadingNearby(true);
      const res = await skyFetch(nearbyPath);
      const data = await readJson(res);
      if (!res.ok || data?.needsLocation)
        throw new Error(data?.message || "Couldn't find that city on the map.");
      setNearbyPosts(
        Array.isArray(data.posts) ? data.posts.map(mapBackendPost) : []
      );
      setNearbyFailed(false);
    } catch (err) {
      console.warn("[skyhub] nearby map search unavailable:", err.message);
      setNearbyFailed(true);
    } finally {
      setLoadingNearby(false);
    }
  }, [nearbyPath]);
  useEffect(() => {
    if (activeTab === "nearby" && nearbyLocal) fetchNearbyFeed();
  }, [activeTab, nearbyLocal, fetchNearbyFeed]);

  // Applies the same change to every list a post can be in (main feed,
  // Following, Nearby), so a like or delete shows up on whichever tab you're on.
  const updateEverywhere = useCallback((fn) => {
    setPosts(fn);
    setFollowingPosts(fn);
    setNearbyPosts(fn);
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      setLoadingFeed(true);
      const res = await skyFetch("/api/skyhub/feed");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Couldn't load SkyHub.");
      setPosts(Array.isArray(data.posts) ? data.posts.map(mapBackendPost) : []);
    } catch (err) {
      message.error(
        err.message || "Couldn't load SkyHub. Refresh to try again."
      );
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Full lists; the sidebar shows the top few and "See all" opens the rest
  // right there (there's no separate destinations/travelers page).
  const trendingDestinations = useMemo(() => deriveTrending(posts), [posts]);
  const activeTravelers = useMemo(() => deriveActiveTravelers(posts), [posts]);
  const [showAllDest, setShowAllDest] = useState(false);
  const [showAllTravelers, setShowAllTravelers] = useState(false);
  const trendingTags = useMemo(() => deriveTrendingTags(posts), [posts]);

  // Counts what's actually in the feed. "places" is the number of different
  // destinations people named (not countries — "Orange, NJ" and "Newark"
  // are two places in one country).
  const liveStats = useMemo(() => {
    if (!posts.length) return null;
    const authors = new Set(
      posts.map((p) => p.authorId || p.username).filter(Boolean)
    );
    const places = new Set(
      posts.map((p) => p.destination?.trim().toLowerCase()).filter(Boolean)
    );
    return {
      travelers: authors.size,
      posts: posts.length,
      places: places.size,
    };
  }, [posts]);

  const myUsername = currentUser?.username?.toLowerCase();
  const myId = currentUser?.id;

  // Which list the current tab reads from.
  const useNearbyList = activeTab === "nearby" && nearbyLocal && !nearbyFailed;
  const sourcePosts =
    activeTab === "following"
      ? followingPosts
      : useNearbyList
      ? nearbyPosts
      : posts;

  const visiblePosts = useMemo(
    () =>
      sourcePosts.filter((post) => {
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
          (post.topic || "").toLowerCase() === activeFilter.toLowerCase() ||
          (post.tags || []).some(
            (t) => t.toLowerCase() === activeFilter.toLowerCase()
          ) ||
          (post.type || "").toLowerCase() === activeFilter.toLowerCase();
        let mt = true;
        switch (activeTab) {
          case "following":
            // Already narrowed by the server (?scope=following)
            mt = true;
            break;
          case "mine":
            mt =
              (post.username || "").replace("@", "").toLowerCase() ===
                myUsername ||
              (post.authorId && String(post.authorId) === String(myId)) ||
              (post.username || "").replace("@", "").toLowerCase() === "you";
            break;
          case "nearby":
            mt = !nearbyLocal
              ? !!post.destination?.trim()
              : useNearbyList
              ? true // already narrowed by the server's map search
              : isNear(post.destination, localCity);
            break;
          case "questions":
            mt = post.type === "Question";
            break;
          case "trips":
            // "Join Trip" is no longer offered on the postcard; older
            // Join Trip posts still show here.
            mt = post.type === "Join Trip" || post.type === "Story";
            break;
          default:
            mt = true;
        }
        return ms && mf && mt;
      }),
    [
      sourcePosts,
      debouncedSearch,
      searchScope,
      activeFilter,
      activeTab,
      nearbyLocal,
      useNearbyList,
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
      title: "No posts yet",
      sub: "Share a tip, a question or a trip story.",
      cta: "Write the first post",
    },
    following: {
      icon: "globe",
      title: currentUser
        ? "You're not following anyone yet"
        : "Log in to see who you follow",
      sub: currentUser
        ? "Tap Follow on a post. Their new posts land here."
        : "Follow travelers to see their posts here.",
      cta: "Browse all posts",
    },
    mine: {
      icon: "edit",
      title: "You haven't posted yet",
      sub: "Your posts will show up here.",
      cta: "Write a post",
    },
    nearby: nearbyLocal
      ? {
          icon: "pin",
          title: `Nothing near ${localCity.name} yet`,
          sub: `Know a spot near ${localCity.name}? Post it and add the place.`,
          cta: `Post about ${localCity.name}`,
        }
      : {
          icon: "globe",
          title: "No place-tagged posts yet",
          sub: "Add a place when you post and it shows up here.",
          cta: "Post about a place",
        },
    questions: {
      icon: "chat",
      title: "No questions yet",
      sub: "Ask one. Other travelers can answer.",
      cta: "Ask a question",
    },
    trips: {
      icon: "plane",
      title: "No trips shared yet",
      sub: "Pick Story on the postcard to share one.",
      cta: "Share a trip",
    },
  };
  const empty = EMPTY[activeTab] || EMPTY.forYou;

  // One plain sentence per tab: what you're looking at.
  const TAB_HINTS = {
    forYou: "Newest posts first.",
    following: "New posts from travelers you follow.",
    mine: "Only the posts you've shared.",
    nearby: nearbyLocal
      ? useNearbyList
        ? `Posts about places within ${NEARBY_MILES} miles of ${localCity.name}.`
        : `Posts about places in or around ${localCity.name}.`
      : localCity
      ? "Posts from around the world."
      : "Posts from around the world. Pick your city to see what's near you.",
    questions: "Questions from travelers. Reply to help.",
    trips: "Stories from travelers' trips.",
  };

  const FEED_TITLES = {
    forYou: "Latest posts",
    following: "Following",
    mine: "Your posts",
    nearby: nearbyLocal ? `Near ${localCity.name}` : "Around the world",
    questions: "Questions",
    trips: "Trips & stories",
  };

  /* Handlers */
  const handleCreatePost = async () => {
    if (!currentUser) {
      askToJoin("post on SkyHub");
      return false;
    }
    if (!composerText.trim() && composerPhotos.length === 0) {
      message.warning("Add text or a photo first.");
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
          topic: postTopic || undefined,
          tags: postTopic ? [postTopic] : [],
          destination: destination.trim(),
          images: urls,
          image: urls[0] || "",
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.message || "Couldn't create post. Try again.");
      // Use the photos the server actually saved, so what you see now is
      // what everyone sees after a refresh.
      if (urls.length && !(data.post.images || []).length) {
        message.warning("Your photo didn't save with the post.");
      }
      const enriched = {
        ...data.post,
        // Keep the topic even if the server doesn't echo it back yet
        topic: data.post.topic || postTopic,
        authorName: currentUser?.name || data.post.authorName,
        username: currentUser?.username || data.post.username,
        avatar: currentUser?.avatar || photoUrl(data.post.avatar),
        authorId: currentUser?.id || data.post.authorId,
      };
      setPosts((prev) => [mapBackendPost(enriched), ...prev]);
      // On the Nearby tab, ask the server again so the new post shows up
      // there only if it's actually near your city.
      if (activeTab === "nearby" && nearbyLocal) fetchNearbyFeed();
      setComposerText("");
      setDestination("");
      setActivePostType("Tip");
      setPostTopic("");
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
        message.success(`New rank unlocked: ${rank}`, 4);
      }
      return true;
    } catch (err) {
      message.error(err.message || "Couldn't create post. Try again.");
      return false;
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (id) => {
    try {
      if (!currentUser) return askToJoin("like posts");
      const res = await skyFetch(`/api/skyhub/posts/${id}/like`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      updateEverywhere((p) =>
        p.map((x) =>
          x.id === id
            ? { ...x, liked: !!data.liked, likes: data.likesCount ?? x.likes }
            : x
        )
      );
    } catch (err) {
      message.error(err.message || "Couldn't update like. Try again.");
    }
  };

  const handleToggleFollow = async (post) => {
    if (!currentUser) return askToJoin("follow travelers");
    if (!post?.authorId) return;
    const authorId = String(post.authorId);
    try {
      const res = await skyFetch(`/api/skyhub/users/${authorId}/follow`, {
        method: "POST",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.message || "Couldn't update follow.");
      const nowFollowing = !!data.following;
      const mark = (list) =>
        list.map((p) =>
          String(p.authorId) === authorId
            ? { ...p, following: nowFollowing }
            : p
        );
      setPosts(mark);
      setNearbyPosts(mark);
      setFollowingPosts((list) =>
        nowFollowing
          ? mark(list)
          : list.filter((p) => String(p.authorId) !== authorId)
      );
      message.success(
        nowFollowing
          ? `You're following ${post.author}.`
          : `Unfollowed ${post.author}.`
      );
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleToggleSave = async (id) => {
    try {
      if (!currentUser) return askToJoin("save posts");
      const res = await skyFetch(`/api/skyhub/posts/${id}/save`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      updateEverywhere((p) =>
        p.map((x) =>
          x.id === id
            ? { ...x, saved: !!data.saved, saves: data.savesCount ?? x.saves }
            : x
        )
      );
      message.success(data.saved ? "Saved." : "Removed from saved.");
    } catch (err) {
      message.error(err.message || "Couldn't save the post. Try again.");
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
      const placeChanged =
        editDestination.trim() !== (editingPost.destination || "").trim();
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
      updateEverywhere((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, ...updated } : p))
      );
      // A new place can move the post in or out of Nearby.
      if (placeChanged && activeTab === "nearby" && nearbyLocal)
        fetchNearbyFeed();
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
          updateEverywhere((prev) => prev.filter((p) => p.id !== id));
          applyXp(data.xp);
          message.success("Post deleted.");
        } catch (err) {
          message.error(err.message);
        }
      },
    });

  // Admin: take down any post from the feed. Logged in at /admin/login
  // on this browser = the option shows in each post's menu.
  const isAdminHere = !!getAdminToken();
  const [adminPost, setAdminPost] = useState(null);
  const [adminReason, setAdminReason] = useState("spam");
  const [adminStrike, setAdminStrike] = useState(false);
  const [adminSending, setAdminSending] = useState(false);
  const openAdminRemove = (post) => {
    setAdminReason("spam");
    setAdminStrike(false);
    setAdminPost(post);
  };
  const submitAdminRemove = async () => {
    if (!adminPost) return;
    setAdminSending(true);
    try {
      const res = await skyFetch("/api/skyhub/admin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminTokenHeader() },
        body: JSON.stringify({
          targetType: "post",
          targetId: adminPost.id,
          action: adminStrike ? "strike" : "remove",
          reason: adminReason,
          fromFeed: true,
        }),
      });
      const data = await readJson(res);
      if (res.status === 403)
        throw new Error("Couldn't remove it. Log in at /admin/login first.");
      if (!res.ok)
        throw new Error(data?.message || "Couldn't remove the post. Try again.");
      const id = adminPost.id;
      updateEverywhere((prev) => prev.filter((p) => p.id !== id));
      setAdminPost(null);
      message.success(adminStrike ? "Post removed and strike given." : "Post removed.");
    } catch (err) {
      message.error(err.message);
    } finally {
      setAdminSending(false);
    }
  };

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
    if (!currentUser) return askToJoin("report posts");
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
      if (!res.ok) throw new Error(data?.message || "Couldn't report post. Try again.");
      message.success(data.message || "Thanks. We'll review it.");
      setReportPost(null);
    } catch (err) {
      message.error(err.message);
    } finally {
      setReportSending(false);
    }
  };

  // Block: you won't see each other's posts or comments anymore.
  const handleBlockUser = (post) => {
    if (!currentUser) return askToJoin("block travelers");
    if (!post.authorId) return;
    Modal.confirm({
      className: "skyhub-modal",
      title: `Block ${post.author}?`,
      content:
        "You'll stop seeing each other's posts and comments and unfollow each other. They won't be told. Unblock anytime.",
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
          updateEverywhere((prev) =>
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
    updateEverywhere((p) =>
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

  // "Send a postcard" buttons: logged-out visitors get the sign-up prompt
  const startPost = () =>
    currentUser ? focusComposer() : askToJoin("send a postcard");

  const scrollToFeed = () =>
    document
      .querySelector(".skyhub-feedSection")
      ?.scrollIntoView({ behavior: "smooth" });

  const currentUserId = currentUser
    ? `${currentUser.id || ""}|${currentUser.username || ""}`
    : null;

  const feedLoading =
    loadingFeed ||
    (activeTab === "following" && loadingFollowing) ||
    (useNearbyList && loadingNearby);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="skyhub-page sh-postcards">
      {/* ══ HERO — slim banner, not a full-screen splash ══ */}
      <header className="skyhub-topHeader">
        <div className="skyhub-topHeaderOverlay" />
        <div className="skyhub-topHeaderInner">
          <div className="skyhub-heroCopy">
            <div className="skyhub-eyebrow">
              SkyHub · Postcards from the road
            </div>
            <h1 className="skyhub-pageTitle">
              Your trip, sent as a{" "}
              <span className="shPC-accent">postcard.</span>
            </h1>
            <p className="skyhub-pageSubtitle">
              Tips, photos and questions from Skyrio travelers.
            </p>
            {/* Guests: say plainly what they can and can't do here. */}
            {!currentUser && (
              <div
                role="note"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  maxWidth: 560,
                  margin: "0 0 16px",
                  padding: "12px 14px",
                  borderRadius: 14,
                  textAlign: "left",
                  background: "rgba(124,92,252,0.18)",
                  border: "1px solid rgba(167,139,250,0.45)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c4b5fd"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0, marginTop: 2 }}
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>
                  <b style={{ color: "#fff" }}>Browsing as a guest.</b>{" "}
                  <a
                    href="/register?from=skyhub"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/register?from=skyhub");
                    }}
                    style={{ color: "#ffb347", fontWeight: 700 }}
                  >
                    Sign up free
                  </a>{" "}
                  or{" "}
                  <a
                    href="/login"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/login");
                    }}
                    style={{ color: "#ffb347", fontWeight: 700 }}
                  >
                    log in
                  </a>{" "}
                  to post, like and comment.
                </span>
              </div>
            )}
            <button type="button" className="shPC-cta" onClick={startPost}>
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
              {!currentUser
                ? "Sign up to post"
                : posts.length
                ? "Send a postcard"
                : "Send the first postcard"}
            </button>
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
          <div
            className="skyhub-navbar-vibes shPC-topicBar"
            style={{ flexWrap: "nowrap" }}
          >
            <span className="shPC-chipsLabel">Topic</span>
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
            <SkyHubLocalBanner
              city={localCity}
              onCityChange={(c) => {
                changeCity(c);
                setNearbyScope("local");
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
              <p className="shPC-helper">
                Share a tip, question, or story about a place.
              </p>
              {currentUser ? (
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
                  topic={postTopic}
                  setTopic={setPostTopic}
                  topics={postTopics}
                />
              ) : (
                <SkyHubJoinCard />
              )}
            </div>

            <section className="skyhub-feedSection">
              <div className="skyhub-feedSectionHeader">
                <div>
                  <h2 className="skyhub-sectionTitle">
                    {FEED_TITLES[activeTab] || "Latest posts"}
                  </h2>
                  <p className="skyhub-sectionSubtext">
                    {debouncedSearch
                      ? `${visiblePosts.length} result${
                          visiblePosts.length !== 1 ? "s" : ""
                        } for "${debouncedSearch}"`
                      : TAB_HINTS[activeTab] || TAB_HINTS.forYou}{" "}
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
                  {activeTab === "nearby" && (
                    <div
                      className="shPC-scope"
                      role="group"
                      aria-label="Show posts from"
                    >
                      <button
                        type="button"
                        className={`shPC-scope__btn${
                          nearbyLocal ? " is-on" : ""
                        }`}
                        aria-pressed={nearbyLocal}
                        onClick={() =>
                          localCity
                            ? setNearbyScope("local")
                            : setCityPickerSignal((n) => n + 1)
                        }
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        {localCity
                          ? `Near ${localCity.name}`
                          : "Pick your city"}
                      </button>
                      <button
                        type="button"
                        className={`shPC-scope__btn${
                          !nearbyLocal ? " is-on" : ""
                        }`}
                        aria-pressed={!nearbyLocal}
                        onClick={() => setNearbyScope("global")}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                        </svg>
                        Everywhere
                      </button>
                    </div>
                  )}
                </div>
                <Badge
                  count={visiblePosts.length}
                  style={{ backgroundColor: "var(--sh-orange)" }}
                />
              </div>

              <div className="skyhub-feedList">
                {feedLoading ? (
                  <div className="skyhub-emptyState">
                    <div
                      style={{
                        marginBottom: 12,
                        color: "rgba(240,236,255,0.2)",
                      }}
                    >
                      <EmptyIcon type="plane" />
                    </div>
                    <h3>Loading SkyHub…</h3>
                    <p>Getting the latest posts.</p>
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
                      onAdminRemove={isAdminHere ? openAdminRemove : undefined}
                      onToggleFollow={handleToggleFollow}
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
                      onClick={
                        activeTab === "following"
                          ? () => setActiveTab("forYou")
                          : startPost
                      }
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
            {/* Kept short: trending places + who's active. (Your Passport
                is in the navbar; guests still see the sign-up card.) */}
            {!currentUser && <SkyHubPassportCard currentUser={currentUser} />}

            <SkyHubTrendingDestinations
              items={
                showAllDest
                  ? trendingDestinations
                  : trendingDestinations.slice(0, 5)
              }
              total={trendingDestinations.length}
              expanded={showAllDest}
              loading={loadingFeed}
              onSeeAll={() => setShowAllDest((v) => !v)}
              onPick={(place) => {
                // Show that place's posts in the feed.
                setSearchScope("places");
                setSearchValue(place);
                setDebouncedSearch(place);
                setTimeout(scrollToFeed, 60);
              }}
            />

            <SkyHubActiveTravelers
              travelers={
                showAllTravelers ? activeTravelers : activeTravelers.slice(0, 6)
              }
              total={activeTravelers.length}
              expanded={showAllTravelers}
              loading={loadingFeed}
              onViewAll={() => setShowAllTravelers((v) => !v)}
              onPick={(t) =>
                navigate(`/u/${encodeURIComponent(t.username)}`, {
                  // Lets the Passport page offer "Back to SkyHub".
                  state: { from: "/skyhub", fromLabel: "SkyHub" },
                })
              }
            />
          </aside>
        </section>
      </main>

      {/* Click any post photo to see it full-size (desktop and phone). */}
      <SkyHubPhotoViewer />

      <Modal
        open={!!editingPost}
        title="Edit post"
        className="skyhub-modal"
        onCancel={() => setEditingPost(null)}
        onOk={saveEdit}
        okText="Save"
        okButtonProps={{ loading: savingEdit }}
        destroyOnHidden
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
        okButtonProps={{ loading: reportSending }}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12, opacity: 0.75 }}>
          What's wrong? Reports are anonymous.
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

      <Modal
        open={!!adminPost}
        title="Remove this post?"
        className="skyhub-modal"
        onCancel={() => setAdminPost(null)}
        onOk={submitAdminRemove}
        okText={adminStrike ? "Remove and give strike" : "Remove post"}
        okButtonProps={{ danger: true, loading: adminSending }}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12, opacity: 0.75 }}>
          It's hidden from SkyHub right away. The author is told which
          guideline it broke. You can restore it under Actioned on the admin SkyHub page.
        </p>
        <Radio.Group
          value={adminReason}
          onChange={(e) => setAdminReason(e.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {REPORT_REASONS.filter((r) => r.value !== "child_safety").map((r) => (
            <Radio key={r.value} value={r.value}>
              {r.label}
            </Radio>
          ))}
        </Radio.Group>
        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
          Child safety: use Report instead, so it goes through the child
          safety review on the admin page.
        </p>
        <label
          style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}
        >
          <input
            type="checkbox"
            checked={adminStrike}
            onChange={(e) => setAdminStrike(e.target.checked)}
          />
          Also give the author a strike
        </label>
      </Modal>

      <SkyHubJoinModal
        action={joinAction}
        onClose={() => setJoinAction(null)}
      />

      <SkyHubCommentDrawer
        open={commentDrawerOpen}
        onClose={() => setCommentDrawerOpen(false)}
        post={activeCommentPost}
        refreshPostComments={refreshPostComments}
        onNeedAccount={askToJoin}
      />
    </div>
  );
}
