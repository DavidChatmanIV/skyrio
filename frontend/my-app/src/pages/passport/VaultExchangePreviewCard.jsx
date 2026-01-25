import React, { useMemo } from "react";
import { Card, Typography, Tag, Button, Progress } from "antd";
import {
  LockOutlined,
  GiftOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function VaultExchangePreviewCard({
  // keep existing props so nothing breaks
  level = 1,
  balanceXp = 0,
  nextLevelGoal = 250,
  featuredDrop = "Priority Support Week",
  ctaLabel = "Open Vault Exchange",

  // optional (safe)
  tier = "LOCKED", // LOCKED | ACTIVE | PREMIUM
  expiresLabel = "Issued—Expires: Dec 31, 2026",

  // behavior toggles
  disabled = true, // soft launch locked by default
  onOpen,
}) {
  const pct = useMemo(() => {
    const goal = Math.max(1, Number(nextLevelGoal) || 1);
    const bal = Math.max(0, Number(balanceXp) || 0);
    return Math.max(0, Math.min(100, Math.round((bal / goal) * 100)));
  }, [balanceXp, nextLevelGoal]);

  const tierMeta = useMemo(() => {
    const t = String(tier || "").toUpperCase();

    if (t === "PREMIUM") {
      return { label: "Premium", tone: "ppTagOrange", icon: <GiftOutlined /> };
    }
    if (t === "ACTIVE") {
      return {
        label: "Soft Launch",
        tone: "ppTagOrange",
        icon: <ThunderboltOutlined />,
      };
    }
    return {
      label: "Coming Soon",
      tone: "ppTagDark",
      icon: <LockOutlined />,
    };
  }, [tier]);

  const handleOpen = () => {
    if (disabled) return;
    if (typeof onOpen === "function") onOpen();
  };

  return (
    <Card bordered={false} className="pp-card pp-card--panel pp-vxPreview">
      {/* Header */}
      <div className="pp-vxTop">
        <div className="pp-vxTitleRow">
          <Title level={4} className="pp-title" style={{ margin: 0 }}>
            Vault Exchange
          </Title>

          <div className="pp-vxTags">
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

      {/* XP Summary */}
      <div className="pp-vxMid">
        <div className="pp-vxStat">
          <Text className="pp-muted">XP Balance</Text>
          <div className="pp-vxBig">{Number(balanceXp || 0)} XP</div>
        </div>

        <div className="pp-vxProgress">
          <div className="pp-vxProgressTop">
            <Text className="pp-muted">Progress to first redeem</Text>
            <Text className="pp-muted">
              {Number(balanceXp || 0)}/{Number(nextLevelGoal || 0)} XP
            </Text>
          </div>

          <Progress percent={pct} showInfo={false} />
          <Text className="pp-faint" style={{ fontSize: 12 }}>
            Level {level} · Earn from bookings + quests
          </Text>
        </div>
      </div>

      {/* Featured Drop */}
      <div className="pp-vxDrop">
        <div className="pp-vxDropLeft">
          <Text className="pp-muted" style={{ fontWeight: 800 }}>
            Featured Drop
          </Text>
          <div className="pp-vxDropName">{featuredDrop}</div>
          <Text className="pp-faint" style={{ fontSize: 12 }}>
            {expiresLabel}
          </Text>
        </div>

        <div className="pp-vxDropRight">
          <Button
            className="pp-vxCta"
            type="primary"
            icon={<ArrowRightOutlined />}
            disabled={disabled}
            onClick={handleOpen}
          >
            {ctaLabel}
          </Button>

          {disabled && (
            <div className="pp-vxLockNote">
              <LockOutlined /> Locked for soft launch
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}