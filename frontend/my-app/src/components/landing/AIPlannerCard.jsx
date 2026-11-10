import React, { useState } from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Segmented,
  Progress,
} from "antd";
import {
  CalendarOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  BulbOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

/**
 * AIPlannerCard — unified “AI planning” card
 *
 * Modes:
 *  - "suggest": replaces “Plan smarter with AI”
 *  - "build":   replaces “Build My Dream Getaway”
 *
 * Props:
 *  userName: string
 *  pick: { city, reason, dates, underBudgetPct, matchPct }
 *  onStart(): open full builder
 *  onViewDeals(): open deals list
 *  onEditProfile(): open preference/profile editor
 *  onSeePlan(): open generated plan view
 */
export default function AIPlannerCard({
  userName = "Traveler",
  pick = {
    city: "Bangkok",
    reason: "great value for food + night markets",
    dates: "Oct 12–17",
    underBudgetPct: 18,
    matchPct: 72,
  },
  onStart = () => console.log("Start AI Trip Builder"),
  onViewDeals = () => console.log("View all deals"),
  onEditProfile = () => console.log("Edit trip profile"),
  onSeePlan = () => console.log("See AI plan"),
  defaultMode = "suggest", // "suggest" | "build"
}) {
  const [mode, setMode] = useState(defaultMode);

  return (
    <Card
      variant="borderless"
      styles={{ body: { padding: 16 } }}
      className="osq-card ai-planner"
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {/* Header with mode switch */}
        <Space
          align="center"
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          <Space align="center">
            {mode === "suggest" ? <BulbOutlined /> : <ThunderboltOutlined />}
            <Title level={4} style={{ margin: 0 }}>
              {mode === "suggest"
                ? "Plan smarter with AI"
                : "Build My Dream Getaway"}
            </Title>
          </Space>

          <Segmented
            size="middle"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { label: "Suggest", value: "suggest" },
              { label: "Build", value: "build" },
            ]}
          />
        </Space>

        {/* MODE: SUGGEST (the old “Plan smarter” card) */}
        {mode === "suggest" && (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Text type="secondary">
              Hey {userName}, here&apos;s a quick idea tailored to your vibe and
              budget:
            </Text>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {pick.city} — {pick.reason}
                </Title>
                <Space size={8} wrap>
                  <Tag icon={<CalendarOutlined />} className="pill">
                    {pick.dates}
                  </Tag>
                  <Tag icon={<DollarOutlined />} className="pill">
                    {pick.underBudgetPct != null
                      ? `~${pick.underBudgetPct}% under budget`
                      : "Budget fit"}
                  </Tag>
                </Space>
              </div>

              {typeof pick.matchPct === "number" && (
                <div style={{ minWidth: 120, textAlign: "right" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Match
                  </Text>
                  <Progress percent={pick.matchPct} size="small" showInfo />
                </div>
              )}
            </div>

            <Space className="ai-cta-row">
              <Button type="primary" onClick={onSeePlan}>
                See AI plan
              </Button>
              <Button onClick={onViewDeals}>View all deals</Button>
              <Button onClick={onEditProfile}>Create / Edit Profile</Button>
            </Space>

            <Text type="secondary" style={{ fontSize: 12 }}>
              Why this pick? Based on your budget, saved trips, and recent
              views.
            </Text>
          </Space>
        )}

        {/* MODE: BUILD (the old “Build My Dream Getaway” card) */}
        {mode === "build" && (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Text type="secondary">
              Let AI design your perfect escape — tailored to your vibe, budget,
              and dates.
            </Text>

            <ul
              style={{
                margin: "0 0 4px 18px",
                padding: 0,
                color: "rgba(255,255,255,.86)",
              }}
            >
              <li>Pick your dates, budget, and travel vibe</li>
              <li>We&apos;ll generate stays, food, and must-do activities</li>
              <li>Fine-tune and save as a trip plan</li>
            </ul>

            <Space className="ai-cta-row">
              <Button type="primary" onClick={onStart}>
                Start Building
              </Button>
              <Button onClick={onEditProfile}>Set preferences</Button>
              <Button onClick={onViewDeals}>See deals</Button>
            </Space>
          </Space>
        )}
      </Space>
    </Card>
  );
}
