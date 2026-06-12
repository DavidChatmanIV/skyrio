import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightOutlined,
  CheckOutlined,
  ToolOutlined,
} from "@ant-design/icons";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, annual: 0 },
    badge: null,
    description: "Everything you need to start planning smarter trips.",
    cta: "Get started free",
    ctaRoute: "/register",
    highlight: false,
    perks: [
      "Unlimited AI trip planning with Atlas",
      "Flight & hotel search across 30+ destinations",
      "Skyrio Passport (Explorer rank)",
      "Basic XP & badge tracking",
      "Trip saving (up to 5 trips)",
      "Email support",
    ],
  },
  {
    id: "explorer",
    name: "Explorer",
    price: { monthly: 8, annual: 6 },
    badge: "Most popular",
    description: "For frequent travelers who want more power and fewer limits.",
    cta: "Start Explorer",
    ctaRoute: "/register?plan=explorer",
    highlight: true,
    perks: [
      "Everything in Free",
      "Unlimited saved trips",
      "Priority Atlas AI responses",
      "Advanced budget breakdown & alerts",
      "Exclusive Explorer-only destinations",
      "2× XP on every booking",
      "Early access to new features",
      "Priority email support",
    ],
  },
  {
    id: "legend",
    name: "Legend",
    price: { monthly: 18, annual: 14 },
    badge: "Best value",
    description: "For power travelers who want the full Skyrio experience.",
    cta: "Go Legend",
    ctaRoute: "/register?plan=legend",
    highlight: false,
    perks: [
      "Everything in Explorer",
      "Concierge trip-building service",
      "5× XP multiplier",
      "Legend badge & exclusive rewards",
      "Access to private group travel rooms",
      "Custom passport card design",
      "Early booking access & exclusive deals", // ← replaced "Dedicated account manager"
      "24/7 live chat support",
    ],
  },
];

const FAQS = [
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes — plan changes take effect immediately. If you upgrade mid-cycle, you're prorated for the remainder.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "Explorer comes with a 14-day free trial, no credit card required. Legend includes a 7-day trial.",
  },
  {
    q: "What happens to my saved trips if I downgrade?",
    a: "Your trips are never deleted. On Free, only your 5 most recent are active — the rest are archived and restored if you re-upgrade.",
  },
  {
    q: "Are payments secure?",
    a: "All payments are processed by Stripe. We never store your card details.",
  },
];

const API = import.meta.env.VITE_API_URL || "https://skyrio.onrender.com";

