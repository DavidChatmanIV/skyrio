import React, { useMemo } from "react";
import { Card, Typography, Tag, Button, Progress } from "antd";
import {
  LockOutlined,
  GiftOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function PassportRewardsPreviewCard({
  level = 1,
  balanceXp = 0,
  nextLevelGoal = 250,
  featuredDrop = "Priority Support Week", // string (legacy) or { title, cost }
  featuredDropCost, // optional override; lets you pass cost separately from title
  ctaLabel = "Open Passport Rewards",
  tier = "LOCKED", // LOCKED | ACTIVE | PREMIUM — ignored once canAfford is true
  expiresLabel = "Issued—Expires: Dec 31, 2026",
  disabled = true, // soft launch kill switch, independent of XP math
  onOpen,
}) {
  const dropTitle =
    typeof featuredDrop === "string" ? featuredDrop : featuredDrop?.title;
  const dropCost =
    featuredDropCost ??
    (typeof featuredDrop === "object" ? featuredDrop?.cost : undefined);

  const bal = Math.max(0, Number(balanceXp) || 0);
  const goal = Math.max(1, Number(dropCost ?? nextLevelGoal) || 1);
  const pct = Math.max(0, Math.min(100, Math.round((bal / goal) * 100)));
  const canAfford = dropCost != null && bal >= dropCost;

  const tierMeta = useMemo(() => {
    if (disabled) {
      return {
        label: "Coming Soon",
        tone: "ppTagDark",
        icon: <LockOutlined />,
      };
    }
    if (canAfford) {
      return {
        label: "Ready to Redeem",
        tone: "ppTagGreen",
        icon: <CheckCircleFilled />,
      };
    }
    if (String(tier).toUpperCase() === "PREMIUM") {
      return { label: "Premium", tone: "ppTagOrange", icon: <GiftOutlined /> };
    }
    return {
      label: "Soft Launch",
      tone: "ppTagOrange",
      icon: <ThunderboltOutlined />,
    };
  }, [disabled, canAfford, tier]);

  const handleOpen = () => {
    if (disabled) return;
    if (typeof onOpen === "function") onOpen();
  };

  return (
    <Card bordered={false} className="pp-card pp-card--panel pp-prPreview">
      <div className="pp-prTop">
        <div className="pp-prTitleRow">
          <Title level={4} className="pp-title" style={{ margin: 0 }}>
            Passport Rewards
          </Title>
          <div className="pp-prTags">
            <Tag className={`pp-tag ${tierMeta.tone}`} icon={tierMeta.icon}>
              {tierMeta.label}
            </Tag>
            <Tag className="pp-tag ppTagDark">Preview</Tag>
          </div>
        </div>
        <Text className="pp-muted" style={{ display: "block", marginTop: 6 }}>
          Spend XP like currency. Earn it by traveling.
        </Text>
      </div>

      <div className="pp-prMid">
        <div className="pp-prStat">
          <Text className="pp-muted">XP Balance</Text>
          <div className="pp-prBig">{bal} XP</div>
        </div>

        <div className="pp-prProgress">
          <div className="pp-prProgressTop">
            <Text className="pp-muted">
              {dropCost != null
                ? "Progress to this drop"
                : "Progress to first redeem"}
            </Text>
            <Text className="pp-muted">
              {bal}/{goal} XP
            </Text>
          </div>
          <Progress
            percent={pct}
            showInfo={false}
            status={canAfford ? "success" : "normal"}
          />
          <Text className="pp-faint" style={{ fontSize: 12 }}>
            Level {level} · Earn from bookings + quests
          </Text>
        </div>
      </div>

      <div className="pp-prDrop">
        <div className="pp-prDropLeft">
          <Text className="pp-muted" style={{ fontWeight: 800 }}>
            Featured Drop
          </Text>
          <div className="pp-prDropName">{dropTitle}</div>
          <Text className="pp-faint" style={{ fontSize: 12 }}>
            {dropCost != null
              ? `${dropCost} XP · ${expiresLabel}`
              : expiresLabel}
          </Text>
        </div>

        <div className="pp-prDropRight">
          <Button
            className="pp-prCta"
            type="primary"
            icon={<ArrowRightOutlined />}
            disabled={disabled}
            onClick={handleOpen}
          >
            {disabled ? ctaLabel : canAfford ? "Redeem Now" : ctaLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
