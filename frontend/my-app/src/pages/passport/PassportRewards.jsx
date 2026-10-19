import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, message } from "antd";
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
} from "@ant-design/icons";
import {
  Plane,
  Zap,
  Award,
  Gift,
  Flame,
  Flag,
  LayoutGrid,
  Check,
  Lock,
  Loader2,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Clock,
  ArrowRight,
  Trophy,
  Wallet,
} from "lucide-react";

import "../../styles/PassportRewards.css";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";
import {
  getTier,
  getNextTier,
  getTierByName,
  getTierProgress,
} from "@/config/xpConfig";
import TierIcon, { TierMedal } from "@/components/passport/TierIcon";

// Same icon-key set as AdminDashboard.jsx's challenge creation form —
// kept in sync so a challenge's icon renders identically for the admin
// who created it and the user who sees it.
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

const TYPE_META = {
  BOOST: { label: "Boost", Icon: Zap },
  BADGE: { label: "Badge", Icon: Award },
  PERK: { label: "Perk", Icon: Gift },
  LIMITED: { label: "Limited", Icon: Flame },
};

const TABS = [
  { key: "all", label: "All", Icon: LayoutGrid },
  { key: "boosts", label: "Boosts", Icon: Zap, type: "BOOST" },
  { key: "badges", label: "Badges", Icon: Award, type: "BADGE" },
  { key: "perks", label: "Perks", Icon: Gift, type: "PERK" },
  { key: "limited", label: "Limited", Icon: Flame, type: "LIMITED" },
  // Challenges have a different shape (progress + end date, not a cost),
  // so they get their own render branch below.
  { key: "challenges", label: "Challenges", Icon: Flag },
];

// Optional per-item `howToUse` is shown after a successful redemption.
// Only add it where it's TRUE for how the reward actually works.
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

