import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Spin, message } from "antd";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/auth/useAuth";
import "@/styles/skyhub-travelers.css";

// SkyHub → Active Travelers → "View all"  (/skyhub/travelers)
// Lists travelers who posted on SkyHub recently, with Follow buttons.
// Open to everyone; following needs an account.

const PAGE_SIZE = 30;

const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "active", label: "Most posts" },
  { key: "popular", label: "Most followed" },
];

function skyFetch(path, opts = {}) {
  const token = localStorage.getItem("token");
  return fetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "T";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
}

function timeAgo(date) {
  if (!date) return "";
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

// Plane badge colors for verification tiers (orange / blue / purple).
const TIER_COLORS = { orange: "#ff8a3d", blue: "#4da3ff", purple: "#a77bff" };

/* ── SVG icons (no emoji) ── */
const svgBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};
const BackIcon = () => (
  <svg width="20" height="20" strokeWidth="2.2" {...svgBase}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" strokeWidth="2" {...svgBase}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);
const PinIcon = () => (
  <svg width="12" height="12" strokeWidth="2.2" {...svgBase}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const UsersIcon = () => (
  <svg width="32" height="32" strokeWidth="1.5" {...svgBase}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" />
  </svg>
);
const PlaneBadge = ({ tier }) => {
  const color = TIER_COLORS[String(tier || "").toLowerCase()];
  if (!color) return null;
  return (
    <span className="skyhubT-badge" title="Verified traveler">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill={color}
          d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        />
      </svg>
    </span>
  );
};

export default function SkyHubTravelersPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const myId = String(auth?.user?._id || auth?.user?.id || "");
  const loggedIn = !!localStorage.getItem("token");

  const [travelers, setTravelers] = useState([]);
  const [basis, setBasis] = useState("posts");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(() => new Set());
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [reloadKey, setReloadKey] = useState(0);

  const loadPage = useCallback(
    async (p) => {
      const res = await skyFetch(
        `/api/follow/travelers?page=${p}&limit=${PAGE_SIZE}&sort=${sort}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        // 404 here means the server doesn't have this list yet (not deployed).
        if (res.status === 404) {
          console.error("GET /api/follow/travelers returned 404");
          throw new Error("The travelers list isn't available right now.");
        }
        throw new Error("Couldn't load travelers. Please try again.");
      }
      return data;
    },
    [sort]
  );

  // First page + who I already follow
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [data, mine] = await Promise.all([
          loadPage(1),
          loggedIn
            ? skyFetch("/api/follow/mine/list")
                .then((r) => (r.ok ? r.json() : { following: [] }))
                .catch(() => ({ following: [] }))
            : Promise.resolve({ following: [] }),
        ]);
        if (!alive) return;
        setTravelers(data.travelers || []);
        setBasis(data.basis || "posts");
        setDays(data.days || 30);
        setHasMore(!!data.hasMore);
        setPage(1);
        setFollowing(new Set((mine.following || []).map(String)));
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadPage, loggedIn, reloadKey]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const next = page + 1;
      const data = await loadPage(next);
      setTravelers((list) => {
        const seen = new Set(list.map((u) => String(u._id)));
        return [
          ...list,
          ...(data.travelers || []).filter((u) => !seen.has(String(u._id))),
        ];
      });
      setHasMore(!!data.hasMore);
      setPage(next);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async (u) => {
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    const id = String(u._id);
    const wasFollowing = following.has(id);
    const bump = (delta) =>
      setTravelers((list) =>
        list.map((t) =>
          String(t._id) === id
            ? {
                ...t,
                followersCount: Math.max(0, (t.followersCount || 0) + delta),
              }
            : t
        )
      );
    const setFollow = (on) =>
      setFollowing((s) => {
        const n = new Set(s);
        on ? n.add(id) : n.delete(id);
        return n;
      });

    // Optimistic update, undone if the request fails
    setBusyId(id);
    setFollow(!wasFollowing);
    bump(wasFollowing ? -1 : 1);
    try {
      const res = await skyFetch(`/api/follow/${id}`, {
        method: wasFollowing ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok)
        throw new Error(data?.error || "Something went wrong. Try again.");
    } catch (err) {
      setFollow(wasFollowing);
      bump(wasFollowing ? 1 : -1);
      message.error(err.message);
    } finally {
      setBusyId("");
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return travelers;
    return travelers.filter((u) =>
      [u.name, u.username, u.city, u.homeBase]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [travelers, query]);

  const subtitle =
    basis === "posts"
      ? `Travelers who posted on SkyHub in the last ${days} days.`
      : "Travelers who've been on Skyrio recently.";

  return (
    <main className="skyhubT">
      <div className="skyhubT-panel">
        <header className="skyhubT-header">
          <Link
            to="/skyhub"
            className="skyhubT-back"
            aria-label="Back to SkyHub"
          >
            <BackIcon />
            <span>SkyHub</span>
          </Link>
          <div className="skyhubT-titleWrap">
            <h1 className="skyhubT-title">Active Travelers</h1>
            <p className="skyhubT-sub">{subtitle}</p>
          </div>
        </header>

        <label className="skyhubT-search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username or city"
            aria-label="Search travelers"
          />
        </label>

        <div
          className="skyhubT-tabs"
          role="tablist"
          aria-label="Sort travelers"
        >
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={sort === s.key}
              className={`skyhubT-tab${sort === s.key ? " is-active" : ""}`}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="skyhubT-state">
            <Spin />
          </div>
        ) : error ? (
          <div className="skyhubT-state">
            <p>{error}</p>
            <button
              type="button"
              className="skyhubT-btn"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try again
            </button>
          </div>
        ) : !shown.length ? (
          <div className="skyhubT-state">
            <span className="skyhubT-stateIcon">
              <UsersIcon />
            </span>
            <p className="skyhubT-stateTitle">
              {query
                ? "No travelers match that search"
                : "No active travelers yet"}
            </p>
            <p>
              {query
                ? "Try a different name or city."
                : "Share a trip on SkyHub and you'll show up here."}
            </p>
          </div>
        ) : (
          <ul className="skyhubT-grid">
            {shown.map((u) => {
              const id = String(u._id);
              const isMe = myId && id === myId;
              const isFollowing = following.has(id);
              const name = u.name || u.username || "Traveler";
              const place = u.city || u.homeBase;
              const photo =
                typeof u.avatar === "string" && /^https?:\/\//.test(u.avatar)
                  ? u.avatar
                  : null;
              const profileLink = u.username ? `/u/${u.username}` : null;

              const who = (
                <>
                  {photo ? (
                    <Avatar
                      size={52}
                      src={photo}
                      alt=""
                      className="skyhubT-avatar"
                    />
                  ) : (
                    <Avatar
                      size={52}
                      className="skyhubT-avatar skyhubT-avatar--initials"
                    >
                      {initials(name)}
                    </Avatar>
                  )}
                  <span className="skyhubT-who">
                    <span className="skyhubT-name">
                      {name}
                      <PlaneBadge tier={u.verifiedTier} />
                    </span>
                    {u.username && (
                      <span className="skyhubT-handle">@{u.username}</span>
                    )}
                  </span>
                </>
              );

              return (
                <li key={id} className="skyhubT-card">
                  {profileLink ? (
                    <Link to={profileLink} className="skyhubT-top">
                      {who}
                    </Link>
                  ) : (
                    <div className="skyhubT-top">{who}</div>
                  )}

                  {u.bio && <p className="skyhubT-bio">{u.bio}</p>}

                  <div className="skyhubT-meta">
                    {place && (
                      <span className="skyhubT-pill">
                        <PinIcon />
                        {place}
                      </span>
                    )}
                    <span>
                      {u.followersCount || 0}{" "}
                      {u.followersCount === 1 ? "follower" : "followers"}
                    </span>
                    {u.lastPostAt && (
                      <span>Posted {timeAgo(u.lastPostAt)}</span>
                    )}
                  </div>

                  {isMe ? (
                    <span className="skyhubT-you">This is you</span>
                  ) : (
                    <button
                      type="button"
                      className={`skyhubT-follow${
                        isFollowing ? " is-following" : ""
                      }`}
                      onClick={() => toggleFollow(u)}
                      disabled={busyId === id}
                      aria-pressed={isFollowing}
                    >
                      {!loggedIn
                        ? "Log in to follow"
                        : isFollowing
                        ? "Following"
                        : "Follow"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && hasMore && !query && (
          <div className="skyhubT-more">
            <button
              type="button"
              className="skyhubT-btn"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Show more travelers"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
