import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Button,
  Tag,
  Row,
  Col,
  Typography,
  Space,
  Switch,
  Divider,
  Tooltip,
  Progress,
  Modal,
  notification,
  Tabs,
  Spin,
  Alert,
} from "antd";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircleOutlined,
  StarOutlined,
  RocketOutlined,
  HomeOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FireOutlined,
  LockOutlined,
  UnlockOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  CompassOutlined,
  CrownOutlined,
  SendOutlined,
  SaveOutlined,
  UserOutlined,
  EditOutlined,
  TeamOutlined,
  MessageOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  AimOutlined,
} from "@ant-design/icons";
import PageLayout from "../../components/PageLayout";
import useXPSystem from "../../hooks/useXPSystem";
import { XP_TIERS, XP_RULES, XP_PASSIVE } from "../../config/xpConfig";
import "../../styles/Membership.css";

const { Title, Paragraph, Text } = Typography;

// ─── Icon map — replaces all emoji with Ant Design SVG icons ──────────────────
const XP_ICON_MAP = {
  // Passive
  DAILY_SESSION: <HomeOutlined />,
  ACTIVE_INTERVAL: <FieldTimeOutlined />,
  PAGE_VISIT: <CompassOutlined />,
  STREAK_DAY: <FireOutlined />,
  STREAK_WEEK: <FireOutlined />,
  STREAK_MONTH: <TrophyOutlined />,
  // Active
  BOOKING_CONFIRMED: <SendOutlined />,
  FIRST_INTERNATIONAL: <GlobalOutlined />,
  SAVED_TRIP: <SaveOutlined />,
  PROFILE_COMPLETED: <UserOutlined />,
  FEEDBACK_SUBMITTED: <EditOutlined />,
  POST_CREATED: <AimOutlined />,
  COMMENT_CREATED: <MessageOutlined />,
  SHARE_SKYSTREAM: <AimOutlined />,
  REFER_FRIEND: <TeamOutlined />,
  ELITE_MONTHLY_BONUS: <CrownOutlined />,
};

// ─── Plan icon components (replaces emoji strings) ────────────────────────────
const PLAN_ICONS = {
  free: <CompassOutlined style={{ fontSize: 18 }} />,
  pro: <ThunderboltOutlined style={{ fontSize: 18 }} />,
  elite: <CrownOutlined style={{ fontSize: 18 }} />,
};

// ─── Plan definitions ─────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free",
    name: "Free Explorer",
    monthly: 0,
    yearly: 0,
    tag: { text: "Free", color: "green" },
    className: "m-card",
    accentColor: "#60a5fa",
    multiplierLabel: "1×",
    features: [
      { icon: <CheckCircleOutlined />, text: "Access to booking & SkyStream" },
      { icon: <CheckCircleOutlined />, text: "Earn XP & unlock badges" },
      { icon: <CheckCircleOutlined />, text: "Save up to 3 trips" },
      { icon: <CheckCircleOutlined />, text: "Basic travel search" },
      { icon: <CheckCircleOutlined />, text: "1× XP on all activity" },
    ],
  },
  {
    id: "pro",
    name: "Sky Pro",
    monthly: 9.99,
    yearly: 7.99,
    tag: { text: "Most Popular", color: "blue" },
    className: "m-card m-popular",
    accentColor: "#f59e0b",
    multiplierLabel: "2×",
    features: [
      { icon: <StarOutlined />, text: "Everything in Free Explorer" },
      { icon: <StarOutlined />, text: "2× XP on all activity & actions" },
      { icon: <StarOutlined />, text: "Unlimited saved trips" },
      { icon: <StarOutlined />, text: "Priority booking access" },
      { icon: <StarOutlined />, text: "Exclusive Pro badges" },
      { icon: <StarOutlined />, text: "Advanced route planner" },
    ],
  },
  {
    id: "elite",
    name: "Sky Elite",
    monthly: 19.99,
    yearly: 15.99,
    tag: { text: "Best Value", color: "gold" },
    className: "m-card m-best",
    accentColor: "#a78bfa",
    multiplierLabel: "3×",
    features: [
      { icon: <RocketOutlined />, text: "Everything in Sky Pro" },
      { icon: <RocketOutlined />, text: "3× XP on all activity & actions" },
      { icon: <RocketOutlined />, text: "+200 XP monthly bonus" },
      { icon: <RocketOutlined />, text: "Concierge trip planning" },
      { icon: <RocketOutlined />, text: "VIP lounge access" },
      { icon: <RocketOutlined />, text: "Early feature access" },
      { icon: <RocketOutlined />, text: "Dedicated support" },
    ],
  },
];

