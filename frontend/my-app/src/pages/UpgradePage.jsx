/**
 * UpgradePage.jsx
 * Route: /upgrade?plan=explorer|legend&billing=monthly|annual
 */

import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRightOutlined, ArrowLeftOutlined } from "@ant-design/icons";

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
    monthlyEquiv: 12.0,
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
  .up-wrap {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    font-family: 'DM Sans', sans-serif;
  }
  .up-card {
    max-width: 500px;
    width: 100%;
    text-align: center;
  }
  .up-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 6px 20px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 28px;
    border: 1px solid;
  }
  .up-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(28px, 5vw, 44px);
    font-weight: 800;
    color: #fff;
    margin: 0 0 14px;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .up-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.52);
    line-height: 1.65;
    margin: 0 auto 36px;
    max-width: 380px;
  }
  .up-price-box {
    border-radius: 20px;
    padding: 28px 32px;
    border: 1px solid;
    margin-bottom: 28px;
  }
  .up-price-label {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .up-price {
    font-family: 'Syne', sans-serif;
    font-size: 56px;
    font-weight: 800;
    color: #fff;
    line-height: 1;
  }
  .up-price sup {
    font-size: 26px;
    vertical-align: top;
    margin-top: 11px;
    display: inline-block;
  }
  .up-price-per {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    margin-top: 6px;
  }
  .up-price-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.35);
    margin-top: 4px;
  }
  .up-price-nudge {
    font-size: 13px;
    font-weight: 600;
    margin-top: 6px;
  }
  .up-notice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px;
    padding: 18px 20px;
    text-align: left;
    margin-bottom: 28px;
  }
  .up-notice-icon {
    font-size: 20px;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 2px;
  }
  .up-notice-text {
    font-size: 13.5px;
    color: rgba(255,255,255,0.62);
    line-height: 1.6;
  }
  .up-notice-text b {
    color: rgba(255,255,255,0.92);
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
  }
  .up-btns {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .up-btn-primary {
    width: 100%;
    padding: 15px 0;
    border-radius: 999px;
    border: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: filter 0.18s, transform 0.18s;
  }
  .up-btn-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .up-btn-ghost {
    width: 100%;
    padding: 13px 0;
    border-radius: 999px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.5);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.18s, color 0.18s;
  }
  .up-btn-ghost:hover {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.85);
  }
`;

export default function UpgradePage() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const planKey = params.get("plan") || "explorer";
  const billing = params.get("billing") || "monthly";
  const isAnnual = billing === "annual";
  const plan = PLANS[planKey] || PLANS.explorer;

  const mailto = `mailto:support@skyrioofficial.com?subject=Early access: ${plan.name} plan (${billing})&body=Hi, I'd like to be notified when the ${plan.name} plan billing goes live! Preferred billing: ${billing}.`;

  return (
    <div className="up-wrap">
      <style>{CSS}</style>

      <div className="up-card">
        {/* Badge */}
        <div
          className="up-badge"
          style={{
            color: plan.color,
            background: plan.glow,
            borderColor: plan.border,
          }}
        >
          ✦ {plan.name} Plan
        </div>

        {/* Title */}
        <h1 className="up-title">Upgrade to {plan.name}</h1>
        <p className="up-sub">{plan.description}</p>

        {/* Price box */}
        <div
          className="up-price-box"
          style={{ background: plan.glow, borderColor: plan.border }}
        >
          <div className="up-price-label">
            {isAnnual ? "Billed once per year" : "Billed every month"}
          </div>

          {isAnnual ? (
            <>
              <div className="up-price">
                <sup>$</sup>
                {plan.price.annual}
              </div>
              <div className="up-price-per">/yr</div>
              <div className="up-price-sub">(${plan.monthlyEquiv}/mo)</div>
              <div className="up-price-nudge" style={{ color: plan.color }}>
                saves ${plan.monthlySaving} vs paying monthly
              </div>
            </>
          ) : (
            <>
              <div className="up-price">
                <sup>$</sup>
                {plan.price.monthly}
              </div>
              <div className="up-price-per">/mo</div>
              <div className="up-price-nudge" style={{ color: plan.color }}>
                or ${plan.price.annual}/yr — save ${plan.monthlySaving}
              </div>
            </>
          )}
        </div>

        {/* Notice */}
        <div className="up-notice">
          <span className="up-notice-icon">🚀</span>
          <div className="up-notice-text">
            <b>Billing launches with Skyrio in July 2026.</b>
            We're putting the finishing touches on our payment system. Send us
            an email and you'll be first to know — plus get an early-bird
            discount when we go live.
          </div>
        </div>

        {/* Actions */}
        <div className="up-btns">
          <button
            className="up-btn-primary"
            style={{
              background: `linear-gradient(135deg, ${plan.color}, ${plan.color}bb)`,
              color: plan.textColor,
              boxShadow: `0 8px 28px ${plan.glow}`,
            }}
            onClick={() => window.open(mailto, "_blank")}
          >
            Notify me when billing is live <ArrowRightOutlined />
          </button>

          <button className="up-btn-ghost" onClick={() => nav("/membership")}>
            <ArrowLeftOutlined /> Back to plans
          </button>
        </div>
      </div>
    </div>
  );
}
