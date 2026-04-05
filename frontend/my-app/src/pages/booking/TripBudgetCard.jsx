import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Card, Typography, InputNumber, Button, Space } from "antd";
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

  const spent = u + b;
  const left = p - spent;

  if (!p) {
    const low = 780;
    const high = 1200;

    return {
      title: "Set a budget and Atlas will pace the trip for you.",
      detail: `Most travelers land around $${low}–$${high}. Pick a number and Atlas will help keep your spending smooth.`,
      hint: `Quick start: try $${Math.max(
        210,
        Math.ceil(b * 1.25) || 210
      ).toLocaleString()}.`,
      tone: "neutral",
    };
  }

  const days = Math.max(1, Number(tripDays || 1));
  const perDay = left / days;

  const dining = Math.round(p * 0.25);
  const transport = Math.round(p * 0.15);
  const activities = Math.round(p * 0.2);

  if (left < 0) {
    const recoverPerDay = Math.ceil(Math.abs(left) / days);
    return {
      title: `You’re $${Math.abs(left).toLocaleString()} over budget.`,
      detail: `Atlas can help fix this fast. Cut about $${recoverPerDay.toLocaleString()} per day from extras or raise the total budget.`,
      hint: "Try rebalancing the trip to protect the strongest parts.",
      tone: "danger",
    };
  }

  if (perDay < 35) {
    return {
      title: "Tight pacing — but still doable.",
      detail: `You’ve got about $${Math.floor(
        perDay
      ).toLocaleString()} per day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Lower spending a little and the trip stays comfortable.",
      tone: "warn",
    };
  }

  if (perDay < 80) {
    return {
      title: "You’re on track.",
      detail: `You can spend about $${Math.floor(
        perDay
      ).toLocaleString()} per day and stay smooth. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "You’ve got room to stay balanced without stress.",
      tone: "ok",
    };
  }

  return {
    title: "Comfortable pacing.",
    detail: `You’ve got about $${Math.floor(
      perDay
    ).toLocaleString()} per day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
    hint: "Atlas can help you upgrade the experience without breaking budget.",
    tone: "great",
  };
}

function useTypewriter(text, { speed = 18, enabled = true } = {}) {
  const [out, setOut] = useState("");
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setOut(text || "");
      return;
    }

    setOut("");
    idxRef.current = 0;

    if (timerRef.current) clearInterval(timerRef.current);

    const t = String(text || "");
    timerRef.current = setInterval(() => {
      idxRef.current += 1;
      setOut(t.slice(0, idxRef.current));

      if (idxRef.current >= t.length) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [text, speed, enabled]);

  const done = out.length >= String(text || "").length;
  return { out, done };
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
  tripDays = 3,
  destination = "Tokyo",
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
    if (!hasBudget || totalNum <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((spent / totalNum) * 100)));
  }, [hasBudget, totalNum, spent]);

  const isOverBudget = useMemo(() => {
    return hasBudget && spent > totalNum;
  }, [hasBudget, spent, totalNum]);

  const ai = useMemo(() => {
    return buildAiSuggestion({
      planned: totalNum,
      used,
      bookingTotal,
      tripDays,
    });
  }, [totalNum, used, bookingTotal, tripDays]);

  const ringStyle = useMemo(() => {
    const p = Math.max(0, Math.min(100, percent));
    const stroke = isOverBudget
      ? "rgba(255, 92, 92, 0.98)"
      : "rgba(255, 176, 102, 0.98)";

    return {
      "--pct": `${p}%`,
      "--stroke": stroke,
    };
  }, [percent, isOverBudget]);

  const moodLabel = useMemo(() => {
    if (!hasBudget) return "Set your trip budget";
    if (isOverBudget) return "Over budget — Atlas can help fix it";
    if (percent < 55) return "You’re on track ✨";
    if (percent < 85) return "Still smooth — keep it steady";
    return "Last stretch — watch extras";
  }, [hasBudget, isOverBudget, percent]);

  const days = Math.max(1, Number(tripDays || 1));

  const dailyPace = useMemo(() => {
    return Math.round(spent / days);
  }, [spent, days]);

  const healthStatus = useMemo(() => {
    if (!hasBudget) return "Set budget";
    if (spent >= totalNum) return "Over budget";
    if (spent >= totalNum * 0.85) return "Close to limit";
    return "On track";
  }, [hasBudget, spent, totalNum]);

  const healthTip = useMemo(() => {
    if (!hasBudget) {
      return `Set a number and Atlas will pace your ${destination} trip in a smoother way.`;
    }

    if (healthStatus === "On track") {
      const safeToday = Math.max(0, Math.round((totalNum - spent) / days));
      return `You can spend about $${safeToday.toLocaleString()} more per day and still stay smooth.`;
    }

    if (healthStatus === "Close to limit") {
      return "Slow down on extras a little so the rest of the trip stays comfortable.";
    }

    return "You’ve passed your target. Rebalance dining, transport, or lodging to recover.";
  }, [hasBudget, destination, healthStatus, totalNum, spent, days]);

  const [atlasThinking, setAtlasThinking] = useState(false);
  const [atlasReveal, setAtlasReveal] = useState(false);
  const [atlasLine, setAtlasLine] = useState("");
  const [atlasVariant, setAtlasVariant] = useState(0);

  const atlasSuggestions = useMemo(() => {
    return [
      `Atlas says: lock your extras budget first so your ${destination} trip stays stress-free.`,
      `Atlas move: shift spending away from weak extras and protect the strongest part of the trip.`,
      `Atlas tip: pace the trip by day, not by mood. That’s how you avoid budget regret later.`,
      `Atlas recommendation: keep your best experiences, trim the weak spending, and protect the overall vibe.`,
    ];
  }, [destination]);

  const currentAtlasText = useMemo(() => {
    if (!hasBudget) {
      return `You’re planning ${destination}. ${ai.detail}`;
    }
    return atlasSuggestions[atlasVariant % atlasSuggestions.length];
  }, [hasBudget, destination, ai.detail, atlasSuggestions, atlasVariant]);

  const startAtlas = useCallback(
    (mode = "suggestion") => {
      setAtlasReveal(false);
      setAtlasThinking(true);

      const nextIndex =
        mode === "suggestion"
          ? (atlasVariant + 1) % atlasSuggestions.length
          : (atlasVariant + 2) % atlasSuggestions.length;

      setAtlasVariant(nextIndex);

      const nextText =
        mode === "rebalance"
          ? isOverBudget
            ? `You’re over budget right now. Atlas would cut back about $${Math.ceil(
                Math.abs(left) / days
              ).toLocaleString()} per day and protect the strongest parts of your trip.`
            : `Atlas would rebalance this by tightening extras first and protecting your main trip moments.`
          : atlasSuggestions[nextIndex];

      window.clearTimeout(startAtlas._t1);

      startAtlas._t1 = window.setTimeout(() => {
        setAtlasLine(nextText);
        setAtlasThinking(false);
        setAtlasReveal(true);
      }, 1100);
    },
    [atlasVariant, atlasSuggestions, isOverBudget, left, days]
  );

  useEffect(() => {
    setAtlasLine(currentAtlasText);
    setAtlasReveal(true);
    setAtlasThinking(false);
  }, [currentAtlasText]);

  useEffect(() => {
    return () => {
      window.clearTimeout(startAtlas._t1);
    };
  }, [startAtlas]);

  const cardSpeaking = atlasThinking || atlasReveal;

  const { out: typedText, done: typingDone } = useTypewriter(atlasLine, {
    speed: 16,
    enabled: atlasReveal && !atlasThinking,
  });

  const handleAddExpense = () => {
    if (typeof onAddExpense === "function") {
      onAddExpense();
    }
  };

  return (
    <Card
      className={`tb-card ${cardSpeaking ? "is-speaking" : ""}`}
      variant="borderless"
    >
      <div className="tb-bodyScroll">
        <div className="tb-topBar">
          <div className="tb-topBarTitle">Trip Budget</div>

          <Button
            className="tb-reset"
            icon={<ReloadOutlined />}
            onClick={onReset}
          >
            Reset
          </Button>
        </div>

        <div className="tb-header">
          <Title level={3} className="tb-title">
            {moodLabel}
          </Title>
          <Text className="tb-subtitle">
            Track spending and let Atlas keep your plan smooth.
          </Text>
        </div>

        <div className="tb-summaryStrip">
          <div className="tb-summaryItem">
            <span className="tb-summaryKey">Trip Cost</span>
            <strong className="tb-summaryVal">
              ${bookingTotal.toLocaleString()}
            </strong>
          </div>

          <div className="tb-summaryDivider" />

          <div className="tb-summaryItem">
            <span className="tb-summaryKey">Spent</span>
            <strong className="tb-summaryVal">${spent.toLocaleString()}</strong>
          </div>

          <div className="tb-summaryDivider" />

          <div className="tb-summaryItem">
            <span className="tb-summaryKey">Days</span>
            <strong className="tb-summaryVal">{days}</strong>
          </div>
        </div>

        <div className="tb-progressWrap">
          <div className="tb-ring" style={ringStyle}>
            <div className="tb-ringInner">
              <div className="tb-ringAmt">
                {hasBudget ? `$${Math.max(0, left).toLocaleString()}` : "$0"}
              </div>

              <div className="tb-ringLabel">
                {hasBudget
                  ? isOverBudget
                    ? "Over"
                    : "Remaining"
                  : "Remaining"}
              </div>

              <div className="tb-ringPct">
                {hasBudget ? `${percent}% used` : "0% used"}
              </div>
            </div>
          </div>

          <div>
            <div className="tb-miniRow">
              <div className="tb-miniPill">
                Budget: ${hasBudget ? totalNum.toLocaleString() : "0"}
              </div>
              <div className="tb-miniPill">
                Spent: ${spent.toLocaleString()}
              </div>
            </div>

            <div className="tb-meter">
              <div
                className={`tb-meterFill ${isOverBudget ? "is-over" : ""}`}
                style={{ width: `${hasBudget ? percent : 0}%` }}
              />
            </div>

            <div className="tb-meterNote">
              {isOverBudget
                ? `You’re over by $${Math.abs(left).toLocaleString()}.`
                : hasBudget
                ? `$${Math.max(0, left).toLocaleString()} left to work with.`
                : "Set your budget to unlock pacing insights."}
            </div>
          </div>
        </div>

        <div className="tb-grid">
          <div>
            <label className="tb-fieldLabel">Set budget</label>
            <InputNumber
              className="tb-input tb-force"
              controls={false}
              min={0}
              value={planned}
              formatter={(value) => `$ ${value ?? 0}`}
              parser={(value) => String(value || "").replace(/\$\s?|(,*)/g, "")}
              onChange={onChangePlanned}
            />
          </div>

          <div>
            <label className="tb-fieldLabel">Track expense</label>

            <div className="tb-add-row">
              <InputNumber
                className="tb-input tb-force"
                controls={false}
                min={0}
                value={expenseAmount}
                formatter={(value) => `$ ${value ?? 0}`}
                parser={(value) =>
                  String(value || "").replace(/\$\s?|(,*)/g, "")
                }
                onChange={onChangeExpenseAmount}
              />

              <Button
                className="tb-addBtn"
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddExpense}
              >
                Add
              </Button>
            </div>

            <Text className="tb-hint">
              Tip: extras = food, rides, activities.
            </Text>
          </div>
        </div>

        <Space wrap className="tb-chips">
          <button type="button" className="tb-chip">
            <CoffeeOutlined /> Dining
          </button>

          <button type="button" className="tb-chip">
            <CarOutlined /> Transport
          </button>

          <button type="button" className="tb-chip">
            <HomeOutlined /> Lodging
          </button>
        </Space>

        <div className="tb-stack">
          <div className={`tb-ai tone-${ai.tone || "neutral"}`}>
            <div className="tb-aiTop">
              <div className="tb-aiBadge">
                <ThunderboltOutlined />
                <span>Atlas Plan</span>
              </div>

              <div className={`tb-novaSpark ${cardSpeaking ? "is-on" : ""}`}>
                <span className="tb-novaDot" />
                <span>Atlas</span>
              </div>
            </div>

            <div className="tb-aiCopy">
              <div className="tb-aiTitle">{ai.title}</div>
              <div className="tb-aiDetail">{ai.detail}</div>
              {ai.hint ? <div className="tb-aiHint">{ai.hint}</div> : null}
            </div>

            <div className="tb-aiActions">
              <Button
                className="tb-pillBtn"
                onClick={() => startAtlas("rebalance")}
                disabled={atlasThinking}
              >
                Rebalance trip
              </Button>

              <Button
                className="tb-pillBtnPrimary"
                onClick={() => startAtlas("suggestion")}
                disabled={atlasThinking}
              >
                {atlasThinking ? "Atlas is thinking…" : "Use suggestion"}
              </Button>
            </div>

            <div
              className={`tb-novaBubble ${
                atlasThinking ? "is-thinking" : atlasReveal ? "is-reveal" : ""
              }`}
            >
              <div className="tb-novaAvatar">A</div>

              <div className="tb-novaTextWrap">
                {atlasThinking ? (
                  <>
                    <div className="tb-typingRow">
                      <span className="tb-typingDot" />
                      <span className="tb-typingDot" />
                      <span className="tb-typingDot" />
                      <span className="tb-typingLabel">
                        Atlas is analyzing…
                      </span>
                    </div>
                    <div className="tb-shimmerLine" />
                    <div className="tb-shimmerLine short" />
                  </>
                ) : (
                  <>
                    <div className="tb-novaLine">{typedText}</div>
                    <div
                      className={`tb-caret ${typingDone ? "is-done" : ""}`}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="tb-health">
            <div className="tb-healthHead">
              <div className="tb-healthTitle">Trip Health</div>
              <div className="tb-healthSub">
                A quick view of how your trip is pacing.
              </div>
            </div>

            <div className="tb-healthRow">
              <span className="tb-healthKey">Daily pace</span>
              <strong className="tb-healthVal">
                ${dailyPace.toLocaleString()}/day
              </strong>
            </div>

            <div className="tb-healthRow">
              <span className="tb-healthKey">Status</span>
              <strong
                className={`tb-healthStatus ${healthStatus
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                {healthStatus}
              </strong>
            </div>

            <div className="tb-healthTip">
              <span className="tb-healthTipLabel">Atlas says</span>
              <p className="tb-healthTipText">{healthTip}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}