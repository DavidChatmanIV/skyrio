// ─────────────────────────────────────────────────────────────
// BudgetMeter — keeps "Plan on a budget" with you all the way to Pay.
//
// Like a speedometer: green while you're under, amber when you're close,
// red the moment the booking goes over. It never blocks booking; it just
// makes sure nobody goes over without noticing.
//
//   <BudgetMeter budget={750} total={790} what="This flight" />
// ─────────────────────────────────────────────────────────────
import React from "react";
import { Wallet, AlertTriangle } from "lucide-react";

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

const CSS = `
.sk-bm { padding: 12px 14px; border-radius: 14px; border: 1px solid; font-size: 13px; line-height: 1.45; color: #fff; text-align: left; }
.sk-bm--ok { background: rgba(52,211,153,.10); border-color: rgba(52,211,153,.35); }
.sk-bm--close { background: rgba(251,191,36,.10); border-color: rgba(251,191,36,.45); }
.sk-bm--over { background: rgba(248,113,113,.14); border-color: rgba(248,113,113,.6); animation: skBmPulse 1.6s ease-in-out 2; }
@keyframes skBmPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); } 50% { box-shadow: 0 0 0 4px rgba(248,113,113,.25); } }
.sk-bm__top { display: flex; align-items: center; justify-content: space-between; gap: 4px 10px; flex-wrap: wrap; }
.sk-bm__label { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; white-space: nowrap; }
.sk-bm__nums { font-weight: 800; white-space: nowrap; }
.sk-bm__bar { height: 8px; margin: 9px 0 7px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
.sk-bm__bar span { display: block; height: 100%; border-radius: inherit; transition: width .35s ease; }
.sk-bm--ok .sk-bm__bar span { background: #34d399; }
.sk-bm--close .sk-bm__bar span { background: #fbbf24; }
.sk-bm--over .sk-bm__bar span { background: #f87171; }
.sk-bm__msg { font-size: 12.5px; color: rgba(255,255,255,.85); }
.sk-bm--over .sk-bm__msg b { color: #fca5a5; }
@media (prefers-reduced-motion: reduce) { .sk-bm--over { animation: none; } }
`;

export default function BudgetMeter({
  budget,
  total,
  what = "This booking",
  style,
}) {
  const b = Number(budget);
  const t = Number(total);
  if (!(b > 0) || !Number.isFinite(t)) return null;

  const pct = (t / b) * 100;
  const left = b - t;
  const tone = pct > 100 ? "over" : pct >= 90 ? "close" : "ok";

  return (
    <div
      className={`sk-bm sk-bm--${tone}`}
      role={tone === "over" ? "alert" : "status"}
      aria-live="polite"
      style={style}
    >
      <style>{CSS}</style>
      <div className="sk-bm__top">
        <span className="sk-bm__label">
          {tone === "over" ? (
            <AlertTriangle size={15} color="#fca5a5" aria-hidden="true" />
          ) : (
            <Wallet
              size={15}
              color={tone === "close" ? "#fbbf24" : "#34d399"}
              aria-hidden="true"
            />
          )}
          Your budget
        </span>
        <span className="sk-bm__nums">
          {money(t)} of {money(b)}
        </span>
      </div>
      <div
        className="sk-bm__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(pct))}
        aria-label="Budget used"
      >
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="sk-bm__msg">
        {tone === "over" ? (
          <>
            <b>{money(-left)} over your budget.</b> {what} is more than the{" "}
            {money(b)} you planned. You can still book it.
          </>
        ) : tone === "close" ? (
          <>Almost at your budget: {money(left)} left.</>
        ) : (
          <>{money(left)} left in your budget.</>
        )}
      </div>
    </div>
  );
}
