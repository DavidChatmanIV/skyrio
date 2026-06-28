import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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

// ✅ Real SVG icons for Challenges specifically — not emoji like the rest
// of this dashboard's stat cards. Worth keeping separate: a Challenge's
// icon is shown to actual end users (in PassportRewards.jsx's
// ChallengeCard), so it needs to render reliably across every OS/browser,
// not just look fine in whatever environment this admin page happens to
// be viewed in. Stored as a short key string ("trophy", "flag", etc.),
// not the emoji itself — PassportRewards.jsx needs the matching lookup
// table to resolve the same key back into the same icon.
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

function ChallengeIconPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {CHALLENGE_ICONS.map(({ key, label, Icon }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            title={label}
            onClick={() => onChange(key)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              cursor: "pointer",
              background: selected
                ? "rgba(255,138,42,0.18)"
                : "rgba(255,255,255,0.05)",
              border: selected
                ? "1px solid #ff8a2a"
                : "1px solid rgba(255,255,255,0.12)",
              color: selected ? "#ff8a2a" : "rgba(255,255,255,0.6)",
              transition: "all 0.15s",
            }}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

// Action types a Challenge can track — matches the real keys in
// backend/config/xpRules.js (XP_RULES + XP_PASSIVE) so a challenge always
// rides on an action that already earns XP correctly, rather than
// inventing a new tracking mechanism.
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#07060f",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(255,138,42,0.3)",
  orange: "#ff8a2a",
  orangeDim: "rgba(255,138,42,0.12)",
  purple: "#7c5cfc",
  purpleDim: "rgba(124,92,252,0.12)",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.12)",
  blue: "#60a5fa",
  blueDim: "rgba(96,165,250,0.12)",
  white: "#fff",
  muted: "rgba(255,255,255,0.45)",
};

