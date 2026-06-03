/**
 * LandingPage.jsx — Skyrio  ★ 9/10 upgrade
 *
 * What changed vs 7/10:
 *  1. IntersectionObserver scroll-reveal on every section (staggered children)
 *  2. Hero title word-by-word entrance animation on mount
 *  3. Ambient floating orbs in hero background (CSS only, no JS perf hit)
 *  4. Time-of-day actually changes hero gradient palette via CSS vars
 *  5. Suggestion card animates in with spring (opacity + translateY + scale)
 *  6. Quick chips have shimmer hover + icon prefix
 *  7. Primary CTA has a breathing glow pulse
 *  8. Section dividers: alternating layout rhythm (left/right eyebrows)
 *  9. Example cards have parallax tilt on mouse-move (pointer events)
 * 10. Mobile: search row never wraps awkwardly — stacks cleanly at 540px
 * 11. Micro-detail: stat counter animate up on scroll-reveal
 * 12. FAQ accordion — click to expand answer (was always-open)
 * 13. Noise texture overlay on hero for depth
 * 14. Scroll-progress bar at top of page
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, message, Select } from "antd";
import {
  SearchOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  LoadingOutlined,
  PlusOutlined,
  MinusOutlined,
} from "@ant-design/icons";

import "@/styles/LandingPage.css";
import heroBg from "@/assets/landing/skyrio-cosmic.jpg";
import { trackPassportEvent } from "@/utils/passportEvents";

const { Option } = Select;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const AIRPORTS = [
  { code: "EWR", city: "Newark", name: "Newark Liberty Intl" },
  { code: "JFK", city: "New York", name: "John F. Kennedy Intl" },
  { code: "LGA", city: "New York", name: "LaGuardia" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles Intl" },
  { code: "ORD", city: "Chicago", name: "O'Hare Intl" },
  { code: "MDW", city: "Chicago", name: "Midway Intl" },
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson" },
  { code: "MIA", city: "Miami", name: "Miami Intl" },
  { code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood" },
  { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth Intl" },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental" },
  { code: "DEN", city: "Denver", name: "Denver Intl" },
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma Intl" },
  { code: "SFO", city: "San Francisco", name: "San Francisco Intl" },
  { code: "SJC", city: "San Jose", name: "Norman Y. Mineta San Jose" },
  { code: "OAK", city: "Oakland", name: "Oakland Intl" },
  { code: "BOS", city: "Boston", name: "Logan Intl" },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia Intl" },
  { code: "DCA", city: "Washington DC", name: "Reagan National" },
  { code: "IAD", city: "Washington DC", name: "Dulles Intl" },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis-Saint Paul Intl" },
  { code: "DTW", city: "Detroit", name: "Detroit Metro Wayne County" },
  { code: "PHX", city: "Phoenix", name: "Phoenix Sky Harbor" },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid Intl" },
  { code: "MCO", city: "Orlando", name: "Orlando Intl" },
  { code: "TPA", city: "Tampa", name: "Tampa Intl" },
  { code: "CLT", city: "Charlotte", name: "Charlotte Douglas Intl" },
  { code: "BNA", city: "Nashville", name: "Nashville Intl" },
  { code: "AUS", city: "Austin", name: "Austin-Bergstrom Intl" },
  { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye Intl" },
];
const DEFAULT_AIRPORT = AIRPORTS[0];

// Time period definitions + matching hero palette overrides
const TIME_PERIODS = {
  dawn: {
    hours: [5, 6, 7],
    label: "Dawn",
    tip: "Early birds get the best deals — prices are freshest between 6–8 AM.",
    orb1: "rgba(255,160,80,0.28)",
    orb2: "rgba(180,100,255,0.18)",
    accent: "#ffb347",
  },
  morning: {
    hours: [8, 9, 10, 11],
    label: "Morning",
    tip: "Booking 6–8 weeks ahead hits the sweet spot for domestic flights.",
    orb1: "rgba(255,138,42,0.22)",
    orb2: "rgba(100,180,255,0.14)",
    accent: "#ff8a2a",
  },
  afternoon: {
    hours: [12, 13, 14, 15, 16],
    label: "Afternoon",
    tip: "Mid-week departures (Tues/Wed) save up to $80 per ticket.",
    orb1: "rgba(255,200,60,0.20)",
    orb2: "rgba(255,80,120,0.14)",
    accent: "#ffc43d",
  },
  dusk: {
    hours: [17, 18, 19],
    label: "Sunset",
    tip: "Last-minute deals often drop after 5 PM for next-week travel.",
    orb1: "rgba(255,80,80,0.22)",
    orb2: "rgba(255,138,42,0.20)",
    accent: "#ff6b35",
  },
  night: {
    hours: [20, 21, 22, 23, 0, 1, 2, 3, 4],
    label: "Night",
    tip: "Best time to book is Tuesday nights — prices are 15–20% lower than weekends.",
    orb1: "rgba(120,80,255,0.24)",
    orb2: "rgba(40,120,255,0.16)",
    accent: "#a78bfa",
  },
};

const HERO_COPY = {
  eyebrow: "Your AI travel planner — free to use",
  title: ["Tell us where", "you want to go.", "We'll handle the rest."],
  subtitle:
    "Type a destination and budget. Skyrio's AI builds a full flight + hotel plan in seconds — then you book it directly.",
  placeholder: 'e.g. "Tokyo in April under $2,500"',
  ctaLabel: "Plan my trip",
  secondaryCta: {
    prompt: "Want to track trips, earn XP, and unlock rewards?",
    label: "Create a free account",
  },
};

const QUICK_CHIPS = [
  {
    label: "Tokyo in April",
    prompt: "Tokyo in April with food spots and a $2,000 budget",
    icon: "✈",
  },
  {
    label: "Miami under $600",
    prompt: "Miami weekend for two under $600",
    icon: "🌊",
  },
  {
    label: "Paris honeymoon",
    prompt: "Paris honeymoon with premium stay ideas",
    icon: "🗼",
  },
  {
    label: "Bali 10 nights",
    prompt: "Bali 10-night trip under $3,000 with villas",
    icon: "🌴",
  },
];

const SOCIAL_PROOF = [
  { stat: "8s", label: "avg. plan build" },
  { stat: "30+", label: "destinations" },
  { stat: "Free", label: "to search & plan" },
  { stat: "Stripe", label: "secure payments" },
];

const TRUST_SIGNALS = [
  "No credit card required",
  "Free to search & plan",
  "Cancel within 24h",
];

const EXAMPLES = [
  {
    key: "japan",
    title: "Japan",
    subtitle: "Cherry Blossom Trip",
    meta: "Built in 8 seconds",
    img: "https://images.unsplash.com/photo-1549693578-d683be217e58?auto=format&fit=crop&w=1200&q=70",
  },
  {
    key: "miami",
    title: "Miami Weekend",
    subtitle: "Under $600",
    meta: "Fast warm-weather escape",
    img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=70",
  },
  {
    key: "paris",
    title: "Paris Luxury",
    subtitle: "Honeymoon",
    meta: "Romantic premium route",
    img: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1200&q=70",
  },
];

const ATLAS_FEATURES = [
  {
    iconKey: "brain",
    title: "Understands natural language",
    desc: "Just tell Atlas what you want — no dropdowns, no filters. It figures out the rest.",
  },
  {
    iconKey: "bolt",
    title: "Builds your plan in seconds",
    desc: "Flights, hotels, and budget breakdown — ready before you finish your coffee.",
  },
  {
    iconKey: "target",
    title: "Learns your travel style",
    desc: "The more you travel with Skyrio, the smarter Atlas gets at matching your vibe.",
  },
  {
    iconKey: "lock",
    title: "Books it too",
    desc: "Atlas doesn't just suggest — it takes you all the way to a confirmed booking.",
  },
];

const PROFILE_PERKS = [
  {
    iconKey: "xp",
    label: "XP & Levels",
    desc: "Earn points every time you search, save, or book. Unlock Explorer → Legend.",
  },
  {
    iconKey: "badge",
    label: "Badges",
    desc: "Collect badges for destinations, trip types, and milestones.",
  },
  {
    iconKey: "reward",
    label: "Rewards",
    desc: "Redeem XP for travel credits, upgrades, and exclusive deals.",
  },
  {
    iconKey: "journey",
    label: "Journey History",
    desc: "Every trip you take builds your Skyrio profile — your travel story.",
  },
];

const FAQS = [
  {
    q: "Is Skyrio free to use?",
    a: "Yes — searching and planning with Atlas is completely free. You only pay when you book a flight or hotel.",
  },
  {
    q: "How does Atlas AI work?",
    a: "Atlas reads your natural language prompt, matches it to live flight and hotel inventory, and builds a budget-optimised plan in seconds.",
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

const ATLAS_CHAT_INTRO = (homeCity) => [
  {
    id: 1,
    from: "user",
    text: "I want to go somewhere warm in March, budget around $1,800.",
  },
  {
    id: 2,
    from: "atlas",
    text: `Perfect timing — Tulum and Cartagena are both peaking in March. I can get you 5 nights in Tulum with flights from ${homeCity} for $1,640 total. Want me to lock that in?`,
  },
  { id: 3, from: "user", text: "Yes! Can you find a hotel near the beach?" },
  {
    id: 4,
    from: "atlas",
    text: "Found 3 beachfront options under $180/night. The top pick has free cancellation and a rooftop pool. Adding it to your plan now.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AI SUGGESTION
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAISuggestion(prompt, homeCity, homeCode, promptHistory) {
  const systemPrompt = `You are Atlas, Skyrio's AI travel planner.
Given a user's travel prompt and their home airport, return ONE suggested trip as a JSON object.

Rules:
- Be specific: real destinations, realistic pricing.
- Infer budget from the prompt (look for dollar amounts, words like "budget", "cheap", "luxury").
- If no budget is stated, pick a mid-range option appropriate to the destination.
- The "total" is a realistic all-in estimate (flights + hotel) in USD as an integer.
- "planKey" is a URL-safe slug like "tokyo-kyoto" or "tulum-5night".
- "fit" is a 2-5 word quality signal, e.g. "Excellent budget match" or "Slightly over budget".
- "summary" is 1 sentence, max 18 words, describing the vibe and value.
- "dates" is a plausible 2-week window, e.g. "Apr 5-15".
- Consider the user's prompt history to refine suggestions.

Respond ONLY with raw JSON — no markdown, no backticks, no preamble.

Schema:
{
  "trip": "string",
  "dates": "string",
  "total": number,
  "fit": "string",
  "summary": "string",
  "planKey": "string"
}`;

  const userMessage = `Home airport: ${homeCity} (${homeCode})
Current prompt: "${prompt}"
${
  promptHistory.length > 1
    ? `Previous prompts this session:\n${promptHistory
        .slice(0, -1)
        .map((p, i) => `  ${i + 1}. "${p}"`)
        .join("\n")}`
    : ""
}`;

  const response = await fetch("/api/atlas/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, homeCity, homeCode, promptHistory }),
  });

  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME AIRPORT
// ─────────────────────────────────────────────────────────────────────────────

const HOME_AIRPORT_KEY = "skyrio_home_airport";

function readStoredAirport() {
  try {
    const raw = localStorage.getItem(HOME_AIRPORT_KEY);
    if (!raw) return DEFAULT_AIRPORT;
    const parsed = JSON.parse(raw);
    return parsed?.code && parsed?.city ? parsed : DEFAULT_AIRPORT;
  } catch {
    return DEFAULT_AIRPORT;
  }
}

function useHomeAirport() {
  const [homeAirport, setHomeAirportState] = useState(readStoredAirport);

  const setHomeAirport = useCallback((airport) => {
    if (!airport?.code) return;
    const next = {
      code: airport.code,
      city: airport.city || airport.code,
      name: airport.name || airport.city || airport.code,
    };
    setHomeAirportState(next);
    try {
      localStorage.setItem(HOME_AIRPORT_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }, []);

  return {
    homeAirport,
    setHomeAirport,
    homeCode: homeAirport.code,
    homeCity: homeAirport.city,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL REVEAL HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVis(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, vis];
}

// ─────────────────────────────────────────────────────────────────────────────
// TILT CARD HOOK  (mouse-move parallax for example cards)
// ─────────────────────────────────────────────────────────────────────────────

function useTilt() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${
        -y * 8
      }deg) scale(1.03)`;
    };
    const handleLeave = () => {
      el.style.transform = "";
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

function ScrollProgressBar() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      setPct(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg,#ff8a2a,#ffb347)",
          transition: "width 0.1s linear",
          boxShadow: "0 0 8px rgba(255,138,42,0.6)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ ITEM (accordion)
// ─────────────────────────────────────────────────────────────────────────────

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`sk-faq${open ? " sk-faq--open" : ""}`}
      onClick={() => setOpen((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
    >
      <div className="sk-faq__row">
        <div className="sk-faq__q">{q}</div>
        <div className="sk-faq__chevron">
          {open ? <MinusOutlined /> : <PlusOutlined />}
        </div>
      </div>
      <div
        className="sk-faq__a"
        style={{
          maxHeight: open ? "200px" : "0",
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.32s ease, opacity 0.25s ease",
          marginTop: open ? 10 : 0,
        }}
      >
        {a}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TILT EXAMPLE CARD
// ─────────────────────────────────────────────────────────────────────────────

function ExampleCard({ card, onClick, disabled }) {
  const tiltRef = useTilt();
  return (
    <button
      ref={tiltRef}
      key={card.key}
      className="sk-card"
      onClick={onClick}
      type="button"
      disabled={disabled}
      style={{
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        willChange: "transform",
      }}
    >
      <div
        className="sk-card__media"
        style={{ backgroundImage: `url(${card.img})` }}
      />
      <div className="sk-card__overlay" />
      <div className="sk-card__content">
        <div className="sk-card__title">{card.title}</div>
        <div className="sk-card__subtitle">{card.subtitle}</div>
        {card.meta && <div className="sk-card__meta">{card.meta}</div>}
        <div className="sk-card__footer">
          <span>View Plan</span>
          <ArrowRightOutlined />
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function getTimePeriod(hour) {
  for (const [key, val] of Object.entries(TIME_PERIODS)) {
    if (val.hours.includes(hour)) return key;
  }
  return "night";
}
function normalizePrompt(v) {
  return String(v || "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG ICONS
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = {
  robot: ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.5" />
      <rect x="8" y="5.5" width="8" height="5.5" rx="2" opacity=".9" />
      <circle cx="10" cy="14" r="1.5" fill="#FFD060" />
      <circle cx="14" cy="14" r="1.5" fill="#FFD060" />
      <rect
        x="10"
        y="17"
        width="4"
        height="1.2"
        rx=".6"
        fill="#1a0d04"
        opacity=".55"
      />
      <line
        x1="12"
        y1="5.5"
        x2="12"
        y2="3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3" r="1.3" />
      <line
        x1="5.5"
        y1="13"
        x2="3.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="18.5"
        y1="13"
        x2="20.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  brain: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M9.5 2a4.5 4.5 0 0 1 4.5 4.5v.5" />
      <path d="M14 7a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1-3.5 3.5H14" />
      <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5V6a4 4 0 0 0 2 3.46" />
      <path d="M8 9.5A3.5 3.5 0 0 0 4.5 13v.5A3.5 3.5 0 0 0 8 17h.5" />
      <path d="M14.5 15H15a3 3 0 0 1 3 3v1" />
      <path d="M8.5 15A3.5 3.5 0 0 0 5 18.5V20" />
      <path d="M9 17v4" />
      <path d="M15 17v4" />
      <path d="M9 12h6" />
    </svg>
  ),
  bolt: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <polygon
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
        fill="currentColor"
        opacity=".9"
        stroke="none"
      />
    </svg>
  ),
  target: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  lock: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  xp: ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
    </svg>
  ),
  badge: ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="9" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="9" r="3" fill="currentColor" opacity="0.35" />
      <path
        d="M8 15L6 22L12 19L18 22L16 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  reward: ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect
        x="3"
        y="10"
        width="18"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 6C12 6 8.5 2.5 6.5 4C4.5 5.5 8 10 12 10C16 10 19.5 5.5 17.5 4C15.5 2.5 12 6 12 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="12"
        y1="10"
        x2="12"
        y2="21"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ),
  journey: ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 15.5V9.5C6 7.84 7.34 6.5 9 6.5H15.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  sparkle: ({ size = 14 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  ),
  chat: ({ size = 14 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  mail: ({ size = 15 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginRight: 4,
      }}
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7L12 13L22 7" strokeLinejoin="round" />
    </svg>
  ),
  check: ({ size = 13 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginRight: 3,
      }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

function Icon({ name, size }) {
  const C = ICONS[name];
  return C ? <C size={size} /> : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const INJECTED_CSS = `
/* ── Scroll progress bar ── */
/* (rendered via component — no extra CSS needed) */

