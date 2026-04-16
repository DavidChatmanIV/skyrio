import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Card, Typography, InputNumber } from "antd";
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

/* ─────────────────────────────────────────────
   ATLAS AI SUGGESTION LOGIC
───────────────────────────────────────────── */
function buildAiSuggestion({ planned, used, bookingTotal, tripDays = 3 }) {
  const p = Number(planned || 0);
  const u = Number(used || 0);
  const b = Number(bookingTotal || 0);
  const spent = u + b;
  const left = p - spent;

  if (!p) {
    return {
      title: "Set a budget and Atlas will pace the trip for you.",
      detail: `Most travelers land around $780–$1,200. Pick a number and I'll keep your spending smooth.`,
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
  const dining = Math.round(p * 0.25);
  const transport = Math.round(p * 0.15);
  const activities = Math.round(p * 0.2);

  if (left < 0) {
    const recoverPerDay = Math.ceil(Math.abs(left) / days);
    return {
      title: `You're $${Math.abs(left).toLocaleString()} over budget.`,
      detail: `Atlas can fix this fast. Either increase your budget or cut about $${recoverPerDay.toLocaleString()} / day for extras.`,
      hint: "Tap Optimize and I'll rebalance your split.",
      tone: "danger",
      actions: ["optimize", "deal"],
    };
  }

  if (perDay < 35) {
    return {
      title: "Tight pacing — but doable.",
      detail: `You've got ~$${Math.floor(
        perDay
      ).toLocaleString()} / day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Atlas can help you stretch this without ruining the fun.",
      tone: "warn",
      actions: ["optimize", "deal"],
    };
  }

  if (perDay < 80) {
    return {
      title: "You're on track.",
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
    detail: `You've got ~$${Math.floor(
      perDay
    ).toLocaleString()} / day for extras. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
    hint: "Atlas can upgrade the experience without breaking budget.",
    tone: "great",
    actions: ["surprise", "deal"],
  };
}

/* ─────────────────────────────────────────────
   TYPEWRITER HOOK
───────────────────────────────────────────── */
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
    };
  }, [text, speed, enabled]);

  return { out, done: out.length >= String(text || "").length };
}

/* ─────────────────────────────────────────────
   CATEGORY QUICK-ADD
   Clicking a chip adds a preset amount to expenses
───────────────────────────────────────────── */
const CATEGORY_PRESETS = [
  { icon: <CoffeeOutlined />, label: "Dining", amount: 45 },
  { icon: <CarOutlined />, label: "Transport", amount: 25 },
  { icon: <HomeOutlined />, label: "Lodging", amount: 120 },
];

