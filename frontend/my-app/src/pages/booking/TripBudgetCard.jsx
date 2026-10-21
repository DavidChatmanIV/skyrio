import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Card, InputNumber, Select } from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Plane,
  Hotel,
  UtensilsCrossed,
  Car,
  Target,
  ShoppingBag,
  Pin,
} from "lucide-react";

import "../../styles/TripBudgetCard.css";

const { Option } = Select;

// ── Expense categories ────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  {
    key: "flights",
    label: "Flights",
    icon: <Plane size={13} />,
    color: "#7c5cfc",
  },
  { key: "hotel", label: "Hotel", icon: <Hotel size={13} />, color: "#00b8d9" },
  {
    key: "dining",
    label: "Dining",
    icon: <UtensilsCrossed size={13} />,
    color: "#ff8a2a",
  },
  {
    key: "transport",
    label: "Transport",
    icon: <Car size={13} />,
    color: "#36b37e",
  },
  {
    key: "activities",
    label: "Activities",
    icon: <Target size={13} />,
    color: "#ff5630",
  },
  {
    key: "shopping",
    label: "Shopping",
    icon: <ShoppingBag size={13} />,
    color: "#6554c0",
  },
  { key: "other", label: "Other", icon: <Pin size={13} />, color: "#8993a4" },
];

function getCategoryMeta(key) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.key === key) ??
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
  );
}

// ── AI budget insight ─────────────────────────────────────────
function buildAiSuggestion({ planned, spent, bookingTotal, tripDays }) {
  const p = Number(planned || 0);
  const s = Number(spent || 0) + Number(bookingTotal || 0);
  const left = p - s;

  if (!p) {
    return {
      title: "Set a budget and Atlas will pace the trip for you.",
      detail:
        "Most travelers budget $800–$1,500 for a week. Pick a number and I'll keep your spending on track.",
      hint: null,
      tone: "neutral",
    };
  }

  const days = tripDays ? Math.max(1, Number(tripDays)) : null;
  const perDay = days ? left / days : null;
  const dining = Math.round(p * 0.25);
  const transport = Math.round(p * 0.15);
  const activities = Math.round(p * 0.2);

  if (left < 0) {
    return {
      title: `$${Math.abs(left).toLocaleString()} over budget.`,
      detail: days
        ? `Cut about $${Math.ceil(
            Math.abs(left) / days
          ).toLocaleString()} per day for the rest of the trip.`
        : "Increase your budget or trim upcoming expenses.",
      hint: "Tap Optimize and Atlas will rebalance your spend.",
      tone: "danger",
    };
  }

  if (perDay !== null && perDay < 35) {
    return {
      title: "Tight pacing — but doable.",
      detail: `~$${Math.floor(
        perDay
      ).toLocaleString()} / day left. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Atlas can help you stretch this without sacrificing the experience.",
      tone: "warn",
    };
  }

  if (perDay !== null) {
    return {
      title: "You're on track.",
      detail: `~$${Math.floor(
        perDay
      ).toLocaleString()} / day remaining. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
      hint: "Want to find a better deal? Tap below.",
      tone: "ok",
    };
  }

  return {
    title: "Budget set — add your dates to pace it out.",
    detail: `You've budgeted $${p.toLocaleString()} total. Suggested split: Dining ~$${dining.toLocaleString()}, Transport ~$${transport.toLocaleString()}, Activities ~$${activities.toLocaleString()}.`,
    hint: "Select dates and Atlas will break this down day by day.",
    tone: "ok",
  };
}

// ── Typewriter ────────────────────────────────────────────────
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

const ATLAS_LINES = [
  "Atlas tip: lock your transport budget early — prices shift fast.",
  "Atlas pick: flexible check-in dates save 15–30% on hotels most weeks.",
  "Atlas move: book flights on Tuesday evenings for the best base fares.",
  "Atlas insight: dining out for lunch instead of dinner cuts food spend by ~40%.",
];