const INJECTED_CSS = `
  .sk-admin * { box-sizing: border-box; }
  .sk-admin { min-height: 100vh; background: ${C.bg}; color: ${C.white}; font-family: "DM Sans", sans-serif; }
  .sk-admin__topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(255,255,255,0.02);
    border-bottom: 1px solid ${C.border};
    position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);
  }
  .sk-admin__logo { font-family: "Syne", sans-serif; font-size: 16px; font-weight: 800; color: ${C.white}; display: flex; align-items: center; gap: 8px; }
  .sk-admin__badge { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; background: ${C.orangeDim}; border: 1px solid ${C.borderAccent}; color: ${C.orange}; border-radius: 999px; padding: 3px 10px; }
  .sk-admin__body { padding: 32px; max-width: 1300px; margin: 0 auto; }
  .sk-admin__section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${C.muted}; margin-bottom: 16px; }
  .sk-admin__stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  @media (max-width: 900px) { .sk-admin__stats { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 500px) { .sk-admin__stats { grid-template-columns: 1fr; } }
  .sk-stat { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; padding: 20px; transition: border-color .2s, transform .2s; }
  .sk-stat:hover { border-color: rgba(255,255,255,0.16); transform: translateY(-2px); }
  .sk-stat__icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; margin-bottom: 14px; }
  .sk-stat__val { font-family: "Syne", sans-serif; font-size: 28px; font-weight: 800; color: ${C.white}; line-height: 1; margin-bottom: 4px; }
  .sk-stat__label { font-size: 12px; color: ${C.muted}; }
  .sk-admin__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  @media (max-width: 860px) { .sk-admin__grid { grid-template-columns: 1fr; } }
  .sk-admin__card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; overflow: hidden; }
  .sk-admin__card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid ${C.border}; }
  .sk-admin__card-title { font-size: 13px; font-weight: 700; color: ${C.white}; }
  .sk-admin__card-count { font-size: 11px; color: ${C.muted}; background: rgba(255,255,255,0.06); border-radius: 999px; padding: 2px 10px; }
  .sk-admin__row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid ${C.border}; transition: background .15s; }
  .sk-admin__row:last-child { border-bottom: none; }
  .sk-admin__row:hover { background: rgba(255,255,255,0.03); }
  .sk-admin__row-left { display: flex; align-items: center; gap: 10px; }
  .sk-admin__avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, ${C.purple}, ${C.orange}); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${C.white}; flex-shrink: 0; overflow: hidden; }
  .sk-admin__name { font-size: 13px; font-weight: 600; color: ${C.white}; }
  .sk-admin__sub { font-size: 11px; color: ${C.muted}; margin-top: 1px; }
  .sk-admin__pill { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 999px; padding: 3px 10px; }
  .sk-admin__feed { display: flex; flex-direction: column; }
  .sk-admin__feed-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 20px; border-bottom: 1px solid ${C.border}; }
  .sk-admin__feed-item:last-child { border-bottom: none; }
  .sk-admin__feed-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .sk-admin__feed-text { font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.5; }
  .sk-admin__feed-time { font-size: 11px; color: ${C.muted}; margin-top: 2px; }
  .sk-admin__rev { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; }
  .sk-admin__rev-row { display: flex; flex-direction: column; gap: 5px; }
  .sk-admin__rev-label { display: flex; justify-content: space-between; font-size: 12px; color: ${C.muted}; }
  .sk-admin__rev-bar { height: 6px; background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; }
  .sk-admin__rev-fill { height: 100%; border-radius: 999px; transition: width 0.8s ease; }
  .sk-admin__spinner { width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); border-top-color: ${C.orange}; animation: sk-spin 0.7s linear infinite; display: inline-block; }
  @keyframes sk-spin { to { transform: rotate(360deg); } }
  .sk-admin__empty { padding: 32px; text-align: center; font-size: 13px; color: ${C.muted}; }
  .sk-admin__topbtn { background: none; border: 1px solid ${C.border}; color: ${C.muted}; padding: 6px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; font-family: inherit; transition: border-color .2s, color .2s; }
  .sk-admin__topbtn:hover { border-color: ${C.orange}; color: ${C.orange}; }

  /* ── Support Inbox banner ── */
  .sk-admin__support-banner {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 18px 24px;
    background: rgba(255,138,42,0.08);
    border: 1px solid rgba(255,138,42,0.28);
    border-radius: 14px; margin-bottom: 28px;
    cursor: pointer; transition: background .2s, border-color .2s;
  }
  .sk-admin__support-banner:hover {
    background: rgba(255,138,42,0.14);
    border-color: rgba(255,138,42,0.5);
  }
  .sk-admin__support-banner-left { display: flex; align-items: center; gap: 14px; }
  .sk-admin__support-icon {
    width: 42px; height: 42px; border-radius: 12px;
    background: rgba(255,138,42,0.15); border: 1px solid rgba(255,138,42,0.3);
    display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
  }
  .sk-admin__support-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 3px; }
  .sk-admin__support-sub { font-size: 12px; color: rgba(255,255,255,0.45); }
  .sk-admin__support-arrow { font-size: 20px; font-weight: 700; color: #ff8a2a; flex-shrink: 0; }

  /* ── Challenges section ── */
  .sk-admin__challenge-actions { display: flex; align-items: center; gap: 8px; }
  .sk-admin__challenge-action-btn {
    background: none; border: 1px solid ${C.border}; color: ${C.muted};
    padding: 4px 10px; border-radius: 999px; font-size: 11px; cursor: pointer;
    font-family: inherit; transition: border-color .2s, color .2s;
  }
  .sk-admin__challenge-action-btn:hover { border-color: ${C.orange}; color: ${C.orange}; }
  .sk-admin__challenge-action-btn--danger:hover { border-color: ${C.red}; color: ${C.red}; }

  /* ── Challenge modal — fix: typed/selected values were rendering in
     antd's default dark text on this dark modal background, nearly
     invisible. Force every input type to light text explicitly. ── */
  .sk-challenge-modal .ant-form-item-label > label { color: rgba(255,255,255,0.7) !important; }
  .sk-challenge-modal .ant-input,
  .sk-challenge-modal textarea.ant-input {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.15) !important;
    color: #fff !important;
  }
  .sk-challenge-modal .ant-input::placeholder { color: rgba(255,255,255,0.35) !important; }
  .sk-challenge-modal .ant-input-number {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.15) !important;
  }
  .sk-challenge-modal .ant-input-number-input { color: #fff !important; }
  .sk-challenge-modal .ant-select-selector {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.15) !important;
  }
  .sk-challenge-modal .ant-select-selection-item,
  .sk-challenge-modal .ant-select-selection-placeholder { color: #fff !important; }
  .sk-challenge-modal .ant-select-selection-item {
    background: rgba(255,138,42,0.18) !important;
    border-color: rgba(255,138,42,0.4) !important;
  }
  .sk-challenge-modal .ant-picker {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.15) !important;
  }
  .sk-challenge-modal .ant-picker-input input { color: #fff !important; }
  .sk-challenge-modal .ant-picker-separator,
  .sk-challenge-modal .ant-picker-suffix { color: rgba(255,255,255,0.5) !important; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
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

function fmt$(n) {
  return `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusPill({ status }) {
  const map = {
    confirmed: { bg: C.greenDim, color: C.green },
    pending: { bg: C.orangeDim, color: C.orange },
    cancelled: { bg: C.redDim, color: C.red },
  };
  const s = map[status] || { bg: C.card, color: C.muted };
  return (
    <span
      className="sk-admin__pill"
      style={{ background: s.bg, color: s.color }}
    >
      {status || "unknown"}
    </span>
  );
}

