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

const TABS = ["overview", "moderation", "feedback", "reviews", "engagement"];

const FEEDBACK_STATUSES = [
  { value: "new", label: "New", tone: "orange" },
  { value: "reviewing", label: "Reviewing", tone: "blue" },
  { value: "planned", label: "Planned", tone: "purple" },
  { value: "shipped", label: "Shipped", tone: "green" },
  { value: "closed", label: "Closed", tone: "muted" },
];
const FEEDBACK_STATUS = Object.fromEntries(
  FEEDBACK_STATUSES.map((s) => [s.value, s])
);
const FEEDBACK_TYPE_LABELS = {
  bug: "Bug",
  idea: "Idea",
  general: "General",
  checkout: "Checkout",
};
const FEEDBACK_TYPE_TONES = {
  bug: "red",
  idea: "purple",
  general: "muted",
  checkout: "blue",
};

const REVIEW_FILTERS = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
];
// The only reasons a review can be rejected. Negative is never one of them.
const REJECT_REASONS = [
  { value: "spam", label: "Spam or fake" },
  { value: "profanity", label: "Profanity or abuse" },
  { value: "personal_info", label: "Contains personal info" },
];
const REJECT_LABELS = Object.fromEntries(
  REJECT_REASONS.map((r) => [r.value, r.label])
);

const XP_REASON_LABELS = {
  FEEDBACK_QUICK: "Quick feedback",
  FEEDBACK_DETAILED: "Detailed feedback",
  TESTIMONIAL: "Review",
  FEEDBACK_SHIPPED: "Feedback shipped",
};

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

/* Chrome on Mac (desktop only; phones are fine) sometimes stops drawing
   parts of a long page: black blocks, missing text, empty pills. It
   happens when the graphics card runs out of room, and the main drivers
   are see-through blurred layers (backdrop-filter), big glows and
   floating animated pieces from the rest of the site sitting over a very
   tall page. The dashboard doesn't need any of that, so while it's open:
   no blur anywhere, no floating Atlas/Help buttons, a plain solid
   background, and long sections are only drawn when on screen. */
const ADMIN_PAGE_CSS = `
  html.sk-admin-page, html.sk-admin-page body { background: #07060f !important; }
  html.sk-admin-page *,
  html.sk-admin-page *::before,
  html.sk-admin-page *::after {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  html.sk-admin-page .ap-fab-wrapper,
  html.sk-admin-page [data-sr-root] { display: none !important; }
  /* Glows on buttons (e.g. Logout) are drawn as extra layers. */
  html.sk-admin-page .sk-admin .ant-btn { box-shadow: none !important; }
  /* Draw each section only when it's near the screen. */
  html.sk-admin-page .sk-admin .sk-section {
    content-visibility: auto;
    contain-intrinsic-size: auto 800px;
  }
  html.sk-admin-page .sk-admin .sk-top { transform: translateZ(0); }
`;

