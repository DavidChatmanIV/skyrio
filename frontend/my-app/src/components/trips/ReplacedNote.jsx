// After booking a lower fare: what happened to the old ticket, in plain
// words, from the server's answer ({ status, refund }).
import { Check, AlertTriangle, Loader2 } from "lucide-react";

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

export function replacedText(r) {
  if (!r) return null;
  switch (r.status) {
    case "cancelled":
      return {
        tone: "ok",
        text: `Your old ticket is cancelled.${
          r.refund > 0 ? ` ${money(r.refund)} is on its way back to your card (usually 5–10 business days).` : ""
        }`,
      };
    case "pending":
      return {
        tone: "wait",
        text: "We've asked the airline to cancel your old ticket. That can take a few hours to a couple of days. We'll email you when it's final.",
      };
    case "retry":
      return { tone: "wait", text: "We're finishing cancelling your old ticket and will email you when it's done." };
    case "fee":
      return {
        tone: "warn",
        text: "Your old ticket was kept: the airline no longer refunds it in full. You now have two bookings. Open My Trips to choose which to keep.",
      };
    default:
      return { tone: "warn", text: "Your old ticket is still active. Open it in My Trips to see your options." };
  }
}

export default function ReplacedNote({ replaced }) {
  const t = replacedText(replaced);
  if (!t) return null;
  const Icon = t.tone === "ok" ? Check : t.tone === "wait" ? Loader2 : AlertTriangle;
  const color = t.tone === "ok" ? "#6ee7a8" : t.tone === "wait" ? "#c4b5fd" : "#ffb347";
  return (
    <div
      role="status"
      data-testid="replaced-note"
      style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 14, lineHeight: 1.5 }}
    >
      <Icon size={16} style={{ color, flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
      <span>{t.text}</span>
    </div>
  );
}
