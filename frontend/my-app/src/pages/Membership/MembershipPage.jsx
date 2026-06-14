/**
 * MembershipPage.jsx
 * Route: /membership
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightOutlined, ToolOutlined } from "@ant-design/icons";
import { useAuth } from "../../auth/useAuth";

const ICONS = {
  robot:
    "M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2zm-2 9a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm4 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM9 17h6",
  plane:
    "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  passport:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z",
  badge:
    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 3v5h8",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2l-8 5-8-5",
  infinite:
    "M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4zm0 0c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z",
  bolt: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  budget: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  map: "M1 6l7-4 8 4 7-4v16l-7 4-8-4-7 4V6zM8 2v16M16 6v16",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  early: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  concierge: "M3 11l19-9-9 19-2-8-8-2z",
  group:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 4v6m3-3h-6",
  palette:
    "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-5h2v2h-2zm0-8h2v5h-2z",
  founder:
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11l1.5 3h3l-2.5 2 1 3L12 17l-3 2 1-3-2.5-2h3z",
  roadmap: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

function Icon({ name, size = 15, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, annual: 0 },
    annualTotal: null,
    monthlyEquiv: null,
    monthlySaving: null,
    badge: null,
    description: "Everything you need to start planning smarter trips.",
    cta: "Get started free",
    highlight: false,
    perks: [
      {
        icon: "robot",
        text: "Atlas AI trip planning — full itineraries built in seconds",
      },
      {
        icon: "plane",
        text: "Search flights & hotels across 30+ global destinations",
      },
      {
        icon: "passport",
        text: "Your Skyrio Passport with rank, XP & travel history",
      },
      { icon: "badge", text: "Badge collection & XP tracking from day one" },
      { icon: "save", text: "Save up to 5 trips to revisit anytime" },
      { icon: "mail", text: "Email support with helpful responses" },
    ],
  },
  {
    id: "explorer",
    name: "Explorer",
    price: { monthly: 7, annual: 55 },
    annualTotal: 55,
    monthlyEquiv: 4.58,
    monthlySaving: 29,
    badge: "Most popular",
    description: "For frequent travelers who want more power and fewer limits.",
    cta: "Start Explorer",
    highlight: true,
    perks: [
      {
        icon: "infinite",
        text: "Everything in Free — unlimited trip saves, no caps",
      },
      {
        icon: "bolt",
        text: "Priority Atlas AI — faster responses, richer itineraries",
      },
      {
        icon: "budget",
        text: "Smart budget breakdown with real-time overspend alerts",
      },
      {
        icon: "map",
        text: "Explorer-exclusive hidden gem destinations unlocked",
      },
      {
        icon: "star",
        text: "2× XP multiplier on every flight & hotel booking",
      },
      {
        icon: "early",
        text: "Early access to every new Skyrio feature before launch",
      },
      {
        icon: "mail",
        text: "Priority email support — faster, dedicated responses",
      },
    ],
  },
  {
    id: "legend",
    name: "Legend",
    price: { monthly: 15, annual: 144 },
    annualTotal: 144,
    monthlyEquiv: 12.0,
    monthlySaving: 36,
    badge: "Best value",
    description: "For power travelers who demand the full Skyrio experience.",
    cta: "Go Legend",
    highlight: false,
    perks: [
      {
        icon: "bolt",
        text: "Everything in Explorer, taken to the highest level",
      },
      {
        icon: "concierge",
        text: "Concierge trip-building — we plan it, you just show up",
      },
      {
        icon: "star",
        text: "5× XP multiplier — climb the ranks at record speed",
      },
      {
        icon: "badge",
        text: "Exclusive Legend badge on your passport & profile",
      },
      {
        icon: "group",
        text: "Private group travel rooms for planning trips with your crew",
      },
      {
        icon: "palette",
        text: "Custom passport card design — your style, your identity",
      },
      {
        icon: "founder",
        text: "Direct line to the founder — real answers, not canned replies",
      },
      {
        icon: "roadmap",
        text: "Shape Skyrio's roadmap — your feedback ships first",
      },
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
      radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,138,42,0.15) 0%, transparent 50%),
      radial-gradient(ellipse 50% 40% at 90% 80%, rgba(124,92,252,0.12) 0%, transparent 50%),
      transparent;
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
    font-size: 16px; color: rgba(255,255,255,0.52);
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
    transition: all 0.2s; background: transparent; color: rgba(255,255,255,0.42);
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
    gap: 20px; max-width: 1100px; margin: 0 auto 80px;
  }
  @media (max-width: 900px) {
    .mp-plans { grid-template-columns: 1fr; max-width: 500px; }
  }
  .mp-plan {
    position: relative;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 22px; padding: 32px 28px 36px;
    display: flex; flex-direction: column;
    transition: border-color 0.22s, transform 0.22s, box-shadow 0.22s;
  }
  .mp-plan:hover {
    border-color: rgba(255,255,255,0.17);
    transform: translateY(-4px);
    box-shadow: 0 24px 56px rgba(0,0,0,0.28);
  }
  .mp-plan--highlight {
    border-color: rgba(255,138,42,0.5);
    background: rgba(255,138,42,0.06);
    box-shadow: 0 0 0 1px rgba(255,138,42,0.12), 0 24px 56px rgba(0,0,0,0.4);
  }
  .mp-plan--highlight:hover { border-color: rgba(255,138,42,0.75); }
  .mp-plan--active {
    border-color: rgba(124,92,252,0.65) !important;
    box-shadow: 0 0 0 1px rgba(124,92,252,0.2),
                0 24px 56px rgba(124,92,252,0.18) !important;
  }
  .mp-plan__badge {
    position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #ff8a2a, #ffb347);
    color: #1a0d04; font-size: 10px; font-weight: 800;
    padding: 4px 18px; border-radius: 999px; white-space: nowrap;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .mp-plan__yours {
    position: absolute; top: -13px; right: 22px;
    background: rgba(124,92,252,0.85); border: 1px solid rgba(124,92,252,0.4);
    color: #fff; font-size: 10px; font-weight: 800;
    padding: 3px 13px; border-radius: 999px;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .mp-plan__name {
    font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800;
    color: #fff; margin-bottom: 6px;
  }
  .mp-plan__desc {
    font-size: 13px; color: rgba(255,255,255,0.46);
    line-height: 1.55; margin-bottom: 24px;
  }
  .mp-plan__price { margin-bottom: 26px; }
  .mp-plan__amount {
    font-family: 'Syne', sans-serif; font-size: 46px;
    font-weight: 800; color: #fff; line-height: 1;
  }
  .mp-plan__amount sup { font-size: 22px; vertical-align: top; margin-top: 9px; }
  .mp-plan__per {
    font-size: 13px; font-weight: 600;
    color: rgba(255,255,255,0.5); margin-top: 4px;
  }
  .mp-plan__annual-total {
    font-size: 13px; color: rgba(255,255,255,0.35);
    margin-top: 3px;
  }
  .mp-plan__save-nudge {
    font-size: 11px; color: #ff8a2a;
    margin-top: 4px; font-weight: 600;
  }
  .mp-plan__cta {
    width: 100%; padding: 13px 0; border-radius: 999px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 8px; transition: filter 0.18s, transform 0.18s; margin-bottom: 28px;
  }
  .mp-plan__cta--primary {
    background: linear-gradient(135deg, #ff8a2a, #ffb347); color: #1a0d04;
    box-shadow: 0 8px 28px rgba(255,138,42,0.32);
  }
  .mp-plan__cta--primary:hover { filter: brightness(1.09); transform: translateY(-1px); }
  .mp-plan__cta--ghost {
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13);
    color: rgba(255,255,255,0.75);
  }
  .mp-plan__cta--ghost:hover { background: rgba(255,255,255,0.12); transform: translateY(-1px); }
  .mp-plan__cta--current {
    background: rgba(124,92,252,0.12); border: 1px solid rgba(124,92,252,0.3);
    color: rgba(255,255,255,0.42); cursor: default;
  }
  .mp-plan__divider {
    width: 100%; height: 1px;
    background: rgba(255,255,255,0.07); margin-bottom: 22px;
  }
  .mp-plan__perks {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 13px;
  }
  .mp-plan__perk {
    display: flex; align-items: flex-start; gap: 11px;
    font-size: 13.5px; color: rgba(255,255,255,0.7); line-height: 1.5;
  }
  .mp-admin {
    max-width: 1100px; margin: 0 auto 44px;
    background: rgba(124,92,252,0.07);
    border: 1px solid rgba(124,92,252,0.28);
    border-radius: 14px; padding: 14px 22px;
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  }
  .mp-admin__label {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; font-weight: 700; color: #a78bfa; white-space: nowrap;
  }
  .mp-admin__btns { display: flex; gap: 7px; }
  .mp-admin__btn {
    padding: 6px 18px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.13);
    background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6);
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: all 0.18s; text-transform: capitalize;
  }
  .mp-admin__btn:hover:not(:disabled) { background: rgba(255,255,255,0.11); color: #fff; }
  .mp-admin__btn--on {
    background: rgba(124,92,252,0.35);
    border-color: rgba(124,92,252,0.6); color: #fff;
  }
  .mp-admin__btn:disabled { opacity: 0.45; cursor: default; }
  .mp-admin__status { font-size: 12px; color: rgba(255,255,255,0.35); margin-left: auto; }
  .mp-admin__status b { color: #a78bfa; }
  .mp-faq { max-width: 740px; margin: 0 auto; }
  .mp-faq__head { text-align: center; margin-bottom: 32px; }
  .mp-faq__title {
    font-family: 'Syne', sans-serif; font-size: clamp(22px, 3.5vw, 32px);
    font-weight: 800; color: #fff; margin: 0 0 8px; letter-spacing: -0.02em;
  }
  .mp-faq__sub { font-size: 14px; color: rgba(255,255,255,0.4); margin: 0; }
  .mp-faq__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 640px) { .mp-faq__grid { grid-template-columns: 1fr; } }
  .mp-faq__card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 18px 20px; transition: border-color 0.2s;
  }
  .mp-faq__card:hover { border-color: rgba(255,138,42,0.22); }
  .mp-faq__q { font-size: 13.5px; font-weight: 700; color: #fff; margin-bottom: 7px; line-height: 1.4; }
  .mp-faq__a { font-size: 13px; color: rgba(255,255,255,0.46); line-height: 1.6; }
  .mp-bottom {
    text-align: center; padding: 56px 28px;
    background: linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(255,138,42,0.15) 100%);
    border: 1px solid rgba(255,138,42,0.22); border-radius: 26px;
    max-width: 1100px; margin: 68px auto 0;
  }
  .mp-bottom h2 {
    font-family: 'Syne', sans-serif; font-size: clamp(24px, 4vw, 38px);
    font-weight: 800; color: #fff; margin: 0 0 12px; letter-spacing: -0.02em;
  }
  .mp-bottom p { font-size: 15px; color: rgba(255,255,255,0.5); margin: 0 0 28px; }
  .mp-bottom__btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 34px; border-radius: 999px; border: none;
    background: linear-gradient(135deg, #ff8a2a, #ffb347);
    color: #1a0d04; font-family: 'DM Sans', sans-serif;
    font-size: 15px; font-weight: 700; cursor: pointer;
    transition: filter 0.18s, transform 0.18s;
    box-shadow: 0 8px 28px rgba(255,138,42,0.32);
  }
  .mp-bottom__btn:hover { filter: brightness(1.09); transform: translateY(-2px); }
  .mp-note { font-size: 12px; color: rgba(255,255,255,0.28); margin-top: 14px; }
  .mp-note span { color: #ff8a2a; cursor: pointer; }
  .mp-note span:hover { text-decoration: underline; }
`;

export default function MembershipPage() {
  const nav = useNavigate();
  const { user, isAuthed } = useAuth();

  const [annual, setAnnual] = useState(false);
  const [activePlan, setActivePlan] = useState("free");
  const [adminMsg, setAdminMsg] = useState("");
  const [switching, setSwitching] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user?.plan) setActivePlan(user.plan);
  }, [user]);

  async function handleAdminSwitch(planId) {
    if (switching || activePlan === planId) return;
    setSwitching(true);
    setAdminMsg("");
    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("skyrio_token");
      const res = await fetch(`${API}/api/admin/set-plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.ok) {
        setActivePlan(data.plan);
        setAdminMsg(data.plan);
        try {
          const raw = localStorage.getItem("user");
          if (raw) {
            localStorage.setItem(
              "user",
              JSON.stringify({ ...JSON.parse(raw), plan: data.plan })
            );
          }
        } catch {}
      } else {
        setAdminMsg("error");
      }
    } catch {
      setAdminMsg("error");
    } finally {
      setSwitching(false);
    }
  }

  function handleCta(plan) {
    if (!isAuthed) {
      nav(plan.id === "free" ? "/register" : `/register?plan=${plan.id}`);
      return;
    }
    if (plan.id === "free") {
      nav("/dashboard");
      return;
    }
    nav(`/upgrade?plan=${plan.id}&billing=${annual ? "annual" : "monthly"}`);
  }

  function ctaLabel(plan) {
    if (!isAuthed) return plan.cta;
    if (plan.id === activePlan) return "Current plan";
    if (plan.id === "free") return "Go to Dashboard";
    return plan.cta;
  }

  function ctaClass(plan) {
    if (isAuthed && plan.id === activePlan) return "mp-plan__cta--current";
    if (plan.highlight) return "mp-plan__cta--primary";
    return "mp-plan__cta--ghost";
  }

  function iconColor(plan) {
    if (plan.highlight) return "#ff8a2a";
    if (plan.id === "legend") return "#a78bfa";
    return "rgba(255,255,255,0.35)";
  }

  return (
    <div className="mp-wrap">
      <style>{CSS}</style>

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
            Annual <span className="mp-toggle__save">Save up to 34%</span>
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="mp-admin">
          <div className="mp-admin__label">
            <ToolOutlined /> Admin — Test Plan
          </div>
          <div className="mp-admin__btns">
            {["free", "explorer", "legend"].map((p) => (
              <button
                key={p}
                className={`mp-admin__btn${
                  activePlan === p ? " mp-admin__btn--on" : ""
                }`}
                onClick={() => handleAdminSwitch(p)}
                disabled={switching || activePlan === p}
              >
                {p}
              </button>
            ))}
          </div>
          {adminMsg && (
            <div className="mp-admin__status">
              {switching ? (
                "Switching…"
              ) : (
                <>
                  <b>{adminMsg}</b> active
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mp-plans">
        {PLANS.map((plan) => {
          const isFree = plan.id === "free";
          const isCurrent = isAuthed && plan.id === activePlan;

          return (
            <div
              key={plan.id}
              className={[
                "mp-plan",
                plan.highlight ? "mp-plan--highlight" : "",
                isCurrent ? "mp-plan--active" : "",
              ]
                .join(" ")
                .trim()}
            >
              {plan.badge && <div className="mp-plan__badge">{plan.badge}</div>}
              {isCurrent && <div className="mp-plan__yours">Your Plan</div>}

              <div className="mp-plan__name">{plan.name}</div>
              <div className="mp-plan__desc">{plan.description}</div>

              {/* Price — Crunchyroll style */}
              <div className="mp-plan__price">
                {isFree ? (
                  <div className="mp-plan__amount">Free</div>
                ) : annual ? (
                  <>
                    <div className="mp-plan__amount">
                      <sup>$</sup>
                      {plan.monthlyEquiv}
                    </div>
                    <div className="mp-plan__per">/mo</div>
                    <div className="mp-plan__annual-total">
                      (${plan.annualTotal}/yr)
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mp-plan__amount">
                      <sup>$</sup>
                      {plan.price.monthly}
                    </div>
                    <div className="mp-plan__per">/mo</div>
                    <div className="mp-plan__save-nudge">
                      or ${plan.annualTotal}/yr — save ${plan.monthlySaving}
                    </div>
                  </>
                )}
              </div>

              <button
                className={`mp-plan__cta ${ctaClass(plan)}`}
                onClick={() => handleCta(plan)}
              >
                {ctaLabel(plan)} <ArrowRightOutlined />
              </button>

              <div className="mp-plan__divider" />

              <ul className="mp-plan__perks">
                {plan.perks.map((perk) => (
                  <li key={perk.text} className="mp-plan__perk">
                    <Icon name={perk.icon} size={15} color={iconColor(plan)} />
                    {perk.text}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mp-faq">
        <div className="mp-faq__head">
          <h2 className="mp-faq__title">Common questions</h2>
          <p className="mp-faq__sub">
            Everything you need before choosing a plan.
          </p>
        </div>
        <div className="mp-faq__grid">
          {FAQS.map((faq) => (
            <div key={faq.q} className="mp-faq__card">
              <div className="mp-faq__q">{faq.q}</div>
              <div className="mp-faq__a">{faq.a}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mp-bottom">
        {isAuthed ? (
          <>
            <h2>Ready to level up?</h2>
            <p>Unlock more XP, smarter AI, and exclusive travel perks.</p>
            <button
              className="mp-bottom__btn"
              onClick={() =>
                nav(
                  `/upgrade?plan=explorer&billing=${
                    annual ? "annual" : "monthly"
                  }`
                )
              }
            >
              View upgrade options <ArrowRightOutlined />
            </button>
          </>
        ) : (
          <>
            <h2>Start planning for free</h2>
            <p>No credit card required. Upgrade anytime.</p>
            <button className="mp-bottom__btn" onClick={() => nav("/register")}>
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