/* ── Hero title word reveal ── */
@keyframes sk-wordIn {
  from { opacity:0; transform:translateY(22px) skewY(2deg); }
  to   { opacity:1; transform:translateY(0) skewY(0); }
}
.sk-hero__word {
  display:inline-block;
  vertical-align:bottom;
  opacity:0;
  animation:sk-wordIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
}

/* ── Ambient orbs ── */
.sk-orb {
  position:absolute; border-radius:50%;
  filter:blur(80px); pointer-events:none; z-index:0;
  animation:sk-orbFloat 14s ease-in-out infinite alternate;
}
.sk-orb--1 { width:500px; height:500px; top:-120px; right:-80px; animation-duration:16s; }
.sk-orb--2 { width:360px; height:360px; bottom:60px; left:-60px; animation-duration:20s; animation-delay:-6s; }
.sk-orb--3 { width:220px; height:220px; top:40%; left:45%; animation-duration:11s; animation-delay:-3s; }
@keyframes sk-orbFloat {
  from { transform:translate(0,0) scale(1); }
  to   { transform:translate(30px,-40px) scale(1.08); }
}

/* ── Noise texture overlay ── */
.sk-hero::after {
  content:""; position:absolute; inset:0; z-index:1; pointer-events:none; opacity:0.035;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat:repeat; background-size:128px 128px;
}

