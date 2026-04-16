import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import "../styles/skyhub.css";

// ── Static feed data (replace with API call) ──
const FEED_POSTS = [
  {
    id: "p1",
    avatar: "M",
    avatarColor: "linear-gradient(135deg,#6f68ff,#c661ff)",
    name: "maya_travels",
    location: "Bali, Indonesia",
    time: "2h ago",
    text: "Just booked through Skyrio for the third time this year 🌴 The AI trip suggestions are actually scary good — found a hotel I never would have discovered on my own. Already earned enough XP for a 12% discount on my next trip!",
    likes: 48,
    replies: 12,
    xp: "+120 XP",
  },
  {
    id: "p2",
    avatar: "J",
    avatarColor: "linear-gradient(135deg,#ff8a2a,#ffad5c)",
    name: "jakub.explorer",
    location: "Tokyo, Japan",
    time: "5h ago",
    text: "Level 9 unlocked 🎌 The Skyrio badge system is genuinely motivating — I actually planned an extra city stop just to earn the East Asia badge. The 18% discount at Level 10 is within reach. Who else is grinding?",
    likes: 93,
    replies: 27,
    xp: "+85 XP",
  },
  {
    id: "p3",
    avatar: "A",
    avatarColor: "linear-gradient(135deg,#00c9a7,#0078ff)",
    name: "anya.wanders",
    location: "Lisbon, Portugal",
    time: "1d ago",
    text: "Used the Atlas AI budget tool for the first time and it genuinely changed how I plan trips. Set a €2,000 budget, it found flights + a boutique hotel + 3 activities all within range. The 'why Skyrio picked this' explanations are chef's kiss 👨‍🍳",
    likes: 156,
    replies: 41,
    xp: "+200 XP",
  },
  {
    id: "p4",
    avatar: "D",
    avatarColor: "linear-gradient(135deg,#f857a6,#ff5858)",
    name: "dani.miles",
    location: "Cape Town, South Africa",
    time: "2d ago",
    text: "Skyrio saved our honeymoon budget 🥹 Compared three different trip packages side by side and the price difference was wild. Ended up upgrading our hotel because the flights came in so far under budget. Highly recommend the comparison mode.",
    likes: 214,
    replies: 33,
    xp: "+150 XP",
  },
];

const SHEET_PERKS = [
  { icon: "⭐", text: "Earn XP and unlock travel badges" },
  { icon: "🏷️", text: "Access exclusive member discounts" },
  { icon: "💬", text: "Post trips and connect with travellers" },
  { icon: "📍", text: "Save trips and build your travel map" },
];

export default function SkyHubFeed() {
  const { isAuthed, isGuest } = useAuth();
  const nav = useNavigate();
  const isRestricted = !isAuthed; // guests AND unauthenticated see locked actions

  const [sheetOpen, setSheetOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState(new Set());

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const handleLockedAction = useCallback(() => {
    if (isRestricted) {
      openSheet();
      return;
    }
  }, [isRestricted, openSheet]);

  const handleLike = useCallback(
    (postId) => {
      if (isRestricted) {
        openSheet();
        return;
      }
      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.has(postId) ? next.delete(postId) : next.add(postId);
        return next;
      });
    },
    [isRestricted, openSheet]
  );

  return (
    <div className="sh-page">
      {/* ── Header ── */}
      <div className="sh-header">
        <div className="sh-header-left">
          <h1 className="sh-title">
            SkyHub <span className="sh-star">✦</span>
          </h1>
          <p className="sh-sub">The Skyrio travel community</p>
        </div>
        {isRestricted && (
          <div className="sh-guest-badge">👤 Guest — Read Only</div>
        )}
        {isAuthed && (
          <button
            className="sh-post-btn"
            onClick={() => {
              /* open post modal */
            }}
          >
            + Share a trip
          </button>
        )}
      </div>

      {/* ── Soft lock banner (guests only) ── */}
      {isRestricted && (
        <div className="sh-banner">
          <span className="sh-banner-icon">✈️</span>
          <div className="sh-banner-body">
            <div className="sh-banner-title">
              Join to post, react, and earn XP
            </div>
            <div className="sh-banner-sub">
              You're browsing as a guest. Create a free account to interact with
              the community and start earning rewards on every trip.
            </div>
          </div>
          <button className="sh-banner-btn" onClick={() => nav("/register")}>
            Join free
          </button>
        </div>
      )}

      {/* ── Feed ── */}
      <div className="sh-feed">
        {FEED_POSTS.map((post) => (
          <div key={post.id} className="sh-post">
            <div className="sh-avatar" style={{ background: post.avatarColor }}>
              {post.avatar}
            </div>

            <div className="sh-post-body">
              <div className="sh-post-name">{post.name}</div>
              <div className="sh-post-meta">
                {post.location} · {post.time}
              </div>
              <p className="sh-post-text">{post.text}</p>

              <div className="sh-actions">
                <button
                  className={`sh-action ${
                    isRestricted
                      ? "sh-action--locked"
                      : likedPosts.has(post.id)
                      ? "sh-action--liked"
                      : ""
                  }`}
                  onClick={() => handleLike(post.id)}
                  aria-label="Like post"
                >
                  {likedPosts.has(post.id) ? "❤️" : "🤍"}{" "}
                  {post.likes + (likedPosts.has(post.id) ? 1 : 0)}
                </button>

                <button
                  className={`sh-action ${
                    isRestricted ? "sh-action--locked" : ""
                  }`}
                  onClick={handleLockedAction}
                  aria-label="View replies"
                >
                  💬 {post.replies} replies
                </button>

                <button
                  className={`sh-action ${
                    isRestricted ? "sh-action--locked" : ""
                  }`}
                  onClick={handleLockedAction}
                  aria-label="Get inspired by this trip"
                >
                  ✈️ Inspire me
                </button>
              </div>
            </div>

            <div className="sh-xp-badge">{post.xp}</div>
          </div>
        ))}

        {/* ── Ghost post prompt ── */}
        {isRestricted && (
          <div
            className="sh-post sh-post--ghost"
            onClick={openSheet}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openSheet()}
          >
            <div className="sh-avatar sh-avatar--ghost">+</div>
            <div className="sh-post-body">
              <div className="sh-post-name sh-post-name--muted">
                Share your trip…
              </div>
              <div className="sh-post-meta">
                Join Skyrio to post and earn XP
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Overlay ── */}
      {sheetOpen && (
        <div className="sh-overlay" onClick={closeSheet} aria-hidden="true" />
      )}

      {/* ── Bottom Sheet ── */}
      <div
        className={`sh-sheet ${sheetOpen ? "sh-sheet--open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sh-sheet-handle" />
        <button
          className="sh-sheet-close"
          onClick={closeSheet}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="sh-sheet-title">Join to interact ✈️</div>
        <p className="sh-sheet-sub">
          Create a free account to post, react, and earn XP on every trip.
        </p>

        <div className="sh-sheet-perks">
          {SHEET_PERKS.map((p) => (
            <div key={p.text} className="sh-sheet-perk">
              <span className="sh-sheet-perk-icon">{p.icon}</span>
              <span>{p.text}</span>
            </div>
          ))}
        </div>

        <div className="sh-sheet-btns">
          <button
            className="sh-sheet-cta"
            onClick={() => {
              closeSheet();
              nav("/register");
            }}
          >
            Create your boarding pass — it's free
          </button>
          <button className="sh-sheet-ghost" onClick={closeSheet}>
            Keep browsing as guest
          </button>
        </div>
      </div>
    </div>
  );
}