/* ─────────────────────────────────────────────
   MAIN COMPONENT
   Props (all optional — card works standalone):
     initialBookingTotal  number   seed value for trip cost
     initialTripDays      number   seed value for days
     initialDestination   string   city name shown in Atlas copy
     onStateChange        fn       optional callback → { planned, used, bookingTotal, tripDays }
───────────────────────────────────────────── */
export default function TripBudgetCard({
  initialBookingTotal = 0,
  initialTripDays = 3,
  initialDestination = "your destination",
  onStateChange,
}) {
  /* ── All budget state lives here ── */
  const [planned, setPlanned] = useState(null);
  const [used, setUsed] = useState(0);
  const [bookingTotal, setBookingTotal] = useState(
    Number(initialBookingTotal) || 0
  );
  const [expenseAmount, setExpenseAmount] = useState(null);
  const [tripDays, setTripDays] = useState(Number(initialTripDays) || 3);
  const [destination, setDestination] = useState(initialDestination);

  /* Sync if parent passes new initialBookingTotal after mount */
  useEffect(() => {
    if (initialBookingTotal) setBookingTotal(Number(initialBookingTotal));
  }, [initialBookingTotal]);

  useEffect(() => {
    if (initialDestination) setDestination(initialDestination);
  }, [initialDestination]);

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    setPlanned(null);
    setUsed(0);
    setBookingTotal(Number(initialBookingTotal) || 0);
    setExpenseAmount(null);
    setTripDays(Number(initialTripDays) || 3);
  }, [initialBookingTotal, initialTripDays]);

  /* ── Add expense ── */
  const handleAddExpense = useCallback(() => {
    const amt = Number(expenseAmount || 0);
    if (!amt || amt <= 0) return;
    setUsed((prev) => prev + amt);
    setExpenseAmount(null);
  }, [expenseAmount]);

  /* ── Category quick-add ── */
  const handleCategoryAdd = useCallback((amount) => {
    setUsed((prev) => prev + amount);
  }, []);

  /* ── Notify parent ── */
  useEffect(() => {
    onStateChange?.({ planned, used, bookingTotal, tripDays });
  }, [planned, used, bookingTotal, tripDays, onStateChange]);

  /* ── Derived values ── */
  const totalNum = useMemo(() => {
    const n = Number(planned);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [planned]);

  const hasBudget = totalNum > 0;
  const spent = useMemo(
    () => Number(used || 0) + Number(bookingTotal || 0),
    [used, bookingTotal]
  );
  const left = useMemo(
    () => (hasBudget ? totalNum - spent : 0),
    [hasBudget, totalNum, spent]
  );
  const percent = useMemo(
    () =>
      hasBudget
        ? Math.min(100, Math.max(0, Math.round((spent / totalNum) * 100)))
        : 0,
    [hasBudget, totalNum, spent]
  );
  const isOverBudget = hasBudget && spent > totalNum;

  const ai = useMemo(
    () =>
      buildAiSuggestion({ planned: totalNum, used, bookingTotal, tripDays }),
    [totalNum, used, bookingTotal, tripDays]
  );

  /* ── Ring style — fallbacks prevent white box on first render ── */
  const ringStyle = useMemo(
    () => ({
      "--pct": `${Math.max(0, Math.min(100, percent))}%`,
      "--stroke": isOverBudget
        ? "rgba(255, 92, 92, 0.98)"
        : "rgba(255, 176, 102, 0.98)",
    }),
    [percent, isOverBudget]
  );

  const moodLabel = useMemo(() => {
    if (!hasBudget) return "Set your trip budget";
    if (isOverBudget) return "Over budget — Atlas can fix it";
    if (percent < 55) return "You're on track ✨";
    if (percent < 85) return "Still smooth — keep it steady";
    return "Last stretch — watch extras";
  }, [hasBudget, isOverBudget, percent]);

  /* ── Atlas AI system ── */
  const [atlasThinking, setAtlasThinking] = useState(false);
  const [atlasReveal, setAtlasReveal] = useState(false);
  const [atlasLine, setAtlasLine] = useState("");
  const [atlasVariant, setAtlasVariant] = useState(0);

  const atlasSuggestions = useMemo(
    () => [
      `Atlas thinks you should visit Kyoto instead — less rush, better value, and the nights hit different.`,
      `Atlas pick: Lisbon. Beautiful views, great food, and surprisingly budget-friendly right now.`,
      `Atlas move: fly into Osaka to save money, then train to Kyoto for the vibes.`,
      `Atlas tip: lock your "extras" budget first — it's what keeps trips stress-free.`,
    ],
    []
  );

  const currentAtlasText = useMemo(() => {
    if (!hasBudget) return `You're planning ${destination}. ${ai.detail}`;
    return atlasSuggestions[atlasVariant % atlasSuggestions.length];
  }, [hasBudget, destination, ai.detail, atlasSuggestions, atlasVariant]);

  const startAtlas = useCallback(
    (mode = "surprise") => {
      setAtlasReveal(false);
      setAtlasThinking(true);
      const nextIdx =
        mode === "surprise"
          ? (atlasVariant + 1) % atlasSuggestions.length
          : mode === "deal"
          ? (atlasVariant + 2) % atlasSuggestions.length
          : (atlasVariant + 1) % atlasSuggestions.length;
      setAtlasVariant(nextIdx);
      window.setTimeout(() => {
        setAtlasThinking(false);
        setAtlasReveal(true);
        setAtlasLine(
          hasBudget
            ? atlasSuggestions[nextIdx]
            : `You're planning ${destination}. ${ai.detail}`
        );
      }, 650);
    },
    [atlasVariant, atlasSuggestions, hasBudget, destination, ai.detail]
  );

  /* Initial Atlas reveal on mount */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setAtlasLine(currentAtlasText);
      setAtlasReveal(true);
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { out: typedText, done: typingDone } = useTypewriter(atlasLine, {
    speed: 14,
    enabled: atlasReveal,
  });

  const cardSpeaking = atlasThinking || (atlasReveal && !typingDone);

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <Card
      variant="borderless"
      className={`tb-card ${isOverBudget ? "is-overBudget" : ""} ${
        cardSpeaking ? "is-speaking" : ""
      }`}
    >
      <div className="tb-bodyScroll">
        {/* ── Top bar ── */}
        <div className="tb-topBar">
          <div className="tb-topBarTitle">Trip Budget</div>
          <button
            type="button"
            className="tb-reset"
            onClick={handleReset}
            aria-label="Reset budget"
          >
            <ReloadOutlined /> Reset
          </button>
        </div>

        {/* ── Header ── */}
        <div className="tb-header">
          <Title level={4} className="tb-title">
            {moodLabel}
          </Title>
          <Text className="tb-subtitle">
            Track spending + let Atlas keep your plan smooth.
          </Text>
        </div>

        {/* ── Summary strip — all three cells fully editable ── */}
        <div className="tb-summaryStrip">
          <div className="tb-summaryItem">
            <div className="tb-summaryKey">Trip Cost</div>
            <InputNumber
              prefix="$"
              value={bookingTotal || null}
              min={0}
              step={10}
              controls={false}
              className="tb-stripInput"
              placeholder="0"
              onChange={(v) => setBookingTotal(Number(v || 0))}
            />
          </div>
          <div className="tb-summaryDivider" />
          <div className="tb-summaryItem">
            <div className="tb-summaryKey">Spent</div>
            <InputNumber
              prefix="$"
              value={used || null}
              min={0}
              step={10}
              controls={false}
              className="tb-stripInput"
              placeholder="0"
              onChange={(v) => setUsed(Number(v || 0))}
            />
          </div>
          <div className="tb-summaryDivider" />
          <div className="tb-summaryItem">
            <div className="tb-summaryKey">Days</div>
            <InputNumber
              value={tripDays}
              min={1}
              max={90}
              step={1}
              controls={false}
              className="tb-stripInput tb-stripInputDays"
              onChange={(v) => setTripDays(Number(v || 1))}
            />
          </div>
        </div>

        {/* ── Ring + progress meta ── */}
        <div className="tb-progressWrap">
          <div className="tb-ring" style={ringStyle}>
            <div className="tb-ringInner">
              <div className="tb-ringAmt">
                {hasBudget ? (
                  <>
                    {left < 0 ? "-" : ""}${Math.abs(left).toLocaleString()}
                  </>
                ) : (
                  <span style={{ fontSize: 13, opacity: 0.6 }}>No budget</span>
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
            {isOverBudget && (
              <div className="tb-meterNote">
                Over budget — Atlas will rebalance your plan.
              </div>
            )}
          </div>
        </div>

        {/* ── Main inputs ── */}
        <div className="tb-grid">
          <div className="tb-field">
            <div className="tb-fieldLabel">Set total budget</div>
            <InputNumber
              prefix="$"
              value={planned ?? null}
              min={0}
              step={50}
              controls={false}
              className="tb-input tb-force"
              placeholder="Enter your budget"
              onChange={(v) => setPlanned(v ?? null)}
            />
          </div>

          <div className="tb-field">
            <div className="tb-fieldLabel">Track an expense</div>
            <div className="tb-add-row">
              <InputNumber
                prefix="$"
                value={expenseAmount ?? null}
                min={0}
                step={10}
                controls={false}
                className="tb-input tb-force"
                placeholder="Amount"
                onChange={(v) => setExpenseAmount(Number(v || 0))}
              />
              <button
                type="button"
                className="tb-addBtn"
                onClick={handleAddExpense}
              >
                <PlusOutlined /> Add
              </button>
            </div>
            <div className="tb-hint">
              Food, rides, activities — tap a category below to quick-add.
            </div>
          </div>
        </div>

        {/* ── Category quick-add chips ── */}
        <div className="tb-chips">
          {CATEGORY_PRESETS.map((cat) => (
            <button
              key={cat.label}
              type="button"
              className="tb-chip"
              onClick={() => handleCategoryAdd(cat.amount)}
              title={`Quick add $${cat.amount} for ${cat.label}`}
            >
              {cat.icon} {cat.label}
              <span className="tb-chipAmount">+${cat.amount}</span>
            </button>
          ))}
        </div>

        {/* ── Atlas Plan module ── */}
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
              {ai.hint && <div className="tb-aiHint">{ai.hint}</div>}
            </div>

            <div className="tb-aiActions">
              <button
                type="button"
                className="tb-pillBtn"
                onClick={() => startAtlas("optimize")}
                disabled={atlasThinking}
              >
                Optimize budget
              </button>
              <button
                type="button"
                className="tb-pillBtn"
                onClick={() => startAtlas("deal")}
                disabled={atlasThinking}
              >
                Find better deal
              </button>
              <button
                type="button"
                className="tb-pillBtnPrimary"
                onClick={() => startAtlas("surprise")}
                disabled={atlasThinking}
              >
                {atlasThinking ? "Atlas is thinking…" : "Surprise me ✨"}
              </button>
            </div>

            {/* Atlas thinking + typewriter bubble */}
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
        </div>
      </div>
    </Card>
  );
}