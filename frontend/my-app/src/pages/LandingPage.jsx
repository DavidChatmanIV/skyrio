import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, message, Select, Tabs } from "antd";
import {
  SearchOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  LoadingOutlined,
  StarOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
} from "@ant-design/icons";

import "@/styles/LandingPage.css";
import heroBg from "@/assets/landing/skyrio-cosmic.jpg";
import { trackPassportEvent } from "@/utils/passportEvents";
import { useAuth } from "@/auth/useAuth";
import { apiUrl } from "@/lib/api";

import SavedExcursions from "../components/excursions/SavedExcursions";
import UpcomingBookings from "../components/dashboard/UpcomingBookings";
import AtlasShowcase from "../components/landing/AtlasShowcase";
import WhereToNext from "../components/landing/WhereToNext";
import XPBadgeCard from "./passport/XPBadgeCard";

const { Option } = Select;

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

// Time-of-day "modes". Tips are deliberately vibe-only — no price claims
// we can't back up with real data.
const TIME_PERIODS = {
  dawn: {
    hours: [5, 6, 7],
    label: "Dawn",
    greeting: "Good morning",
    tip: "Early start? Plan a sunrise trip while it's quiet.",
  },
  morning: {
    hours: [8, 9, 10, 11],
    label: "Morning",
    greeting: "Good morning",
    tip: "Fresh coffee, fresh ideas. Compare a few flight times.",
  },
  afternoon: {
    hours: [12, 13, 14, 15, 16],
    label: "Afternoon",
    greeting: "Good afternoon",
    tip: "Afternoon break? Map out your next long weekend.",
  },
  dusk: {
    hours: [17, 18, 19],
    label: "Sunset",
    greeting: "Good evening",
    tip: "Golden hour. Somewhere out there has a better sunset.",
  },
  night: {
    hours: [20, 21, 22, 23, 0, 1, 2, 3, 4],
    label: "Night",
    greeting: "Good evening",
    tip: "Late-night planning? Save a trip and pick it up tomorrow.",
  },
};

const HERO_COPY = {
  eyebrow: "Discover · Plan your trip with Atlas AI",
  title: "Discover your\ndream vacation.",
  subtitle:
    "Tell us where you want to go and your budget. Atlas suggests a flight + hotel plan, then you check live prices and book it right here.",
  placeholder: "Plan your next trip…",
  ctaLabel: "Plan my trip",
  secondaryCta: {
    prompt: "Want to track trips, earn XP, and unlock rewards?",
    label: "Create a free account",
  },
};

const LANDING_TRIP_TYPES = [
  { key: "solo", label: "Solo trip" },
  { key: "romantic", label: "Romantic trip" },
  { key: "family", label: "Family trip" },
  { key: "group", label: "Group trip" },
];

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

const FALLBACK_PLANS = [
  {
    trip: "Tulum, Mexico",
    dates: "Any 5 nights",
    total: 1640,
    fit: "Excellent beach pick",
    summary: "Turquoise water, cenotes, and great food within budget.",
    planKey: "tulum-5night",
  },
  {
    trip: "Barcelona, Spain",
    dates: "Any 7 nights",
    total: 2400,
    fit: "Great city break",
    summary: "Architecture, tapas, beaches — Europe's most vibrant city.",
    planKey: "barcelona-7night",
  },
  {
    trip: "Bali, Indonesia",
    dates: "Any 10 nights",
    total: 1900,
    fit: "Top adventure pick",
    summary: "Rice terraces, temples, surf — incredible value for 10 days.",
    planKey: "bali-10night",
  },
];

// Only claims that are true today — no unmeasured numbers.
const SOCIAL_PROOF = [
  { stat: "Free", label: "to plan" },
  { stat: "Atlas AI", label: "trip planner" },
  { stat: "XP", label: "earned on bookings" },
  { stat: "Stripe", label: "secure checkout" },
];

const TRUST_SIGNALS = [
  "No credit card required",
  "Free to search & plan",
  "Live prices before you pay",
];

const PROFILE_PERKS = [
  {
    iconKey: "xp",
    label: "XP & Levels",
    desc: "Earn XP when you book trips and share on SkyHub.",
  },
  {
    iconKey: "badge",
    label: "Badges",
    desc: "Collect badges for destinations and milestones.",
  },
  {
    iconKey: "reward",
    label: "Rewards",
    desc: "Spend XP in the Skyrio Rewards catalog.",
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
    a: "Searching and planning with Atlas is free. You pay for the flights and hotels you book. Optional Explorer and Legend memberships add extra perks.",
  },
  {
    q: "How does Atlas AI work?",
    a: "Tell Atlas what you want in plain words. It suggests a flight + hotel plan with estimated prices. When you open a plan, Skyrio searches live prices before you book anything.",
  },
  {
    q: "Can I change or cancel my booking?",
    a: "It depends on the booking. Every airline and hotel sets its own cancellation rules, so check the policy for your flight or hotel before you pay. If you need to cancel later, Atlas can help you with it.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. Payments are handled by Stripe. Your card details go straight to Stripe and aren't stored on Skyrio's servers.",
  },
];

