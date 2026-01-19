import React, { useState, useMemo } from "react";
import { Card, Typography, Button, Tag } from "antd";
import {
  ThunderboltOutlined,
  TrophyOutlined,
  GiftOutlined,
  FireOutlined,
} from "@ant-design/icons";

import "../../styles/SkyrioExchange.css";

const { Title, Text } = Typography;

const TABS = [
  { key: "boosts", label: "Boosts", icon: <ThunderboltOutlined /> },
  { key: "badges", label: "Badges", icon: <TrophyOutlined /> },
  { key: "perks", label: "Perks", icon: <GiftOutlined /> },
  { key: "limited", label: "Limited", icon: <FireOutlined /> },
];

const USER = {
  xp: 0,
  level: "Level 1 · Novice",
};

const ITEMS = [
  {
    id: "weekend_xp",
    type: "BOOST",
    title: "Weekend XP Multiplier",
    desc: "+2x XP on all bookings Fri–Sun",
    cost: 250,
    level: 1,
    featured: true,
  },
  {
    id: "review_streak",
    type: "BADGE",
    title: "Review Streak (+1.5x)",
    desc: "Leave 3 verified reviews this month for extra XP.",
    cost: 180,
    level: 1,
  },
  {
    id: "globetrotter",
    type: "BADGE",
    title: "Globetrotter",
    desc: "Unlocked at XP Level 5 or buy to fast-track.",
    cost: 400,
    level: 3,
    isNew: true,
  },
];

export default function SkyExchange() {
  const [tab, setTab] = useState("boosts");

  const featured = useMemo(() => ITEMS.find((i) => i.featured), []);

  return (
    <div className="sx-page">
      <div className="sx-overlay" />

      <div className="sx-shell">
        {/* Header */}
        <div className="sx-header">
          <div className="sx-titleBlock">
            <Title level={2} className="sx-title">
              SkyExchange
            </Title>
            <Text className="sx-subtitle">XP Vault · Members Lounge</Text>
            <Text className="sx-lead">
              Trade XP for access, prestige, and power-ups.
            </Text>
          </div>

          <div className="sx-balanceCard">
            <div className="sx-xpRow">
              <span className="sx-xp">{USER.xp} XP</span>
              <span className="sx-level">{USER.level}</span>
            </div>

            <div className="sx-actions">
              <Button className="sx-btnPrimary">Earn More XP</Button>
              <Button className="sx-btnGhost">View Passport</Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sx-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`sx-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Featured */}
        <Card bordered={false} className="sx-featured">
          <div className="sx-featuredHeader">
            <FireOutlined /> FEATURED THIS WEEK
          </div>

          <div className="sx-featuredBody">
            <div>
              <div className="sx-featuredTitle">{featured.title}</div>
              <div className="sx-featuredDesc">{featured.desc}</div>
            </div>

            <div className="sx-featuredRight">
              <Button className="sx-btnRedeem" disabled>
                Redeem {featured.cost} XP
              </Button>
              <div className="sx-meta">
                Cost: {featured.cost} XP · Lv {featured.level}
              </div>
            </div>
          </div>
        </Card>

        {/* Vault */}
        <div className="sx-section">AVAILABLE IN VAULT</div>

        <div className="sx-grid">
          {ITEMS.map((item) => (
            <Card key={item.id} bordered={false} className="sx-card">
              <div className="sx-cardTop">
                <Tag className="sx-tag">{item.type}</Tag>
                {item.isNew && <Tag className="sx-new">NEW</Tag>}
              </div>

              <div className="sx-cardTitle">{item.title}</div>
              <div className="sx-cardDesc">{item.desc}</div>

              <div className="sx-meta">Cost: {item.cost} XP</div>

              <Button className="sx-btnLocked" disabled>
                Access Locked
              </Button>

              <div className="sx-foot">Level Required: Lv {item.level}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}