// ─── XP Ring ──────────────────────────────────────────────────────────────────
function XPRing({ xp, tier, progress }) {
  const r = 70;
  const sw = 8;
  const norm = r - sw / 2;
  const circ = 2 * Math.PI * norm;
  const dash = (progress / 100) * circ;

  return (
    <div className="xp-ring-wrap">
      <svg width="160" height="160" className="xp-ring-svg">
        <circle
          cx="80"
          cy="80"
          r={norm}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={sw}
        />
        <circle
          cx="80"
          cy="80"
          r={norm}
          fill="none"
          stroke={tier.color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "80px 80px",
            transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)",
            filter: `drop-shadow(0 0 6px ${tier.color})`,
          }}
        />
      </svg>
      <div className="xp-ring-inner">
        <span className="xp-ring-icon" style={{ color: tier.color }}>
          {XP_ICON_MAP[`TIER_${tier.name.toUpperCase()}`] ?? (
            <CompassOutlined />
          )}
        </span>
        <span className="xp-ring-tier" style={{ color: tier.color }}>
          {tier.name}
        </span>
        <span className="xp-ring-xp">
          {xp} <small>XP</small>
        </span>
      </div>
    </div>
  );
}

// ─── XP event feed row ────────────────────────────────────────────────────────
function XPEvent({ event }) {
  const age = Math.round((Date.now() - event.time) / 60000);
  const timeLabel =
    age < 1
      ? "just now"
      : age < 60
      ? `${age}m ago`
      : `${Math.round(age / 60)}h ago`;
  return (
    <div className="xp-event">
      <span className="xp-event-icon">
        {XP_ICON_MAP[event.type] ?? <StarOutlined />}
      </span>
      <span className="xp-event-label">{event.label}</span>
      <span className="xp-event-xp" style={{ color: "#f59e0b" }}>
        +{event.xp} XP
      </span>
      <span className="xp-event-time">{timeLabel}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MembershipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState("monthly");
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [api, contextHolder] = notification.useNotification();

  const {
    xp,
    plan: currentPlan,
    streak,
    tier,
    nextTier,
    progress,
    multiplier,
    recentEvents,
    totalEarned,
    loading,
    error,
    trackPageVisit,
    refresh,
  } = useXPSystem();

  useEffect(() => {
    trackPageVisit(location.pathname);
  }, [location.pathname, trackPageVisit]);

  useEffect(() => {
    const prev = document.title;
    document.title = "Skyrio • Membership";
    return () => (document.title = prev);
  }, []);

  // XP toast on new event
  const lastEventRef = React.useRef(null);
  useEffect(() => {
    if (!recentEvents.length) return;
    const latest = recentEvents[0];
    if (latest.time === lastEventRef.current) return;
    lastEventRef.current = latest.time;
    api.open({
      message: (
        <span style={{ fontWeight: 700, color: "#fff" }}>
          <ThunderboltOutlined style={{ color: "#f59e0b", marginRight: 6 }} />+
          {latest.xp} XP
        </span>
      ),
      description: (
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {latest.label}
        </span>
      ),
      placement: "bottomRight",
      duration: 2.5,
      style: {
        background: "rgba(20,8,45,0.97)",
        border: "1px solid rgba(167,139,250,0.35)",
        borderRadius: 14,
        backdropFilter: "blur(12px)",
      },
    });
  }, [recentEvents, api]);

  const handleUpgrade = useCallback(
    (planObj) => {
      if (planObj.id === currentPlan) return;
      setConfirmPlan(planObj);
    },
    [currentPlan]
  );

  const confirmUpgrade = useCallback(() => {
    if (!confirmPlan) return;
    setConfirmPlan(null);
    navigate(`/membership/checkout?plan=${confirmPlan.id}&period=${period}`);
  }, [confirmPlan, navigate, period]);

  const priceFor = (plan) => (period === "yearly" ? plan.yearly : plan.monthly);

  if (loading) {
    return (
      <PageLayout fullBleed={false} maxWidth={1180} className="m-wrap">
        <div className="m-loading">
          <Spin
            indicator={
              <LoadingOutlined
                style={{ fontSize: 32, color: "#a78bfa" }}
                spin
              />
            }
          />
          <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12 }}>
            Loading your membership…
          </Text>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout fullBleed={false} maxWidth={1180} className="m-wrap">
      {contextHolder}

      {error && (
        <Alert
          type="warning"
          message="Couldn't load XP data"
          description={error}
          closable
          style={{ marginBottom: 16, borderRadius: 12 }}
          action={
            <Button size="small" onClick={refresh}>
              Retry
            </Button>
          }
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="m-top">
        <div className="m-top-header">
          <div>
            <Title level={2} className="m-title">
              Skyrio Membership
            </Title>
            <Paragraph className="m-sub">
              Unlock premium perks, boost your XP, and get exclusive travel
              tools by upgrading your membership.
            </Paragraph>
          </div>

          {/* Live XP pill */}
          <div
            className="m-xp-pill"
            style={{ borderColor: tier.color + "55", color: tier.color }}
          >
            <CompassOutlined style={{ marginRight: 4 }} />
            {tier.name}&nbsp;·&nbsp;<strong>{xp}</strong>&nbsp;XP
            {streak > 1 && (
              <span className="m-streak-badge">
                <FireOutlined /> {streak}d
              </span>
            )}
          </div>
        </div>

        <div className="m-top-actions">
          <Link to="/" aria-label="Back to Home">
            <Button
              type="primary"
              size="large"
              className="m-home-btn"
              icon={<HomeOutlined />}
            >
              Home
            </Button>
          </Link>

          <div className="m-billing-toggle">
            <Text>Monthly</Text>
            <Switch
              checked={period === "yearly"}
              onChange={(v) => setPeriod(v ? "yearly" : "monthly")}
              aria-label="Toggle yearly billing"
            />
            <Space size={6} align="center">
              <Text strong>Yearly</Text>
              <Tooltip title="Save ~20% vs monthly billing">
                <Tag color="gold">Save 20%</Tag>
              </Tooltip>
            </Space>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultActiveKey="plans" className="m-tabs">
        {/* ─ Plans ─ */}
        <Tabs.TabPane
          tab={
            <span>
              <StarOutlined /> Membership Plans
            </span>
          }
          key="plans"
        >
          <div className="m-section">
            <Paragraph className="m-sub" style={{ marginTop: 12 }}>
              Choose the tier that matches your travel energy.
            </Paragraph>

            <Row gutter={[24, 24]} justify="center">
              {PLANS.map((p) => {
                const price = priceFor(p);
                const label =
                  period === "monthly" ? "month" : "mo (billed yearly)";
                const isCurrent = p.id === currentPlan;

                return (
                  <Col xs={24} md={12} lg={8} key={p.id}>
                    <Card
                      title={
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: p.accentColor + "22",
                              border: `1px solid ${p.accentColor}44`,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: p.accentColor,
                            }}
                          >
                            {PLAN_ICONS[p.id]}
                          </span>
                          {p.name}
                        </span>
                      }
                      bordered={false}
                      className={`${p.className}${
                        isCurrent ? " m-current" : ""
                      }`}
                      style={{ "--plan-accent": p.accentColor }}
                      extra={
                        <Space size={4}>
                          {isCurrent && (
                            <Tag color="purple" icon={<CheckCircleOutlined />}>
                              Current
                            </Tag>
                          )}
                          <Tag color={p.tag.color}>{p.tag.text}</Tag>
                        </Space>
                      }
                    >
                      {/* Price */}
                      <div className="m-price-block">
                        <span className="m-price">
                          {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                        </span>
                        {price > 0 && (
                          <span className="m-price-period">/{label}</span>
                        )}
                      </div>

                      {/* XP multiplier badge */}
                      <div
                        className="m-xp-mult"
                        style={{
                          background: p.accentColor + "22",
                          border: `1px solid ${p.accentColor}44`,
                          color: p.accentColor,
                        }}
                      >
                        <ThunderboltOutlined /> {p.multiplierLabel} XP
                        multiplier
                      </div>

                      {/* Features */}
                      <ul className="m-feature-list">
                        {p.features.map((f, i) => (
                          <li key={i}>
                            <span
                              className="m-feat-icon"
                              style={{ color: p.accentColor }}
                            >
                              {f.icon}
                            </span>
                            <span>{f.text}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <Button
                        type="primary"
                        block
                        className="m-cta"
                        disabled={isCurrent}
                        style={
                          !isCurrent
                            ? {
                                background: p.accentColor,
                                boxShadow: `0 8px 24px ${p.accentColor}44`,
                              }
                            : {}
                        }
                        onClick={() => !isCurrent && handleUpgrade(p)}
                      >
                        {isCurrent ? (
                          <>
                            <CheckCircleOutlined /> You're on this plan
                          </>
                        ) : (
                          `Upgrade to ${p.name}`
                        )}
                      </Button>
                    </Card>
                  </Col>
                );
              })}
            </Row>

            <Divider />

            {/* Footer notes — fixed contrast */}
            <Space direction="vertical" size={6}>
              <Text className="m-note">
                <CheckCircleOutlined
                  style={{ marginRight: 6, color: "#34d399" }}
                />
                Prices in USD. Switch plans or cancel anytime.
              </Text>
              <Text className="m-note">
                <CheckCircleOutlined
                  style={{ marginRight: 6, color: "#34d399" }}
                />
                Yearly plans billed upfront — ~20% off vs monthly.
              </Text>
              <Text className="m-note">
                <ThunderboltOutlined
                  style={{ marginRight: 6, color: "#f59e0b" }}
                />
                XP multipliers apply to all passive SkyHub activity and explicit
                actions.
              </Text>
            </Space>
          </div>
        </Tabs.TabPane>

        {/* ─ XP & Levels ─ */}
        <Tabs.TabPane
          tab={
            <span>
              <TrophyOutlined /> XP &amp; Levels
            </span>
          }
          key="xp"
        >
          <div className="m-section">
            <Row gutter={[24, 24]}>
              {/* Left: ring + stats */}
              <Col xs={24} md={10}>
                <Card className="m-card xp-card" bordered={false}>
                  <XPRing xp={xp} tier={tier} progress={progress} />

                  <div className="xp-tier-labels">
                    <span style={{ color: tier.color }}>{tier.name}</span>
                    {nextTier && (
                      <span style={{ color: nextTier.color }}>
                        {nextTier.name}
                      </span>
                    )}
                  </div>

                  <Progress
                    percent={Math.round(progress)}
                    showInfo={false}
                    strokeColor={tier.color}
                    trailColor="rgba(255,255,255,0.08)"
                    strokeWidth={7}
                    style={{ margin: "6px 0 4px" }}
                  />
                  {nextTier && (
                    <div className="xp-to-next">
                      {xp} / {tier.max} XP&nbsp;·&nbsp;
                      <span style={{ color: nextTier.color }}>
                        {tier.max - xp} to {nextTier.name}
                      </span>
                    </div>
                  )}

                  <div className="xp-stats">
                    <div className="xp-stat">
                      <FireOutlined style={{ color: "#f97316" }} />
                      <span>{streak}</span>
                      <small>Streak</small>
                    </div>
                    <div className="xp-stat">
                      <ThunderboltOutlined style={{ color: "#f59e0b" }} />
                      <span>{multiplier}×</span>
                      <small>XP Mult.</small>
                    </div>
                    <div className="xp-stat">
                      <TrophyOutlined style={{ color: "#a78bfa" }} />
                      <span>{totalEarned}</span>
                      <small>Total XP</small>
                    </div>
                  </div>
                </Card>
              </Col>

              {/* Right: rank ladder + earn ways */}
              <Col xs={24} md={14}>
                {/* Rank ladder */}
                <Card
                  className="m-card"
                  bordered={false}
                  title={
                    <span style={{ color: "rgba(255,255,255,0.9)" }}>
                      <TrophyOutlined /> Rank Ladder
                    </span>
                  }
                  style={{ marginBottom: 16 }}
                >
                  {XP_TIERS.map((t) => {
                    const unlocked = xp >= t.min;
                    const current = tier.name === t.name;
                    return (
                      <div
                        key={t.name}
                        className={`xp-rank-row${
                          current ? " xp-rank-current" : ""
                        }${!unlocked ? " xp-rank-locked" : ""}`}
                        style={
                          current
                            ? {
                                borderColor: t.color + "55",
                                background: t.color + "12",
                              }
                            : {}
                        }
                      >
                        <div
                          className="xp-rank-icon"
                          style={{
                            background: unlocked
                              ? t.color + "22"
                              : "rgba(255,255,255,0.05)",
                            border: `1px solid ${
                              unlocked ? t.color + "44" : "transparent"
                            }`,
                            color: unlocked
                              ? t.color
                              : "rgba(255,255,255,0.25)",
                          }}
                        >
                          {unlocked ? <CompassOutlined /> : <LockOutlined />}
                        </div>
                        <div className="xp-rank-info">
                          <span
                            className="xp-rank-name"
                            style={{ color: unlocked ? "#fff" : "#6b7280" }}
                          >
                            {t.name}
                            {current && (
                              <Tag
                                color="purple"
                                style={{ marginLeft: 6, fontSize: 10 }}
                              >
                                YOU
                              </Tag>
                            )}
                          </span>
                          <span className="xp-rank-range">
                            {t.max === Infinity
                              ? `${t.min.toLocaleString()}+ XP`
                              : `${t.min.toLocaleString()} – ${t.max.toLocaleString()} XP`}
                          </span>
                        </div>
                        {unlocked && (
                          <UnlockOutlined style={{ color: t.color }} />
                        )}
                      </div>
                    );
                  })}
                </Card>

                {/* Ways to earn */}
                <Card
                  className="m-card"
                  bordered={false}
                  title={
                    <Space>
                      <span style={{ color: "rgba(255,255,255,0.9)" }}>
                        <ThunderboltOutlined /> Ways to Earn XP
                      </span>
                      <Tooltip title="All values already reflect your current plan multiplier.">
                        <InfoCircleOutlined
                          style={{ color: "#6b7280", fontSize: 13 }}
                        />
                      </Tooltip>
                    </Space>
                  }
                >
                  <div className="xp-action-group-label">
                    <ClockCircleOutlined /> Passive · SkyHub Activity
                  </div>
                  {Object.entries(XP_PASSIVE).map(([key, rule]) => (
                    <div key={key} className="xp-action-row">
                      <span
                        className="xp-action-icon"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        {XP_ICON_MAP[key] ?? <StarOutlined />}
                      </span>
                      <span className="xp-action-label">{rule.label}</span>
                      {rule.dailyLimit && (
                        <Tag style={{ fontSize: 10, marginRight: 4 }}>
                          cap {rule.dailyLimit}/day
                        </Tag>
                      )}
                      <span
                        className="xp-action-xp"
                        style={{ color: "#f59e0b" }}
                      >
                        +{rule.xp * multiplier} XP
                      </span>
                    </div>
                  ))}

                  <div
                    className="xp-action-group-label"
                    style={{ marginTop: 14 }}
                  >
                    <GlobalOutlined /> Active · Your Actions
                  </div>
                  {Object.entries(XP_RULES)
                    .filter(([, r]) => r.xp > 0)
                    .map(([key, rule]) => (
                      <div key={key} className="xp-action-row">
                        <span
                          className="xp-action-icon"
                          style={{ color: "rgba(255,255,255,0.6)" }}
                        >
                          {XP_ICON_MAP[key] ?? <StarOutlined />}
                        </span>
                        <span className="xp-action-label">{rule.label}</span>
                        {rule.once && (
                          <Tag style={{ fontSize: 10, marginRight: 4 }}>
                            once
                          </Tag>
                        )}
                        <span
                          className="xp-action-xp"
                          style={{ color: "#f59e0b" }}
                        >
                          +{rule.xp * multiplier} XP
                        </span>
                      </div>
                    ))}

                  {multiplier > 1 && (
                    <div className="xp-mult-note">
                      <ThunderboltOutlined style={{ color: "#f59e0b" }} />
                      &nbsp;{multiplier}× multiplier active — values above
                      reflect your{" "}
                      {currentPlan === "pro" ? "Sky Pro" : "Sky Elite"} bonus.
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Recent XP feed */}
            {recentEvents.length > 0 && (
              <Card
                className="m-card"
                bordered={false}
                title={
                  <span style={{ color: "rgba(255,255,255,0.9)" }}>
                    Recent XP Activity
                  </span>
                }
                style={{ marginTop: 16 }}
              >
                {recentEvents.map((ev, i) => (
                  <XPEvent key={i} event={ev} />
                ))}
              </Card>
            )}
          </div>
        </Tabs.TabPane>
      </Tabs>

      {/* ── Upgrade confirmation modal ──────────────────────────────────────── */}
      <Modal
        open={!!confirmPlan}
        onCancel={() => setConfirmPlan(null)}
        footer={null}
        centered
        className="m-upgrade-modal"
        width={420}
      >
        {confirmPlan && (
          <div className="m-modal-body">
            <div
              className="m-modal-plan-icon"
              style={{
                color: confirmPlan.accentColor,
                background: confirmPlan.accentColor + "18",
                border: `1px solid ${confirmPlan.accentColor}33`,
              }}
            >
              {PLAN_ICONS[confirmPlan.id]}
            </div>
            <Title level={3} className="m-modal-title">
              Upgrade to {confirmPlan.name}
            </Title>
            <Paragraph className="m-modal-desc">
              You'll be billed{" "}
              <strong style={{ color: confirmPlan.accentColor }}>
                ${priceFor(confirmPlan).toFixed(2)}/
                {period === "yearly" ? "mo (yearly)" : "month"}
              </strong>
              .
            </Paragraph>

            {confirmPlan.id === "elite" && (
              <div
                className="m-modal-bonus"
                style={{ borderColor: "#a78bfa44", background: "#a78bfa11" }}
              >
                <RocketOutlined style={{ color: "#a78bfa", marginRight: 6 }} />
                Elite: <strong>3× XP</strong> on everything +{" "}
                <strong>+200 XP/month</strong> automatically.
              </div>
            )}
            {confirmPlan.id === "pro" && (
              <div
                className="m-modal-bonus"
                style={{ borderColor: "#f59e0b44", background: "#f59e0b11" }}
              >
                <ThunderboltOutlined
                  style={{ color: "#f59e0b", marginRight: 6 }}
                />
                Pro: <strong>2× XP</strong> on all SkyHub activity and actions
                starting now.
              </div>
            )}

            <Button
              type="primary"
              block
              size="large"
              className="m-cta"
              style={{
                marginTop: 18,
                background: confirmPlan.accentColor,
                boxShadow: `0 8px 24px ${confirmPlan.accentColor}44`,
              }}
              onClick={confirmUpgrade}
            >
              Confirm Upgrade
            </Button>
            <Button
              block
              size="large"
              className="m-cancel-btn"
              onClick={() => setConfirmPlan(null)}
            >
              Maybe Later
            </Button>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
