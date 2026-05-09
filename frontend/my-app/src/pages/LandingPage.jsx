import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, message } from "antd";
import {
  SearchOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import "@/styles/LandingPage.css";
import heroBg from "@/assets/landing/skyrio-cosmic.jpg";
import { trackPassportEvent } from "@/utils/passportEvents";

// ─────────────────────────────────────────────
// Time-aware background system
// ─────────────────────────────────────────────
const TIME_PERIODS = {
  dawn: {
    hours: [5, 6, 7],
    label: "Dawn",
    tip: "Early birds get the best deals — prices are freshest between 6–8 AM.",
  },
  morning: {
    hours: [8, 9, 10, 11],
    label: "Morning",
    tip: "Booking 6–8 weeks ahead hits the sweet spot for domestic flights.",
  },
  afternoon: {
    hours: [12, 13, 14, 15, 16],
    label: "Afternoon",
    tip: "Mid-week departures (Tues/Wed) save up to $80 per ticket.",
  },
  dusk: {
    hours: [17, 18, 19],
    label: "Sunset",
    tip: "Last-minute deals often drop after 5 PM for next-week travel.",
  },
  night: {
    hours: [20, 21, 22, 23, 0, 1, 2, 3, 4],
    label: "Night",
    tip: "Best time to book is Tuesday nights — prices are 15–20% lower than weekends.",
  },
};

function getTimePeriod(hour) {
  for (const [key, val] of Object.entries(TIME_PERIODS)) {
    if (val.hours.includes(hour)) return key;
  }
  return "night";
}

function normalizePrompt(value) {
  return String(value || "").trim();
}

// ─────────────────────────────────────────────
// Atlas conversation
// ─────────────────────────────────────────────
const ATLAS_CONVERSATION = [
  {
    id: 1,
    from: "user",
    text: "I want to go somewhere warm in March, budget around $1,800.",
  },
  {
    id: 2,
    from: "atlas",
    text: "Perfect timing — Tulum and Cartagena are both peaking in March. I can get you 5 nights in Tulum with flights from Newark for $1,640 total. Want me to lock that in?",
  },
  { id: 3, from: "user", text: "Yes! Can you find a hotel near the beach?" },
  {
    id: 4,
    from: "atlas",
    text: "Found 3 beachfront options under $180/night. The top pick has free cancellation and a rooftop pool. Adding it to your plan now ✈️",
  },
];

const ATLAS_FEATURES = [
  {
    icon: "🧠",
    title: "Understands natural language",
    desc: "Just tell Atlas what you want — no dropdowns, no filters. It figures out the rest.",
  },
  {
    icon: "⚡",
    title: "Builds your plan in seconds",
    desc: "Flights, hotels, and budget breakdown — ready before you finish your coffee.",
  },
  {
    icon: "🎯",
    title: "Learns your travel style",
    desc: "The more you travel with Skyrio, the smarter Atlas gets at matching your vibe.",
  },
  {
    icon: "🔒",
    title: "Books it too",
    desc: "Atlas doesn't just suggest — it takes you all the way to a confirmed booking.",
  },
];

const PASSPORT_PERKS = [
  {
    icon: "✦",
    label: "XP & Levels",
    desc: "Earn points every time you search, save, or book. Unlock Explorer → Legend.",
  },
  {
    icon: "🏅",
    label: "Badges",
    desc: "Collect badges for destinations, trip types, and milestones.",
  },
  {
    icon: "💰",
    label: "Rewards",
    desc: "Redeem XP for travel credits, upgrades, and exclusive deals.",
  },
  {
    icon: "🗺️",
    label: "Journey History",
    desc: "Every trip you take builds your Skyrio Passport — your travel story.",
  },
];

const SUPPORT_FAQS = [
  {
    q: "Is Skyrio free to use?",
    a: "Yes — searching and planning with Atlas is completely free. You only pay when you book a flight or hotel.",
  },
  {
    q: "How does Atlas AI work?",
    a: "Atlas reads your natural language prompt, matches it to live flight and hotel inventory, and builds a budget-optimized plan in seconds.",
  },
  {
    q: "Can I change or cancel my booking?",
    a: "Yes. Most bookings include free cancellation within 24 hours. Cancellation policies vary by airline and hotel.",
  },
  {
    q: "Is my payment information secure?",
    a: "Absolutely. Payments are processed by Stripe — the same infrastructure used by Amazon and Shopify. We never store your card details.",
  },
];

// ─────────────────────────────────────────────
// Injected styles for new sections
// ─────────────────────────────────────────────
const INJECTED_CSS = `
/* ── Atlas Section ── */
.sk-atlas {
  padding: 0 24px 80px;
  max-width: 1100px;
  margin: 0 auto;
}
.sk-atlas__head {
  text-align: center;
  margin-bottom: 48px;
}
.sk-atlas__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,138,42,0.14);
  border: 1px solid rgba(255,138,42,0.28);
  border-radius: 999px;
  padding: 5px 16px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #ff8a2a;
  margin-bottom: 18px;
}
.sk-atlas__eyebrow::before { content: "✦"; font-size: 10px; }
.sk-atlas__title {
  font-family: "Syne", sans-serif !important;
  font-size: clamp(28px, 4.5vw, 42px) !important;
  font-weight: 800 !important;
  letter-spacing: -0.02em !important;
  color: #fff !important;
  margin: 0 0 14px !important;
  line-height: 1.1 !important;
}
.sk-atlas__name {
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.sk-atlas__sub {
  font-size: 15px;
  color: rgba(255,255,255,0.6);
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.65;
}
.sk-atlas__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 820px) {
  .sk-atlas__body { grid-template-columns: 1fr; }
  .sk-atlas { padding: 0 16px 64px; }
}

/* Chat */
.sk-atlas__chat {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.22s;
}
.sk-atlas__chat:hover { border-color: rgba(255,255,255,0.22); }
.sk-atlas__chatHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
}
.sk-atlas__avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: #1a0d04; flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(255,138,42,0.4);
}
.sk-atlas__chatName {
  font-family: "Syne", sans-serif;
  font-size: 14px; font-weight: 700; color: #fff; line-height: 1;
}
.sk-atlas__chatStatus {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px;
}
.sk-atlas__statusDot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #34d399; animation: sk-pulse 2s infinite;
}
.sk-atlas__messages {
  padding: 20px;
  display: flex; flex-direction: column; gap: 12px;
  min-height: 220px;
}
.sk-atlas__bubble {
  display: flex; align-items: flex-end; gap: 8px;
  animation: sk-bubbleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes sk-bubbleIn {
  from { opacity:0; transform:translateY(8px) scale(0.95); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
.sk-atlas__bubble--user { flex-direction: row-reverse; }
.sk-atlas__bubbleAvatar {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: #1a0d04; flex-shrink: 0;
}
.sk-atlas__bubbleText {
  max-width: 78%; padding: 10px 14px;
  border-radius: 14px; font-size: 13px; line-height: 1.5;
}
.sk-atlas__bubble--atlas .sk-atlas__bubbleText {
  background: rgba(255,138,42,0.12);
  border: 1px solid rgba(255,138,42,0.25);
  color: rgba(255,255,255,0.9);
  border-bottom-left-radius: 4px;
}
.sk-atlas__bubble--user .sk-atlas__bubbleText {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  border-bottom-right-radius: 4px;
}
.sk-atlas__typing {
  display: flex; align-items: center; gap: 4px;
  padding: 12px 16px;
  background: rgba(255,138,42,0.12);
  border: 1px solid rgba(255,138,42,0.25);
  border-radius: 14px; border-bottom-left-radius: 4px;
}
.sk-atlas__typing span {
  width: 6px; height: 6px; border-radius: 50%;
  background: #ff8a2a; animation: sk-typing 1.2s ease infinite;
}
.sk-atlas__typing span:nth-child(2) { animation-delay: 0.2s; }
.sk-atlas__typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes sk-typing {
  0%,60%,100% { transform:translateY(0); opacity:0.4; }
  30%          { transform:translateY(-5px); opacity:1; }
}
.sk-atlas__chatFooter {
  padding: 14px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; gap: 10px; align-items: center;
}
.sk-atlas__fakeInput {
  flex: 1; padding: 9px 14px; border-radius: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  font-size: 12px; color: rgba(255,255,255,0.25);
}
.sk-atlas__chatCta {
  padding: 9px 16px; border-radius: 999px; border: none;
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%);
  color: #1a0d04; font-family: "DM Sans", sans-serif;
  font-size: 12px; font-weight: 700; cursor: pointer;
  white-space: nowrap; transition: filter 0.18s, transform 0.18s;
}
.sk-atlas__chatCta:hover { filter: brightness(1.08); transform: translateY(-1px); }

/* Features */
.sk-atlas__features { display: flex; flex-direction: column; gap: 14px; }
.sk-atlas__feature {
  display: flex; gap: 14px; align-items: flex-start;
  padding: 16px 18px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 14px;
  transition: border-color 0.22s, transform 0.22s;
}
.sk-atlas__feature:hover {
  border-color: rgba(255,138,42,0.3);
  transform: translateX(4px);
}
.sk-atlas__featureIcon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(255,138,42,0.12);
  border: 1px solid rgba(255,138,42,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.sk-atlas__featureTitle { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px; }
.sk-atlas__featureDesc { font-size: 12.5px; color: rgba(255,255,255,0.55); line-height: 1.5; }
.sk-atlas__mainCta {
  display: flex !important; align-items: center !important;
  justify-content: center !important; width: 100%; margin-top: 8px;
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%) !important;
  border: none !important; border-radius: 999px !important;
  color: #1a0d04 !important; font-family: "DM Sans", sans-serif !important;
  font-size: 15px !important; font-weight: 700 !important;
  height: 48px !important; padding: 0 28px !important;
  cursor: pointer; transition: filter 0.18s, transform 0.18s;
  box-shadow: 0 8px 24px rgba(255,138,42,0.28);
}
.sk-atlas__mainCta:hover {
  filter: brightness(1.08) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 12px 32px rgba(255,138,42,0.4) !important;
}

/* ── Passport Banner ── */
.sk-passport-banner {
  margin: 0 24px 80px;
  max-width: 1100px;
  margin-left: auto; margin-right: auto;
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(255,138,42,0.25) 50%, rgba(236,72,153,0.25) 100%);
  border: 1px solid rgba(255,138,42,0.3);
  padding: 52px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}
.sk-passport-banner::before {
  content: "";
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 70% 80% at 80% 50%, rgba(255,138,42,0.15) 0%, transparent 70%);
  pointer-events: none;
}
.sk-passport-banner__left { flex: 1; position: relative; z-index: 1; }
.sk-passport-banner__badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,138,42,0.15);
  border: 1px solid rgba(255,138,42,0.35);
  border-radius: 999px; padding: 4px 14px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #ff8a2a; margin-bottom: 18px;
}
.sk-passport-banner__title {
  font-family: "Syne", sans-serif !important;
  font-size: clamp(24px, 3.5vw, 36px) !important;
  font-weight: 800 !important;
  color: #fff !important;
  line-height: 1.15 !important;
  margin: 0 0 12px !important;
  letter-spacing: -0.02em !important;
}
.sk-passport-banner__title span {
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.sk-passport-banner__sub {
  font-size: 14px; color: rgba(255,255,255,0.6);
  line-height: 1.6; max-width: 440px; margin-bottom: 28px;
}
.sk-passport-banner__perks {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.sk-passport-perk {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 12px;
}
.sk-passport-perk__icon {
  font-size: 16px; flex-shrink: 0; margin-top: 1px;
  color: #ff8a2a;
}
.sk-passport-perk__label {
  font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 2px;
}
.sk-passport-perk__desc { font-size: 11px; color: rgba(255,255,255,0.45); line-height: 1.4; }
.sk-passport-banner__right {
  flex-shrink: 0; display: flex; flex-direction: column;
  align-items: center; gap: 16px; position: relative; z-index: 1;
}
.sk-passport-card {
  width: 220px;
  background: linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(255,138,42,0.4) 100%);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 18px; padding: 22px;
  backdrop-filter: blur(16px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.sk-passport-card__top {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.sk-passport-card__logo {
  font-family: "Syne", sans-serif;
  font-size: 13px; font-weight: 800; color: #fff;
}
.sk-passport-card__chip {
  width: 28px; height: 20px; border-radius: 4px;
  background: linear-gradient(135deg, #ffb347, #ff8a2a);
  opacity: 0.8;
}
.sk-passport-card__name {
  font-size: 11px; color: rgba(255,255,255,0.5);
  text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;
}
.sk-passport-card__level {
  font-family: "Syne", sans-serif;
  font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px;
}
.sk-passport-card__xp-label {
  font-size: 10px; color: rgba(255,255,255,0.4);
  text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
}
.sk-passport-card__bar {
  height: 5px; background: rgba(255,255,255,0.12);
  border-radius: 999px; overflow: hidden;
}
.sk-passport-card__fill {
  height: 100%; width: 35%;
  background: linear-gradient(90deg, #ff8a2a, #ffb347);
  border-radius: 999px;
}
.sk-passport-banner__cta {
  display: flex !important; align-items: center !important;
  justify-content: center !important;
  background: linear-gradient(135deg, #ff8a2a 0%, #ffb347 100%) !important;
  border: none !important; border-radius: 999px !important;
  color: #1a0d04 !important; font-family: "DM Sans", sans-serif !important;
  font-size: 14px !important; font-weight: 700 !important;
  height: 46px !important; padding: 0 28px !important;
  cursor: pointer; transition: filter 0.18s, transform 0.18s;
  box-shadow: 0 8px 24px rgba(255,138,42,0.35);
  white-space: nowrap; width: 220px;
}
.sk-passport-banner__cta:hover {
  filter: brightness(1.08) !important;
  transform: translateY(-2px) !important;
}
.sk-passport-banner__note {
  font-size: 11px; color: rgba(255,255,255,0.3); text-align: center;
}
@media (max-width: 820px) {
  .sk-passport-banner {
    flex-direction: column; padding: 36px 24px; margin: 0 16px 64px;
  }
  .sk-passport-banner__right { width: 100%; }
  .sk-passport-card { width: 100%; }
  .sk-passport-banner__perks { grid-template-columns: 1fr; }
  .sk-passport-banner__cta { width: 100% !important; }
}

/* ── Support Section ── */
.sk-support {
  padding: 0 24px 96px;
  max-width: 860px;
  margin: 0 auto;
}
.sk-support__head {
  text-align: center; margin-bottom: 40px;
}
.sk-support__eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,138,42,0.12);
  border: 1px solid rgba(255,138,42,0.25);
  border-radius: 999px; padding: 5px 16px;
  font-size: 12px; font-weight: 500; letter-spacing: 0.04em;
  color: #ff8a2a; margin-bottom: 16px;
}
.sk-support__eyebrow::before { content: "💬"; font-size: 12px; }
.sk-support__title {
  font-family: "Syne", sans-serif !important;
  font-size: clamp(24px, 4vw, 36px) !important;
  font-weight: 800 !important; color: #fff !important;
  margin: 0 0 10px !important; letter-spacing: -0.02em !important;
}
.sk-support__sub {
  font-size: 14px; color: rgba(255,255,255,0.55); margin: 0;
}
.sk-support__grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-bottom: 32px;
}
@media (max-width: 640px) {
  .sk-support__grid { grid-template-columns: 1fr; }
  .sk-support { padding: 0 16px 72px; }
}
.sk-faq {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 14px; padding: 18px 20px;
  transition: border-color 0.22s;
}
.sk-faq:hover { border-color: rgba(255,138,42,0.25); }
.sk-faq__q {
  font-size: 13.5px; font-weight: 700; color: #fff;
  margin-bottom: 8px; line-height: 1.4;
}
.sk-faq__a {
  font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.6;
}
.sk-support__contact {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; flex-wrap: wrap;
  padding: 28px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px; text-align: center;
}
.sk-support__contact-text {
  font-size: 14px; color: rgba(255,255,255,0.6);
}
.sk-support__contact-text strong { color: #fff; }
.sk-support__email {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px; border-radius: 999px;
  background: rgba(255,138,42,0.12);
  border: 1px solid rgba(255,138,42,0.3);
  color: #ff8a2a; font-size: 13px; font-weight: 600;
  text-decoration: none; transition: background 0.2s, transform 0.2s;
  cursor: pointer;
}
.sk-support__email:hover {
  background: rgba(255,138,42,0.2); transform: translateY(-1px);
}
`;

export default function LandingPage() {
  const nav = useNavigate();
  const landingRef = useRef(null);

  // ── Time-aware background ──
  const [timePeriod, setTimePeriod] = useState(() =>
    getTimePeriod(new Date().getHours())
  );

  useEffect(() => {
    if (landingRef.current) {
      landingRef.current.setAttribute("data-time", timePeriod);
    }
    const interval = setInterval(() => {
      const next = getTimePeriod(new Date().getHours());
      setTimePeriod(next);
      if (landingRef.current) {
        landingRef.current.setAttribute("data-time", next);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [timePeriod]);

  const timeMeta = TIME_PERIODS[timePeriod];

  // ── Trip state ──
  const [q, setQ] = useState(
    "10-day Japan trip under $2,500 with cherry blossoms"
  );
  const [showSuggestion, setShowSuggestion] = useState(true);
  const [isRouting, setIsRouting] = useState(false);

  // ── Atlas chat animation ──
  const [visibleBubbles, setVisibleBubbles] = useState(1);
  useEffect(() => {
    if (visibleBubbles >= ATLAS_CONVERSATION.length) return;
    const delay = visibleBubbles === 1 ? 1400 : 1800;
    const t = setTimeout(() => setVisibleBubbles((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visibleBubbles]);

  // ── FAQ accordion ──
  const [openFaq, setOpenFaq] = useState(null);

  const suggestion = useMemo(
    () => ({
      title: "Skyrio AI Suggestion",
      trip: "Tokyo + Kyoto",
      dates: "April 5–15",
      total: 1462,
      fit: "Excellent budget match",
      planKey: "tokyo-kyoto",
      destination: "Japan",
      vibe: "Culture-rich city escape",
      summary:
        "A culture-rich spring route with strong budget balance, city energy, and cherry blossom timing.",
    }),
    []
  );

  const examples = useMemo(
    () => [
      {
        key: "japan",
        title: "Japan",
        subtitle: "Cherry Blossom Trip",
        meta: "Built in 8 seconds",
        img: "https://images.unsplash.com/photo-1549693578-d683be217e58?auto=format&fit=crop&w=1200&q=70",
        destination: "Japan",
        vibe: "Cherry blossom season",
      },
      {
        key: "miami",
        title: "Miami Weekend",
        subtitle: "Under $600",
        meta: "Fast warm-weather escape",
        img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=70",
        destination: "Miami",
        vibe: "Quick warm-weather getaway",
      },
      {
        key: "paris",
        title: "Paris Luxury",
        subtitle: "Honeymoon",
        meta: "Romantic premium route",
        img: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1200&q=70",
        destination: "Paris",
        vibe: "Luxury romantic escape",
      },
    ],
    []
  );

  const handleQueryChange = useCallback((e) => {
    const next = e.target.value;
    setQ(next);
    setShowSuggestion(next.trim().length >= 8);
  }, []);

  const goPlan = useCallback(async () => {
    const prompt = normalizePrompt(q);
    if (!prompt) {
      message.info("Add a destination or budget to start planning.");
      return;
    }
    try {
      setIsRouting(true);
      await trackPassportEvent("AI_PROMPT_SUBMITTED", {
        source: "landing_hero",
        prompt,
        promptLength: prompt.length,
        suggestionVisible: prompt.length >= 8,
      });
      nav(`/booking?prompt=${encodeURIComponent(prompt)}`);
    } finally {
      setIsRouting(false);
    }
  }, [q, nav]);

  const viewPlan = useCallback(async () => {
    const prompt = normalizePrompt(q);
    try {
      setIsRouting(true);
      await trackPassportEvent("AI_PLAN_VIEWED", {
        source: "landing_suggestion",
        prompt,
        planKey: suggestion.planKey,
        trip: suggestion.trip,
        destination: suggestion.destination,
        dates: suggestion.dates,
        total: suggestion.total,
        vibe: suggestion.vibe,
      });
      nav(
        `/booking?plan=${encodeURIComponent(
          suggestion.planKey
        )}&prompt=${encodeURIComponent(prompt)}`
      );
    } finally {
      setIsRouting(false);
    }
  }, [q, nav, suggestion]);

  const openExamplePlan = useCallback(
    async (card) => {
      try {
        setIsRouting(true);
        await trackPassportEvent("EXAMPLE_TRIP_OPENED", {
          source: "landing_examples",
          exampleKey: card.key,
          title: card.title,
          subtitle: card.subtitle,
          destination: card.destination,
          vibe: card.vibe,
        });
        nav(`/booking?example=${encodeURIComponent(card.key)}`);
      } finally {
        setIsRouting(false);
      }
    },
    [nav]
  );

  const goSignup = useCallback(() => nav("/signup"), [nav]);
  const goPassport = useCallback(() => nav("/passport"), [nav]);

  return (
    <div
      className="sk-landing"
      ref={landingRef}
      data-time={timePeriod}
      style={{ "--sk-hero-bg": `url(${heroBg})` }}
    >
      {/* Inject new section styles */}
      <style>{INJECTED_CSS}</style>

      <div className="sk-landing__bg" />

      {/* Time badge */}
      <div className="sk-time-badge">
        <span className="sk-time-dot" />
        {timeMeta.label} mode
      </div>

      <div className="sk-landing__content">
        {/* ── Hero ── */}
        <header className="sk-hero">
          <div className="sk-hero__eyebrow">AI-powered travel planning</div>
          <h1 className="sk-hero__title">
            Plan smarter.
            <br />
            Travel better.
          </h1>
          <p className="sk-hero__sub">
            Skyrio helps you turn one travel idea into a smarter plan, faster.
          </p>

          <div className="sk-hero__search">
            <Input
              size="large"
              prefix={<SearchOutlined />}
              value={q}
              onChange={handleQueryChange}
              onPressEnter={goPlan}
              placeholder='Try: "Japan in April under $2500"'
              className="sk-searchInput"
              disabled={isRouting}
            />
            <Button
              size="large"
              type="primary"
              className="sk-cta"
              onClick={goPlan}
              loading={isRouting}
            >
              Plan my trip
            </Button>
          </div>

          <div className="sk-hero__quickActions">
            <button
              type="button"
              className="sk-quickChip"
              onClick={() =>
                setQ("Tokyo in April with food spots and a $2,000 budget")
              }
              disabled={isRouting}
            >
              Tokyo in April
            </button>
            <button
              type="button"
              className="sk-quickChip"
              onClick={() => setQ("Miami weekend for two under $600")}
              disabled={isRouting}
            >
              Miami under $600
            </button>
            <button
              type="button"
              className="sk-quickChip"
              onClick={() => setQ("Paris honeymoon with premium stay ideas")}
              disabled={isRouting}
            >
              Paris honeymoon
            </button>
          </div>

          <section
            className={`sk-suggestion ${showSuggestion ? "is-visible" : ""}`}
          >
            <div className="sk-suggestion__bar">
              <span className="sk-suggestion__bolt">
                <ThunderboltOutlined />
              </span>
              <span className="sk-suggestion__label">{suggestion.title}</span>
            </div>
            <div className="sk-suggestion__body">
              <div className="sk-suggestion__left">
                <div className="sk-suggestion__trip">
                  <span className="sk-suggestion__tripName">
                    {suggestion.trip}
                  </span>
                  <span className="sk-suggestion__dates">
                    {" "}
                    — {suggestion.dates}
                  </span>
                </div>
                <div className="sk-suggestion__fit">{suggestion.fit}</div>
                <div className="sk-suggestion__summary">
                  {suggestion.summary}
                </div>
              </div>
              <div className="sk-suggestion__right">
                <div className="sk-suggestion__total">
                  ${suggestion.total.toLocaleString()} <span>total</span>
                </div>
                <Button
                  className="sk-viewBtn"
                  onClick={viewPlan}
                  disabled={isRouting}
                >
                  View plan <ArrowRightOutlined />
                </Button>
              </div>
            </div>
          </section>
        </header>

        {/* ── Examples ── */}
        <section className="sk-examples">
          <div className="sk-examples__head">
            <h2 className="sk-examples__title">See what Skyrio can do</h2>
            <p className="sk-examples__sub">
              Explore fast ideas, then jump straight into planning.
            </p>
          </div>
          <div className="sk-examples__grid">
            {examples.map((card) => (
              <button
                key={card.key}
                className="sk-card"
                onClick={() => openExamplePlan(card)}
                type="button"
                disabled={isRouting}
              >
                <div
                  className="sk-card__media"
                  style={{ backgroundImage: `url(${card.img})` }}
                />
                <div className="sk-card__overlay" />
                <div className="sk-card__content">
                  <div className="sk-card__title">{card.title}</div>
                  <div className="sk-card__subtitle">{card.subtitle}</div>
                  {card.meta && (
                    <div className="sk-card__meta">{card.meta}</div>
                  )}
                  <div className="sk-card__footer">
                    <span>View Plan</span>
                    <ArrowRightOutlined />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="sk-footline">
            Travel planning should feel exciting, not overwhelming.
          </p>
        </section>

        {/* ── Meet Atlas ── */}
        <section className="sk-atlas">
          <div className="sk-atlas__head">
            <div className="sk-atlas__eyebrow">Meet your travel companion</div>
            <h2 className="sk-atlas__title">
              Say hello to <span className="sk-atlas__name">Atlas</span>
            </h2>
            <p className="sk-atlas__sub">
              Tell Atlas where you want to go, what you want to spend, and what
              matters to you — it handles everything else.
            </p>
          </div>

          <div className="sk-atlas__body">
            {/* Chat demo */}
            <div className="sk-atlas__chat">
              <div className="sk-atlas__chatHeader">
                <div className="sk-atlas__avatar">✦</div>
                <div>
                  <div className="sk-atlas__chatName">Atlas</div>
                  <div className="sk-atlas__chatStatus">
                    <span className="sk-atlas__statusDot" />
                    Always on
                  </div>
                </div>
              </div>
              <div className="sk-atlas__messages">
                {ATLAS_CONVERSATION.map((bubble, i) => {
                  if (i >= visibleBubbles) return null;
                  return (
                    <div
                      key={bubble.id}
                      className={`sk-atlas__bubble sk-atlas__bubble--${bubble.from}`}
                    >
                      {bubble.from === "atlas" && (
                        <div className="sk-atlas__bubbleAvatar">✦</div>
                      )}
                      <div className="sk-atlas__bubbleText">{bubble.text}</div>
                    </div>
                  );
                })}
                {visibleBubbles < ATLAS_CONVERSATION.length &&
                  ATLAS_CONVERSATION[visibleBubbles]?.from === "atlas" && (
                    <div className="sk-atlas__bubble sk-atlas__bubble--atlas">
                      <div className="sk-atlas__bubbleAvatar">✦</div>
                      <div className="sk-atlas__typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
              </div>
              <div className="sk-atlas__chatFooter">
                <div className="sk-atlas__fakeInput">
                  Ask Atlas anything about your trip...
                </div>
                <button
                  type="button"
                  className="sk-atlas__chatCta"
                  onClick={goPlan}
                >
                  Try Atlas →
                </button>
              </div>
            </div>

            {/* Features */}
            <div className="sk-atlas__features">
              {ATLAS_FEATURES.map((f) => (
                <div key={f.title} className="sk-atlas__feature">
                  <div className="sk-atlas__featureIcon">{f.icon}</div>
                  <div>
                    <div className="sk-atlas__featureTitle">{f.title}</div>
                    <div className="sk-atlas__featureDesc">{f.desc}</div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="sk-atlas__mainCta"
                onClick={goPlan}
                disabled={isRouting}
              >
                Start planning with Atlas{" "}
                <ArrowRightOutlined style={{ marginLeft: 8 }} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Passport / Rewards Banner ── */}
        <section className="sk-passport-banner">
          <div className="sk-passport-banner__left">
            <div className="sk-passport-banner__badge">✦ Skyrio Passport</div>
            <h2 className="sk-passport-banner__title">
              Every trip earns you
              <br />
              <span>rewards, rank, and recognition.</span>
            </h2>
            <p className="sk-passport-banner__sub">
              Create a free account and your Skyrio Passport activates
              instantly. Search, save, and book your way to Explorer,
              Adventurer, and Legend status — with real travel rewards along the
              way.
            </p>
            <div className="sk-passport-banner__perks">
              {PASSPORT_PERKS.map((p) => (
                <div key={p.label} className="sk-passport-perk">
                  <div className="sk-passport-perk__icon">{p.icon}</div>
                  <div>
                    <div className="sk-passport-perk__label">{p.label}</div>
                    <div className="sk-passport-perk__desc">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="sk-passport-banner__right">
            {/* Passport card preview */}
            <div className="sk-passport-card">
              <div className="sk-passport-card__top">
                <div className="sk-passport-card__logo">SKYRIO</div>
                <div className="sk-passport-card__chip" />
              </div>
              <div className="sk-passport-card__name">Your Passport</div>
              <div className="sk-passport-card__level">Explorer ✦</div>
              <div className="sk-passport-card__xp-label">XP Progress</div>
              <div className="sk-passport-card__bar">
                <div className="sk-passport-card__fill" />
              </div>
            </div>
            <Button
              className="sk-passport-banner__cta"
              onClick={goSignup}
              disabled={isRouting}
            >
              Create free account{" "}
              <ArrowRightOutlined style={{ marginLeft: 6 }} />
            </Button>
            <div className="sk-passport-banner__note">
              Free forever · No credit card required
            </div>
          </div>
        </section>

        {/* ── Support / FAQ ── */}
        <section className="sk-support">
          <div className="sk-support__head">
            <div className="sk-support__eyebrow">Got questions?</div>
            <h2 className="sk-support__title">We've got answers</h2>
            <p className="sk-support__sub">
              Everything you need to know before your first booking.
            </p>
          </div>
          <div className="sk-support__grid">
            {SUPPORT_FAQS.map((faq) => (
              <div key={faq.q} className="sk-faq">
                <div className="sk-faq__q">{faq.q}</div>
                <div className="sk-faq__a">{faq.a}</div>
              </div>
            ))}
          </div>
          <div className="sk-support__contact">
            <div className="sk-support__contact-text">
              Still have questions? <strong>Our team is here to help.</strong>
            </div>
            <a
              href="mailto:skyriooffcial@gmail.com"
              className="sk-support__email"
            >
              ✉️ skyriooffcial@gmail.com
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
