import React, { useEffect, useMemo, useState } from "react";
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
import {
  skyhubFilters,
  skyhubTabs,
  skyhubStats,
  trendingDestinationsMock,
  activeTravelersMock,
} from "./skyhubData";
import SkyHubComposer from "./SkyHubComposer";
import SkyHubFeedCard from "./SkyHubFeedCard";
import SkyHubCommentDrawer from "./SkyHubCommentDrawer";
import SkyHubPassportCard from "./SkyHubPassportCard";
import SkyHubTrendingDestinations from "./SkyHubTrendingDestinations";
import SkyHubActiveTravelers from "./SkyHubActiveTravelers";

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

  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);

  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      setLoadingFeed(true);

      const res = await fetch("/api/skyhub/feed", {
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load feed");
      }

      const mappedPosts = Array.isArray(data.posts)
        ? data.posts.map(mapBackendPost)
        : [];

      setPosts(mappedPosts);
    } catch (err) {
      console.error("fetchFeed error:", err);
      message.error(err.message || "Could not load SkyHub feed.");
    } finally {
      setLoadingFeed(false);
    }
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
          (tag) => tag.toLowerCase() === activeFilter.toLowerCase()
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
    if (!composerText.trim()) {
      message.warning("Write something before posting.");
      return;
    }

    try {
      setCreatingPost(true);

      const res = await fetch("/api/skyhub/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          text: composerText.trim(),
          type: activePostType,
          destination: destination.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create post");
      }

      const newPost = mapBackendPost(data.post);
      setPosts((prev) => [newPost, ...prev]);

      setComposerText("");
      setDestination("");
      setActivePostType("Tip");

      message.success("Posted to SkyHub.");
    } catch (err) {
      console.error("handleCreatePost error:", err);
      message.error(err.message || "Could not create post.");
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const res = await fetch(`/api/skyhub/posts/${postId}/like`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to like post");
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                liked: !!data.liked,
                likes: data.likesCount ?? post.likes,
              }
            : post
        )
      );
    } catch (err) {
      console.error("handleToggleLike error:", err);
      message.error(err.message || "Could not update like.");
    }
  };

  const handleToggleSave = async (postId) => {
    try {
      const res = await fetch(`/api/skyhub/posts/${postId}/save`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to save post");
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                saved: !!data.saved,
                saves: data.savesCount ?? post.saves,
              }
            : post
        )
      );

      message.success(data.saved ? "Post saved." : "Post removed from saved.");
    } catch (err) {
      console.error("handleToggleSave error:", err);
      message.error(err.message || "Could not update saved state.");
    }
  };

  const handleOpenComments = (post) => {
    setActiveCommentPost(post);
    setCommentDrawerOpen(true);
  };

  const handleReportPost = async (post) => {
    try {
      const res = await fetch(`/api/skyhub/posts/${post.id}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          reason: "User reported this post from beta UI",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to report post");
      }

      message.success("Post reported. Thanks for helping keep SkyHub safe.");
    } catch (err) {
      console.error("handleReportPost error:", err);
      message.error(err.message || "Could not report post.");
    }
  };

  const refreshPostComments = (postId, commentCount) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments:
                typeof commentCount === "number" ? commentCount : post.comments,
            }
          : post
      )
    );
  };

  return (
    <div
      className="skyhub-page"
      style={{ backgroundImage: `url(${heroBeach})` }}
    >
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

      <main className="skyhub-main">
        {/* ── TOOLBAR ── */}
        <section className="skyhub-toolbar">
          {/* Browse Feed — pill buttons matching navbar style */}
          <div className="skyhub-toolbarBlock">
            <div className="skyhub-toolbarLabel">Browse Feed</div>
            <div className="skyhub-filterRow">
              {skyhubTabs.map((tab) => (
                <button
                  key={tab.value ?? tab}
                  type="button"
                  className={`skyhub-filterChip${
                    activeTab === (tab.value ?? tab) ? " is-selected" : ""
                  }`}
                  onClick={() => setActiveTab(tab.value ?? tab)}
                >
                  {tab.label ?? tab}
                </button>
              ))}
            </div>
          </div>

          {/* Filter by Vibe — same pill buttons */}
          <div className="skyhub-toolbarBlock">
            <div className="skyhub-toolbarLabel">Filter by Vibe</div>
            <div className="skyhub-filterRow">
              {skyhubFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`skyhub-filterChip${
                    activeFilter === filter ? " is-selected" : ""
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONTENT GRID ── */}
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
                  style={{ backgroundColor: "#ff8a2a" }}
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
                      onToggleLike={handleToggleLike}
                      onToggleSave={handleToggleSave}
                      onOpenComments={handleOpenComments}
                      onReportPost={handleReportPost}
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
            <SkyHubPassportCard />
            <SkyHubTrendingDestinations items={trendingDestinationsMock} />
            <SkyHubActiveTravelers travelers={activeTravelersMock} />
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