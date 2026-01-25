import React, { useMemo } from "react";
import { Card, Typography, InputNumber, Button, Space, Tag } from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  CoffeeOutlined,
  CarOutlined,
  HomeOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import "../../styles/TripBudgetCard.css";

const { Title, Text } = Typography;

function buildAiSuggestion({ planned, used, bookingTotal, tripDays = 3 }) {
  const p = Number(planned || 0);
  const u = Number(used || 0);
  const b = Number(bookingTotal || 0);

  // include bookingTotal in spend so user pacing is accurate
  const spent = u + b;
  const left = p - spent;

  if (!p) {
    const suggested = b ? Math.ceil(b * 3) : 1200;
    return {
      title: "Set a budget to unlock pacing tips.",
      detail: `Try $${suggested.toLocaleString()} as a starting point.`,
      tone: "neutral",
    };
  }

  const days = Math.max(1, Number(tripDays || 1));
  const perDay = left / days;

  if (left < 0) {
    const recoverPerDay = Math.ceil(Math.abs(left) / days);
    return {
      title: `You’re $${Math.abs(left).toLocaleString()} over budget.`,
      detail: `To recover in ${days} day(s), cut about $${recoverPerDay.toLocaleString()} / day or increase your budget.`,
      tone: "danger",
    };
  }

  // “split suggestion” + pacing
  const dining = Math.round(p * 0.25);
  const transport = Math.round(p * 0.15);
  const activities = Math.round(p * 0.2);

  if (perDay < 35) {
    return {
      title: "Tight pacing.",
      detail: `Aim for <$${Math.floor(
        perDay
      ).toLocaleString()} / day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      tone: "warn",
    };
  }

  if (perDay < 80) {
    return {
      title: "Solid pacing.",
      detail: `You can spend about $${Math.floor(
        perDay
      ).toLocaleString()} / day and stay on track. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      tone: "ok",
    };
  }

  return {
    title: "Comfortable pacing.",
    detail: `You’ve got ~$${Math.floor(
      perDay
    ).toLocaleString()} / day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
    tone: "great",
  };
}

export default function TripBudgetCard({
  planned = null,
  used = 0,
  bookingTotal = 0,

  onChangePlanned,
  onAddExpense,
  onReset,

  expenseAmount = 0,
  onChangeExpenseAmount,

  // ✅ new optional prop (non-breaking)
  tripDays = 3,
}) {
  const totalNum = useMemo(() => {
    const n = typeof planned === "number" ? planned : Number(planned);
    return Number.isFinite(n) ? n : 0;
  }, [planned]);

  const hasBudget = totalNum > 0;

  const spent = useMemo(() => {
    return Number(used || 0) + Number(bookingTotal || 0);
  }, [used, bookingTotal]);

  const left = useMemo(() => {
    if (!hasBudget) return 0;
    return totalNum - spent;
  }, [hasBudget, totalNum, spent]);

  const percent = useMemo(() => {
    if (!hasBudget) return 0;
    return Math.min(100, Math.max(0, Math.round((spent / totalNum) * 100)));
  }, [hasBudget, totalNum, spent]);

  const isOverBudget = useMemo(() => {
    return hasBudget && spent > totalNum;
  }, [hasBudget, spent, totalNum]);

  const ai = useMemo(
    () =>
      buildAiSuggestion({ planned: totalNum, used, bookingTotal, tripDays }),
    [totalNum, used, bookingTotal, tripDays]
  );

  // ✅ Smooth ring animation (CSS var driven)
  const ringStyle = useMemo(() => {
    const p = Math.max(0, Math.min(100, percent));
    const stroke = isOverBudget
      ? "rgba(255, 92, 92, 0.98)"
      : "rgba(255, 176, 102, 0.98)";
    return { "--pct": `${p}%`, "--stroke": stroke };
  }, [percent, isOverBudget]);

  return (
    <Card
      bordered={false}
      className={`tb-card ${isOverBudget ? "is-overBudget" : ""}`}
    >
      {/* Header */}
      <div className="tb-header">
        <div>
          <Title level={4} className="tb-title">
            Trip Budget
          </Title>
          <Text className="tb-subtitle">Stay on track without the stress</Text>
        </div>

        <Button
          icon={<ReloadOutlined />}
          shape="circle"
          className="tb-reset"
          onClick={onReset}
          aria-label="Reset budget"
        />
      </div>

      {/* Booking total */}
      <div className="tb-bookingTotal">
        <Text className="tb-muted">
          Current trip total:{" "}
          <span className="tb-accent">
            ${Number(bookingTotal).toLocaleString()}
          </span>
        </Text>
      </div>

      {/* Radial ring + Overview */}
      <div className="tb-progressWrap">
        <div className="tb-ring" style={ringStyle}>
          <div className="tb-ringInner">
            <div className="tb-ringPct">{hasBudget ? `${percent}%` : "$0"}</div>
            <div className="tb-ringLabel">{hasBudget ? "used" : "plan"}</div>
          </div>
        </div>

        <div className="tb-progressMeta">
          <div className="tb-overview">
            <div>
              <Text className="tb-muted">
                ${totalNum.toLocaleString()} planned
              </Text>
              <Text className="tb-muted">
                ${Number(spent).toLocaleString()} used
              </Text>
            </div>

            <Title
              level={3}
              className={`tb-remaining ${left < 0 ? "is-over" : ""}`}
            >
              {hasBudget ? (
                <>
                  {left < 0 ? "-" : ""}${Math.abs(left).toLocaleString()} Left
                </>
              ) : (
                <>Set Budget</>
              )}
            </Title>
          </div>

          <div className="tb-miniLine">
            <span className="tb-miniKey">Spent</span>
            <span className="tb-miniVal">
              ${Number(spent).toLocaleString()}
            </span>
            <span className="tb-miniDot" />
            <span className="tb-miniKey">Days</span>
            <span className="tb-miniVal">{Number(tripDays || 3)}</span>
          </div>
        </div>
      </div>

      {/* Planned budget */}
      <div className="tb-plannedRow">
        <Text className="tb-muted">Budget planned</Text>
        <InputNumber
          prefix="$"
          value={planned ?? null}
          min={0}
          step={50}
          controls={false}
          className="tb-input tb-force"
          onChange={(v) => onChangePlanned?.(v ?? null)}
          placeholder="0"
        />
      </div>

      {/* Add expense */}
      <div className="tb-add">
        <Text className="tb-muted">Add expense</Text>

        <div className="tb-add-row">
          <InputNumber
            prefix="$"
            value={expenseAmount ?? null}
            min={0}
            step={10}
            controls={false}
            className="tb-input tb-force"
            onChange={(v) => onChangeExpenseAmount?.(Number(v || 0))}
            placeholder="0"
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddExpense}
            className="tb-addBtn"
          >
            Add
          </Button>
        </div>
      </div>

      {/* Categories */}
      <Space wrap className="tb-tags">
        <Tag icon={<CoffeeOutlined />}>Dining</Tag>
        <Tag icon={<CarOutlined />}>Transport</Tag>
        <Tag icon={<HomeOutlined />}>Lodging</Tag>
      </Space>

      {/* AI Suggestion (live-reactive) */}
      <div className={`tb-ai ${ai.tone ? `tone-${ai.tone}` : ""}`}>
        <div className="tb-aiBadge">
          <ThunderboltOutlined />
          <span>Smart Plan AI</span>
        </div>

        <Text className="tb-aiText">
          <b>{ai.title}</b>
          <br />
          {ai.detail}
        </Text>
      </div>
    </Card>
  );
}
