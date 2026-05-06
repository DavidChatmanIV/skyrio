import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Card, InputNumber } from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  CoffeeOutlined,
  CarOutlined,
  HomeOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import "../../styles/TripBudgetCard.css";

function buildAiSuggestion({ planned, used, bookingTotal, tripDays }) {
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
    };
  }

  const days = tripDays ? Math.max(1, Number(tripDays)) : null;
  const perDay = days ? left / days : null;
  const dining = Math.round(p * 0.25);
  const transport = Math.round(p * 0.15);
  const activities = Math.round(p * 0.2);

  if (left < 0) {
    const recoverPerDay = days ? Math.ceil(Math.abs(left) / days) : null;
    return {
      title: `You're $${Math.abs(left).toLocaleString()} over budget.`,
      detail: recoverPerDay
        ? `Cut about $${recoverPerDay.toLocaleString()} / day for extras.`
        : `Increase your budget or trim extras.`,
      hint: "Tap Optimize and I'll rebalance your split.",
      tone: "danger",
    };
  }

  if (perDay !== null && perDay < 35) {
    return {
      title: "Tight pacing — but doable.",
      detail: `~$${Math.floor(
        perDay
      ).toLocaleString()} / day for extras. Split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Atlas can help you stretch this without ruining the fun.",
      tone: "warn",
    };
  }

  if (perDay !== null && perDay < 80) {
    return {
      title: "You're on track.",
      detail: `~$${Math.floor(
        perDay
      ).toLocaleString()} / day remaining. Split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Want a better deal window? Tap Find better deal.",
      tone: "ok",
    };
  }

  if (perDay === null) {
    return {
      title: "Budget set — add your dates to pace it out.",
      detail: `You've budgeted $${p.toLocaleString()} total. Select dates and Atlas will break this down day by day.`,
      hint: `Split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      tone: "ok",
    };
  }

  return {
    title: "Comfortable pacing.",
    detail: `~$${Math.floor(
      perDay
    ).toLocaleString()} / day for extras. Split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
    hint: "Atlas can upgrade the experience without breaking budget.",
    tone: "great",
  };
}

