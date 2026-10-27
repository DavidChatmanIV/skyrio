import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "antd";
import { MapPin, Search, X, Share2, Check, UserPlus } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";
import FollowButton from "./FollowButton";
import PlaneBadge from "./PlaneBadge";

// ─────────────────────────────────────────────────────────────
// Followers / Following modal
// - Reads /api/follow/:userId/followers|following (same data the
//   follow buttons write), so the list always matches the count
// - Tabs to switch lists without closing
// - Whole row opens the profile; "Follows you" tag; Follow back
// - Remove a follower from your own list (with confirm)
// - Search inside the list, skeleton loading, retry on error
// - Bottom sheet on phones
// ─────────────────────────────────────────────────────────────

const FM_CSS = `
.fm { font-family: "DM Sans", system-ui, sans-serif; color: #fff; }
.fm-head { display: flex; align-items: center; gap: 12px; padding: 16px 14px 0 20px; }
.fm-title { flex: 1; min-width: 0; font: 700 17px "Syne", "DM Sans", sans-serif; }
.fm-close { width: 36px; height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; }
.fm-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
.fm-tabs { display: flex; gap: 4px; margin: 12px 16px 0; padding: 4px; border-radius: 12px; background: rgba(255,255,255,0.05); }
.fm-tab { flex: 1; min-height: 38px; border: 0; border-radius: 9px; background: transparent; cursor: pointer;
  color: rgba(255,255,255,0.6); font: 600 13.5px "DM Sans", system-ui, sans-serif; }
.fm-tab b { color: #fff; margin-right: 5px; font-weight: 700; }
.fm-tab[aria-selected="true"] { background: rgba(255,138,42,0.16); color: #ffb347; }
.fm-tab[aria-selected="true"] b { color: #ffb347; }
.fm-search { display: flex; align-items: center; gap: 8px; margin: 12px 16px 0; padding: 0 12px; min-height: 40px;
  border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
.fm-search:focus-within { border-color: rgba(255,138,42,0.6); }
.fm-search input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: #fff; font: 500 14px "DM Sans", system-ui, sans-serif; }
.fm-search input::placeholder { color: rgba(255,255,255,0.45); }
.fm-list { list-style: none; margin: 10px 0 0; padding: 0 8px 10px; max-height: min(440px, 60vh); overflow-y: auto;
  overscroll-behavior: contain; border-top: 1px solid rgba(255,255,255,0.06);
  scrollbar-width: thin; scrollbar-color: rgba(255,138,42,0.45) transparent; }
.fm-row { display: flex; align-items: center; gap: 12px; padding: 10px 10px; border-radius: 12px; cursor: pointer; }
.fm-row:hover { background: rgba(255,255,255,0.045); }
.fm-av { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex-shrink: 0; display: flex; align-items: center;
  justify-content: center; font-size: 17px; font-weight: 700; border: 2px solid rgba(255,138,42,0.22);
  background: linear-gradient(135deg, rgba(124,92,252,0.4), rgba(255,138,42,0.4)); }
.fm-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fm-meta { flex: 1; min-width: 0; }
.fm-name { display: flex; align-items: center; gap: 6px; font-size: 14.5px; font-weight: 600; line-height: 1.25; }
.fm-name > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-sub { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 12.5px; color: rgba(255,255,255,0.58); min-width: 0; }
.fm-sub > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-city { display: inline-flex; align-items: center; gap: 3px; }
.fm-tag { flex-shrink: 0; font: 600 10px "JetBrains Mono", ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.08); border-radius: 5px; padding: 2px 6px; }
.fm-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.fm-btn { min-height: 32px; padding: 0 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font: 600 12.5px "DM Sans", system-ui, sans-serif; border: 1px solid rgba(255,255,255,0.18);
  background: transparent; color: rgba(255,255,255,0.85); }
.fm-btn:hover { background: rgba(255,255,255,0.07); }
.fm-btn--danger { border-color: rgba(255,92,92,0.55); color: #ff8a8a; }
.fm-btn--danger:hover { background: rgba(255,92,92,0.12); }
.fm-btn--primary { border-color: rgba(255,138,42,0.55); background: rgba(255,138,42,0.14); color: #ffb347; }
.fm-btn--primary:hover { background: rgba(255,138,42,0.22); }
.fm-you { font: 600 10.5px "JetBrains Mono", ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; padding: 3px 8px; }
.fm-empty { padding: 40px 24px 36px; text-align: center; font-size: 14px; line-height: 1.55; color: rgba(255,255,255,0.65); }
.fm-empty strong { display: block; color: #fff; font-size: 15px; margin-bottom: 4px; }
.fm-empty .fm-btn { margin-top: 16px; min-height: 38px; padding: 0 16px; display: inline-flex; align-items: center; gap: 7px; }
.fm-skel { display: flex; align-items: center; gap: 12px; padding: 10px; }
.fm-skel i { display: block; border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.13), rgba(255,255,255,0.06));
  background-size: 200% 100%; animation: fmShimmer 1.2s linear infinite; }
.fm :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
.fm-search input:focus-visible { outline: none; }
@keyframes fmShimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .fm-skel i { animation: none; } }

/* Phones: slide up from the bottom as a sheet */
@media (max-width: 600px) {
  .sk-fm-root .ant-modal-wrap { display: flex; align-items: flex-end; justify-content: center; }
  .sk-fm-root .ant-modal-centered::before { display: none; }
  .sk-fm-root .ant-modal { width: 100% !important; max-width: 100vw; margin: 0; padding: 0; top: 0; vertical-align: bottom; }
  .sk-fm-root .ant-modal-content { border-radius: 20px 20px 0 0 !important; padding-bottom: env(safe-area-inset-bottom) !important; }
  .fm-list { max-height: 62vh; }
}
`;