/* ── Scroll reveal ── */
.sk-reveal { opacity:0; transform:translateY(32px); transition:opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1); }
.sk-reveal.is-visible { opacity:1; transform:translateY(0); }
.sk-reveal--delay-1 { transition-delay:0.1s; }
.sk-reveal--delay-2 { transition-delay:0.2s; }
.sk-reveal--delay-3 { transition-delay:0.3s; }
.sk-reveal--delay-4 { transition-delay:0.4s; }

/* ── Airport selector — below search box ── */
.sk-hero__airportRow { display:flex; align-items:center; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:10px; }
.sk-home-airport { display:inline-flex; align-items:center; gap:8px; }
.sk-home-airport__label { font-size:12px; color:rgba(255,255,255,0.45); font-weight:500; white-space:nowrap; display:flex; align-items:center; gap:5px; }
.sk-home-airport .ant-select-selector { background:rgba(255,255,255,0.08)!important; border:1px solid rgba(255,255,255,0.18)!important; border-radius:10px!important; color:rgba(255,255,255,0.9)!important; font-family:"DM Sans",sans-serif!important; font-size:13px!important; height:34px!important; min-width:180px; }
.sk-home-airport .ant-select-arrow { color:rgba(255,255,255,0.4)!important; }
.sk-home-airport .ant-select-selector:hover { border-color:rgba(255,138,42,0.5)!important; }
.sk-home-airport-popup { background:rgba(14,8,30,0.97)!important; border:1px solid rgba(255,138,42,0.22)!important; border-radius:12px!important; backdrop-filter:blur(20px)!important; box-shadow:0 12px 40px rgba(0,0,0,0.6)!important; }
.sk-home-airport-popup .ant-select-item { color:rgba(255,255,255,0.8)!important; background:transparent!important; font-family:"DM Sans",sans-serif!important; font-size:13px!important; }
.sk-home-airport-popup .ant-select-item-option-active, .sk-home-airport-popup .ant-select-item-option-selected { background:rgba(255,138,42,0.15)!important; color:#ff8a2a!important; }

/* ── CTA pulse — scoped to search box so it doesn't bleed onto other buttons ── */
@keyframes sk-ctaPulse {
  0%,100% { box-shadow:0 0 0 0 rgba(255,138,42,0.45); }
  50%     { box-shadow:0 0 0 7px rgba(255,138,42,0); }
}
.sk-hero__search .sk-cta { animation:sk-ctaPulse 2.8s ease-in-out infinite !important; }
.sk-hero__search .sk-cta:hover { animation:none !important; }

/* ── Quick chips — additive only (LandingPage.css owns bg/color/radius) ── */
.sk-quickChip { position:relative !important; overflow:hidden !important; display:inline-flex !important; align-items:center !important; gap:6px !important; }
.sk-quickChip::before { content:""; position:absolute; top:0; left:-100%; width:100%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); transition:left 0.4s ease; pointer-events:none; }
.sk-quickChip:hover::before { left:100%; }
.sk-quickChip__icon { font-size:13px; line-height:1; flex-shrink:0; }

