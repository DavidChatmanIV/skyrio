// ─────────────────────────────────────────────────────────────
// BookingProgress — the "we're booking it" screen after payment.
//
// Airlines can take 30–60 seconds (sometimes longer) to confirm. A lone
// spinner made testers think something was wrong, so this says what's
// happening, how long it usually takes, and not to close the page.
//
//   <BookingProgress kind="flight" />   (or kind="hotel")
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const CSS = `
.bp-card { max-width: 460px; margin: 60px auto; padding: 28px 24px; border-radius: 20px; color: #fff; text-align: left;
  background: linear-gradient(160deg, rgba(74,40,112,.7) 0%, rgba(34,18,62,.8) 100%);
  border: 1px solid rgba(255,255,255,.16); box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 18px 44px rgba(12,4,28,.38); }
.bp-title { margin: 0 0 6px; font-size: 20px; font-weight: 800; }
.bp-sub { margin: 0 0 18px; font-size: 14px; line-height: 1.55; color: rgba(255,255,255,.78); }
.bp-steps { list-style: none; margin: 0 0 18px; padding: 0; display: grid; gap: 12px; }
.bp-step { display: flex; align-items: center; gap: 12px; font-size: 14.5px; color: rgba(255,255,255,.55); }
.bp-step.is-done { color: #fff; }
.bp-step.is-now { color: #fff; font-weight: 700; }
.bp-dot { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  border: 1.5px solid rgba(255,255,255,.25); }
.bp-step.is-done .bp-dot { background: #34d399; border-color: #34d399; color: #0d1f17; }
.bp-step.is-now .bp-dot { border-color: #ffb347; color: #ffb347; }
.bp-spin { animation: bpSpin 1s linear infinite; }
@keyframes bpSpin { to { transform: rotate(360deg); } }
.bp-note { padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5;
  background: rgba(255,179,71,.10); border: 1px solid rgba(255,179,71,.35); color: rgba(255,255,255,.9); }
.bp-time { margin-top: 12px; font-size: 12px; color: rgba(255,255,255,.55); }
@media (prefers-reduced-motion: reduce) { .bp-spin { animation: none; } }
`;

export default function BookingProgress({ kind = "flight" }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Keep the page open: warn if they try to leave mid-booking.
  useEffect(() => {
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const who = kind === "hotel" ? "hotel" : "airline";
  // Payment is already received when this screen shows. The middle step
  // is the real wait; the last one is what we're waiting for.
  const steps = [
    { label: "Payment received", state: "done" },
    {
      label: `Sending your booking to the ${who}`,
      state: secs < 4 ? "now" : "done",
    },
    {
      label: `Waiting for the ${who}'s confirmation`,
      state: secs < 4 ? "todo" : "now",
    },
  ];

  return (
    <div className="bp-card" role="status" aria-live="polite">
      <style>{CSS}</style>
      <h1 className="bp-title">
        Booking your {kind === "hotel" ? "stay" : "flight"}
      </h1>
      <p className="bp-sub">
        This usually takes <b>30 to 60 seconds</b>. The {who} has to confirm it
        on their end.
      </p>
      <ul className="bp-steps">
        {steps.map((s) => (
          <li key={s.label} className={`bp-step is-${s.state}`}>
            <span className="bp-dot" aria-hidden="true">
              {s.state === "done" ? (
                <Check size={15} strokeWidth={3} />
              ) : s.state === "now" ? (
                <Loader2 size={15} className="bp-spin" />
              ) : null}
            </span>
            {s.label}
          </li>
        ))}
      </ul>
      <div className="bp-note">
        Please keep this page open and don&rsquo;t refresh. You&rsquo;ll see
        your confirmation here, and we&rsquo;ll email it to you too.
      </div>
      <div className="bp-time">
        {secs < 60
          ? `${secs}s`
          : `Still working (${Math.floor(secs / 60)}m ${
              secs % 60
            }s). Sometimes ${who}s take a little longer; you won't be charged twice.`}
      </div>
    </div>
  );
}