const INJECTED_CSS = `
  .sk-admin * { box-sizing: border-box; }
  .sk-admin { min-height: 100vh; background: ${C.bg}; color: ${C.white}; font-family: "DM Sans", sans-serif; }

  /* Top bar + tabs */
  /* Solid, no blur: a full-width blur behind a sticky bar made Chrome on
     Mac skip drawing parts of this page (blank areas, empty pills). */
  .sk-top { position: sticky; top: 0; z-index: 50; background: #07060f; border-bottom: 1px solid ${C.border}; }
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
  .sk-btn--sm { padding: 4px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; }
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

  /* Feedback & reviews */
  .sk-stars { color: ${C.orange}; letter-spacing: 1px; font-size: 13px; }
  .sk-stars__off { color: rgba(255,255,255,0.18); }
  .sk-select-dark .ant-select-selector { background: rgba(255,255,255,0.06) !important; border-color: ${C.border} !important; }
  .sk-select-dark .ant-select-selection-item { color: #fff !important; }
  .sk-select-dark .ant-select-arrow { color: ${C.muted}; }
  .sk-trend { display: flex; align-items: flex-end; gap: 10px; height: 96px; padding: 16px 20px 8px; }
  .sk-trend__col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; height: 100%; min-width: 0; }
  .sk-trend__bar { width: 100%; max-width: 36px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, ${C.orange}, rgba(255,138,42,0.35)); }
  .sk-trend__val { font-size: 11px; font-weight: 700; color: ${C.white}; }
  .sk-trend__label { font-size: 10px; color: ${C.muted}; padding: 0 20px 14px; display: flex; gap: 10px; }
  .sk-trend__label span { flex: 1; text-align: center; }
  .sk-quote { border-left: 2px solid rgba(255,138,42,0.4); padding-left: 10px; }

  /* Feedback inbox: easy to read and act on */
  .sk-fb-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid ${C.border}; }
  .sk-fb-search { flex: 1; min-width: 180px; height: 34px; padding: 0 12px; border-radius: 10px; border: 1px solid ${C.border}; background: rgba(255,255,255,0.05); color: #fff; font: inherit; font-size: 13px; outline: none; }
  .sk-fb-search:focus { border-color: ${C.orange}; }
  .sk-fb-search::placeholder { color: ${C.muted}; }
  .sk-fb-count { font-size: 12px; color: ${C.muted}; white-space: nowrap; }
  .sk-fb { padding: 16px 20px; border-bottom: 1px solid ${C.border}; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; }
  .sk-fb:last-child { border-bottom: none; }
  .sk-fb:hover { background: rgba(255,255,255,0.02); }
  .sk-fb__who { font-size: 12.5px; color: ${C.text}; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
  .sk-fb__who b { color: #fff; font-weight: 700; }
  .sk-fb__msg { grid-column: 1 / -1; font-size: 14px; line-height: 1.6; color: #f3f1ff; white-space: pre-wrap; word-break: break-word; background: rgba(255,255,255,0.03); border: 1px solid ${C.border}; border-radius: 12px; padding: 12px 14px; }
  .sk-fb__meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 11.5px; color: ${C.muted}; }
  .sk-fb__side { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .sk-fb.is-selected, .sk-row.is-selected { background: rgba(255,138,42,0.07); }
  .sk-fb__pick, .sk-check input { width: 16px; height: 16px; accent-color: ${C.orange}; cursor: pointer; flex-shrink: 0; margin: 0; }
  .sk-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: ${C.text}; cursor: pointer; user-select: none; }
  .sk-bulk { position: sticky; top: 96px; z-index: 5; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 20px; background: #1d1430; border-bottom: 1px solid rgba(255,138,42,0.35); font-size: 13px; }
  .sk-bulk b { margin-right: 4px; }
  .sk-clearbar { flex-basis: 100%; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; margin-bottom: 4px; border-radius: 12px; background: rgba(255,138,42,0.08); border: 1px solid rgba(255,138,42,0.3); font-size: 13px; color: ${C.text}; }
  .sk-clearbar span { margin-right: auto; }
  .sk-clearbar b { color: #fff; }
  /* Thank-you window: always dark, whatever theme the page gets */
  .sk-thank-modal .ant-modal-content, .sk-thank-modal .ant-modal-header { background: #150f28 !important; color: #fff; }
  .sk-thank-modal .ant-modal-title { color: #fff !important; }
  .sk-thank-modal .ant-modal-close { color: rgba(255,255,255,0.6) !important; }
  .sk-thank-modal textarea, .sk-thank-modal .ant-input-affix-wrapper, .sk-thank-modal .ant-input-textarea-affix-wrapper { background: rgba(255,255,255,0.06) !important; color: #fff !important; border-color: rgba(255,255,255,0.18) !important; }
  .sk-thank-modal .ant-input-data-count { color: rgba(255,255,255,0.45) !important; }
  .sk-thank-modal .ant-btn-default { background: transparent !important; color: #fff !important; border-color: rgba(255,255,255,0.25) !important; }
  .sk-thank-modal .ant-btn-primary { background: linear-gradient(135deg, #ff8a2a, #ffb347) !important; color: #1a0e06 !important; border: 0 !important; font-weight: 700; }

  /* Confirm dialogs (Modal.confirm) — readable on the dark admin theme */
  .sk-thank-modal .ant-modal-confirm-title { color: #fff !important; font-weight: 700; }
  .sk-thank-modal .ant-modal-confirm-content,
  .sk-thank-modal .ant-modal-confirm-paragraph { color: rgba(255,255,255,0.78) !important; }
  .sk-thank-modal .ant-modal-confirm-body > .anticon { color: #ffb347 !important; }
  .sk-thank-modal .ant-modal-content { border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 60px rgba(0,0,0,0.6) !important; }

  /* Small "are you sure?" popups (Popconfirm) */
  .sk-pop .ant-popover-inner { background: #150f28 !important; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 14px 40px rgba(0,0,0,0.55) !important; }
  .sk-pop .ant-popover-arrow::before, .sk-pop .ant-popover-arrow::after { background: #150f28 !important; }
  .sk-pop .ant-popconfirm-title { color: #fff !important; font-weight: 700; }
  .sk-pop .ant-popconfirm-description { color: rgba(255,255,255,0.75) !important; max-width: 280px; }
  .sk-pop .ant-popconfirm-message-icon .anticon { color: #ffb347 !important; }
  .sk-pop .ant-btn-default { background: transparent !important; color: #fff !important; border-color: rgba(255,255,255,0.25) !important; }
  .sk-pop .ant-btn-dangerous.ant-btn-primary { background: #e5484d !important; color: #fff !important; border: 0 !important; }
  @media (max-width: 640px) {
    .sk-top__bar { flex-wrap: wrap; padding-bottom: 4px; }
    .sk-top__right { flex-wrap: wrap; }
    .sk-panel__head { padding: 12px 14px; }
    .sk-fb, .sk-fb-tools { padding-left: 14px; padding-right: 14px; }
    .sk-fb { grid-template-columns: 1fr; }
    .sk-fb__side { justify-content: space-between; }
    .sk-row { flex-wrap: wrap; padding: 12px 14px; }
    .sk-row__right { width: 100%; justify-content: flex-end; }
  }
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

/* ─── Booking labels ─────────────────────────────────────────────────────── */

/** Pulls an airport code out of a string or a { code / iataCode / airport } object. */
function airportCode(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.code || v.iataCode || v.iata || v.airport || v.airportCode || null;
}

/** First and last segment of a flight, whatever shape it was saved in. */
function flightSegments(f = {}) {
  if (Array.isArray(f.segments) && f.segments.length) return f.segments;
  if (Array.isArray(f.legs)) {
    const segs = f.legs.flatMap((l) => l.segments || [l]);
    if (segs.length) return segs;
  }
  if (Array.isArray(f.slices)) {
    const segs = f.slices.flatMap((s) => s.segments || [s]);
    if (segs.length) return segs;
  }
  return [];
}

/** "EWR → LAX", "Hotel name", or a plain fallback. Never "? → ?". */
function bookingTitle(b) {
  if (!b) return "Booking";

  if (isHotelBooking(b)) {
    return (
      b.hotelStay?.rooms?.[0]?.name ||
      b.hotelStay?.hotelName ||
      b.tripDetails ||
      "Hotel stay"
    );
  }

  const f = b.flight || {};
  const segs = flightSegments(f);
  const first = segs[0] || {};
  const last = segs[segs.length - 1] || {};

  const from =
    airportCode(f.origin) ||
    airportCode(f.from) ||
    airportCode(first.origin) ||
    airportCode(first.from) ||
    airportCode(first.departure);
  const to =
    airportCode(f.destination) ||
    airportCode(f.to) ||
    airportCode(last.destination) ||
    airportCode(last.to) ||
    airportCode(last.arrival);

  if (from && to) return `${from} → ${to}`;
  if (b.tripDetails) return b.tripDetails;
  return b.type ? `${b.type} booking` : "Booking";
}

/**
 * Who booked it. An account shows its email; a real guest booking
 * (user is null) shows the contact email with "(guest)".
 */
function bookingWho(b) {
  if (!b) return "Unknown";
  if (b.user) return b.user.email || b.user.name || b.email || "Account";
  if (b.email) return `${b.email} (guest)`;
  return "Guest";
}

function isHotelBooking(b) {
  return !!(b?.hotelStay || String(b?.type || "").toLowerCase() === "hotel");
}

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

  const cancels = useLoader(
    async () =>
      (
        await adminRequest(
          "/api/bookings/admin/search?status=cancel_requested&limit=1"
        )
      ).total || 0,
    { key: refreshKey }
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
    cancelRequests: cancels.data ?? 0,
    skyhub: skyhub.data ?? EMPTY_SKYHUB,
    reloadSkyhub: skyhub.reload,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function NeedsAttention({
  counts,
  onOpenModeration,
  onOpenFeedback,
  onOpenReviews,
}) {
  const navigate = useNavigate();
  const { openTickets, cancelRequests, skyhub, feedback } = counts;
  const fbWaiting =
    (feedback?.newFeedback || 0) + (feedback?.pendingReviews || 0);
  const skyhubOpen = skyhub.reports + skyhub.appeals;

  return (
    <div className="sk-tiles">
      <AttentionTile
        icon={<IconInbox size={18} />}
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
        icon={<IconSuitcase size={18} />}
        title="Bookings"
        state={cancelRequests > 0 ? "hot" : undefined}
        badges={
          cancelRequests > 0 && (
            <Pill tone="amber">
              {cancelRequests} {plural(cancelRequests, "cancellation")}
            </Pill>
          )
        }
        sub={
          cancelRequests > 0
            ? `${cancelRequests} ${plural(
                cancelRequests,
                "traveler"
              )} waiting to hear back`
            : "Search trips, cancel and refund, add notes"
        }
        onClick={() => navigate("/admin/bookings")}
      />
      <AttentionTile
        icon={<IconShield size={18} />}
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
        icon={<IconScale size={18} />}
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
      <AttentionTile
        icon={<IconChat size={18} />}
        title="Feedback"
        state={feedback?.newFeedback > 0 ? "hot" : undefined}
        badges={
          feedback?.newFeedback > 0 ? (
            <Pill tone="blue">{feedback.newFeedback} new</Pill>
          ) : null
        }
        sub={
          feedback?.newFeedback > 0
            ? "Read, triage and thank people for their feedback"
            : "No new feedback"
        }
        onClick={onOpenFeedback}
      />
      <AttentionTile
        icon={<IconStar size={18} />}
        title="Reviews"
        state={feedback?.pendingReviews > 0 ? "hot" : undefined}
        badges={
          feedback?.pendingReviews > 0 ? (
            <Pill tone="orange">{feedback.pendingReviews} to approve</Pill>
          ) : null
        }
        sub={
          feedback?.pendingReviews > 0
            ? "Approve or reject reviews before they go public"
            : "No reviews waiting"
        }
        onClick={onOpenReviews || onOpenFeedback}
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
        icon={<IconUser size={18} />}
        label="Total users"
        tone="purple"
        value={v(stats.totalUsers, fmtNum)}
        hint={ready && `+${fmtNum(stats.newUsersWeek)} this week`}
      />
      <StatCard
        icon={<IconPlane size={18} />}
        label="Total bookings"
        tone="orange"
        value={v(stats.totalBookings, fmtNum)}
        hint={ready && `+${fmtNum(stats.newBookingsWeek)} this week`}
      />
      <StatCard
        icon={<IconDollar size={18} />}
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
        icon={<IconSpark size={18} />}
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
        icon={<IconRepeat size={18} />}
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
        icon={<IconUsers size={18} />}
        label="Referral share rate"
        tone="purple"
        value={pct(metrics?.referralShareRate)}
        hint={metrics && `Of ${fmtNum(metrics.totalUsers)} total users`}
      />
      <StatCard
        icon={<IconAlert size={18} />}
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
              <div className="sk-row__icon">
                {isHotelBooking(b) ? (
                  <IconBed size={15} />
                ) : (
                  <IconPlane size={15} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="sk-name">{bookingTitle(b)}</div>
                <div className="sk-sub">
                  {bookingWho(b)} · {timeAgo(b.createdAt)}
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

function OverviewTab({
  dashboard,
  growth,
  counts,
  onOpenModeration,
  onOpenFeedback,
  onOpenReviews,
}) {
  const data = dashboard.data;
  const ready = !!data || (!dashboard.loading && !!dashboard.error);
  const firstLoad = dashboard.loading && !data;

  return (
    <>
      <Section title="Needs attention">
        <NeedsAttention
          counts={counts}
          onOpenModeration={onOpenModeration}
          onOpenFeedback={onOpenFeedback}
          onOpenReviews={onOpenReviews}
        />
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
      title={titled(IconScale, "Removal requests")}
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
            icon={<IconShield size={18} />}
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
                    overlayClassName="sk-pop"
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
                  overlayClassName="sk-pop"
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
   FEEDBACK TAB: Feedback inbox, reviews queue, XP log, stats
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPTY_FEEDBACK_COUNTS = { newFeedback: 0, pendingReviews: 0 };

function useFeedbackCounts(refreshKey) {
  const { data, reload } = useLoader(
    async () => {
      const j = await adminRequest("/api/feedback/admin/counts");
      return {
        newFeedback: j.newFeedback || 0,
        pendingReviews: j.pendingReviews || 0,
      };
    },
    { key: refreshKey, intervalMs: 120_000 }
  );
  return { ...(data || EMPTY_FEEDBACK_COUNTS), reload };
}

function Stars({ value = 0 }) {
  return (
    <span className="sk-stars" aria-label={`${value} out of 5 stars`}>
      {"★".repeat(value)}
      <span className="sk-stars__off">{"★".repeat(5 - value)}</span>
    </span>
  );
}

const userLabel = (u) =>
  u
    ? `${u.name || u.username || "User"}${u.email ? ` · ${u.email}` : ""}`
    : "Signed out";

function FeedbackStats({ refreshKey }) {
  const { data, loading } = useLoader(
    async () => (await adminRequest("/api/feedback/admin/stats")).data,
    { key: refreshKey }
  );
  const ready = !!data || !loading;
  const v = (x, f = (n) => n) => (!ready ? undefined : x == null ? "—" : f(x));
  const byType = data?.feedbackByType30d || {};
  const typeTotal = Object.values(byType).reduce((a, b) => a + b, 0);
  const months = data?.ratingByMonth || [];

  return (
    <>
      <div className="sk-stats" style={{ marginBottom: 20 }}>
        <StatCard
          icon={<IconStar size={18} />}
          label="Average rating"
          tone="orange"
          value={v(data?.averageRating, (n) => `${n} / 5`)}
          hint={
            data && `${fmtNum(data.reviewCount)} reviews, all ratings counted`
          }
        />
        <StatCard
          icon={<IconLog size={18} />}
          label="Review response rate"
          tone="purple"
          value={v(data?.responseRate, (n) => `${n}%`)}
          hint={
            data && `Of ${fmtNum(data.promptsShown)} people asked after a trip`
          }
        />
        <StatCard
          icon={<IconChat size={18} />}
          label="Feedback (30 days)"
          tone="blue"
          value={v(ready ? typeTotal : undefined, fmtNum)}
          hint={
            data &&
            `${byType.bug || 0} bugs · ${byType.idea || 0} ideas · ${
              byType.checkout || 0
            } checkout · ${byType.general || 0} general`
          }
        />
        <StatCard
          icon={<IconRocket size={18} />}
          label="Feedback shipped"
          tone="green"
          value={v(data?.shippedCount, fmtNum)}
          hint="Each one earned its sender a bonus"
        />
      </div>

      <div className="sk-grid-2">
        <Panel title="Average rating by month" meta="Last 6 months">
          <PanelContent
            loading={loading}
            isEmpty={!months.length}
            emptyText="No reviews yet"
          >
            <div className="sk-trend">
              {months.map((m) => (
                <div
                  key={m.month}
                  className="sk-trend__col"
                  title={`${m.count} reviews`}
                >
                  <span className="sk-trend__val">{m.avg}</span>
                  <div
                    className="sk-trend__bar"
                    style={{ height: `${(m.avg / 5) * 60}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="sk-trend__label">
              {months.map((m) => (
                <span key={m.month}>
                  {dayjs(`${m.month}-01`).format("MMM")}
                </span>
              ))}
            </div>
          </PanelContent>
        </Panel>

        <Panel title="Feedback by type" meta="Last 30 days">
          <div className="sk-rev">
            {["bug", "idea", "general", "checkout"].map((t) => {
              const n = byType[t] || 0;
              const pct = typeTotal ? Math.round((n / typeTotal) * 100) : 0;
              const tone = TONES[FEEDBACK_TYPE_TONES[t]];
              return (
                <div key={t}>
                  <div className="sk-rev__label">
                    <span>{FEEDBACK_TYPE_LABELS[t]}</span>
                    <span style={{ color: tone.fg }}>
                      {n} · {pct}%
                    </span>
                  </div>
                  <div className="sk-rev__bar">
                    <div
                      className="sk-rev__fill"
                      style={{ width: `${pct}%`, background: tone.fg }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ── Small stroke icons for the Feedback tab (no emoji) ── */
function TabSvg({ size = 15, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "-2px", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}
// Envelope with a heart: thank-you
const IconThanks = (p) => (
  <TabSvg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
    <path
      d="M12 17.2s-2.6-1.5-2.6-3.2a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.7-2.6 3.2-2.6 3.2z"
      fill="currentColor"
      stroke="none"
    />
  </TabSvg>
);
const IconChat = (p) => (
  <TabSvg {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
  </TabSvg>
);
const IconStar = (p) => (
  <TabSvg {...p}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
  </TabSvg>
);
const IconSpark = (p) => (
  <TabSvg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </TabSvg>
);
const IconLog = (p) => (
  <TabSvg {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </TabSvg>
);
const IconInbox = (p) => (
  <TabSvg {...p}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
  </TabSvg>
);
const IconSuitcase = (p) => (
  <TabSvg {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
  </TabSvg>
);
const IconShield = (p) => (
  <TabSvg {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
  </TabSvg>
);
const IconScale = (p) => (
  <TabSvg {...p}>
    <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" />
  </TabSvg>
);
const IconUser = (p) => (
  <TabSvg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </TabSvg>
);
const IconPlane = (p) => (
  <TabSvg {...p}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </TabSvg>
);
const IconBed = (p) => (
  <TabSvg {...p}>
    <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 16h20M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </TabSvg>
);
const IconDollar = (p) => (
  <TabSvg {...p}>
    <path d="M12 2v20M17 6.5C16 5 14.2 4.5 12 4.5c-3 0-4.5 1.5-4.5 3.5 0 4.5 9.5 2.5 9.5 7.5 0 2-1.8 3.5-5 3.5-2.4 0-4.2-.8-5-2.5" />
  </TabSvg>
);
const IconRepeat = (p) => (
  <TabSvg {...p}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </TabSvg>
);
const IconUsers = (p) => (
  <TabSvg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M15.5 14.2A5 5 0 0 1 21 19" />
  </TabSvg>
);
const IconAlert = (p) => (
  <TabSvg {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17h.01" />
  </TabSvg>
);
const IconClock = (p) => (
  <TabSvg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </TabSvg>
);
const IconRocket = (p) => (
  <TabSvg {...p}>
    <path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
    <path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5" />
  </TabSvg>
);
const titled = (Icon, text) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
    <Icon size={15} />
    {text}
  </span>
);

/* ── Thank-you messages ─────────────────────────────────────────
   Sends the author an in-app notification and/or email thanking them.
   Server: POST /api/feedback/admin/thank and
           POST /api/testimonials/admin/thank
           { ids: [...], message, notify, email }
   The server sends ONE message per person (someone with 4 submissions
   isn't thanked 4 times) and records thankedAt on every item. Works for
   anything already submitted, old or new. */
const THANK_TEMPLATES = {
  feedback:
    "Thank you for your feedback! It helps us make Skyrio a better website and a better travel experience for everyone. We read every message.",
  review:
    "Thank you for your review! Hearing how your trip went helps us make Skyrio a better website and a better experience for every traveler.",
};
const firstNameOf = (u) =>
  String(u?.name || u?.username || "")
    .trim()
    .split(/\s+/)[0] || "";

const RATING_FILTERS = [
  { value: "all", label: "All ratings", test: () => true },
  { value: "high", label: "4–5 ★", test: (r) => r >= 4 },
  { value: "mid", label: "3 ★", test: (r) => r === 3 },
  { value: "low", label: "1–2 ★", test: (r) => r >= 1 && r <= 2 },
  { value: "none", label: "No rating", test: (r) => !r },
];
const SORTS = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
];
const sortByDate = (list, sort) =>
  [...list].sort((a, b) =>
    sort === "old"
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt)
  );

function ThankModal({ kind, items, onClose, onSent }) {
  const [text, setText] = useState(THANK_TEMPLATES[kind]);
  const [notify, setNotify] = useState(true);
  const [email, setEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const open = items.length > 0;
  const reachable = items.filter((it) => it.user);
  const already = reachable.filter((it) => it.thankedAt).length;
  // Resending to people who were already thanked: usually the email
  // didn't arrive, so default to email only (no second notification).
  const isResend = reachable.length > 0 && already === reachable.length;
  useEffect(() => {
    if (!open) return;
    setText(THANK_TEMPLATES[kind]);
    setNotify(!isResend);
    setEmail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const skipped = items.length - reachable.length;
  // One message per person, however many things they sent.
  const people = new Map();
  reachable.forEach((it) => {
    const uid = String(it.user?._id || it.user?.id || it.user?.email || it._id);
    if (!people.has(uid)) people.set(uid, it.user);
  });
  const peopleCount = people.size;
  const first = peopleCount === 1 ? firstNameOf([...people.values()][0]) : "";

  const send = async () => {
    if (!text.trim()) return message.warning("Write a short message first.");
    if (!notify && !email)
      return message.warning("Pick at least one way to send it.");
    setSending(true);
    const base =
      kind === "review" ? "/api/testimonials/admin" : "/api/feedback/admin";
    try {
      const j = await adminRequest(`${base}/thank`, {
        method: "POST",
        body: {
          ids: reachable.map((it) => it._id),
          message: text.trim(),
          notify,
          email,
          resend: true, // the admin picked these, so include already-thanked
        },
      });
      const sent = Number(j.people ?? peopleCount);
      const failed = Array.isArray(j.emailFailed) ? j.emailFailed : [];
      if (failed.length) {
        Modal.warning({
          className: "sk-thank-modal",
          title:
            failed.length === 1
              ? "The email didn't go out"
              : `${failed.length} emails didn't go out`,
          content: (
            <div>
              {failed.map((f, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <b>{f.name || f.email || "Someone"}</b>
                  {f.email && f.name ? ` (${f.email})` : ""}: {f.reason}
                </div>
              ))}
              <div style={{ marginTop: 8, opacity: 0.75 }}>
                They&apos;re marked &ldquo;Email failed&rdquo;. Use Resend to
                try again.
              </div>
            </div>
          ),
        });
      } else {
        message.success(
          isResend
            ? sent === 1
              ? "Thank-you sent again."
              : `Thank-you sent again to ${sent} ${plural(
                  sent,
                  "person",
                  "people"
                )}.`
            : sent === 1
            ? "Thank-you sent."
            : `Thank-you sent to ${sent} ${plural(sent, "person", "people")}.`
        );
      }
      onSent?.();
      onClose();
    } catch (err) {
      message.error(
        err.status === 404
          ? "Thank-you messages aren't set up on the server yet (the /thank route is missing)."
          : err.message || "Couldn't send the thank-you."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        isResend
          ? peopleCount > 1
            ? `Resend thank-you to ${peopleCount} people`
            : `Resend thank-you${first ? ` to ${first}` : ""}`
          : peopleCount > 1
          ? `Thank ${peopleCount} people`
          : `Send a thank-you${first ? ` to ${first}` : ""}`
      }
      onCancel={onClose}
      onOk={send}
      okText={
        sending ? "Sending…" : isResend ? "Resend thank-you" : "Send thank-you"
      }
      okButtonProps={{ loading: sending, disabled: !reachable.length }}
      className="sk-challenge-modal sk-thank-modal"
      destroyOnClose
    >
      <p className="sk-modal-hint">
        They&apos;ll see it with &ldquo;Hi {first || "[first name]"},&rdquo; in
        front and &ldquo;— The Skyrio team&rdquo; at the end.
        {reachable.length > peopleCount &&
          ` ${reachable.length} ${
            kind === "review" ? "reviews" : "submissions"
          } from ${peopleCount} ${plural(
            peopleCount,
            "person",
            "people"
          )}: each person gets one message.`}
        {isResend &&
          ` Already thanked — this sends it again. Notification is off so they don't get a second one; turn it on if you want.`}
        {!isResend &&
          already > 0 &&
          ` ${already} of these ${plural(
            already,
            "was",
            "were"
          )} already thanked and will get it again.`}
        {skipped > 0 &&
          ` ${skipped} ${plural(
            skipped,
            "was",
            "were"
          )} sent signed out, so there's no one to message and ${plural(
            skipped,
            "it's",
            "they're"
          )} skipped.`}
      </p>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoSize={{ minRows: 4, maxRows: 8 }}
        maxLength={600}
        showCount
      />
      <div
        style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}
      >
        <label className="sk-check">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          In-app notification
        </label>
        <label className="sk-check">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
          Email
        </label>
      </div>
    </Modal>
  );
}

// "Thanked" pill, or "Email failed" when the email didn't go out.
function ThankStatus({ item }) {
  if (item.thankEmailed === false)
    return (
      <span title="The thank-you email didn't go out. Use Resend.">
        <Pill tone="red">Email failed</Pill>
      </span>
    );
  const when = item.thankEmailedAt || item.thankedAt;
  return (
    <span title={when ? `Thanked ${timeAgo(when)}` : "Thanked"}>
      <Pill tone="green">Thanked</Pill>
    </span>
  );
}

// "3 selected · Mark reviewing · Close · Thank · Clear"
function BulkBar({ count, children, onClear }) {
  if (!count) return null;
  return (
    <div className="sk-bulk" role="toolbar" aria-label="Selected items">
      <b>{count} selected</b>
      {children}
      <button type="button" className="sk-btn sk-btn--sm" onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}

function FeedbackInbox({ refreshKey, onChange }) {
  const [status, setStatus] = useState("new");
  const [type, setType] = useState("all");
  const key = `${status}:${type}`;
  const { data, loading, reload } = useLoader(
    async () => {
      const j = await adminRequest(
        `/api/feedback/admin?status=${status}&type=${type}`
      );
      return { key, rows: j.feedback || [] };
    },
    { key: `${key}:${refreshKey}` }
  );
  const allRows = data?.key === key ? data.rows : [];
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("new");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rf =
      RATING_FILTERS.find((r) => r.value === rating) || RATING_FILTERS[0];
    const list = allRows.filter(
      (fb) =>
        rf.test(Number(fb.rating) || 0) &&
        (!q ||
          [
            fb.message,
            fb.page,
            fb.type,
            fb.user?.name,
            fb.user?.username,
            fb.user?.email,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
    return sortByDate(list, sort);
  }, [allRows, query, rating, sort]);

  // Select several, then close / move / thank them in one go.
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => setSelected(new Set()), [key, refreshKey]);
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allShownSelected =
    rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggleAll = () =>
    setSelected(allShownSelected ? new Set() : new Set(rows.map((r) => r._id)));
  const selectedRows = rows.filter((r) => selected.has(r._id));
  const [thanking, setThanking] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Everyone who ever sent feedback (any status) and hasn't been thanked.
  const [findingAll, setFindingAll] = useState(false);
  const thankEveryone = async () => {
    setFindingAll(true);
    try {
      const j = await adminRequest("/api/feedback/admin?status=all&type=all");
      const list = (j.feedback || []).filter((fb) => fb.user && !fb.thankedAt);
      if (!list.length) {
        message.info("Everyone who sent feedback has already been thanked.");
        return;
      }
      setThanking(list);
    } catch (err) {
      message.error(err.message || "Couldn't load past feedback.");
    } finally {
      setFindingAll(false);
    }
  };

  const bulkStatus = (next) => moveMany(selectedRows, next);
  const moveMany = async (list, next) => {
    setBulkBusy(true);
    let ok = 0;
    for (const fb of list) {
      try {
        await adminRequest(`/api/feedback/admin/${fb._id}`, {
          method: "PATCH",
          body: { status: next },
        });
        ok += 1;
      } catch {
        /* keep going; the count says how many moved */
      }
    }
    setBulkBusy(false);
    message.success(
      `Moved ${ok} ${plural(ok, "item")} to ${FEEDBACK_STATUS[next].label}.`
    );
    setSelected(new Set());
    reload();
    onChange?.();
  };
  // Clear the "New" badge in one go: everything shown in New moves out.
  const clearNew = (next) => {
    const list = rows;
    if (!list.length) return;
    Modal.confirm({
      title:
        next === "closed"
          ? `Close all ${list.length} new ${plural(list.length, "item")}?`
          : `Mark all ${list.length} new ${plural(
              list.length,
              "item"
            )} as read?`,
      content:
        next === "closed"
          ? "They move to Closed. Nothing is deleted, and you can still find them under Closed or All."
          : "They move to Reviewing, so the New badge clears. Nothing is deleted.",
      okText: next === "closed" ? "Close all" : "Mark as read",
      className: "sk-thank-modal",
      onOk: () => moveMany(list, next),
    });
  };

  // Copy as plain text, ready to paste into a chat or a doc.
  const asText = (fb) =>
    [
      fb.message || "(rating only, no comment)",
      [
        userLabel(fb.user),
        fb.page || "unknown page",
        fb.rating ? `${fb.rating}/5` : null,
        dayjs(fb.createdAt).format("MMM D, h:mm A"),
      ]
        .filter(Boolean)
        .join(" · "),
    ].join("\n");
  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${what} copied`);
    } catch {
      message.error("Couldn't copy. Select the text and copy it instead.");
    }
  };

  const setItemStatus = async (fb, next) => {
    setBusyId(fb._id);
    try {
      const j = await adminRequest(`/api/feedback/admin/${fb._id}`, {
        method: "PATCH",
        body: { status: next },
      });
      message.success(
        j.bonusAwarded
          ? `Marked shipped. +${j.bonusAwarded} XP sent and the user was notified.`
          : `Moved to ${FEEDBACK_STATUS[next].label}.`
      );
      reload();
      onChange?.();
    } catch (err) {
      message.error(err.message || "Couldn't update feedback.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title={titled(IconChat, "Feedback inbox")}
      actions={
        <>
          <FilterChips
            options={[
              ...FEEDBACK_STATUSES.map((s) => [s.value, s.label]),
              ["all", "All"],
            ]}
            value={status}
            onChange={setStatus}
          />
          <Select
            size="small"
            value={type}
            onChange={setType}
            className="sk-select-dark"
            style={{ width: 110 }}
            options={[
              { value: "all", label: "All types" },
              { value: "bug", label: "Bugs" },
              { value: "idea", label: "Ideas" },
              { value: "general", label: "General" },
              { value: "checkout", label: "Checkout" },
            ]}
          />
        </>
      }
    >
      <div className="sk-fb-tools">
        {status === "new" && rows.length > 0 && (
          <div className="sk-clearbar">
            <span>
              <b>{rows.length}</b> new {plural(rows.length, "item")}
            </span>
            <button
              type="button"
              className="sk-btn sk-btn--sm sk-btn--active"
              disabled={bulkBusy}
              onClick={() => clearNew("reviewing")}
            >
              Mark all as read
            </button>
            <button
              type="button"
              className="sk-btn sk-btn--sm"
              disabled={bulkBusy}
              onClick={() => clearNew("closed")}
            >
              Close all
            </button>
          </div>
        )}
        <label className="sk-check" title="Select everything shown">
          <input
            type="checkbox"
            checked={allShownSelected}
            onChange={toggleAll}
            disabled={!rows.length}
            aria-label="Select all shown"
          />
          All
        </label>
        <input
          type="search"
          className="sk-fb-search"
          placeholder="Search feedback, people or pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search feedback"
        />
        <Select
          size="small"
          value={rating}
          onChange={setRating}
          className="sk-select-dark"
          style={{ width: 118 }}
          options={RATING_FILTERS.map(({ value, label }) => ({ value, label }))}
          aria-label="Filter by rating"
        />
        <Select
          size="small"
          value={sort}
          onChange={setSort}
          className="sk-select-dark"
          style={{ width: 122 }}
          options={SORTS}
          aria-label="Sort"
        />
        <span className="sk-fb-count">
          {loading
            ? "Loading…"
            : `${rows.length} ${plural(rows.length, "item")}`}
        </span>
        {rows.length > 0 && (
          <button
            type="button"
            className="sk-btn sk-btn--sm"
            onClick={() =>
              copy(rows.map(asText).join("\n\n---\n\n"), "All shown feedback")
            }
          >
            Copy all
          </button>
        )}
        <button
          type="button"
          className="sk-btn sk-btn--sm sk-btn--active"
          onClick={thankEveryone}
          disabled={findingAll}
          title="Everyone who has ever sent feedback and hasn't been thanked yet, one message each"
        >
          <IconThanks size={13} />
          {findingAll ? "Finding…" : "Thank everyone not yet thanked"}
        </button>
      </div>
      <BulkBar
        count={selectedRows.length}
        onClear={() => setSelected(new Set())}
      >
        {status !== "reviewing" && (
          <button
            type="button"
            className="sk-btn sk-btn--sm"
            disabled={bulkBusy}
            onClick={() => bulkStatus("reviewing")}
          >
            Mark reviewing
          </button>
        )}
        {status !== "planned" && (
          <button
            type="button"
            className="sk-btn sk-btn--sm"
            disabled={bulkBusy}
            onClick={() => bulkStatus("planned")}
          >
            Mark planned
          </button>
        )}
        {status !== "closed" && (
          <button
            type="button"
            className="sk-btn sk-btn--sm"
            disabled={bulkBusy}
            onClick={() => bulkStatus("closed")}
          >
            Close
          </button>
        )}
        <button
          type="button"
          className="sk-btn sk-btn--sm sk-btn--active"
          disabled={bulkBusy}
          onClick={() => setThanking(selectedRows)}
        >
          <IconThanks size={14} /> Send thank-you
        </button>
      </BulkBar>
      {loading ? (
        <div className="sk-empty">
          <Spinner />
        </div>
      ) : (
        <PanelContent
          isEmpty={!rows.length}
          emptyText={
            query.trim()
              ? "No feedback matches that search."
              : status === "new"
              ? "No new feedback. You're caught up."
              : "Nothing here."
          }
        >
          {rows.map((fb) => (
            <article
              key={fb._id}
              className={`sk-fb${selected.has(fb._id) ? " is-selected" : ""}`}
            >
              <div className="sk-fb__who">
                <input
                  type="checkbox"
                  className="sk-fb__pick"
                  checked={selected.has(fb._id)}
                  onChange={() => toggle(fb._id)}
                  aria-label="Select this feedback"
                />
                <b>
                  {fb.user?.name || fb.user?.username || "Signed-out visitor"}
                </b>
                {fb.user?.email && <span>{fb.user.email}</span>}
                <Pill tone={FEEDBACK_TYPE_TONES[fb.type] || "muted"}>
                  {FEEDBACK_TYPE_LABELS[fb.type] || fb.type}
                </Pill>
                {fb.rating ? <Stars value={fb.rating} /> : null}
              </div>
              <div className="sk-fb__side">
                {fb.thankedAt ? (
                  <>
                    <ThankStatus item={fb} />
                    <button
                      type="button"
                      className="sk-btn sk-btn--sm"
                      onClick={() => setThanking([fb])}
                      title="Send the thank-you again"
                    >
                      <IconRepeat size={13} /> Resend
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="sk-btn sk-btn--sm"
                    onClick={() => setThanking([fb])}
                    disabled={!fb.user}
                    title={
                      fb.user
                        ? "Send a thank-you message"
                        : "Sent signed out, so there's no one to message"
                    }
                  >
                    <IconThanks size={13} /> Thank
                  </button>
                )}
                <button
                  type="button"
                  className="sk-btn sk-btn--sm"
                  onClick={() => copy(asText(fb), "Feedback")}
                  aria-label="Copy this feedback"
                >
                  Copy
                </button>
                {busyId === fb._id ? (
                  <Spinner />
                ) : (
                  <Select
                    size="small"
                    value={fb.status}
                    className="sk-select-dark"
                    style={{ width: 120 }}
                    options={FEEDBACK_STATUSES.map((s) => ({
                      value: s.value,
                      label: s.label,
                    }))}
                    onChange={(next) => {
                      if (
                        next !== "shipped" ||
                        !fb.user ||
                        fb.shippedBonusAwarded
                      ) {
                        setItemStatus(fb, next);
                        return;
                      }
                      Modal.confirm({
                        className: "sk-thank-modal",
                        title: "Mark as shipped?",
                        content:
                          "This sends the user a +100 XP bonus and a notification. It can only happen once per item.",
                        okText: "Mark shipped",
                        onOk: () => setItemStatus(fb, next),
                      });
                    }}
                  />
                )}
              </div>
              <div className="sk-fb__msg">
                {fb.message || (
                  <span style={{ color: C.muted, fontStyle: "italic" }}>
                    Rating only, no comment
                  </span>
                )}
              </div>
              <div className="sk-fb__meta">
                <span>{fb.page || "unknown page"}</span>
                <span title={dayjs(fb.createdAt).format("MMM D, YYYY h:mm A")}>
                  {timeAgo(fb.createdAt)} ·{" "}
                  {dayjs(fb.createdAt).format("MMM D, h:mm A")}
                </span>
                {fb.xpAwarded > 0 && (
                  <Pill tone="amber">+{fb.xpAwarded} XP</Pill>
                )}
                {fb.shippedBonusAwarded && <Pill tone="green">Bonus sent</Pill>}
              </div>
            </article>
          ))}
        </PanelContent>
      )}
      <ThankModal
        kind="feedback"
        items={thanking}
        onClose={() => setThanking([])}
        onSent={() => {
          setSelected(new Set());
          reload();
        }}
      />
    </Panel>
  );
}

function TestimonialsQueue({ refreshKey, onChange }) {
  const [status, setStatus] = useState("pending");
  const { data, loading, reload } = useLoader(
    async () => {
      const j = await adminRequest(`/api/testimonials/admin?status=${status}`);
      return { status, rows: j.testimonials || [] };
    },
    { key: `${status}:${refreshKey}` }
  );
  const allRows = data?.status === status ? data.rows : [];
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("new");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rf =
      RATING_FILTERS.find((r) => r.value === rating) || RATING_FILTERS[0];
    return sortByDate(
      allRows.filter(
        (t) =>
          rf.test(Number(t.rating) || 0) &&
          (!q ||
            [t.text, t.displayName, t.city, t.user?.name, t.user?.email]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)))
      ),
      sort
    );
  }, [allRows, query, rating, sort]);
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => setSelected(new Set()), [status, refreshKey]);
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allShownSelected =
    rows.length > 0 && rows.every((r) => selected.has(r._id));
  const selectedRows = rows.filter((r) => selected.has(r._id));
  const [thanking, setThanking] = useState([]);
  // Everyone who left a review (pending or approved; rejected ones are
  // spam or abuse) and hasn't been thanked yet.
  const [findingAll, setFindingAll] = useState(false);
  const thankEveryone = async () => {
    setFindingAll(true);
    try {
      const lists = await Promise.all(
        ["pending", "approved"].map((st) =>
          adminRequest(`/api/testimonials/admin?status=${st}`)
            .then((j) => j.testimonials || [])
            .catch(() => [])
        )
      );
      const list = lists.flat().filter((t) => t.user && !t.thankedAt);
      if (!list.length) {
        message.info("Everyone who left a review has already been thanked.");
        return;
      }
      setThanking(list);
    } finally {
      setFindingAll(false);
    }
  };
  const bulkApprove = () => approveMany(selectedRows);
  const approveAll = () => {
    const list = rows.filter((t) => t.status !== "approved");
    if (!list.length) return;
    Modal.confirm({
      title: `Approve all ${list.length} ${plural(list.length, "review")}?`,
      content:
        "They go live on Skyrio. Skim them first: anything with spam, profanity or personal info should be rejected one by one instead.",
      okText: "Approve all",
      className: "sk-thank-modal",
      onOk: () => approveMany(list),
    });
  };
  const approveMany = async (list) => {
    setBusy(true);
    let ok = 0;
    for (const t of list.filter((t) => t.status !== "approved")) {
      try {
        await adminRequest(`/api/testimonials/admin/${t._id}`, {
          method: "PATCH",
          body: { action: "approve" },
        });
        ok += 1;
      } catch {
        /* keep going */
      }
    }
    setBusy(false);
    message.success(`Approved ${ok} ${plural(ok, "review")}.`);
    setSelected(new Set());
    reload();
    onChange?.();
  };

  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);

  const act = async (t, action, extra = {}) => {
    setBusy(true);
    try {
      await adminRequest(`/api/testimonials/admin/${t._id}`, {
        method: "PATCH",
        body: { action, ...extra },
      });
      message.success(
        {
          approve: "Approved.",
          reject: "Rejected.",
          feature: "Featured on the homepage.",
          unfeature: "Removed from the homepage.",
        }[action]
      );
      setRejecting(null);
      reload();
      onChange?.();
    } catch (err) {
      message.error(err.message || "Couldn't update the review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={titled(IconStar, "Reviews")}
      actions={
        <FilterChips
          options={REVIEW_FILTERS}
          value={status}
          onChange={setStatus}
        />
      }
    >
      <div className="sk-fb-tools">
        {status === "pending" && rows.length > 0 && (
          <div className="sk-clearbar">
            <span>
              <b>{rows.length}</b> waiting for approval
            </span>
            <button
              type="button"
              className="sk-btn sk-btn--sm sk-btn--active"
              disabled={busy}
              onClick={approveAll}
            >
              Approve all
            </button>
          </div>
        )}
        <label className="sk-check" title="Select everything shown">
          <input
            type="checkbox"
            checked={allShownSelected}
            onChange={() =>
              setSelected(
                allShownSelected ? new Set() : new Set(rows.map((r) => r._id))
              )
            }
            disabled={!rows.length}
            aria-label="Select all shown"
          />
          All
        </label>
        <input
          type="search"
          className="sk-fb-search"
          placeholder="Search reviews or names…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search reviews"
        />
        <Select
          size="small"
          value={rating}
          onChange={setRating}
          className="sk-select-dark"
          style={{ width: 118 }}
          options={RATING_FILTERS.map(({ value, label }) => ({ value, label }))}
          aria-label="Filter by rating"
        />
        <Select
          size="small"
          value={sort}
          onChange={setSort}
          className="sk-select-dark"
          style={{ width: 122 }}
          options={SORTS}
          aria-label="Sort"
        />
        <span className="sk-fb-count">
          {loading
            ? "Loading…"
            : `${rows.length} ${plural(rows.length, "review")}`}
        </span>
        <button
          type="button"
          className="sk-btn sk-btn--sm sk-btn--active"
          onClick={thankEveryone}
          disabled={findingAll}
          title="Everyone who has left a review and hasn't been thanked yet, one message each"
        >
          <IconThanks size={13} />
          {findingAll ? "Finding…" : "Thank everyone not yet thanked"}
        </button>
      </div>
      <BulkBar
        count={selectedRows.length}
        onClear={() => setSelected(new Set())}
      >
        {status !== "approved" && (
          <button
            type="button"
            className="sk-btn sk-btn--sm"
            disabled={busy}
            onClick={bulkApprove}
          >
            Approve
          </button>
        )}
        <button
          type="button"
          className="sk-btn sk-btn--sm sk-btn--active"
          disabled={busy}
          onClick={() => setThanking(selectedRows)}
        >
          <IconThanks size={14} /> Send thank-you
        </button>
      </BulkBar>
      {loading ? (
        <div className="sk-empty">
          <Spinner />
        </div>
      ) : (
        <PanelContent
          isEmpty={!rows.length}
          emptyText={
            query.trim() || rating !== "all"
              ? "No reviews match those filters."
              : status === "pending"
              ? "No reviews waiting."
              : "Nothing here yet."
          }
        >
          {rows.map((t) => {
            const b = t.booking;
            const tripLabel = !b
              ? "General review (no trip)"
              : `${isHotelBooking(b) ? "Stay" : "Trip"}: ${bookingTitle(b)}`;
            return (
              <div
                key={t._id}
                className={`sk-row sk-row--top${
                  selected.has(t._id) ? " is-selected" : ""
                }`}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="sk-name">
                    <input
                      type="checkbox"
                      className="sk-fb__pick"
                      checked={selected.has(t._id)}
                      onChange={() => toggle(t._id)}
                      aria-label="Select this review"
                    />
                    <Stars value={t.rating} />
                    {t.thankedAt && <ThankStatus item={t} />}
                    {t.featured && <Pill tone="orange">Featured</Pill>}
                    {!t.consent && <Pill tone="muted">Not OK to feature</Pill>}
                    {t.rejectReason && (
                      <Pill tone="red">{REJECT_LABELS[t.rejectReason]}</Pill>
                    )}
                  </div>
                  <div className="sk-text sk-quote">{t.text}</div>
                  <div className="sk-sub" style={{ marginTop: 6 }}>
                    Shown as “{t.displayName || "Skyrio traveler"}”
                    {t.city ? `, ${t.city}` : ""} · {userLabel(t.user)}
                  </div>
                  <div className="sk-sub">
                    {tripLabel} · {timeAgo(t.createdAt)}
                    {t.reviewedBy &&
                      ` · ${t.status} by ${t.reviewedBy} ${timeAgo(
                        t.reviewedAt
                      )}`}
                  </div>
                </div>
                <div className="sk-row__right">
                  {t.thankedAt && t.user && (
                    <button
                      type="button"
                      className="sk-btn sk-btn--sm"
                      disabled={busy}
                      onClick={() => setThanking([t])}
                      title="Send the thank-you again"
                    >
                      <IconRepeat size={13} /> Resend
                    </button>
                  )}
                  {!t.thankedAt && (
                    <button
                      type="button"
                      className="sk-btn sk-btn--sm"
                      disabled={busy || !t.user}
                      onClick={() => setThanking([t])}
                      title={
                        t.user
                          ? "Send a thank-you message"
                          : "No account linked, so there's no one to message"
                      }
                    >
                      <IconThanks size={13} /> Thank
                    </button>
                  )}
                  {t.status !== "approved" && (
                    <button
                      type="button"
                      className="sk-btn sk-btn--sm"
                      disabled={busy}
                      onClick={() => act(t, "approve")}
                    >
                      Approve
                    </button>
                  )}
                  {t.status === "approved" && (
                    <button
                      type="button"
                      className={`sk-btn sk-btn--sm${
                        t.featured ? " sk-btn--active" : ""
                      }`}
                      disabled={busy || (!t.featured && !t.consent)}
                      title={
                        !t.consent
                          ? "The author didn't OK featuring this review"
                          : undefined
                      }
                      onClick={() =>
                        act(t, t.featured ? "unfeature" : "feature")
                      }
                    >
                      {t.featured ? "★ Featured" : "Feature"}
                    </button>
                  )}
                  {t.status !== "rejected" && (
                    <button
                      type="button"
                      className="sk-btn sk-btn--sm sk-btn--danger"
                      disabled={busy}
                      onClick={() => {
                        setReason(null);
                        setRejecting(t);
                      }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </PanelContent>
      )}

      <Modal
        open={!!rejecting}
        title="Reject this review?"
        onCancel={() => setRejecting(null)}
        onOk={() => {
          if (!reason) {
            message.warning("Pick a reason.");
            return;
          }
          act(rejecting, "reject", { reason });
        }}
        okText="Reject"
        okButtonProps={{ danger: true, loading: busy }}
        className="sk-challenge-modal"
        destroyOnClose
      >
        <p className="sk-modal-hint">
          Reviews can only be rejected for these reasons. A low rating or
          criticism is never one of them. Spam also loses its XP.
        </p>
        <Select
          value={reason}
          onChange={setReason}
          options={REJECT_REASONS}
          placeholder="Choose a reason"
          style={{ width: "100%" }}
        />
      </Modal>
      <ThankModal
        kind="review"
        items={thanking}
        onClose={() => setThanking([])}
        onSent={() => {
          setSelected(new Set());
          reload();
        }}
      />
    </Panel>
  );
}

function XpLog({ refreshKey }) {
  const { data, loading, reload } = useLoader(
    async () => adminRequest("/api/feedback/admin/xp-log"),
    { key: refreshKey }
  );
  const awards = data?.awards || [];
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const shown = flaggedOnly ? awards.filter((a) => a.flag) : awards;

  const reverse = async (a) => {
    try {
      await adminRequest(`/api/feedback/admin/xp-log/${a._id}/reverse`, {
        method: "POST",
        body: {},
      });
      message.success(`Reversed ${a.amount} XP.`);
      reload();
    } catch (err) {
      message.error(err.message || "Couldn't reverse XP.");
    }
  };

  return (
    <Panel
      title={titled(IconSpark, "Feedback XP log")}
      meta={
        Number.isFinite(Number(data?.flaggedUsers)) &&
        data?.flaggedUsers != null
          ? `${data.flaggedUsers} flagged ${plural(data.flaggedUsers, "user")}`
          : undefined
      }
      actions={
        <FilterChips
          options={[
            ["all", "All"],
            ["flagged", "Flagged"],
          ]}
          value={flaggedOnly ? "flagged" : "all"}
          onChange={(v) => setFlaggedOnly(v === "flagged")}
        />
      }
    >
      <PanelContent
        loading={loading}
        isEmpty={!shown.length}
        emptyText={
          flaggedOnly
            ? "No one looks like they're farming XP."
            : "No feedback XP awarded yet."
        }
      >
        {shown.map((a) => (
          <div
            key={a._id}
            className="sk-row"
            style={a.reversed ? { opacity: 0.55 } : undefined}
          >
            <div className="sk-row__left">
              <div style={{ minWidth: 0 }}>
                <div className="sk-name">
                  {a.user?.name || a.user?.username || "Unknown user"}
                  {a.flag && (
                    <Pill tone="red">
                      Flag: {a.flag.thisWeek} this week · {a.flag.last30} in 30d
                    </Pill>
                  )}
                  {a.reversed && <Pill tone="muted">Reversed</Pill>}
                </div>
                <div className="sk-sub">
                  {XP_REASON_LABELS[a.reason] || a.reason} ·{" "}
                  {timeAgo(a.createdAt)}
                  {a.reversed &&
                    a.reversedBy &&
                    ` · reversed by ${a.reversedBy}`}
                </div>
              </div>
            </div>
            <div className="sk-row__right">
              <span
                className="sk-amount"
                style={{ color: a.reversed ? C.muted : C.orange }}
              >
                +{a.amount} XP
              </span>
              {!a.reversed && (
                <Popconfirm
                  overlayClassName="sk-pop"
                  title="Reverse this XP?"
                  description={`Takes ${a.amount} XP back from this user. This is logged.`}
                  okText="Reverse"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => reverse(a)}
                >
                  <button
                    type="button"
                    className="sk-btn sk-btn--sm sk-btn--danger"
                  >
                    Reverse
                  </button>
                </Popconfirm>
              )}
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

function FeedbackAudit({ refreshKey }) {
  const { data, loading } = useLoader(
    async () => (await adminRequest("/api/feedback/admin/audit")).entries || [],
    { key: refreshKey }
  );
  const rows = data || [];
  return (
    <Panel
      title={titled(IconLog, "Decision log")}
      meta="Every approve, reject, feature, ship and reversal"
    >
      <PanelContent
        loading={loading}
        isEmpty={!rows.length}
        emptyText="No decisions yet"
      >
        {rows.slice(0, 30).map((e) => (
          <div key={e._id} className="sk-feed__item">
            <span className="sk-feed__dot" style={{ background: C.blue }} />
            <div>
              <div className="sk-text" style={{ marginTop: 0 }}>
                <b>{e.action}</b> · {e.detail}
              </div>
              <div className="sk-sub">
                {e.admin} · {dayjs(e.createdAt).format("MMM D, YYYY h:mm A")}
              </div>
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

function FeedbackTab({ refreshKey, onCountsChange }) {
  // Bump after any action so the stats, XP log and decision log stay in sync.
  const [localKey, setLocalKey] = useState(0);
  const key = `${refreshKey}:${localKey}`;
  const changed = () => {
    setLocalKey((k) => k + 1);
    onCountsChange?.();
  };
  return (
    <>
      {/* What testers said comes first; numbers and logs below. */}
      <Section title="Feedback">
        <FeedbackInbox refreshKey={refreshKey} onChange={changed} />
      </Section>
      <Section title="At a glance">
        <FeedbackStats refreshKey={key} />
      </Section>
      <Section title="XP & records">
        <div className="sk-grid-2">
          <XpLog refreshKey={key} />
          <FeedbackAudit refreshKey={key} />
        </div>
      </Section>
    </>
  );
}

function ReviewsTab({ refreshKey, onCountsChange }) {
  return (
    <Section title="Reviews">
      <TestimonialsQueue refreshKey={refreshKey} onChange={onCountsChange} />
    </Section>
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

  const attention = useAttentionCounts(refreshKey);
  const feedbackCounts = useFeedbackCounts(refreshKey);
  const counts = { ...attention, feedback: feedbackCounts };

  useEffect(() => {
    if (dashboard.data) setLastRefresh(new Date());
  }, [dashboard.data]);

  // Lighter page while the dashboard is open (see ADMIN_PAGE_CSS).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sk-admin-page");
    return () => root.classList.remove("sk-admin-page");
  }, []);

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
    // Separate tabs, each with its own badge, so each can be cleared out.
    { key: "feedback", label: "Feedback", count: feedbackCounts.newFeedback },
    { key: "reviews", label: "Reviews", count: feedbackCounts.pendingReviews },
    { key: "engagement", label: "Challenges & rewards" },
  ];

  return (
    <div className="sk-admin">
      <style>{INJECTED_CSS + ADMIN_PAGE_CSS}</style>

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
              <IconClock size={15} /> {skyhub.overdueTakedowns} intimate-image
              removal{" "}
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
          <div className="sk-alert sk-alert--soft">
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <IconAlert size={15} /> {dashboard.error}
            </span>
          </div>
        )}

        {tab === "overview" && (
          <OverviewTab
            dashboard={dashboard}
            growth={growth}
            counts={counts}
            onOpenModeration={() => setTab("moderation")}
            onOpenFeedback={() => setTab("feedback")}
            onOpenReviews={() => setTab("reviews")}
          />
        )}
        {tab === "moderation" && (
          <ModerationTab refreshKey={refreshKey} counts={counts} />
        )}
        {tab === "feedback" && (
          <FeedbackTab
            refreshKey={refreshKey}
            onCountsChange={feedbackCounts.reload}
          />
        )}
        {tab === "reviews" && (
          <ReviewsTab
            refreshKey={refreshKey}
            onCountsChange={feedbackCounts.reload}
          />
        )}
        {tab === "engagement" && <EngagementTab refreshKey={refreshKey} />}
      </main>
    </div>
  );
};

export default AdminDashboard;