const idOf = (u) => String(u?._id || u?.id || "");

function Avatar({ u }) {
  const [broken, setBroken] = useState(false);
  const src = u.avatar || u.avatarUrl;
  const ok = src && src !== "/default-avatar.png" && !broken;
  return (
    <div className="fm-av" aria-hidden="true">
      {ok ? (
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        (u.name || u.username || "?")[0].toUpperCase()
      )}
    </div>
  );
}

function Skeleton() {
  return [0, 1, 2, 3].map((i) => (
    <div key={i} className="fm-skel" aria-hidden="true">
      <i style={{ width: 44, height: 44 }} />
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}
      >
        <i style={{ width: `${55 - i * 8}%`, height: 11 }} />
        <i style={{ width: `${32 - i * 4}%`, height: 9 }} />
      </div>
    </div>
  ));
}

/**
 * props:
 *  open, onClose
 *  mode            "followers" | "following" — which tab opens first
 *  userId          whose lists to show (defaults to the logged-in traveler)
 *  username        their @handle, used for the share link (defaults to yours)
 *  counts          { followers, following } shown on the tabs before loading
 *  onCountsChange  ({ followers?, following? }) => void — keep the passport numbers in sync
 */
export default function FollowersModal({
  open,
  onClose,
  mode = "following",
  userId,
  username,
  counts,
  onCountsChange,
}) {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const myId = idOf(user) || null;
  const ownerId = String(userId || myId || "");
  const isOwnList = !!myId && ownerId === myId;
  const shareHandle = username || (isOwnList ? user?.username : "");

  const [tab, setTab] = useState(mode);
  const [lists, setLists] = useState({ followers: null, following: null });
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [filter, setFilter] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);

  // Reset every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTab(mode);
    setLists({ followers: null, following: null });
    setFilter("");
    setConfirmRemove(null);
  }, [open, mode, ownerId]);

  // Load the active tab.
  useEffect(() => {
    if (!open || !ownerId) return;
    if (lists[tab]) return; // already loaded
    const ctrl = new AbortController();
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/follow/${ownerId}/${tab}`), {
          credentials: "include",
          signal: ctrl.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "load failed");
        const users = data.users || [];
        setLists((prev) => ({ ...prev, [tab]: users }));
        setStatus("done");
        if (isOwnList) onCountsChange?.({ [tab]: users.length });
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("FollowersModal load error:", err);
        setStatus("error");
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, ownerId, token, retry, lists[tab]]);

  const items = lists[tab] || [];
  const loading = !lists[tab] && status !== "error";

  const tabCount = (key) =>
    lists[key] ? lists[key].length : Number(counts?.[key] ?? 0);

  const visible = useMemo(() => {
    const q = filter.trim().replace(/^@+/, "").toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) =>
        String(u.name || "")
          .toLowerCase()
          .includes(q) ||
        String(u.username || "")
          .toLowerCase()
          .includes(q)
    );
  }, [items, filter]);

  const openProfile = (u) => {
    if (!u?.username) return;
    onClose?.();
    navigate(`/u/${u.username}`);
  };

  // Follow / unfollow from inside the list.
  const handleToggle = (id, nowFollowing) => {
    setLists((prev) => {
      const patch = (arr) =>
        arr
          ? arr.map((u) =>
              idOf(u) === String(id) ? { ...u, isFollowing: nowFollowing } : u
            )
          : arr;
      return {
        followers: patch(prev.followers),
        following: patch(prev.following),
      };
    });
    if (isOwnList) {
      // Keep rows in place now (nothing jumps under the cursor), update the
      // count, and reload the Following tab next time it's opened.
      const current = tabCount("following");
      onCountsChange?.({
        following: Math.max(0, current + (nowFollowing ? 1 : -1)),
      });
      if (tab !== "following")
        setLists((prev) => ({ ...prev, following: null }));
    }
  };

  const removeFollower = async (u) => {
    const id = idOf(u);
    setConfirmRemove(null);
    const before = lists.followers;
    const next = (before || []).filter((x) => idOf(x) !== id);
    setLists((prev) => ({ ...prev, followers: next }));
    onCountsChange?.({ followers: next.length });
    try {
      const res = await fetch(apiUrl(`/api/follow/followers/${id}`), {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error("remove failed");
    } catch {
      // put them back if it didn't work
      setLists((prev) => ({ ...prev, followers: before }));
      onCountsChange?.({ followers: (before || []).length });
    }
  };

  const sharePassport = async () => {
    if (!shareHandle) return;
    const url = `${window.location.origin}/u/${shareHandle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Skyrio Passport", url });
        return;
      }
    } catch {
      return; // user cancelled the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const renderActions = (u) => {
    if (u.isMe || idOf(u) === myId) return <span className="fm-you">You</span>;

    if (isOwnList && tab === "followers" && confirmRemove === idOf(u)) {
      return (
        <div className="fm-actions">
          <button
            type="button"
            className="fm-btn"
            onClick={() => setConfirmRemove(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="fm-btn fm-btn--danger"
            onClick={() => removeFollower(u)}
          >
            Remove
          </button>
        </div>
      );
    }

    return (
      <div className="fm-actions">
        <FollowButton
          key={`${idOf(u)}-${!!u.isFollowing}`}
          userId={u._id || u.id}
          isFollowing={!!u.isFollowing}
          size="small"
          token={token}
          onToggle={(now) => handleToggle(idOf(u), now)}
        />
        {isOwnList && tab === "followers" && (
          <button
            type="button"
            className="fm-close"
            style={{ width: 32, height: 32 }}
            aria-label={`Remove ${u.username} as a follower`}
            title="Remove follower"
            onClick={() => setConfirmRemove(idOf(u))}
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  const emptyState =
    tab === "followers" ? (
      <div className="fm-empty">
        <strong>No followers yet</strong>
        {isOwnList
          ? "Share your passport so friends can follow your trips."
          : "Be the first to follow them."}
        {isOwnList && shareHandle && (
          <div>
            <button
              type="button"
              className="fm-btn fm-btn--primary"
              onClick={sharePassport}
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Share2 size={15} aria-hidden="true" />
              )}
              {copied ? "Link copied" : "Share passport"}
            </button>
          </div>
        )}
      </div>
    ) : (
      <div className="fm-empty">
        <strong>Not following anyone yet</strong>
        {isOwnList
          ? "Find friends with the Find Travelers search."
          : "Check back later."}
        {isOwnList && (
          <div>
            <button
              type="button"
              className="fm-btn fm-btn--primary"
              onClick={onClose}
            >
              <UserPlus size={15} aria-hidden="true" />
              Find travelers
            </button>
          </div>
        )}
      </div>
    );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      closable={false}
      title={null}
      width={460}
      rootClassName="sk-fm-root"
      className="sk-followModal"
      styles={{
        content: {
          background: "rgba(22,18,40,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: 0,
          overflow: "hidden",
        },
        header: { display: "none" },
        body: { padding: 0 },
      }}
    >
      <style>{FM_CSS}</style>
      <div className="fm">
        <div className="fm-head">
          <div className="fm-title">
            {isOwnList ? "Your travel circle" : "Travel circle"}
          </div>
          <button
            type="button"
            className="fm-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          className="fm-tabs"
          role="tablist"
          aria-label="Followers and following"
        >
          {["followers", "following"].map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="fm-tab"
              onClick={() => {
                setTab(key);
                setFilter("");
                setConfirmRemove(null);
              }}
            >
              <b>{tabCount(key)}</b>
              {key === "followers"
                ? tabCount(key) === 1
                  ? "Follower"
                  : "Followers"
                : "Following"}
            </button>
          ))}
        </div>

        {items.length > 6 && (
          <label className="fm-search">
            <Search
              size={15}
              color="rgba(255,255,255,0.5)"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${tab}`}
              aria-label={`Search ${tab}`}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}

        <ul className="fm-list" role="tabpanel">
          {loading && <Skeleton />}

          {status === "error" && !lists[tab] && (
            <div className="fm-empty" role="alert">
              <strong>Couldn't load this list</strong>
              Check your connection and try again.
              <div>
                <button
                  type="button"
                  className="fm-btn fm-btn--primary"
                  onClick={() => {
                    setStatus("loading");
                    setRetry((n) => n + 1);
                  }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {lists[tab] && items.length === 0 && emptyState}

          {lists[tab] && items.length > 0 && visible.length === 0 && (
            <div className="fm-empty">
              No one matches{" "}
              <strong style={{ display: "inline" }}>"{filter}"</strong>.
            </div>
          )}

          {visible.map((u) => {
            const city =
              typeof (u.city || u.homeBase) === "string"
                ? u.city || u.homeBase
                : "";
            return (
              <li
                key={idOf(u)}
                className="fm-row"
                onClick={() => openProfile(u)}
              >
                <Avatar u={u} />
                <div className="fm-meta">
                  <div className="fm-name">
                    <span>{u.name || u.username || "Traveler"}</span>
                    {u.verifiedTier && (
                      <PlaneBadge tier={u.verifiedTier} size={13} />
                    )}
                    {u.isOfficial && <span className="fm-tag">Official</span>}
                  </div>
                  <div className="fm-sub">
                    {u.username && <span>@{u.username}</span>}
                    {city && (
                      <span className="fm-city">
                        <MapPin size={11} aria-hidden="true" />
                        {city}
                      </span>
                    )}
                    {u.followsYou && !u.isMe && tab === "following" && (
                      <span className="fm-tag">Follows you</span>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {renderActions(u)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
