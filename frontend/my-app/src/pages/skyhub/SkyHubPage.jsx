import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
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
import { useContext } from "react";

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

// ── Map backend post shape ─────────────────────────────────────
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

// ── Derive trending destinations from feed posts ───────────────
// No backend endpoint needed — computed from what we already have.
function deriveTrending(posts) {
  const counts = {};
  posts.forEach((p) => {
    if (!p.destination) return;
    counts[p.destination] = (counts[p.destination] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, posts]) => ({ name, posts }));
}

// ── Derive active travelers from feed posts ────────────────────
// Uses the most recent posters as a proxy for "active".
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

  // Search debounce — avoids re-filtering on every keystroke
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(searchValue),
      250
    );
    return () => clearTimeout(debounceRef.current);
  }, [searchValue]);

  // ── Fetch feed ────────────────────────────────────────────────
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

  // ── Derived sidebar data — no extra API calls ─────────────────
  const trendingDestinations = useMemo(() => deriveTrending(posts), [posts]);
  const activeTravelers = useMemo(() => deriveActiveTravelers(posts), [posts]);

  // ── Derived stats — computed from real feed data ───────────────
  const liveStats = useMemo(() => {
    if (!posts.length) return null;
    const uniqueAuthors = new Set(
      posts.map((p) => p.authorId || p.username).filter(Boolean)
    );
    const uniqueCountries = new Set(
      posts.map((p) => p.destination).filter(Boolean)
    );
    return {
      travelers: uniqueAuthors.size,
      posts: posts.length,
      countries: uniqueCountries.size,
    };
  }, [posts]);

  // ── Tab-aware filtering ───────────────────────────────────────
  // "following" → current user's own posts
  // "nearby"    → posts that have a destination set
  // "questions" → Question type only
  // "trips"     → Join Trip or Story
  // "forYou"    → everything
  const visiblePosts = useMemo(() => {
    const myUsername = currentUser?.username?.toLowerCase();
    const myId = currentUser?.id;

    return posts.filter((post) => {
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
          // Show own posts — closest we can do without a follow system
          mt =
            (post.username || "").replace("@", "").toLowerCase() ===
              myUsername ||
            (post.authorId && String(post.authorId) === String(myId)) ||
            (post.username || "").replace("@", "").toLowerCase() === "you";
          break;
        case "nearby":
          // Posts that have a destination set
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
    });
  }, [posts, debouncedSearch, activeFilter, activeTab, currentUser]);

  // ── Tab-specific empty state messages ─────────────────────────
  const emptyMessages = {
    forYou: {
      title: "Nothing here yet",
      body: "Be the first to share a travel tip, question, or story.",
    },
    following: {
      title: "No posts yet",
      body: "Posts you create will appear here.",
    },
    nearby: {
      title: "No destination posts",
      body: "Posts tagged with a destination will appear here.",
    },
    questions: {
      title: "No questions yet",
      body: "Ask the community anything about travel.",
    },
    trips: {
      title: "No trips yet",
      body: "Share a trip idea or story to get started.",
    },
  };
  const emptyMsg = emptyMessages[activeTab] || emptyMessages.forYou;

  // ── Feed section title by tab ──────────────────────────────────
  const feedTitles = {
    forYou: "Community Feed",
    following: "Your Posts",
    nearby: "Destination Posts",
    questions: "Questions",
    trips: "Trips & Stories",
  };

  // ── Create post ───────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!composerText.trim() && composerPhotos.length === 0) {
      message.warning("Write something or add a photo before posting.");
      return;
    }
    try {
      setCreatingPost(true);
      let uploadedImageUrls = [];
      if (composerPhotos.length > 0) {
        const token = localStorage.getItem("token");
        const results = await Promise.allSettled(
          composerPhotos.map(async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(apiUrl("/api/uploads/image"), {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
              body: fd,
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.message || "Upload failed");
            return d.url;
          })
        );
        uploadedImageUrls = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed)
          message.warning(
            `${failed} photo${failed > 1 ? "s" : ""} failed to upload.`
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
          images: uploadedImageUrls,
          image: uploadedImageUrls[0] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create post");

      const enriched = {
        ...data.post,
        images: uploadedImageUrls.length
          ? uploadedImageUrls
          : data.post.images || [],
        image: uploadedImageUrls[0] || data.post.image || "",
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
      message.success("Posted to SkyHub! ✈️");
    } catch (err) {
      message.error(err.message || "Could not create post.");
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${postId}/like`), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      setPosts((p) =>
        p.map((x) =>
          x.id === postId
            ? { ...x, liked: !!data.liked, likes: data.likesCount ?? x.likes }
            : x
        )
      );
    } catch (err) {
      message.error(err.message || "Could not update like.");
    }
  };

  const handleToggleSave = async (postId) => {
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${postId}/save`), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      setPosts((p) =>
        p.map((x) =>
          x.id === postId
            ? { ...x, saved: !!data.saved, saves: data.savesCount ?? x.saves }
            : x
        )
      );
      message.success(data.saved ? "Saved." : "Removed from saved.");
    } catch (err) {
      message.error(err.message || "Could not update saved state.");
    }
  };

  const handleDeletePost = async (postId) => {
    // Optimistic — remove instantly so it feels fast
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    message.success("Post deleted.");
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${postId}`), {
        method: "DELETE",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!res.ok && res.status !== 404)
        console.warn("[skyhub] delete returned", res.status);
    } catch {
      /* network error — UI already updated */
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

  const refreshPostComments = (postId, count) =>
    setPosts((p) =>
      p.map((x) =>
        x.id === postId
          ? { ...x, comments: typeof count === "number" ? count : x.comments }
          : x
      )
    );

  const handleExploreSearch = () =>
    document
      .querySelector(".skyhub-feedSection")
      ?.scrollIntoView({ behavior: "smooth" });

  const currentUserId = currentUser
    ? `${currentUser.id || ""}|${currentUser.username || ""}`
    : null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="skyhub-page"
      style={{ backgroundImage: `url(${heroBeach})` }}
    >
      {/* ── HERO ── */}
      <header className="skyhub-topHeader">
        <div className="skyhub-topHeaderOverlay" />
        <div className="skyhub-topHeaderInner">
          <div className="skyhub-heroCopy">
            {currentUser && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt=""
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid rgba(255,255,255,0.5)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#ff7a35,#8b5cf6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 14,
                      color: "#fff",
                    }}
                  >
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div
                    style={{
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      lineHeight: 1.2,
                    }}
                  >
                    Hey, {currentUser.name.split(" ")[0]} 👋
                  </div>
                  <div
                    style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}
                  >
                    @{currentUser.username} · {currentUser.badge} · ✈️{" "}
                    {(currentUser.xp || 0).toLocaleString()} XP
                  </div>
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
              onPressEnter={handleExploreSearch}
              className="skyhub-searchInput"
            />
            <Button
              type="primary"
              icon={<GlobalOutlined />}
              className="skyhub-exploreBtn"
              onClick={handleExploreSearch}
            >
              Explore SkyHub
            </Button>
          </div>
        </div>

        {/* Live stats derived from real feed data */}
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

      {/* ── MAIN ── */}
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
          <div className="skyhub-navbar-vibes">
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
                    {feedTitles[activeTab] || "Community Feed"}
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
                  style={{ backgroundColor: "#ff7a35" }}
                />
              </div>

              <div className="skyhub-feedList">
                {loadingFeed ? (
                  <div className="skyhub-emptyState">
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
                    <h3>{emptyMsg.title}</h3>
                    <p>{emptyMsg.body}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar — all data derived from feed, no extra API calls */}
          <aside className="skyhub-rightRail">
            <SkyHubPassportCard currentUser={currentUser} />
            <SkyHubTrendingDestinations
              items={trendingDestinations}
              loading={loadingFeed}
              onSeeAll={() => navigate("/skyhub/destinations")}
            />
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
