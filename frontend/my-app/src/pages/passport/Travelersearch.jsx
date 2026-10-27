import React, { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, MapPin } from "lucide-react";
import { apiUrl } from "@/lib/api";
import FollowButton from "./FollowButton";
import PlaneBadge from "./PlaneBadge";

// ─────────────────────────────────────────────────────────────
// Find Travelers search
// - Live results while typing (cancels stale requests)
// - Whole row is clickable, matched text is highlighted
// - Keyboard: ↑ ↓ to move, Enter to open, Esc to clear/close, "/" to focus
// - Recently opened travelers shown before typing
// - Skeleton while loading, retry on error, no "no results" flash
// ─────────────────────────────────────────────────────────────

const RECENT_KEY = "skyrio_recent_travelers";
const MAX_RECENT = 5;
const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

const TS_CSS = `
.ts-wrap { position: relative; width: 100%; font-family: "DM Sans", system-ui, sans-serif; }
.ts-box { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 10px 0 14px;
  border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  transition: border-color .15s, box-shadow .15s; }
.ts-box:focus-within { border-color: rgba(255,138,42,0.65); box-shadow: 0 0 0 3px rgba(255,138,42,0.14); }
.ts-icon { color: rgba(255,255,255,0.5); flex-shrink: 0; }
.ts-input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: #fff;
  font: 500 14.5px "DM Sans", system-ui, sans-serif; }
.ts-input::placeholder { color: rgba(255,255,255,0.45); }
.ts-input::-webkit-search-cancel-button { display: none; }
.ts-kbd { display: none; font: 600 11px "JetBrains Mono", ui-monospace, monospace; color: rgba(255,255,255,0.5);
  border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 1px 7px; }
@media (hover: hover) { .ts-kbd { display: inline-block; } }
.ts-clear { width: 30px; height: 30px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: transparent; color: rgba(255,255,255,0.55); cursor: pointer; }
.ts-clear:hover { background: rgba(255,255,255,0.08); color: #fff; }
.ts-spin { flex-shrink: 0; color: #ffb347; animation: tsSpin 1s linear infinite; }

.ts-drop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 9999; padding: 6px;
  background: rgba(22,16,42,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0,0,0,0.6); max-height: 420px; overflow-y: auto; overscroll-behavior: contain;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: tsIn .14s ease;
  scrollbar-width: thin; scrollbar-color: rgba(255,138,42,0.45) transparent; }
.ts-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 6px;
  font: 600 10.5px "JetBrains Mono", ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase;
  color: rgba(255,255,255,0.55); }
.ts-link { border: 0; background: none; padding: 2px 4px; cursor: pointer; color: rgba(255,255,255,0.6);
  font: 600 12px "DM Sans", system-ui, sans-serif; letter-spacing: 0; text-transform: none;
  text-decoration: underline; text-underline-offset: 3px; }
.ts-link:hover { color: #ffb347; }
.ts-list { list-style: none; margin: 0; padding: 0; }
.ts-row { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 10px; cursor: pointer; }
.ts-row.is-active { background: rgba(255,138,42,0.1); }
.ts-av { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, rgba(124,92,252,0.35), rgba(255,138,42,0.35)); }
.ts-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ts-meta { flex: 1; min-width: 0; }
.ts-name { font-size: 14px; font-weight: 600; color: #fff; line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ts-sub { display: flex; align-items: center; gap: 6px; margin-top: 2px; min-width: 0;
  font-size: 12px; color: rgba(255,255,255,0.58); }
.ts-sub > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ts-dot { opacity: .5; }
.ts-city { display: inline-flex; align-items: center; gap: 3px; }
.ts-mark { background: none; padding: 0; color: #ffb347; font-weight: 700; }
.ts-you { font: 600 10.5px "JetBrains Mono", ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; padding: 3px 8px; }
.ts-remove { width: 28px; height: 28px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: transparent; color: rgba(255,255,255,0.45); cursor: pointer; }
.ts-remove:hover { background: rgba(255,255,255,0.08); color: #fff; }
.ts-empty { padding: 18px 14px; text-align: center; font-size: 13px; line-height: 1.55; color: rgba(255,255,255,0.62); }
.ts-empty strong { color: #fff; }
.ts-retry { margin-top: 10px; min-height: 34px; padding: 0 14px; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(255,138,42,0.5); background: rgba(255,138,42,0.12); color: #ffb347;
  font: 700 12.5px "DM Sans", system-ui, sans-serif; }
.ts-skel { display: flex; align-items: center; gap: 12px; padding: 9px 10px; }
.ts-skel i { display: block; border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.13), rgba(255,255,255,0.06));
  background-size: 200% 100%; animation: tsShimmer 1.2s linear infinite; }
.ts-hint { display: none; padding: 8px 10px 4px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px;
  font-size: 11.5px; color: rgba(255,255,255,0.45); }
@media (hover: hover) { .ts-hint { display: block; } }
.ts-wrap :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
.ts-wrap .ts-input:focus-visible { outline: none; }
@keyframes tsSpin { to { transform: rotate(360deg); } }
@keyframes tsIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@keyframes tsShimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .ts-drop, .ts-skel i, .ts-spin { animation: none; } }
`;

