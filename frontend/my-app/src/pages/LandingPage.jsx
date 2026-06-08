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

const TIME_PERIODS = {
  dawn: {
    hours: [5, 6, 7],
    label: "Dawn",
    tip: "Early birds get the best deals.",
  },
  morning: {
    hours: [8, 9, 10, 11],
    label: "Morning",
    tip: "Booking 6–8 weeks ahead hits the sweet spot.",
  },
  afternoon: {
    hours: [12, 13, 14, 15, 16],
    label: "Afternoon",
    tip: "Mid-week departures save up to $80 per ticket.",
  },
  dusk: {
    hours: [17, 18, 19],
    label: "Sunset",
    tip: "Last-minute deals often drop after 5 PM.",
  },
  night: {
    hours: [20, 21, 22, 23, 0, 1, 2, 3, 4],
    label: "Night",
    tip: "Tuesday nights are 15–20% cheaper to book.",
  },
};

const HERO_COPY = {
  eyebrow: "Your AI travel planner — free to use",
  title: "Tell us where you want to go.\nWe'll handle the rest.",
  subtitle:
    "Type a destination and budget. Skyrio's AI builds a full flight + hotel plan in seconds — then you book it directly.",
  placeholder: "Plan your next trip…",
  ctaLabel: "Plan my trip",
  secondaryCta: {
    prompt: "Want to track trips, earn XP, and unlock rewards?",
    label: "Create a free account",
  },
};

const FILTER_OPTIONS = {
  budget: [
    { label: "Under $500", value: "under $500" },
    { label: "Under $1,500", value: "under $1,500" },
    { label: "Under $3,000", value: "under $3,000" },
    { label: "Luxury", value: "luxury no budget limit" },
  ],
  type: [
    { label: "Beach", value: "beach" },
    { label: "City break", value: "city break" },
    { label: "Adventure", value: "adventure" },
    { label: "Romantic", value: "romantic" },
    { label: "Family", value: "family friendly" },
  ],
  duration: [
    { label: "Weekend", value: "2-3 days" },
    { label: "1 week", value: "7 days" },
    { label: "2 weeks", value: "14 days" },
    { label: "3+ weeks", value: "21+ days" },
  ],
};

const DESTINATION_IMAGES = {
  japan:
    "https://images.unsplash.com/photo-1549693578-d683be217e58?auto=format&fit=crop&w=1200&q=70",
  tokyo:
    "https://images.unsplash.com/photo-1549693578-d683be217e58?auto=format&fit=crop&w=1200&q=70",
  kyoto:
    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=70",
  miami:
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=70",
  paris:
    "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1200&q=70",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=70",
  barcelona:
    "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=70",
  rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=70",
  london:
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=70",
  "new york":
    "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=70",
  hawaii:
    "https://images.unsplash.com/photo-1505852679233-d9fd70aff56d?auto=format&fit=crop&w=1200&q=70",
  tulum:
    "https://images.unsplash.com/photo-1682686581493-8e7dbece7b71?auto=format&fit=crop&w=1200&q=70",
  maldives:
    "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1200&q=70",
  santorini:
    "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=70",
  thailand:
    "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=70",
  mexico:
    "https://images.unsplash.com/photo-1518638150340-f706e86654de?auto=format&fit=crop&w=1200&q=70",
  default:
    "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=70",
};

function getDestinationImage(tripName = "") {
  const lower = tripName.toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (key !== "default" && lower.includes(key)) return url;
  }
  return DESTINATION_IMAGES.default;
}

const EXAMPLE_SEEDS = [
  "a warm beach trip under $2,000 from the US",
  "a cultural city break in Europe under $3,000",
  "an adventure trip for one week any destination",
];

const SOCIAL_PROOF = [
  { stat: "8 sec", label: "avg. plan build" },
  { stat: "30+", label: "destinations" },
  { stat: "Free", label: "to plan" },
  { stat: "Stripe", label: "payments" },
];

const TRUST_SIGNALS = [
  "No credit card required",
  "Free to search & plan",
  "Cancel within 24h",
];

const ATLAS_FEATURES = [
  {
    iconKey: "brain",
    title: "Understands natural language",
    desc: "Just tell Atlas what you want — no dropdowns, no filters.",
  },
  {
    iconKey: "bolt",
    title: "Builds your plan in seconds",
    desc: "Flights, hotels, and budget breakdown — before you finish your coffee.",
  },
  {
    iconKey: "target",
    title: "Learns your travel style",
    desc: "The more you travel with Skyrio, the smarter Atlas gets.",
  },
  {
    iconKey: "lock",
    title: "Books it too",
    desc: "Atlas doesn't just suggest — it takes you all the way to confirmed.",
  },
];

const PROFILE_PERKS = [
  {
    iconKey: "xp",
    label: "XP & Levels",
    desc: "Earn points every search, save, or booking.",
  },
  {
    iconKey: "badge",
    label: "Badges",
    desc: "Collect badges for destinations and milestones.",
  },
  {
    iconKey: "reward",
    label: "Rewards",
    desc: "Redeem XP for credits, upgrades, and deals.",
  },
  {
    iconKey: "journey",
    label: "Journey History",
    desc: "Every trip builds your Skyrio travel story.",
  },
];

