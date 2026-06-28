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
  FlagOutlined,
  RocketOutlined,
  StarOutlined,
  CrownOutlined,
  TeamOutlined,
  HeartOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  CheckCircleFilled,
  LoadingOutlined,
} from "@ant-design/icons";

// Same icon-key set as AdminDashboard.jsx's challenge creation form —
// kept in sync so a challenge's icon renders identically for the admin
// who created it and the user who sees it. Stored as a short key string
// ("trophy", "flag", etc.), not the icon itself.
const CHALLENGE_ICON_MAP = {
  trophy: TrophyOutlined,
  flag: FlagOutlined,
  fire: FireOutlined,
  rocket: RocketOutlined,
  gift: GiftOutlined,
  star: StarOutlined,
  crown: CrownOutlined,
  thunderbolt: ThunderboltOutlined,
  team: TeamOutlined,
  heart: HeartOutlined,
  calendar: CalendarOutlined,
  environment: EnvironmentOutlined,
};

function resolveChallengeIcon(key) {
  const Icon = CHALLENGE_ICON_MAP[key] || TrophyOutlined;
  return <Icon />;
}

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
  // ✅ NEW: Challenges — fundamentally different data shape from the other
  // four tabs (progress toward a count + an end date, not an XP cost to
  // spend), so it has no `type` here and gets its own render branch below
  // instead of being filtered into the shared catalog grid.
  { key: "challenges", label: "Challenges", icon: <FlagOutlined /> },
];

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

  // ✅ NEW: Challenges tab state — separate from the catalog state above
  // since it's a genuinely different data shape (progress + activation,
  // not cost + redemption).
  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [activatingId, setActivatingId] = useState(null);

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
        const [profileRes, redeemedRes] = await Promise.all([
          fetch(apiUrl("/api/profile/me"), {
            credentials: "include",
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(apiUrl("/api/rewards/redeemed"), {
            credentials: "include",
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ]);

        if (!profileRes.ok) throw new Error("profile fetch failed");
        const profileData = await profileRes.json();
        if (!mounted) return;
        const realXp = Number(profileData?.xp ?? profileData?.user?.xp ?? 0);
        setBalance(realXp);
        setCurrentBadge(String(profileData?.currentBadge ?? "Explorer"));

        if (redeemedRes?.ok) {
          const redeemedData = await redeemedRes.json();
          if (mounted && redeemedData?.ok) {
            setRedeemedIds(redeemedData.redeemedRewards || []);
          }
        }
      } catch {
        if (!mounted) return;
        setBalance(xpProp);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, token]);

  const defaultRedeem = useCallback(
    async (item) => {
      const res = await fetch(apiUrl("/api/rewards/redeem"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Couldn't redeem that right now.");
      }
      return data;
    },
    [token]
  );

  // ✅ NEW: fetch active challenges + this user's progress on each, same
  // self-fetch pattern as the profile/redeemed effect above. Fetched
  // eagerly on mount alongside everything else, not lazily on tab switch,
  // for consistency with how the rest of this page already loads.
  useEffect(() => {
    if (!isAuthed) {
      setChallengesLoading(false);
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      setChallengesLoading(true);
      try {
        const res = await fetch(apiUrl("/api/challenges"), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (data?.ok) {
          setChallenges(data.challenges || []);
        }
      } catch {
        // Leave challenges as whatever was last successfully loaded —
        // a failed fetch here shouldn't break the rest of the page.
      } finally {
        if (mounted) setChallengesLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  // ✅ NEW: activate a challenge — opts the user in so their actions start
  // counting toward it. Updates local state from the real server response
  // rather than assuming success, same principle as the redeem flow above.
  const activateChallenge = useCallback(
    async (challenge) => {
      setActivatingId(challenge.id);
      try {
        const res = await fetch(
          apiUrl(`/api/challenges/${challenge.id}/activate`),
          {
            method: "POST",
            credentials: "include",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Couldn't activate that challenge.");
        }
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === challenge.id
              ? {
                  ...c,
                  activated: true,
                  progress: data.progress ?? c.progress,
                  completed: !!data.completed,
                }
              : c
          )
        );
        message.success(`Activated: ${challenge.title}`);
      } catch (err) {
        message.error(err?.message || "Couldn't activate that challenge.");
      } finally {
        setActivatingId(null);
      }
    },
    [token]
  );

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
      const redeemFn = onRedeem || defaultRedeem;
      const result = await redeemFn(item);
      if (result && typeof result.newBalance === "number") {
        setBalance(result.newBalance);
      } else {
        setBalance((b) => b - item.cost);
      }
      setRedeemedIds((ids) => (item.repeatable ? ids : [...ids, item.id]));
      message.success(`Redeemed: ${item.title}`);
    } catch (err) {
      message.error(
        err?.message || "Couldn't redeem that right now. Try again."
      );
    } finally {
      setPendingId(null);
    }
  }, [confirmItem, onRedeem, defaultRedeem]);

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

        {tab !== "challenges" && featured && (
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

        {tab === "challenges" ? (
          <>
            <div className="pr-section">LIVE CHALLENGES</div>
            {challengesLoading ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <LoadingOutlined style={{ fontSize: 20, color: "#ff8a2a" }} />
              </div>
            ) : challenges.length === 0 ? (
              <Empty description="No challenges running right now — check back soon" />
            ) : (
              <div className="pr-grid">
                {challenges.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    activating={activatingId === c.id}
                    onActivate={() => activateChallenge(c)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
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

// ✅ NEW: Challenges have a genuinely different shape than catalog items —
// progress toward a count and an end date, not a cost to spend — so this
// is its own component rather than a variant of RewardCard. Deliberately
// reuses the existing pr-card/pr-tag/pr-cardTitle/pr-cardDesc/pr-meta/
// pr-btn* classes already used by RewardCard above, since those are
// already proven to render correctly in this exact file — only the
// days-left text below is a genuinely new bit of styling.
function formatDaysLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const days = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function ChallengeCard({ challenge, activating, onActivate }) {
  const pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (challenge.progress / Math.max(1, challenge.requirementCount)) * 100
      )
    )
  );
  const daysLeft = formatDaysLeft(challenge.endDate);

  return (
    <Card bordered={false} className="pr-card">
      <div className="pr-cardTop">
        <Tag className="pr-tag">
          {(challenge.theme || "challenge").toUpperCase()}
        </Tag>
        {challenge.completed && (
          <Tag className="pr-ready">
            <CheckCircleFilled /> Completed
          </Tag>
        )}
      </div>

      <div className="pr-cardTitle">
        <span style={{ marginRight: 6 }}>
          {resolveChallengeIcon(challenge.icon)}
        </span>
        {challenge.title}
      </div>
      <div className="pr-cardDesc">{challenge.description}</div>

      {challenge.activated && !challenge.completed && (
        <div className="pr-cardProgress">
          <Progress percent={pct} showInfo={false} size="small" />
          <Text className="pr-faint" style={{ fontSize: 12 }}>
            {challenge.progress} / {challenge.requirementCount} complete
          </Text>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <div className="pr-meta">+{challenge.bonusXP} XP bonus</div>
        {daysLeft && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {daysLeft}
          </div>
        )}
      </div>

      {challenge.completed ? (
        <Button className="pr-btnRedeemed" disabled style={{ marginTop: 10 }}>
          <CheckCircleFilled /> +{challenge.bonusXP} XP earned
        </Button>
      ) : challenge.activated ? (
        <Button className="pr-btnLocked" disabled style={{ marginTop: 10 }}>
          In progress — keep going
        </Button>
      ) : (
        <Button
          className="pr-btnRedeem"
          loading={activating}
          onClick={onActivate}
          style={{ marginTop: 10 }}
        >
          Activate
        </Button>
      )}
    </Card>
  );
}
