// The budget bar above Flights / Stays results on a Sync Together trip.
// Shows what's left, sorts what fits first, and lets the traveler adjust
// their private budget right here.
import { useState } from "react";
import { Wallet, ChevronDown } from "lucide-react";
import { money, saveTripBudget, BUDGET_HOW_IT_WORKS } from "@/utils/tripBudget";
import "@/styles/trip-budget.css";

export default function TripBudgetBar({
  groupId,
  tb, // from tripBudgetFrom()
  kind = "flights", // "flights" | "stays"
  overCount = 0,
  noneFit = false,
  showingOver = false,
  onToggleOver,
  onSaved, // ({ myBudget, budgetSummary }) => void
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showHow, setShowHow] = useState(false);

  const openEditor = () => {
    setDraft(tb?.budget ? String(tb.budget) : "");
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

  const things = kind === "stays" ? "rooms" : "flights";

  let headline;
  let sub = null;
  if (!tb?.set) {
    headline = "Set a trip budget to see what fits first.";
    sub = "Only you see it.";
  } else if (tb.usedUp) {
    headline = `You've booked your full ${money(
      tb.budget
    )}. Anything else is extra.`;
  } else {
    headline = (
      <>
        <strong>{money(tb.left)}</strong> left in your trip budget
        {noneFit ? "" : " · showing what fits first"}
      </>
    );
    if (tb.spent > 0)
      sub = `${money(tb.spent)} booked so far of ${money(tb.budget)}`;
  }

  return (
    <div className="tbb" role="region" aria-label="Your trip budget">
      <div className="tbb-row">
        <span className="tbb-icon" aria-hidden="true">
          <Wallet size={16} />
        </span>
        <div className="tbb-text">
          <div className="tbb-headline">{headline}</div>
          {sub && <div className="tbb-sub">{sub}</div>}
          {noneFit && (
            <div className="tbb-sub tbb-warn">
              None of these {things} fit what's left, so we're showing them all.
              Each one says how much over it is.
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
            ? `Hide the ${overCount} ${things} over your budget`
            : `${overCount} more ${things} over your budget · Show`}
        </button>
      )}

      <button
        type="button"
        className="tbb-how-toggle"
        onClick={() => setShowHow((v) => !v)}
        aria-expanded={showHow}
      >
        How your budget works
        <ChevronDown
          size={13}
          style={{ transform: showHow ? "rotate(180deg)" : "none" }}
        />
      </button>
      {showHow && (
        <ul className="tbb-how">
          {BUDGET_HOW_IT_WORKS.map(([b, t]) => (
            <li key={b}>
              <strong>{b}</strong> {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
