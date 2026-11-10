import React from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Divider,
  Progress,
  Tooltip,
} from "antd";
import {
  RocketOutlined,
  AimOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function AISuggestsCard({
  // From your first version
  userName = "Traveler",
  pick = {
    city: "Bangkok",
    reason: "great value for food + night markets",
    dates: "Oct 12–17",
    underBudgetPct: 18, // % under your set budget
  },
  onSeePlan = () => {},
  onViewDeals = () => {},
  onEditProfile = () => {},
  onQuickPick = () => {},

  // From the second version
  aiScore = 72, // 0–100
  title = "Plan smarter with AI",
  subtitle = "How strong your match is",
  onClick = () => {}, // e.g., Refresh suggestions
}) {
  return (
    <Card
      className="osq-card ai-suggests"
      bordered={false}
      bodyStyle={{ padding: 16 }}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        {/* Header */}
        <Space align="center" size={8}>
          <RocketOutlined />
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
        </Space>
        <Text type="secondary">
          Hey {userName}, here&apos;s a quick idea tailored to your vibe and budget:
        </Text>

        {/* AI Match Strength (line progress uses `size`, not `strokeWidth`) */}
        <div>
          <Text type="secondary">{subtitle}</Text>
          <Progress
            percent={aiScore}
            status="active"
            size={8}
            showInfo
          />
        </div>

        {/* Pick summary */}
        <div className="ai-pick">
          <div className="ai-pick-main">
            <Text strong>{pick.city}</Text>
            <Text type="secondary"> — {pick.reason}</Text>
          </div>
          <Space wrap size={[8, 8]}>
            <Tag className="pill">{pick.dates}</Tag>
            <Tag className="pill success">Under budget</Tag>
          </Space>
        </div>

        {/* Budget fit (line progress uses `size`, not `strokeWidth`) */}
        <div className="ai-budget">
          <Space align="center" size={8} style={{ width: "100%" }}>
            <ThunderboltOutlined />
            <Text>Budget fit</Text>
          </Space>
          <Progress
            percent={Math.max(
              0,
              Math.min(100, 100 - (pick.underBudgetPct ?? 0))
            )}
            showInfo={false}
            size={10} // ✅ no strokeWidth here either
          />
          <Text type="secondary">
            ~{pick.underBudgetPct}% below your current budget
          </Text>
        </div>

        {/* Actions */}
        <Space size={[8, 8]} wrap>
          <Button type="primary" onClick={onSeePlan}>
            See AI plan
          </Button>
          <Button onClick={onViewDeals}>View all deals</Button>
          <Button onClick={onEditProfile}>Create / Edit Profile</Button>
          <Button onClick={onClick}>Refresh</Button>
        </Space>

        <Divider className="soft-divider" />

        {/* Quick picks */}
        <Space
          style={{ justifyContent: "space-between", width: "100%" }}
          align="center"
        >
          <Text strong>Quick picks</Text>
          <Tooltip title="We match deals to your profile preferences.">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>

        <Space wrap size={[8, 8]}>
          {["Weekend beach", "City foodie", "Hidden gems", "Solo friendly"].map(
            (t) => (
              <Tag className="chip" key={t} onClick={() => onQuickPick?.(t)}>
                {t}
              </Tag>
            )
          )}
        </Space>

        <Space size={6}>
          <AimOutlined />
          <Text type="secondary">
            Why this pick? Based on your budget, saved trips, and recent views.
          </Text>
        </Space>
      </Space>
    </Card>
  );
}