const HOW_KEY = "skyrio_rewards_how_closed";
const fmt = (n) => Number(n || 0).toLocaleString();

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

  const [tab, setTab] = useState("all");
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentBadge, setCurrentBadge] = useState(null);

  // balance = spendable wallet XP. lifetime = all XP ever earned → rank.
  const [balance, setBalance] = useState(xpProp);
  const [lifetime, setLifetime] = useState(xpProp);
  const [redeemedIds, setRedeemedIds] = useState(redeemedIdsProp);

  // Redemption flow: confirm → pending → done (modal stays open the whole time)
  const [confirmItem, setConfirmItem] = useState(null);
  const [phase, setPhase] = useState("confirm"); // confirm | pending | done
  const [redeemError, setRedeemError] = useState("");

  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [activatingId, setActivatingId] = useState(null);

  const [howOpen, setHowOpen] = useState(() => {
    try {
      return localStorage.getItem(HOW_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const toggleHow = () => {
    setHowOpen((open) => {
      try {
        localStorage.setItem(HOW_KEY, open ? "1" : "0");
      } catch {}
      return !open;
    });
  };

  // ── Profile (balance, lifetime XP, rank) + redeemed items ──
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
        setLifetime(
          Number(
            profileData?.xpTotalEarned ??
              profileData?.user?.xpTotalEarned ??
              realXp
          )
        );
        if (profileData?.currentBadge)
          setCurrentBadge(String(profileData.currentBadge));

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

  // ── Challenges ──
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
        if (data?.ok) setChallenges(data.challenges || []);
      } catch {
        // A failed fetch here shouldn't break the rest of the page.
      } finally {
        if (mounted) setChallengesLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

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

  // ── Rank (from lifetime XP — never changes when you redeem) ──
  const tier = useMemo(
    () => getTierByName(currentBadge) || getTier(lifetime),
    [currentBadge, lifetime]
  );
  const nextTier = useMemo(() => getNextTier(lifetime), [lifetime]);
  const tierPct = useMemo(() => getTierProgress(lifetime), [lifetime]);

  // ── Catalog ──
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
    () => enriched.find((i) => i.featured) || null,
    [enriched]
  );

  const counts = useMemo(() => {
    const c = { all: enriched.length, challenges: challenges.length };
    for (const t of TABS)
      if (t.type) c[t.key] = enriched.filter((i) => i.type === t.type).length;
    return c;
  }, [enriched, challenges]);

  const visibleItems = useMemo(() => {
    const activeType = TABS.find((t) => t.key === tab)?.type;
    const rank = { redeemable: 0, insufficient_xp: 1, loading: 1, redeemed: 2 };
    return enriched
      .filter((i) =>
        tab === "all" ? i.id !== featured?.id : i.type === activeType
      )
      .sort(
        (a, b) =>
          (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.cost - b.cost
      );
  }, [enriched, tab, featured]);

  // ── Redeem flow ──
  const requestRedeem = useCallback((item) => {
    if (item.status !== "redeemable") return;
    setRedeemError("");
    setPhase("confirm");
    setConfirmItem(item);
  }, []);

  const closeModal = useCallback(() => {
    if (phase === "pending") return;
    setConfirmItem(null);
    setPhase("confirm");
    setRedeemError("");
  }, [phase]);

  const confirmRedeem = useCallback(async () => {
    const item = confirmItem;
    if (!item) return;
    setPhase("pending");
    setRedeemError("");
    try {
      const redeemFn = onRedeem || defaultRedeem;
      const result = await redeemFn(item);
      if (result && typeof result.newBalance === "number") {
        setBalance(result.newBalance);
      } else {
        setBalance((b) => Math.max(0, b - item.cost));
      }
      setRedeemedIds((ids) => (item.repeatable ? ids : [...ids, item.id]));
      setPhase("done");
    } catch (err) {
      setPhase("confirm");
      setRedeemError(
        err?.message || "Couldn't redeem that right now. Try again."
      );
    }
  }, [confirmItem, onRedeem, defaultRedeem]);

  const handleEarnMore = onEarnMore || (() => navigate("/booking"));
  const handleViewPassport = onViewPassport || (() => navigate("/passport"));

  return (
    <div className={`pr-page ${embedded ? "is-embedded" : ""}`}>
      {!embedded && <div className="pr-overlay" />}

      <div className="pr-shell">
        {/* ═════════ Boarding pass header ═════════ */}
        <section
          className="pr-pass"
          style={{ "--tier": tier.color }}
          aria-label={title}
        >
          <div className="pr-pass-main">
            <div className="pr-pass-top">
              <span className="pr-pass-brand">
                <Plane size={14} /> SKYRIO · {title.toUpperCase()}
              </span>
              <span className="pr-pass-class">{tier.name} class</span>
            </div>

            <div className="pr-pass-segs">
              <div className="pr-seg">
                <span className="pr-seg-label">Rank</span>
                <span className="pr-seg-value pr-seg-rank">
                  <TierMedal tier={tier} size={34} />
                  {profileLoading ? "—" : tier.name}
                </span>
              </div>
              <div className="pr-seg">
                <span className="pr-seg-label pr-label-icon">
                  <Trophy size={12} /> Lifetime XP earned
                </span>
                <span className="pr-seg-value">
                  {profileLoading ? "—" : fmt(lifetime)}
                </span>
                <span className="pr-seg-hint">
                  Sets your rank · never goes down
                </span>
              </div>
              <div className="pr-seg">
                <span className="pr-seg-label">Next stop</span>
                <span className="pr-seg-value pr-seg-next">
                  {profileLoading ? (
                    "—"
                  ) : nextTier ? (
                    <>
                      <TierIcon tier={nextTier} size={16} /> {nextTier.name}
                      <small>{fmt(nextTier.min - lifetime)} XP to go</small>
                    </>
                  ) : (
                    <>Top rank reached</>
                  )}
                </span>
              </div>
            </div>

            <div className="pr-pass-bar" aria-hidden="true">
              <i style={{ width: `${profileLoading ? 0 : tierPct}%` }} />
            </div>

            {!profileLoading && (
              <div
                className="pr-ledger"
                aria-label="How your spendable XP is calculated"
              >
                <span className="pr-ledger-item">
                  <Trophy size={13} /> <b>{fmt(lifetime)}</b> earned
                </span>
                <span className="pr-ledger-op">−</span>
                <span className="pr-ledger-item">
                  <b>{fmt(Math.max(0, lifetime - balance))}</b> spent on rewards
                </span>
                <span className="pr-ledger-op">=</span>
                <span className="pr-ledger-item pr-ledger-total">
                  <Wallet size={13} /> <b>{fmt(balance)}</b> to spend
                </span>
              </div>
            )}

            <p className="pr-pass-note">
              <ShieldCheck size={14} /> Spending XP never lowers your rank.
            </p>
          </div>

          <div className="pr-pass-stub">
            <span className="pr-seg-label pr-label-icon pr-label-wallet">
              <Wallet size={12} /> Spendable XP
            </span>
            <span className="pr-wallet">
              {profileLoading ? (
                <Loader2 size={22} className="pr-spin" />
              ) : (
                fmt(balance)
              )}
              <small>XP</small>
            </span>
            <span className="pr-wallet-sub">
              Use on rewards · goes down when you redeem
            </span>
            <button
              type="button"
              className="pr-btn pr-btn--primary"
              onClick={handleEarnMore}
            >
              Earn more XP
            </button>
            <button
              type="button"
              className="pr-link"
              onClick={handleViewPassport}
            >
              View passport <ArrowRight size={13} />
            </button>
          </div>
        </section>

        {/* ═════════ How it works ═════════ */}
        <section className={`pr-how ${howOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="pr-how-toggle"
            onClick={toggleHow}
            aria-expanded={howOpen}
          >
            <Sparkles size={15} /> How XP & rewards work
            <ChevronDown size={16} className="pr-how-chev" />
          </button>
          {howOpen && (
            <ol className="pr-how-steps">
              <li>
                <span className="pr-how-num">1</span>
                <div>
                  <strong>Earn</strong>
                  <p>
                    Booking trips earns the most XP. Reviews, challenges,
                    invites and SkyHub add more. Booking XP stays pending until
                    the free-cancellation window ends.
                  </p>
                </div>
              </li>
              <li>
                <span className="pr-how-num">2</span>
                <div>
                  <strong>Rank up</strong>
                  <p>
                    Every XP you earn counts toward your rank — for good. Only a
                    cancelled booking or removed post takes its XP back.
                  </p>
                </div>
              </li>
              <li>
                <span className="pr-how-num">3</span>
                <div>
                  <strong>Spend</strong>
                  <p>
                    Trade wallet XP for boosts, badges, perks and drops. Your
                    wallet goes down — your rank stays.
                  </p>
                </div>
              </li>
            </ol>
          )}
        </section>

        {/* ═════════ Tabs ═════════ */}
        <nav className="pr-tabs" aria-label="Reward categories">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`pr-tab ${tab === key ? "is-active" : ""}`}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
            >
              <Icon size={15} />
              <span>{label}</span>
              {counts[key] > 0 && (
                <span className="pr-tab-count">{counts[key]}</span>
              )}
            </button>
          ))}
        </nav>

        {/* ═════════ Content ═════════ */}
        {tab === "challenges" ? (
          <>
            <h2 className="pr-section">Live challenges</h2>
            {challengesLoading ? (
              <div className="pr-loading">
                <Loader2 size={22} className="pr-spin" />
              </div>
            ) : challenges.length === 0 ? (
              <EmptyState
                title="No challenges running right now"
                text="New challenges drop regularly — check back soon."
                onAction={() => setTab("all")}
                actionLabel="Browse rewards"
              />
            ) : (
              <div className="pr-grid">
                {challenges.map((c) => (
                  <ChallengeTicket
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
            {tab === "all" && featured && (
              <>
                <h2 className="pr-section">
                  <Flame size={14} /> Featured this week
                </h2>
                <RewardTicket
                  item={featured}
                  featured
                  pending={
                    phase === "pending" && confirmItem?.id === featured.id
                  }
                  onRedeem={() => requestRedeem(featured)}
                />
              </>
            )}

            <h2 className="pr-section">
              {tab === "all"
                ? "All rewards"
                : TABS.find((t) => t.key === tab)?.label}
            </h2>

            {visibleItems.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                text="New rewards drop regularly — keep earning XP so you're ready."
                onAction={() => setTab("all")}
                actionLabel="See all rewards"
              />
            ) : (
              <div className="pr-grid">
                {visibleItems.map((item) => (
                  <RewardTicket
                    key={item.id}
                    item={item}
                    pending={phase === "pending" && confirmItem?.id === item.id}
                    onRedeem={() => requestRedeem(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═════════ Redeem modal ═════════ */}
      <Modal
        open={!!confirmItem}
        onCancel={closeModal}
        footer={null}
        centered
        width={440}
        className="pr-modal"
        closable={phase !== "pending"}
        maskClosable={phase !== "pending"}
        destroyOnClose
      >
        {confirmItem && (
          <RedeemSheet
            item={confirmItem}
            phase={phase}
            error={redeemError}
            balance={balance}
            tier={tier}
            onConfirm={confirmRedeem}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function StubAction({ item, pending, onRedeem }) {
  switch (item.status) {
    case "loading":
      return (
        <button type="button" className="pr-btn pr-btn--muted" disabled>
          <Loader2 size={14} className="pr-spin" /> Checking…
        </button>
      );
    case "redeemed":
      return (
        <button type="button" className="pr-btn pr-btn--done" disabled>
          <Check size={14} /> Redeemed
        </button>
      );
    case "insufficient_xp":
      return (
        <button type="button" className="pr-btn pr-btn--muted" disabled>
          <Lock size={13} /> {fmt(item.shortfall)} more
        </button>
      );
    default:
      return (
        <button
          type="button"
          className="pr-btn pr-btn--primary"
          onClick={onRedeem}
          disabled={pending}
        >
          {pending ? <Loader2 size={14} className="pr-spin" /> : "Redeem"}
        </button>
      );
  }
}

function RewardTicket({ item, featured = false, pending, onRedeem }) {
  const meta = TYPE_META[item.type] || TYPE_META.BOOST;
  const TypeIcon = meta.Icon;
  return (
    <article
      className={`pr-ticket is-${item.status} ${
        featured ? "pr-ticket--featured" : ""
      }`}
    >
      <div className="pr-ticket-body">
        <div className="pr-ticket-head">
          <span className="pr-chip">
            <TypeIcon size={12} /> {meta.label}
          </span>
          {item.isNew && <span className="pr-chip pr-chip--new">New</span>}
          {item.repeatable && (
            <span className="pr-chip pr-chip--soft">Repeatable</span>
          )}
          {item.status === "redeemable" && (
            <span className="pr-chip pr-chip--ready">
              <Check size={12} /> Ready
            </span>
          )}
        </div>

        <h3 className="pr-ticket-title">{item.title}</h3>
        <p className="pr-ticket-desc">{item.desc}</p>

        {item.status === "insufficient_xp" && (
          <div className="pr-ticket-progress">
            <div className="pr-bar">
              <i style={{ width: `${item.pct}%` }} />
            </div>
            <span>
              {fmt(item.cost - item.shortfall)} / {fmt(item.cost)} XP · earn{" "}
              {fmt(item.shortfall)} more to unlock
            </span>
          </div>
        )}

        {item.status === "redeemed" && (
          <span className="pr-stamp">Redeemed</span>
        )}
      </div>

      <div className="pr-ticket-stub">
        <span className="pr-stub-label">Cost</span>
        <span className="pr-stub-cost">
          {fmt(item.cost)}
          <small>XP</small>
        </span>
        <StubAction item={item} pending={pending} onRedeem={onRedeem} />
      </div>
    </article>
  );
}

function formatDaysLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const days = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function ChallengeTicket({ challenge, activating, onActivate }) {
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
  const status = challenge.completed
    ? "redeemed"
    : challenge.activated
    ? "active"
    : "redeemable";

  return (
    <article className={`pr-ticket is-${status}`}>
      <div className="pr-ticket-body">
        <div className="pr-ticket-head">
          <span className="pr-chip">
            <Flag size={12} /> {challenge.theme || "Challenge"}
          </span>
          {daysLeft && !challenge.completed && (
            <span className="pr-chip pr-chip--soft">
              <Clock size={12} /> {daysLeft}
            </span>
          )}
        </div>

        <h3 className="pr-ticket-title">
          <span className="pr-ticket-icon">
            {resolveChallengeIcon(challenge.icon)}
          </span>
          {challenge.title}
        </h3>
        <p className="pr-ticket-desc">{challenge.description}</p>

        {challenge.activated && !challenge.completed && (
          <div className="pr-ticket-progress">
            <div className="pr-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span>
              {challenge.progress} / {challenge.requirementCount} complete
            </span>
          </div>
        )}

        {challenge.completed && <span className="pr-stamp">Complete</span>}
      </div>

      <div className="pr-ticket-stub">
        <span className="pr-stub-label">Bonus</span>
        <span className="pr-stub-cost">
          +{fmt(challenge.bonusXP)}
          <small>XP</small>
        </span>
        {challenge.completed ? (
          <button type="button" className="pr-btn pr-btn--done" disabled>
            <Check size={14} /> Earned
          </button>
        ) : challenge.activated ? (
          <button type="button" className="pr-btn pr-btn--muted" disabled>
            In progress
          </button>
        ) : (
          <button
            type="button"
            className="pr-btn pr-btn--primary"
            onClick={onActivate}
            disabled={activating}
          >
            {activating ? (
              <Loader2 size={14} className="pr-spin" />
            ) : (
              "Activate"
            )}
          </button>
        )}
      </div>
    </article>
  );
}

function RedeemSheet({
  item,
  phase,
  error,
  balance,
  tier,
  onConfirm,
  onCancel,
}) {
  const meta = TYPE_META[item.type] || TYPE_META.BOOST;
  const TypeIcon = meta.Icon;

  if (phase === "done") {
    return (
      <div className="pr-sheet pr-sheet--done">
        <div className="pr-sheet-stamp">
          <Check size={28} />
        </div>
        <span className="pr-seg-label">Redemption confirmed</span>
        <h3 className="pr-sheet-title">{item.title}</h3>
        <p className="pr-sheet-text">
          {item.howToUse || "It's been added to your Skyrio account."}
        </p>
        <ul className="pr-math">
          <li>
            <span>Spendable XP</span>
            <b>{fmt(balance)} XP</b>
          </li>
          <li>
            <span>Your rank</span>
            <b className="pr-math-rank">
              <TierIcon tier={tier} size={14} /> {tier.name}
            </b>
          </li>
        </ul>
        <button
          type="button"
          className="pr-btn pr-btn--primary pr-btn--block"
          onClick={onCancel}
        >
          Done
        </button>
      </div>
    );
  }

  const after = Math.max(0, balance - item.cost);
  return (
    <div className="pr-sheet">
      <span className="pr-seg-label">Confirm redemption</span>
      <div className="pr-sheet-item">
        <span className="pr-chip">
          <TypeIcon size={12} /> {meta.label}
        </span>
        <h3 className="pr-sheet-title">{item.title}</h3>
        <p className="pr-sheet-text">{item.desc}</p>
      </div>

      <ul className="pr-math">
        <li>
          <span>Spendable XP</span>
          <b>
            {fmt(balance)} <ArrowRight size={12} /> {fmt(after)} XP
          </b>
        </li>
        <li>
          <span>Your rank</span>
          <b className="pr-math-rank">
            <TierIcon tier={tier} size={14} /> {tier.name} · unchanged
          </b>
        </li>
      </ul>

      {error && <p className="pr-sheet-error">{error}</p>}

      <div className="pr-sheet-actions">
        <button
          type="button"
          className="pr-btn pr-btn--ghost"
          onClick={onCancel}
          disabled={phase === "pending"}
        >
          Cancel
        </button>
        <button
          type="button"
          className="pr-btn pr-btn--primary"
          onClick={onConfirm}
          disabled={phase === "pending"}
        >
          {phase === "pending" ? (
            <Loader2 size={14} className="pr-spin" />
          ) : (
            `Redeem for ${fmt(item.cost)} XP`
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="pr-empty">
      <div className="pr-empty-icon">
        <Plane size={22} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      {onAction && (
        <button
          type="button"
          className="pr-btn pr-btn--ghost"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
