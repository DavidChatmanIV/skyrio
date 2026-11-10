import React, { useMemo, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Card, Button, Tag, Avatar, Progress, Space, Typography } from "antd";
import { ThunderboltOutlined, FireOutlined } from "@ant-design/icons";

const { Text } = Typography;

/* =========================
   XP LEVEL
   ========================= */
export const XPLevelCard = ({
  level = "Explorer",
  percent = 42,
  variant = "default",
}) => {
  const isHero = variant === "hero";
  return (
    <Card
      className={`osq-card xp-card ${isHero ? "xp-card-hero" : ""}`}
      variant="outlined"
      styles={{ body: { padding: isHero ? 12 : 16 } }}
      title={null}
    >
      <div className="xp-head">
        <Tag className="pill">Level</Tag>
        <Text strong>{level}</Text>
      </div>
      <div className="xp-bar">
        <Progress percent={percent} showInfo={false} />
      </div>
      <div className="xp-foot">
        <Text type="secondary">{percent}% to next badge</Text>
      </div>
    </Card>
  );
};

XPLevelCard.propTypes = {
  level: PropTypes.string,
  percent: PropTypes.number,
  variant: PropTypes.oneOf(["default", "hero"]),
};

/* =========================
   SAVED TRIPS
   ========================= */
export const SavedTripsCard = ({ trips = [] }) => (
  <Card
    className="osq-card"
    title="Saved Trips"
    variant="outlined"
    styles={{
      body: { padding: 16 },
      header: {
        borderBottom: "1px solid var(--border-soft, rgba(255,255,255,.12))",
      },
    }}
  >
    {trips.length ? (
      <ul className="saved-trips">
        {trips.map((t) => (
          <li key={`${t.city}-${t.range}`}>
            <span className="city">{t.city}</span>
            <span className="range">{t.range}</span>
            {t.cta && (
              <Button size="small" className="btn-pill">
                {t.cta}
              </Button>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <Text type="secondary">No saved trips yet.</Text>
    )}
  </Card>
);

SavedTripsCard.propTypes = {
  trips: PropTypes.arrayOf(
    PropTypes.shape({
      city: PropTypes.string.isRequired,
      range: PropTypes.string.isRequired,
      cta: PropTypes.string,
    })
  ),
};

/* =========================
   QUEST FEED PREVIEW
   ========================= */
export const QuestFeedPreview = ({ item }) => (
  <Card
    className="osq-card"
    title="Quest Feed"
    variant="outlined"
    styles={{
      body: { padding: 16 },
      header: {
        borderBottom: "1px solid var(--border-soft, rgba(255,255,255,.12))",
      },
    }}
  >
    {item ? (
      <div className="feed-item">
        <Space align="start">
          <Avatar>🧭</Avatar>
          <div>
            <p style={{ margin: 0 }}>
              <strong>{item.name}</strong>{" "}
              <span className="muted">• {item.time}</span>
            </p>
            <p style={{ margin: "4px 0 0" }}>{item.text}</p>
          </div>
        </Space>
      </div>
    ) : (
      <Text type="secondary">No feed activity yet.</Text>
    )}
  </Card>
);

QuestFeedPreview.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
  }),
};

/* =========================
   UNIQUE STAYS
   ========================= */
export const UniqueStaysCard = ({ items = [] }) => (
  <Card
    className="osq-card"
    title="Explore Unique Stays"
    variant="outlined"
    styles={{
      body: { padding: 16 },
      header: {
        borderBottom: "1px solid var(--border-soft, rgba(255,255,255,.12))",
      },
    }}
    extra={
      <Button size="small" className="btn-pill">
        View all
      </Button>
    }
  >
    <div className="unique-grid">
      {items.map((it) => (
        <div className="unique-item" key={it.id}>
          <div className="unique-img" role="img" aria-label={it.title}>
            {/* Replace with real <img src={it.image} alt={it.title} /> when wired */}
            <div className="img-placeholder">{it.badge}</div>
          </div>
          <div className="unique-meta">
            <span className="title">{it.title}</span>
            <Tag className="pill">{it.badge}</Tag>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

UniqueStaysCard.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      image: PropTypes.string,
      badge: PropTypes.string,
    })
  ),
};

/* =========================
   LIMITED DEALS (with countdown)
   ========================= */
export const LimitedDealsCard = ({ deals = [] }) => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => rerender((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timeLeft = (end) => {
    const ms = Math.max(0, end - Date.now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <Card
      className="osq-card"
      title="🔥 Limited Deals"
      variant="outlined"
      styles={{
        body: { padding: 16 },
        header: {
          borderBottom: "1px solid var(--border-soft, rgba(255,255,255,.12))",
        },
      }}
    >
      <div className="deal-list">
        {deals.map((d) => (
          <div className="deal-row" key={d.id}>
            <div className="deal-city">
              <FireOutlined /> <span>{d.city}</span>
            </div>
            <div className="deal-meta">
              <Tag className="pill">{d.discountPct}% off</Tag>
              <span className="price">{d.price}</span>
              <span className="ends">Ends in {timeLeft(d.endsAt)}</span>
            </div>
            <Button size="small" type="primary">
              Book
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};

LimitedDealsCard.propTypes = {
  deals: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      city: PropTypes.string.isRequired,
      price: PropTypes.string.isRequired,
      endsAt: PropTypes.number.isRequired, // epoch ms
      discountPct: PropTypes.number.isRequired,
    })
  ),
};

/* =========================
   AI PLANNER
   ========================= */
export const AIPlannerCard = ({
  userName = "Traveler",
  pick = {
    city: "Bangkok",
    reason: "great value",
    dates: "Oct 12–17",
    underBudgetPct: 18,
    matchPct: 72,
  },
  onStart = () => {},
  onViewDeals = () => {},
  onEditProfile = () => {},
  onSeePlan = () => {},
}) => {
  const summary = useMemo(
    () =>
      `${pick.city}: ${pick.reason}. ${pick.underBudgetPct}% under budget • ${pick.matchPct}% match`,
    [pick]
  );

  return (
    <Card
      className="osq-card"
      title="AI Trip Planner"
      variant="outlined"
      styles={{
        body: { padding: 16 },
        header: {
          borderBottom: "1px solid var(--border-soft, rgba(255,255,255,.12))",
        },
      }}
      extra={
        <Button size="small" className="btn-pill" onClick={onEditProfile}>
          Edit profile
        </Button>
      }
    >
      <div className="ai-plan">
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <div className="ai-row">
            <Avatar>🤖</Avatar>
            <div className="ai-copy">
              <p style={{ margin: 0 }}>
                Hi {userName}! Here&apos;s a smart pick for you:
              </p>
              <p style={{ margin: "4px 0 0" }}>
                <ThunderboltOutlined /> {summary}
              </p>
            </div>
          </div>
          <Space wrap>
            <Button type="primary" onClick={onStart}>
              Build with AI
            </Button>
            <Button onClick={onSeePlan}>See plan</Button>
            <Button onClick={onViewDeals}>View deals</Button>
          </Space>
        </Space>
      </div>
    </Card>
  );
};

AIPlannerCard.propTypes = {
  userName: PropTypes.string,
  pick: PropTypes.shape({
    city: PropTypes.string.isRequired,
    reason: PropTypes.string.isRequired,
    dates: PropTypes.string,
    underBudgetPct: PropTypes.number.isRequired,
    matchPct: PropTypes.number.isRequired,
  }),
  onStart: PropTypes.func,
  onViewDeals: PropTypes.func,
  onEditProfile: PropTypes.func,
  onSeePlan: PropTypes.func,
};
