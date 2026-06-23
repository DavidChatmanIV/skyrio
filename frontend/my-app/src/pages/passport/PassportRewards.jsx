import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Tag,
  Progress,
  Modal,
  message,
  Empty,
} from "antd";
import {
  ThunderboltOutlined,
  TrophyOutlined,
  GiftOutlined,
  FireOutlined,
  CheckCircleFilled,
  LoadingOutlined,
} from "@ant-design/icons";

import "../../styles/PassportRewards.css";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";

const { Title, Text } = Typography;

const TABS = [
  {
    key: "boosts",
    label: "Boosts",
    icon: <ThunderboltOutlined />,
    type: "BOOST",
  },
  { key: "badges", label: "Badges", icon: <TrophyOutlined />, type: "BADGE" },
  { key: "perks", label: "Perks", icon: <GiftOutlined />, type: "PERK" },
  { key: "limited", label: "Limited", icon: <FireOutlined />, type: "LIMITED" },
];

// Fallback catalog — only used if no `items` prop is passed in.
// In production, pass items fetched from your backend (e.g. GET /api/rewards/items)
// so cost requirements live in one place (the DB), not in the component.
//
// NOTE on `level`: currently UNUSED for gating. /api/profile/me returns a
// badge *tier name* (currentBadge: "Explorer", "Adventurer", ...), not a
// numeric level — so there's no reliable number to gate against yet. Items
// are gated by XP cost only for now. Once the full badge-tier ladder is
// confirmed, swap `level` for a `requiredBadge` string and compare against
// `currentBadge`'s position in that ladder.
const DEFAULT_ITEMS = [
  {
    id: "weekend_xp",
    type: "BOOST",
    title: "Weekend XP Multiplier",
    desc: "+2x XP on all bookings Fri–Sun",
    cost: 250,
    level: 1,
    featured: true,
    repeatable: true,
  },
  {
    id: "review_streak",
    type: "BADGE",
    title: "Review Streak (+1.5x)",
    desc: "Leave 3 verified reviews this month for extra XP.",
    cost: 180,
    level: 1,
    repeatable: false,
  },
  {
    id: "globetrotter",
    type: "BADGE",
    title: "Globetrotter",
    desc: "Unlocked at higher tiers or buy to fast-track.",
    cost: 400,
    level: 3,
    isNew: true,
    repeatable: false,
  },
  {
    id: "priority_support",
    type: "PERK",
    title: "Priority Support Week",
    desc: "Jump the queue on Atlas AI escalations for 7 days.",
    cost: 150,
    level: 1,
    repeatable: true,
  },
  {
    id: "wc_jacket",
    type: "LIMITED",
    title: "Skyrio World Cup Jacket — Numbered Drop",
    desc: "Limited 50-unit run. Redeem XP toward your unit.",
    cost: 1200,
    level: 5,
    repeatable: false,
  },
];

function getStatus(item, { xp, redeemedIds, profileLoading }) {
  if (profileLoading) return "loading";
  if (!item.repeatable && redeemedIds.includes(item.id)) return "redeemed";
  if (xp < item.cost) return "insufficient_xp";
  return "redeemable";
}

/**
 * PassportRewards
 * - embedded=true => no page overlay/bg so Passport map stays visible
 *
 * XP data:
 * - On mount, self-fetches /api/profile/me (mirrors the effect in
 *   DigitalPassportPage.jsx) so the balance shown here always matches the
 *   real account — no more placeholder "0 XP".
 * - `xp` prop still exists as a fallback seed (used briefly before the fetch
 *   resolves, and as a fallback if the fetch fails) and for backward
 *   compatibility with any preview/storybook usage.
 * - `level` prop is deprecated — see NOTE above DEFAULT_ITEMS.
 *
 * Wiring notes for redemption:
 * - Pass `onRedeem(item)` returning a Promise that calls your backend
 *   (e.g. POST /api/rewards/redeem). Reject it on failure — the optimistic
 *   XP deduction is rolled back automatically and an error toast shows.
 */