async function fetchAISuggestion(
  prompt,
  homeCity,
  homeCode,
  promptHistory,
  filters = {},
  count = 3,
  signal
) {
  // apiUrl() so production hits the Render backend directly instead of
  // relying on the Vite dev proxy / vercel.json rewrite.
  const url = apiUrl("/api/atlas/suggest");
  console.log("[Atlas] fetching", url, { prompt, homeCity, homeCode, count });
  const response = await fetch(url, {
    method: "POST",
    signal,
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

function getTimePeriod(hour) {
  for (const [k, v] of Object.entries(TIME_PERIODS)) {
    if (v.hours.includes(hour)) return k;
  }
  return "night";
}
/* ── Sky dial — the sun (or moon) crossing the sky, live ── */
const DIAL_START = 5; // 5 AM: sun on the left horizon
const DIAL_END = 21; // 9 PM: sun on the right horizon

function SkyDial({ period, meta, now }) {
  const hour = now.getHours() + now.getMinutes() / 60;
  const isNight = period === "night";
  const t = Math.min(
    1,
    Math.max(0, (hour - DIAL_START) / (DIAL_END - DIAL_START))
  );
  const angle = Math.PI * (1 - t);
  const sx = 60 + 50 * Math.cos(angle);
  const sy = 58 - 50 * Math.sin(angle);
  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className="sk-dial"
      role="status"
      aria-label={`${meta.label} mode, ${time}`}
    >
      <svg
        className="sk-dial__sky"
        width="120"
        height="66"
        viewBox="0 0 120 66"
        aria-hidden="true"
      >
        <path className="sk-dial__track" d="M10 58 A50 50 0 0 1 110 58" />
        {!isNight && t > 0 && (
          <path
            className="sk-dial__progress"
            d={`M10 58 A50 50 0 0 1 ${sx.toFixed(1)} ${sy.toFixed(1)}`}
          />
        )}
        <line className="sk-dial__horizon" x1="2" y1="58" x2="118" y2="58" />
        {isNight ? (
          <g>
            <circle className="sk-dial__star" cx="30" cy="22" r="1.2" />
            <circle className="sk-dial__star" cx="88" cy="16" r="1.4" />
            <circle className="sk-dial__star" cx="97" cy="38" r="1" />
            <circle className="sk-dial__star" cx="22" cy="44" r="1" />
            <path
              className="sk-dial__moon"
              transform="translate(48 14)"
              d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
            />
          </g>
        ) : (
          <g>
            <circle className="sk-dial__glow" cx={sx} cy={sy} r="12" />
            <circle className="sk-dial__sun" cx={sx} cy={sy} r="6.5" />
          </g>
        )}
      </svg>
      <div className="sk-dial__text">
        <div className="sk-dial__top">
          <span className="sk-dial__label">{meta.label} mode</span>
          <span className="sk-dial__time">{time}</span>
        </div>
        <div className="sk-dial__tip">{meta.tip}</div>
      </div>
    </div>
  );
}

const normalizePrompt = (v) => String(v || "").trim();

const ICONS = {
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
// Small stroke icons for plan labels and the trip editor (replaces emoji)
function StrokeIcon({ size = 14, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="sk-inline-icon"
    >
      {children}
    </svg>
  );
}
ICONS.plane = ({ size }) => (
  <StrokeIcon size={size}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </StrokeIcon>
);
ICONS.bed = ({ size }) => (
  <StrokeIcon size={size}>
    <path d="M2 18V6M2 11h18a2 2 0 0 1 2 2v5M2 16h20" />
    <circle cx="7" cy="8.5" r="1.8" />
  </StrokeIcon>
);
ICONS.pencil = ({ size }) => (
  <StrokeIcon size={size}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </StrokeIcon>
);
ICONS.info = ({ size }) => (
  <StrokeIcon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.01" />
  </StrokeIcon>
);
ICONS.users = ({ size }) => (
  <StrokeIcon size={size}>
    <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.5" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
  </StrokeIcon>
);

function Icon({ name, size }) {
  const C = ICONS[name];
  return C ? <C size={size} /> : null;
}

/**
 * Builds the booking-page link for an Atlas plan.
 * Sends everything the booking page needs to fill the search form and run it
 * right away: from / to airport codes and names, depart / return dates, and
 * auto=1 (BookingPage's existing "search on arrival" flag). Old params
 * (plan, prompt) are kept so nothing that already reads them breaks.
 */
function buildPlanUrl(plan, homeCode, extra = {}) {
  const params = new URLSearchParams();
  const kind = plan.kind || "package";
  if (plan.planKey) params.set("plan", plan.planKey);
  params.set("prompt", extra.prompt || plan.trip || "");
  params.set("kind", kind);
  if (plan.depart) params.set("depart", plan.depart);
  if (plan.return) params.set("return", plan.return);

  if (kind === "hotel") {
    // Hotel only: open Stays and search hotels in the destination city.
    params.set("tab", "Stays");
    if (plan.trip) params.set("city", plan.trip);
  } else {
    // Flight only, or a package (flight first, then "Next: find your stay").
    params.set("tab", "Flights");
    params.set("from", homeCode);
    if (extra.fromName) params.set("fromName", extra.fromName);
    // No airport code? The booking page can look the airport up by city name.
    params.set("to", plan.destCode || plan.trip || "");
    if (plan.trip) params.set("toName", plan.trip);
  }
  if (plan.adults > 1) params.set("adults", String(plan.adults));
  if (plan.rooms > 1) params.set("rooms", String(plan.rooms));
  if (plan.depart && plan.return) params.set("auto", "1");
  for (const [k, v] of Object.entries(extra)) {
    if (k !== "prompt" && k !== "fromName" && v != null && v !== "")
      params.set(k, v);
  }
  return `/booking?${params.toString()}`;
}

const PLAN_KIND_LABEL = {
  package: "Flight + hotel",
  flight: "Flight only",
  hotel: "Hotel only",
};
const PLAN_KIND_ICONS = {
  package: ["plane", "bed"],
  flight: ["plane"],
  hotel: ["bed"],
};
function PlanKind({ kind }) {
  const k = PLAN_KIND_LABEL[kind] ? kind : "package";
  return (
    <div className="sk-plan-kind">
      {PLAN_KIND_ICONS[k].map((name) => (
        <Icon key={name} name={name} size={13} />
      ))}
      {PLAN_KIND_LABEL[k]}
    </div>
  );
}

// ── Trip editor helpers (dates are YYYY-MM-DD, handled in UTC) ──
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_NIGHTS = 1;
const MAX_NIGHTS = 21;
// Booking limits: flights take up to 9 travelers per booking; hotel
// searches take up to 8 rooms. Bigger groups go through Sync Together,
// where each person books their own seat.
const MAX_FLIGHT_TRAVELERS = 9;
const MAX_HOTEL_TRAVELERS = 16;
const MAX_ROOMS = 8;
const parseDay = (iso) => new Date(`${iso}T00:00:00Z`);
const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) =>
  isoDay(new Date(parseDay(iso).getTime() + n * DAY_MS));
function nightsBetween(a, b) {
  if (!a || !b) return null;
  const n = Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
  return Number.isFinite(n) && n > 0 ? n : null;
}
// "2026-11-03" + "2026-11-06" → "Nov 3–6" ; across months → "Nov 28 – Dec 3"
function formatTripDates(depart, ret) {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  const a = parseDay(depart);
  const b = parseDay(ret);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.toLocaleDateString("en-US", opts)}–${b.getUTCDate()}`
    : `${a.toLocaleDateString("en-US", opts)} – ${b.toLocaleDateString(
        "en-US",
        opts
      )}`;
}

function LivePlanCard({ plan, homeCode, homeCity, disabled }) {
  const nav = useNavigate();
  const img = getDestinationImage(plan.trip);

  // The traveler can change the start date and how many nights before
  // opening the plan. Plans without real dates (the offline fallbacks)
  // simply don't show the editor.
  const editable = Boolean(plan.depart && plan.return);
  const startNights =
    nightsBetween(plan.depart, plan.return) || plan.nights || 3;
  const [editing, setEditing] = useState(false);
  const [depart, setDepart] = useState(plan.depart);
  const [nights, setNights] = useState(startNights);
  const [travelers, setTravelers] = useState(1);
  const [rooms, setRooms] = useState(1);
  const ret = editable ? addDays(depart, nights) : plan.return;
  const kind = plan.kind || "package";
  const hasHotel = kind !== "flight";
  const maxTravelers =
    kind === "hotel" ? MAX_HOTEL_TRAVELERS : MAX_FLIGHT_TRAVELERS;
  const edited =
    editable &&
    (depart !== plan.depart ||
      nights !== startNights ||
      travelers !== 1 ||
      rooms !== 1);
  // Earliest start: a few days out, so flights and hotels are still bookable.
  const minDepart = useMemo(() => addDays(isoDay(new Date()), 3), []);

  const open = useCallback(() => {
    if (disabled) return;
    const trip = editable
      ? {
          ...plan,
          depart,
          return: ret,
          nights,
          adults: travelers,
          rooms: hasHotel ? rooms : 1,
        }
      : plan;
    nav(buildPlanUrl(trip, homeCode, { fromName: homeCity }));
  }, [
    plan,
    editable,
    depart,
    ret,
    nights,
    travelers,
    rooms,
    hasHotel,
    homeCode,
    homeCity,
    nav,
    disabled,
  ]);

  // Small −/+ control used for nights, travelers and rooms.
  const Stepper = ({ label, value, min, max, onChange, less, more }) => (
    <div className="sk-trip-edit__field">
      <span>{label}</span>
      <div className="sk-trip-edit__stepper">
        <button
          type="button"
          aria-label={less}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          −
        </button>
        <strong>{value}</strong>
        <button
          type="button"
          aria-label={more}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );

  // Clicks inside the editor must not open the plan.
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={`sk-card sk-live-card${editing ? " is-editing" : ""}`}
      role="link"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={open}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          open();
        }
      }}
      style={{
        width: "100%",
        height: "100%",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
      }}
    >
      <div
        className="sk-card__media sk-live-card__media"
        style={{ backgroundImage: `url(${img})` }}
      />
      <div className="sk-card__overlay" />
      <div className="sk-card__content">
        <PlanKind kind={plan.kind} />
        {/* AI estimate, not a live fare — real prices load on the booking page.
            Once the trip length or dates change, the estimate no longer
            applies, so say so instead of showing a wrong number. */}
        {edited ? (
          <div className="sk-live-card__price sk-live-card__price--pending">
            New price on the next page <span>trip changed</span>
          </div>
        ) : (
          plan.total != null && (
            <div className="sk-live-card__price">
              ${plan.total.toLocaleString()} <span>est. total</span>
            </div>
          )
        )}
        <div className="sk-card__title">{plan.trip}</div>
        <div className="sk-card__subtitle">{plan.fit}</div>
        <div className="sk-card__meta">
          {editable
            ? `${formatTripDates(depart, ret)} · ${nights} night${
                nights === 1 ? "" : "s"
              }${travelers > 1 ? ` · ${travelers} travelers` : ""}${
                hasHotel && rooms > 1 ? ` · ${rooms} rooms` : ""
              }`
            : plan.dates}
          {plan.summary ? ` · ${plan.summary}` : ""}
        </div>

        {editable && (
          <div className="sk-trip-edit" onClick={stop} onKeyDown={stop}>
            {!editing ? (
              <button
                type="button"
                className="sk-trip-edit__toggle"
                onClick={() => setEditing(true)}
                disabled={disabled}
              >
                <Icon name="pencil" size={13} /> Edit trip — dates, length of
                stay or travelers
              </button>
            ) : (
              <div className="sk-trip-edit__panel">
                <label className="sk-trip-edit__field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={depart}
                    min={minDepart}
                    onChange={(e) =>
                      e.target.value && setDepart(e.target.value)
                    }
                  />
                </label>
                <Stepper
                  label="Nights"
                  value={nights}
                  min={MIN_NIGHTS}
                  max={MAX_NIGHTS}
                  onChange={setNights}
                  less="Shorter stay"
                  more="Longer stay"
                />
                <Stepper
                  label="Travelers"
                  value={travelers}
                  min={1}
                  max={maxTravelers}
                  onChange={(n) => {
                    setTravelers(n);
                    setRooms((r) => Math.min(r, n)); // a room needs at least one traveler
                  }}
                  less="Fewer travelers"
                  more="More travelers"
                />
                {hasHotel && (
                  <Stepper
                    label="Rooms"
                    value={rooms}
                    min={1}
                    max={Math.min(MAX_ROOMS, travelers)}
                    onChange={setRooms}
                    less="Fewer rooms"
                    more="More rooms"
                  />
                )}
                <p className="sk-trip-edit__note">
                  <Icon name="info" size={13} /> The price shown was for Atlas's
                  original trip. Changing the dates, nights, travelers or rooms
                  changes the price. You'll see the real price for your trip on
                  the next page, before you pay anything.
                </p>
                {kind !== "hotel" && travelers >= MAX_FLIGHT_TRAVELERS && (
                  <p className="sk-trip-edit__note sk-trip-edit__note--group">
                    <Icon name="users" size={13} /> Traveling with more than{" "}
                    {MAX_FLIGHT_TRAVELERS} people, like a team or a big family?
                    Use <strong>Sync Together</strong> on the next page so
                    everyone books and pays for their own seat.
                  </p>
                )}
                <div className="sk-trip-edit__actions">
                  {edited && (
                    <button
                      type="button"
                      className="sk-trip-edit__reset"
                      onClick={() => {
                        setDepart(plan.depart);
                        setNights(startNights);
                      }}
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    className="sk-trip-edit__go"
                    onClick={open}
                    disabled={disabled}
                  >
                    Search this trip <ArrowRightOutlined />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!editing && (
          <div className="sk-card__footer sk-live-card__footer">
            <span>View plan</span>
            <ArrowRightOutlined />
          </div>
        )}
      </div>
    </div>
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

const INJECTED_CSS = `
.sk-landing {
  background: transparent !important;
}

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

.sk-below-hero {
  background: transparent !important;
  position: relative;
  z-index: 1;
}
.sk-below-hero .sk-card { background-color: transparent; }

.sk-divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,138,42,0.2), transparent);
}

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