function LevelPill({ xp = 0 }) {
  const level =
    xp >= 2000
      ? { label: "Legend", color: C.orange }
      : xp >= 1000
      ? { label: "Expert", color: C.purple }
      : xp >= 500
      ? { label: "Adventurer", color: C.blue }
      : xp >= 200
      ? { label: "Traveler", color: C.green }
      : { label: "Explorer", color: C.muted };
  return (
    <span
      className="sk-admin__pill"
      style={{ background: level.color + "20", color: level.color }}
    >
      {level.label}
    </span>
  );
}

function ChallengeStatusPill({ challenge }) {
  const now = Date.now();
  const start = new Date(challenge.startDate).getTime();
  const end = new Date(challenge.endDate).getTime();

  let label, color;
  if (!challenge.active) {
    label = "Ended early";
    color = C.red;
  } else if (now < start) {
    label = "Upcoming";
    color = C.blue;
  } else if (now > end) {
    label = "Finished";
    color = C.muted;
  } else {
    label = "Running";
    color = C.green;
  }

  return (
    <span
      className="sk-admin__pill"
      style={{ background: color + "20", color }}
    >
      {label}
    </span>
  );
}

function resolveChallengeIcon(key) {
  const found = CHALLENGE_ICONS.find((i) => i.key === key);
  const Icon = found?.Icon || TrophyOutlined;
  return <Icon />;
}

function StatCard({ icon, label, value, color, dim }) {
  return (
    <div className="sk-stat">
      <div className="sk-stat__icon" style={{ background: dim, color }}>
        {icon}
      </div>
      <div className="sk-stat__val">
        {value ?? <span className="sk-admin__spinner" />}
      </div>
      <div className="sk-stat__label">{label}</div>
    </div>
  );
}

