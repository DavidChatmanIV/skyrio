// "Your trip" tracker for Sync Together. One glance shows:
//   • Flight / Stay / Things to do — booked or not, and what each cost
//   • Your private budget: booked so far, what's left (a progress meter)
//   • The next thing to do, as one button
// Used on the trip page (above the shortlist) and above Flights / Stays
// search results. On search results it also sorts what fits first.
import { useState } from "react";
import {
  Wallet,
  ChevronDown,
  Plane,
  BedDouble,
  Ticket,
  Check,
  ArrowRight,
} from "lucide-react";
import { money, saveTripBudget, BUDGET_HOW_IT_WORKS } from "@/utils/tripBudget";
import "@/styles/trip-budget.css";

const STEPS = [
  { kind: "flight", title: "Flight", icon: Plane, find: "Find flights" },
  { kind: "stay", title: "Stay", icon: BedDouble, find: "Find stays" },
  {
    kind: "activity",
    title: "Things to do",
    icon: Ticket,
    find: "Find activities",
  },
];

export default function TripBudgetBar({
  groupId,
  tb, // from tripBudgetFrom()
  kind = "flights", // the tab you're on: "flights" | "stays" | "activities" | null (trip page)
  destination,
  activityIdeas = 0, // activities on the group shortlist
  overCount = 0,
  noneFit = false,
  showingOver = false,
  onToggleOver,
  onFind, // (kind: "flight" | "stay" | "activity") => void
  onSaved, // ({ myBudget, budgetSummary }) => void
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showHow, setShowHow] = useState(false);

  const booked = tb?.booked || [];
  const byKind = (k) => booked.filter((b) => b.kind === k);
  const current =
    kind === "stays"
      ? "stay"
      : kind === "flights"
      ? "flight"
      : kind === "activities"
      ? "activity"
      : null;

  // Status of each step
  const steps = STEPS.map((s) => {
    const items =
      s.kind === "activity"
        ? booked.filter((b) => b.kind === "activity" || b.kind === "other")
        : byKind(s.kind);
    const done = items.length > 0;
    const amount = items.reduce((sum, x) => sum + (x.amount || 0), 0);
    const detail = done
      ? items.length === 1
        ? items[0].label
        : `${items.length} booked`
      : s.kind === "activity"
      ? activityIdeas > 0
        ? `Optional · ${activityIdeas} on the shortlist`
        : "Optional"
      : "Not booked yet";
    return { ...s, items, done, amount, detail };
  });
  const required = steps.filter((s) => s.kind !== "activity");
  const doneCount = required.filter((s) => s.done).length;
  const next = required.find((s) => !s.done) || null;

  const openEditor = () => {
    setDraft(
      tb?.budget ? String(tb.budget).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
    );
    setError("");
    setEditing(true);
  };
  const save = async (e) => {
    e?.preventDefault();
    const n = Number(String(draft).replace(/[^\d]/g, "")) || null;
    setSaving(true);
    setError("");
    try {
      const data = await saveTripBudget(groupId, n);
      onSaved?.(data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const things =
    current === "stay"
      ? "rooms"
      : current === "activity"
      ? "activities"
      : "flights";
  const thing =
    current === "stay"
      ? "room"
      : current === "activity"
      ? "activity"
      : "flight";
  const pct = tb?.set
    ? Math.min(100, Math.round((tb.spent / tb.budget) * 100))
    : 0;
  const over = tb?.set && tb.spent > tb.budget ? tb.spent - tb.budget : 0;

  return (
    <section className="tbb" aria-label="Your trip progress">
      {/* ── Header ── */}
      <div className="tbb-head">
        <div>
          <div className="tbb-eyebrow">
            Your trip{destination ? ` · ${destination}` : ""}
          </div>
          <div className="tbb-title">
            {doneCount === required.length
              ? "You're all booked 🎉"
              : `Your bookings: ${doneCount} of ${required.length}`}
          </div>
          {doneCount < required.length && (
            <div className="tbb-sub" style={{ marginTop: 2 }}>
              {required
                .map((s) =>
                  `${s.title.toLowerCase()} ${s.done ? "✓" : ""}`.trim()
                )
                .join(" + ")}
            </div>
          )}
        </div>
        {next && onFind && current !== next.kind && (
          <button
            type="button"
            className="tbb-next"
            onClick={() => onFind(next.kind)}
          >
            Next: book your {next.kind === "flight" ? "flight" : "stay"}
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      {/* ── Flight / Stay / Things to do ── */}
      <ol className="tbb-steps">
        {steps.map((s) => {
          const Icon = s.icon;
          const here = current === s.kind;
          return (
            <li
              key={s.kind}
              className={`tbb-step${s.done ? " is-done" : ""}${
                here ? " is-here" : ""
              }`}
            >
              <span className="tbb-step-icon" aria-hidden="true">
                {s.done ? (
                  <Check size={15} strokeWidth={3} />
                ) : (
                  <Icon size={15} />
                )}
              </span>
              <span className="tbb-step-body">
                <span className="tbb-step-title">
                  {s.title}
                  {here && <span className="tbb-here">You're here</span>}
                </span>
                <span className="tbb-step-detail" title={s.detail}>
                  {s.detail}
                </span>
                {s.items.length > 1 &&
                  s.items.map((x) => (
                    <span key={x.id} className="tbb-step-item">
                      <span title={x.label}>{x.label}</span>
                      <span>{money(x.amount)}</span>
                    </span>
                  ))}
              </span>
              <span className="tbb-step-end">
                {s.amount > 0 ? (
                  <span className="tbb-step-amt">{money(s.amount)}</span>
                ) : !s.done && !here && onFind ? (
                  <button
                    type="button"
                    className="tbb-step-find"
                    onClick={() => onFind(s.kind)}
                  >
                    {s.find}
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ── Budget ── */}
      <div className="tbb-budget">
        <div className="tbb-budget-row">
          <span className="tbb-icon" aria-hidden="true">
            <Wallet size={15} />
          </span>
          <div className="tbb-text">
            {!tb?.set ? (
              <div className="tbb-headline">
                Set a trip budget to see what fits first.{" "}
                <span className="tbb-sub-inline">Only you see it.</span>
              </div>
            ) : (
              <>
                <div className="tbb-headline">
                  {over ? (
                    <>
                      <strong>{money(over)}</strong> over your{" "}
                      {money(tb.budget)} budget
                    </>
                  ) : tb.usedUp ? (
                    <>You've used your full {money(tb.budget)}</>
                  ) : (
                    <>
                      <strong>{money(tb.left)}</strong> left of{" "}
                      {money(tb.budget)}
                    </>
                  )}
                </div>
                <div
                  className={`tbb-meter${over ? " is-over" : ""}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={tb.budget}
                  aria-valuenow={tb.spent}
                  aria-label="Trip budget used"
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="tbb-sub">
                  {money(tb.spent)} booked so far
                  {(current === "flight" || current === "stay") &&
                    !noneFit &&
                    " · showing what fits first"}
                </div>
              </>
            )}
            {noneFit && (
              <div className="tbb-sub tbb-warn">
                None of these {things} fit what's left, so we're showing them
                all. Each one says how much over it is.
              </div>
            )}
          </div>
          {!editing && (
            <button type="button" className="tbb-btn" onClick={openEditor}>
              {tb?.set ? "Adjust" : "Set budget"}
            </button>
          )}
        </div>

        {editing && (
          <form className="tbb-edit" onSubmit={save}>
            <span className="tbb-currency">$</span>
            <input
              autoFocus
              inputMode="numeric"
              placeholder="1,500"
              value={draft}
              onChange={(e) =>
                setDraft(
                  e.target.value
                    .replace(/[^\d]/g, "")
                    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                )
              }
              aria-label="Your trip budget per person"
            />
            <span className="tbb-per">/person, whole trip</span>
            <button type="submit" className="tbb-save" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="tbb-cancel"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            {error && <div className="tbb-error">{error}</div>}
          </form>
        )}

        {overCount > 0 && (
          <button type="button" className="tbb-over" onClick={onToggleOver}>
            {showingOver
              ? `Hide the ${overCount} ${
                  overCount === 1 ? thing : things
                } over your budget`
              : `${overCount} more ${
                  overCount === 1 ? thing : things
                } over your budget · Show`}
          </button>
        )}
      </div>

      <button
        type="button"
        className="tbb-how-toggle"
        onClick={() => setShowHow((v) => !v)}
        aria-expanded={showHow}
      >
        How this works
        <ChevronDown
          size={13}
          style={{ transform: showHow ? "rotate(180deg)" : "none" }}
        />
      </button>
      {showHow && (
        <ul className="tbb-how">
          <li>
            <strong>Book your own part.</strong> Everyone books and pays for
            their own flight and stay. Each one checks off here once it's
            booked.
          </li>
          {BUDGET_HOW_IT_WORKS.map(([b, t]) => (
            <li key={b}>
              <strong>{b}</strong> {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