@keyframes sk-revealUp {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
}
.sk-reveal { opacity:0; min-height:1px; }
.sk-reveal.is-visible { animation:sk-revealUp 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
.sk-reveal.is-visible.sk-d1 { animation-delay:0.07s; }
.sk-reveal.is-visible.sk-d2 { animation-delay:0.14s; }
.sk-reveal.is-visible.sk-d3 { animation-delay:0.21s; }

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

.sk-time-badge-wrap { display:flex; justify-content:flex-end; padding:10px 24px 0; position:relative; z-index:2; }
.sk-time-badge-wrap .sk-time-badge { position:relative!important; top:auto!important; right:auto!important; }

.sk-hero__search:focus-within {
  border-color: rgba(255,138,42,0.6)!important;
  box-shadow: 0 0 0 4px rgba(255,138,42,0.08), 0 8px 32px rgba(0,0,0,0.2)!important;
}

.sk-landing-tripPills {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.sk-landing-tripPill {
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.6);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: "DM Sans", sans-serif;
  transition: all 0.15s;
}
.sk-landing-tripPill:hover {
  border-color: rgba(255,138,42,0.4);
  color: #ffb066;
}
.sk-landing-tripPill.active {
  border-color: #ff8a2a;
  background: rgba(255,138,42,0.16);
  color: #ff8a2a;
  font-weight: 700;
}

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

.sk-sugg-tabs { display:flex; gap:5px; margin-left:auto; }
.sk-sugg-tab { width:26px; height:26px; border-radius:7px; font-size:11px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.5); cursor:pointer; transition:all 0.15s; font-family:"DM Sans",sans-serif; }
.sk-sugg-tab.active, .sk-sugg-tab:hover { background:rgba(255,138,42,0.18); border-color:#ff8a2a; color:#ff8a2a; }
.sk-sugg-filter-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
.sk-sugg-filter-tag { font-size:10px; font-weight:600; padding:3px 11px; border-radius:999px; background:rgba(255,138,42,0.1); border:1px solid rgba(255,138,42,0.25); color:rgba(255,138,42,0.85); }
.sk-sugg-more { display:inline-flex; align-items:center; gap:5px; margin-top:16px; font-size:12px; font-weight:600; color:rgba(255,255,255,0.4); background:none; border:none; cursor:pointer; padding:0; font-family:"DM Sans",sans-serif; transition:color 0.18s; }
.sk-sugg-more:hover { color:#ff8a2a; }
.sk-sugg-more:disabled { opacity:0.35; cursor:not-allowed; }

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

.sk-live-card { transition:transform 0.22s ease, box-shadow 0.22s ease !important; }
.sk-live-card:hover { transform:translateY(-6px) !important; box-shadow:0 20px 48px rgba(0,0,0,0.5) !important; }
.sk-live-card:hover .sk-live-card__media { transform:scale(1.04); }
.sk-live-card__media { transition:transform 0.4s ease !important; }
.sk-plan-kind { display:inline-flex; align-items:center; gap:4px; margin-bottom:8px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.02em; color:#ffb066; background:rgba(255,138,42,0.14); border:1px solid rgba(255,138,42,0.3); }
.sk-live-card__price { font-family:"Syne",sans-serif; font-size:22px; font-weight:800; color:#fff; line-height:1; margin-bottom:6px; }
.sk-live-card__price--pending { font-size:16px; color:#ffb066; }
.sk-trip-edit { margin-top:12px; cursor:default; }
.sk-trip-edit__toggle { background:none; border:none; padding:0; color:rgba(255,255,255,0.65); font-family:"DM Sans",sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.sk-trip-edit__toggle:hover { color:#ff8a2a; }
.sk-trip-edit__panel { display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; padding:12px; border-radius:12px; background:rgba(8,5,20,0.55); border:1px solid rgba(255,138,42,0.25); }
.sk-trip-edit__field { display:flex; flex-direction:column; gap:5px; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.45); }
.sk-trip-edit__field input[type="date"] { height:34px; padding:0 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff; font-family:"DM Sans",sans-serif; font-size:13px; color-scheme:dark; }
.sk-trip-edit__stepper { display:flex; align-items:center; gap:10px; height:34px; }
.sk-trip-edit__stepper button { width:30px; height:30px; border-radius:8px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff; font-size:16px; line-height:1; cursor:pointer; }
.sk-trip-edit__stepper button:hover:not(:disabled) { border-color:#ff8a2a; color:#ff8a2a; }
.sk-trip-edit__stepper button:disabled { opacity:0.35; cursor:not-allowed; }
.sk-trip-edit__stepper strong { min-width:18px; text-align:center; color:#fff; font-size:15px; }
.sk-trip-edit__note { flex-basis:100%; margin:0; font-size:12px; line-height:1.5; color:rgba(255,255,255,0.6); text-transform:none; letter-spacing:0; font-weight:400; }
.sk-trip-edit__note--group { color:#ffb066; }
.sk-trip-edit__actions { display:flex; gap:8px; margin-left:auto; }
.sk-trip-edit__reset { background:none; border:none; color:rgba(255,255,255,0.5); font-size:12px; cursor:pointer; text-decoration:underline; font-family:"DM Sans",sans-serif; }
.sk-trip-edit__go { display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 16px; border-radius:999px; border:none; background:linear-gradient(135deg,#ff8a2a,#ffb347); color:#1a0d04; font-family:"DM Sans",sans-serif; font-size:13px; font-weight:700; cursor:pointer; }
.sk-trip-edit__go:hover { filter:brightness(1.08); }
.sk-live-card.is-editing:hover { transform:none !important; }
.sk-live-card:focus-visible { outline:2px solid #ff8a2a; outline-offset:3px; }
.sk-live-card__price span { font-family:"DM Sans",sans-serif; font-size:12px; font-weight:400; color:rgba(255,255,255,0.5); margin-left:3px; }
.sk-live-card__footer { opacity:1; transform:none; transition:all 0.2s ease; }
@media(min-width:641px) {
  .sk-live-card__footer { opacity:0; transform:translateY(6px); }
  .sk-live-card:hover .sk-live-card__footer { opacity:1; transform:translateY(0); }
}

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

.sk-examples__learn { margin-top:14px; display:inline-flex; align-items:center; gap:6px; padding:8px 20px; border-radius:999px; border:1px solid rgba(255,138,42,0.35); background:rgba(255,138,42,0.1); color:#ff8a2a; font-family:"DM Sans",sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.2s; }
.sk-examples__learn:hover { background:rgba(255,138,42,0.2); }
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

.sk-authedTabs .ant-tabs-tab {
  color: rgba(255,255,255,0.55) !important;
  font-weight: 600 !important;
}
.sk-authedTabs .ant-tabs-tab:hover {
  color: #ffb066 !important;
}
.sk-authedTabs .ant-tabs-tab-active .ant-tabs-tab-btn {
  color: #ff8a2a !important;
}
.sk-authedTabs .ant-tabs-ink-bar {
  background: linear-gradient(90deg, #ff8a2a, #ffb347) !important;
  height: 3px !important;
}
.sk-authedTabs .ant-tabs-nav::before {
  border-bottom: 1px solid rgba(255,255,255,0.1) !important;
}

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
  .sk-card__media { height:160px !important; }
  .sk-card--skeleton .sk-card__media { height:160px !important; }
}
`;

export default function LandingPage() {
  const nav = useNavigate();
  const landingRef = useRef(null);

  const { user, token, isAuthed } = useAuth();
  const [authedXpLoading, setAuthedXpLoading] = useState(true);
  const [authedXp, setAuthedXp] = useState(0);
  const [authedTier, setAuthedTier] = useState("Explorer");

  useEffect(() => {
    if (!isAuthed) {
      setAuthedXpLoading(false);
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      setAuthedXpLoading(true);
      try {
        const res = await fetch(apiUrl("/api/xp/me"), {
          credentials: "include",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("xp fetch failed");
        const data = await res.json();
        if (!mounted) return;
        setAuthedXp(Number(data?.xp ?? 0));
        setAuthedTier(String(data?.tier?.name ?? "Explorer"));
      } catch {
        // intentionally silent — homepage accent only
      } finally {
        if (mounted) setAuthedXpLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isAuthed, token]);

  const { homeAirport, setHomeAirport, homeCode, homeCity } = useHomeAirport();

  // Signed-in travelers: use the home base saved on their account, so it
  // follows them to every device (localStorage alone only knows this browser).
  useEffect(() => {
    const saved = user?.homeAirport;
    if (isAuthed && saved?.code && saved.code !== homeCode) {
      setHomeAirport(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, user?.homeAirport?.code]);

  const [timePeriod, setTimePeriod] = useState(() =>
    getTimePeriod(new Date().getHours())
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (landingRef.current)
      landingRef.current.setAttribute("data-time", timePeriod);
    const iv = setInterval(() => {
      const current = new Date();
      setNow(current);
      const next = getTimePeriod(current.getHours());
      setTimePeriod(next);
      if (landingRef.current)
        landingRef.current.setAttribute("data-time", next);
    }, 60_000);
    return () => clearInterval(iv);
  }, [timePeriod]);
  const timeMeta = TIME_PERIODS[timePeriod];

  const [q, setQ] = useState("");
  const [landingTripType, setLandingTripType] = useState(null);
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
  const [examplesKey, setExamplesKey] = useState(0);
  // true when the plans below came from the traveler's own booking history
  const [picksPersonal, setPicksPersonal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    budget: null,
    type: null,
    duration: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  const suggestion = suggestions[activeIdx] ?? null;

  // Only the newest request may update the suggestion box. Without this, a
  // slow answer for "mia" can land after the answer for "miami" and replace it.
  const suggAbortRef = useRef(null);
  useEffect(() => () => suggAbortRef.current?.abort(), []);

  const runSuggestion = useCallback(
    async (prompt, filters) => {
      suggAbortRef.current?.abort();
      const controller = new AbortController();
      suggAbortRef.current = controller;

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
          3,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setSuggestions(results);
      } catch (err) {
        if (err.name === "AbortError") return; // replaced by a newer request
        console.error("Atlas suggestion error:", err);
        setSuggError("Couldn't load suggestion — try again.");
        setSuggestions([]);
      } finally {
        if (suggAbortRef.current === controller) setSuggLoading(false);
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
    let picksRetry = null;
    let personalShown = false; // once picks show, examples never replace them

    // Signed-in travelers with past bookings get picks shaped by their own
    // trips. The server answers within a couple of seconds: either the
    // picks, or "pending" while it makes them in the background.
    const fetchPicks = async () => {
      const params = new URLSearchParams({ homeCode, homeCity });
      const res = await fetch(apiUrl(`/api/atlas/picks?${params}`), {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? res.json() : null;
    };
    const showPicks = (data) => {
      if (
        cancelled ||
        !data?.personalized ||
        !Array.isArray(data.suggestions) ||
        !data.suggestions.length
      )
        return false;
      personalShown = true;
      setExamplePlans(data.suggestions);
      setPicksPersonal(true);
      setExamplesLoading(false);
      return true;
    };

    async function load() {
      setExamplesLoading(true);
      setExamplesFailed(false);

      let picksPending = false;
      if (isAuthed && token) {
        try {
          const data = await fetchPicks();
          if (showPicks(data)) return;
          picksPending = Boolean(data?.pending);
        } catch (err) {
          console.warn("[Atlas picks] falling back to general examples:", err);
        }
      }
      if (cancelled) return;
      setPicksPersonal(false);

      // Picks still being made: show the general examples now, then swap in
      // the personal picks once (they're usually ready a few seconds later).
      if (picksPending) {
        picksRetry = setTimeout(() => {
          fetchPicks()
            .then(showPicks)
            .catch(() => {});
        }, 9000);
      }

      const timeout = setTimeout(() => {
        if (!cancelled && !personalShown) {
          setExamplePlans(FALLBACK_PLANS);
          setExamplesLoading(false);
          setExamplesFailed(false);
        }
      }, 8000);

      try {
        const results = await Promise.allSettled(
          EXAMPLE_SEEDS.map((seed) =>
            fetchAISuggestion(seed, homeCity, homeCode, [], {}, 1)
              .then((r) => r[0])
              .catch(() => null)
          )
        );
        clearTimeout(timeout);
        const plans = results
          .filter((r) => r.status === "fulfilled" && r.value)
          .map((r) => r.value);
        if (!cancelled && !personalShown) {
          setExamplePlans(plans.length > 0 ? plans : FALLBACK_PLANS);
          setExamplesFailed(false);
        }
      } catch {
        clearTimeout(timeout);
        if (!cancelled && !personalShown) {
          setExamplePlans(FALLBACK_PLANS);
          setExamplesFailed(false);
        }
      } finally {
        if (!cancelled && !personalShown) setExamplesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (picksRetry) clearTimeout(picksRetry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCity, homeCode, examplesKey, isAuthed, token]);

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
      const typeParam = landingTripType ? `&type=${landingTripType}` : "";
      nav(
        `/booking?prompt=${encodeURIComponent(
          prompt
        )}&from=${homeCode}${typeParam}`
      );
    } finally {
      setIsRouting(false);
    }
  }, [q, nav, homeCode, landingTripType]);

  const viewPlan = useCallback(
    async (sugg = suggestion) => {
      if (!sugg) return;
      const prompt = normalizePrompt(q);
      try {
        setIsRouting(true);
        await trackPassportEvent("AI_PLAN_VIEWED", {
          source: "landing_suggestion",
          prompt,
          planKey: sugg.planKey,
          homeAirport: homeCode,
        });
        nav(
          buildPlanUrl(sugg, homeCode, {
            prompt: prompt || sugg.trip,
            fromName: homeCity,
            type: landingTripType,
            ...activeFilters,
          })
        );
      } finally {
        setIsRouting(false);
      }
    },
    [q, nav, suggestion, homeCode, homeCity, activeFilters, landingTripType]
  );

  const showMoreOptions = useCallback(async () => {
    const prompt = normalizePrompt(q);
    const fp = Object.entries(activeFilters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    try {
      setIsRouting(true);
      const typeParam = landingTripType ? `&type=${landingTripType}` : "";
      const base = `/booking?prompt=${encodeURIComponent(
        prompt || "recommend me a trip"
      )}&from=${homeCode}&showAll=true${typeParam}`;
      nav(fp ? `${base}&${fp}` : base);
    } finally {
      setIsRouting(false);
    }
  }, [q, nav, homeCode, activeFilters, landingTripType]);

  const goSignup = useCallback(() => nav("/register"), [nav]);

  return (
    <div
      className="sk-landing sk-discover"
      ref={landingRef}
      data-time={timePeriod}
      style={{ "--sk-hero-bg": `url(${heroBg})` }}
    >
      <style>{INJECTED_CSS}</style>
      <div className="sk-landing__bg" />

      <div className="sk-time-badge-wrap">
        <SkyDial period={timePeriod} meta={timeMeta} now={now} />
      </div>

      <div className="sk-landing__content">
        <header className="sk-hero">
          {isAuthed && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 18,
                  padding: "8px 16px 8px 8px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  backdropFilter: "blur(12px)",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg,#ff8a2a,#7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {(user?.name || user?.username || "?")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {timeMeta.greeting},{" "}
                  {user?.name?.split(" ")[0] || user?.username || "traveler"}
                </span>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: "#ff8a2a" }}
                >
                  {authedXpLoading ? "…" : `${authedXp.toLocaleString()} XP`}
                </span>
                {!authedXpLoading && (
                  <span
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}
                  >
                    {authedTier}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="sk-hero__eyebrow">{HERO_COPY.eyebrow}</div>
          <h1 className="sk-hero__title">
            {HERO_COPY.title.split("\n").map((line, i, arr) => (
              <React.Fragment key={i}>
                {i === arr.length - 1 ? (
                  <span className="sk-disc-accent">{line}</span>
                ) : (
                  line
                )}
                {i < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className="sk-hero__sub">{HERO_COPY.subtitle}</p>

          <section className="sk-disc-map" aria-label="Plan your trip">
            <div className="sk-disc-map__head">
              <span className="sk-disc-map__label">Explorer&rsquo;s map</span>
              <span className="sk-disc-map__from">
                <EnvironmentOutlined /> From {homeCode}
              </span>
            </div>
            <svg
              className="sk-disc-compass"
              width="76"
              height="76"
              viewBox="0 0 76 76"
              aria-hidden="true"
            >
              <circle cx="38" cy="38" r="34" />
              <circle cx="38" cy="38" r="26" className="is-dashed" />
              <path d="M38 8 L43 38 L38 68 L33 38 Z" className="is-needle" />
              <path d="M8 38 L38 33 L68 38 L38 43 Z" />
              <text x="38" y="6" textAnchor="middle">
                N
              </text>
            </svg>
            <span className="sk-disc-map__kicker">Who&rsquo;s exploring?</span>
            <div className="sk-landing-tripPills">
              {LANDING_TRIP_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`sk-landing-tripPill${
                    landingTripType === t.key ? " active" : ""
                  }`}
                  onClick={() =>
                    setLandingTripType((prev) =>
                      prev === t.key ? null : t.key
                    )
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

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
                <EnvironmentOutlined /> You are here
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
          </section>

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
                    <PlanKind kind={suggestion.kind} />
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
                    {/* AI estimate, not a live fare — real prices load on the booking page */}
                    {suggestion.total != null && (
                      <div className="sk-suggestion__total">
                        ${suggestion.total.toLocaleString()}{" "}
                        <span>est. total</span>
                      </div>
                    )}
                    <Button
                      className="sk-viewBtn"
                      onClick={() => viewPlan(suggestion)}
                      disabled={isRouting}
                    >
                      See live prices <ArrowRightOutlined />
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
          {!isAuthed && (
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
          )}
        </header>

        <div className="sk-below-hero">
          <div className="sk-divider" />

          <Reveal tag="section" className="sk-examples">
            <div className="sk-examples__head">
              <div className="sk-examples__kicker">Picked for you</div>
              <h2 className="sk-examples__title">
                {picksPersonal
                  ? "Trips that match your travel style"
                  : "Trips picked to get you started"}
              </h2>
              <p className="sk-examples__sub">
                {examplesLoading
                  ? "Atlas is building plans for you…"
                  : picksPersonal
                  ? "Based on your past trips and budget. Prices are estimates — click any plan to see live prices."
                  : "Every trip you book teaches Atlas your travel style: where you like to go, how long you stay and what you like to spend. The more you book, the more these picks are built just for you. Prices are estimates — click any plan to see live prices."}
              </p>
              {!isAuthed && !examplesLoading && (
                <button
                  type="button"
                  className="sk-examples__learn"
                  onClick={goSignup}
                >
                  Create a free account so Atlas can learn your style{" "}
                  <ArrowRightOutlined />
                </button>
              )}
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
                      homeCity={homeCity}
                      disabled={isRouting}
                    />
                  ))
                : null}
            </div>

            <p className="sk-footline">
              No account needed to plan. Sign up when you're ready to book.
            </p>
          </Reveal>

          <div className="sk-divider" />

          {/* Where To Next — lowest fares found from the traveler's home base */}
          <WhereToNext homeCode={homeCode} homeCity={homeCity} />

          <div className="sk-divider" />

          {/* Atlas intro — preview only; the real Atlas is the bottom-right button */}
          <AtlasShowcase homeCity={homeCity} />

          <div className="sk-divider" />

          {isAuthed ? (
            <Reveal
              tag="section"
              className="sk-profile-banner sk-profile-banner--authed"
              delay={0}
            >
              <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto" }}>
                {/* Badge + headline centered; the tab content below keeps its own alignment */}
                <div style={{ textAlign: "center" }}>
                  <div className="sk-profile-banner__badge">
                    <Icon name="sparkle" size={11} /> Your Skyrio
                  </div>
                </div>
                <h2
                  className="sk-profile-banner__title"
                  style={{ textAlign: "center" }}
                >
                  Welcome back — here's <span>what's waiting for you.</span>
                </h2>
                {/* Upcoming opens first: it holds the traveler's real booked
                    trips (solo + Sync Together). "Saved" holds saved
                    excursions. Tips removed for now. */}
                <Tabs
                  size="middle"
                  centered
                  defaultActiveKey="upcoming"
                  className="sk-authedTabs"
                  items={[
                    {
                      key: "upcoming",
                      label: (
                        <span>
                          <ClockCircleOutlined /> Upcoming
                        </span>
                      ),
                      children: <UpcomingBookings />,
                    },
                    {
                      key: "saved",
                      label: (
                        <span>
                          <StarOutlined /> Saved
                        </span>
                      ),
                      children: <SavedExcursions />,
                    },
                    {
                      key: "xp",
                      label: (
                        <span>
                          <TrophyOutlined /> XP & Badges
                        </span>
                      ),
                      children: <XPBadgeCard />,
                    },
                  ]}
                />
              </div>
            </Reveal>
          ) : (
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
                  your way to Explorer, Adventurer, and Legend — with real
                  rewards along the way.
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
                  <div className="sk-profile-card__label">
                    Your Profile Tier
                  </div>
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
                  Free account · No credit card required
                </div>
              </div>
            </Reveal>
          )}

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