const CSS = `
  .mp-wrap {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 80% 50% at 20% -10%, rgba(124,92,252,0.22) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 10%,  rgba(255,138,42,0.12) 0%, transparent 55%),
      radial-gradient(ellipse 50% 60% at 50% 90%,  rgba(124,92,252,0.12) 0%, transparent 60%),
      linear-gradient(160deg, #0e0b24 0%, #09071a 50%, #0b0719 100%);
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    padding: 64px 24px 96px;
  }
  .mp-head { text-align: center; margin-bottom: 52px; }
  .mp-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,138,42,0.14); border: 1px solid rgba(255,138,42,0.28);
    border-radius: 999px; padding: 5px 16px; font-size: 12px; font-weight: 500;
    letter-spacing: 0.04em; color: #ff8a2a; margin-bottom: 20px;
  }
  .mp-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 800; letter-spacing: -0.02em;
    color: #fff; margin: 0 0 14px; line-height: 1.1;
  }
  .mp-title span {
    background: linear-gradient(135deg, #ff8a2a, #ffb347);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mp-sub {
    font-size: 16px; color: rgba(255,255,255,0.55);
    max-width: 480px; margin: 0 auto; line-height: 1.65;
  }
  .mp-toggle {
    display: inline-flex; align-items: center;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 999px; padding: 4px;
  }
  .mp-toggle__btn {
    padding: 8px 22px; border-radius: 999px; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: all 0.2s; background: transparent; color: rgba(255,255,255,0.45);
  }
  .mp-toggle__btn--active {
    background: linear-gradient(135deg, #ff8a2a, #ffb347);
    color: #1a0d04; box-shadow: 0 4px 14px rgba(255,138,42,0.3);
  }
  .mp-toggle__save {
    font-size: 10px; font-weight: 700; color: #ff8a2a;
    background: rgba(255,138,42,0.14); border: 1px solid rgba(255,138,42,0.28);
    border-radius: 999px; padding: 2px 8px; margin-left: 6px;
  }
  .mp-plans {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 20px; max-width: 1020px; margin: 0 auto 80px;
  }
  @media (max-width: 860px) { .mp-plans { grid-template-columns: 1fr; max-width: 480px; } }
  .mp-plan {
    position: relative;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px; padding: 28px 26px 32px;
    display: flex; flex-direction: column;
    transition: border-color 0.22s, transform 0.22s;
  }
  .mp-plan:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-3px); }
  .mp-plan--highlight {
    border-color: rgba(255,138,42,0.45); background: rgba(255,138,42,0.07);
    box-shadow: 0 0 0 1px rgba(255,138,42,0.1), 0 20px 48px rgba(0,0,0,0.35);
  }
  .mp-plan--active-plan {
    border-color: rgba(124,92,252,0.6) !important;
    box-shadow: 0 0 0 1px rgba(124,92,252,0.2), 0 20px 48px rgba(124,92,252,0.2) !important;
  }
  .mp-plan__badge {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #ff8a2a, #ffb347);
    color: #1a0d04; font-size: 11px; font-weight: 800;
    padding: 4px 16px; border-radius: 999px; white-space: nowrap;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .mp-plan__active-badge {
    position: absolute; top: -12px; right: 20px;
    background: rgba(124,92,252,0.9); border: 1px solid rgba(124,92,252,0.5);
    color: #fff; font-size: 10px; font-weight: 800;
    padding: 3px 12px; border-radius: 999px; white-space: nowrap;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .mp-plan__name {
    font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800;
    color: #fff; margin-bottom: 6px;
  }
  .mp-plan__desc { font-size: 12.5px; color: rgba(255,255,255,0.5); line-height: 1.5; margin-bottom: 22px; }
  .mp-plan__price { margin-bottom: 24px; }
  .mp-plan__amount {
    font-family: 'Syne', sans-serif; font-size: 42px; font-weight: 800; color: #fff; line-height: 1;
  }
  .mp-plan__amount sup { font-size: 20px; vertical-align: top; margin-top: 8px; }
  .mp-plan__per { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
  .mp-plan__cta {
    width: 100%; padding: 12px 0; border-radius: 999px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 8px; transition: filter 0.18s, transform 0.18s; margin-bottom: 26px;
  }
  .mp-plan__cta--primary {
    background: linear-gradient(135deg, #ff8a2a, #ffb347); color: #1a0d04;
    box-shadow: 0 8px 24px rgba(255,138,42,0.3);
  }
  .mp-plan__cta--primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .mp-plan__cta--ghost {
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14);
    color: rgba(255,255,255,0.8);
  }
  .mp-plan__cta--ghost:hover { background: rgba(255,255,255,0.12); transform: translateY(-1px); }
  .mp-plan__cta--current {
    background: rgba(124,92,252,0.15); border: 1px solid rgba(124,92,252,0.35);
    color: rgba(255,255,255,0.5); cursor: default;
  }
  .mp-plan__divider { width: 100%; height: 1px; background: rgba(255,255,255,0.08); margin-bottom: 20px; }
  .mp-plan__perks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .mp-plan__perk {
    display: flex; align-items: flex-start; gap: 9px;
    font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.45;
  }
  .mp-plan__check {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; margin-top: 1px;
    display: flex; align-items: center; justify-content: center; font-size: 9px;
  }
  .mp-plan__check--orange { background: rgba(255,138,42,0.2); color: #ff8a2a; }
  .mp-plan__check--muted  { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.35); }

  /* Admin Panel */
  .mp-admin-panel {
    max-width: 1020px; margin: 0 auto 48px;
    background: rgba(124,92,252,0.08); border: 1px solid rgba(124,92,252,0.3);
    border-radius: 16px; padding: 20px 24px;
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  }
  .mp-admin-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 700; color: rgba(124,92,252,0.9);
    white-space: nowrap;
  }
  .mp-admin-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .mp-admin-btn {
    padding: 7px 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: all 0.18s; text-transform: capitalize;
  }
  .mp-admin-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .mp-admin-btn--active {
    background: linear-gradient(135deg,rgba(124,92,252,0.5),rgba(124,92,252,0.3));
    border-color: rgba(124,92,252,0.6); color: #fff;
  }
  .mp-admin-status {
    font-size: 12px; color: rgba(255,255,255,0.4); margin-left: auto;
  }
  .mp-admin-status span { color: #a78bfa; font-weight: 700; }

  /* FAQ */
  .mp-faq-wrap { max-width: 720px; margin: 0 auto; }
  .mp-faq-head { text-align: center; margin-bottom: 32px; }
  .mp-faq-title {
    font-family: 'Syne', sans-serif; font-size: clamp(22px, 3.5vw, 32px);
    font-weight: 800; color: #fff; margin: 0 0 8px; letter-spacing: -0.02em;
  }
  .mp-faq-sub { font-size: 14px; color: rgba(255,255,255,0.45); margin: 0; }
  .mp-faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 640px) { .mp-faq-grid { grid-template-columns: 1fr; } }
  .mp-faq-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px; padding: 18px 20px; transition: border-color 0.2s;
  }
  .mp-faq-card:hover { border-color: rgba(255,138,42,0.25); }
  .mp-faq-q { font-size: 13.5px; font-weight: 700; color: #fff; margin-bottom: 7px; line-height: 1.4; }
  .mp-faq-a  { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.6; }

  /* Bottom CTA */
  .mp-bottom-cta {
    text-align: center; padding: 52px 24px;
    background: linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(255,138,42,0.18) 100%);
    border: 1px solid rgba(255,138,42,0.25); border-radius: 24px;
    max-width: 1020px; margin: 64px auto 0;
  }
  .mp-bottom-cta h2 {
    font-family: 'Syne', sans-serif; font-size: clamp(24px, 4vw, 38px);
    font-weight: 800; color: #fff; margin: 0 0 12px; letter-spacing: -0.02em;
  }
  .mp-bottom-cta p { font-size: 15px; color: rgba(255,255,255,0.55); margin: 0 0 28px; }
  .mp-bottom-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 32px; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #ff8a2a, #ffb347);
    color: #1a0d04; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700;
    cursor: pointer; transition: filter 0.18s, transform 0.18s;
    box-shadow: 0 8px 28px rgba(255,138,42,0.35);
  }
  .mp-bottom-btn:hover { filter: brightness(1.08); transform: translateY(-2px); }
  .mp-note { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 12px; }
  .mp-note span { color: #ff8a2a; cursor: pointer; }
  .mp-note span:hover { text-decoration: underline; }
`;

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("skyrio_token") ||
    ""
  );
}

