import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Badge, Button, Input, message } from "antd";
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
    author: post.authorName || "Traveler",
    username: post.username ? `@${post.username}` : "@traveler",
    avatar: post.avatar || "TR",
    verified: !!post.verified,
    type: post.type || "Story",
    destination: post.destination || "",
    timeAgo: post.timeAgo || "now",
    text: post.text || "",
    image: post.image || "",
    // Prefer images[] array; fall back to single image
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
    fetchFeed();
    fetchTrending();
    fetchActiveTravelers();
  }, [fetchFeed, fetchTrending, fetchActiveTravelers]);

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

      // Inject uploaded URLs so images appear immediately in feed
      const postWithImages = {
        ...data.post,
        images:
          uploadedImageUrls.length > 0
            ? uploadedImageUrls
            : data.post.images || [],
        image: uploadedImageUrls[0] || data.post.image || "",
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
      if (!res.ok) throw new Error(data?.message || "Failed to like post");
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
      if (!res.ok) throw new Error(data?.message || "Failed to save post");
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
      if (!res.ok) throw new Error(data?.message || "Failed to report post");
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
              className="skyhub-searchInput"
            />
            <Button
              type="primary"
              icon={<GlobalOutlined />}
              className="skyhub-exploreBtn"
            >
              Explore SkyHub
            </Button>
          </div>
        </div>
        <div className="skyhub-topStats">
          {skyhubStats.map((item) => (
            <div key={item.id} className="skyhub-statItem">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
          <div className="skyhub-onlinePill">247 travelers online</div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="skyhub-main">
        {/* Sticky nav bar — tabs + vibes in one compact row */}
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
                    <div
                      key={post.id}
                      data-type={post.type}
                      style={{ position: "relative" }}
                    >
                      <SkyHubFeedCard
                        post={post}
                        onToggleLike={handleToggleLike}
                        onToggleSave={handleToggleSave}
                        onOpenComments={handleOpenComments}
                        onReportPost={handleReportPost}
                      />
                    </div>
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
            <SkyHubPassportCard />
            <SkyHubTrendingDestinations
              items={trendingDestinations}
              loading={loadingTrending}
            />
            <SkyHubActiveTravelers
              travelers={activeTravelers}
              loading={loadingTravelers}
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
