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
  Ban,
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
import { RANKS, RANK_PERKS, hasAnyRankPerks, XP_EARN } from "@/config/xpGuide";

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

// Two tabs: things to spend XP on, and challenges that earn XP. (The
// catalog is small, so type sub-tabs only split it into near-empty lists;
// each reward still shows its type on the card.)
const TABS = [
  { key: "all", label: "Rewards", Icon: Gift },
  // Challenges have a different shape (progress + end date, not a cost),
  // so they get their own render branch below.
  { key: "challenges", label: "Challenges", Icon: Flag },
];

// The catalog comes from the database (GET /api/rewards/items), the same
// list the server charges from and the admin edits. It used to be typed in
// here, so admin changes never showed and the two lists could disagree.
// Optional per-item `howToUse` is shown after a successful redemption.
// Only add it where it's TRUE for how the reward actually works.

const HOW_KEY = "skyrio_rewards_how_closed";

// Same purple glass + orange→purple top line as the rest of Skyrio.
const PR_GLASS_CSS = `
.pr-page { --pr-glass: linear-gradient(160deg, rgba(74,40,112,0.62) 0%, rgba(34,18,62,0.72) 100%); }
.pr-pass, .pr-how, .pr-ticket, .pr-empty, .pr-tabs {
  background: var(--pr-glass) !important;
  border: 1px solid rgba(255,255,255,0.16) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 44px rgba(12,4,28,0.38) !important;
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}
.pr-pass, .pr-ticket { position: relative; overflow: hidden; }
.pr-pass::after, .pr-ticket::after {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc); opacity: .85;
}
.pr-ticket--featured { border-color: rgba(255,179,71,0.5) !important; }
.pr-pass-stub, .pr-ticket-stub { background: rgba(20,10,40,0.35) !important; }
.pr-modal .ant-modal-content {
  background: linear-gradient(160deg, rgba(74,40,112,0.97), rgba(30,16,56,0.98)) !important;
  border: 1px solid rgba(255,255,255,0.16); border-radius: 22px !important;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .pr-page { --pr-glass: linear-gradient(160deg, rgba(56,30,88,0.96), rgba(28,14,52,0.97)); }
}
`;
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
  items: itemsProp = null,
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

  // ── Catalog from the server ──
  const [catalog, setCatalog] = useState(itemsProp || []);
  const [catalogLoading, setCatalogLoading] = useState(!itemsProp);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => {
    if (itemsProp) return undefined;
    const controller = new AbortController();
    (async () => {
      setCatalogLoading(true);
      setCatalogError(false);
      try {
        const res = await fetch(apiUrl("/api/rewards/items"), {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error("catalog");
        setCatalog(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (e.name !== "AbortError") setCatalogError(true);
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    })();
    return () => controller.abort();
  }, [itemsProp]);
  const items = itemsProp || catalog;

  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [activatingId, setActivatingId] = useState(null);

  const [howOpen, setHowOpen] = useState(() => {
    try {
      // Closed unless you opened it before: the page leads with rewards.
      return localStorage.getItem(HOW_KEY) === "0";
    } catch {
      return false;
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
      // The server says how to use what was just delivered (e.g. a
      // membership credit). Show that over any text set on the item.
      if (result?.howToUse)
        setConfirmItem((it) =>
          it ? { ...it, howToUse: result.howToUse } : it
        );
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
      <style>{PR_GLASS_CSS}</style>
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

            <p className="pr-pass-note">
              <ShieldCheck size={14} /> Spending XP never lowers your rank. XP
              isn&apos;t cash.
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
            <span className="pr-wallet-sub">To spend on rewards below</span>
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
            <>
              <ol className="pr-how-steps">
                <li>
                  <span className="pr-how-num">1</span>
                  <div>
                    <strong>Earn</strong>
                    <p>
                      Book trips, do challenges, invite friends and post on
                      SkyHub. Booking earns the most.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pr-how-num">2</span>
                  <div>
                    <strong>Rank up</strong>
                    <p>
                      Earned XP builds your rank. Spending never lowers it.
                      Cancelled bookings and removed posts take XP back.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pr-how-num">3</span>
                  <div>
                    <strong>Spend</strong>
                    <p>
                      Use spendable XP on the boosts, badges and perks below.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="pr-how-more">
                {/* What earns XP */}
                <section className="pr-how-block" aria-labelledby="pr-earn-h">
                  <h3 className="pr-how-h" id="pr-earn-h">
                    <Trophy size={13} aria-hidden="true" /> What earns XP
                  </h3>
                  <ul className="pr-earn">
                    <li>
                      Book a flight
                      <b>
                        {XP_EARN.flightMin}–{XP_EARN.flightMax} XP
                      </b>
                    </li>
                    <li>
                      Book a hotel <b>{XP_EARN.hotel} XP</b>
                    </li>
                    <li>
                      Your first booking <b>+{XP_EARN.firstBooking} XP</b>
                    </li>
                    <li>
                      Complete your profile{" "}
                      <b>+{XP_EARN.profileCompleted} XP</b>
                    </li>
                    <li>
                      SkyHub & daily visits{" "}
                      <b>up to {XP_EARN.engagementDaily} a day</b>
                    </li>
                  </ul>
                  <p className="pr-how-note">
                    Nonstop earns the most. Booking XP is pending until{" "}
                    {XP_EARN.bookingHoldHours} hours after your trip starts.
                    Cancelled bookings earn none.
                  </p>
                </section>

                {/* What XP can't do */}
                <section className="pr-how-block" aria-labelledby="pr-cant-h">
                  <h3 className="pr-how-h" id="pr-cant-h">
                    <Wallet size={13} aria-hidden="true" /> Good to know
                  </h3>
                  <div className="pr-cant">
                    <Ban size={16} aria-hidden="true" />
                    <span>
                      <b>XP isn't cash.</b> It can't pay for flights or hotels.
                    </span>
                  </div>
                </section>

                {/* Ranks */}
                <section className="pr-how-block" aria-labelledby="pr-ranks-h">
                  <h3 className="pr-how-h" id="pr-ranks-h">
                    <Award size={13} aria-hidden="true" /> The 8 ranks
                  </h3>
                  <ul className="pr-ranks">
                    {RANKS.map((r) => {
                      const you = !profileLoading && r.name === tier.name;
                      return (
                        <li key={r.name} className={you ? "is-you" : undefined}>
                          <span className="pr-rank-top">
                            <i
                              className="pr-rank-dot"
                              style={{ background: r.color }}
                              aria-hidden="true"
                            />
                            <span className="pr-rank-name">{r.name}</span>
                            {you && <span className="pr-rank-you">You</span>}
                          </span>
                          <span className="pr-rank-xp">
                            {r.minXp === 0
                              ? "Start here"
                              : `${fmt(r.minXp)} XP`}
                          </span>
                          {(RANK_PERKS[r.name] || []).map((perk) => (
                            <span
                              key={perk.text}
                              className={`pr-rank-perk${
                                perk.status === "soon" ? " is-soon" : ""
                              }`}
                            >
                              {perk.text}
                              {perk.status === "soon" ? " (coming soon)" : ""}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="pr-how-note">
                    {hasAnyRankPerks()
                      ? "Anything marked coming soon isn't available yet."
                      : "Rank perks are on the way. XP you earn now still counts."}
                  </p>
                </section>
              </div>
            </>
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
                text="Check back soon."
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

            {(catalogLoading || visibleItems.length > 0) && (
              <h2 className="pr-section">
                {tab === "all"
                  ? "All rewards"
                  : TABS.find((t) => t.key === tab)?.label}
              </h2>
            )}

            {catalogLoading ? (
              <div className="pr-loading">
                <Loader2 size={22} className="pr-spin" />
              </div>
            ) : catalogError ? (
              <EmptyState
                title="Couldn't load rewards"
                text="Check your connection and try again."
                onAction={() => window.location.reload()}
                actionLabel="Try again"
              />
            ) : visibleItems.length === 0 && !featured ? (
              <EmptyState
                title="New rewards are on the way"
                text="Keep earning XP. It's saved for when they drop."
                onAction={() => setTab("challenges")}
                actionLabel="See challenges"
              />
            ) : visibleItems.length === 0 ? null : (
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
              {fmt(item.cost - item.shortfall)} / {fmt(item.cost)} XP
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
          {item.howToUse || "Added to your account."}
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