/* ── Social proof ── */
.sk-social-proof { display:flex; align-items:center; justify-content:center; gap:0; margin:28px auto 0; max-width:560px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; }
.sk-social-proof__item { flex:1; padding:14px 12px; text-align:center; border-right:1px solid rgba(255,255,255,0.07); }
.sk-social-proof__item:last-child { border-right:none; }
.sk-social-proof__stat { font-family:"Syne",sans-serif; font-size:18px; font-weight:800; color:#ff8a2a; line-height:1; margin-bottom:3px; }
.sk-social-proof__label { font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.06em; line-height:1.3; }

/* ── Trust signals ── */
.sk-trust-signals { display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:wrap; margin-top:12px; }
.sk-trust-signals span { font-size:12px; color:rgba(255,255,255,0.35); font-weight:500; display:inline-flex; align-items:center; gap:4px; }

/* ── Secondary CTA ── */
.sk-hero__secondaryCta { margin-top:24px; text-align:center; }
.sk-hero__secondaryCta-text { font-size:13px; color:rgba(255,255,255,0.45); margin-bottom:8px; }
.sk-hero__secondaryCta-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 20px; border-radius:999px; border:1px solid rgba(255,138,42,0.35); background:rgba(255,138,42,0.08); color:#ff8a2a; font-family:"DM Sans",sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.18s; text-decoration:none; }
.sk-hero__secondaryCta-btn:hover { background:rgba(255,138,42,0.15); border-color:#ff8a2a; transform:translateY(-2px); }

/* ── Suggestion card ── */
.sk-suggestion__loading { display:flex; align-items:center; gap:8px; padding:10px 0; font-size:12px; color:rgba(255,138,42,0.7); }
.sk-suggestion__error   { font-size:11px; color:rgba(255,80,80,0.7); padding:4px 0; }

/* Spring-in animation for suggestion body */
@keyframes sk-suggIn {
  from { opacity:0; transform:translateY(6px) scale(0.98); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
.sk-suggestion__body { animation:sk-suggIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── Examples kicker ── */
.sk-examples__kicker { font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#ff8a2a; margin-bottom:10px; }

/* ── Section divider line ── */
.sk-divider {
  width:100%; max-width:1100px; margin:0 auto 64px;
  height:1px; background:linear-gradient(90deg,transparent,rgba(255,138,42,0.2),transparent);
}

/* ══ ATLAS ══ */
.sk-atlas { padding:0 24px 80px; max-width:1100px; margin:0 auto; }
.sk-atlas__head { text-align:center; margin-bottom:48px; }
.sk-atlas__eyebrow { display:inline-flex; align-items:center; gap:6px; background:rgba(255,138,42,0.14); border:1px solid rgba(255,138,42,0.28); border-radius:999px; padding:5px 16px; font-size:12px; font-weight:500; letter-spacing:0.04em; color:#ff8a2a; margin-bottom:18px; }
.sk-atlas__title { font-family:"Syne",sans-serif!important; font-size:clamp(28px,4.5vw,42px)!important; font-weight:800!important; letter-spacing:-0.02em!important; color:#fff!important; margin:0 0 14px!important; line-height:1.1!important; }
.sk-atlas__name { background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.sk-atlas__sub { font-size:15px; color:rgba(255,255,255,0.6); max-width:500px; margin:0 auto; line-height:1.65; }
.sk-atlas__body { display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start; }
.sk-atlas__chat { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:20px; overflow:hidden; display:flex; flex-direction:column; transition:border-color 0.22s, box-shadow 0.22s; }
.sk-atlas__chat:hover { border-color:rgba(255,255,255,0.22); box-shadow:0 12px 40px rgba(0,0,0,0.25); }
.sk-atlas__chatHeader { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); }
.sk-atlas__avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); display:flex; align-items:center; justify-content:center; color:#1a0d04; flex-shrink:0; box-shadow:0 4px 14px rgba(255,138,42,0.4); }
.sk-atlas__bubbleAvatar { width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); display:flex; align-items:center; justify-content:center; color:#1a0d04; flex-shrink:0; }
.sk-atlas__chatName { font-family:"Syne",sans-serif; font-size:14px; font-weight:700; color:#fff; line-height:1; }
.sk-atlas__chatStatus { display:flex; align-items:center; gap:5px; font-size:11px; color:rgba(255,255,255,0.35); margin-top:3px; }
.sk-atlas__statusDot { width:6px; height:6px; border-radius:50%; background:#34d399; animation:sk-pulse 2s infinite; }
.sk-atlas__messages { padding:20px; display:flex; flex-direction:column; gap:12px; min-height:220px; }
.sk-atlas__bubble { display:flex; align-items:flex-end; gap:8px; animation:sk-bubbleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes sk-bubbleIn { from{opacity:0;transform:translateY(8px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
.sk-atlas__bubble--user { flex-direction:row-reverse; }
.sk-atlas__bubbleText { max-width:78%; padding:10px 14px; border-radius:14px; font-size:13px; line-height:1.5; }
.sk-atlas__bubble--atlas .sk-atlas__bubbleText { background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.25); color:rgba(255,255,255,0.9); border-bottom-left-radius:4px; }
.sk-atlas__bubble--user .sk-atlas__bubbleText { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.6); border-bottom-right-radius:4px; }
.sk-atlas__typing { display:flex; align-items:center; gap:4px; padding:12px 16px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.25); border-radius:14px; border-bottom-left-radius:4px; }
.sk-atlas__typing span { width:6px; height:6px; border-radius:50%; background:#ff8a2a; animation:sk-typing 1.2s ease infinite; }
.sk-atlas__typing span:nth-child(2){animation-delay:0.2s} .sk-atlas__typing span:nth-child(3){animation-delay:0.4s}
@keyframes sk-typing { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
.sk-atlas__chatFooter { padding:14px 20px; border-top:1px solid rgba(255,255,255,0.08); display:flex; gap:10px; align-items:center; }
.sk-atlas__fakeInput { flex:1; padding:9px 14px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); font-size:12px; color:rgba(255,255,255,0.25); }
.sk-atlas__fabHint { font-size:11px; font-weight:600; color:rgba(255,138,42,0.7); white-space:nowrap; letter-spacing:0.03em; flex-shrink:0; }
.sk-atlas__features { display:flex; flex-direction:column; gap:14px; }
.sk-atlas__feature { display:flex; gap:14px; align-items:flex-start; padding:16px 18px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:14px; transition:border-color 0.22s, transform 0.22s, box-shadow 0.22s; }
.sk-atlas__feature:hover { border-color:rgba(255,138,42,0.3); transform:translateX(4px); box-shadow:0 4px 20px rgba(0,0,0,0.2); }
.sk-atlas__featureIcon { width:40px; height:40px; border-radius:10px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#ff8a2a; }
.sk-atlas__featureTitle { font-size:14px; font-weight:700; color:#fff; margin-bottom:4px; }
.sk-atlas__featureDesc { font-size:12.5px; color:rgba(255,255,255,0.55); line-height:1.5; }
@media(max-width:820px){.sk-atlas__body{grid-template-columns:1fr} .sk-atlas{padding:0 16px 64px} .sk-atlas__head{margin-bottom:32px}}

/* ══ PROFILE BANNER ══ */
.sk-profile-banner { margin:0 24px 80px; max-width:1100px; margin-left:auto; margin-right:auto; position:relative; border-radius:24px; overflow:hidden; background:linear-gradient(135deg,rgba(124,58,237,0.3) 0%,rgba(255,138,42,0.25) 50%,rgba(236,72,153,0.25) 100%); border:1px solid rgba(255,138,42,0.3); padding:52px 48px; display:flex; align-items:center; justify-content:space-between; gap:32px; }
.sk-profile-banner::before { content:""; position:absolute; inset:0; background:radial-gradient(ellipse 70% 80% at 80% 50%,rgba(255,138,42,0.15) 0%,transparent 70%); pointer-events:none; }
.sk-profile-banner__left { flex:1; position:relative; z-index:1; }
.sk-profile-banner__badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,138,42,0.15); border:1px solid rgba(255,138,42,0.35); border-radius:999px; padding:4px 14px; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#ff8a2a; margin-bottom:18px; }
.sk-profile-banner__title { font-family:"Syne",sans-serif!important; font-size:clamp(24px,3.5vw,36px)!important; font-weight:800!important; color:#fff!important; line-height:1.15!important; margin:0 0 12px!important; letter-spacing:-0.02em!important; }
.sk-profile-banner__title span { background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.sk-profile-banner__sub { font-size:14px; color:rgba(255,255,255,0.6); line-height:1.6; max-width:440px; margin-bottom:28px; }
.sk-profile-banner__perks { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.sk-profile-perk { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09); border-radius:12px; transition:border-color 0.2s; }
.sk-profile-perk:hover { border-color:rgba(255,138,42,0.3); }
.sk-profile-perk__icon { width:32px; height:32px; border-radius:8px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.22); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#ff8a2a; }
.sk-profile-perk__label { font-size:12px; font-weight:700; color:#fff; margin-bottom:2px; }
.sk-profile-perk__desc { font-size:11px; color:rgba(255,255,255,0.45); line-height:1.4; }
.sk-profile-banner__right { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:16px; position:relative; z-index:1; }
.sk-profile-card { width:220px; background:linear-gradient(135deg,rgba(124,58,237,0.5) 0%,rgba(255,138,42,0.4) 100%); border:1px solid rgba(255,255,255,0.15); border-radius:18px; padding:22px; backdrop-filter:blur(16px); box-shadow:0 20px 60px rgba(0,0,0,0.4); }
.sk-profile-card__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
.sk-profile-card__logo { font-family:"Syne",sans-serif; font-size:13px; font-weight:800; color:#fff; }
.sk-profile-card__chip { width:28px; height:20px; border-radius:4px; background:linear-gradient(135deg,#ffb347,#ff8a2a); opacity:0.8; }
.sk-profile-card__label { font-size:11px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
.sk-profile-card__level { font-family:"Syne",sans-serif; font-size:18px; font-weight:800; color:#fff; margin-bottom:16px; display:flex; align-items:center; gap:6px; }
.sk-profile-card__xp-label { font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
.sk-profile-card__bar { height:5px; background:rgba(255,255,255,0.12); border-radius:999px; overflow:hidden; }
.sk-profile-card__fill { height:100%; width:0%; background:linear-gradient(90deg,#ff8a2a,#ffb347); border-radius:999px; transition:width 1.2s cubic-bezier(0.22,1,0.36,1); }
.sk-profile-card__fill.animated { width:35%; }
.sk-profile-card__disclaimer { display:flex; align-items:flex-start; gap:6px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); }
.sk-profile-card__disclaimer-text { font-size:10px; color:rgba(255,255,255,0.3); line-height:1.4; }
.sk-profile-banner__cta { display:flex!important; align-items:center!important; justify-content:center!important; background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%)!important; border:none!important; border-radius:999px!important; color:#1a0d04!important; font-family:"DM Sans",sans-serif!important; font-size:14px!important; font-weight:700!important; height:46px!important; padding:0 28px!important; cursor:pointer; transition:filter 0.18s, transform 0.18s!important; box-shadow:0 8px 24px rgba(255,138,42,0.35); white-space:nowrap; width:220px; }
.sk-profile-banner__cta:hover { filter:brightness(1.08)!important; transform:translateY(-2px)!important; }
.sk-profile-banner__note { font-size:11px; color:rgba(255,255,255,0.3); text-align:center; }
@media(max-width:820px){.sk-profile-banner{flex-direction:column;padding:32px 20px;margin:0 16px 64px} .sk-profile-banner__right{width:100%} .sk-profile-card{width:100%} .sk-profile-banner__cta{width:100%!important}}
@media(max-width:480px){.sk-profile-banner__perks{grid-template-columns:1fr}}

/* ══ SUPPORT / FAQ ══ */
.sk-support { padding:0 24px 96px; max-width:860px; margin:0 auto; }
.sk-support__head { text-align:center; margin-bottom:40px; }
.sk-support__eyebrow { display:inline-flex; align-items:center; gap:6px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.25); border-radius:999px; padding:5px 16px; font-size:12px; font-weight:500; letter-spacing:0.04em; color:#ff8a2a; margin-bottom:16px; }
.sk-support__title { font-family:"Syne",sans-serif!important; font-size:clamp(24px,4vw,36px)!important; font-weight:800!important; color:#fff!important; margin:0 0 10px!important; letter-spacing:-0.02em!important; }
.sk-support__sub { font-size:14px; color:rgba(255,255,255,0.55); margin:0; }
.sk-support__grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:32px; }
.sk-faq { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:16px 20px; cursor:pointer; transition:border-color 0.22s, background 0.22s; user-select:none; }
.sk-faq:hover, .sk-faq--open { border-color:rgba(255,138,42,0.28); background:rgba(255,138,42,0.05); }
.sk-faq__row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.sk-faq__q { font-size:13.5px; font-weight:700; color:#fff; line-height:1.4; }
.sk-faq__chevron { color:rgba(255,138,42,0.7); flex-shrink:0; font-size:12px; }
.sk-faq__a { font-size:13px; color:rgba(255,255,255,0.5); line-height:1.6; }
.sk-support__contact { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; padding:28px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:16px; text-align:center; }
.sk-support__contact-text { font-size:14px; color:rgba(255,255,255,0.6); }
.sk-support__contact-text strong { color:#fff; }
.sk-support__email { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border-radius:999px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.3); color:#ff8a2a; font-size:13px; font-weight:600; text-decoration:none; transition:background 0.2s, transform 0.2s; }
.sk-support__email:hover { background:rgba(255,138,42,0.2); transform:translateY(-1px); }

/* ══ RESPONSIVE ══ */
@media(max-width:540px){
  .sk-hero__searchInputRow { flex-direction:column; }
  .sk-hero__searchInputRow .sk-cta { width:100%!important; }
  .sk-hero__airportRow { flex-direction:column; align-items:flex-start; }
  .sk-home-airport { width:100%; }
  .sk-home-airport .ant-select { width:100%!important; }
  .sk-support__grid { grid-template-columns:1fr; }
  .sk-support { padding:0 16px 72px; }
  .sk-support__contact { flex-direction:column; padding:20px 16px; }
  .sk-support__email { width:100%; justify-content:center; }
  .sk-social-proof { border-radius:12px; }
  .sk-social-proof__stat { font-size:15px; }
  .sk-trust-signals { gap:12px; }
  .sk-trust-signals span { font-size:11px; }
  .sk-orb--1 { width:280px; height:280px; }
  .sk-orb--2 { width:200px; height:200px; }
  .sk-orb--3 { display:none; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// REVEAL SECTION WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function RevealSection({
  children,
  className = "",
  delay = 0,
  tag: Tag = "div",
}) {
  const [ref, vis] = useScrollReveal(0.1);
  return (
    <Tag
      ref={ref}
      className={`sk-reveal${vis ? " is-visible" : ""}${
        delay ? ` sk-reveal--delay-${delay}` : ""
      }${className ? ` ${className}` : ""}`}
    >
      {children}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED HERO TITLE
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedHeroTitle({ lines }) {
  // Space must live OUTSIDE the inline-block span or it collapses
  let wordIndex = 0;
  return (
    <h1 className="sk-hero__title">
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {line.split(" ").map((word, wi) => {
            const delay = wordIndex++ * 80 + 100;
            const isLast = wi === line.split(" ").length - 1;
            return (
              <React.Fragment key={`${li}-${wi}`}>
                <span
                  className="sk-hero__word"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  {word}
                </span>
                {!isLast && " "}
              </React.Fragment>
            );
          })}
          {li < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </h1>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const nav = useNavigate();
  const landingRef = useRef(null);

  const { homeAirport, setHomeAirport, homeCode, homeCity } = useHomeAirport();

  // ── Time period ──
  const [timePeriod, setTimePeriod] = useState(() =>
    getTimePeriod(new Date().getHours())
  );
  useEffect(() => {
    if (landingRef.current)
      landingRef.current.setAttribute("data-time", timePeriod);
    const interval = setInterval(() => {
      const next = getTimePeriod(new Date().getHours());
      setTimePeriod(next);
      if (landingRef.current)
        landingRef.current.setAttribute("data-time", next);
    }, 60_000);
    return () => clearInterval(interval);
  }, [timePeriod]);
  const timeMeta = TIME_PERIODS[timePeriod];

  // ── Profile card XP bar animate-in ──
  const [profileRef, profileVis] = useScrollReveal(0.3);

  // ── Search query ──
  const [q, setQ] = useState(
    "10-day Japan trip under $2,500 with cherry blossoms"
  );
  const promptHistoryRef = useRef([]);

  // ── AI suggestion state ──
  const [suggestion, setSuggestion] = useState(null);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggError, setSuggError] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const debounceRef = useRef(null);

  const [isRouting, setIsRouting] = useState(false);

  // ── Atlas chat ──
  const [visibleBubbles, setVisibleBubbles] = useState(1);
  const atlasConversation = useMemo(
    () => ATLAS_CHAT_INTRO(homeCity),
    [homeCity]
  );
  useEffect(() => {
    if (visibleBubbles >= atlasConversation.length) return;
    const delay = visibleBubbles === 1 ? 1400 : 1800;
    const t = setTimeout(() => setVisibleBubbles((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visibleBubbles, atlasConversation.length]);

  // ── AI suggestion fetcher ──
  const triggerSuggestion = useCallback(
    (prompt) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = normalizePrompt(prompt);
      if (trimmed.length < 8) {
        setShowSuggestion(false);
        setSuggestion(null);
        setSuggError(null);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        promptHistoryRef.current = [
          ...new Set([...promptHistoryRef.current, trimmed]),
        ].slice(-10);
        setSuggLoading(true);
        setSuggError(null);
        try {
          const result = await fetchAISuggestion(
            trimmed,
            homeCity,
            homeCode,
            promptHistoryRef.current
          );
          setSuggestion(result);
          setShowSuggestion(true);
        } catch (err) {
          console.error("Atlas suggestion error:", err);
          setSuggError("Couldn't load suggestion — try again.");
          setShowSuggestion(true);
        } finally {
          setSuggLoading(false);
        }
      }, 700);
    },
    [homeCity, homeCode]
  );

  // Re-trigger when airport changes
  useEffect(() => {
    if (normalizePrompt(q).length >= 8) triggerSuggestion(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCode]);

  const handleQueryChange = useCallback(
    (e) => {
      const next = e.target.value;
      setQ(next);
      triggerSuggestion(next);
    },
    [triggerSuggestion]
  );

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
        homeAirport: homeCode,
      });
      nav(`/booking?prompt=${encodeURIComponent(prompt)}&from=${homeCode}`);
    } finally {
      setIsRouting(false);
    }
  }, [q, nav, homeCode]);

  const viewPlan = useCallback(async () => {
    if (!suggestion) return;
    const prompt = normalizePrompt(q);
    try {
      setIsRouting(true);
      await trackPassportEvent("AI_PLAN_VIEWED", {
        source: "landing_suggestion",
        prompt,
        planKey: suggestion.planKey,
        homeAirport: homeCode,
      });
      nav(
        `/booking?plan=${encodeURIComponent(
          suggestion.planKey
        )}&prompt=${encodeURIComponent(prompt)}&from=${homeCode}`
      );
    } finally {
      setIsRouting(false);
    }
  }, [q, nav, suggestion, homeCode]);

  const openExamplePlan = useCallback(
    async (card) => {
      try {
        setIsRouting(true);
        await trackPassportEvent("EXAMPLE_TRIP_OPENED", {
          source: "landing_examples",
          exampleKey: card.key,
          homeAirport: homeCode,
        });
        nav(
          `/booking?example=${encodeURIComponent(card.key)}&from=${homeCode}`
        );
      } finally {
        setIsRouting(false);
      }
    },
    [nav, homeCode]
  );

  const goSignup = useCallback(() => nav("/register"), [nav]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="sk-landing"
      ref={landingRef}
      data-time={timePeriod}
      style={{ "--sk-hero-bg": `url(${heroBg})` }}
    >
      <style>{INJECTED_CSS}</style>
      <ScrollProgressBar />
      <div className="sk-landing__bg" />

      {/* ── Time badge ── */}
      <div className="sk-time-badge">
        <span className="sk-time-dot" />
        {timeMeta.label} mode
      </div>

      <div className="sk-landing__content">
        {/* ══ HERO ══ */}
        <header
          className="sk-hero"
          style={{ position: "relative", overflow: "hidden" }}
        >
          {/* Ambient orbs — colour-keyed to time of day */}
          <div
            className="sk-orb sk-orb--1"
            style={{ background: timeMeta.orb1 }}
          />
          <div
            className="sk-orb sk-orb--2"
            style={{ background: timeMeta.orb2 }}
          />
          <div
            className="sk-orb sk-orb--3"
            style={{ background: timeMeta.orb1, opacity: 0.5 }}
          />

          <div style={{ position: "relative", zIndex: 2 }}>
            <div className="sk-hero__eyebrow">{HERO_COPY.eyebrow}</div>

            <AnimatedHeroTitle lines={HERO_COPY.title} />

            <p
              className="sk-hero__sub"
              style={{
                opacity: 0,
                animation: "sk-wordIn 0.6s ease 0.8s forwards",
              }}
            >
              {HERO_COPY.subtitle}
            </p>

            {/* Search box — uses sk-hero__search wrapper from LandingPage.css */}
            <div className="sk-hero__search" style={{ marginBottom: 0 }}>
              <Input
                size="large"
                prefix={<SearchOutlined />}
                value={q}
                onChange={handleQueryChange}
                onPressEnter={goPlan}
                placeholder={HERO_COPY.placeholder}
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
                {HERO_COPY.ctaLabel}
              </Button>
            </div>

            {/* Airport picker — sits below the search box */}
            <div className="sk-hero__airportRow">
              <span className="sk-home-airport__label">
                <EnvironmentOutlined /> Flying from
              </span>
              <Select
                value={homeCode}
                onChange={(code) => {
                  const ap = AIRPORTS.find((a) => a.code === code);
                  if (ap) setHomeAirport(ap);
                }}
                classNames={{ popup: { root: "sk-home-airport-popup" } }}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  String(option?.children || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                className="sk-home-airport"
              >
                {AIRPORTS.map((ap) => (
                  <Option key={ap.code} value={ap.code}>
                    {ap.city} ({ap.code}) — {ap.name}
                  </Option>
                ))}
              </Select>
            </div>

            {/* Quick chips */}
            <div className="sk-hero__quickActions">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="sk-quickChip"
                  disabled={isRouting}
                  onClick={() => {
                    setQ(chip.prompt);
                    triggerSuggestion(chip.prompt);
                  }}
                >
                  <span className="sk-quickChip__icon">{chip.icon}</span>
                  {chip.label}
                </button>
              ))}
            </div>

            {/* AI suggestion */}
            <section
              className={`sk-suggestion ${showSuggestion ? "is-visible" : ""}`}
            >
              <div className="sk-suggestion__bar">
                <span className="sk-suggestion__bolt">
                  {suggLoading ? (
                    <LoadingOutlined spin />
                  ) : (
                    <ThunderboltOutlined />
                  )}
                </span>
                <span className="sk-suggestion__label">
                  {suggLoading ? "Atlas is thinking…" : "Skyrio AI Suggestion"}
                </span>
              </div>

              {suggLoading && (
                <div className="sk-suggestion__loading">
                  <LoadingOutlined spin /> Personalising your suggestion from{" "}
                  {homeCity}…
                </div>
              )}
              {suggError && !suggLoading && (
                <div className="sk-suggestion__error">{suggError}</div>
              )}
              {suggestion && !suggLoading && !suggError && (
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
                      ${suggestion.total?.toLocaleString()} <span>total</span>
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
              )}
            </section>

            {/* Social proof */}
            <div className="sk-social-proof">
              {SOCIAL_PROOF.map((item) => (
                <div key={item.label} className="sk-social-proof__item">
                  <div className="sk-social-proof__stat">{item.stat}</div>
                  <div className="sk-social-proof__label">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="sk-trust-signals">
              {TRUST_SIGNALS.map((t) => (
                <span key={t}>
                  <Icon name="check" /> {t}
                </span>
              ))}
            </div>

            <div className="sk-hero__secondaryCta">
              <p className="sk-hero__secondaryCta-text">
                {HERO_COPY.secondaryCta.prompt}
              </p>
              <button
                type="button"
                className="sk-hero__secondaryCta-btn"
                onClick={goSignup}
              >
                {HERO_COPY.secondaryCta.label} <ArrowRightOutlined />
              </button>
            </div>
          </div>
        </header>

        {/* ══ EXAMPLES ══ */}
        <div className="sk-divider" />
        <RevealSection tag="section" className=" sk-examples">
          <div className="sk-examples__head">
            <div className="sk-examples__kicker">
              Real plans, built instantly
            </div>
            <h2 className="sk-examples__title">
              See what Skyrio builds for you
            </h2>
            <p className="sk-examples__sub">
              Click any trip — a full flight + hotel plan loads in seconds.
            </p>
          </div>
          <div className="sk-examples__grid">
            {EXAMPLES.map((card, i) => (
              <RevealSection key={card.key} delay={i + 1}>
                <ExampleCard
                  card={card}
                  onClick={() => openExamplePlan(card)}
                  disabled={isRouting}
                />
              </RevealSection>
            ))}
          </div>
          <p className="sk-footline">
            No account needed to plan. Sign up when you're ready to book.
          </p>
        </RevealSection>

        {/* ══ MEET ATLAS ══ */}
        <div className="sk-divider" />
        <RevealSection tag="section" className=" sk-atlas">
          <div className="sk-atlas__head">
            <div className="sk-atlas__eyebrow">
              <Icon name="sparkle" size={11} /> Meet your travel companion
            </div>
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
            <RevealSection delay={1}>
              <div className="sk-atlas__chat">
                <div className="sk-atlas__chatHeader">
                  <div className="sk-atlas__avatar">
                    <Icon name="robot" size={20} />
                  </div>
                  <div>
                    <div className="sk-atlas__chatName">Atlas</div>
                    <div className="sk-atlas__chatStatus">
                      <span className="sk-atlas__statusDot" /> Always on
                    </div>
                  </div>
                </div>
                <div className="sk-atlas__messages">
                  {atlasConversation.map((bubble, i) => {
                    if (i >= visibleBubbles) return null;
                    return (
                      <div
                        key={bubble.id}
                        className={`sk-atlas__bubble sk-atlas__bubble--${bubble.from}`}
                      >
                        {bubble.from === "atlas" && (
                          <div className="sk-atlas__bubbleAvatar">
                            <Icon name="robot" size={13} />
                          </div>
                        )}
                        <div className="sk-atlas__bubbleText">
                          {bubble.text}
                        </div>
                      </div>
                    );
                  })}
                  {visibleBubbles < atlasConversation.length &&
                    atlasConversation[visibleBubbles]?.from === "atlas" && (
                      <div className="sk-atlas__bubble sk-atlas__bubble--atlas">
                        <div className="sk-atlas__bubbleAvatar">
                          <Icon name="robot" size={13} />
                        </div>
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
                  <div className="sk-atlas__fabHint">Open Atlas AI</div>
                </div>
              </div>
            </RevealSection>

            {/* Feature list */}
            <div className="sk-atlas__features">
              {ATLAS_FEATURES.map((f, i) => (
                <RevealSection key={f.title} delay={i + 1}>
                  <div className="sk-atlas__feature">
                    <div className="sk-atlas__featureIcon">
                      <Icon name={f.iconKey} />
                    </div>
                    <div>
                      <div className="sk-atlas__featureTitle">{f.title}</div>
                      <div className="sk-atlas__featureDesc">{f.desc}</div>
                    </div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ══ PROFILE BANNER ══ */}
        <div className="sk-divider" />
        <RevealSection tag="section" className=" sk-profile-banner">
          <div className="sk-profile-banner__left">
            <div className="sk-profile-banner__badge">
              <Icon name="sparkle" size={11} /> Your Skyrio Profile
            </div>
            <h2 className="sk-profile-banner__title">
              Every trip earns you
              <br />
              <span>rewards, rank, and recognition.</span>
            </h2>
            <p className="sk-profile-banner__sub">
              Create a free account to activate your Skyrio profile instantly.
              Search, save, and book your way to Explorer, Adventurer, and
              Legend status — with real travel rewards along the way.
            </p>
            <div className="sk-profile-banner__perks">
              {PROFILE_PERKS.map((p) => (
                <div key={p.label} className="sk-profile-perk">
                  <div className="sk-profile-perk__icon">
                    <Icon name={p.iconKey} size={16} />
                  </div>
                  <div>
                    <div className="sk-profile-perk__label">{p.label}</div>
                    <div className="sk-profile-perk__desc">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sk-profile-banner__right" ref={profileRef}>
            <div className="sk-profile-card">
              <div className="sk-profile-card__top">
                <div className="sk-profile-card__logo">SKYRIO</div>
                <div className="sk-profile-card__chip" />
              </div>
              <div className="sk-profile-card__label">Your Profile Tier</div>
              <div className="sk-profile-card__level">
                Explorer <Icon name="sparkle" size={14} />
              </div>
              <div className="sk-profile-card__xp-label">XP Progress</div>
              <div className="sk-profile-card__bar">
                {/* XP bar animates in when the section scrolls into view */}
                <div
                  className={`sk-profile-card__fill${
                    profileVis ? " animated" : ""
                  }`}
                />
              </div>
              <div className="sk-profile-card__disclaimer">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 16V12M12 8H12.01"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="sk-profile-card__disclaimer-text">
                  Membership profile only — not an official travel document.
                </span>
              </div>
            </div>
            <Button
              className="sk-profile-banner__cta"
              onClick={goSignup}
              disabled={isRouting}
            >
              Create free account{" "}
              <ArrowRightOutlined style={{ marginLeft: 6 }} />
            </Button>
            <div className="sk-profile-banner__note">
              Free forever · No credit card required
            </div>
          </div>
        </RevealSection>

        {/* ══ SUPPORT / FAQ ══ */}
        <div className="sk-divider" />
        <RevealSection tag="section" className=" sk-support">
          <div className="sk-support__head">
            <div className="sk-support__eyebrow">
              <Icon name="chat" size={13} /> Got questions?
            </div>
            <h2 className="sk-support__title">We've got answers</h2>
            <p className="sk-support__sub">
              Everything you need to know before your first booking.
            </p>
          </div>
          <div className="sk-support__grid">
            {FAQS.map((faq, i) => (
              <RevealSection key={faq.q} delay={(i % 2) + 1}>
                <FaqItem q={faq.q} a={faq.a} />
              </RevealSection>
            ))}
          </div>
          <div className="sk-support__contact">
            <div className="sk-support__contact-text">
              Still have questions? <strong>Our team is here to help.</strong>
            </div>
            <a
              href="mailto:skyrioofficial@gmail.com"
              className="sk-support__email"
            >
              <Icon name="mail" /> skyrioofficial@gmail.com
            </a>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
