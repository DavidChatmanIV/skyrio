import React, { useEffect, useMemo, useState, useCallback } from "react";
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
import { skyhubFilters, skyhubTabs, skyhubStats } from "./skyhubData";
import SkyHubComposer from "./SkyHubComposer";
import SkyHubFeedCard from "./SkyHubFeedCard";
import SkyHubCommentDrawer from "./SkyHubCommentDrawer";
import SkyHubPassportCard from "./SkyHubPassportCard";
import SkyHubTrendingDestinations from "./SkyHubTrendingDestinations";
import SkyHubActiveTravelers from "./SkyHubActiveTravelers";
import { apiUrl } from "@/lib/api";

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
    // Always prefer images[] array, fall back to single image field
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
    budget: post.budget || "",
    helpful: !!post.helpful,
    liked: !!post.viewerHasLiked,
    saved: !!post.viewerHasSaved,
  };
}

export default function SkyHubPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("forYou");
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchValue, setSearchValue] = useState("");
  const [composerText, setComposerText] = useState("");
  const [destination, setDestination] = useState("");
  const [activePostType, setActivePostType] = useState("Tip");
  const [composerPhotos, setComposerPhotos] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [trendingDestinations, setTrendingDestinations] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [activeTravelers, setActiveTravelers] = useState([]);
  const [loadingTravelers, setLoadingTravelers] = useState(false);

  // ── Current logged-in user ─────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  // ── Live online count ──────────────────────────────────────
  const [onlineCount, setOnlineCount] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const u = data.user || data;
      setCurrentUser({
        id: u._id || u.id,
        name: u.name || u.fullName || u.username || "Traveler",
        username: u.username || "traveler",
        avatar: u.avatar || u.profilePicture || u.profileImage || null,
        xp: u.xp || u.passport || 0,
        badge: u.badge || "Explorer",
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchOnlineCount = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/skyhub/online-count"), {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.count) setOnlineCount(data.count);
    } catch {
      /* non-critical — fall back to static */
    }
  }, []);

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

  const fetchTrending = useCallback(async () => {
    try {
      setLoadingTrending(true);
      const res = await fetch(apiUrl("/api/skyhub/trending"), {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.destinations))
        setTrendingDestinations(data.destinations);
    } catch (err) {
      console.error("fetchTrending error:", err);
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const fetchActiveTravelers = useCallback(async () => {
    try {
      setLoadingTravelers(true);
      const res = await fetch(apiUrl("/api/skyhub/active-travelers"), {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.travelers))
        setActiveTravelers(data.travelers);
    } catch (err) {
      console.error("fetchActiveTravelers error:", err);
    } finally {
      setLoadingTravelers(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    fetchFeed();
    fetchTrending();
    fetchActiveTravelers();
    fetchOnlineCount();
    // Refresh online count every 60s
    const timer = setInterval(fetchOnlineCount, 60_000);
    return () => clearInterval(timer);
  }, [
    fetchCurrentUser,
    fetchFeed,
    fetchTrending,
    fetchActiveTravelers,
    fetchOnlineCount,
  ]);

  // ── Explore SkyHub search — scrolls feed into view & filters ──
  const handleExploreSearch = () => {
    // Scroll to feed
    document
      .querySelector(".skyhub-feedSection")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      const search = searchValue.toLowerCase();
      const matchesSearch =
        !search ||
        (post.text || "").toLowerCase().includes(search) ||
        (post.destination || "").toLowerCase().includes(search) ||
        (post.author || "").toLowerCase().includes(search) ||
        (post.tags || []).join(" ").toLowerCase().includes(search);
      const matchesFilter =
        activeFilter === "All" ||
        (post.tags || []).some(
          (t) => t.toLowerCase() === activeFilter.toLowerCase()
        ) ||
        (post.type || "").toLowerCase() === activeFilter.toLowerCase();
      const matchesTab =
        activeTab === "forYou"
          ? true
          : activeTab === "questions"
          ? post.type === "Question"
          : activeTab === "trips"
          ? post.type === "Join Trip" || post.type === "Story"
          : true;
      return matchesSearch && matchesFilter && matchesTab;
    });
  }, [posts, searchValue, activeFilter, activeTab]);

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
        const uploadResults = await Promise.allSettled(
          composerPhotos.map(async (file) => {
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
            return data.url;
          })
        );
        uploadedImageUrls = uploadResults
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        const failed = uploadResults.filter(
          (r) => r.status === "rejected"
        ).length;
        if (failed > 0)
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

      const postWithImages = {
        ...data.post,
        // Always inject uploaded URLs — backend may not echo them back
        images:
          uploadedImageUrls.length > 0
            ? uploadedImageUrls
            : data.post.images || [],
        image: uploadedImageUrls[0] || data.post.image || "",
        // Use actual logged-in user details so name/username show correctly
        authorName: currentUser?.name || data.post.authorName,
        username: currentUser?.username || data.post.username,
        avatar: currentUser?.avatar || data.post.avatar,
        authorId: currentUser?.id,
      };
      setPosts((prev) => [mapBackendPost(postWithImages), ...prev]);
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
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !!data.liked, likes: data.likesCount ?? p.likes }
            : p
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
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, saved: !!data.saved, saves: data.savesCount ?? p.saves }
            : p
        )
      );
      message.success(data.saved ? "Post saved." : "Post removed from saved.");
    } catch (err) {
      message.error(err.message || "Could not update saved state.");
    }
  };

  // ── Delete own post ────────────────────────────────────────
  const handleDeletePost = async (postId) => {
    try {
      const res = await fetch(apiUrl(`/api/skyhub/posts/${postId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete post");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      message.success("Post deleted.");
    } catch (err) {
      message.error(err.message || "Could not delete post.");
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
        body: JSON.stringify({
          reason: "User reported this post from beta UI",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      message.success("Post reported. Thanks for keeping SkyHub safe.");
    } catch (err) {
      message.error(err.message || "Could not report post.");
    }
  };

  const refreshPostComments = (postId, commentCount) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments:
                typeof commentCount === "number" ? commentCount : p.comments,
            }
          : p
      )
    );
  };

  // ── Live online count display ──────────────────────────────
  const onlineDisplay =
    onlineCount != null
      ? `${onlineCount.toLocaleString()} travelers online`
      : "247 travelers online";

  return (
    <div
      className="skyhub-page"
      style={{ backgroundImage: `url(${heroBeach})` }}
    >
      {/* ── HERO HEADER ── */}
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
                    alt={currentUser.name}
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

        {/* Live stats */}
        <div className="skyhub-topStats">
          {skyhubStats.map((item) => (
            <div key={item.id} className="skyhub-statItem">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
          <div className="skyhub-onlinePill">{onlineDisplay}</div>
        </div>
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

        {/* Content grid */}
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
                  <h2 className="skyhub-sectionTitle">Community Feed</h2>
                  <p className="skyhub-sectionSubtext">
                    Travel-first posts with real community insights.
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
                      currentUserId={currentUser?.id}
                      onToggleLike={handleToggleLike}
                      onToggleSave={handleToggleSave}
                      onOpenComments={handleOpenComments}
                      onReportPost={handleReportPost}
                      onDeletePost={handleDeletePost}
                    />
                  ))
                ) : (
                  <div className="skyhub-emptyState">
                    <h3>Nothing here yet 👀</h3>
                    <p>
                      Be the first to drop a travel tip, ask a question, or
                      start a trip idea.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="skyhub-rightRail">
            {/* Passport XP synced from currentUser */}
            <SkyHubPassportCard currentUser={currentUser} />
            <SkyHubTrendingDestinations
              items={trendingDestinations}
              loading={loadingTrending}
              onSeeAll={() => navigate("/skyhub/destinations")}
            />
            <SkyHubActiveTravelers
              travelers={activeTravelers}
              loading={loadingTravelers}
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
