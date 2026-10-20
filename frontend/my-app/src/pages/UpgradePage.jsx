/**
 * UpgradePage.jsx
 * Route: /upgrade?plan=explorer|legend&billing=monthly|annual
 * Sends the user to Stripe Checkout to pay for a membership.
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRightOutlined, ArrowLeftOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../auth/useAuth";
import {
  startCheckout,
  openBillingPortal,
  getBillingStatus,
  PLAN_NAMES,
} from "@/lib/membershipApi";

const PLANS = {
  explorer: {
    name: "Explorer",
    price: { monthly: 7, annual: 55 },
    monthlyEquiv: 4.58,
    monthlySaving: 29,
    color: "#ff8a2a",
    glow: "rgba(255,138,42,0.15)",
    border: "rgba(255,138,42,0.35)",
    textColor: "#1a0d04",
    description: "Unlimited trips, priority Atlas AI, 2× XP and more.",
  },
  legend: {
    name: "Legend",
    price: { monthly: 15, annual: 144 },
    monthlyEquiv: 12,
    monthlySaving: 36,
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.15)",
    border: "rgba(167,139,250,0.35)",
    textColor: "#fff",
    description:
      "The full Skyrio experience — concierge planning, 5× XP, direct founder access.",
  },
};

const CSS = `
  .up-wrap { min-height: 80vh; display: flex; align-items: center; justify-content: center;
    padding: 48px 24px; font-family: 'DM Sans', sans-serif; }
  .up-card { max-width: 500px; width: 100%; text-align: center; }
  .up-badge { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px;
    padding: 6px 20px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em;
    text-transform: uppercase; margin-bottom: 28px; border: 1px solid; }
  .up-title { font-family: 'Syne', sans-serif; font-size: clamp(28px, 5vw, 44px); font-weight: 800;
    color: #fff; margin: 0 0 14px; line-height: 1.1; letter-spacing: -0.02em; }
  .up-sub { font-size: 15px; color: rgba(255,255,255,0.52); line-height: 1.65;
    margin: 0 auto 28px; max-width: 380px; }
  .up-toggle { display: inline-flex; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 4px; margin-bottom: 20px; }
  .up-toggle button { padding: 7px 20px; border-radius: 999px; border: none; cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 600; background: transparent;
    color: rgba(255,255,255,0.45); transition: all 0.2s; }
  .up-toggle button.on { color: #1a0d04; background: linear-gradient(135deg, #ff8a2a, #ffb347); }
  .up-price-box { border-radius: 20px; padding: 28px 32px; border: 1px solid; margin-bottom: 24px; }
  .up-price-label { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
  .up-price { font-family: 'Syne', sans-serif; font-size: 56px; font-weight: 800; color: #fff; line-height: 1; }
  .up-price sup { font-size: 26px; vertical-align: top; margin-top: 11px; display: inline-block; }
  .up-price-per { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.5); margin-top: 6px; }
  .up-price-sub { font-size: 14px; color: rgba(255,255,255,0.35); margin-top: 4px; }
  .up-price-nudge { font-size: 13px; font-weight: 600; margin-top: 6px; }
  .up-msg { border-radius: 14px; padding: 14px 18px; font-size: 13.5px; line-height: 1.55;
    margin-bottom: 20px; text-align: left; }
  .up-msg--info { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7); }
  .up-msg--warn { background: rgba(255,138,42,0.1); border: 1px solid rgba(255,138,42,0.3); color: #ffd2ad; }
  .up-msg--error { background: rgba(255,77,79,0.1); border: 1px solid rgba(255,77,79,0.35); color: #ffb3b4; }
  .up-msg code { color: #fff; font-weight: 700; }
  .up-btns { display: flex; flex-direction: column; gap: 12px; }
  .up-btn-primary { width: 100%; padding: 15px 0; border-radius: 999px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: filter 0.18s, transform 0.18s, opacity 0.18s; }
  .up-btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
  .up-btn-primary:disabled { opacity: 0.6; cursor: wait; }
  .up-btn-ghost { width: 100%; padding: 13px 0; border-radius: 999px; background: transparent;
    border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5);
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background 0.18s, color 0.18s; }
  .up-btn-ghost:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
  .up-fine { font-size: 12px; color: rgba(255,255,255,0.38); line-height: 1.6; margin-top: 18px; }
  .up-fine svg { margin-right: 4px; }
`;

export default function UpgradePage() {
  const nav = useNavigate();
  const { isAuthed } = useAuth();
  const [params, setParams] = useSearchParams();

  const planKey = PLANS[params.get("plan")] ? params.get("plan") : "explorer";
  const billing = params.get("billing") === "annual" ? "annual" : "monthly";
  const canceled = params.get("checkout") === "canceled";
  const isAnnual = billing === "annual";
  const plan = PLANS[planKey];

  const [status, setStatus] = useState(null); // from /api/billing/status
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthed) return;
    getBillingStatus()
      .then(setStatus)
      .catch(() => {});
  }, [isAuthed]);

  const hasPaidSub = !!status?.subscription?.entitled;

  function setBilling(next) {
    const p = new URLSearchParams(params);
    p.set("billing", next);
    p.delete("checkout");
    setParams(p, { replace: true });
  }

  async function goToCheckout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { url } = await startCheckout(planKey, billing);
      window.location.assign(url);
    } catch (err) {
      if (err.code === "already_subscribed") {
        setStatus((s) => ({ ...(s || {}), subscription: { ...(s?.subscription || {}), entitled: true } }));
      }
      setError(err.message || "Couldn't start checkout. Please try again.");
      setBusy(false);
    }
  }

  async function goToPortal() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { url } = await openBillingPortal();
      window.location.assign(url);
    } catch (err) {
      setError(err.message || "Couldn't open billing. Please try again.");
      setBusy(false);
    }
  }

  const priceText = isAnnual ? `$${plan.price.annual}/yr` : `$${plan.price.monthly}/mo`;

  return (
    <div className="up-wrap">
      <style>{CSS}</style>

      <div className="up-card">
        <div
          className="up-badge"
          style={{ color: plan.color, background: plan.glow, borderColor: plan.border }}
        >
          ✦ {plan.name} Plan
        </div>

        <h1 className="up-title">Upgrade to {plan.name}</h1>
        <p className="up-sub">{plan.description}</p>

        <div className="up-toggle">
          <button className={!isAnnual ? "on" : ""} onClick={() => setBilling("monthly")}>
            Monthly
          </button>
          <button className={isAnnual ? "on" : ""} onClick={() => setBilling("annual")}>
            Annual
          </button>
        </div>

        <div className="up-price-box" style={{ background: plan.glow, borderColor: plan.border }}>
          <div className="up-price-label">
            {isAnnual ? "Billed once per year" : "Billed every month"}
          </div>
          {isAnnual ? (
            <>
              <div className="up-price"><sup>$</sup>{plan.price.annual}</div>
              <div className="up-price-per">/yr</div>
              <div className="up-price-sub">(${plan.monthlyEquiv}/mo)</div>
              <div className="up-price-nudge" style={{ color: plan.color }}>
                saves ${plan.monthlySaving} vs paying monthly
              </div>
            </>
          ) : (
            <>
              <div className="up-price"><sup>$</sup>{plan.price.monthly}</div>
              <div className="up-price-per">/mo</div>
              <div className="up-price-nudge" style={{ color: plan.color }}>
                or ${plan.price.annual}/yr — save ${plan.monthlySaving}
              </div>
            </>
          )}
        </div>

        {canceled && !error && (
          <div className="up-msg up-msg--warn">
            Checkout was canceled — you weren't charged. Pick up where you left off anytime.
          </div>
        )}

        {hasPaidSub && (
          <div className="up-msg up-msg--info">
            You're already a <b>{PLAN_NAMES[status?.plan] || "paid"}</b> member. Switch plans,
            change billing or cancel in Manage billing — Stripe prorates the difference.
          </div>
        )}

        {error && <div className="up-msg up-msg--error">{error}</div>}

        {import.meta.env.DEV && isAuthed && !hasPaidSub && (
          <div className="up-msg up-msg--info">
            Test mode: use card <code>4242 4242 4242 4242</code>, any future date, any CVC.
          </div>
        )}

        <div className="up-btns">
          {!isAuthed ? (
            <>
              <button
                className="up-btn-primary"
                style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}bb)`, color: plan.textColor }}
                onClick={() => nav(`/register?plan=${planKey}&billing=${billing}`)}
              >
                Create an account to continue <ArrowRightOutlined />
              </button>
              <button className="up-btn-ghost" onClick={() => nav("/login")}>
                I already have an account
              </button>
            </>
          ) : hasPaidSub ? (
            <button
              className="up-btn-primary"
              style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}bb)`, color: plan.textColor }}
              onClick={goToPortal}
              disabled={busy}
            >
              {busy ? "Opening…" : "Manage billing"} <ArrowRightOutlined />
            </button>
          ) : (
            <button
              className="up-btn-primary"
              style={{
                background: `linear-gradient(135deg, ${plan.color}, ${plan.color}bb)`,
                color: plan.textColor,
                boxShadow: `0 8px 28px ${plan.glow}`,
              }}
              onClick={goToCheckout}
              disabled={busy}
            >
              {busy ? "Opening secure checkout…" : `Continue to checkout — ${priceText}`}{" "}
              <ArrowRightOutlined />
            </button>
          )}

          <button className="up-btn-ghost" onClick={() => nav("/membership")}>
            <ArrowLeftOutlined /> Back to plans
          </button>
        </div>

        {isAuthed && !hasPaidSub && (
          <p className="up-fine">
            <LockOutlined />
            Payment is handled by Stripe — Skyrio never sees your card number. Your {plan.name}{" "}
            membership renews automatically at {priceText} until you cancel. Cancel anytime in
            Manage billing; you keep access until the end of the period you paid for.
          </p>
        )}
      </div>
    </div>
  );
}
