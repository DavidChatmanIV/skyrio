import React, { useState, useMemo } from "react";
import { Card, Typography, Button, Tag } from "antd";
import {
  ThunderboltOutlined,
  TrophyOutlined,
  GiftOutlined,
  FireOutlined,
} from "@ant-design/icons";

import "../../styles/VaultExchange.css";

const { Title, Text } = Typography;

const TABS = [
  { key: "boosts", label: "Boosts", icon: <ThunderboltOutlined /> },
  { key: "badges", label: "Badges", icon: <TrophyOutlined /> },
  { key: "perks", label: "Perks", icon: <GiftOutlined /> },
  { key: "limited", label: "Limited", icon: <FireOutlined /> },
];

/**
 * ✅ NOTE:
 * Keep this mock USER for now, but this file no longer uses "Skyrio Vault" wording.
 * When you wire to real profile data later, replace USER with props or fetched state.
 */
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

/**
 * VaultExchange
 * - embedded=true => no page overlay/bg so Passport map stays visible
 */
export default function VaultExchange({
  embedded = false,
  title = "Vault Exchange",
}) {
  const [tab, setTab] = useState("boosts");

  const featured = useMemo(() => ITEMS.find((i) => i.featured), []);

  return (
    <div className={`vx-page ${embedded ? "is-embedded" : ""}`}>
      {/* ✅ Only render the overlay when NOT embedded */}
      {!embedded && <div className="vx-overlay" />}

      <div className="vx-shell">
        {/* Header */}
        <div className="vx-header">
          <div className="vx-titleBlock">
            <Title level={2} className="vx-title">
              {title}
            </Title>

            {/* ✅ UPDATED COPY */}
            <Text className="vx-subtitle">Inside your Vault Exchange</Text>

            <Text className="vx-lead">
              Trade XP for boosts, badges, perks, and limited drops.
            </Text>
          </div>

          <div className="vx-balanceCard">
            <div className="vx-xpRow">
              <span className="vx-xp">{USER.xp} XP</span>
              <span className="vx-level">{USER.level}</span>
            </div>

            <div className="vx-actions">
              <Button className="vx-btnPrimary">Earn More XP</Button>
              <Button className="vx-btnGhost">View Passport</Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="vx-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`vx-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
              type="button"
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Featured */}
        <Card bordered={false} className="vx-featured">
          <div className="vx-featuredHeader">
            <FireOutlined /> FEATURED THIS WEEK
          </div>

          <div className="vx-featuredBody">
            <div>
              <div className="vx-featuredTitle">{featured?.title}</div>
              <div className="vx-featuredDesc">{featured?.desc}</div>
            </div>

            <div className="vx-featuredRight">
              <Button className="vx-btnRedeem" disabled>
                Redeem {featured?.cost} XP
              </Button>
              <div className="vx-meta">
                Cost: {featured?.cost} XP · Lv {featured?.level}
              </div>
            </div>
          </div>
        </Card>

        {/* ✅ UPDATED SECTION LABEL */}
        <div className="vx-section">AVAILABLE IN VAULT</div>

        <div className="vx-grid">
          {ITEMS.map((item) => (
            <Card key={item.id} bordered={false} className="vx-card">
              <div className="vx-cardTop">
                <Tag className="vx-tag">{item.type}</Tag>
                {item.isNew && <Tag className="vx-new">NEW</Tag>}
              </div>

              <div className="vx-cardTitle">{item.title}</div>
              <div className="vx-cardDesc">{item.desc}</div>

              <div className="vx-meta">Cost: {item.cost} XP</div>

              <Button className="vx-btnLocked" disabled>
                Access Locked
              </Button>

              <div className="vx-foot">Level Required: Lv {item.level}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