function useTypewriter(text, { speed = 16, enabled = true } = {}) {
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

const CATEGORY_PRESETS = [
  { icon: <CoffeeOutlined />, label: "Dining", amount: 45 },
  { icon: <CarOutlined />, label: "Transport", amount: 25 },
  { icon: <HomeOutlined />, label: "Lodging", amount: 120 },
];

const TONE_COLORS = {
  neutral: "#7c5cfc",
  ok: "#00c9a7",
  great: "#00c9a7",
  warn: "#ff8a2a",
  danger: "#ff4d6d",
};

const ATLAS_SUGGESTIONS = [
  "Atlas thinks you should visit Kyoto instead — less rush, better value, and the nights hit different.",
  "Atlas pick: Lisbon. Beautiful views, great food, and surprisingly budget-friendly right now.",
  "Atlas move: fly into Osaka to save money, then train to Kyoto for the vibes.",
  'Atlas tip: lock your "extras" budget first — it\'s what keeps trips stress-free.',
];

export default function TripBudgetCard({
  initialBookingTotal = 0,
  initialTripDays = null,
  initialDestination = "your destination",
  onStateChange,
}) {
  const [planned, setPlanned] = useState(null);
  const [used, setUsed] = useState(0);
  const [bookingTotal, setBookingTotal] = useState(
    Number(initialBookingTotal) || 0
  );
  const [expenseAmount, setExpenseAmount] = useState(null);
  const [tripDays, setTripDays] = useState(
    initialTripDays ? Number(initialTripDays) : null
  );
  const [destination, setDestination] = useState(initialDestination);
  const [atlasThinking, setAtlasThinking] = useState(false);
  const [atlasReveal, setAtlasReveal] = useState(false);
  const [atlasLine, setAtlasLine] = useState("");
  const [atlasVariant, setAtlasVariant] = useState(0);

  useEffect(() => {
    if (initialBookingTotal) setBookingTotal(Number(initialBookingTotal));
  }, [initialBookingTotal]);
  useEffect(() => {
    if (initialDestination) setDestination(initialDestination);
  }, [initialDestination]);
  useEffect(() => {
    if (initialTripDays !== null && initialTripDays !== undefined)
      setTripDays(Number(initialTripDays));
  }, [initialTripDays]);

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  });
  useEffect(() => {
    onStateChangeRef.current?.({ planned, used, bookingTotal, tripDays });
  }, [planned, used, bookingTotal, tripDays]);

  const totalNum = useMemo(() => {
    const n = Number(planned);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [planned]);

  const hasBudget = totalNum > 0;
  const hasNights = tripDays !== null && tripDays > 0;
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

  const moodLabel = useMemo(() => {
    if (!hasBudget) return "Plan your budget";
    if (isOverBudget) return "Over budget";
    if (percent < 55) return "On track ✨";
    if (percent < 85) return "Keep it steady";
    return "Watch extras";
  }, [hasBudget, isOverBudget, percent]);

  const moodColor = isOverBudget
    ? "#ff4d6d"
    : hasBudget && percent > 84
    ? "#ff8a2a"
    : "#00c9a7";

  const currentAtlasText = useMemo(() => {
    if (!hasBudget) return `You're planning ${destination}. ${ai.detail}`;
    return ATLAS_SUGGESTIONS[atlasVariant % ATLAS_SUGGESTIONS.length];
  }, [hasBudget, destination, ai.detail, atlasVariant]);

  const startAtlas = useCallback(
    (mode = "surprise") => {
      setAtlasReveal(false);
      setAtlasThinking(true);
      const nextIdx =
        (atlasVariant + (mode === "deal" ? 2 : 1)) % ATLAS_SUGGESTIONS.length;
      setAtlasVariant(nextIdx);
      window.setTimeout(() => {
        setAtlasThinking(false);
        setAtlasReveal(true);
        setAtlasLine(
          hasBudget
            ? ATLAS_SUGGESTIONS[nextIdx]
            : `You're planning ${destination}. ${ai.detail}`
        );
      }, 650);
    },
    [atlasVariant, hasBudget, destination, ai.detail]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      setAtlasLine(currentAtlasText);
      setAtlasReveal(true);
    }, 350);
    return () => window.clearTimeout(t);
  }, []);

  const { out: typedText, done: typingDone } = useTypewriter(atlasLine, {
    speed: 14,
    enabled: atlasReveal,
  });

  const handleReset = useCallback(() => {
    setPlanned(null);
    setUsed(0);
    setBookingTotal(Number(initialBookingTotal) || 0);
    setExpenseAmount(null);
    setTripDays(initialTripDays ? Number(initialTripDays) : null);
  }, [initialBookingTotal, initialTripDays]);

  const handleAddExpense = useCallback(() => {
    const amt = Number(expenseAmount || 0);
    if (!amt || amt <= 0) return;
    setUsed((prev) => prev + amt);
    setExpenseAmount(null);
  }, [expenseAmount]);

  const handleCategoryAdd = useCallback((amount) => {
    setUsed((prev) => prev + amount);
  }, []);

  return (
    <Card
      variant="borderless"
      className={`tb-card ${isOverBudget ? "is-overBudget" : ""}`}
    >
      <div className="tb-bodyScroll">
        {/* ── Header ── */}
        <div className="tb-topBar">
          <div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Trip Budget
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: moodColor }}>
              {moodLabel}
            </div>
          </div>
          <button
            type="button"
            className="tb-reset"
            onClick={handleReset}
            aria-label="Reset"
          >
            <ReloadOutlined /> Reset
          </button>
        </div>

        {/* ── Budget + Nights inputs ── */}
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="tb-fieldLabel">Total Budget</div>
            <InputNumber
              prefix="$"
              value={planned ?? null}
              min={0}
              step={50}
              controls={false}
              placeholder="e.g. 1200"
              onChange={(v) => setPlanned(v ?? null)}
              className="tb-input tb-force"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tb-fieldLabel">
              Nights{" "}
              {!hasNights && (
                <span style={{ opacity: 0.4, fontSize: 10 }}>(from dates)</span>
              )}
            </div>
            <InputNumber
              value={tripDays ?? undefined}
              min={1}
              max={90}
              step={1}
              controls={false}
              placeholder="—"
              onChange={(v) => setTripDays(v ? Number(v) : null)}
              className="tb-input tb-force"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              height: 7,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 7,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, percent)}%`,
                background: isOverBudget
                  ? "linear-gradient(90deg, #ff4d6d, #ff8a2a)"
                  : "linear-gradient(90deg, #ff8a2a, #ffb066)",
                borderRadius: 99,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span>
              Spent:{" "}
              <span
                style={{
                  color: isOverBudget ? "#ff4d6d" : "rgba(255,255,255,0.7)",
                  fontWeight: 600,
                }}
              >
                ${spent.toLocaleString()}
              </span>
            </span>
            {hasBudget && (
              <span>
                {isOverBudget ? "Over by" : "Left"}:{" "}
                <span style={{ color: moodColor, fontWeight: 700 }}>
                  {isOverBudget ? "-" : ""}${Math.abs(left).toLocaleString()}
                </span>
              </span>
            )}
            {hasBudget && <span>{percent}%</span>}
          </div>
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.07)",
            margin: "14px 0",
          }}
        />

        {/* ── Expense tracker ── */}
        <div>
          <div className="tb-fieldLabel">Track Expense</div>
          <div className="tb-add-row" style={{ marginBottom: 10 }}>
            <InputNumber
              prefix="$"
              value={expenseAmount ?? null}
              min={0}
              step={10}
              controls={false}
              placeholder="Amount"
              onChange={(v) => setExpenseAmount(Number(v || 0))}
              className="tb-input tb-force"
              style={{ width: "100%" }}
            />
            <button
              type="button"
              className="tb-addBtn"
              onClick={handleAddExpense}
            >
              <PlusOutlined /> Add
            </button>
          </div>
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
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.07)",
            margin: "14px 0",
          }}
        />

        {/* ── Atlas Plan ── */}
        <div className="tb-stack">
          <div className={`tb-ai tone-${ai.tone || "neutral"}`}>
            <div className="tb-aiTop">
              <div className="tb-aiBadge">
                <ThunderboltOutlined />
                <span>Atlas Plan</span>
              </div>
              <div
                className={`tb-novaSpark ${
                  atlasThinking || (atlasReveal && !typingDone) ? "is-on" : ""
                }`}
              >
                <span className="tb-novaDot" />
                <span>Atlas</span>
              </div>
            </div>

            {/* AI insight */}
            <div className="tb-aiCopy">
              <div className="tb-aiTitle">{ai.title}</div>
              <div className="tb-aiDetail">{ai.detail}</div>
              {ai.hint && <div className="tb-aiHint">{ai.hint}</div>}
            </div>

            {/* Action buttons */}
            <div className="tb-aiActions">
              <button
                type="button"
                className="tb-pillBtn"
                onClick={() => startAtlas("optimize")}
                disabled={atlasThinking}
              >
                Optimize
              </button>
              <button
                type="button"
                className="tb-pillBtn"
                onClick={() => startAtlas("deal")}
                disabled={atlasThinking}
              >
                Better deal
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

            {/* Atlas bubble */}
            {(atlasThinking || atlasReveal) && (
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
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