export default function TripBudgetCard({
  initialBookingTotal = 0,
  initialTripDays = null,
  initialDestination = "your destination",
  onStateChange,
}) {
  // ── Core budget state ──
  const [planned, setPlanned] = useState(null);
  const [bookingTotal, setBookingTotal] = useState(
    Number(initialBookingTotal) || 0
  );
  const [tripDays, setTripDays] = useState(
    initialTripDays ? Number(initialTripDays) : null
  );
  const [destination, setDestination] = useState(initialDestination);

  // ── Expense list state ──
  // Each expense: { id, label, amount, category }
  const [expenses, setExpenses] = useState([]);
  const [newAmount, setNewAmount] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("other");

  // ── Edit state ──
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCategory, setEditCategory] = useState("other");

  // ── Atlas state ──
  const [atlasThinking, setAtlasThinking] = useState(false);
  const [atlasReveal, setAtlasReveal] = useState(false);
  const [atlasLine, setAtlasLine] = useState("");
  const [atlasIdx, setAtlasIdx] = useState(0);

  // ── Sync props ──
  useEffect(() => {
    if (initialBookingTotal) setBookingTotal(Number(initialBookingTotal));
  }, [initialBookingTotal]);
  useEffect(() => {
    if (initialDestination) setDestination(initialDestination);
  }, [initialDestination]);
  useEffect(() => {
    if (initialTripDays != null) setTripDays(Number(initialTripDays));
  }, [initialTripDays]);

  // ── Notify parent ──
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  });
  const totalUsed = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );
  useEffect(() => {
    onStateChangeRef.current?.({
      planned,
      used: totalUsed,
      bookingTotal,
      tripDays,
    });
  }, [planned, totalUsed, bookingTotal, tripDays]);

  // ── Derived values ──
  const totalNum = useMemo(() => {
    const n = Number(planned);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [planned]);

  const hasBudget = totalNum > 0;
  const spent = useMemo(
    () => totalUsed + Number(bookingTotal || 0),
    [totalUsed, bookingTotal]
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
      buildAiSuggestion({
        planned: totalNum,
        spent: totalUsed,
        bookingTotal,
        tripDays,
      }),
    [totalNum, totalUsed, bookingTotal, tripDays]
  );

  const moodLabel = useMemo(() => {
    if (!hasBudget) return "Plan your budget";
    if (isOverBudget) return "Over budget";
    if (percent < 55) return "On track ✨";
    if (percent < 85) return "Keep it steady";
    return "Watch extras";
  }, [hasBudget, isOverBudget, percent]);

  const moodColor = isOverBudget ? "#ff6b85" : "#ffb347";

  // Only show a real destination on the pass — never the "your destination"
  // fallback dressed up as a city.
  const passDest =
    destination && destination !== "your destination" ? destination : null;

  // ── Atlas ──
  useEffect(() => {
    const t = window.setTimeout(() => {
      setAtlasLine(ATLAS_LINES[0]);
      setAtlasReveal(true);
    }, 350);
    return () => window.clearTimeout(t);
  }, []);

  const startAtlas = useCallback(() => {
    setAtlasReveal(false);
    setAtlasThinking(true);
    const next = (atlasIdx + 1) % ATLAS_LINES.length;
    setAtlasIdx(next);
    window.setTimeout(() => {
      setAtlasThinking(false);
      setAtlasReveal(true);
      setAtlasLine(ATLAS_LINES[next]);
    }, 650);
  }, [atlasIdx]);

  const { out: typedText, done: typingDone } = useTypewriter(atlasLine, {
    speed: 14,
    enabled: atlasReveal,
  });

  // ── Add expense ──
  const handleAddExpense = useCallback(() => {
    const amt = Number(newAmount || 0);
    if (!amt || amt <= 0) return;
    setExpenses((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        label: newLabel.trim() || getCategoryMeta(newCategory).label,
        amount: amt,
        category: newCategory,
      },
    ]);
    setNewAmount(null);
    setNewLabel("");
    setNewCategory("other");
  }, [newAmount, newLabel, newCategory]);

  // ── Delete expense ──
  const handleDelete = useCallback(
    (id) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) setEditingId(null);
    },
    [editingId]
  );

  // ── Start edit ──
  const handleStartEdit = useCallback((expense) => {
    setEditingId(expense.id);
    setEditAmount(expense.amount);
    setEditLabel(expense.label);
    setEditCategory(expense.category);
  }, []);

  // ── Save edit ──
  const handleSaveEdit = useCallback(() => {
    const amt = Number(editAmount || 0);
    if (!amt || amt <= 0) return;
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === editingId
          ? {
              ...e,
              amount: amt,
              label: editLabel.trim() || e.label,
              category: editCategory,
            }
          : e
      )
    );
    setEditingId(null);
  }, [editingId, editAmount, editLabel, editCategory]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setPlanned(null);
    setBookingTotal(Number(initialBookingTotal) || 0);
    setTripDays(initialTripDays ? Number(initialTripDays) : null);
    setExpenses([]);
    setNewAmount(null);
    setNewLabel("");
    setNewCategory("other");
    setEditingId(null);
  }, [initialBookingTotal, initialTripDays]);

  const categoryOption = (c) => (
    <Option key={c.key} value={c.key}>
      <span className="tb-catOption">
        {c.icon} {c.label}
      </span>
    </Option>
  );

  return (
    <Card
      variant="borderless"
      className={`tb-card tb-pass ${isOverBudget ? "is-overBudget" : ""}`}
    >
      {/* ── Pass band ── */}
      <div className="tb-band">
        <span className="tb-bandTitle">
          <Plane size={15} aria-hidden="true" /> Trip budget
        </span>
        <button
          type="button"
          className="tb-reset"
          onClick={handleReset}
          aria-label="Reset budget"
        >
          <ReloadOutlined /> Reset
        </button>
      </div>

      <div className="tb-bodyScroll">
        {/* ── Status ── */}
        <div className="tb-status">
          <div>
            <div className="tb-passLabel">Status</div>
            <div className="tb-mood" style={{ color: moodColor }}>
              {moodLabel}
            </div>
          </div>
          {passDest && (
            <div className="tb-destBlock">
              <div className="tb-passLabel">To</div>
              <div className="tb-dest" title={passDest}>
                {passDest}
              </div>
            </div>
          )}
        </div>

        {/* ── Budget + Nights ── */}
        <div className="tb-fieldRow">
          <label className="tb-field">
            <span className="tb-passLabel">Total budget</span>
            <InputNumber
              prefix="$"
              value={planned ?? null}
              min={0}
              step={50}
              controls={false}
              placeholder="e.g. 1500"
              onChange={(v) => setPlanned(v ?? null)}
              className="tb-input tb-force"
            />
          </label>
          <label className="tb-field">
            <span className="tb-passLabel">
              Nights{" "}
              {!tripDays && (
                <span className="tb-passLabelSub">(from dates)</span>
              )}
            </span>
            <InputNumber
              value={tripDays ?? undefined}
              min={1}
              max={90}
              step={1}
              controls={false}
              placeholder="—"
              onChange={(v) => setTripDays(v ? Number(v) : null)}
              className="tb-input tb-force"
            />
          </label>
        </div>

        {/* ── Spent / Left / Used ── */}
        {hasBudget && (
          <div className="tb-meterBlock">
            <div className="tb-stats">
              <div className="tb-stat">
                <span className="tb-passLabel">Spent</span>
                <span
                  className="tb-statVal"
                  style={isOverBudget ? { color: "#ff6b85" } : undefined}
                >
                  ${spent.toLocaleString()}
                </span>
              </div>
              <div className="tb-stat">
                <span className="tb-passLabel">
                  {isOverBudget ? "Over by" : "Left"}
                </span>
                <span className="tb-statVal" style={{ color: moodColor }}>
                  {isOverBudget ? "-" : ""}${Math.abs(left).toLocaleString()}
                </span>
              </div>
              <div className="tb-stat">
                <span className="tb-passLabel">Used</span>
                <span className="tb-statVal">{percent}%</span>
              </div>
            </div>
            <div
              className="tb-meter"
              role="progressbar"
              aria-label="Budget used"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`tb-meterFill ${isOverBudget ? "is-over" : ""}`}
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
          </div>
        )}

        <div className="tb-perf" aria-hidden="true" />

        {/* ── Add expense ── */}
        <div>
          <div className="tb-passLabel tb-sectionLabel">Add expense</div>

          <div className="tb-add-row">
            <InputNumber
              prefix="$"
              value={newAmount ?? null}
              min={0}
              step={5}
              controls={false}
              placeholder="Amount"
              aria-label="Expense amount"
              onChange={(v) => setNewAmount(Number(v || 0))}
              className="tb-input tb-force tb-amountInput"
            />
            <input
              className="tb-text-input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Expense description"
              onKeyDown={(e) => e.key === "Enter" && handleAddExpense()}
            />
          </div>

          <div className="tb-add-row">
            <Select
              value={newCategory}
              onChange={setNewCategory}
              className="tb-category-select"
              aria-label="Expense category"
              classNames={{ popup: { root: "tb-select-popup" } }}
            >
              {EXPENSE_CATEGORIES.map(categoryOption)}
            </Select>
            <button
              type="button"
              className="tb-addBtn"
              onClick={handleAddExpense}
              disabled={!newAmount || newAmount <= 0}
            >
              <PlusOutlined /> Add
            </button>
          </div>
        </div>

        {/* ── Expense list (receipt lines) ── */}
        {expenses.length > 0 && (
          <div className="tb-receipt">
            <div className="tb-passLabel tb-sectionLabel">
              Expenses
              <span className="tb-passLabelSub">
                {" "}
                ({expenses.length}) · ${totalUsed.toLocaleString()} total
              </span>
            </div>
            <div className="tb-expense-list">
              {expenses.map((expense) => {
                const meta = getCategoryMeta(expense.category);
                const isEditing = editingId === expense.id;

                if (isEditing) {
                  return (
                    <div
                      key={expense.id}
                      className="tb-expense-row tb-expense-row--editing"
                    >
                      <InputNumber
                        prefix="$"
                        value={editAmount ?? null}
                        min={0}
                        step={5}
                        controls={false}
                        aria-label="Edit amount"
                        onChange={(v) => setEditAmount(Number(v || 0))}
                        className="tb-input tb-force tb-edit-amount"
                      />
                      <input
                        className="tb-text-input tb-edit-label"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                        placeholder="Description"
                        aria-label="Edit description"
                        autoFocus
                      />
                      <Select
                        value={editCategory}
                        onChange={setEditCategory}
                        className="tb-category-select tb-category-select--sm"
                        aria-label="Edit category"
                        classNames={{ popup: { root: "tb-select-popup" } }}
                      >
                        {EXPENSE_CATEGORIES.map(categoryOption)}
                      </Select>
                      <div className="tb-expense-actions">
                        <button
                          type="button"
                          className="tb-icon-btn tb-icon-btn--save"
                          onClick={handleSaveEdit}
                          aria-label="Save"
                        >
                          <CheckOutlined />
                        </button>
                        <button
                          type="button"
                          className="tb-icon-btn tb-icon-btn--cancel"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                        >
                          <CloseOutlined />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={expense.id} className="tb-expense-row">
                    <span
                      className="tb-expense-dot"
                      style={{ "--tb-cat": meta.color }}
                      aria-hidden="true"
                    >
                      {meta.icon}
                    </span>
                    <span className="tb-expense-label" title={expense.label}>
                      {expense.label}
                    </span>
                    <span className="tb-expense-leader" aria-hidden="true" />
                    <span className="tb-expense-amount">
                      ${Number(expense.amount).toLocaleString()}
                    </span>
                    <div className="tb-expense-actions">
                      <button
                        type="button"
                        className="tb-icon-btn tb-icon-btn--edit"
                        onClick={() => handleStartEdit(expense)}
                        aria-label={`Edit ${expense.label}`}
                      >
                        <EditOutlined />
                      </button>
                      <button
                        type="button"
                        className="tb-icon-btn tb-icon-btn--delete"
                        onClick={() => handleDelete(expense.id)}
                        aria-label={`Delete ${expense.label}`}
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="tb-perf" aria-hidden="true" />

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

            <div className="tb-aiCopy">
              <div className="tb-aiTitle">{ai.title}</div>
              <div className="tb-aiDetail">{ai.detail}</div>
              {ai.hint && <div className="tb-aiHint">{ai.hint}</div>}
            </div>

            <div className="tb-aiActions">
              <button
                type="button"
                className="tb-pillBtn"
                onClick={startAtlas}
                disabled={atlasThinking}
              >
                {atlasThinking ? "Thinking…" : "Atlas tip"}
              </button>
            </div>

            {(atlasThinking || atlasReveal) && (
              <div
                className={`tb-novaBubble ${
                  atlasThinking ? "is-thinking" : atlasReveal ? "is-reveal" : ""
                }`}
                aria-live="polite"
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
                          Atlas is thinking…
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

        <div className="tb-barcode" aria-hidden="true" />
      </div>
    </Card>
  );
}