// ─── Support inbox ticket count from localStorage ─────────────────────────────
function useSupportCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    try {
      const tickets = JSON.parse(
        localStorage.getItem("skyrio_support_tickets") || "[]"
      );
      setCount(tickets.filter((t) => t.status === "open").length);
    } catch {
      setCount(0);
    }
  }, []);
  return count;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const openTickets = useSupportCount();

  // ✅ NEW: Challenges management state. Uses the same auth pattern as
  // everything else on this page (credentials: "include", cookie-based
  // verifyAdmin) — not the Bearer-token flow regular user pages use.
  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null); // null = creating new
  const [saving, setSaving] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState("trophy");
  const [form] = Form.useForm();

  const fetchChallenges = useCallback(async () => {
    setChallengesLoading(true);
    try {
      const res = await fetch(apiUrl("/api/challenges/admin"), {
        credentials: "include",
        headers: { "x-admin-email": localStorage.getItem("admin_email") || "" },
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok) setChallenges(json.challenges || []);
    } catch {
      // Non-fatal — the rest of the dashboard still works without this.
    }
    setChallengesLoading(false);
  }, []);

  const openCreateModal = () => {
    setEditingChallenge(null);
    form.resetFields();
    setSelectedIcon("trophy");
    setModalOpen(true);
  };

  const openEditModal = (challenge) => {
    setEditingChallenge(challenge);
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
    // Falls back to "trophy" if this challenge predates the icon-key
    // system (e.g. still has an old raw emoji value) rather than crashing
    // on an unrecognized key.
    const knownKey = CHALLENGE_ICONS.some((i) => i.key === challenge.icon);
    setSelectedIcon(knownKey ? challenge.icon : "trophy");
    setModalOpen(true);
  };

  const handleSaveChallenge = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        title: values.title,
        description: values.description,
        theme: values.theme || "general",
        icon: selectedIcon,
        requirement: {
          // Select with mode="tags" always returns an array even when
          // maxCount limits it to one selection.
          actionType: Array.isArray(values.actionType)
            ? values.actionType[0]
            : values.actionType,
          count: values.count,
        },
        bonusXP: values.bonusXP,
        startDate: values.dateRange[0].toISOString(),
        endDate: values.dateRange[1].toISOString(),
      };

      const url = editingChallenge
        ? apiUrl(`/api/challenges/${editingChallenge.id}`)
        : apiUrl("/api/challenges");
      const method = editingChallenge ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": localStorage.getItem("admin_email") || "",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Failed to save challenge.");
      }

      message.success(
        editingChallenge ? "Challenge updated." : "Challenge created."
      );
      setModalOpen(false);
      fetchChallenges();
    } catch (err) {
      if (err?.errorFields) return; // antd form validation error — already shown inline
      message.error(err.message || "Failed to save challenge.");
    } finally {
      setSaving(false);
    }
  };

  const handleEndChallenge = async (challenge) => {
    try {
      const res = await fetch(apiUrl(`/api/challenges/${challenge.id}`), {
        method: "DELETE",
        credentials: "include",
        headers: { "x-admin-email": localStorage.getItem("admin_email") || "" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Failed to end challenge.");
      }
      message.success("Challenge ended.");
      fetchChallenges();
    } catch (err) {
      message.error(err.message || "Failed to end challenge.");
    }
  };

  // ✅ NEW: Rewards catalog management — same pattern as Challenges above,
  // same verifyAdmin auth, same soft-remove (active: false) rather than a
  // hard delete, since a hard delete would orphan anyone's existing
  // redeemedRewards entry for that item.
  const [rewardItems, setRewardItems] = useState([]);
  const [rewardItemsLoading, setRewardItemsLoading] = useState(true);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null); // null = creating new
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardForm] = Form.useForm();

  const fetchRewardItems = useCallback(async () => {
    setRewardItemsLoading(true);
    try {
      const res = await fetch(apiUrl("/api/rewards/items/admin"), {
        credentials: "include",
        headers: { "x-admin-email": localStorage.getItem("admin_email") || "" },
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok) setRewardItems(json.items || []);
    } catch {
      // Non-fatal — the rest of the dashboard still works without this.
    }
    setRewardItemsLoading(false);
  }, []);

  const openCreateRewardModal = () => {
    setEditingReward(null);
    rewardForm.resetFields();
    setRewardModalOpen(true);
  };

  const openEditRewardModal = (item) => {
    setEditingReward(item);
    rewardForm.setFieldsValue({
      itemId: item.itemId,
      title: item.title,
      desc: item.desc,
      type: item.type,
      cost: item.cost,
      level: item.level,
      featured: item.featured,
      repeatable: item.repeatable,
      isNew: item.isNew,
    });
    setRewardModalOpen(true);
  };

  const handleSaveReward = async () => {
    try {
      const values = await rewardForm.validateFields();
      setRewardSaving(true);

      const url = editingReward
        ? apiUrl(`/api/rewards/items/${editingReward.itemId}`)
        : apiUrl("/api/rewards/items");
      const method = editingReward ? "PATCH" : "POST";

      // itemId is only sent on create — it's the stable slug and can't be
      // changed afterward (changing it would orphan it from anyone's
      // existing redeemedRewards entries), so the edit payload omits it
      // even though the form shows it (disabled) for reference.
      const payload = editingReward
        ? {
            title: values.title,
            desc: values.desc,
            type: values.type,
            cost: values.cost,
            level: values.level,
            featured: values.featured,
            repeatable: values.repeatable,
            isNew: values.isNew,
          }
        : values;

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": localStorage.getItem("admin_email") || "",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Failed to save reward item.");
      }

      message.success(editingReward ? "Item updated." : "Item created.");
      setRewardModalOpen(false);
      fetchRewardItems();
    } catch (err) {
      if (err?.errorFields) return; // antd form validation error — already shown inline
      message.error(err.message || "Failed to save reward item.");
    } finally {
      setRewardSaving(false);
    }
  };

  const handleRemoveReward = async (item) => {
    try {
      const res = await fetch(apiUrl(`/api/rewards/items/${item.itemId}`), {
        method: "DELETE",
        credentials: "include",
        headers: { "x-admin-email": localStorage.getItem("admin_email") || "" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Failed to remove item.");
      }
      message.success("Item removed.");
      fetchRewardItems();
    } catch (err) {
      message.error(err.message || "Failed to remove item.");
    }
  };

  // ── Guard: redirect if not logged in ──
  useEffect(() => {
    const isAdmin = localStorage.getItem("admin");
    if (!isAdmin) navigate("/admin/login");
  }, [navigate]);

  // ── Fetch dashboard data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/admin/dashboard"), {
        credentials: "include",
        headers: { "x-admin-email": localStorage.getItem("admin_email") || "" },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin");
        localStorage.removeItem("admin_email");
        navigate("/admin/login");
        return;
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to load");
      setData(json.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || "Could not load dashboard.");
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchData();
    fetchChallenges();
    fetchRewardItems();
  }, [fetchData, fetchChallenges, fetchRewardItems]);

  const handleLogout = async () => {
    await fetch(apiUrl("/api/admin/logout"), {
      method: "POST",
      credentials: "include",
    });
    localStorage.removeItem("admin");
    localStorage.removeItem("admin_email");
    navigate("/admin/login");
  };

  const stats = data?.stats || {};
  const users = data?.recentUsers || [];
  const bookings = data?.recentBookings || [];
  const activity = data?.recentActivity || [];
  const revenue = data?.revenueByStatus || {};

  return (
    <div className="sk-admin">
      <style>{INJECTED_CSS}</style>

      {/* Top bar */}
      <div className="sk-admin__topbar">
        <div className="sk-admin__logo">
          ✦ Skyrio <span className="sk-admin__badge">Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: C.muted }}>
              Updated {timeAgo(lastRefresh)}
            </span>
          )}
          <button
            className="sk-admin__topbtn"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
          <button className="sk-admin__topbtn" onClick={() => navigate("/")}>
            ← Skyrio
          </button>
          <Button type="primary" danger size="small" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="sk-admin__body">
        {error && (
          <div
            style={{
              background: C.redDim,
              border: `1px solid ${C.red}44`,
              borderRadius: 12,
              padding: "14px 20px",
              color: C.red,
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* ── Support Inbox Banner ── */}
        <div
          className="sk-admin__support-banner"
          onClick={() => navigate("/admin/support")}
        >
          <div className="sk-admin__support-banner-left">
            <div className="sk-admin__support-icon">📬</div>
            <div>
              <div className="sk-admin__support-title">
                Support Inbox
                {openTickets > 0 && (
                  <span
                    style={{
                      marginLeft: 10,
                      background: "#ff8a2a",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 11,
                      padding: "2px 9px",
                      fontWeight: 700,
                    }}
                  >
                    {openTickets} open
                  </span>
                )}
              </div>
              <div className="sk-admin__support-sub">
                {openTickets > 0
                  ? `${openTickets} customer ticket${
                      openTickets > 1 ? "s" : ""
                    } waiting for your reply`
                  : "No open tickets — all caught up!"}
              </div>
            </div>
          </div>
          <div className="sk-admin__support-arrow">→</div>
        </div>

        {/* ── Stats row 1 ── */}
        <div className="sk-admin__section-title">Overview</div>
        <div className="sk-admin__stats">
          <StatCard
            icon="👤"
            label="Total Users"
            value={stats.totalUsers}
            color={C.purple}
            dim={C.purpleDim}
          />
          <StatCard
            icon="✈️"
            label="Total Bookings"
            value={stats.totalBookings}
            color={C.orange}
            dim={C.orangeDim}
          />
          <StatCard
            icon="💰"
            label="Confirmed Revenue"
            value={
              stats.totalRevenue != null ? fmt$(stats.totalRevenue) : undefined
            }
            color={C.green}
            dim={C.greenDim}
          />
          <StatCard
            icon="🌟"
            label="Total XP Awarded"
            value={
              stats.totalXP != null ? stats.totalXP.toLocaleString() : undefined
            }
            color={C.blue}
            dim={C.blueDim}
          />
        </div>

        {/* ── Stats row 2 ── */}
        <div className="sk-admin__stats" style={{ marginBottom: 32 }}>
          <StatCard
            icon="📅"
            label="New Users (7d)"
            value={stats.newUsersWeek}
            color={C.purple}
            dim={C.purpleDim}
          />
          <StatCard
            icon="🎫"
            label="Bookings (7d)"
            value={stats.newBookingsWeek}
            color={C.orange}
            dim={C.orangeDim}
          />
          <StatCard
            icon="✅"
            label="Confirmed"
            value={stats.confirmedBookings}
            color={C.green}
            dim={C.greenDim}
          />
          <StatCard
            icon="⏳"
            label="Pending"
            value={stats.pendingBookings}
            color={C.blue}
            dim={C.blueDim}
          />
        </div>

        {/* ── Users + Bookings ── */}
        <div className="sk-admin__grid">
          {/* Recent users */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Recent Users</span>
              <span className="sk-admin__card-count">{users.length} shown</span>
            </div>
            {loading && (
              <div className="sk-admin__empty">
                <span className="sk-admin__spinner" />
              </div>
            )}
            {!loading && users.length === 0 && (
              <div className="sk-admin__empty">No users yet</div>
            )}
            {users.map((u) => (
              <div key={u._id} className="sk-admin__row">
                <div className="sk-admin__row-left">
                  <div className="sk-admin__avatar">
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      initials(u.name || u.username)
                    )}
                  </div>
                  <div>
                    <div className="sk-admin__name">{u.name || u.username}</div>
                    <div className="sk-admin__sub">
                      {u.email} · {timeAgo(u.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LevelPill xp={u.xp} />
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: C.orange }}
                  >
                    {(u.xp || 0).toLocaleString()} XP
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent bookings */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Recent Bookings</span>
              <span className="sk-admin__card-count">
                {bookings.length} shown
              </span>
            </div>
            {loading && (
              <div className="sk-admin__empty">
                <span className="sk-admin__spinner" />
              </div>
            )}
            {!loading && bookings.length === 0 && (
              <div className="sk-admin__empty">No bookings yet</div>
            )}
            {bookings.map((b) => (
              <div key={b._id} className="sk-admin__row">
                <div className="sk-admin__row-left">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: C.orangeDim,
                      border: `1px solid ${C.borderAccent}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    ✈️
                  </div>
                  <div>
                    <div className="sk-admin__name">
                      {b.flight?.origin || "?"} → {b.flight?.destination || "?"}
                    </div>
                    <div className="sk-admin__sub">
                      {b.travelers?.[0]?.email || "Unknown"} ·{" "}
                      {timeAgo(b.createdAt)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <StatusPill status={b.status} />
                  {b.total != null && (
                    <span
                      style={{ fontSize: 12, color: C.green, fontWeight: 700 }}
                    >
                      {fmt$(b.total)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Activity feed + Revenue ── */}
        <div className="sk-admin__grid">
          {/* Activity feed */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Recent Activity</span>
              <span className="sk-admin__card-count">Notifications</span>
            </div>
            {loading && (
              <div className="sk-admin__empty">
                <span className="sk-admin__spinner" />
              </div>
            )}
            {!loading && activity.length === 0 && (
              <div className="sk-admin__empty">No activity yet</div>
            )}
            <div className="sk-admin__feed">
              {activity.map((a) => {
                const dotColor =
                  a.type === "booking"
                    ? C.green
                    : a.type === "xp"
                    ? C.orange
                    : a.type === "signup"
                    ? C.purple
                    : C.blue;
                return (
                  <div key={a._id} className="sk-admin__feed-item">
                    <div
                      className="sk-admin__feed-dot"
                      style={{ background: dotColor }}
                    />
                    <div>
                      <div className="sk-admin__feed-text">
                        {a.message || a.title}
                      </div>
                      <div className="sk-admin__feed-time">
                        {timeAgo(a.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue + Top XP */}
          <div className="sk-admin__card">
            <div className="sk-admin__card-head">
              <span className="sk-admin__card-title">Revenue Breakdown</span>
              <span className="sk-admin__card-count" style={{ color: C.green }}>
                {fmt$(stats.totalRevenue || 0)}
              </span>
            </div>
            <div className="sk-admin__rev">
              {[
                { label: "Confirmed", key: "confirmed", color: C.green },
                { label: "Pending", key: "pending", color: C.orange },
                { label: "Cancelled", key: "cancelled", color: C.red },
              ].map(({ label, key, color }) => {
                const val = revenue[key] || 0;
                const total =
                  (revenue.confirmed || 0) +
                  (revenue.pending || 0) +
                  (revenue.cancelled || 0);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return (
                  <div key={key} className="sk-admin__rev-row">
                    <div className="sk-admin__rev-label">
                      <span>{label}</span>
                      <span style={{ color }}>
                        {fmt$(val)} · {pct}%
                      </span>
                    </div>
                    <div className="sk-admin__rev-bar">
                      <div
                        className="sk-admin__rev-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Top XP earners */}
              <div
                style={{
                  marginTop: 16,
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: C.muted,
                    marginBottom: 12,
                  }}
                >
                  Top XP Earners
                </div>
                {(data?.topXP || []).map((u, i) => (
                  <div
                    key={u._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span style={{ fontSize: 11, color: C.muted, width: 16 }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: C.white }}>
                        {u.name || u.username}
                      </span>
                    </div>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: C.orange }}
                    >
                      {(u.xp || 0).toLocaleString()} XP
                    </span>
                  </div>
                ))}
                {(!data?.topXP || data.topXP.length === 0) && (
                  <div style={{ fontSize: 12, color: C.muted }}>
                    No XP data yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Challenges ── */}
        <div className="sk-admin__card" style={{ marginBottom: 24 }}>
          <div className="sk-admin__card-head">
            <span className="sk-admin__card-title">Challenges</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="sk-admin__card-count">
                {challenges.length} total
              </span>
              <Button
                type="primary"
                size="small"
                onClick={openCreateModal}
                style={{ background: C.orange, borderColor: C.orange }}
              >
                + New Challenge
              </Button>
            </div>
          </div>
          {challengesLoading && (
            <div className="sk-admin__empty">
              <span className="sk-admin__spinner" />
            </div>
          )}
          {!challengesLoading && challenges.length === 0 && (
            <div className="sk-admin__empty">
              No challenges yet — create one to get started
            </div>
          )}
          {challenges.map((c) => (
            <div key={c.id} className="sk-admin__row">
              <div className="sk-admin__row-left">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: C.orangeDim,
                    border: `1px solid ${C.borderAccent}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {resolveChallengeIcon(c.icon)}
                </div>
                <div>
                  <div className="sk-admin__name">{c.title}</div>
                  <div className="sk-admin__sub">
                    {c.requirement?.actionType} ×{c.requirement?.count} · +
                    {c.bonusXP} XP · {c.activatedCount || 0} activated ·{" "}
                    {c.completedCount || 0} completed
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <ChallengeStatusPill challenge={c} />
                <div className="sk-admin__challenge-actions">
                  <button
                    type="button"
                    className="sk-admin__challenge-action-btn"
                    onClick={() => openEditModal(c)}
                  >
                    Edit
                  </button>
                  {c.active && (
                    <Popconfirm
                      title="End this challenge early?"
                      description="Already-earned bonuses and progress are kept — this just stops it from running."
                      okText="End it"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleEndChallenge(c)}
                    >
                      <button
                        type="button"
                        className="sk-admin__challenge-action-btn sk-admin__challenge-action-btn--danger"
                      >
                        End early
                      </button>
                    </Popconfirm>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Rewards Catalog ── */}
        <div className="sk-admin__card" style={{ marginBottom: 24 }}>
          <div className="sk-admin__card-head">
            <span className="sk-admin__card-title">Rewards Catalog</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="sk-admin__card-count">
                {rewardItems.length} total
              </span>
              <Button
                type="primary"
                size="small"
                onClick={openCreateRewardModal}
                style={{ background: C.orange, borderColor: C.orange }}
              >
                + New Item
              </Button>
            </div>
          </div>
          {rewardItemsLoading && (
            <div className="sk-admin__empty">
              <span className="sk-admin__spinner" />
            </div>
          )}
          {!rewardItemsLoading && rewardItems.length === 0 && (
            <div className="sk-admin__empty">
              No reward items yet — create one to get started
            </div>
          )}
          {rewardItems.map((item) => (
            <div key={item.id} className="sk-admin__row">
              <div className="sk-admin__row-left">
                <div>
                  <div className="sk-admin__name">
                    {item.title}
                    {!item.active && (
                      <span
                        className="sk-admin__pill"
                        style={{
                          marginLeft: 8,
                          background: C.redDim,
                          color: C.red,
                        }}
                      >
                        Removed
                      </span>
                    )}
                  </div>
                  <div className="sk-admin__sub">
                    {item.type} · {item.cost} XP
                    {item.repeatable ? " · repeatable" : ""}
                    {item.featured ? " · featured" : ""}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <div className="sk-admin__challenge-actions">
                  <button
                    type="button"
                    className="sk-admin__challenge-action-btn"
                    onClick={() => openEditRewardModal(item)}
                  >
                    Edit
                  </button>
                  {item.active && (
                    <Popconfirm
                      title="Remove this item?"
                      description="Anyone who already redeemed it keeps that history — this just stops it from showing in the live catalog."
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleRemoveReward(item)}
                    >
                      <button
                        type="button"
                        className="sk-admin__challenge-action-btn sk-admin__challenge-action-btn--danger"
                      >
                        Remove
                      </button>
                    </Popconfirm>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Create / Edit Challenge Modal ── */}
      <Modal
        open={modalOpen}
        title={editingChallenge ? "Edit Challenge" : "New Challenge"}
        onCancel={() => setModalOpen(false)}
        onOk={handleSaveChallenge}
        okText={editingChallenge ? "Save Changes" : "Create Challenge"}
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
              placeholder="Save or book a trip for an away game this season — earn bonus XP."
            />
          </Form.Item>
          <Form.Item name="theme" label="Theme">
            <Input placeholder="football" />
          </Form.Item>
          <Form.Item label="Icon">
            <ChallengeIconPicker
              value={selectedIcon}
              onChange={setSelectedIcon}
            />
          </Form.Item>
          <Form.Item
            name="actionType"
            label="What action counts toward this challenge?"
            rules={[{ required: true, message: "Pick or type an action" }]}
            extra={
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                Pick from the list, or type your own. A custom action only
                tracks progress if that exact action is already being recorded
                elsewhere in the app — otherwise this challenge won't have
                anything to count, with no error to tell you why.
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

      {/* ── Create / Edit Reward Item Modal ── */}
      <Modal
        open={rewardModalOpen}
        title={editingReward ? "Edit Reward Item" : "New Reward Item"}
        onCancel={() => setRewardModalOpen(false)}
        onOk={handleSaveReward}
        okText={editingReward ? "Save Changes" : "Create Item"}
        confirmLoading={rewardSaving}
        className="sk-challenge-modal"
        destroyOnClose
      >
        <Form form={rewardForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="itemId"
            label="Item ID (slug — can't be changed later)"
            rules={[
              { required: true, message: "Item ID is required" },
              {
                pattern: /^[a-z0-9_]+$/,
                message: "Lowercase letters, numbers, and underscores only",
              },
            ]}
          >
            <Input placeholder="weekend_xp" disabled={!!editingReward} />
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
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                Carried over from the original catalog data — not currently
                wired up to restrict an item to any particular tier.
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
            <Form.Item name="isNew" label="Mark as New" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