const FAQS = [
  {
    q: "Is Skyrio free to use?",
    a: "Yes — searching and planning with Atlas is completely free. You only pay when you book a flight or hotel.",
  },
  {
    q: "How does Atlas AI work?",
    a: "Atlas reads your natural language prompt, matches it to live inventory, and builds a budget-optimised plan in seconds.",
  },
  {
    q: "Can I change or cancel my booking?",
    a: "Yes. Most bookings include free cancellation within 24 hours. Policies vary by airline and hotel.",
  },
  {
    q: "Is my payment information secure?",
    a: "Absolutely. Payments are processed by Stripe — the same infrastructure used by Amazon. We never store your card details.",
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
    text: "Found 3 beachfront options under $180/night. Top pick has free cancellation and a rooftop pool. Adding it to your plan now.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAISuggestion(
  prompt,
  homeCity,
  homeCode,
  promptHistory,
  filters = {},
  count = 3
) {
  const url = "/api/atlas/suggest";
  console.log("[Atlas] fetching", url, { prompt, homeCity, homeCode, count });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      homeCity,
      homeCode,
      promptHistory,
      filters,
      count,
    }),
  });
  console.log("[Atlas] response status:", response.status, response.url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[Atlas] error body:", text);
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  console.log("[Atlas] success:", data);
  return Array.isArray(data?.suggestions)
    ? data.suggestions
    : data
    ? [data]
    : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME AIRPORT
// ─────────────────────────────────────────────────────────────────────────────

const HOME_AIRPORT_KEY = "skyrio_home_airport";
function readStoredAirport() {
  try {
    const raw = localStorage.getItem(HOME_AIRPORT_KEY);
    if (!raw) return DEFAULT_AIRPORT;
    const p = JSON.parse(raw);
    return p?.code && p?.city ? p : DEFAULT_AIRPORT;
  } catch {
    return DEFAULT_AIRPORT;
  }
}
function useHomeAirport() {
  const [airport, setAirportState] = useState(readStoredAirport);
  const setAirport = useCallback((a) => {
    if (!a?.code) return;
    const next = {
      code: a.code,
      city: a.city || a.code,
      name: a.name || a.city || a.code,
    };
    setAirportState(next);
    try {
      localStorage.setItem(HOME_AIRPORT_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }, []);
  return {
    homeAirport: airport,
    setHomeAirport: setAirport,
    homeCode: airport.code,
    homeCity: airport.city,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL REVEAL
// ─────────────────────────────────────────────────────────────────────────────

function useScrollReveal(threshold = 0.05) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
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

function Reveal({ children, className = "", delay = 0, tag: Tag = "div" }) {
  const [ref, vis] = useScrollReveal();
  return (
    <Tag
      ref={ref}
      className={`sk-reveal${vis ? " is-visible" : ""}${
        delay ? ` sk-d${delay}` : ""
      }${className ? ` ${className}` : ""}`.trim()}
    >
      {children}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function getTimePeriod(hour) {
  for (const [k, v] of Object.entries(TIME_PERIODS)) {
    if (v.hours.includes(hour)) return k;
  }
  return "night";
}
const normalizePrompt = (v) => String(v || "").trim();

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
// LIVE PLAN CARD
// ─────────────────────────────────────────────────────────────────────────────

function LivePlanCard({ plan, homeCode, disabled }) {
  const nav = useNavigate();
  const img = getDestinationImage(plan.trip);
  const onClick = useCallback(() => {
    if (disabled) return;
    nav(
      `/booking?plan=${encodeURIComponent(
        plan.planKey
      )}&prompt=${encodeURIComponent(plan.trip)}&from=${homeCode}`
    );
  }, [plan, homeCode, nav, disabled]);

  return (
    <button
      className="sk-card sk-live-card"
      onClick={onClick}
      type="button"
      disabled={disabled}
      style={{ width: "100%", height: "100%" }}
    >
      <div
        className="sk-card__media sk-live-card__media"
        style={{ backgroundImage: `url(${img})` }}
      />
      <div className="sk-card__overlay" />
      <div className="sk-card__content">
        <div className="sk-live-card__price">
          ${plan.total?.toLocaleString()} <span>total</span>
        </div>
        <div className="sk-card__title">{plan.trip}</div>
        <div className="sk-card__subtitle">{plan.fit}</div>
        <div className="sk-card__meta">
          {plan.dates} · {plan.summary}
        </div>
        <div className="sk-card__footer sk-live-card__footer">
          <span>View plan</span>
          <ArrowRightOutlined />
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="sk-card sk-card--skeleton">
      <div className="sk-card__media sk-skeleton" />
      <div className="sk-card__content">
        <div className="sk-skeleton sk-skeleton--price" />
        <div className="sk-skeleton sk-skeleton--title" />
        <div className="sk-skeleton sk-skeleton--line" />
        <div className="sk-skeleton sk-skeleton--line sk-skeleton--short" />
        <div className="sk-skeleton sk-skeleton--btn" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const INJECTED_CSS = `
/* ══ FULL-PAGE BACKGROUND
   sk-landing__bg uses position:absolute + contain:paint which clips it
   to the hero height. We set the bg-image on .sk-landing itself so the
   cosmic image covers the entire page on scroll. ══ */
.sk-landing {
  background-image: var(--sk-hero-bg) !important;
  background-size: cover !important;
  background-position: center center !important;
  background-attachment: scroll !important;
}

/* Reduce time-period overlay opacity so the cosmic image stays vivid */
.sk-landing[data-time="night"] .sk-landing__bg::after,
.sk-landing .sk-landing__bg::after {
  background:
    radial-gradient(ellipse 80% 55% at 60% 25%, rgba(90,40,160,0.28) 0%, transparent 70%),
    radial-gradient(ellipse 60% 50% at 20% 70%, rgba(50,20,100,0.18) 0%, transparent 65%),
    linear-gradient(175deg, rgba(9,7,26,0.48) 0%, rgba(19,13,46,0.42) 40%, rgba(14,8,24,0.48) 100%) !important;
}
.sk-landing[data-time="dawn"] .sk-landing__bg::after {
  background:
    radial-gradient(ellipse 100% 50% at 50% 100%, rgba(255,140,60,0.28) 0%, rgba(255,80,80,0.1) 40%, transparent 70%),
    linear-gradient(180deg, rgba(26,14,46,0.42) 0%, rgba(92,30,58,0.32) 65%, rgba(194,84,42,0.28) 100%) !important;
}
.sk-landing[data-time="morning"] .sk-landing__bg::after {
  background:
    radial-gradient(ellipse 90% 50% at 50% 100%, rgba(255,200,80,0.2) 0%, transparent 60%),
    linear-gradient(175deg, rgba(13,27,62,0.4) 0%, rgba(40,96,168,0.32) 70%, rgba(74,143,212,0.25) 100%) !important;
}
.sk-landing[data-time="afternoon"] .sk-landing__bg::after {
  background:
    radial-gradient(ellipse 100% 40% at 70% 0%, rgba(255,180,50,0.25) 0%, transparent 60%),
    linear-gradient(160deg, rgba(10,22,40,0.4) 0%, rgba(45,90,144,0.32) 60%, rgba(201,122,32,0.25) 100%) !important;
}
.sk-landing[data-time="dusk"] .sk-landing__bg::after {
  background:
    radial-gradient(ellipse 100% 55% at 50% 100%, rgba(255,90,20,0.32) 0%, rgba(200,40,120,0.18) 50%, transparent 75%),
    linear-gradient(175deg, rgba(13,10,30,0.45) 0%, rgba(74,16,64,0.35) 55%, rgba(156,42,16,0.28) 100%) !important;
}

/* ══ BELOW-HERO — transparent so cosmic bg shows through everything ══ */
.sk-below-hero {
  background: transparent !important;
  position: relative;
  z-index: 1;
}
.sk-below-hero .sk-card { background-color: transparent; }

/* ══ SECTION DIVIDERS ══ */
.sk-divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,138,42,0.2), transparent);
}

/* ══ SECTION KICKER ══ */
.sk-examples__kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #ff8a2a;
  margin-bottom: 12px;
}
.sk-examples__kicker::before {
  content: "";
  display: inline-block;
  width: 18px;
  height: 2px;
  background: #ff8a2a;
  border-radius: 2px;
}

/* ══ SCROLL REVEAL ══ */
@keyframes sk-revealUp {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
}
.sk-reveal { opacity:0; min-height:1px; }
.sk-reveal.is-visible { animation:sk-revealUp 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
.sk-reveal.is-visible.sk-d1 { animation-delay:0.07s; }
.sk-reveal.is-visible.sk-d2 { animation-delay:0.14s; }
.sk-reveal.is-visible.sk-d3 { animation-delay:0.21s; }

/* ══ AIRPORT ROW ══ */
.sk-hero__airportRow {
  display: flex; align-items: center; gap: 8px;
  justify-content: center; flex-wrap: wrap;
  margin: 12px auto 0; padding: 10px 16px;
  background: rgba(8,5,20,0.45);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px; max-width: 480px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.sk-home-airport { display:inline-flex; align-items:center; flex:1; }
.sk-home-airport__label { font-size:12px; color:rgba(255,255,255,0.5); font-weight:500; white-space:nowrap; display:flex; align-items:center; gap:5px; flex-shrink:0; }
.sk-home-airport .ant-select-selector { background:transparent!important; border:none!important; box-shadow:none!important; color:rgba(255,255,255,0.9)!important; font-family:"DM Sans",sans-serif!important; font-size:13px!important; height:28px!important; padding:0 8px!important; }
.sk-home-airport .ant-select-arrow { color:rgba(255,255,255,0.4)!important; }
.sk-home-airport-popup { background:rgba(10,8,26,0.98)!important; border:1px solid rgba(255,138,42,0.22)!important; border-radius:12px!important; backdrop-filter:blur(20px)!important; box-shadow:0 16px 48px rgba(0,0,0,0.7)!important; }
.sk-home-airport-popup .ant-select-item { color:rgba(255,255,255,0.8)!important; background:transparent!important; font-family:"DM Sans",sans-serif!important; font-size:13px!important; }
.sk-home-airport-popup .ant-select-item-option-active,
.sk-home-airport-popup .ant-select-item-option-selected { background:rgba(255,138,42,0.12)!important; color:#ff8a2a!important; }

/* ══ TIME BADGE ══ */
.sk-time-badge-wrap { display:flex; justify-content:flex-end; padding:10px 24px 0; position:relative; z-index:2; }
.sk-time-badge-wrap .sk-time-badge { position:relative!important; top:auto!important; right:auto!important; }

/* ══ SEARCH — focus glow ══ */
.sk-hero__search:focus-within {
  border-color: rgba(255,138,42,0.6)!important;
  box-shadow: 0 0 0 4px rgba(255,138,42,0.08), 0 8px 32px rgba(0,0,0,0.2)!important;
}

/* ══ SUGGESTION CARD — glass over cosmic bg ══ */
.sk-suggestion {
  background: rgba(8,5,20,0.5) !important;
  border: 1px solid rgba(255,255,255,0.14) !important;
  border-radius: 20px !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  padding: 20px 24px !important;
}
@media (max-width: 600px) {
  .sk-suggestion { padding: 16px !important; }
}
.sk-suggestion__loading { display:flex; align-items:center; gap:8px; padding:12px 0; font-size:12px; color:rgba(255,138,42,0.8); }
.sk-suggestion__error { font-size:11px; color:rgba(255,80,80,0.8); padding:6px 0; }

@keyframes sk-suggFade {
  from { opacity:0; transform:translateY(4px); }
  to   { opacity:1; transform:translateY(0); }
}
.sk-suggestion__body { animation: sk-suggFade 0.28s ease forwards; }

/* ══ FILTERS ══ */
.sk-filters { margin-top:14px; text-align:center; }
.sk-filter-toggle {
  display:inline-flex; align-items:center; gap:6px;
  background:rgba(8,5,20,0.5); border:1px solid rgba(255,255,255,0.18);
  border-radius:999px; padding:9px 22px; font-size:13px; font-weight:600;
  color:rgba(255,255,255,0.75); cursor:pointer; transition:all 0.2s;
  font-family:"DM Sans",sans-serif; white-space:nowrap;
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
}
.sk-filter-toggle:hover { background:rgba(255,138,42,0.15); border-color:rgba(255,138,42,0.45); color:#ff8a2a; }
.sk-filter-toggle.active { background:rgba(255,138,42,0.18); border-color:#ff8a2a; color:#ff8a2a; }
.sk-filter-badge {
  display:inline-flex; align-items:center; justify-content:center;
  width:18px; height:18px; border-radius:50%;
  background:linear-gradient(135deg,#ff8a2a,#ffb347);
  color:#1a0d04; font-size:10px; font-weight:800; margin-left:2px;
}
@keyframes sk-filterSlide {
  from { opacity:0; transform:translateY(-8px); }
  to   { opacity:1; transform:translateY(0); }
}
.sk-filter-groups {
  margin-top:12px; display:flex; flex-direction:column; gap:14px;
  background:rgba(8,5,20,0.65); border:1px solid rgba(255,255,255,0.15);
  border-radius:16px; padding:18px 20px; text-align:left;
  animation:sk-filterSlide 0.22s ease forwards;
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
}
.sk-filter-group__label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgba(255,255,255,0.35); margin-bottom:8px; }
.sk-filter-group__pills { display:flex; flex-wrap:wrap; gap:7px; }
.sk-filter-pill {
  padding:6px 16px; border-radius:999px; font-size:12px; font-weight:600;
  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
  color:rgba(255,255,255,0.7); cursor:pointer; transition:all 0.16s;
  font-family:"DM Sans",sans-serif;
}
.sk-filter-pill:hover { border-color:rgba(255,138,42,0.5); color:#ff8a2a; background:rgba(255,138,42,0.1); }
.sk-filter-pill.active { background:rgba(255,138,42,0.18); border-color:#ff8a2a; color:#ff8a2a; }
.sk-filter-clear { align-self:flex-start; font-size:11px; color:rgba(255,255,255,0.3); background:none; border:none; cursor:pointer; padding:0; font-family:"DM Sans",sans-serif; text-decoration:underline; margin-top:4px; }
.sk-filter-clear:hover { color:rgba(255,100,100,0.8); }

/* ══ SUGGESTION TABS ══ */
.sk-sugg-tabs { display:flex; gap:5px; margin-left:auto; }
.sk-sugg-tab { width:26px; height:26px; border-radius:7px; font-size:11px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.5); cursor:pointer; transition:all 0.15s; font-family:"DM Sans",sans-serif; }
.sk-sugg-tab.active, .sk-sugg-tab:hover { background:rgba(255,138,42,0.18); border-color:#ff8a2a; color:#ff8a2a; }
.sk-sugg-filter-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
.sk-sugg-filter-tag { font-size:10px; font-weight:600; padding:3px 11px; border-radius:999px; background:rgba(255,138,42,0.1); border:1px solid rgba(255,138,42,0.25); color:rgba(255,138,42,0.85); }
.sk-sugg-more { display:inline-flex; align-items:center; gap:5px; margin-top:16px; font-size:12px; font-weight:600; color:rgba(255,255,255,0.4); background:none; border:none; cursor:pointer; padding:0; font-family:"DM Sans",sans-serif; transition:color 0.18s; }
.sk-sugg-more:hover { color:#ff8a2a; }
.sk-sugg-more:disabled { opacity:0.35; cursor:not-allowed; }

/* ══ SOCIAL PROOF ══ */
.sk-social-proof {
  display:flex; align-items:stretch; justify-content:center; gap:0;
  margin:32px auto 0; max-width:520px;
  background:rgba(8,5,20,0.45); border:1px solid rgba(255,255,255,0.13);
  border-radius:14px; overflow:hidden;
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
}
.sk-social-proof__item { flex:1; padding:16px 10px; text-align:center; border-right:1px solid rgba(255,255,255,0.08); }
.sk-social-proof__item:last-child { border-right:none; }
.sk-social-proof__stat { font-family:"Syne",sans-serif; font-size:17px; font-weight:800; color:#ff8a2a; line-height:1; margin-bottom:4px; }
.sk-social-proof__label { font-size:9px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.08em; line-height:1.3; }
.sk-trust-signals { display:flex; align-items:center; justify-content:center; gap:18px; flex-wrap:wrap; margin-top:14px; }
.sk-trust-signals span { font-size:12px; color:rgba(255,255,255,0.35); font-weight:500; display:inline-flex; align-items:center; gap:4px; }

/* ══ SECONDARY CTA ══ */
.sk-hero__secondaryCta { margin-top:24px; text-align:center; }
.sk-hero__secondaryCta-text { font-size:13px; color:rgba(255,255,255,0.45); margin-bottom:10px; }
.sk-hero__secondaryCta-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:10px 24px; border-radius:999px;
  border:1px solid rgba(255,138,42,0.35); background:rgba(255,138,42,0.1);
  color:#ff8a2a; font-family:"DM Sans",sans-serif; font-size:13px; font-weight:600;
  cursor:pointer; transition:all 0.2s; text-decoration:none;
}
.sk-hero__secondaryCta-btn:hover { background:rgba(255,138,42,0.18); border-color:rgba(255,138,42,0.6); transform:translateY(-1px); }

/* ══ LIVE PLAN CARDS ══ */
.sk-live-card { transition:transform 0.22s ease, box-shadow 0.22s ease !important; }
.sk-live-card:hover { transform:translateY(-6px) !important; box-shadow:0 20px 48px rgba(0,0,0,0.5) !important; }
.sk-live-card:hover .sk-live-card__media { transform:scale(1.04); }
.sk-live-card__media { transition:transform 0.4s ease !important; }
.sk-live-card__price { font-family:"Syne",sans-serif; font-size:22px; font-weight:800; color:#fff; line-height:1; margin-bottom:6px; }
.sk-live-card__price span { font-family:"DM Sans",sans-serif; font-size:12px; font-weight:400; color:rgba(255,255,255,0.5); margin-left:3px; }
.sk-live-card__footer { opacity:0; transform:translateY(6px); transition:all 0.2s ease; }
.sk-live-card:hover .sk-live-card__footer { opacity:1; transform:translateY(0); }

/* ══ SKELETON ══ */
@keyframes sk-shimmer {
  0%   { background-position:-600px 0; }
  100% { background-position:600px 0; }
}
.sk-skeleton {
  background:linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%);
  background-size:1200px 100%;
  animation:sk-shimmer 1.6s ease-in-out infinite;
  border-radius:8px;
}
.sk-card--skeleton { pointer-events:none; }
.sk-card--skeleton .sk-card__media { height:200px; border-radius:0; }
.sk-skeleton--price  { height:22px; width:55%; margin-bottom:10px; }
.sk-skeleton--title  { height:18px; width:75%; margin-bottom:8px; }
.sk-skeleton--line   { height:12px; width:90%; margin-bottom:6px; }
.sk-skeleton--short  { width:55%; }
.sk-skeleton--btn    { height:34px; width:110px; margin-top:16px; border-radius:999px; }

/* ══ ATLAS ══ */
.sk-atlas { padding:0 24px 80px; max-width:1100px; margin:0 auto; }
.sk-atlas__head { text-align:center; margin-bottom:48px; }
.sk-atlas__eyebrow { display:inline-flex; align-items:center; gap:6px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.25); border-radius:999px; padding:5px 16px; font-size:12px; font-weight:500; letter-spacing:0.04em; color:#ff8a2a; margin-bottom:18px; }
.sk-atlas__title { font-family:"Syne",sans-serif!important; font-size:clamp(28px,4.5vw,42px)!important; font-weight:800!important; letter-spacing:-0.02em!important; color:#fff!important; margin:0 0 14px!important; line-height:1.1!important; }
.sk-atlas__name { background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.sk-atlas__sub { font-size:15px; color:rgba(255,255,255,0.6); max-width:480px; margin:0 auto; line-height:1.7; }
.sk-atlas__body { display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start; }
.sk-atlas__chat { background:rgba(8,5,20,0.5); border:1px solid rgba(255,255,255,0.14); border-radius:20px; overflow:hidden; display:flex; flex-direction:column; transition:border-color 0.22s, box-shadow 0.22s; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); }
.sk-atlas__chat:hover { border-color:rgba(255,255,255,0.22); box-shadow:0 8px 32px rgba(0,0,0,0.25); }
.sk-atlas__chatHeader { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); }
.sk-atlas__avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); display:flex; align-items:center; justify-content:center; color:#1a0d04; flex-shrink:0; box-shadow:0 4px 14px rgba(255,138,42,0.35); }
.sk-atlas__bubbleAvatar { width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); display:flex; align-items:center; justify-content:center; color:#1a0d04; flex-shrink:0; }
.sk-atlas__chatName { font-family:"Syne",sans-serif; font-size:14px; font-weight:700; color:#fff; line-height:1; }
.sk-atlas__chatStatus { display:flex; align-items:center; gap:5px; font-size:11px; color:rgba(255,255,255,0.35); margin-top:3px; }
.sk-atlas__statusDot { width:6px; height:6px; border-radius:50%; background:#34d399; animation:sk-pulse 2s infinite; }
.sk-atlas__messages { padding:20px; display:flex; flex-direction:column; gap:12px; min-height:220px; }
.sk-atlas__bubble { display:flex; align-items:flex-end; gap:8px; animation:sk-bubbleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes sk-bubbleIn { from{opacity:0;transform:translateY(8px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
.sk-atlas__bubble--user { flex-direction:row-reverse; }
.sk-atlas__bubbleText { max-width:78%; padding:10px 14px; border-radius:14px; font-size:13px; line-height:1.5; }
.sk-atlas__bubble--atlas .sk-atlas__bubbleText { background:rgba(255,138,42,0.14); border:1px solid rgba(255,138,42,0.25); color:rgba(255,255,255,0.9); border-bottom-left-radius:4px; }
.sk-atlas__bubble--user .sk-atlas__bubbleText { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.65); border-bottom-right-radius:4px; }
.sk-atlas__typing { display:flex; align-items:center; gap:4px; padding:12px 16px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.22); border-radius:14px; border-bottom-left-radius:4px; }
.sk-atlas__typing span { width:6px; height:6px; border-radius:50%; background:#ff8a2a; animation:sk-typing 1.2s ease infinite; }
.sk-atlas__typing span:nth-child(2){animation-delay:0.2s} .sk-atlas__typing span:nth-child(3){animation-delay:0.4s}
@keyframes sk-typing { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
.sk-atlas__chatFooter { padding:14px 20px; border-top:1px solid rgba(255,255,255,0.08); display:flex; gap:10px; align-items:center; }
.sk-atlas__fakeInput { flex:1; padding:9px 14px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); font-size:12px; color:rgba(255,255,255,0.25); }
.sk-atlas__fabHint { font-size:11px; font-weight:600; color:rgba(255,138,42,0.7); flex-shrink:0; text-align:center; line-height:1.35; }
.sk-atlas__features { display:flex; flex-direction:column; gap:12px; }
.sk-atlas__feature { display:flex; gap:14px; align-items:flex-start; padding:16px 18px; background:rgba(8,5,20,0.45); border:1px solid rgba(255,255,255,0.12); border-radius:14px; transition:border-color 0.22s, transform 0.22s, background 0.22s; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
.sk-atlas__feature:hover { border-color:rgba(255,138,42,0.35); transform:translateX(4px); background:rgba(255,138,42,0.08); }
.sk-atlas__featureIcon { width:40px; height:40px; border-radius:10px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#ff8a2a; }
.sk-atlas__featureTitle { font-size:14px; font-weight:700; color:#fff; margin-bottom:3px; }
.sk-atlas__featureDesc { font-size:12.5px; color:rgba(255,255,255,0.55); line-height:1.5; }
@media(max-width:820px){.sk-atlas__body{grid-template-columns:1fr} .sk-atlas{padding:0 16px 60px} .sk-atlas__head{margin-bottom:32px}}

/* ══ PROFILE BANNER ══ */
.sk-profile-banner { margin:0 24px 80px; max-width:1100px; margin-left:auto; margin-right:auto; position:relative; border-radius:24px; overflow:hidden; background:rgba(8,5,20,0.45); border:1px solid rgba(255,138,42,0.28); padding:52px 48px; display:flex; align-items:center; justify-content:space-between; gap:32px; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); }
.sk-profile-banner::before { content:""; position:absolute; inset:0; background:linear-gradient(135deg,rgba(124,58,237,0.18) 0%,rgba(255,138,42,0.12) 50%,rgba(236,72,153,0.12) 100%); pointer-events:none; }
.sk-profile-banner__left { flex:1; position:relative; z-index:1; }
.sk-profile-banner__badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,138,42,0.14); border:1px solid rgba(255,138,42,0.32); border-radius:999px; padding:4px 14px; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#ff8a2a; margin-bottom:18px; }
.sk-profile-banner__title { font-family:"Syne",sans-serif!important; font-size:clamp(24px,3.5vw,36px)!important; font-weight:800!important; color:#fff!important; line-height:1.15!important; margin:0 0 12px!important; letter-spacing:-0.02em!important; }
.sk-profile-banner__title span { background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.sk-profile-banner__sub { font-size:14px; color:rgba(255,255,255,0.6); line-height:1.65; max-width:420px; margin-bottom:28px; }
.sk-profile-banner__perks { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.sk-profile-perk { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:12px; transition:border-color 0.2s; }
.sk-profile-perk:hover { border-color:rgba(255,138,42,0.3); }
.sk-profile-perk__icon { width:32px; height:32px; border-radius:8px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.22); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#ff8a2a; }
.sk-profile-perk__label { font-size:12px; font-weight:700; color:#fff; margin-bottom:2px; }
.sk-profile-perk__desc { font-size:11px; color:rgba(255,255,255,0.45); line-height:1.4; }
.sk-profile-banner__right { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:16px; position:relative; z-index:1; }
.sk-profile-card { width:220px; background:linear-gradient(135deg,rgba(124,58,237,0.45) 0%,rgba(255,138,42,0.35) 100%); border:1px solid rgba(255,255,255,0.16); border-radius:18px; padding:22px; backdrop-filter:blur(16px); box-shadow:0 24px 64px rgba(0,0,0,0.4); }
.sk-profile-card__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
.sk-profile-card__logo { font-family:"Syne",sans-serif; font-size:13px; font-weight:800; color:#fff; }
.sk-profile-card__chip { width:28px; height:20px; border-radius:4px; background:linear-gradient(135deg,#ffb347,#ff8a2a); opacity:0.8; }
.sk-profile-card__label { font-size:11px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
.sk-profile-card__level { font-family:"Syne",sans-serif; font-size:18px; font-weight:800; color:#fff; margin-bottom:16px; display:flex; align-items:center; gap:6px; }
.sk-profile-card__xp-label { font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
.sk-profile-card__bar { height:5px; background:rgba(255,255,255,0.12); border-radius:999px; overflow:hidden; }
.sk-profile-card__fill { height:100%; width:35%; background:linear-gradient(90deg,#ff8a2a,#ffb347); border-radius:999px; }
.sk-profile-card__disclaimer { display:flex; align-items:flex-start; gap:6px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); }
.sk-profile-card__disclaimer-text { font-size:10px; color:rgba(255,255,255,0.28); line-height:1.4; }
.sk-profile-banner__cta { display:flex!important; align-items:center!important; justify-content:center!important; background:linear-gradient(135deg,#ff8a2a 0%,#ffb347 100%)!important; border:none!important; border-radius:999px!important; color:#1a0d04!important; font-family:"DM Sans",sans-serif!important; font-size:14px!important; font-weight:700!important; height:46px!important; padding:0 28px!important; cursor:pointer; transition:filter 0.18s, transform 0.18s; box-shadow:0 8px 24px rgba(255,138,42,0.3); white-space:nowrap; width:220px; }
.sk-profile-banner__cta:hover { filter:brightness(1.08)!important; transform:translateY(-2px)!important; }
.sk-profile-banner__note { font-size:11px; color:rgba(255,255,255,0.3); text-align:center; }
@media(max-width:820px){.sk-profile-banner{flex-direction:column;padding:32px 20px;margin:0 16px 64px} .sk-profile-banner__right{width:100%} .sk-profile-card{width:100%} .sk-profile-banner__cta{width:100%!important}}
@media(max-width:480px){.sk-profile-banner__perks{grid-template-columns:1fr}}

/* ══ SUPPORT / FAQ ══ */
.sk-support { padding:0 24px 96px; max-width:860px; margin:0 auto; }
.sk-support__head { text-align:center; margin-bottom:40px; }
.sk-support__eyebrow { display:inline-flex; align-items:center; gap:6px; background:rgba(255,138,42,0.1); border:1px solid rgba(255,138,42,0.22); border-radius:999px; padding:5px 16px; font-size:12px; font-weight:500; letter-spacing:0.04em; color:#ff8a2a; margin-bottom:16px; }
.sk-support__title { font-family:"Syne",sans-serif!important; font-size:clamp(24px,4vw,36px)!important; font-weight:800!important; color:#fff!important; margin:0 0 10px!important; letter-spacing:-0.02em!important; }
.sk-support__sub { font-size:14px; color:rgba(255,255,255,0.55); margin:0; }
.sk-support__grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:32px; }
.sk-faq { background:rgba(8,5,20,0.45); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:18px 20px; transition:border-color 0.22s, background 0.22s; cursor:default; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
.sk-faq:hover { border-color:rgba(255,138,42,0.28); background:rgba(255,138,42,0.06); }
.sk-faq__q { font-size:13.5px; font-weight:700; color:#fff; margin-bottom:8px; line-height:1.4; }
.sk-faq__a { font-size:13px; color:rgba(255,255,255,0.5); line-height:1.65; }
.sk-support__contact { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; padding:28px; background:rgba(8,5,20,0.45); border:1px solid rgba(255,255,255,0.12); border-radius:16px; text-align:center; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
.sk-support__contact-text { font-size:14px; color:rgba(255,255,255,0.6); }
.sk-support__contact-text strong { color:#fff; }
.sk-support__email { display:inline-flex; align-items:center; gap:8px; padding:10px 22px; border-radius:999px; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.3); color:#ff8a2a; font-size:13px; font-weight:600; text-decoration:none; transition:background 0.2s, transform 0.2s; }
.sk-support__email:hover { background:rgba(255,138,42,0.2); transform:translateY(-1px); }

/* ══ EXAMPLES ERROR STATE ══ */
.sk-examples__error {
  text-align: center;
  padding: 32px 16px;
  color: rgba(255,255,255,0.5);
  font-size: 14px;
}
.sk-examples__retry {
  margin-top: 12px;
  display: inline-flex; align-items: center;
  padding: 8px 24px; border-radius: 999px;
  background: rgba(255,138,42,0.15); border: 1px solid rgba(255,138,42,0.4);
  color: #ff8a2a; font-family: "DM Sans", sans-serif;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.2s;
}
.sk-examples__retry:hover { background: rgba(255,138,42,0.25); }

/* ══ MOBILE ══ */
@media(max-width:640px){
  .sk-support__grid{grid-template-columns:1fr} .sk-support{padding:0 16px 72px}
  .sk-support__contact{flex-direction:column;padding:20px 16px} .sk-support__email{width:100%;justify-content:center}
  .sk-hero__airportRow{flex-direction:column;align-items:stretch;max-width:100%}
  .sk-home-airport{width:100%} .sk-home-airport .ant-select{width:100%!important}
  .sk-social-proof{border-radius:12px} .sk-social-proof__stat{font-size:15px}
  .sk-trust-signals{gap:10px} .sk-trust-signals span{font-size:11px}
  .sk-time-badge-wrap{padding:6px 16px 0}
  .sk-filter-groups{padding:14px} .sk-filter-pill{padding:5px 12px;font-size:11px}
  .sk-sugg-tabs{display:none}
  /* Shorter card images on mobile so content doesn't get cut off */
  .sk-card__media { height:160px !important; }
  .sk-card--skeleton .sk-card__media { height:160px !important; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const nav = useNavigate();
  const landingRef = useRef(null);

  const { homeAirport, setHomeAirport, homeCode, homeCity } = useHomeAirport();

  const [timePeriod, setTimePeriod] = useState(() =>
    getTimePeriod(new Date().getHours())
  );
  useEffect(() => {
    if (landingRef.current)
      landingRef.current.setAttribute("data-time", timePeriod);
    const iv = setInterval(() => {
      const next = getTimePeriod(new Date().getHours());
      setTimePeriod(next);
      if (landingRef.current)
        landingRef.current.setAttribute("data-time", next);
    }, 60_000);
    return () => clearInterval(iv);
  }, [timePeriod]);
  const timeMeta = TIME_PERIODS[timePeriod];

  const [q, setQ] = useState("");
  const promptHistoryRef = useRef([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggError, setSuggError] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const debounceRef = useRef(null);
  const [isRouting, setIsRouting] = useState(false);
  const [examplePlans, setExamplePlans] = useState([]);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [examplesFailed, setExamplesFailed] = useState(false);
  const [examplesKey, setExamplesKey] = useState(0); // increment to retry
  const [activeFilters, setActiveFilters] = useState({
    budget: null,
    type: null,
    duration: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  const suggestion = suggestions[activeIdx] ?? null;

  const [visibleBubbles, setVisibleBubbles] = useState(1);
  const atlasConversation = useMemo(
    () => ATLAS_CHAT_INTRO(homeCity),
    [homeCity]
  );
  useEffect(() => {
    if (visibleBubbles >= atlasConversation.length) return;
    const t = setTimeout(
      () => setVisibleBubbles((v) => v + 1),
      visibleBubbles === 1 ? 1400 : 1800
    );
    return () => clearTimeout(t);
  }, [visibleBubbles, atlasConversation.length]);

  const runSuggestion = useCallback(
    async (prompt, filters) => {
      setSuggLoading(true);
      setSuggError(null);
      setActiveIdx(0);
      setShowSuggestion(true);
      try {
        const results = await fetchAISuggestion(
          prompt,
          homeCity,
          homeCode,
          promptHistoryRef.current,
          filters,
          3
        );
        setSuggestions(results);
      } catch (err) {
        console.error("Atlas suggestion error:", err);
        setSuggError("Couldn't load suggestion — try again.");
        setSuggestions([]);
      } finally {
        setSuggLoading(false);
      }
    },
    [homeCity, homeCode]
  );

  const triggerSuggestion = useCallback(
    (prompt, filters = activeFilters) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      let trimmed = normalizePrompt(prompt);
      const hasFilters = Object.values(filters).some(Boolean);
      if (!trimmed && !hasFilters) {
        setShowSuggestion(false);
        setSuggestions([]);
        setSuggError(null);
        return;
      }
      if (!trimmed && hasFilters) {
        const parts = [];
        if (filters.type) parts.push(filters.type + " trip");
        if (filters.budget) parts.push(filters.budget);
        if (filters.duration) parts.push(filters.duration);
        trimmed = parts.join(", ");
      }
      promptHistoryRef.current = [
        ...new Set([...promptHistoryRef.current, trimmed]),
      ].slice(-10);
      debounceRef.current = setTimeout(
        () => runSuggestion(trimmed, filters),
        600
      );
    },
    [activeFilters, runSuggestion]
  );

  const toggleFilter = useCallback(
    (group, value) => {
      setActiveFilters((prev) => {
        const next = { ...prev, [group]: prev[group] === value ? null : value };
        triggerSuggestion(q, next);
        return next;
      });
    },
    [q, triggerSuggestion]
  );

  useEffect(() => {
    const hasInput =
      normalizePrompt(q).length >= 4 ||
      Object.values(activeFilters).some(Boolean);
    if (hasInput) triggerSuggestion(q, activeFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCode]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setExamplesLoading(true);
      setExamplesFailed(false);
      try {
        const results = await Promise.allSettled(
          EXAMPLE_SEEDS.map((seed) =>
            fetchAISuggestion(seed, homeCity, homeCode, [], {}, 1)
              .then((r) => r[0])
              .catch(() => null)
          )
        );
        const plans = results
          .filter((r) => r.status === "fulfilled" && r.value)
          .map((r) => r.value);
        if (!cancelled) {
          if (plans.length === 0) setExamplesFailed(true);
          setExamplePlans(plans);
        }
      } catch {
        if (!cancelled) setExamplesFailed(true);
      } finally {
        if (!cancelled) setExamplesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCity, homeCode, examplesKey]);

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

  const viewPlan = useCallback(
    async (sugg = suggestion) => {
      if (!sugg) return;
      const prompt = normalizePrompt(q);
      const fp = Object.entries(activeFilters)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");
      try {
        setIsRouting(true);
        await trackPassportEvent("AI_PLAN_VIEWED", {
          source: "landing_suggestion",
          prompt,
          planKey: sugg.planKey,
          homeAirport: homeCode,
        });
        const base = `/booking?plan=${encodeURIComponent(
          sugg.planKey
        )}&prompt=${encodeURIComponent(prompt || sugg.trip)}&from=${homeCode}`;
        nav(fp ? `${base}&${fp}` : base);
      } finally {
        setIsRouting(false);
      }
    },
    [q, nav, suggestion, homeCode, activeFilters]
  );

  const showMoreOptions = useCallback(async () => {
    const prompt = normalizePrompt(q);
    const fp = Object.entries(activeFilters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    try {
      setIsRouting(true);
      const base = `/booking?prompt=${encodeURIComponent(
        prompt || "recommend me a trip"
      )}&from=${homeCode}&showAll=true`;
      nav(fp ? `${base}&${fp}` : base);
    } finally {
      setIsRouting(false);
    }
  }, [q, nav, homeCode, activeFilters]);

  const goSignup = useCallback(() => nav("/register"), [nav]);

  return (
    <div
      className="sk-landing"
      ref={landingRef}
      data-time={timePeriod}
      style={{ "--sk-hero-bg": `url(${heroBg})` }}
    >
      <style>{INJECTED_CSS}</style>
      <div className="sk-landing__bg" />

      <div className="sk-time-badge-wrap">
        <div className="sk-time-badge">
          <span className="sk-time-dot" />
          {timeMeta.label} mode
        </div>
      </div>

      <div className="sk-landing__content">
        {/* ══ HERO ══ */}
        <header className="sk-hero">
          <div className="sk-hero__eyebrow">{HERO_COPY.eyebrow}</div>
          <h1 className="sk-hero__title">
            {HERO_COPY.title.split("\n").map((line, i, arr) => (
              <React.Fragment key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className="sk-hero__sub">{HERO_COPY.subtitle}</p>

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

          <div className="sk-filters">
            <button
              type="button"
              className={`sk-filter-toggle ${showFilters ? "active" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              {Object.values(activeFilters).filter(Boolean).length > 0
                ? "Refine filters"
                : "Pick your trip type, budget & duration"}
              {Object.values(activeFilters).filter(Boolean).length > 0 && (
                <span className="sk-filter-badge">
                  {Object.values(activeFilters).filter(Boolean).length}
                </span>
              )}
            </button>
            {showFilters && (
              <div className="sk-filter-groups">
                {Object.entries(FILTER_OPTIONS).map(([group, opts]) => (
                  <div key={group} className="sk-filter-group">
                    <div className="sk-filter-group__label">{group}</div>
                    <div className="sk-filter-group__pills">
                      {opts.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`sk-filter-pill ${
                            activeFilters[group] === opt.value ? "active" : ""
                          }`}
                          onClick={() => toggleFilter(group, opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.values(activeFilters).some(Boolean) && (
                  <button
                    type="button"
                    className="sk-filter-clear"
                    onClick={() => {
                      setActiveFilters({
                        budget: null,
                        type: null,
                        duration: null,
                      });
                      setShowSuggestion(false);
                      setSuggestions([]);
                    }}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

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
              {!suggLoading && suggestions.length > 1 && (
                <div className="sk-sugg-tabs">
                  {suggestions.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`sk-sugg-tab ${
                        activeIdx === i ? "active" : ""
                      }`}
                      onClick={() => setActiveIdx(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {suggLoading && (
              <div className="sk-suggestion__loading">
                <LoadingOutlined spin /> Finding best options from {homeCity}…
              </div>
            )}
            {suggError && !suggLoading && (
              <div className="sk-suggestion__error">{suggError}</div>
            )}
            {suggestion && !suggLoading && !suggError && (
              <>
                <div className="sk-suggestion__body" key={activeIdx}>
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
                    {Object.values(activeFilters).some(Boolean) && (
                      <div className="sk-sugg-filter-tags">
                        {Object.entries(activeFilters)
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <span key={k} className="sk-sugg-filter-tag">
                              {v}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="sk-suggestion__right">
                    <div className="sk-suggestion__total">
                      ${suggestion.total?.toLocaleString()} <span>total</span>
                    </div>
                    <Button
                      className="sk-viewBtn"
                      onClick={() => viewPlan(suggestion)}
                      disabled={isRouting}
                    >
                      Book this <ArrowRightOutlined />
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  className="sk-sugg-more"
                  onClick={showMoreOptions}
                  disabled={isRouting}
                >
                  See all options on booking page <ArrowRightOutlined />
                </button>
              </>
            )}
          </section>

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
        </header>

        {/* ══ BELOW HERO ══ */}
        <div className="sk-below-hero">
          <div className="sk-divider" />

          <Reveal tag="section" className="sk-examples">
            <div className="sk-examples__head">
              <div className="sk-examples__kicker">
                Real plans, built instantly
              </div>
              <h2 className="sk-examples__title">
                See what Skyrio builds for you
              </h2>
              <p className="sk-examples__sub">
                {examplesLoading
                  ? "Atlas is generating live plans…"
                  : examplesFailed || examplePlans.length === 0
                  ? "Live AI-generated plans — tap retry to load."
                  : "Live AI-generated plans — click any to go straight to booking."}
              </p>
            </div>
            <div className="sk-examples__grid">
              {examplesLoading
                ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
                : examplePlans.length > 0
                ? examplePlans.map((plan, i) => (
                    <LivePlanCard
                      key={plan.planKey || i}
                      plan={plan}
                      homeCode={homeCode}
                      disabled={isRouting}
                    />
                  ))
                : null}
            </div>
            {!examplesLoading &&
              (examplesFailed || examplePlans.length === 0) && (
                <div className="sk-examples__error">
                  <p>Atlas couldn't load live plans right now.</p>
                  <button
                    type="button"
                    className="sk-examples__retry"
                    onClick={() => setExamplesKey((k) => k + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}
            <p className="sk-footline">
              No account needed to plan. Sign up when you're ready to book.
            </p>
          </Reveal>

          <div className="sk-divider" />

          <Reveal tag="section" className="sk-atlas">
            <div className="sk-atlas__head">
              <div className="sk-atlas__eyebrow">
                <Icon name="sparkle" size={11} /> Meet your travel companion
              </div>
              <h2 className="sk-atlas__title">
                Say hello to <span className="sk-atlas__name">Atlas</span>
              </h2>
              <p className="sk-atlas__sub">
                Tell Atlas where you want to go, what you want to spend, and
                what matters — it handles everything else.
              </p>
            </div>
            <div className="sk-atlas__body">
              <Reveal delay={1}>
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
                    <div className="sk-atlas__fabHint">
                      Open Atlas AI
                      <span
                        style={{
                          display: "block",
                          fontSize: "9px",
                          opacity: 0.45,
                          fontWeight: 400,
                          marginTop: 1,
                        }}
                      >
                        ↘ bottom right
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
              <div className="sk-atlas__features">
                {ATLAS_FEATURES.map((f, i) => (
                  <Reveal key={f.title} delay={i + 1}>
                    <div className="sk-atlas__feature">
                      <div className="sk-atlas__featureIcon">
                        <Icon name={f.iconKey} />
                      </div>
                      <div>
                        <div className="sk-atlas__featureTitle">{f.title}</div>
                        <div className="sk-atlas__featureDesc">{f.desc}</div>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="sk-divider" />

          <Reveal tag="section" className="sk-profile-banner">
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
                Create a free account to activate your profile instantly. Book
                your way to Explorer, Adventurer, and Legend — with real rewards
                along the way.
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
            <div className="sk-profile-banner__right">
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
                  <div className="sk-profile-card__fill" />
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
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 16V12M12 8H12.01"
                      stroke="rgba(255,255,255,0.2)"
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
          </Reveal>

          <div className="sk-divider" />

          <Reveal tag="section" className="sk-support">
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
                <Reveal key={faq.q} delay={(i % 2) + 1}>
                  <div className="sk-faq">
                    <div className="sk-faq__q">{faq.q}</div>
                    <div className="sk-faq__a">{faq.a}</div>
                  </div>
                </Reveal>
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
          </Reveal>
        </div>
      </div>
    </div>
  );
}
