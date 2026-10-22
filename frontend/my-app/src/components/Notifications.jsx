// Skyrio notifications — bell + panel.
// One component for desktop (dropdown) and mobile (bottom sheet).
//
// How "new" and "seen" work:
//  • The bell badge loads on page load, updates live over Socket.IO
//    ("notification:new" / "notification:unread"), and re-syncs when the
//    tab comes back into focus. A light poll covers a dropped socket.
//  • Opening the panel = you've seen them: the badge clears everywhere
//    (server marks all read). Rows that were new stay highlighted with an
//    orange dot for this visit so you can still tell which ones arrived.
//  • Tapping a row takes you to the related page.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell,
  BedDouble,
  CheckCheck,
  Heart,
  MessageCircle,
  Plane,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { socket } from "@/lib/socket";
import { useAuth } from "@/auth/useAuth";

const LIST_LIMIT = 50;
const POLL_MS = 90_000;

/* ── Styles (single drop-in file) ─────────────────────────────────── */
const NF_CSS = `
.nf { position: relative; display: inline-flex; }
.nf-bell { position: relative; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 999px; background: transparent; color: rgba(255,255,255,0.82); cursor: pointer; transition: background .18s, color .18s; }
.nf-bell:hover, .nf-bell.is-open { background: rgba(255,255,255,0.08); color: #fff; }
.nf-bell:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
.nf-bell.is-ringing svg { animation: nfRing .9s ease; transform-origin: 50% 4px; }
.nf-count { position: absolute; top: 4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; font: 800 10.5px/1 "DM Sans", sans-serif; box-shadow: 0 0 0 2px #1a0f2e; pointer-events: none; }

.nf-scrim { position: fixed; inset: 0; z-index: 2147483600; background: transparent; }
.nf-panel { position: absolute; top: calc(100% + 10px); right: -8px; z-index: 2147483601; width: 380px; max-height: min(72vh, 620px); display: flex; flex-direction: column; border-radius: 20px; background: rgba(16,11,34,0.97); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 28px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06); color: #fff; font-family: "DM Sans", system-ui, sans-serif; overflow: hidden; animation: nfIn .18s cubic-bezier(.22,1,.36,1) both; }
.nf-panel::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg,#ff8a2a,#ffb347,rgba(147,51,234,.85)); }

.nf-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px 16px 10px; }
.nf-title { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
.nf-sub { margin-top: 2px; font-size: 12px; color: rgba(255,255,255,0.62); }
.nf-actions { display: flex; gap: 4px; }
.nf-iconBtn { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 10px; background: transparent; color: rgba(255,255,255,0.72); cursor: pointer; transition: background .15s, color .15s; }
.nf-iconBtn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #fff; }
.nf-iconBtn.is-danger:hover:not(:disabled) { background: rgba(255,107,133,0.14); color: #ff8fa3; }
.nf-iconBtn:disabled { opacity: .35; cursor: default; }
.nf-iconBtn:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 1px; }

.nf-tabs { display: flex; gap: 4px; margin: 0 16px 8px; padding: 3px; border-radius: 999px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); overflow-x: auto; scrollbar-width: none; }
.nf-tabs::-webkit-scrollbar { display: none; }
.nf-tab { flex: 1 0 auto; min-height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: rgba(255,255,255,0.72); font: 700 12.5px "DM Sans", sans-serif; cursor: pointer; white-space: nowrap; }
.nf-tab:hover { color: #fff; }
.nf-tab.is-on { background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; }
.nf-tab:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 1px; }

.nf-body { flex: 1; overflow-y: auto; padding: 0 8px 10px; overscroll-behavior: contain; }
.nf-group { padding: 10px 10px 6px; font-family: ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; font-size: 10.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,0.55); }

.nf-row { position: relative; display: flex; gap: 12px; align-items: flex-start; padding: 10px 10px; border-radius: 14px; transition: background .15s; }
.nf-row:hover { background: rgba(255,255,255,0.05); }
.nf-row.is-new { background: rgba(255,138,42,0.07); }
.nf-row.is-new:hover { background: rgba(255,138,42,0.11); }
.nf-row__link { all: unset; position: absolute; inset: 0; border-radius: 14px; cursor: pointer; }
.nf-row__link:focus-visible { outline: 2px solid #ff8a2a; outline-offset: -2px; }
.nf-row__icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.nf-row__text { flex: 1; min-width: 0; pointer-events: none; }
.nf-row__title { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: #fff; line-height: 1.3; }
.nf-row__msg { margin-top: 2px; font-size: 12.5px; line-height: 1.45; color: rgba(255,255,255,0.72); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nf-row__time { margin-top: 4px; font-size: 11.5px; color: rgba(255,255,255,0.5); }
.nf-row__right { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.nf-dot { width: 8px; height: 8px; margin-top: 4px; border-radius: 50%; background: #ff8a2a; box-shadow: 0 0 0 3px rgba(255,138,42,0.2); }
.nf-row__del { opacity: 0; width: 30px; height: 30px; }
.nf-row:hover .nf-row__del, .nf-row__del:focus-visible { opacity: 1; }

.nf-empty { padding: 34px 20px 30px; text-align: center; }
.nf-empty__icon { width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #ffb347; background: rgba(255,138,42,0.1); border: 1px solid rgba(255,138,42,0.25); }
.nf-empty__title { font-size: 15px; font-weight: 800; }
.nf-empty__sub { margin-top: 4px; font-size: 13px; color: rgba(255,255,255,0.62); }
.nf-skel { height: 58px; margin: 6px 4px; border-radius: 14px; background: linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04)); background-size: 200% 100%; animation: nfShimmer 1.2s linear infinite; }

.nf-confirm { margin: 0 16px 10px; padding: 12px; border-radius: 14px; background: rgba(255,107,133,0.08); border: 1px solid rgba(255,107,133,0.3); font-size: 13px; }
.nf-confirm__btns { display: flex; gap: 8px; margin-top: 10px; }
.nf-btn { min-height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: #fff; font: 700 12.5px "DM Sans", sans-serif; cursor: pointer; }
.nf-btn.is-danger { border: 0; background: #ff6b85; color: #1a0e06; }

/* Mobile: bottom sheet */
.nf-sheetScrim { position: fixed; inset: 0; z-index: 2147483600; background: rgba(5,3,12,0.6); animation: nfFade .2s ease both; }
.nf-panel.is-sheet { position: fixed; top: auto; left: 0; right: 0; bottom: 0; width: auto; max-height: 86vh; border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom, 0); animation: nfUp .26s cubic-bezier(.22,1,.36,1) both; }
.nf-grab { width: 40px; height: 4px; margin: 10px auto 0; border-radius: 99px; background: rgba(255,255,255,0.25); }
.nf-panel.is-sheet .nf-row__del { opacity: 1; }

@keyframes nfIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes nfUp { from { transform: translateY(100%); } to { transform: none; } }
@keyframes nfFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes nfShimmer { to { background-position: -200% 0; } }
@keyframes nfRing { 0%,100% { transform: rotate(0); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-12deg); } 45% { transform: rotate(8deg); } 60% { transform: rotate(-5deg); } }
@media (prefers-reduced-motion: reduce) {
  .nf-panel, .nf-panel.is-sheet, .nf-sheetScrim, .nf-bell.is-ringing svg, .nf-skel { animation: none; }
}
`;