export default function PassportRewards({
  embedded = false,
  title = "Passport Rewards",
  xp: xpProp = 0,
  items = DEFAULT_ITEMS,
  redeemedIds: redeemedIdsProp = [],
  onRedeem,
  onEarnMore,
  onViewPassport,
}) {
  const navigate = useNavigate();
  const { token, isAuthed } = useAuth();

  const [tab, setTab] = useState("boosts");
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentBadge, setCurrentBadge] = useState("Explorer");

  const [balance, setBalance] = useState(xpProp);
  const [redeemedIds, setRedeemedIds] = useState(redeemedIdsProp);
  const [pendingId, setPendingId] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);

  // Self-fetch real XP — mirrors the /api/profile/me effect in
  // DigitalPassportPage.jsx so this page never shows a stale/placeholder
  // balance. Same endpoint, same auth header pattern, same abort-on-unmount.
  useEffect(() => {
    if (!isAuthed) {
      setProfileLoading(false);
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      setProfileLoading(true);
      try {
        const res = await fetch(apiUrl("/api/profile/me"), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("profile fetch failed");
        const data = await res.json();
        if (!mounted) return;
        const realXp = Number(data?.xp ?? data?.user?.xp ?? 0);
        setBalance(realXp);
        setCurrentBadge(String(data?.currentBadge ?? "Explorer"));
      } catch {
        if (!mounted) return;
        // Fetch failed — fall back to whatever was passed in as a prop (or 0)
        // rather than leaving the UI stuck on a spinner forever.
        setBalance(xpProp);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
    // xpProp is intentionally omitted — it's only a fallback seed, not
    // something that should re-trigger a real-data fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, token]);

  const enriched = useMemo(
    () =>
      items.map((item) => {
        const status = getStatus(item, {
          xp: balance,
          redeemedIds,
          profileLoading,
        });
        const shortfall = Math.max(0, item.cost - balance);
        const pct = Math.max(
          0,
          Math.min(100, Math.round((balance / Math.max(1, item.cost)) * 100))
        );
        return { ...item, status, shortfall, pct };
      }),
    [items, balance, redeemedIds, profileLoading]
  );

  const featured = useMemo(
    () => enriched.find((i) => i.featured) || enriched[0],
    [enriched]
  );

  const visibleItems = useMemo(() => {
    const activeType = TABS.find((t) => t.key === tab)?.type;
    const rank = { redeemable: 0, insufficient_xp: 1, loading: 1, redeemed: 2 };
    return enriched
      .filter((i) => i.type === activeType)
      .sort(
        (a, b) =>
          (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.cost - b.cost
      );
  }, [enriched, tab]);

  const requestRedeem = useCallback((item) => {
    if (item.status !== "redeemable") return;
    setConfirmItem(item);
  }, []);

  const confirmRedeem = useCallback(async () => {
    const item = confirmItem;
    if (!item) return;
    setConfirmItem(null);
    setPendingId(item.id);

    try {
      if (typeof onRedeem === "function") {
        await onRedeem(item);
      }
      setBalance((b) => b - item.cost);
      setRedeemedIds((ids) => (item.repeatable ? ids : [...ids, item.id]));
      message.success(`Redeemed: ${item.title}`);
    } catch (err) {
      message.error(
        err?.message || "Couldn't redeem that right now. Try again."
      );
    } finally {
      setPendingId(null);
    }
  }, [confirmItem, onRedeem]);

  // Sensible defaults if no handler prop is passed in (this page is rendered
  // directly off the /passport/rewards route with no props right now).
  const handleEarnMore = onEarnMore || (() => navigate("/booking"));
  const handleViewPassport = onViewPassport || (() => navigate("/passport"));

  return (
    <div className={`pr-page ${embedded ? "is-embedded" : ""}`}>
      {!embedded && <div className="pr-overlay" />}

      <div className="pr-shell">
        <div className="pr-header">
          <div className="pr-titleBlock">
            <Title level={2} className="pr-title">
              {title}
            </Title>
            <Text className="pr-subtitle">Inside Passport Rewards</Text>
            <Text className="pr-lead">
              Trade XP for boosts, badges, perks, and limited drops.
            </Text>
          </div>

          <div className="pr-balanceCard">
            <div className="pr-xpRow">
              <span className="pr-xp">
                {profileLoading ? <LoadingOutlined /> : `${balance} XP`}
              </span>
              <span className="pr-level">{currentBadge}</span>
            </div>

            <div className="pr-actions">
              <Button className="pr-btnPrimary" onClick={handleEarnMore}>
                Earn More XP
              </Button>
              <Button className="pr-btnGhost" onClick={handleViewPassport}>
                View Passport
              </Button>
            </div>
          </div>
        </div>

        <div className="pr-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`pr-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
              type="button"
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {featured && (
          <Card bordered={false} className="pr-featured">
            <div className="pr-featuredHeader">
              <FireOutlined /> FEATURED THIS WEEK
            </div>

            <div className="pr-featuredBody">
              <div>
                <div className="pr-featuredTitle">{featured.title}</div>
                <div className="pr-featuredDesc">{featured.desc}</div>
              </div>

              <div className="pr-featuredRight">
                <RedeemButton
                  item={featured}
                  pending={pendingId === featured.id}
                  onRedeem={() => requestRedeem(featured)}
                />
                <div className="pr-meta">Cost: {featured.cost} XP</div>
              </div>
            </div>
          </Card>
        )}

        <div className="pr-section">AVAILABLE IN REWARDS</div>

        {visibleItems.length === 0 ? (
          <Empty description="No items in this category yet" />
        ) : (
          <div className="pr-grid">
            {visibleItems.map((item) => (
              <RewardCard
                key={item.id}
                item={item}
                pending={pendingId === item.id}
                onRedeem={() => requestRedeem(item)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!confirmItem}
        onCancel={() => setConfirmItem(null)}
        onOk={confirmRedeem}
        okText={`Redeem for ${confirmItem?.cost ?? 0} XP`}
        title="Confirm redemption"
      >
        {confirmItem && (
          <>
            <p>
              Redeem <strong>{confirmItem.title}</strong> for{" "}
              <strong>{confirmItem.cost} XP</strong>?
            </p>
            <p style={{ color: "rgba(0,0,0,0.45)" }}>
              Your balance will drop to {balance - confirmItem.cost} XP.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}

function RedeemButton({ item, pending, onRedeem }) {
  switch (item.status) {
    case "loading":
      return (
        <Button className="pr-btnLocked" disabled>
          <LoadingOutlined /> Checking your XP…
        </Button>
      );
    case "redeemed":
      return (
        <Button className="pr-btnRedeemed" disabled>
          <CheckCircleFilled /> Redeemed
        </Button>
      );
    case "insufficient_xp":
      return (
        <Button className="pr-btnLocked" disabled>
          Need {item.shortfall} more XP
        </Button>
      );
    default:
      return (
        <Button className="pr-btnRedeem" loading={pending} onClick={onRedeem}>
          Redeem {item.cost} XP
        </Button>
      );
  }
}

function RewardCard({ item, pending, onRedeem }) {
  return (
    <Card bordered={false} className={`pr-card pr-card--${item.status}`}>
      <div className="pr-cardTop">
        <Tag className="pr-tag">{item.type}</Tag>
        {item.isNew && <Tag className="pr-new">NEW</Tag>}
        {item.status === "redeemable" && (
          <Tag className="pr-ready">
            <CheckCircleFilled /> Ready
          </Tag>
        )}
      </div>

      <div className="pr-cardTitle">{item.title}</div>
      <div className="pr-cardDesc">{item.desc}</div>

      {item.status === "insufficient_xp" && (
        <div className="pr-cardProgress">
          <Progress percent={item.pct} showInfo={false} size="small" />
          <Text className="pr-faint" style={{ fontSize: 12 }}>
            {item.shortfall} more XP to redeem
          </Text>
        </div>
      )}

      <div className="pr-meta">Cost: {item.cost} XP</div>

      <RedeemButton item={item} pending={pending} onRedeem={onRedeem} />
    </Card>
  );
}