const normalize = (q) =>
  String(q || "")
    .trim()
    .replace(/^@+/, "");
const userId = (u) => String(u?._id || u?.id || "");

function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v)
      ? v.filter((r) => r?.username).slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}
function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

function Highlight({ text, query }) {
  const t = String(text || "");
  if (!query) return t;
  const i = t.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return t;
  return (
    <>
      {t.slice(0, i)}
      <mark className="ts-mark">{t.slice(i, i + query.length)}</mark>
      {t.slice(i + query.length)}
    </>
  );
}

function Avatar({ u }) {
  const [broken, setBroken] = useState(false);
  const hasImg = u.avatar && u.avatar !== "/default-avatar.png" && !broken;
  return (
    <div className="ts-av" aria-hidden="true">
      {hasImg ? (
        <img
          src={u.avatar}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        (u.name || u.username || "?")[0].toUpperCase()
      )}
    </div>
  );
}

function SkeletonRows() {
  return [0, 1, 2].map((i) => (
    <div key={i} className="ts-skel" aria-hidden="true">
      <i style={{ width: 40, height: 40 }} />
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}
      >
        <i style={{ width: `${55 - i * 10}%`, height: 11 }} />
        <i style={{ width: `${35 - i * 5}%`, height: 9 }} />
      </div>
    </div>
  ));
}

/**
 * props:
 *  token           auth token
 *  myId            current user's id (hides Follow on yourself)
 *  onFollowChange  (nowFollowing) => void
 */