export default function MembershipPage() {
  const nav = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activePlan, setActivePlan] = useState("free");
  const [adminMsg, setAdminMsg] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      setActivePlan(user.plan || "free");
    }
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isLoggedIn = !!currentUser;

  // Admin: switch own plan via backend
  async function handleAdminPlanSwitch(planId) {
    if (switching) return;
    setSwitching(true);
    setAdminMsg("");
    try {
      const res = await fetch(`${API}/api/admin/set-plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.ok) {
        setActivePlan(data.plan);
        // Sync localStorage so the rest of the app sees the new plan
        const stored = getStoredUser();
        if (stored) {
          localStorage.setItem(
            "user",
            JSON.stringify({ ...stored, plan: data.plan })
          );
        }
        setAdminMsg(`Switched to ${data.plan}`);
      } else {
        setAdminMsg(data.message || "Failed to switch");
      }
    } catch {
      setAdminMsg("Network error");
    } finally {
      setSwitching(false);
    }
  }

  function handlePlanCta(plan) {
    if (plan.id === "free") {
      nav(isLoggedIn ? "/dashboard" : "/register");
    } else {
      nav(isLoggedIn ? `/upgrade?plan=${plan.id}` : plan.ctaRoute);
    }
  }

  function ctaLabel(plan) {
    if (plan.id === activePlan) return "Current plan";
    if (plan.id === "free" && isLoggedIn) return "Go to Dashboard";
    return plan.cta;
  }

  return (
    <div className="mp-wrap">
      <style>{CSS}</style>

      {/* Head */}
      <div className="mp-head">
        <div className="mp-eyebrow">✦ Skyrio Membership</div>
        <h1 className="mp-title">
          Travel smarter with <span>Skyrio</span>
        </h1>
        <p className="mp-sub">
          Start free. Upgrade when you're ready. Every plan includes Atlas AI,
          full trip planning, and your Skyrio Passport.
        </p>
      </div>

      {/* Billing toggle */}
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}
      >
        <div className="mp-toggle">
          <button
            className={`mp-toggle__btn${
              !annual ? " mp-toggle__btn--active" : ""
            }`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            className={`mp-toggle__btn${
              annual ? " mp-toggle__btn--active" : ""
            }`}
            onClick={() => setAnnual(true)}
          >
            Annual <span className="mp-toggle__save">Save 25%</span>
          </button>
        </div>
      </div>

      {/* Admin plan switcher — only visible to admins */}
      {isAdmin && (
        <div className="mp-admin-panel">
          <div className="mp-admin-label">
            <ToolOutlined /> Admin — Test Plan
          </div>
          <div className="mp-admin-btns">
            {["free", "explorer", "legend"].map((p) => (
              <button
                key={p}
                className={`mp-admin-btn${
                  activePlan === p ? " mp-admin-btn--active" : ""
                }`}
                onClick={() => handleAdminPlanSwitch(p)}
                disabled={switching || activePlan === p}
              >
                {p}
              </button>
            ))}
          </div>
          {adminMsg && (
            <div className="mp-admin-status">
              {switching ? (
                "Switching…"
              ) : (
                <>
                  Active: <span>{adminMsg}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plans */}
      <div className="mp-plans">
        {PLANS.map((plan) => {
          const price = annual ? plan.price.annual : plan.price.monthly;
          const isFree = plan.id === "free";
          const isCurrent = plan.id === activePlan;
          return (
            <div
              key={plan.id}
              className={`mp-plan${
                plan.highlight ? " mp-plan--highlight" : ""
              }${isCurrent && isLoggedIn ? " mp-plan--active-plan" : ""}`}
            >
              {plan.badge && <div className="mp-plan__badge">{plan.badge}</div>}
              {isCurrent && isLoggedIn && (
                <div className="mp-plan__active-badge">Your Plan</div>
              )}

              <div className="mp-plan__name">{plan.name}</div>
              <div className="mp-plan__desc">{plan.description}</div>

              <div className="mp-plan__price">
                <div className="mp-plan__amount">
                  {isFree ? (
                    "Free"
                  ) : (
                    <>
                      <sup>$</sup>
                      {price}
                    </>
                  )}
                </div>
                {!isFree && (
                  <div className="mp-plan__per">
                    per month{annual ? ", billed annually" : ""}
                  </div>
                )}
              </div>

              <button
                className={`mp-plan__cta ${
                  isCurrent && isLoggedIn
                    ? "mp-plan__cta--current"
                    : plan.highlight
                    ? "mp-plan__cta--primary"
                    : "mp-plan__cta--ghost"
                }`}
                onClick={() => !isCurrent && handlePlanCta(plan)}
                disabled={isCurrent && isLoggedIn}
              >
                {ctaLabel(plan)} <ArrowRightOutlined />
              </button>

              <div className="mp-plan__divider" />

              <ul className="mp-plan__perks">
                {plan.perks.map((perk) => (
                  <li key={perk} className="mp-plan__perk">
                    <span
                      className={`mp-plan__check ${
                        plan.highlight
                          ? "mp-plan__check--orange"
                          : "mp-plan__check--muted"
                      }`}
                    >
                      <CheckOutlined />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mp-faq-wrap">
        <div className="mp-faq-head">
          <h2 className="mp-faq-title">Common questions</h2>
          <p className="mp-faq-sub">
            Everything you need before choosing a plan.
          </p>
        </div>
        <div className="mp-faq-grid">
          {FAQS.map((faq) => (
            <div key={faq.q} className="mp-faq-card">
              <div className="mp-faq-q">{faq.q}</div>
              <div className="mp-faq-a">{faq.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA — auth-aware */}
      <div className="mp-bottom-cta">
        {isLoggedIn ? (
          <>
            <h2>Ready to upgrade?</h2>
            <p>Unlock more power, more XP, and more of Skyrio.</p>
            <button className="mp-bottom-btn" onClick={() => nav("/upgrade")}>
              View upgrade options <ArrowRightOutlined />
            </button>
          </>
        ) : (
          <>
            <h2>Start planning for free</h2>
            <p>No credit card required. Upgrade anytime.</p>
            <button className="mp-bottom-btn" onClick={() => nav("/register")}>
              Create a free account <ArrowRightOutlined />
            </button>
            <div className="mp-note">
              Already have an account?{" "}
              <span onClick={() => nav("/login")}>Sign in →</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
