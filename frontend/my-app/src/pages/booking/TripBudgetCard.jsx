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

/* ---------------------------
   AI logic (kept, but copy upgraded)
---------------------------- */
function buildAiSuggestion({ planned, used, bookingTotal, tripDays = 3 }) {
  const p = Number(planned || 0);
  const u = Number(used || 0);
  const b = Number(bookingTotal || 0);

  const spent = u + b;
  const left = p - spent;

  // No budget set: more human + confident
  if (!p) {
    // Simple range. Later: make dynamic by destination.
    const low = 780;
    const high = 1200;

    return {
      title: "Set a budget and Atlas will pace the trip for you.",
      detail: `Most travelers land around $${low}–$${high}. Pick a number and I’ll keep your spending smooth.`,
      hint: `Quick start: try $${Math.max(
        210,
        Math.ceil(b * 1.25) || 210
      ).toLocaleString()}.`,
      tone: "neutral",
      actions: ["optimize", "deal", "surprise"],
    };
  }

  const days = Math.max(1, Number(tripDays || 1));
  const perDay = left / days;

  if (left < 0) {
    const recoverPerDay = Math.ceil(Math.abs(left) / days);
    return {
      title: `You’re $${Math.abs(left).toLocaleString()} over budget.`,
      detail: `Atlas can fix this fast. Either increase your budget or cut about $${recoverPerDay.toLocaleString()} / day for extras.`,
      hint: "Tap Optimize and I’ll rebalance your split.",
      tone: "danger",
      actions: ["optimize", "deal"],
    };
  }

  const dining = Math.round(p * 0.25);
  const transport = Math.round(p * 0.15);
  const activities = Math.round(p * 0.2);

  if (perDay < 35) {
    return {
      title: "Tight pacing — but doable.",
      detail: `You’ve got ~$${Math.floor(
        perDay
      ).toLocaleString()} / day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Atlas can help you stretch this without ruining the fun.",
      tone: "warn",
      actions: ["optimize", "deal"],
    };
  }

  if (perDay < 80) {
    return {
      title: "You’re on track.",
      detail: `You can spend ~$${Math.floor(
        perDay
      ).toLocaleString()} / day and stay smooth. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Want a better deal window? Tap Find better deal.",
      tone: "ok",
      actions: ["deal", "surprise"],
    };
  }

  return {
    title: "Comfortable pacing.",
    detail: `You’ve got ~$${Math.floor(
      perDay
    ).toLocaleString()} / day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
    hint: "Atlas can upgrade the experience without breaking budget.",
    tone: "great",
    actions: ["surprise", "deal"],
  };
}

/* ---------------------------
   Premium: typed reveal helper
---------------------------- */
function useTypewriter(text, { speed = 18, enabled = true } = {}) {
  const [out, setOut] = useState("");
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setOut(text || "");
      return;
    }

    // reset
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

  /* optional (future): destination to tailor Atlas */
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

  const ringStyle = useMemo(() => {
    const p = Math.max(0, Math.min(100, percent));
    const stroke = isOverBudget
      ? "rgba(255, 92, 92, 0.98)"
      : "rgba(255, 176, 102, 0.98)";
    return { "--pct": `${p}%`, "--stroke": stroke };
  }, [percent, isOverBudget]);

  const moodLabel = useMemo(() => {
    if (!hasBudget) return "Set your trip budget";
    if (isOverBudget) return "Over budget — Atlas can fix it";
    if (percent < 55) return "You’re on track ✨";
    if (percent < 85) return "Still smooth — keep it steady";
    return "Last stretch — watch extras";
  }, [hasBudget, isOverBudget, percent]);

  /* ---------------------------
     Atlas “alive” system
  ---------------------------- */
  const [atlasThinking, setAtlasThinking] = useState(false);
  const [atlasReveal, setAtlasReveal] = useState(false);
  const [atlasLine, setAtlasLine] = useState("");
  const [atlasVariant, setAtlasVariant] = useState(0);

  const atlasSuggestions = useMemo(() => {
    // Keep it simple + premium. Later: drive these from AI.
    return [
      `Atlas thinks you should visit Kyoto instead — less rush, better value, and the nights hit different.`,
      `Atlas pick: Lisbon. Beautiful views, great food, and surprisingly budget-friendly right now.`,
      `Atlas move: fly into Osaka to save money, then train to Kyoto for the vibes.`,
      `Atlas tip: lock your “extras” budget first — it’s what keeps trips stress-free.`,
    ];
  }, []);

  const currentAtlasText = useMemo(() => {
    // When no budget, tie it to the destination
    if (!hasBudget) {
      return `You’re planning ${destination}. ${ai.detail}`;
    }
    // With budget, Atlas comment rotates
    return atlasSuggestions[atlasVariant % atlasSuggestions.length];
  }, [hasBudget, destination, ai.detail, atlasSuggestions, atlasVariant]);

  const startAtlas = useCallback(
    (mode = "surprise") => {
      // thinking → reveal → typing
      setAtlasReveal(false);
      setAtlasThinking(true);

      // choose a new line depending on action
      const nextIndex =
        mode === "surprise"
          ? (atlasVariant + 1) % atlasSuggestions.length
          : mode === "deal"
          ? (atlasVariant + 2) % atlasSuggestions.length
          : (atlasVariant + 3) % atlasSuggestions.length;

      setAtlasVariant(nextIndex);

      // Simulated thinking time
      window.setTimeout(() => {
        setAtlasThinking(false);
        setAtlasReveal(true);

        // lock the line after we choose variant
        const line = hasBudget
          ? atlasSuggestions[nextIndex]
          : `You’re planning ${destination}. ${ai.detail}`;
        setAtlasLine(line);
      }, 650);
    },
    [atlasVariant, atlasSuggestions, hasBudget, destination, ai.detail]
  );

  // initial “alive” behavior: show a suggestion shortly after mount
  useEffect(() => {
    // don’t spam on every render
    const t = window.setTimeout(() => {
      setAtlasLine(currentAtlasText);
      setAtlasReveal(true);
    }, 350);

    return () => window.clearTimeout(t);
    // only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typewriter only when revealed
  const { out: typedText, done: typingDone } = useTypewriter(atlasLine, {
    speed: 14,
    enabled: atlasReveal,
  });

  const cardSpeaking = atlasThinking || (atlasReveal && !typingDone);

  return (
    <Card
      variant="borderless"
      className={`tb-card ${isOverBudget ? "is-overBudget" : ""} ${
        cardSpeaking ? "is-speaking" : ""
      }`}
    >
      {/* Everything scrolls inside */}
      <div className="tb-bodyScroll">
        {/* Top bar */}
        <div className="tb-topBar">
          <div className="tb-topBarTitle">Trip Budget</div>
          <Button
            icon={<ReloadOutlined />}
            className="tb-reset"
            onClick={onReset}
            aria-label="Reset budget"
          >
            Reset
          </Button>
        </div>

        {/* Header */}
        <div className="tb-header">
          <div className="tb-headText">
            <Title level={4} className="tb-title">
              {moodLabel}
            </Title>
            <Text className="tb-subtitle">
              Track spending + let Atlas keep your plan smooth.
            </Text>
          </div>
        </div>

        {/* Summary */}
        <div className="tb-summaryStrip">
          <div className="tb-summaryItem">
            <div className="tb-summaryKey">Trip cost</div>
            <div className="tb-summaryVal">
              ${Number(bookingTotal).toLocaleString()}
            </div>
          </div>

          <div className="tb-summaryDivider" />

          <div className="tb-summaryItem">
            <div className="tb-summaryKey">Spent</div>
            <div className="tb-summaryVal">
              ${Number(spent).toLocaleString()}
            </div>
          </div>

          <div className="tb-summaryDivider" />

          <div className="tb-summaryItem">
            <div className="tb-summaryKey">Days</div>
            <div className="tb-summaryVal">{Number(tripDays || 3)}</div>
          </div>
        </div>

        {/* Ring + meta */}
        <div className="tb-progressWrap">
          <div className="tb-ring" style={ringStyle}>
            <div className="tb-ringInner">
              <div className="tb-ringAmt">
                {hasBudget ? (
                  <>
                    {left < 0 ? "-" : ""}${Math.abs(left).toLocaleString()}
                  </>
                ) : (
                  <>$0</>
                )}
              </div>
              <div className="tb-ringLabel">Remaining</div>
              <div className="tb-ringPct">
                {hasBudget ? `${percent}%` : "—"}
              </div>
            </div>
          </div>

          <div className="tb-progressMeta">
            <div className="tb-miniRow">
              <span className="tb-miniPill">
                Budget: ${totalNum.toLocaleString()}
              </span>
              <span className="tb-miniPill">
                Spent: ${Number(spent).toLocaleString()}
              </span>
            </div>

            <div className="tb-meter">
              <div
                className={`tb-meterFill ${isOverBudget ? "is-over" : ""}`}
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>

            <div className="tb-meterNote">
              {isOverBudget
                ? "Over budget — Atlas will rebalance your plan."
                : ""}
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="tb-grid">
          <div className="tb-field">
            <div className="tb-fieldLabel">Set budget</div>
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

          <div className="tb-field">
            <div className="tb-fieldLabel">Track expense</div>

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
            <div className="tb-hint">
              Tip: extras = food, rides, activities.
            </div>
          </div>
        </div>

        {/* Category chips */}
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

        {/* Modules */}
        <div className="tb-stack">
          {/* Smart Plan */}
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

            {/* Actions */}
            <div className="tb-aiActions">
              <Button
                className="tb-pillBtn"
                onClick={() => startAtlas("optimize")}
                disabled={atlasThinking}
              >
                Optimize budget
              </Button>

              <Button
                className="tb-pillBtn"
                onClick={() => startAtlas("deal")}
                disabled={atlasThinking}
              >
                Find better deal
              </Button>

              <Button
                className="tb-pillBtnPrimary"
                onClick={() => startAtlas("surprise")}
                disabled={atlasThinking}
              >
                {atlasThinking ? "Atlas is thinking…" : "Surprise me"}
              </Button>
            </div>

            {/* Thinking + reveal */}
            <div
              className={`tb-novaBubble ${
                atlasThinking ? "is-thinking" : atlasReveal ? "is-reveal" : ""
              }`}
            >
              <div className="tb-novaAvatar">A</div>

              <div className="tb-novaTextWrap">
                {/* Thinking shimmer */}
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

          {/* Deals (kept simple) */}
          <div className="tb-deals">
            <div className="tb-dealsHead">Travel Deals</div>

            <div className="tb-dealRow">
              <div className="tb-dealLeft">
                <div className="tb-dealTitle">Tokyo, Japan</div>
                <div className="tb-dealSub">$640 RT</div>
              </div>
              <div className="tb-dealRight">Expedia</div>
            </div>

            <div className="tb-dealRow">
              <div className="tb-dealLeft">
                <div className="tb-dealTitle">Santorini, GR</div>
                <div className="tb-dealSub">From $410</div>
              </div>
              <div className="tb-dealRight">Booking.com</div>
            </div>

            <div className="tb-dealsFoot">
              Deals are non-intrusive and respect settings.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
