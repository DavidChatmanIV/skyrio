// A soft check before paying, shown only when this booking would take the
// traveler over their private trip budget. Never blocks: "Book anyway"
// continues as-is, or they can raise the budget in one tap.
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { money, saveTripBudget } from "@/utils/tripBudget";
import "@/styles/trip-budget.css";

export function overBudgetBy(total, tb) {
  if (!tb?.set) return 0;
  const t = Number(total);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.round(t - tb.left));
}

export default function OverBudgetCheck({
  total,
  tb,
  groupId,
  onBudgetSaved,
  onProceed,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const over = overBudgetBy(total, tb);
  if (!over) return null;
  const raiseTo = Math.ceil((tb.spent + Number(total)) / 10) * 10;

  const raise = async () => {
    setSaving(true);
    setError("");
    try {
      const data = await saveTripBudget(groupId, raiseTo);
      onBudgetSaved?.(data);
      onProceed();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="obc" role="status">
      <div className="obc-title">
        <AlertTriangle size={16} /> This puts you {money(over)} over your{" "}
        {money(tb.budget)} trip budget
      </div>
      <div className="obc-body">
        {tb.spent > 0
          ? `You've booked ${money(tb.spent)} on this trip so far. `
          : ""}
        That's okay. Nothing is blocked. Your budget is private and only helps
        you see what fits.
      </div>
      <div className="obc-actions">
        <button type="button" className="obc-go" onClick={onProceed}>
          Book anyway
        </button>
        <button
          type="button"
          className="obc-raise"
          onClick={raise}
          disabled={saving}
        >
          {saving ? "Saving…" : `Raise budget to ${money(raiseTo)}`}
        </button>
      </div>
      {error && <div className="obc-error">{error}</div>}
    </div>
  );
}
