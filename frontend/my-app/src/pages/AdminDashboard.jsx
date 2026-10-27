import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Switch,
  message,
  Popconfirm,
} from "antd";
import {
  TrophyOutlined,
  FlagOutlined,
  FireOutlined,
  RocketOutlined,
  GiftOutlined,
  StarOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  HeartOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { apiUrl } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════════════════
   API
   One helper for every admin call: sends the session cookie, the login
   token, and the admin email header, so no call site repeats them.
   ═══════════════════════════════════════════════════════════════════════════ */

/* skyhub-login */
function adminFetch(path, { headers, ...opts } = {}) {
  const token = localStorage.getItem("token");
  return fetch(apiUrl(path), {
    credentials: "include",
    ...opts,
    headers: {
      "x-admin-email": localStorage.getItem("admin_email") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

/** JSON request that throws on a non-2xx response or `{ ok: false }`. */
async function adminRequest(path, { method = "GET", body } = {}) {
  const res = await adminFetch(path, {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(json.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function clearAdminSession() {
  localStorage.removeItem("admin");
  localStorage.removeItem("admin_email");
}

/**
 * Loads data and tracks loading/error state. Reloads when `key` changes,
 * optionally polls every `intervalMs` (silently, no spinner), and ignores
 * responses that arrive after a newer request has started.
 */
function useLoader(load, { key = "", intervalMs = 0 } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const loadRef = useRef(load);
  loadRef.current = load;
  const requestId = useRef(0);

  const reload = useCallback(async ({ silent = false } = {}) => {
    const id = ++requestId.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await loadRef.current();
      if (id === requestId.current)
        setState({ data, loading: false, error: "" });
    } catch (err) {
      if (id === requestId.current) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || "Something went wrong.",
        }));
      }
    }
  }, []);

  useEffect(() => {
    reload();
    if (!intervalMs) return undefined;
    const t = setInterval(() => reload({ silent: true }), intervalMs);
    return () => clearInterval(t);
  }, [reload, intervalMs, key]);

  return { ...state, reload };
}

/** Re-renders every `ms` so relative times ("3m ago") stay current. */
function useTick(ms = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CHALLENGE_ICONS = [
  { key: "trophy", label: "Trophy", Icon: TrophyOutlined },
  { key: "flag", label: "Flag", Icon: FlagOutlined },
  { key: "fire", label: "Fire", Icon: FireOutlined },
  { key: "rocket", label: "Rocket", Icon: RocketOutlined },
  { key: "gift", label: "Gift", Icon: GiftOutlined },
  { key: "star", label: "Star", Icon: StarOutlined },
  { key: "crown", label: "Crown", Icon: CrownOutlined },
  { key: "thunderbolt", label: "Bolt", Icon: ThunderboltOutlined },
  { key: "team", label: "Team", Icon: TeamOutlined },
  { key: "heart", label: "Heart", Icon: HeartOutlined },
  { key: "calendar", label: "Calendar", Icon: CalendarOutlined },
  { key: "environment", label: "Destination", Icon: EnvironmentOutlined },
];

const REWARD_TYPES = [
  { value: "BOOST", label: "Boost" },
  { value: "BADGE", label: "Badge" },
  { value: "PERK", label: "Perk" },
  { value: "LIMITED", label: "Limited" },
];

const CHALLENGE_ACTION_TYPES = [
  { value: "BOOKING_CONFIRMED", label: "Booking confirmed" },
  { value: "SAVED_TRIP", label: "Saved a trip" },
  { value: "POST_CREATED", label: "Created a SkyHub post" },
  { value: "COMMENT_CREATED", label: "Commented on SkyHub" },
  { value: "REFER_FRIEND", label: "Referred a friend" },
  { value: "PROFILE_COMPLETED", label: "Completed profile" },
  { value: "FEEDBACK_SUBMITTED", label: "Submitted feedback" },
  { value: "SHARE_SKYSTREAM", label: "Shared on SkyStream" },
  { value: "STREAK_DAY", label: "Daily login streak" },
];

const ACTION_LABELS = Object.fromEntries(
  CHALLENGE_ACTION_TYPES.map((a) => [a.value, a.label])
);

const TAKEDOWN_FILTERS = [
  ["received", "Waiting"],
  ["removed", "Removed"],
  ["rejected", "Rejected"],
  ["restored", "Restored"],
];

const TABS = ["overview", "moderation", "engagement"];

const C = {
  bg: "#07060f",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  orange: "#ff8a2a",
  purple: "#7c5cfc",
  green: "#34d399",
  red: "#f87171",
  blue: "#60a5fa",
  amber: "#ffb347",
  white: "#fff",
  text: "rgba(255,255,255,0.75)",
  muted: "rgba(255,255,255,0.45)",
};

/** Foreground + tinted background pairs. Use these instead of `color + "20"`,
 *  which silently breaks for non-hex colors like C.muted. */
const TONES = {
  orange: { fg: C.orange, bg: "rgba(255,138,42,0.12)" },
  purple: { fg: C.purple, bg: "rgba(124,92,252,0.14)" },
  green: { fg: C.green, bg: "rgba(52,211,153,0.12)" },
  red: { fg: C.red, bg: "rgba(248,113,113,0.13)" },
  blue: { fg: C.blue, bg: "rgba(96,165,250,0.12)" },
  amber: { fg: C.amber, bg: "rgba(255,179,71,0.14)" },
  muted: { fg: C.muted, bg: "rgba(255,255,255,0.06)" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const INJECTED_CSS = `
  .sk-admin * { box-sizing: border-box; }
  .sk-admin { min-height: 100vh; background: ${C.bg}; color: ${C.white}; font-family: "DM Sans", sans-serif; }

  /* Top bar + tabs */
  .sk-top { position: sticky; top: 0; z-index: 50; background: rgba(7,6,15,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid ${C.border}; }
  .sk-top__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 32px 0; max-width: 1300px; margin: 0 auto; }
  .sk-top__logo { font-family: "Syne", sans-serif; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .sk-top__badge { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; background: ${TONES.orange.bg}; border: 1px solid rgba(255,138,42,0.3); color: ${C.orange}; border-radius: 999px; padding: 3px 10px; }
  .sk-top__right { display: flex; align-items: center; gap: 10px; }
  .sk-top__updated { font-size: 11px; color: ${C.muted}; }
  .sk-tabs { display: flex; gap: 4px; padding: 0 32px; max-width: 1300px; margin: 10px auto 0; overflow-x: auto; }
  .sk-tabs__tab { background: none; border: none; border-bottom: 2px solid transparent; color: ${C.muted}; padding: 10px 14px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; transition: color .15s, border-color .15s; }
  .sk-tabs__tab:hover { color: ${C.white}; }
  .sk-tabs__tab[aria-selected="true"] { color: ${C.white}; border-bottom-color: ${C.orange}; }
  .sk-tabs__count { font-size: 10px; font-weight: 800; background: ${C.red}; color: #fff; border-radius: 999px; padding: 1px 7px; }

  .sk-btn { background: none; border: 1px solid ${C.border}; color: ${C.muted}; padding: 6px 14px; border-radius: 999px; font: inherit; font-size: 12px; cursor: pointer; transition: border-color .2s, color .2s; }
  .sk-btn:hover:not(:disabled) { border-color: ${C.orange}; color: ${C.orange}; }
  .sk-btn:disabled { opacity: .5; cursor: default; }
  .sk-btn--sm { padding: 4px 10px; font-size: 11px; }
  .sk-btn--active { border-color: ${C.orange}; color: ${C.orange}; }
  .sk-btn--danger:hover:not(:disabled) { border-color: ${C.red}; color: ${C.red}; }

  /* Layout */
  .sk-body { padding: 28px 32px 48px; max-width: 1300px; margin: 0 auto; }
  .sk-section { margin-bottom: 32px; }
  .sk-section__title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${C.muted}; margin: 0 0 14px; }
  .sk-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .sk-stack { display: flex; flex-direction: column; gap: 20px; }
  .sk-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .sk-stats--3 { grid-template-columns: repeat(3, 1fr); }
  .sk-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  @media (max-width: 900px) {
    .sk-stats, .sk-stats--3 { grid-template-columns: repeat(2, 1fr); }
    .sk-grid-2 { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .sk-top__bar, .sk-tabs { padding-left: 16px; padding-right: 16px; }
    .sk-body { padding: 20px 16px 40px; }
    .sk-stats, .sk-stats--3 { grid-template-columns: 1fr; }
    .sk-top__updated { display: none; }
  }

  /* Alert */
  .sk-alert { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${TONES.red.bg}; border: 1px solid ${C.red}; border-radius: 12px; padding: 12px 18px; color: #fecaca; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
  .sk-alert--soft { border-color: rgba(248,113,113,0.3); color: ${C.red}; font-weight: 500; }

  /* Attention tiles */
  .sk-tile { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; padding: 16px 18px; background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; color: inherit; font: inherit; cursor: pointer; transition: border-color .2s, background .2s, transform .2s; }
  .sk-tile:hover { border-color: rgba(255,138,42,0.45); background: rgba(255,138,42,0.06); transform: translateY(-1px); }
  .sk-tile--hot { border-color: rgba(255,138,42,0.35); background: rgba(255,138,42,0.07); }
  .sk-tile--urgent { border-color: rgba(248,113,113,0.55); background: rgba(248,113,113,0.08); }
  .sk-tile__icon { width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 19px; background: rgba(255,255,255,0.05); border: 1px solid ${C.border}; }
  .sk-tile__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .sk-tile__title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .sk-tile__sub { font-size: 12px; color: ${C.muted}; }
  .sk-tile__arrow { color: ${C.orange}; font-size: 18px; font-weight: 700; flex-shrink: 0; }

  /* Stat cards */
  .sk-stat { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 18px; }
  .sk-stat__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .sk-stat__label { font-size: 12px; color: ${C.muted}; }
  .sk-stat__icon { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .sk-stat__val { font-family: "Syne", sans-serif; font-size: 26px; font-weight: 800; line-height: 1; min-height: 26px; }
  .sk-stat__hint { font-size: 11px; color: ${C.muted}; margin-top: 8px; }

  /* Panels + rows */
  .sk-panel { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; overflow: hidden; }
  .sk-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid ${C.border}; flex-wrap: wrap; }
  .sk-panel__title { margin: 0; font-size: 13px; font-weight: 700; color: ${C.white}; }
  .sk-panel__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sk-panel__meta { font-size: 11px; color: ${C.muted}; background: rgba(255,255,255,0.06); border-radius: 999px; padding: 2px 10px; }
  .sk-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 20px; border-bottom: 1px solid ${C.border}; transition: background .15s; }
  .sk-row:last-child { border-bottom: none; }
  .sk-row:hover { background: rgba(255,255,255,0.025); }
  .sk-row--top { align-items: flex-start; }
  .sk-row__left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
  .sk-row__right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .sk-row__right--col { flex-direction: column; align-items: flex-end; gap: 4px; }
  .sk-row__icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; background: ${TONES.orange.bg}; border: 1px solid rgba(255,138,42,0.3); color: ${C.orange}; }
  .sk-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, ${C.purple}, ${C.orange}); }
  .sk-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .sk-name { font-size: 13px; font-weight: 600; color: ${C.white}; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sk-sub { font-size: 11px; color: ${C.muted}; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
  .sk-text { font-size: 13px; color: ${C.text}; line-height: 1.5; margin-top: 6px; word-break: break-word; }
  .sk-mono { font-family: ui-monospace, monospace; letter-spacing: 0.05em; }
  .sk-amount { font-size: 12px; font-weight: 700; }

  .sk-pill { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }

  .sk-feed__item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 20px; border-bottom: 1px solid ${C.border}; }
  .sk-feed__item:last-child { border-bottom: none; }
  .sk-feed__dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }

  .sk-rev { display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; }
  .sk-rev__label { display: flex; justify-content: space-between; font-size: 12px; color: ${C.muted}; margin-bottom: 5px; }
  .sk-rev__bar { height: 6px; background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; }
  .sk-rev__fill { height: 100%; border-radius: 999px; transition: width .8s ease; }

  .sk-rank { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; border-bottom: 1px solid ${C.border}; font-size: 13px; }
  .sk-rank:last-child { border-bottom: none; }
  .sk-rank__pos { font-size: 11px; color: ${C.muted}; width: 22px; display: inline-block; }

  .sk-empty { padding: 32px 20px; text-align: center; font-size: 13px; color: ${C.muted}; }
  .sk-spinner { width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); border-top-color: ${C.orange}; animation: sk-spin .7s linear infinite; display: inline-block; vertical-align: middle; }
  @keyframes sk-spin { to { transform: rotate(360deg); } }

  /* Icon picker */
  .sk-icons { display: flex; flex-wrap: wrap; gap: 8px; }
  .sk-icons__btn { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.6); transition: all .15s; }
  .sk-icons__btn[aria-pressed="true"] { background: rgba(255,138,42,0.18); border-color: ${C.orange}; color: ${C.orange}; }

  /* Modals (antd overrides) */
  .sk-modal-hint { color: rgba(255,255,255,0.65); font-size: 13px; }
  .sk-modal-label { font-size: 12px; color: ${C.muted}; margin: 10px 0 4px; }
  .sk-field-help { color: rgba(255,255,255,0.4); }
  .sk-challenge-modal .ant-form-item-label > label { color: rgba(255,255,255,0.7) !important; }
  .sk-challenge-modal .ant-input,
  .sk-challenge-modal textarea.ant-input,
  .sk-challenge-modal .ant-input-number,
  .sk-challenge-modal .ant-select-selector,
  .sk-challenge-modal .ant-picker {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.15) !important;
  }
  .sk-challenge-modal .ant-input,
  .sk-challenge-modal textarea.ant-input,
  .sk-challenge-modal .ant-input-number-input,
  .sk-challenge-modal .ant-picker-input input,
  .sk-challenge-modal .ant-select-selection-item,
  .sk-challenge-modal .ant-select-selection-placeholder { color: #fff !important; }
  .sk-challenge-modal .ant-input::placeholder { color: rgba(255,255,255,0.35) !important; }
  .sk-challenge-modal .ant-select-selection-item {
    background: rgba(255,138,42,0.18) !important;
    border-color: rgba(255,138,42,0.4) !important;
  }
  .sk-challenge-modal .ant-picker-separator,
  .sk-challenge-modal .ant-picker-suffix { color: rgba(255,255,255,0.5) !important; }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════════════════════════════════════════════ */

function timeAgo(date) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(date)) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name = "") {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

const fmt$ = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtNum = (n) => Number(n || 0).toLocaleString();

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

const fmtRange = (start, end) =>
  `${dayjs(start).format("MMM D")} – ${dayjs(end).format("MMM D, YYYY")}`;

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

const Spinner = () => <span className="sk-spinner" />;

function Pill({ tone = "muted", children }) {
  const t = TONES[tone] || TONES.muted;
  return (
    <span className="sk-pill" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="sk-section">
      {title && <h2 className="sk-section__title">{title}</h2>}
      {children}
    </section>
  );
}

function Panel({ title, meta, actions, children }) {
  return (
    <section className="sk-panel">
      <header className="sk-panel__head">
        <h3 className="sk-panel__title">{title}</h3>
        {(meta != null || actions) && (
          <div className="sk-panel__actions">
            {meta != null && <span className="sk-panel__meta">{meta}</span>}
            {actions}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

/** Spinner while the first load is running, empty text if nothing came back. */
function PanelContent({ loading, isEmpty, emptyText, children }) {
  if (isEmpty) {
    return <div className="sk-empty">{loading ? <Spinner /> : emptyText}</div>;
  }
  return children;
}

function StatCard({ icon, label, value, hint, tone = "muted" }) {
  const t = TONES[tone];
  return (
    <div className="sk-stat">
      <div className="sk-stat__top">
        <span className="sk-stat__label">{label}</span>
        <span
          className="sk-stat__icon"
          style={{ background: t.bg, color: t.fg }}
        >
          {icon}
        </span>
      </div>
      <div className="sk-stat__val">
        {value === undefined ? <Spinner /> : value}
      </div>
      {hint && <div className="sk-stat__hint">{hint}</div>}
    </div>
  );
}

function AttentionTile({ icon, title, sub, badges, state, onClick }) {
  return (
    <button
      type="button"
      className={`sk-tile${state ? ` sk-tile--${state}` : ""}`}
      onClick={onClick}
    >
      <span className="sk-tile__icon" aria-hidden>
        {icon}
      </span>
      <span className="sk-tile__body">
        <span className="sk-tile__title">
          {title}
          {badges}
        </span>
        <span className="sk-tile__sub">{sub}</span>
      </span>
      <span className="sk-tile__arrow" aria-hidden>
        →
      </span>
    </button>
  );
}

function FilterChips({ options, value, onChange }) {
  return (
    <div className="sk-panel__actions">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={`sk-btn sk-btn--sm${value === v ? " sk-btn--active" : ""}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS PILLS
   ═══════════════════════════════════════════════════════════════════════════ */

const BOOKING_TONES = {
  confirmed: "green",
  pending: "orange",
  cancelled: "red",
};

function BookingStatusPill({ status }) {
  return <Pill tone={BOOKING_TONES[status]}>{status || "unknown"}</Pill>;
}

const LEVELS = [
  { min: 2000, label: "Legend", tone: "orange" },
  { min: 1000, label: "Expert", tone: "purple" },
  { min: 500, label: "Adventurer", tone: "blue" },
  { min: 200, label: "Traveler", tone: "green" },
  { min: 0, label: "Explorer", tone: "muted" },
];

function LevelPill({ xp = 0 }) {
  const level = LEVELS.find((l) => xp >= l.min);
  return <Pill tone={level.tone}>{level.label}</Pill>;
}

const CHALLENGE_STATUS = {
  running: { label: "Running", tone: "green", order: 0 },
  upcoming: { label: "Upcoming", tone: "blue", order: 1 },
  finished: { label: "Finished", tone: "muted", order: 2 },
  ended: { label: "Ended early", tone: "red", order: 3 },
};

function challengeStatus(c) {
  const now = Date.now();
  if (!c.active) return "ended";
  if (now < new Date(c.startDate).getTime()) return "upcoming";
  if (now > new Date(c.endDate).getTime()) return "finished";
  return "running";
}

function ChallengeIcon({ iconKey }) {
  const Icon =
    CHALLENGE_ICONS.find((i) => i.key === iconKey)?.Icon || TrophyOutlined;
  return <Icon />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPTY_SKYHUB = {
  reports: 0,
  appeals: 0,
  critical: 0,
  takedowns: 0,
  overdueTakedowns: 0,
};

/** Counts for everything that needs a person: tickets, cancellations, SkyHub. */
function useAttentionCounts(refreshKey) {
  const support = useLoader(
    async () =>
      (await adminRequest("/api/support?status=open&limit=200")).count || 0,
    { key: refreshKey }
  );

  // Cancellation requests (and which are urgent) + flights the airline is
  // still cancelling. Refreshes every 5 minutes — urgent ones cost travelers
  // money if they wait (24-hour free-cancel window, trips leaving soon).
  const cancels = useLoader(
    async () => {
      const j = await adminRequest("/api/bookings/admin/cancel-summary");
      return {
        requests: j.requests || 0,
        urgent: j.urgentRequests || 0,
        oldestAt: j.oldestRequestAt || null,
        cancelling: j.cancelling || 0,
      };
    },
    { key: refreshKey, intervalMs: 5 * 60_000 }
  );

  // Legal clocks are running, so keep this one fresh while the page is open.
  const skyhub = useLoader(
    async () => {
      const j = await adminRequest("/api/skyhub/admin/open-counts");
      return Object.fromEntries(
        Object.keys(EMPTY_SKYHUB).map((k) => [k, j[k] || 0])
      );
    },
    { key: refreshKey, intervalMs: 60_000 }
  );

  return {
    openTickets: support.data ?? 0,
    cancelRequests: cancels.data?.requests ?? 0,
    urgentCancels: cancels.data?.urgent ?? 0,
    oldestCancelAt: cancels.data?.oldestAt ?? null,
    cancellingFlights: cancels.data?.cancelling ?? 0,
    skyhub: skyhub.data ?? EMPTY_SKYHUB,
    reloadSkyhub: skyhub.reload,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function NeedsAttention({ counts, onOpenModeration }) {
  const navigate = useNavigate();
  const {
    openTickets,
    cancelRequests,
    urgentCancels,
    oldestCancelAt,
    cancellingFlights,
    skyhub,
  } = counts;
  const skyhubOpen = skyhub.reports + skyhub.appeals;

  return (
    <div className="sk-tiles">
      <AttentionTile
        icon="📬"
        title="Support inbox"
        state={openTickets > 0 ? "hot" : undefined}
        badges={
          openTickets > 0 && <Pill tone="orange">{openTickets} open</Pill>
        }
        sub={
          openTickets > 0
            ? `${openTickets} ${plural(
                openTickets,
                "ticket"
              )} waiting for a reply`
            : "No open tickets"
        }
        onClick={() => navigate("/admin/support")}
      />
      <AttentionTile
        icon="🧳"
        title="Bookings"
        state={
          urgentCancels > 0 ? "urgent" : cancelRequests > 0 ? "hot" : undefined
        }
        badges={
          <>
            {urgentCancels > 0 && (
              <Pill tone="red">{urgentCancels} urgent</Pill>
            )}
            {cancelRequests > 0 && (
              <Pill tone="amber">
                {cancelRequests} {plural(cancelRequests, "cancellation")}
              </Pill>
            )}
            {cancellingFlights > 0 && (
              <Pill tone="muted">{cancellingFlights} cancelling</Pill>
            )}
          </>
        }
        sub={
          urgentCancels > 0
            ? `${urgentCancels} ${plural(
                urgentCancels,
                "request"
              )} can't wait — booked in the last 24h, leaving within 3 days, or waiting 4h+`
            : cancelRequests > 0
            ? `${cancelRequests} ${plural(
                cancelRequests,
                "traveler"
              )} waiting to hear back${
                oldestCancelAt ? ` · oldest ${timeAgo(oldestCancelAt)}` : ""
              }`
            : cancellingFlights > 0
            ? `${cancellingFlights} ${plural(
                cancellingFlights,
                "flight"
              )} waiting on the airline to finish cancelling — checked automatically`
            : "Search trips, cancel and refund, add notes"
        }
        onClick={() => navigate("/admin/bookings")}
      />
      <AttentionTile
        icon="🛡️"
        title="SkyHub reports"
        state={
          skyhub.critical > 0 ? "urgent" : skyhubOpen > 0 ? "hot" : undefined
        }
        badges={
          <>
            {skyhub.critical > 0 && (
              <Pill tone="red">{skyhub.critical} urgent</Pill>
            )}
            {skyhubOpen > 0 && <Pill tone="orange">{skyhubOpen}</Pill>}
          </>
        }
        sub={
          skyhub.critical > 0
            ? `${skyhub.critical} child-safety / intimate-image ${plural(
                skyhub.critical,
                "report"
              )} first`
            : `${skyhub.reports} to review · ${skyhub.appeals} ${plural(
                skyhub.appeals,
                "appeal"
              )}`
        }
        onClick={() => navigate("/admin/skyhub")}
      />
      <AttentionTile
        icon="⚖️"
        title="Removal requests"
        state={
          skyhub.overdueTakedowns > 0
            ? "urgent"
            : skyhub.takedowns > 0
            ? "hot"
            : undefined
        }
        badges={
          <>
            {skyhub.overdueTakedowns > 0 && (
              <Pill tone="red">{skyhub.overdueTakedowns} overdue</Pill>
            )}
            {skyhub.takedowns > 0 && (
              <Pill tone="orange">{skyhub.takedowns}</Pill>
            )}
          </>
        }
        sub={
          skyhub.takedowns > 0
            ? `${skyhub.takedowns} TAKE IT DOWN / DMCA ${plural(
                skyhub.takedowns,
                "request"
              )} waiting`
            : "No removal requests waiting"
        }
        onClick={onOpenModeration}
      />
    </div>
  );
}

function KeyMetrics({ stats, ready }) {
  // undefined → spinner (still loading); "—" → loaded but missing.
  const v = (x, format = (n) => n) =>
    !ready ? undefined : x == null ? "—" : format(x);

  return (
    <div className="sk-stats">
      <StatCard
        icon="👤"
        label="Total users"
        tone="purple"
        value={v(stats.totalUsers, fmtNum)}
        hint={ready && `+${fmtNum(stats.newUsersWeek)} this week`}
      />
      <StatCard
        icon="✈️"
        label="Total bookings"
        tone="orange"
        value={v(stats.totalBookings, fmtNum)}
        hint={ready && `+${fmtNum(stats.newBookingsWeek)} this week`}
      />
      <StatCard
        icon="💰"
        label="Confirmed revenue"
        tone="green"
        value={v(stats.totalRevenue, fmt$)}
        hint={
          ready &&
          `${fmtNum(stats.confirmedBookings)} confirmed · ${fmtNum(
            stats.pendingBookings
          )} pending`
        }
      />
      <StatCard
        icon="🌟"
        label="XP awarded"
        tone="blue"
        value={v(stats.totalXP, fmtNum)}
      />
    </div>
  );
}

function GrowthMetrics({ metrics, ready }) {
  const pct = (x) => (!ready ? undefined : x == null ? "—" : `${x}%`);
  return (
    <div className="sk-stats sk-stats--3">
      <StatCard
        icon="🔁"
        label="Second-booking rate"
        tone="green"
        value={pct(metrics?.secondBookingRate)}
        hint={
          metrics &&
          `Of ${fmtNum(
            metrics.usersWithAtLeastOneBooking
          )} users with 1+ booking`
        }
      />
      <StatCard
        icon="🤝"
        label="Referral share rate"
        tone="purple"
        value={pct(metrics?.referralShareRate)}
        hint={metrics && `Of ${fmtNum(metrics.totalUsers)} total users`}
      />
      <StatCard
        icon="⚠️"
        label="Cancellation rate"
        tone="red"
        value={pct(metrics?.cancellationRate)}
      />
    </div>
  );
}

function RecentUsers({ users, loading }) {
  return (
    <Panel title="Recent users" meta={`${users.length} shown`}>
      <PanelContent
        loading={loading}
        isEmpty={!users.length}
        emptyText="No users yet"
      >
        {users.map((u) => (
          <div key={u._id} className="sk-row">
            <div className="sk-row__left">
              <div className="sk-avatar">
                {u.avatar ? (
                  <img src={u.avatar} alt="" />
                ) : (
                  initials(u.name || u.username)
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="sk-name">{u.name || u.username}</div>
                <div className="sk-sub">
                  {u.email} · {timeAgo(u.createdAt)}
                </div>
              </div>
            </div>
            <div className="sk-row__right">
              <LevelPill xp={u.xp} />
              <span className="sk-amount" style={{ color: C.orange }}>
                {fmtNum(u.xp)} XP
              </span>
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

function RecentBookings({ bookings, loading }) {
  const navigate = useNavigate();
  return (
    <Panel
      title="Recent bookings"
      actions={
        <button
          type="button"
          className="sk-btn sk-btn--sm"
          onClick={() => navigate("/admin/bookings")}
        >
          View all →
        </button>
      }
    >
      <PanelContent
        loading={loading}
        isEmpty={!bookings.length}
        emptyText="No bookings yet"
      >
        {bookings.map((b) => (
          <div key={b._id} className="sk-row">
            <div className="sk-row__left">
              <div className="sk-row__icon">✈️</div>
              <div style={{ minWidth: 0 }}>
                <div className="sk-name">
                  {b.flight?.origin || "?"} → {b.flight?.destination || "?"}
                </div>
                <div className="sk-sub">
                  {b.travelers?.[0]?.email || "Unknown"} ·{" "}
                  {timeAgo(b.createdAt)}
                </div>
              </div>
            </div>
            <div className="sk-row__right sk-row__right--col">
              <BookingStatusPill status={b.status} />
              {b.total != null && (
                <span className="sk-amount" style={{ color: C.green }}>
                  {fmt$(b.total)}
                </span>
              )}
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

const ACTIVITY_COLORS = { booking: C.green, xp: C.orange, signup: C.purple };

function ActivityFeed({ activity, loading }) {
  return (
    <Panel title="Recent activity" meta="Notifications">
      <PanelContent
        loading={loading}
        isEmpty={!activity.length}
        emptyText="No activity yet"
      >
        {activity.map((a) => (
          <div key={a._id} className="sk-feed__item">
            <span
              className="sk-feed__dot"
              style={{ background: ACTIVITY_COLORS[a.type] || C.blue }}
            />
            <div>
              <div className="sk-text" style={{ marginTop: 0 }}>
                {a.message || a.title}
              </div>
              <div className="sk-sub">{timeAgo(a.createdAt)}</div>
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

const REVENUE_ROWS = [
  { label: "Confirmed", key: "confirmed", color: C.green },
  { label: "Pending", key: "pending", color: C.orange },
  { label: "Cancelled", key: "cancelled", color: C.red },
];

function RevenueBreakdown({ revenue, totalRevenue }) {
  const total = REVENUE_ROWS.reduce((sum, r) => sum + (revenue[r.key] || 0), 0);
  return (
    <Panel title="Revenue breakdown" meta={fmt$(totalRevenue)}>
      <div className="sk-rev">
        {REVENUE_ROWS.map(({ label, key, color }) => {
          const val = revenue[key] || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={key}>
              <div className="sk-rev__label">
                <span>{label}</span>
                <span style={{ color }}>
                  {fmt$(val)} · {pct}%
                </span>
              </div>
              <div className="sk-rev__bar">
                <div
                  className="sk-rev__fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TopXP({ users, loading }) {
  return (
    <Panel title="Top XP earners">
      <PanelContent
        loading={loading}
        isEmpty={!users.length}
        emptyText="No XP data yet"
      >
        {users.map((u, i) => (
          <div key={u._id} className="sk-rank">
            <span>
              <span className="sk-rank__pos">#{i + 1}</span>
              {u.name || u.username}
            </span>
            <span className="sk-amount" style={{ color: C.orange }}>
              {fmtNum(u.xp)} XP
            </span>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

function OverviewTab({ dashboard, growth, counts, onOpenModeration }) {
  const data = dashboard.data;
  const ready = !!data || (!dashboard.loading && !!dashboard.error);
  const firstLoad = dashboard.loading && !data;

  return (
    <>
      <Section title="Needs attention">
        <NeedsAttention counts={counts} onOpenModeration={onOpenModeration} />
      </Section>

      <Section title="Key metrics">
        <KeyMetrics stats={data?.stats || {}} ready={ready} />
      </Section>

      <Section title="Growth">
        <GrowthMetrics
          metrics={growth.data}
          ready={!growth.loading || !!growth.data}
        />
      </Section>

      <Section title="Recent">
        <div className="sk-grid-2" style={{ marginBottom: 20 }}>
          <RecentUsers users={data?.recentUsers || []} loading={firstLoad} />
          <RecentBookings
            bookings={data?.recentBookings || []}
            loading={firstLoad}
          />
        </div>
        <div className="sk-grid-2">
          <ActivityFeed
            activity={data?.recentActivity || []}
            loading={firstLoad}
          />
          <div className="sk-stack">
            <RevenueBreakdown
              revenue={data?.revenueByStatus || {}}
              totalRevenue={data?.stats?.totalRevenue}
            />
            <TopXP users={data?.topXP || []} loading={firstLoad} />
          </div>
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODERATION TAB — Removal requests (TAKE IT DOWN Act + DMCA)
   ═══════════════════════════════════════════════════════════════════════════ */

function takedownClock(t) {
  if (t.kind !== "intimate" || t.hoursLeft == null) return null;
  if (t.overdue)
    return { text: `Overdue ${Math.abs(t.hoursLeft)}h`, tone: "red" };
  return {
    text: `${t.hoursLeft}h left`,
    tone: t.hoursLeft <= 12 ? "red" : "orange",
  };
}

const TAKEDOWN_ACTIONS = {
  remove: {
    verb: "Remove",
    title: "Remove content for",
    done: "Removed. The requester can see it's done.",
  },
  reject: { verb: "Reject", title: "Reject", done: "Rejected." },
  restore: { verb: "Restore", title: "Restore content for", done: "Restored." },
};

function TakedownRow({ t, onAct }) {
  const clock = takedownClock(t);
  const counterDue =
    t.counter && !t.counter.restored ? new Date(t.counter.restoreAfter) : null;
  const postCount = t.posts?.length || 0;

  return (
    <div className="sk-row sk-row--top">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="sk-name">
          <span className="sk-mono">{t.ticket}</span>
          <Pill tone={t.kind === "intimate" ? "red" : "blue"}>
            {t.kind === "intimate" ? "Intimate image" : "Copyright"}
          </Pill>
          {clock && <Pill tone={clock.tone}>{clock.text}</Pill>}
          {counterDue && (
            <Pill tone="purple">
              Counter-notice · restore after {counterDue.toLocaleDateString()}
            </Pill>
          )}
        </div>
        <div className="sk-sub">
          {t.requesterName} · {t.requesterEmail} · {t.relationship} ·{" "}
          {timeAgo(t.createdAt)}
        </div>
        {t.copyrightedWork && (
          <div className="sk-text">
            <b>Work:</b> {t.copyrightedWork}
          </div>
        )}
        {(t.contentLinks || t.description) && (
          <div className="sk-text">
            {t.contentLinks && (
              <>
                <b>Where:</b> {t.contentLinks}
                <br />
              </>
            )}
            {t.description}
          </div>
        )}
        <div className="sk-sub" style={{ marginTop: 6 }}>
          {postCount
            ? `${postCount} ${plural(postCount, "post")} matched${
                t.kind === "intimate" && t.status === "received"
                  ? " · already hidden"
                  : ""
              }`
            : "No post matched yet. Find it and paste the post ID when you remove it."}
          {t.duplicatesRemoved
            ? ` · ${t.duplicatesRemoved} ${plural(
                t.duplicatesRemoved,
                "copy",
                "copies"
              )} also hidden`
            : ""}
        </div>
        {t.decisionNote && t.status !== "received" && (
          <div className="sk-sub">Decision: {t.decisionNote}</div>
        )}
      </div>

      <div className="sk-row__right">
        {t.status === "received" && (
          <>
            <button
              type="button"
              className="sk-btn sk-btn--sm sk-btn--danger"
              onClick={() => onAct(t, "remove")}
            >
              Remove
            </button>
            <button
              type="button"
              className="sk-btn sk-btn--sm"
              onClick={() => onAct(t, "reject")}
            >
              Reject
            </button>
          </>
        )}
        {t.status === "removed" && counterDue && (
          <button
            type="button"
            className="sk-btn sk-btn--sm"
            onClick={() => onAct(t, "restore")}
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

function TakedownQueue({ refreshKey, onChange }) {
  const [status, setStatus] = useState("received");
  const { data, loading, reload } = useLoader(
    async () => {
      const j = await adminRequest(
        `/api/skyhub/admin/takedowns?status=${status}`
      );
      return { status, rows: j.takedowns || [] };
    },
    { key: `${status}:${refreshKey}` }
  );
  // Only show rows for the filter that's selected, never the previous one.
  const rows = data?.status === status ? data.rows : [];

  const [acting, setActing] = useState(null); // { t, action }
  const [note, setNote] = useState("");
  const [posts, setPosts] = useState("");
  const [busy, setBusy] = useState(false);

  const openAction = (t, action) => {
    setActing({ t, action });
    setNote("");
    setPosts("");
  };

  const submit = async () => {
    if (!acting) return;
    if (acting.action === "reject" && !note.trim()) {
      message.warning("Add a short reason, since the requester will see it.");
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/skyhub/admin/takedowns/${acting.t.id}`, {
        method: "POST",
        body: { action: acting.action, note: note.trim(), posts },
      });
      message.success(TAKEDOWN_ACTIONS[acting.action].done);
      setActing(null);
      reload();
      onChange?.();
    } catch (err) {
      message.error(err.message || "Couldn't update the request.");
    } finally {
      setBusy(false);
    }
  };

  const action = acting && TAKEDOWN_ACTIONS[acting.action];

  return (
    <Panel
      title="⚖️ Removal requests"
      actions={
        <FilterChips
          options={TAKEDOWN_FILTERS}
          value={status}
          onChange={setStatus}
        />
      }
    >
      {loading ? (
        <div className="sk-empty">
          <Spinner />
        </div>
      ) : (
        <PanelContent
          isEmpty={!rows.length}
          emptyText={
            status === "received"
              ? "No removal requests waiting. You're all caught up."
              : "Nothing here yet."
          }
        >
          {rows.map((t) => (
            <TakedownRow key={t.id} t={t} onAct={openAction} />
          ))}
        </PanelContent>
      )}

      <Modal
        open={!!acting}
        title={action && `${action.title} ${acting.t.ticket}`}
        onCancel={() => setActing(null)}
        onOk={submit}
        okText={action?.verb}
        okButtonProps={{ danger: acting?.action === "remove", loading: busy }}
        className="sk-challenge-modal"
        destroyOnClose
      >
        {acting?.action === "remove" && (
          <>
            <p className="sk-modal-hint">
              Removes the matched posts and any post using the same photo. The
              poster is notified
              {acting.t.kind === "copyright"
                ? " and can send a counter-notice"
                : ""}
              .
            </p>
            <div className="sk-modal-label">
              Extra post IDs or links you found (optional)
            </div>
            <Input.TextArea
              rows={2}
              value={posts}
              onChange={(e) => setPosts(e.target.value)}
              placeholder="Paste post IDs or links, one per line"
            />
          </>
        )}
        {acting?.action === "restore" && (
          <p className="sk-modal-hint">
            Only restore if the waiting period is over and the claimant hasn't
            told you they filed a lawsuit.
          </p>
        )}
        <div className="sk-modal-label">
          {acting?.action === "reject"
            ? "Reason (the requester sees this)"
            : "Note to the requester (optional)"}
        </div>
        <Input.TextArea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            acting?.action === "reject"
              ? "e.g. We couldn't find this content on SkyHub. Reply with a post link and we'll look again."
              : "e.g. We removed the post and one copy."
          }
        />
      </Modal>
    </Panel>
  );
}

function ModerationTab({ refreshKey, counts }) {
  const navigate = useNavigate();
  const { skyhub, reloadSkyhub } = counts;
  const skyhubOpen = skyhub.reports + skyhub.appeals;

  return (
    <>
      <Section title="Legal removal requests">
        <TakedownQueue refreshKey={refreshKey} onChange={reloadSkyhub} />
      </Section>
      <Section title="Community reports">
        <div className="sk-tiles">
          <AttentionTile
            icon="🛡️"
            title="Open SkyHub moderation"
            state={
              skyhub.critical > 0
                ? "urgent"
                : skyhubOpen > 0
                ? "hot"
                : undefined
            }
            badges={
              skyhub.critical > 0 && (
                <Pill tone="red">{skyhub.critical} urgent</Pill>
              )
            }
            sub={`${skyhub.reports} to review · ${skyhub.appeals} ${plural(
              skyhub.appeals,
              "appeal"
            )}`}
            onClick={() => navigate("/admin/skyhub")}
          />
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENGAGEMENT TAB — Challenges + Rewards catalog
   ═══════════════════════════════════════════════════════════════════════════ */

function ChallengeIconPicker({ value, onChange }) {
  return (
    <div className="sk-icons">
      {CHALLENGE_ICONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === key}
          className="sk-icons__btn"
          onClick={() => onChange(key)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

function toChallengePayload(values, icon) {
  return {
    title: values.title,
    description: values.description,
    theme: values.theme || "general",
    icon,
    requirement: {
      actionType: Array.isArray(values.actionType)
        ? values.actionType[0]
        : values.actionType,
      count: values.count,
    },
    bonusXP: values.bonusXP,
    startDate: values.dateRange[0].toISOString(),
    endDate: values.dateRange[1].toISOString(),
  };
}

function ChallengesPanel({ refreshKey }) {
  const { data, loading, reload } = useLoader(
    async () => (await adminRequest("/api/challenges/admin")).challenges || [],
    { key: refreshKey }
  );
  const challenges = useMemo(
    () =>
      [...(data || [])].sort(
        (a, b) =>
          CHALLENGE_STATUS[challengeStatus(a)].order -
          CHALLENGE_STATUS[challengeStatus(b)].order
      ),
    [data]
  );

  const [form] = Form.useForm();
  const [modal, setModal] = useState({ open: false, editing: null });
  const [icon, setIcon] = useState("trophy");
  const [saving, setSaving] = useState(false);

  const openModal = (challenge = null) => {
    form.resetFields();
    if (challenge) {
      form.setFieldsValue({
        title: challenge.title,
        description: challenge.description,
        theme: challenge.theme,
        actionType: challenge.requirement?.actionType
          ? [challenge.requirement.actionType]
          : undefined,
        count: challenge.requirement?.count,
        bonusXP: challenge.bonusXP,
        dateRange: [dayjs(challenge.startDate), dayjs(challenge.endDate)],
      });
    }
    const knownIcon = CHALLENGE_ICONS.some((i) => i.key === challenge?.icon);
    setIcon(knownIcon ? challenge.icon : "trophy");
    setModal({ open: true, editing: challenge });
  };

  const save = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd shows the field errors
    }
    const { editing } = modal;
    setSaving(true);
    try {
      await adminRequest(
        editing ? `/api/challenges/${editing.id}` : "/api/challenges",
        {
          method: editing ? "PATCH" : "POST",
          body: toChallengePayload(values, icon),
        }
      );
      message.success(editing ? "Challenge updated." : "Challenge created.");
      setModal((m) => ({ ...m, open: false }));
      reload();
    } catch (err) {
      message.error(err.message || "Failed to save challenge.");
    } finally {
      setSaving(false);
    }
  };

  const endEarly = async (challenge) => {
    try {
      await adminRequest(`/api/challenges/${challenge.id}`, {
        method: "DELETE",
      });
      message.success("Challenge ended.");
      reload();
    } catch (err) {
      message.error(err.message || "Failed to end challenge.");
    }
  };

  return (
    <Panel
      title="Challenges"
      meta={`${challenges.length} total`}
      actions={
        <Button
          type="primary"
          size="small"
          onClick={() => openModal()}
          style={{ background: C.orange, borderColor: C.orange }}
        >
          + New challenge
        </Button>
      }
    >
      <PanelContent
        loading={loading}
        isEmpty={!challenges.length}
        emptyText="No challenges yet. Create one to get started."
      >
        {challenges.map((c) => {
          const status = CHALLENGE_STATUS[challengeStatus(c)];
          const action = c.requirement?.actionType;
          return (
            <div key={c.id} className="sk-row">
              <div className="sk-row__left">
                <div className="sk-row__icon">
                  <ChallengeIcon iconKey={c.icon} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="sk-name">{c.title}</div>
                  <div className="sk-sub">
                    {ACTION_LABELS[action] || action} ×{c.requirement?.count} ·
                    +{c.bonusXP} XP · {fmtRange(c.startDate, c.endDate)}
                  </div>
                  <div className="sk-sub">
                    {c.activatedCount || 0} activated · {c.completedCount || 0}{" "}
                    completed
                  </div>
                </div>
              </div>
              <div className="sk-row__right">
                <Pill tone={status.tone}>{status.label}</Pill>
                <button
                  type="button"
                  className="sk-btn sk-btn--sm"
                  onClick={() => openModal(c)}
                >
                  Edit
                </button>
                {c.active && (
                  <Popconfirm
                    title="End this challenge early?"
                    description="Already-earned bonuses and progress are kept. This just stops it from running."
                    okText="End it"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => endEarly(c)}
                  >
                    <button
                      type="button"
                      className="sk-btn sk-btn--sm sk-btn--danger"
                    >
                      End early
                    </button>
                  </Popconfirm>
                )}
              </div>
            </div>
          );
        })}
      </PanelContent>

      <Modal
        open={modal.open}
        title={modal.editing ? "Edit challenge" : "New challenge"}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
        onOk={save}
        okText={modal.editing ? "Save changes" : "Create challenge"}
        confirmLoading={saving}
        className="sk-challenge-modal"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="Game Day Getaway" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Description is required" }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Save or book a trip for an away game this season to earn bonus XP."
            />
          </Form.Item>
          <Form.Item name="theme" label="Theme">
            <Input placeholder="football" />
          </Form.Item>
          <Form.Item label="Icon">
            <ChallengeIconPicker value={icon} onChange={setIcon} />
          </Form.Item>
          <Form.Item
            name="actionType"
            label="What action counts toward this challenge?"
            rules={[{ required: true, message: "Pick or type an action" }]}
            extra={
              <span className="sk-field-help">
                Pick from the list, or type your own. A custom action only
                tracks progress if that exact action is already recorded
                elsewhere in the app. Otherwise the challenge has nothing to
                count, and no error will tell you why.
              </span>
            }
          >
            <Select
              mode="tags"
              maxCount={1}
              options={CHALLENGE_ACTION_TYPES}
              placeholder="Select an action, or type your own"
            />
          </Form.Item>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="count"
              label="How many times?"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} style={{ width: "100%" }} placeholder="3" />
            </Form.Item>
            <Form.Item
              name="bonusXP"
              label="Bonus XP on completion"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="150"
              />
            </Form.Item>
          </div>
          <Form.Item
            name="dateRange"
            label="Runs from / to"
            rules={[{ required: true, message: "Pick a start and end date" }]}
          >
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}

const REWARD_EDITABLE_FIELDS = [
  "title",
  "desc",
  "type",
  "cost",
  "level",
  "featured",
  "repeatable",
  "isNew",
];

function RewardsPanel({ refreshKey }) {
  const { data, loading, reload } = useLoader(
    async () => (await adminRequest("/api/rewards/items/admin")).items || [],
    { key: refreshKey }
  );
  // Live items first, removed ones at the bottom.
  const items = useMemo(
    () =>
      [...(data || [])].sort((a, b) => Number(!!b.active) - Number(!!a.active)),
    [data]
  );

  const [form] = Form.useForm();
  const [modal, setModal] = useState({ open: false, editing: null });
  const [saving, setSaving] = useState(false);

  const openModal = (item = null) => {
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        itemId: item.itemId,
        ...Object.fromEntries(REWARD_EDITABLE_FIELDS.map((k) => [k, item[k]])),
      });
    }
    setModal({ open: true, editing: item });
  };

  const save = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const { editing } = modal;
    setSaving(true);
    try {
      await adminRequest(
        editing ? `/api/rewards/items/${editing.itemId}` : "/api/rewards/items",
        {
          method: editing ? "PATCH" : "POST",
          // itemId can't change after creation, so it's only sent on create.
          body: editing
            ? Object.fromEntries(
                REWARD_EDITABLE_FIELDS.map((k) => [k, values[k]])
              )
            : values,
        }
      );
      message.success(editing ? "Item updated." : "Item created.");
      setModal((m) => ({ ...m, open: false }));
      reload();
    } catch (err) {
      message.error(err.message || "Failed to save reward item.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    try {
      await adminRequest(`/api/rewards/items/${item.itemId}`, {
        method: "DELETE",
      });
      message.success("Item removed.");
      reload();
    } catch (err) {
      message.error(err.message || "Failed to remove item.");
    }
  };

  return (
    <Panel
      title="Rewards catalog"
      meta={`${items.filter((i) => i.active).length} live · ${
        items.length
      } total`}
      actions={
        <Button
          type="primary"
          size="small"
          onClick={() => openModal()}
          style={{ background: C.orange, borderColor: C.orange }}
        >
          + New item
        </Button>
      }
    >
      <PanelContent
        loading={loading}
        isEmpty={!items.length}
        emptyText="No reward items yet. Create one to get started."
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="sk-row"
            style={item.active ? undefined : { opacity: 0.6 }}
          >
            <div className="sk-row__left">
              <div style={{ minWidth: 0 }}>
                <div className="sk-name">
                  {item.title}
                  {!item.active && <Pill tone="red">Removed</Pill>}
                  {item.featured && <Pill tone="orange">Featured</Pill>}
                  {item.isNew && <Pill tone="blue">New</Pill>}
                </div>
                <div className="sk-sub">
                  {item.type} · {fmtNum(item.cost)} XP
                  {item.repeatable ? " · repeatable" : ""}
                </div>
              </div>
            </div>
            <div className="sk-row__right">
              <button
                type="button"
                className="sk-btn sk-btn--sm"
                onClick={() => openModal(item)}
              >
                Edit
              </button>
              {item.active && (
                <Popconfirm
                  title="Remove this item?"
                  description="Anyone who already redeemed it keeps that history. This just hides it from the live catalog."
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(item)}
                >
                  <button
                    type="button"
                    className="sk-btn sk-btn--sm sk-btn--danger"
                  >
                    Remove
                  </button>
                </Popconfirm>
              )}
            </div>
          </div>
        ))}
      </PanelContent>

      <Modal
        open={modal.open}
        title={modal.editing ? "Edit reward item" : "New reward item"}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
        onOk={save}
        okText={modal.editing ? "Save changes" : "Create item"}
        confirmLoading={saving}
        className="sk-challenge-modal"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="itemId"
            label="Item ID (slug, can't be changed later)"
            rules={[
              { required: true, message: "Item ID is required" },
              {
                pattern: /^[a-z0-9_]+$/,
                message: "Lowercase letters, numbers, and underscores only",
              },
            ]}
          >
            <Input placeholder="weekend_xp" disabled={!!modal.editing} />
          </Form.Item>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="Weekend XP Multiplier" />
          </Form.Item>
          <Form.Item
            name="desc"
            label="Description"
            rules={[{ required: true, message: "Description is required" }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="+2x XP on all bookings Fri–Sun"
            />
          </Form.Item>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="type"
              label="Type"
              rules={[{ required: true, message: "Pick a type" }]}
              style={{ flex: 1 }}
            >
              <Select options={REWARD_TYPES} placeholder="Select a type" />
            </Form.Item>
            <Form.Item
              name="cost"
              label="Cost (XP)"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="250"
              />
            </Form.Item>
          </div>
          <Form.Item
            name="level"
            label="Level"
            extra={
              <span className="sk-field-help">
                Carried over from the original catalog data. Not currently wired
                up to restrict an item to any tier.
              </span>
            }
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder="1" />
          </Form.Item>
          <div style={{ display: "flex", gap: 24 }}>
            <Form.Item name="featured" label="Featured" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              name="repeatable"
              label="Repeatable"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="isNew" label="Mark as new" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Panel>
  );
}

function EngagementTab({ refreshKey }) {
  return (
    <>
      <Section title="Challenges">
        <ChallengesPanel refreshKey={refreshKey} />
      </Section>
      <Section title="Rewards">
        <RewardsPanel refreshKey={refreshKey} />
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview";
  const setTab = (next) =>
    setSearchParams(next === "overview" ? {} : { tab: next }, {
      replace: true,
    });

  // Bumping this reloads every section on the page.
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  useTick(30_000);

  useEffect(() => {
    if (!localStorage.getItem("admin")) navigate("/admin/login");
  }, [navigate]);

  const dashboard = useLoader(
    async () => {
      try {
        return (await adminRequest("/api/admin/dashboard")).data;
      } catch (err) {
        if (err.status === 401) {
          clearAdminSession();
          navigate("/admin/login");
        }
        throw err;
      }
    },
    { key: refreshKey }
  );

  const growth = useLoader(
    async () => (await adminRequest("/api/admin/growth-metrics")).data,
    { key: refreshKey }
  );

  const counts = useAttentionCounts(refreshKey);

  useEffect(() => {
    if (dashboard.data) setLastRefresh(new Date());
  }, [dashboard.data]);

  const handleLogout = async () => {
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Clear the local session even if the server call fails.
    }
    clearAdminSession();
    navigate("/admin/login");
  };

  const { skyhub } = counts;
  const tabs = [
    { key: "overview", label: "Overview" },
    {
      key: "moderation",
      label: "Moderation",
      count: skyhub.takedowns + skyhub.critical,
    },
    { key: "engagement", label: "Challenges & rewards" },
  ];

  return (
    <div className="sk-admin">
      <style>{INJECTED_CSS}</style>

      <header className="sk-top">
        <div className="sk-top__bar">
          <div className="sk-top__logo">
            ✦ Skyrio <span className="sk-top__badge">Admin</span>
          </div>
          <div className="sk-top__right">
            {lastRefresh && (
              <span className="sk-top__updated">
                Updated {timeAgo(lastRefresh)}
              </span>
            )}
            <button
              type="button"
              className="sk-btn"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={dashboard.loading}
            >
              {dashboard.loading ? "Loading…" : "↻ Refresh"}
            </button>
            <button
              type="button"
              className="sk-btn"
              onClick={() => navigate("/")}
            >
              ← Skyrio
            </button>
            <Button type="primary" danger size="small" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        <nav className="sk-tabs" role="tablist" aria-label="Admin sections">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className="sk-tabs__tab"
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.count > 0 && <span className="sk-tabs__count">{t.count}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="sk-body">
        {/* Shown on every tab: missing a legal deadline is never OK. */}
        {skyhub.overdueTakedowns > 0 && (
          <div role="alert" className="sk-alert">
            <span>
              ⏰ {skyhub.overdueTakedowns} intimate-image removal{" "}
              {plural(skyhub.overdueTakedowns, "request is", "requests are")}{" "}
              past the 48-hour legal deadline.
            </span>
            {tab !== "moderation" && (
              <button
                type="button"
                className="sk-btn sk-btn--sm sk-btn--danger"
                onClick={() => setTab("moderation")}
              >
                Handle now →
              </button>
            )}
          </div>
        )}

        {dashboard.error && tab === "overview" && (
          <div className="sk-alert sk-alert--soft">⚠️ {dashboard.error}</div>
        )}

        {tab === "overview" && (
          <OverviewTab
            dashboard={dashboard}
            growth={growth}
            counts={counts}
            onOpenModeration={() => setTab("moderation")}
          />
        )}
        {tab === "moderation" && (
          <ModerationTab refreshKey={refreshKey} counts={counts} />
        )}
        {tab === "engagement" && <EngagementTab refreshKey={refreshKey} />}
      </main>
    </div>
  );
};

export default AdminDashboard;