export default function TravelerSearch({ token, myId, onFollowChange }) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const q = normalize(query);
  const mode = q.length >= MIN_CHARS ? "results" : "recent";
  const items = mode === "results" ? results : recent;

  // Live search — debounced, and older requests are cancelled so a slow
  // response can never overwrite newer results.
  useEffect(() => {
    if (q.length < MIN_CHARS) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/follow/search?q=${encodeURIComponent(q)}&limit=8`),
          {
            credentials: "include",
            signal: ctrl.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error("search failed");
        setResults(data.users || []);
        setStatus("done");
      } catch (err) {
        if (err?.name === "AbortError") return;
        setResults([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, token, retry]);

  // New list → nothing highlighted yet.
  useEffect(() => setActiveIndex(-1), [results, mode]);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    if (activeIndex < 0) return;
    dropRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // "/" anywhere on the page jumps to the search box.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']"))
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const rememberTraveler = (u) => {
    const entry = {
      _id: u._id || u.id,
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      verifiedTier: u.verifiedTier || null,
    };
    const next = [
      entry,
      ...recent.filter((r) => r.username !== u.username),
    ].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(next);
  };

  const openTraveler = (u) => {
    if (!u?.username) return;
    rememberTraveler(u);
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/u/${u.username}`);
  };

  const removeRecent = (username) => {
    const next = recent.filter((r) => r.username !== username);
    setRecent(next);
    writeRecent(next);
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const handleFollowToggle = (id, nowFollowing) => {
    setResults((prev) =>
      prev.map((u) =>
        userId(u) === String(id) ? { ...u, isFollowing: nowFollowing } : u
      )
    );
    onFollowChange?.(nowFollowing);
  };

  const onKeyDown = (e) => {
    const n = items.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (n) setActiveIndex((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (n) setActiveIndex((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        openTraveler(items[activeIndex]);
      } else if (mode === "results" && results.length === 1) {
        e.preventDefault();
        openTraveler(results[0]);
      }
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const optionId = (i) => `${listId}-opt-${i}`;
  const showList =
    items.length > 0 && !(mode === "results" && status === "error");

  const renderRow = (u, i) => {
    const isSelf = myId && userId(u) === String(myId);
    const city = u.city || u.homeBase;
    return (
      <li
        key={userId(u) || u.username}
        id={optionId(i)}
        data-index={i}
        role="option"
        aria-selected={i === activeIndex}
        className={`ts-row${i === activeIndex ? " is-active" : ""}`}
        onMouseMove={() => activeIndex !== i && setActiveIndex(i)}
        onClick={() => openTraveler(u)}
      >
        <Avatar u={u} />
        <div className="ts-meta">
          <div className="ts-name">
            <Highlight
              text={u.name || u.username}
              query={mode === "results" ? q : ""}
            />
          </div>
          <div className="ts-sub">
            <span>
              @
              <Highlight
                text={u.username}
                query={mode === "results" ? q : ""}
              />
            </span>
            {u.verifiedTier && <PlaneBadge tier={u.verifiedTier} size={12} />}
            {mode === "results" && city && typeof city === "string" && (
              <>
                <span className="ts-dot">·</span>
                <span className="ts-city">
                  <MapPin size={11} aria-hidden="true" />
                  {city}
                </span>
              </>
            )}
          </div>
        </div>

        {mode === "recent" ? (
          <button
            type="button"
            className="ts-remove"
            aria-label={`Remove ${u.username} from recent`}
            onClick={(e) => {
              e.stopPropagation();
              removeRecent(u.username);
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : isSelf ? (
          <span className="ts-you">You</span>
        ) : (
          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            <FollowButton
              userId={u._id || u.id}
              isFollowing={!!u.isFollowing}
              size="small"
              token={token}
              onToggle={(now) => handleFollowToggle(u._id || u.id, now)}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <div ref={wrapperRef} className="ts-wrap">
      <style>{TS_CSS}</style>

      <div className="ts-box">
        <Search size={16} className="ts-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="ts-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by name or @username"
          aria-label="Search travelers"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {status === "loading" && results.length > 0 && (
          <Loader2 size={15} className="ts-spin" aria-hidden="true" />
        )}
        {query ? (
          <button
            type="button"
            className="ts-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : (
          !open && (
            <kbd className="ts-kbd" aria-hidden="true">
              /
            </kbd>
          )
        )}
      </div>

      {open && (
        <div ref={dropRef} className="ts-drop">
          {/* Before typing: recently opened travelers */}
          {mode === "recent" && recent.length > 0 && (
            <div className="ts-head">
              <span>Recent</span>
              <button type="button" className="ts-link" onClick={clearRecent}>
                Clear
              </button>
            </div>
          )}
          {mode === "recent" && recent.length === 0 && (
            <div className="ts-empty">
              Find friends by name or <strong>@username</strong>.
            </div>
          )}

          {/* While searching with nothing to show yet */}
          {mode === "results" &&
            status === "loading" &&
            results.length === 0 && <SkeletonRows />}

          {mode === "results" && status === "error" && (
            <div className="ts-empty" role="alert">
              Couldn't search right now.
              <br />
              <button
                type="button"
                className="ts-retry"
                onClick={() => setRetry((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {mode === "results" && status === "done" && results.length === 0 && (
            <div className="ts-empty">
              No travelers match <strong>"{q}"</strong>.
              <br />
              Check the spelling or try their @username.
            </div>
          )}

          <ul
            id={listId}
            role="listbox"
            aria-label="Travelers"
            className="ts-list"
            hidden={!showList}
          >
            {showList && items.map(renderRow)}
          </ul>

          {showList && (
            <div className="ts-hint">
              ↑ ↓ to move · Enter to open · Esc to close
            </div>
          )}

          <div
            aria-live="polite"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            {mode === "results" && status === "done"
              ? `${results.length} traveler${
                  results.length === 1 ? "" : "s"
                } found`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}