/* ── Helpers ──────────────────────────────────────────────────────── */
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const api = (path, opts = {}) =>
  fetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers || {}) },
  });

const idOf = (n) => String(n?._id || n?.id || "");
// The two older components used different field names — accept both.
const isReadOf = (n) => Boolean(n?.read ?? n?.isRead);

// Titles are written server-side and some carry emoji; show them clean.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const clean = (s) =>
  String(s || "")
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .trim();

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const isToday = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

/* ── What kind of notification is this? ──────────────────────────── */
// Returns { cat, icon, color } — cat drives the tabs.
function kindOf(n) {
  const t = `${n?.type || ""} ${n?.event || ""} ${n?.targetType || ""} ${
    n?.title || ""
  }`.toLowerCase();
  const tone = (c) => ({
    color: c,
    bg: `${c}1f`,
    border: `${c}55`,
  });
  if (/price|drop|fare/.test(t))
    return { cat: "trips", Icon: TrendingDown, ...tone("#6ee7a8") };
  if (/xp|reward|rank|badge|level/.test(t))
    return { cat: "rewards", Icon: Star, ...tone("#ffc657") };
  if (/sync|group|someone's in|join/.test(t))
    return { cat: "trips", Icon: Users, ...tone("#c4b5fd") };
  if (/hotel|stay|room/.test(t))
    return { cat: "trips", Icon: BedDouble, ...tone("#ffb347") };
  if (/booking|flight|trip|seat|cancel|refund/.test(t))
    return { cat: "trips", Icon: Plane, ...tone("#ffb347") };
  if (/follow/.test(t))
    return { cat: "social", Icon: UserPlus, ...tone("#8fd0ff") };
  if (/like/.test(t)) return { cat: "social", Icon: Heart, ...tone("#ff8fa3") };
  if (/mention|comment|reply|skyhub|dm|message|post/.test(t))
    return { cat: "social", Icon: MessageCircle, ...tone("#8fd0ff") };
  return { cat: "updates", Icon: Sparkles, ...tone("#ffb347") };
}

const TABS = [
  { key: "all", label: "All" },
  { key: "trips", label: "Trips" },
  { key: "social", label: "SkyHub" },
  { key: "rewards", label: "Rewards" },
  { key: "updates", label: "Updates" },
];

function linkFor(n) {
  if (n.link) return n.link;
  if (n.targetType === "booking" && n.targetId) return "/saved-trips";
  if (n.targetType === "trip" && n.targetId) return "/saved-trips";
  if (n.targetType === "dm" && n.targetId) return `/dm/${n.targetId}`;
  return null;
}

const useIsMobile = () => {
  const query = "(max-width: 768px)";
  const get = () =>
    typeof window !== "undefined" && window.matchMedia(query).matches;
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return mobile;
};

/* ── Component ────────────────────────────────────────────────────── */
export default function Notifications() {
  const navigate = useNavigate();
  const auth = useAuth();
  const userId = auth?.user?.id || auth?.user?._id;
  const mobile = useIsMobile();

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [ringing, setRinging] = useState(false);
  // Rows that were unread when you opened the panel (keeps their dot this visit)
  const [freshIds, setFreshIds] = useState(() => new Set());

  const openRef = useRef(open);
  openRef.current = open;
  const bellRef = useRef(null);
  const panelRef = useRef(null);

  /* Load the list (also the source of truth for the badge) */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/notifications?limit=${LIST_LIMIT}`);
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.notifications)
        ? data.notifications
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setItems(list);
      setUnread(
        typeof data?.unread === "number"
          ? data.unread
          : list.filter((n) => !isReadOf(n)).length
      );
      return list;
    } catch {
      return null;
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  /* Cheap badge-only refresh */
  const refreshCount = useCallback(async () => {
    try {
      const res = await api("/api/notifications/unread-count");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data?.count === "number") {
        setUnread((prev) => {
          if (data.count > prev && !openRef.current) loadList();
          return data.count;
        });
      }
    } catch {
      /* the next socket event or focus will catch up */
    }
  }, [loadList]);

  /* Seen: clear the badge everywhere, keep dots for this visit */
  const markAllSeen = useCallback(async (list) => {
    const unreadNow = (list || []).filter((n) => !isReadOf(n));
    setFreshIds(new Set(unreadNow.map(idOf)));
    if (!unreadNow.length) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    try {
      await api("/api/notifications/read-all", { method: "PATCH" });
    } catch {
      /* re-syncs on next load */
    }
  }, []);

  /* Badge on page load */
  useEffect(() => {
    if (userId) loadList();
  }, [userId, loadList]);

  /* Live updates over Socket.IO */
  useEffect(() => {
    if (!userId || !socket) return;
    const join = () => socket.emit("notifications:join", { userId });
    join();

    const onNew = (payload) => {
      const { unread: serverUnread, ...n } = payload || {};
      const id = idOf(n);
      if (!id) return;
      let wasUnread = false;
      const seenNow = openRef.current;
      setItems((prev) => {
        const existing = prev.find((x) => idOf(x) === id);
        wasUnread = !!existing && !isReadOf(existing);
        return [
          { ...n, read: seenNow, isRead: seenNow },
          ...prev.filter((x) => idOf(x) !== id),
        ].slice(0, LIST_LIMIT);
      });

      if (seenNow) {
        // Panel is open — it's seen right away, but keep its dot
        setFreshIds((s) => new Set(s).add(id));
        api(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: "PATCH",
        }).catch(() => {});
        return;
      }
      if (typeof serverUnread === "number") setUnread(serverUnread);
      else if (!wasUnread) setUnread((u) => u + 1);

      setRinging(true);
      setTimeout(() => setRinging(false), 950);
      const title = clean(n.title) || "New notification";
      toast(title, {
        id: `nf-${id}`,
        duration: 3500,
        style: {
          background: "rgba(16,11,34,0.97)",
          color: "#fff",
          border: "1px solid rgba(255,138,42,0.4)",
          borderRadius: 14,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13.5,
        },
        icon: <Bell size={16} color="#ffb347" />,
      });
    };

    const onUnread = ({ unread: serverUnread } = {}) => {
      if (typeof serverUnread === "number") setUnread(serverUnread);
      if (!openRef.current) loadList();
    };

    socket.on("connect", join);
    socket.on("notification:new", onNew);
    socket.on("notification:unread", onUnread);
    return () => {
      socket.off("connect", join);
      socket.off("notification:new", onNew);
      socket.off("notification:unread", onUnread);
    };
  }, [userId, loadList]);

  /* Re-sync when you come back to the tab, plus a light poll fallback */
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible" && !socket?.connected)
        refreshCount();
    }, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(iv);
    };
  }, [userId, refreshCount]);

  /* Open → fetch fresh, then mark seen */
  useEffect(() => {
    if (!open) {
      setConfirmClear(false);
      return;
    }
    let alive = true;
    loadList().then((list) => {
      if (alive && list) markAllSeen(list);
    });
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, loadList, markAllSeen]);

  /* Escape closes; lock page scroll behind the mobile sheet */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, mobile]);

  /* Show the unread count in the browser tab title too */
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title =
      unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
  }, [unread]);

  /* ── Actions ── */
  const openItem = (n) => {
    const link = linkFor(n);
    setOpen(false);
    if (link) navigate(link);
  };

  const removeOne = async (n) => {
    const id = idOf(n);
    const before = items;
    setItems((p) => p.filter((x) => idOf(x) !== id));
    try {
      const res = await api(`/api/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(before);
      toast.error("Couldn't remove that notification");
    }
  };

  const clearAll = async () => {
    const before = items;
    setItems([]);
    setConfirmClear(false);
    try {
      const res = await api("/api/notifications/clear", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(before);
      toast.error("Couldn't clear notifications");
    }
  };

  /* ── Derived ── */
  const tabs = useMemo(() => {
    const counts = items.reduce((acc, n) => {
      const c = kindOf(n).cat;
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});
    return TABS.filter((t) => t.key === "all" || counts[t.key]);
  }, [items]);
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "all";

  const shown = useMemo(
    () =>
      activeTab === "all"
        ? items
        : items.filter((n) => kindOf(n).cat === activeTab),
    [items, activeTab]
  );
  const groups = useMemo(() => {
    const today = [];
    const earlier = [];
    shown.forEach((n) =>
      (isToday(n.updatedAt || n.createdAt) ? today : earlier).push(n)
    );
    return [
      { label: "Today", list: today },
      { label: "Earlier", list: earlier },
    ].filter((g) => g.list.length);
  }, [shown]);

  const newCount = freshIds.size;

  /* ── Panel ── */
  const panel = (
    <div
      ref={panelRef}
      className={`nf-panel${mobile ? " is-sheet" : ""}`}
      role="dialog"
      aria-modal={mobile ? "true" : undefined}
      aria-label="Notifications"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
    >
      {mobile && <div className="nf-grab" aria-hidden="true" />}

      <div className="nf-head">
        <div>
          <h2 className="nf-title">Notifications</h2>
          <div className="nf-sub">
            {newCount > 0
              ? `${newCount} new since your last visit`
              : items.length
              ? "You're all caught up"
              : "Nothing here yet"}
          </div>
        </div>
        <div className="nf-actions">
          <button
            type="button"
            className="nf-iconBtn"
            onClick={() => markAllSeen(items)}
            disabled={!items.some((n) => !isReadOf(n))}
            aria-label="Mark all as read"
            title="Mark all as read"
          >
            <CheckCheck size={17} />
          </button>
          <button
            type="button"
            className="nf-iconBtn is-danger"
            onClick={() => setConfirmClear(true)}
            disabled={!items.length}
            aria-label="Clear all notifications"
            title="Clear all"
          >
            <Trash2 size={16} />
          </button>
          {mobile && (
            <button
              type="button"
              className="nf-iconBtn"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {confirmClear && (
        <div className="nf-confirm" role="alertdialog" aria-label="Clear all">
          Clear all {items.length} notifications? This can&rsquo;t be undone.
          <div className="nf-confirm__btns">
            <button
              type="button"
              className="nf-btn is-danger"
              onClick={clearAll}
            >
              Clear all
            </button>
            <button
              type="button"
              className="nf-btn"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tabs.length > 1 && (
        <div
          className="nf-tabs"
          role="tablist"
          aria-label="Filter notifications"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`nf-tab${activeTab === t.key ? " is-on" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="nf-body">
        {!loaded && loading ? (
          <>
            <div className="nf-skel" />
            <div className="nf-skel" />
            <div className="nf-skel" />
          </>
        ) : !shown.length ? (
          <div className="nf-empty">
            <div className="nf-empty__icon">
              <Bell size={22} />
            </div>
            <div className="nf-empty__title">You&rsquo;re all caught up</div>
            <div className="nf-empty__sub">
              Booking updates, XP, group trips and SkyHub replies will show up
              here.
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="nf-group">{g.label}</div>
              {g.list.map((n) => {
                const id = idOf(n);
                const k = kindOf(n);
                const isNew = freshIds.has(id) || !isReadOf(n);
                const title = clean(n.title) || "Notification";
                const msg = clean(n.message);
                const count = n?.metadata?.count;
                return (
                  <div key={id} className={`nf-row${isNew ? " is-new" : ""}`}>
                    <button
                      type="button"
                      className="nf-row__link"
                      onClick={() => openItem(n)}
                      aria-label={`${isNew ? "New: " : ""}${title}. ${msg}`}
                    />
                    <span
                      className="nf-row__icon"
                      style={{
                        color: k.color,
                        background: k.bg,
                        border: `1px solid ${k.border}`,
                      }}
                    >
                      <k.Icon size={17} />
                    </span>
                    <div className="nf-row__text">
                      <div className="nf-row__title">
                        {title}
                        {count > 1 && (
                          <span style={{ color: "#ffb347", fontSize: 12 }}>
                            · {count} new
                          </span>
                        )}
                      </div>
                      {msg && <div className="nf-row__msg">{msg}</div>}
                      <div className="nf-row__time">
                        {timeAgo(n.updatedAt || n.createdAt)}
                      </div>
                    </div>
                    <div className="nf-row__right">
                      {isNew && <span className="nf-dot" aria-hidden="true" />}
                      <button
                        type="button"
                        className="nf-iconBtn nf-row__del"
                        onClick={() => removeOne(n)}
                        aria-label={`Remove: ${title}`}
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="nf">
      <style>{NF_CSS}</style>
      <button
        ref={bellRef}
        type="button"
        className={`nf-bell${open ? " is-open" : ""}${
          ringing ? " is-ringing" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="nf-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open &&
        (mobile ? (
          createPortal(
            <>
              <div className="nf-sheetScrim" onClick={() => setOpen(false)} />
              {panel}
            </>,
            document.body
          )
        ) : (
          <>
            <div className="nf-scrim" onClick={() => setOpen(false)} />
            {panel}
          </>
        ))}
    </div>
  );
}
