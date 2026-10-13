import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Typography,
  Space,
  Button,
  DatePicker,
  Card,
  Row,
  Col,
  Select,
  InputNumber,
  Input,
  message as antdMessage,
} from "antd";
import {
  SearchOutlined,
  EnvironmentOutlined,
  LoadingOutlined,
  SwapOutlined,
  SyncOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";

import heroImg from "@/assets/Booking/skyrio-hero.jpg";
import skyrioLogo from "@/assets/logo/skyrio-logo-transparent.png";
import "@/styles/BookingPage.css";
import "@/styles/stays-search.css";

import BookingCheckout from "@/pages/booking/BookingCheckout";
import HotelCheckout from "@/pages/booking/HotelCheckout";
import SaveTripButton from "@/components/trips/SaveTripButton";
import TripBudgetCard from "./booking/TripBudgetCard";
import AirportInput from "@/pages/booking/AirportInput";
import SmartFilterBar from "@/pages/booking/SmartFilterBar";
import HotelFilterBar, {
  DEFAULT_HOTEL_FILTERS,
  applyHotelFilters,
  HOTEL_SORT_OPTIONS,
  compareHotels,
} from "@/pages/booking/HotelFilterBar";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import HeroPlanner from "@/pages/booking/HeroPlanner";
import TripTypeSelector from "@/components/Atlas/TripTypeSelector";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import { createNotification } from "@/services/notificationsService";
import { useExcursionSearch } from "@/hooks/useExcursionSearch";
import ExcursionResults from "@/pages/booking/ExcursionResults";
import {
  Zap,
  Bell,
  BellOff,
  Plane as PlaneIcon,
  MapPin,
  DollarSign,
  Calendar,
  ChevronsDown,
  ArrowRight,
  Clock,
  Users,
} from "lucide-react";

const { Title, Text } = Typography;
const { Option } = Select;

const API = import.meta.env.VITE_API_URL || "";

// ─────────────────────────────────────────────
// SVG Weather Icons
// ─────────────────────────────────────────────

function WeatherSunny({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="5" fill="#FFB347" />
      <g stroke="#FFB347" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>
    </svg>
  );
}

function WeatherPartlyCloudy({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="10" cy="8" r="3.5" fill="#FFB347" />
      <g stroke="#FFB347" strokeWidth="1.5" strokeLinecap="round">
        <line x1="10" y1="2" x2="10" y2="3.2" />
        <line x1="5.2" y1="4.8" x2="6" y2="5.6" />
        <line x1="14.8" y1="4.8" x2="14" y2="5.6" />
        <line x1="3.5" y1="8" x2="4.7" y2="8" />
      </g>
      <path
        d="M8 17H6.5A3.5 3.5 0 1 1 8.3 11.1a5 5 0 0 1 9.4 1.4h.3A3 3 0 1 1 18 17H8z"
        fill="rgba(255,255,255,0.7)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function WeatherMostlySunny({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="11" cy="9" r="4" fill="#FFB347" />
      <g stroke="#FFB347" strokeWidth="1.5" strokeLinecap="round">
        <line x1="11" y1="2.5" x2="11" y2="3.8" />
        <line x1="5.5" y1="5" x2="6.4" y2="5.9" />
        <line x1="16.5" y1="5" x2="15.6" y2="5.9" />
        <line x1="4" y1="9" x2="5.3" y2="9" />
        <line x1="18" y1="9" x2="16.7" y2="9" />
      </g>
      <path
        d="M10 19H8A2.5 2.5 0 1 1 9.5 14.5a3.5 3.5 0 0 1 6.5 1h.5A2 2 0 1 1 16 19H10z"
        fill="rgba(255,255,255,0.55)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function WeatherRainSun({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="10" cy="6" r="3" fill="#FFB347" opacity="0.7" />
      <path
        d="M7 14H5.5A3.5 3.5 0 1 1 7.3 8.1a5 5 0 0 1 9.4 1.4h.3A3 3 0 1 1 17 14H7z"
        fill="rgba(255,255,255,0.6)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.5"
      />
      <g stroke="#64B5F6" strokeWidth="1.5" strokeLinecap="round">
        <line x1="9" y1="16" x2="8" y2="19" />
        <line x1="13" y1="16" x2="12" y2="19" />
        <line x1="17" y1="16" x2="16" y2="19" />
      </g>
    </svg>
  );
}

function WeatherRainy({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M7 13H5.5A3.5 3.5 0 1 1 7.3 7.1a5 5 0 0 1 9.4 1.4h.3A3 3 0 1 1 17 13H7z"
        fill="rgba(255,255,255,0.5)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.5"
      />
      <g stroke="#64B5F6" strokeWidth="1.5" strokeLinecap="round">
        <line x1="8" y1="15" x2="7" y2="18.5" />
        <line x1="12" y1="15" x2="11" y2="18.5" />
        <line x1="16" y1="15" x2="15" y2="18.5" />
        <line x1="10" y1="19" x2="9.5" y2="21" />
        <line x1="14" y1="19" x2="13.5" y2="21" />
      </g>
    </svg>
  );
}

function WeatherCherryBlossom({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="3" fill="#F48FB1" opacity="0.5" />
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6.5"
          rx="2.8"
          ry="4"
          fill="#F48FB1"
          opacity="0.75"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.2" fill="#FFD54F" />
    </svg>
  );
}

function WeatherTropical({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <line
        x1="12"
        y1="22"
        x2="12"
        y2="10"
        stroke="#8D6E63"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M12 10C12 10 6 4 4 6C2 8 8 12 12 10Z" fill="#66BB6A" />
      <path d="M12 10C12 10 18 4 20 6C22 8 16 12 12 10Z" fill="#81C784" />
      <path d="M12 12C12 12 5 8 3.5 10.5C2 13 9 14 12 12Z" fill="#4CAF50" />
      <path d="M12 12C12 12 19 8 20.5 10.5C22 13 15 14 12 12Z" fill="#66BB6A" />
    </svg>
  );
}

function WeatherWindy({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,0.7)"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M3 8H16a3 3 0 0 0 0-6 3 3 0 0 0-3 3" />
      <path d="M3 12h13a3 3 0 1 1-3 3" />
      <path d="M3 16h7a3 3 0 1 1-3 3" />
    </svg>
  );
}

function WeatherWaves({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4FC3F7"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" opacity="0.5" />
    </svg>
  );
}

function WeatherHibiscus({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6.5"
          rx="3"
          ry="4.5"
          fill="#EF5350"
          opacity="0.7"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3" fill="#FFEE58" />
    </svg>
  );
}

function WeatherGlobe({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,0.5)"
      strokeWidth="1.8"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      <path d="M2 12h20" />
      <path d="M4.5 6.5h15" opacity="0.6" />
      <path d="M4.5 17.5h15" opacity="0.6" />
    </svg>
  );
}

function IconHotel({ size = 14 }) {
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
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14" />
      <rect x="7" y="9" width="4" height="4" rx="0.5" />
      <rect x="13" y="9" width="4" height="4" rx="0.5" />
      <rect x="9" y="17" width="6" height="4" rx="0.5" />
    </svg>
  );
}

function IconFlight({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

function IconCar({ size = 14 }) {
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
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M5 17h14M5 17a2 2 0 01-2-2V9l2.5-4h9L19 9v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zM17 17a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

function IconWarning({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ff8a2a"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginRight: 4,
      }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────
const RESULTS_PER_PAGE = 5;
const MAX_ROOMS_PER_TRIP = 8;

const DEFAULT_FILTERS = {
  price: "any",
  stops: "any",
  time: "any",
  airline: "any",
  xp: "any",
};

const ATLAS_LOADING_STEPS = [
  "Scanning live routes…",
  "Comparing 847 options…",
  "Filtering by value + timing…",
  "Ranking best picks for you…",
  "Almost there…",
];

// The XP this flight ACTUALLY earns when booked (before the plan multiplier).
// Must match getBookingXP() in the backend config/xpRules.js — the server grants
// exactly this, so the badge on the card is never a made-up number.
// (Previously 40–90 XP, while bookings really granted 100+, and the
// "Epic 100+" / "Legend 150+" filters could never match anything.)
function getFlightXP(flight) {
  if (flight.stops === 0) return 150;
  if (flight.stops === 1) return 135;
  return 120;
}

// Sort options for the "Sort:" button — it cycles through these.
const SORT_OPTIONS = [
  { key: "price", label: "Cheapest" },
  { key: "stops", label: "Fewest stops" },
  { key: "depart", label: "Earliest departure" },
];

function compareFlights(sortKey) {
  const price = (f) => parseFloat(f.totalAmount) || Infinity;
  const depart = (f) =>
    f.departingAt ? dayjs(f.departingAt).valueOf() : Infinity;
  if (sortKey === "stops") {
    return (a, b) => (a.stops ?? 9) - (b.stops ?? 9) || price(a) - price(b);
  }
  if (sortKey === "depart") {
    return (a, b) => depart(a) - depart(b) || price(a) - price(b);
  }
  return (a, b) => price(a) - price(b);
}

function getFlightTimeSlot(flight) {
  if (!flight.departingAt) return null;
  const hour = dayjs(flight.departingAt).hour();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

function applyFilters(flights, filters) {
  return flights.filter((f) => {
    const price = parseFloat(f.totalAmount);
    if (filters.price !== "any" && price > Number(filters.price)) return false;
    if (filters.stops !== "any") {
      const s = Number(filters.stops);
      // 0 = Nonstop only · 1 = 1 stop OR FEWER (keeps nonstops) · 2 = 2+ stops
      if (s === 0 && f.stops !== 0) return false;
      if (s === 1 && f.stops > 1) return false;
      if (s >= 2 && f.stops < 2) return false;
    }
    if (filters.time !== "any" && getFlightTimeSlot(f) !== filters.time)
      return false;
    if (filters.airline !== "any" && f.owner !== filters.airline) return false;
    if (filters.xp !== "any" && getFlightXP(f) < Number(filters.xp))
      return false;
    return true;
  });
}

// A stable identity for a hotel offer, used to dedupe the room cart and
// as the React key across the results list + cart chips.
function roomKey(hotel) {
  return `${hotel.hotelId}-${hotel.offerId}`;
}

// A stable identity for a flight's OUTBOUND leg only (ignores return
// time/price) — used to group multiple round-trip fare combinations
// that share the same outbound flight but differ in which return
// flight they're paired with. LiteAPI returns each outbound+return
// pairing as its own priced "journey", so without this grouping the
// same outbound flight would show up once per available return time,
// as a wall of near-duplicate cards.
function getOutboundGroupKey(flight) {
  return [
    flight.origin,
    flight.destination,
    flight.departingAt,
    flight.ownerCode,
    flight.stops,
  ].join("|");
}

// The airports a connecting itinerary stops at, for one direction:
// EWR → ATL → MIA gives ["ATL"]. Every flight's own segments come from
// LiteAPI, so this is real data — the customer just never saw it before.
// Nonstop (or unknown) gives [].
function getConnectionCodes(slice) {
  const segs = Array.isArray(slice?.segments) ? slice.segments : [];
  return segs
    .slice(0, -1)
    .map((s) => s?.destination)
    .filter(Boolean);
}

// "Nonstop" | "1 stop · via ATL" | "2 stops · via ATL, DFW"
function describeStops(stops, slice) {
  if (!stops) return "Nonstop";
  const via = getConnectionCodes(slice);
  return `${stops} stop${stops > 1 ? "s" : ""}${
    via.length ? ` · via ${via.join(", ")}` : ""
  }`;
}

const EXAMPLE_PLANS = {
  japan: {
    destination: "Tokyo",
    iata: "NRT",
    prompt: "10-day Japan trip under $2,500 with cherry blossoms",
    budget: 2500,
    tripDays: 10,
    tab: "Flights",
  },
  miami: {
    destination: "Miami",
    iata: "MIA",
    prompt: "Miami weekend for two under $600",
    budget: 600,
    tripDays: 3,
    tab: "Flights",
  },
  paris: {
    destination: "Paris",
    iata: "CDG",
    prompt: "Paris honeymoon with premium stay ideas",
    budget: 4000,
    tripDays: 7,
    tab: "Flights",
  },
};

const PLAN_SEEDS = {
  "tokyo-kyoto": {
    destination: "Tokyo",
    iata: "NRT",
    prompt: "Tokyo + Kyoto — April 5–15, cherry blossom season",
    budget: 1462,
    tripDays: 10,
    tab: "Flights",
  },
};

function extractBudgetFromPrompt(prompt) {
  if (!prompt) return null;
  const match = prompt.match(/\$[\s]?([\d,]+)/);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ""), 10);
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  return null;
}

const KNOWN_DESTINATIONS = [
  "tokyo",
  "japan",
  "kyoto",
  "osaka",
  "miami",
  "paris",
  "bali",
  "london",
  "barcelona",
  "rome",
  "dubai",
  "bangkok",
  "singapore",
  "new york",
  "los angeles",
  "cancun",
  "hawaii",
  "sydney",
  "seoul",
];

function extractDestFromPrompt(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  const found = KNOWN_DESTINATIONS.find((d) => lower.includes(d));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);
  const skip = new Set([
    "a",
    "in",
    "to",
    "for",
    "the",
    "with",
    "under",
    "trip",
    "day",
    "week",
    "budget",
    "plan",
  ]);
  const cap = prompt
    .split(/\s+/)
    .find((w) => /^[A-Z]/.test(w) && !skip.has(w.toLowerCase()));
  return cap ?? null;
}

function getAutoSearchDates(tripDays = 10) {
  return {
    departDate: dayjs().add(14, "day").format("YYYY-MM-DD"),
    returnDate: dayjs()
      .add(14 + tripDays, "day")
      .format("YYYY-MM-DD"),
  };
}

// ─────────────────────────────────────────────
// Weather data
// ─────────────────────────────────────────────
const CITY_WEATHER = {
  "new york": {
    label: "New York",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 62° / 48°",
    sub: "Partly cloudy · Light wind",
  },
  newark: {
    label: "Newark",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 58° / 44°",
    sub: "Partly cloudy · Cool winds",
  },
  ewr: {
    label: "Newark",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 58° / 44°",
    sub: "Partly cloudy · Cool winds",
  },
  jfk: {
    label: "New York",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 62° / 48°",
    sub: "Partly cloudy · Light wind",
  },
  lga: {
    label: "New York",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 62° / 48°",
    sub: "Partly cloudy · Light wind",
  },
  lax: {
    label: "Los Angeles",
    Icon: WeatherSunny,
    temp: "Avg 75° / 60°",
    sub: "Sunny all week · Low rain risk",
  },
  ord: {
    label: "Chicago",
    Icon: WeatherWindy,
    temp: "Avg 55° / 42°",
    sub: "Windy with clear skies · Cool evenings",
  },
  miami: {
    label: "Miami",
    Icon: WeatherMostlySunny,
    temp: "Avg 78° / 65°",
    sub: "Mostly sunny · Low rain risk",
  },
  mia: {
    label: "Miami",
    Icon: WeatherMostlySunny,
    temp: "Avg 78° / 65°",
    sub: "Mostly sunny · Low rain risk",
  },
  paris: {
    label: "Paris",
    Icon: WeatherRainSun,
    temp: "Avg 59° / 46°",
    sub: "Occasional showers · Mild temps",
  },
  cdg: {
    label: "Paris",
    Icon: WeatherRainSun,
    temp: "Avg 59° / 46°",
    sub: "Occasional showers · Mild temps",
  },
  london: {
    label: "London",
    Icon: WeatherRainy,
    temp: "Avg 54° / 44°",
    sub: "Overcast · Bring an umbrella",
  },
  lhr: {
    label: "London",
    Icon: WeatherRainy,
    temp: "Avg 54° / 44°",
    sub: "Overcast · Bring an umbrella",
  },
  barcelona: {
    label: "Barcelona",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 70° / 58°",
    sub: "Warm & breezy · Great for exploring",
  },
  rome: {
    label: "Rome",
    Icon: WeatherSunny,
    temp: "Avg 72° / 56°",
    sub: "Warm & sunny · Low humidity",
  },
  tokyo: {
    label: "Tokyo",
    Icon: WeatherCherryBlossom,
    temp: "Avg 68° / 55°",
    sub: "Mild & clear · Cherry blossom season",
  },
  nrt: {
    label: "Tokyo",
    Icon: WeatherCherryBlossom,
    temp: "Avg 68° / 55°",
    sub: "Mild & clear · Cherry blossom season",
  },
  japan: {
    label: "Japan",
    Icon: WeatherCherryBlossom,
    temp: "Avg 68° / 55°",
    sub: "Mild & clear · Cherry blossom season",
  },
  kyoto: {
    label: "Kyoto",
    Icon: WeatherCherryBlossom,
    temp: "Avg 67° / 54°",
    sub: "Cherry blossoms peak · Stunning season",
  },
  osaka: {
    label: "Osaka",
    Icon: WeatherCherryBlossom,
    temp: "Avg 66° / 53°",
    sub: "Mild & pleasant · Spring conditions",
  },
  seoul: {
    label: "Seoul",
    Icon: WeatherMostlySunny,
    temp: "Avg 60° / 46°",
    sub: "Clear & cool · Low humidity",
  },
  dubai: {
    label: "Dubai",
    Icon: WeatherSunny,
    temp: "Avg 95° / 78°",
    sub: "Hot & dry · Low humidity at night",
  },
  bali: {
    label: "Bali",
    Icon: WeatherTropical,
    temp: "Avg 84° / 72°",
    sub: "Tropical · Some afternoon showers",
  },
  bangkok: {
    label: "Bangkok",
    Icon: WeatherMostlySunny,
    temp: "Avg 92° / 78°",
    sub: "Very hot · Sunny with some clouds",
  },
  singapore: {
    label: "Singapore",
    Icon: WeatherRainSun,
    temp: "Avg 88° / 76°",
    sub: "Hot & humid · Daily showers",
  },
  "los angeles": {
    label: "Los Angeles",
    Icon: WeatherSunny,
    temp: "Avg 75° / 60°",
    sub: "Sunny all week · Low rain risk",
  },
  chicago: {
    label: "Chicago",
    Icon: WeatherWindy,
    temp: "Avg 55° / 42°",
    sub: "Windy with clear skies · Cool evenings",
  },
  "las vegas": {
    label: "Las Vegas",
    Icon: WeatherSunny,
    temp: "Avg 85° / 64°",
    sub: "Hot & dry · Clear skies",
  },
  cancun: {
    label: "Cancún",
    Icon: WeatherWaves,
    temp: "Avg 88° / 74°",
    sub: "Hot & humid · Perfect beach weather",
  },
  hawaii: {
    label: "Hawaii",
    Icon: WeatherHibiscus,
    temp: "Avg 82° / 70°",
    sub: "Sunny with trade winds · Ideal conditions",
  },
  sydney: {
    label: "Sydney",
    Icon: WeatherMostlySunny,
    temp: "Avg 72° / 60°",
    sub: "Mostly sunny · Comfortable",
  },
};

const DEFAULT_WEATHER = {
  label: null,
  Icon: WeatherGlobe,
  temp: "",
  sub: "Select a destination to see weather",
};

function getWeatherForCity(cityStr) {
  if (!cityStr) return DEFAULT_WEATHER;
  const key = cityStr.toLowerCase().trim();
  if (CITY_WEATHER[key]) return CITY_WEATHER[key];
  const partial = Object.keys(CITY_WEATHER).find((k) => key.includes(k));
  if (partial) return CITY_WEATHER[partial];
  const reverse = Object.keys(CITY_WEATHER).find((k) => k.includes(key));
  if (reverse) return CITY_WEATHER[reverse];
  return DEFAULT_WEATHER;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SearchBtn({ onClick, loading }) {
  return (
    <Button
      className="sk-btn-orange sk-btn-search-pill"
      icon={loading ? <LoadingOutlined /> : <SearchOutlined />}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "Searching…" : "Search"}
    </Button>
  );
}

const PRIMARY_TABS = [
  { key: "Flights", label: "Flights" },
  { key: "Stays", label: "Stays" },
  { key: "Saved", label: "Saved" },
];

// NOTE: Cars is flagged `comingSoon` — it renders in the "More" menu as a
// disabled item with a "Soon" badge + tooltip instead of being hidden.
// Flip `comingSoon` to false (or drop the flag) once DiscoverCars is wired up.
const MORE_TABS = [
  { key: "Cars", label: "Cars", comingSoon: true },
  { key: "Excursions", label: "Excursions" },
  { key: "Packages", label: "Packages" },
  { key: "Last-Minute", label: "Last-Minute" },
];

function BookingTabBar({ value, onChange }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const moreRef = useRef(null);
  const menuRef = useRef(null);
  const isMoreActive = MORE_TABS.some((t) => t.key === value);

  // The menu is rendered on <body> (a portal) and placed under the More
  // button. Inside the tab bar it got clipped on phones, where the bar
  // scrolls sideways — so More looked dead.
  const placeMenu = useCallback(() => {
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 220;
    const left = Math.max(
      12,
      Math.min(r.right - width, window.innerWidth - width - 12)
    );
    setMenuPos({ top: r.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    placeMenu();
    const outside = (e) => {
      if (
        moreRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return;
      setMoreOpen(false);
    };
    const close = () => setMoreOpen(false);
    const onKey = (e) => e.key === "Escape" && close();
    // pointerdown covers mouse AND touch
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [moreOpen, placeMenu]);

  const handleSelect = (t) => {
    if (t.comingSoon) {
      antdMessage.info(`${t.label} is coming soon — stay tuned!`);
      setMoreOpen(false);
      return;
    }
    onChange(t.key);
    setMoreOpen(false);
  };

  return (
    <div className="sk-tab-bar">
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`sk-tab-btn${value === t.key ? " is-active" : ""}`}
          onClick={() => handleSelect(t)}
        >
          {t.label}
        </button>
      ))}
      <div className="sk-tab-more" ref={moreRef}>
        <button
          type="button"
          className={`sk-tab-more-btn${moreOpen ? " is-open" : ""}${
            isMoreActive ? " has-active" : ""
          }`}
          onClick={() => {
            if (!moreOpen) placeMenu();
            setMoreOpen((v) => !v);
          }}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          {isMoreActive
            ? MORE_TABS.find((t) => t.key === value)?.label
            : "More"}
          <span
            style={{
              fontSize: 9,
              opacity: 0.6,
              display: "inline-block",
              transition: "transform 0.18s",
              transform: moreOpen ? "rotate(180deg)" : "none",
            }}
          >
            ▾
          </span>
        </button>
        {moreOpen &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              className="sk-tab-more-menu sk-tab-more-menu--portal"
              role="menu"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
            >
              {MORE_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="menuitem"
                  className={`sk-tab-more-item${
                    value === t.key ? " is-active" : ""
                  }${t.comingSoon ? " is-disabled" : ""}`}
                  onClick={() => handleSelect(t)}
                  aria-disabled={t.comingSoon || undefined}
                  title={t.comingSoon ? `${t.label} — coming soon` : undefined}
                >
                  <span className="sk-tab-more-item-label">{t.label}</span>
                  {t.comingSoon && (
                    <span className="sk-soon-badge">
                      <Clock size={9} className="sk-soon-badge-icon" />
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

const BOOKING_TRIP_TYPES = [
  { key: "roundtrip", label: "Round trip" },
  { key: "oneway", label: "One way" },
  { key: "multi-city", label: "Multi-city" },
];

function TripTypeToggle({ value, onChange }) {
  return (
    <div className="sk-trip-type">
      {BOOKING_TRIP_TYPES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`sk-trip-type-btn${value === key ? " is-active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const EMPTY_LEG = () => ({
  id: Date.now() + Math.random(),
  origin: null,
  originDisplay: "",
  dest: null,
  destDisplay: "",
  date: null,
});

function MultiCityForm({ onDestChange, onDatesChange }) {
  const [legs, setLegs] = useState([EMPTY_LEG(), EMPTY_LEG()]);
  const [cabin, setCabin] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);

  const updateLeg = (index, patch) =>
    setLegs((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  const addLeg = () => {
    if (legs.length >= 6)
      return antdMessage.info("Maximum 6 flights for multi-city");
    setLegs((prev) => [...prev, EMPTY_LEG()]);
  };
  const removeLeg = (index) => {
    if (legs.length <= 2)
      return antdMessage.info("At least 2 flights required");
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const lastDest = [...legs].reverse().find((l) => l.dest?.city);
    if (lastDest) onDestChange?.(lastDest.dest.city);
  }, [legs, onDestChange]);

  const handleSearch = async () => {
    const incomplete = legs.find((l) => !l.origin || !l.dest || !l.date);
    if (incomplete)
      return antdMessage.warning("Please fill in all flights before searching");
    setLoading(true);
    try {
      const results = await Promise.all(
        legs.map((leg) => {
          const params = new URLSearchParams({
            from: leg.origin.code,
            to: leg.dest.code,
            departDate: dayjs(leg.date.toDate()).format("YYYY-MM-DD"),
            adults: String(adults),
            cabin,
          });
          return fetch(`${API}/api/flights/search?${params}`)
            .then((r) => r.json())
            .then((data) => {
              if (!data.ok) throw new Error(data.message || "Search failed");
              return data.flights ?? [];
            });
        })
      );
      antdMessage.success(
        `Found ${results.flat().length} options across ${legs.length} flights`
      );
    } catch (err) {
      antdMessage.error(err.message || "Multi-city search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sk-search-bar sk-multicity-bar">
      <div className="sk-mc-legs">
        {legs.map((leg, index) => (
          <div key={leg.id} className="sk-mc-leg">
            <div className="sk-mc-leg-badge">
              <span className="sk-mc-leg-num">{index + 1}</span>
              {index < legs.length - 1 && <div className="sk-mc-leg-line" />}
            </div>
            <div className="sk-mc-leg-fields">
              <div className="sk-mc-field-row">
                <div className="sk-mc-field">
                  <span className="sk-mc-field-label">From</span>
                  <AirportInput
                    value={leg.originDisplay}
                    placeholder="City or airport"
                    onChange={(ap) =>
                      updateLeg(index, {
                        origin: ap,
                        originDisplay: `${ap.city} (${ap.code})`,
                      })
                    }
                  />
                </div>
                <div className="sk-mc-arrow" aria-hidden="true">
                  →
                </div>
                <div className="sk-mc-field">
                  <span className="sk-mc-field-label">To</span>
                  <AirportInput
                    value={leg.destDisplay}
                    placeholder="City or airport"
                    onChange={(ap) => {
                      updateLeg(index, {
                        dest: ap,
                        destDisplay: `${ap.city} (${ap.code})`,
                      });
                      if (index < legs.length - 1) {
                        setLegs((prev) =>
                          prev.map((l, i) =>
                            i === index + 1 && !l.origin
                              ? {
                                  ...l,
                                  origin: ap,
                                  originDisplay: `${ap.city} (${ap.code})`,
                                }
                              : l
                          )
                        );
                      }
                    }}
                  />
                </div>
                <div className="sk-mc-field sk-mc-field--date">
                  <span className="sk-mc-field-label">Date</span>
                  <DatePicker
                    className="sk-orange-picker sk-mc-datepicker"
                    placeholder="Depart"
                    value={leg.date}
                    disabledDate={(d) => {
                      if (!d) return false;
                      if (d.isBefore(dayjs(), "day")) return true;
                      if (index > 0 && legs[index - 1].date)
                        return d.isBefore(legs[index - 1].date, "day");
                      return false;
                    }}
                    onChange={(date) => updateLeg(index, { date })}
                  />
                </div>
                {legs.length > 2 && (
                  <button
                    type="button"
                    className="sk-mc-remove-btn"
                    onClick={() => removeLeg(index)}
                    aria-label={`Remove flight ${index + 1}`}
                  >
                    <CloseOutlined />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="sk-mc-controls">
        <button
          type="button"
          className="sk-mc-add-btn"
          onClick={addLeg}
          disabled={legs.length >= 6}
        >
          <span className="sk-mc-add-icon">+</span>Add flight
        </button>
        <div className="sk-mc-right">
          <Select
            className="sk-select-cabin"
            value={cabin}
            onChange={setCabin}
            classNames={{ popup: { root: "sk-select-popup" } }}
          >
            <Option value="economy">Economy</Option>
            <Option value="premium_economy">Premium Economy</Option>
            <Option value="business">Business</Option>
            <Option value="first">First Class</Option>
          </Select>
          <InputNumber
            className="sk-input-travelers"
            min={1}
            max={9}
            value={adults}
            onChange={(v) => setAdults(v ?? 1)}
            placeholder="Travelers"
          />
          <SearchBtn onClick={handleSearch} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function FlightsForm({
  onSearch,
  onDestChange,
  onDatesChange,
  onOriginChange,
  onSearchStart,
  onSearchEnd,
  onSearchError,
  retryRef,
  initial = null,
}) {
  const [originAirport, setOriginAirport] = useState(null);
  const [destAirport, setDestAirport] = useState(null);
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [cabin, setCabin] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tripType, setTripType] = useState("roundtrip");

  const handleDatesChange = useCallback(
    (v) => {
      const newDates = v ?? [null, null];
      setDates(newDates);
      if (newDates[0] && newDates[1]) {
        onDatesChange?.({
          dates: newDates,
          nights: newDates[1].diff(newDates[0], "day"),
        });
      } else {
        onDatesChange?.({ dates: newDates, nights: null });
      }
    },
    [onDatesChange]
  );

  // ── Prefill from the link (e.g. a Sync Together trip): from/to airport
  // codes or a city name, and dates. Runs once; the traveler can change
  // anything before searching.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || prefilledRef.current) return;
    prefilledRef.current = true;
    const asAirport = (a, fallback) => {
      const code = a?.code || a?.iata || a?.iataCode || a?.iata_code;
      if (!code) return null;
      return {
        ...a,
        code,
        city: a.city || a.cityName || a.city_name || a.name || fallback || code,
      };
    };
    const lookup = async (q) => {
      if (!q) return null;
      if (/^[A-Za-z]{3}$/.test(q.trim()))
        return { code: q.trim().toUpperCase(), city: q.trim().toUpperCase() };
      try {
        const res = await fetch(
          `${API}/api/airports?q=${encodeURIComponent(q.trim())}`
        );
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : data?.airports || data?.data || data?.results || [];
        return asAirport(list[0], q.trim());
      } catch {
        return null;
      }
    };
    (async () => {
      const [o, d] = await Promise.all([
        lookup(initial.from),
        lookup(initial.to),
      ]);
      if (o) {
        setOriginAirport(o);
        setOriginDisplay(`${o.city} (${o.code})`);
        onOriginChange?.(o.city);
      }
      if (d) {
        setDestAirport(d);
        setDestDisplay(`${d.city} (${d.code})`);
        onDestChange?.(d.city);
      }
      // From the trip page: run the search right away.
      const depart = initial.depart ? dayjs(initial.depart) : null;
      if (initial.autoSearch && o && d && depart?.isValid()) {
        const q = new URLSearchParams({
          from: o.code,
          to: d.code,
          departDate: depart.format("YYYY-MM-DD"),
          adults: String(Number(initial.adults) || 1),
          cabin: initial.cabin || "economy",
        });
        if (Number(initial.adults) >= 1)
          setAdults(Math.min(9, Number(initial.adults)));
        const back = initial.ret ? dayjs(initial.ret) : null;
        if (back?.isValid()) q.set("returnDate", back.format("YYYY-MM-DD"));
        if (initial.cabin) setCabin(initial.cabin);
        runFlightSearch(q.toString());
      }
    })();
    const start = initial.depart ? dayjs(initial.depart) : null;
    const end = initial.ret ? dayjs(initial.ret) : null;
    if (start?.isValid()) {
      handleDatesChange([start, end?.isValid() ? end : null]);
      if (!end?.isValid()) setTripType("oneway");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Remember the last search so "Try again" can re-run it exactly, without
  // the customer having to re-enter anything.
  const lastQueryRef = useRef(null);

  const runFlightSearch = async (query) => {
    lastQueryRef.current = query;
    setLoading(true);
    onSearchError?.(null);
    onSearchStart?.();

    try {
      const res = await fetch(`${API}/api/flights/search?${query}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Flight search failed");
      }

      const flights = data.flights ?? [];
      onSearch(flights);

      // The airline's system failed, so the server returned this exact
      // search from a few minutes ago. Say so plainly.
      if (data.stale) {
        antdMessage.info(
          "Showing results from a few minutes ago — the exact price is confirmed before you pay."
        );
      }

      if (flights.length === 0) {
        antdMessage.info(
          "No flights found for this route — try adjusting dates."
        );
      } else {
        antdMessage.success(`Found ${flights.length} flights`);
      }
    } catch (err) {
      onSearch([]);
      onSearchError?.(err.message || "Flight search failed");
    } finally {
      setLoading(false);
      onSearchEnd?.();
    }
  };

  // Lets BookingPage's "Try again" button re-run the last search.
  useEffect(() => {
    if (!retryRef) return;
    retryRef.current = () => {
      if (lastQueryRef.current) runFlightSearch(lastQueryRef.current);
    };
  });

  const handleSearch = () => {
    if (!originAirport)
      return antdMessage.warning("Select a departure airport");
    if (!destAirport)
      return antdMessage.warning("Select a destination airport");
    if (!dates[0]) return antdMessage.warning("Select a departure date");
    if (tripType === "roundtrip" && !dates[1])
      return antdMessage.warning("Select a return date, or switch to One way");

    const params = new URLSearchParams({
      from: originAirport.code,
      to: destAirport.code,
      departDate: dayjs(dates[0].toDate()).format("YYYY-MM-DD"),
      adults: String(adults),
      cabin,
    });
    if (tripType === "roundtrip" && dates[1]) {
      params.set("returnDate", dayjs(dates[1].toDate()).format("YYYY-MM-DD"));
    }

    runFlightSearch(params.toString());
  };

  const handleSwap = () => {
    const prevOrigin = originAirport;
    const prevDest = destAirport;
    setOriginAirport(prevDest);
    setDestAirport(prevOrigin);
    setOriginDisplay(destDisplay);
    setDestDisplay(originDisplay);
    if (prevDest?.city) onOriginChange?.(prevDest.city);
    if (prevOrigin?.city) onDestChange?.(prevOrigin.city);
  };

  if (tripType === "multi-city") {
    return (
      <div className="sk-search-bar">
        <div className="sk-trip-type-row">
          <TripTypeToggle value={tripType} onChange={setTripType} />
        </div>
        <MultiCityForm
          onDestChange={onDestChange}
          onDatesChange={onDatesChange}
        />
      </div>
    );
  }

  return (
    <div className="sk-search-bar">
      <div className="sk-trip-type-row">
        <TripTypeToggle value={tripType} onChange={setTripType} />
      </div>
      <div className="sk-pass sk-pass--flights">
        <div className="sk-pass-seg sk-pass-seg--from sk-pass-flat">
          <span className="sk-pass-label">
            <PlaneIcon
              size={12}
              aria-hidden="true"
              style={{ transform: "rotate(45deg)" }}
            />{" "}
            From
          </span>
          <AirportInput
            value={originDisplay}
            placeholder="City or airport"
            onChange={(ap) => {
              setOriginAirport(ap);
              setOriginDisplay(`${ap.city} (${ap.code})`);
              onOriginChange?.(ap.city);
            }}
          />
        </div>

        <div className="sk-pass-seg sk-pass-seg--to sk-pass-flat">
          <button
            type="button"
            className="sk-pass-swap"
            onClick={handleSwap}
            aria-label="Swap departure and destination"
            title="Swap"
          >
            <SwapOutlined />
          </button>
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> To
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="City or airport"
            onChange={(ap) => {
              setDestAirport(ap);
              setDestDisplay(`${ap.city} (${ap.code})`);
              onDestChange?.(ap.city);
            }}
          />
        </div>

        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" />
            {tripType === "roundtrip" ? "Depart → Return" : "Depart"}
            {tripType === "roundtrip" && dates[0] && dates[1] && (
              <span className="sk-pass-nights">
                · {dates[1].diff(dates[0], "day")} night
                {dates[1].diff(dates[0], "day") !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          {tripType === "roundtrip" ? (
            <SkyrioPicker
              className="sk-orange-picker"
              value={dates}
              onChange={handleDatesChange}
              placeholder={["Depart", "Return"]}
              disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
            />
          ) : (
            <DatePicker
              className="sk-orange-picker"
              placeholder="Departure date"
              value={dates[0]}
              format="ddd, MMM D"
              disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
              onChange={(date) => {
                const nd = [date, null];
                setDates(nd);
                onDatesChange?.({ dates: nd, nights: null });
              }}
            />
          )}
        </div>

        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <TravelersCabinPicker
            adults={adults}
            cabin={cabin}
            onChange={({ adults: a, cabin: c }) => {
              setAdults(a);
              setCabin(c);
            }}
          />
        </div>

        <button
          type="button"
          className="sk-pass-go"
          onClick={handleSearch}
          disabled={loading}
          aria-label="Search flights"
        >
          {loading ? <LoadingOutlined /> : <SearchOutlined />}
          <span className="sk-pass-go-text">
            {loading ? "Searching…" : "Search flights"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stays search helpers
// ─────────────────────────────────────────────

// Only used when someone types a city WITHOUT picking a suggestion
// (a picked suggestion has an exact placeId, so country doesn't matter).
const STAY_COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["GB", "United Kingdom"],
  ["IE", "Ireland"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["PT", "Portugal"],
  ["IT", "Italy"],
  ["DE", "Germany"],
  ["NL", "Netherlands"],
  ["GR", "Greece"],
  ["CH", "Switzerland"],
  ["AT", "Austria"],
  ["TR", "Turkey"],
  ["AE", "United Arab Emirates"],
  ["EG", "Egypt"],
  ["MA", "Morocco"],
  ["ZA", "South Africa"],
  ["KE", "Kenya"],
  ["NG", "Nigeria"],
  ["GH", "Ghana"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["CN", "China"],
  ["TH", "Thailand"],
  ["SG", "Singapore"],
  ["ID", "Indonesia"],
  ["VN", "Vietnam"],
  ["PH", "Philippines"],
  ["IN", "India"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["BR", "Brazil"],
  ["AR", "Argentina"],
  ["CO", "Colombia"],
  ["PE", "Peru"],
  ["CR", "Costa Rica"],
  ["DO", "Dominican Republic"],
  ["JM", "Jamaica"],
  ["BS", "Bahamas"],
  ["PR", "Puerto Rico"],
];

// Picks the country out of a suggestion's secondary text ("Florida, USA" → US).
const COUNTRY_ALIASES = { USA: "US", "U.S.": "US", UK: "GB", UAE: "AE" };
function countryFromText(text = "") {
  const t = text.toLowerCase();
  const alias = Object.entries(COUNTRY_ALIASES).find(([a]) =>
    new RegExp(`\\b${a.replace(/\./g, "\\.").toLowerCase()}\\b`).test(t)
  );
  if (alias) return alias[1];
  return (
    STAY_COUNTRIES.find(([, name]) => t.includes(name.toLowerCase()))?.[0] ??
    null
  );
}

const POPULAR_STAYS = [
  { city: "Miami", country: "US" },
  { city: "New York", country: "US" },
  { city: "Las Vegas", country: "US" },
  { city: "Orlando", country: "US" },
  { city: "Cancun", country: "MX" },
  { city: "London", country: "GB" },
  { city: "Paris", country: "FR" },
  { city: "Tokyo", country: "JP" },
];

// Recent stay searches — a per-browser convenience only, so every read/write is guarded.
const RECENT_STAYS_KEY = "skyrio:recentStays";
function loadRecentStays() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_STAYS_KEY) || "[]");
    return Array.isArray(list) ? list.slice(0, 4) : [];
  } catch {
    return [];
  }
}
function saveRecentStay(entry) {
  try {
    const key = (e) =>
      `${(e.placeId || e.city).toLowerCase()}|${e.checkin}|${e.checkout}`;
    const next = [
      entry,
      ...loadRecentStays().filter((e) => key(e) !== key(entry)),
    ].slice(0, 4);
    localStorage.setItem(RECENT_STAYS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadRecentStays();
  }
}

// XP a stay booking earns (before plan multiplier). Must match getBookingXP()
// for hotels in the backend config/xpRules.js — currently the flat 150.
const STAY_BOOKING_XP = 150;

// ── Place suggestions ──
// Splits a LiteAPI /data/places result into a bold name line and a region
// line ("Miami Beach" / "Florida, United States"), and works out what kind
// of place it is so the dropdown can show the right icon.
function normalizePlace(p) {
  let name = String(
    p.displayName ?? p.name ?? p.formattedAddress ?? "Unknown place"
  );
  const full = String(p.formattedAddress ?? "");
  let secondary = String(p.secondaryText ?? "");
  if (!secondary && full) {
    secondary = full.toLowerCase().startsWith(name.toLowerCase())
      ? full.slice(name.length).replace(/^[\s,–-]+/, "")
      : full === name
      ? ""
      : full;
  }
  if (!secondary && name.includes(", ")) {
    const [first, ...rest] = name.split(", ");
    name = first;
    secondary = rest.join(", ");
  }
  if (!secondary && p.country) secondary = String(p.country);
  const types = []
    .concat(p.types ?? p.type ?? [])
    .map((t) => String(t).toLowerCase());
  return {
    placeId: p.placeId ?? p.id,
    displayName: name,
    secondaryText: secondary,
    types,
  };
}

const CITY_TYPES = [
  "locality",
  "sublocality",
  "neighborhood",
  "administrative_area",
  "postal_town",
  "colloquial_area",
  "city",
  "political",
  "country",
];
function placeKind(types = []) {
  if (types.some((t) => t.includes("lodging") || t.includes("hotel")))
    return "hotel";
  if (types.some((t) => CITY_TYPES.some((c) => t.startsWith(c)))) return "city";
  if (types.length === 0) return "city";
  return "poi";
}

function PlaceKindIcon({ kind, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (kind === "hotel") {
    return (
      <svg {...common}>
        <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
        <circle cx="7" cy="11" r="1.6" />
      </svg>
    );
  }
  if (kind === "poi") {
    return (
      <svg {...common}>
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.3" />
      </svg>
    );
  }
  if (kind === "recent") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 21V5.5L10 3v18M10 21V9l10 3v9M3 21h18" />
      <path d="M6.5 8h1M6.5 11.5h1M6.5 15h1M13 14h1M16.5 14h1M13 17.5h1M16.5 17.5h1" />
    </svg>
  );
}

// "2 travelers, 1 room" in a single control, like the big travel sites.
function GuestsRoomsPicker({ adults, rooms, maxRooms, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Stepper = ({ label, sub, value, min, max, onSet }) => (
    <div className="sk-guests-row">
      <div>
        <div className="sk-guests-row-label">{label}</div>
        {sub && <div className="sk-guests-row-sub">{sub}</div>}
      </div>
      <div className="sk-guests-stepper">
        <button
          type="button"
          onClick={() => onSet(value - 1)}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          −
        </button>
        <span aria-live="polite">{value}</span>
        <button
          type="button"
          onClick={() => onSet(value + 1)}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="sk-guests" ref={ref}>
      <button
        type="button"
        className="sk-guests-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Users size={17} style={{ opacity: 0.7, flexShrink: 0 }} />
        <span>
          {adults} traveler{adults !== 1 ? "s" : ""}, {rooms} room
          {rooms !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div
          className="sk-guests-pop"
          role="dialog"
          aria-label="Travelers and rooms"
        >
          {Stepper({
            label: "Travelers",
            sub: "Adults",
            value: adults,
            min: Math.max(1, rooms),
            max: 40,
            onSet: (v) => onChange({ adults: v, rooms }),
          })}
          {Stepper({
            label: "Rooms",
            sub: "Each room needs at least 1 traveler",
            value: rooms,
            min: 1,
            max: Math.min(maxRooms, adults),
            onSet: (v) => onChange({ adults, rooms: v }),
          })}
          <button
            type="button"
            className="sk-guests-done"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

const CABINS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First Class" },
];

// "1 traveler · Economy" in one control for the Flights pass.
function TravelersCabinPicker({ adults, cabin, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cabinLabel = CABINS.find((c) => c.value === cabin)?.label ?? "Economy";

  return (
    <div className="sk-guests" ref={ref}>
      <button
        type="button"
        className="sk-guests-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Users size={17} style={{ opacity: 0.7, flexShrink: 0 }} />
        <span>
          {adults} traveler{adults !== 1 ? "s" : ""} · {cabinLabel}
        </span>
      </button>
      {open && (
        <div
          className="sk-guests-pop"
          role="dialog"
          aria-label="Travelers and cabin"
        >
          <div className="sk-guests-row">
            <div>
              <div className="sk-guests-row-label">Travelers</div>
              <div className="sk-guests-row-sub">Adults · up to 9</div>
            </div>
            <div className="sk-guests-stepper">
              <button
                type="button"
                onClick={() => onChange({ adults: adults - 1, cabin })}
                disabled={adults <= 1}
                aria-label="Fewer travelers"
              >
                −
              </button>
              <span aria-live="polite">{adults}</span>
              <button
                type="button"
                onClick={() => onChange({ adults: adults + 1, cabin })}
                disabled={adults >= 9}
                aria-label="More travelers"
              >
                +
              </button>
            </div>
          </div>
          <div className="sk-guests-row sk-guests-row--stack">
            <div className="sk-guests-row-label">Cabin</div>
            <div
              className="sk-cabin-options"
              role="radiogroup"
              aria-label="Cabin"
            >
              {CABINS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={cabin === c.value}
                  className={`sk-cabin-opt${
                    cabin === c.value ? " is-active" : ""
                  }`}
                  onClick={() => onChange({ adults, cabin: c.value })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="sk-guests-done"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// Weekend shortcuts: Friday → Sunday (or Saturday → Sunday if it's already Saturday).
function weekendRange(weeksAhead = 0) {
  const today = dayjs().startOf("day");
  const dow = today.day(); // 0 Sun … 6 Sat
  let start;
  if (dow === 6) {
    // Saturday: "this weekend" starts today; later weekends start on the coming Fridays.
    start =
      weeksAhead === 0 ? today : today.add(6 + 7 * (weeksAhead - 1), "day");
  } else {
    start = today.day(5).add(7 * weeksAhead, "day");
  }
  const end = start.day() === 6 ? start.add(1, "day") : start.add(2, "day");
  return [start, end];
}

// ─────────────────────────────────────────────
// StaysForm — real hotel search wired to
// /api/hotels/lookup → /api/hotels/search
// ─────────────────────────────────────────────
function StaysForm({
  onSearch,
  onDestChange,
  onDatesChange,
  onSearchStart,
  onSearchEnd,
  initial = null,
}) {
  const [cityName, setCityName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  // Selected place from the autocomplete dropdown, if any. When set,
  // search uses this placeId directly (LiteAPI's preferred, exact way
  // to resolve a destination) instead of the countryCode+cityName
  // fallback, which LiteAPI's own docs note requires an EXACT string
  // match and can silently return zero hotels for larger/ambiguous
  // cities.
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [dates, setDates] = useState([null, null]);
  // Travelers/rooms as plain numbers instead of a handful of fixed
  // presets ("1 traveler, 1 room" / "2 travelers, 2 rooms" etc.) — those
  // presets topped out at 3 travelers / 2 rooms, which doesn't work for
  // a big party (a sports team, a large family reunion). MAX_ROOMS_PER_TRIP
  // is the same cap already used for the room cart, kept consistent here.
  const [adults, setAdults] = useState(2);
  const [numRooms, setNumRooms] = useState(1);
  const [loading, setLoading] = useState(false);

  // Prefill city, dates and guests from the link (e.g. a Sync Together trip).
  const stayPrefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || stayPrefilledRef.current) return;
    stayPrefilledRef.current = true;
    if (initial.city) {
      setCityName(initial.city);
      onDestChange?.(initial.city);
    }
    const start = initial.checkin ? dayjs(initial.checkin) : null;
    const end = initial.checkout ? dayjs(initial.checkout) : null;
    if (start?.isValid() && end?.isValid()) {
      setDates([start, end]);
      onDatesChange?.({ dates: [start, end], nights: end.diff(start, "day") });
    }
    const n = Number(initial.adults);
    if (Number.isInteger(n) && n >= 1 && n <= 40) setAdults(n);
    const r = Number(initial.rooms);
    if (Number.isInteger(r) && r >= 1 && r <= MAX_ROOMS_PER_TRIP)
      setNumRooms(r);
    // From the trip page: show results immediately — no extra Search tap.
    if (
      initial.autoSearch &&
      start?.isValid() &&
      end?.isValid() &&
      (initial.city || initial.hotel)
    ) {
      (async () => {
        // Resolve the city to an exact place first — a name-only lookup
        // assumes the default country and misses cities like Cancún or Paris.
        let place = null;
        if (initial.city && !initial.hotel) {
          try {
            const res = await fetch(
              `${API}/api/hotels/places?${new URLSearchParams({
                query: initial.city,
              })}`
            );
            const data = await res.json();
            const first =
              data?.ok && data.places?.[0]
                ? normalizePlace(data.places[0])
                : null;
            if (first?.placeId) {
              place = first;
              setSelectedPlace(first);
              setCityName(
                first.secondaryText
                  ? `${first.displayName}, ${first.secondaryText}`
                  : first.displayName
              );
              const cc = countryFromText(first.secondaryText);
              if (cc) setCountryCode(cc);
            }
          } catch {
            /* fall back to the name lookup */
          }
        }
        handleSearch({
          city: initial.city || "",
          dates: [start, end],
          adults: Number.isInteger(n) ? n : undefined,
          rooms: Number.isInteger(r) ? r : undefined,
          hotel: initial.hotel || null,
          place,
        });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // ── Location autocomplete, backed by LiteAPI's own /data/places
  // endpoint (via /api/hotels/places) — NOT /data/hotels. This is a
  // real, purpose-built autocomplete (Google Places under the hood),
  // but LiteAPI bills it per-request. Debounce (450ms) and a 3-char
  // minimum are both deliberate cost guards — don't loosen either
  // without checking the cost impact on your LiteAPI account.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestDebounceRef = useRef(null);
  const suggestAbortRef = useRef(null);
  const cityFieldRef = useRef(null);
  const cityInputRef = useRef(null);
  // Recent + popular destinations, shown when the box is focused and empty.
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  // Close the dropdown on outside click — same pattern as the
  // "More" tab menu elsewhere in this file.
  useEffect(() => {
    if (!suggestOpen && !quickMenuOpen) return;
    const handler = (e) => {
      if (cityFieldRef.current && !cityFieldRef.current.contains(e.target)) {
        setSuggestOpen(false);
        setQuickMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestOpen, quickMenuOpen]);

  const fetchPlaceSuggestions = useCallback((query) => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);

    const trimmed = query.trim();
    // 3-char minimum + 450ms debounce are cost guards for a billed
    // endpoint (see note above) — not just UX polish.
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }

    suggestDebounceRef.current = setTimeout(async () => {
      if (suggestAbortRef.current) suggestAbortRef.current.abort();
      const controller = new AbortController();
      suggestAbortRef.current = controller;
      setSuggestLoading(true);

      try {
        const params = new URLSearchParams({ query: trimmed });
        const res = await fetch(`${API}/api/hotels/places?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          // Surfaced to the console (not the user) so this is
          // debuggable from devtools — a silent empty dropdown with
          // zero feedback is exactly what makes "the autocomplete
          // doesn't work" hard to diagnose. Common causes: the
          // /api/hotels/places route not yet deployed/registered on
          // the backend, or the LiteAPI key lacking access to the
          // (billed) /data/places endpoint.
          console.error("[places autocomplete] request failed:", data);
          setSuggestions([]);
          setSuggestOpen(false);
          return;
        }

        // NOTE: verify these field names against your actual
        // /api/hotels/places response — LiteAPI's own wiring docs
        // reference storing `{ placeId, displayName }`, but the raw
        // shape may nest displayName differently or use `name`.
        const places = (data.places ?? []).slice(0, 8).map(normalizePlace);

        setSuggestions(places);
        setSuggestOpen(places.length > 0);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[places autocomplete] request error:", err);
          setSuggestions([]);
          setSuggestOpen(false);
        }
      } finally {
        setSuggestLoading(false);
      }
    }, 450);
  }, []);

  const handleCityInputChange = (e) => {
    const val = e.target.value;
    setCityName(val);
    // Typing again after picking a suggestion means they're looking
    // for something else — don't silently keep searching the old place.
    if (selectedPlace) setSelectedPlace(null);
    setHighlightedIndex(-1);
    setQuickMenuOpen(!val.trim());
    fetchPlaceSuggestions(val);
  };

  const clearCity = () => {
    setCityName("");
    setSelectedPlace(null);
    setSuggestions([]);
    setSuggestOpen(false);
    setHighlightedIndex(-1);
    setQuickMenuOpen(true);
    cityInputRef.current?.focus();
  };

  const handleSelectPlaceSuggestion = (place) => {
    // Show the full place in the box: "Miami Beach, Florida, United States".
    setCityName(
      place.secondaryText
        ? `${place.displayName}, ${place.secondaryText}`
        : place.displayName
    );
    setSelectedPlace(place);
    setQuickMenuOpen(false);
    // Keep the fallback country in step with the place they picked.
    const cc = countryFromText(place.secondaryText);
    if (cc) setCountryCode(cc);
    setSuggestions([]);
    setSuggestOpen(false);
    setHighlightedIndex(-1);
  };

  const [recentStays, setRecentStays] = useState(loadRecentStays);

  // Popular destination chip → fill the city and look it up, so the search
  // can use the exact place instead of guessing by name.
  const handlePickPopular = ({ city, country }) => {
    setCityName(city);
    setSelectedPlace(null);
    setCountryCode(country);
    setQuickMenuOpen(false);
    fetchPlaceSuggestions(city);
    cityInputRef.current?.focus();
  };

  // Recent search chip → restore it. If its dates are still ahead, search right away.
  const handlePickRecent = (r) => {
    const place = r.placeId
      ? {
          placeId: r.placeId,
          displayName: r.city,
          secondaryText: r.secondaryText || "",
        }
      : null;
    setCityName(r.secondaryText ? `${r.city}, ${r.secondaryText}` : r.city);
    setSelectedPlace(place);
    setQuickMenuOpen(false);
    if (r.countryCode) setCountryCode(r.countryCode);
    if (r.adults) setAdults(r.adults);
    if (r.rooms) setNumRooms(r.rooms);
    const start = dayjs(r.checkin);
    const end = dayjs(r.checkout);
    if (start.isValid() && end.isValid() && !start.isBefore(dayjs(), "day")) {
      handleDatesChange([start, end]);
      handleSearch({
        city: r.city,
        dates: [start, end],
        adults: r.adults,
        rooms: r.rooms,
        place,
      });
    } else {
      antdMessage.info(
        "Pick new dates for this trip — the old ones have passed."
      );
    }
  };

  // Arrow-key + Enter/Escape navigation — same interaction pattern as
  // the airport search on Flights, so this dropdown doesn't feel like
  // a different, lesser control.
  const handleCityInputKeyDown = (e) => {
    if (e.key === "Escape" || e.key === "Tab") setQuickMenuOpen(false);
    if (e.key === "Tab") setSuggestOpen(false);
    // Enter with nothing highlighted runs the search.
    if (e.key === "Enter" && (!suggestOpen || highlightedIndex < 0)) {
      e.preventDefault();
      setSuggestOpen(false);
      handleSearch();
      return;
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectPlaceSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleDatesChange = useCallback(
    (v) => {
      const nd = v ?? [null, null];
      setDates(nd);
      if (nd[0] && nd[1])
        onDatesChange?.({ dates: nd, nights: nd[1].diff(nd[0], "day") });
      else onDatesChange?.({ dates: nd, nights: null });
    },
    [onDatesChange]
  );

  // opts lets a prefilled link run the search right away with its own
  // values (state updates aren't visible until the next render), and
  // `hotel` searches just one hotel — the Sync Together group's hotel.
  const handleSearch = async (opts = {}) => {
    const qCity = typeof opts.city === "string" ? opts.city : cityName;
    const qDates = Array.isArray(opts.dates) ? opts.dates : dates;
    const qAdults = Number(opts.adults) || adults;
    const qRooms = Number(opts.rooms) || numRooms;
    const pinned = opts.hotel?.hotelId ? opts.hotel : null;
    if (!pinned && !qCity.trim())
      return antdMessage.warning("Enter a destination city");
    if (!qDates[0] || !qDates[1])
      return antdMessage.warning("Select check-in and check-out dates");
    if (!pinned && qRooms > qAdults)
      return antdMessage.warning(
        "Each room needs at least one traveler — add travelers or remove a room"
      );

    // Use the exact place whenever we have one: the picked suggestion, or —
    // if they typed a city and hit Search without picking — the suggestion
    // that matches what they typed. Name-only lookups often return nothing.
    // Compare against the name part only ("miami beach" from "Miami Beach, Florida…").
    const typed = qCity.split(",")[0].trim().toLowerCase();
    const place =
      opts.place !== undefined
        ? opts.place
        : selectedPlace ??
          suggestions.find((s) =>
            s.displayName.toLowerCase().startsWith(typed)
          ) ??
          suggestions.find((s) =>
            s.displayName.toLowerCase().includes(typed)
          ) ??
          null;
    if (place && place !== selectedPlace) setSelectedPlace(place);
    setSuggestOpen(false);

    setLoading(true);
    onSearchStart?.();

    try {
      // ── Step 1: resolve destination → hotelIds ──
      // Prefer the placeId from a selected autocomplete suggestion —
      // it's exact and unambiguous. Fall back to countryCode+cityName
      // only if the user typed a destination without picking a
      // suggestion (LiteAPI's docs note this fallback needs an exact
      // string match and can return zero results for larger cities).
      const lookupParams = place
        ? new URLSearchParams({ placeId: place.placeId, limit: "20" })
        : new URLSearchParams({
            countryCode,
            cityName: qCity.split(",")[0].trim(),
            limit: "20",
          });

      let hotelsFound;
      if (pinned) {
        hotelsFound = [
          {
            id: pinned.hotelId,
            name: pinned.name,
            main_photo: pinned.thumbnail,
            address: pinned.address,
            stars: pinned.stars,
            rating: pinned.rating,
          },
        ];
      } else {
        const lookupRes = await fetch(
          `${API}/api/hotels/lookup?${lookupParams}`
        );
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.ok)
          throw new Error(
            lookupData.message || "Couldn't find that destination"
          );
        hotelsFound = lookupData.hotels ?? [];
      }
      if (!hotelsFound.length) {
        antdMessage.info(
          place
            ? "No hotels found for that destination."
            : "No hotels found — pick your city from the suggestions list for an exact match."
        );
        onSearch([]);
        return;
      }

      // Limit how many hotels we price-check at once — keeps the
      // rates call fast. Adjust this cap as your UI/UX needs grow.
      const hotelIds = hotelsFound.slice(0, 15).map((h) => h.id);

      // ── Step 2: get live rates for those hotels ──
      const searchParams = new URLSearchParams({
        hotelIds: hotelIds.join(","),
        checkin: dayjs(qDates[0].toDate()).format("YYYY-MM-DD"),
        checkout: dayjs(qDates[1].toDate()).format("YYYY-MM-DD"),
        adults: String(qAdults),
        rooms: String(qRooms),
      });
      const searchRes = await fetch(`${API}/api/hotels/search?${searchParams}`);
      const searchData = await searchRes.json();
      if (!searchRes.ok || !searchData.ok)
        throw new Error(searchData.message || "Hotel search failed");

      // Merge metadata (name, photo, stars) from the lookup step
      // with pricing/offer data from the search step, keyed by hotelId
      const metaById = Object.fromEntries(hotelsFound.map((h) => [h.id, h]));
      const enriched = (searchData.hotels ?? []).map((offer) => ({
        ...offer,
        name: metaById[offer.hotelId]?.name ?? "Hotel",
        thumbnail: metaById[offer.hotelId]?.main_photo ?? null,
        stars: metaById[offer.hotelId]?.stars ?? null,
        rating: metaById[offer.hotelId]?.rating ?? null,
        address: metaById[offer.hotelId]?.address ?? "",
      }));

      // Attach the search dates to every result so HotelCheckout
      // can show real check-in/check-out instead of "Dates TBD"
      const checkinISO = dayjs(qDates[0].toDate()).format("YYYY-MM-DD");
      const checkoutISO = dayjs(qDates[1].toDate()).format("YYYY-MM-DD");
      const withDates = enriched.map((h) => ({
        ...h,
        checkin: checkinISO,
        checkout: checkoutISO,
        // Guests each room was priced for — Sync Together shared rooms
        // check this against how many people are sharing.
        adults: qRooms > 1 ? Math.floor(qAdults / qRooms) : qAdults,
      }));

      onSearch(withDates);
      // Short name for headings/weather ("Miami Beach", not the full region line).
      onDestChange?.(pinned ? pinned.name : place?.displayName || qCity.trim());
      antdMessage.success(`Found ${withDates.length} room options`);

      if (!pinned && withDates.length > 0) {
        setRecentStays(
          saveRecentStay({
            city: place?.displayName || qCity.trim(),
            placeId: place?.placeId || null,
            secondaryText: place?.secondaryText || "",
            countryCode,
            checkin: checkinISO,
            checkout: checkoutISO,
            adults: qAdults,
            rooms: qRooms,
          })
        );
      }
    } catch (err) {
      antdMessage.error(err.message || "Hotel search failed");
    } finally {
      setLoading(false);
      onSearchEnd?.();
    }
  };

  return (
    <div className="sk-search-bar">
      <div className="sk-pass">
        <div
          className={`sk-pass-seg sk-pass-seg--where${
            suggestOpen || quickMenuOpen ? " is-active" : ""
          }`}
          ref={cityFieldRef}
          onClick={() => cityInputRef.current?.focus()}
        >
          <label className="sk-pass-label" htmlFor="sk-where-input">
            <MapPin size={12} aria-hidden="true" /> Where
          </label>
          <div className="sk-where-box">
            <input
              id="sk-where-input"
              ref={cityInputRef}
              className="sk-where-input"
              placeholder="Where to?"
              value={cityName}
              onChange={handleCityInputChange}
              onKeyDown={handleCityInputKeyDown}
              onFocus={() => {
                if (!cityName.trim()) setQuickMenuOpen(true);
                else if (suggestions.length > 0 && !selectedPlace)
                  setSuggestOpen(true);
              }}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={suggestOpen || quickMenuOpen}
              aria-controls="sk-where-menu"
              aria-autocomplete="list"
              aria-label="Where to? City, landmark or hotel"
            />
            {cityName && (
              <button
                type="button"
                className="sk-where-clear"
                onClick={clearCity}
                aria-label="Clear destination"
              >
                <CloseOutlined />
              </button>
            )}
          </div>

          {/* Typing: live place suggestions */}
          {suggestOpen && (
            <div className="sk-where-menu" id="sk-where-menu" role="listbox">
              {suggestLoading && suggestions.length === 0 && (
                <div className="sk-where-status">
                  <LoadingOutlined /> Searching places…
                </div>
              )}
              {suggestions.map((s, i) => {
                const kind = placeKind(s.types);
                return (
                  <button
                    type="button"
                    key={s.placeId}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    className={`sk-where-item${
                      i === highlightedIndex ? " is-highlighted" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectPlaceSuggestion(s)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                  >
                    <span className="sk-where-icon">
                      <PlaceKindIcon kind={kind} />
                    </span>
                    <span className="sk-where-text">
                      <span className="sk-where-name">{s.displayName}</span>
                      {s.secondaryText && (
                        <span className="sk-where-sub">{s.secondaryText}</span>
                      )}
                    </span>
                    {i === highlightedIndex && (
                      <span className="sk-where-xp">
                        <Zap size={11} /> {STAY_BOOKING_XP} XP
                      </span>
                    )}
                  </button>
                );
              })}
              {!suggestLoading && suggestions.length === 0 && (
                <div className="sk-where-status">
                  No places match “{cityName}”. Try a city, neighborhood or
                  hotel name.
                </div>
              )}
            </div>
          )}

          {/* Empty box: recent searches + popular destinations */}
          {quickMenuOpen && !suggestOpen && !cityName.trim() && (
            <div className="sk-where-menu" id="sk-where-menu">
              {recentStays.length > 0 && (
                <>
                  <div className="sk-where-heading">Recent searches</div>
                  {recentStays.map((r) => (
                    <button
                      type="button"
                      key={`${r.placeId || r.city}-${r.checkin}`}
                      className="sk-where-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickRecent(r)}
                    >
                      <span className="sk-where-icon">
                        <PlaceKindIcon kind="recent" />
                      </span>
                      <span className="sk-where-text">
                        <span className="sk-where-name">{r.city}</span>
                        <span className="sk-where-sub">
                          {dayjs(r.checkin).format("MMM D")} –{" "}
                          {dayjs(r.checkout).format("MMM D")} · {r.adults}{" "}
                          traveler{r.adults !== 1 ? "s" : ""}, {r.rooms} room
                          {r.rooms !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
              <div className="sk-where-heading">Popular destinations</div>
              {POPULAR_STAYS.map((p) => (
                <button
                  type="button"
                  key={p.city}
                  className="sk-where-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickPopular(p)}
                >
                  <span className="sk-where-icon">
                    <PlaceKindIcon kind="city" />
                  </span>
                  <span className="sk-where-text">
                    <span className="sk-where-name">{p.city}</span>
                    <span className="sk-where-sub">
                      {STAY_COUNTRIES.find(([cc]) => cc === p.country)?.[1] ??
                        p.country}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sk-pass-seg sk-pass-seg--when">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
            {dates[0] && dates[1] && (
              <span className="sk-pass-nights">
                · {dates[1].diff(dates[0], "day")} night
                {dates[1].diff(dates[0], "day") !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            placeholder={["Check-in", "Check-out"]}
            value={dates}
            onChange={handleDatesChange}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <GuestsRoomsPicker
            adults={adults}
            rooms={numRooms}
            maxRooms={MAX_ROOMS_PER_TRIP}
            onChange={({ adults: a, rooms: r }) => {
              setAdults(a);
              setNumRooms(r);
            }}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={() => handleSearch()}
          disabled={loading}
          aria-label="Search stays"
        >
          {loading ? <LoadingOutlined /> : <SearchOutlined />}
          <span className="sk-pass-go-text">
            {loading ? "Searching…" : "Search"}
          </span>
        </button>
      </div>

      {/* ── Date shortcuts ── */}
      <div className="sk-stay-shortcuts">
        <div className="sk-stay-shortcut-row">
          <span className="sk-stay-shortcut-label">Dates</span>
          <button
            type="button"
            className="sk-stay-chip"
            onClick={() => handleDatesChange(weekendRange(0))}
          >
            This weekend
          </button>
          <button
            type="button"
            className="sk-stay-chip"
            onClick={() => handleDatesChange(weekendRange(1))}
          >
            Next weekend
          </button>
          <button
            type="button"
            className="sk-stay-chip"
            onClick={() => {
              const start =
                dates[0] && !dates[0].isBefore(dayjs(), "day")
                  ? dates[0]
                  : dayjs().add(14, "day").startOf("day");
              handleDatesChange([start, start.add(7, "day")]);
            }}
          >
            1 week
          </button>
        </div>
      </div>
    </div>
  );
}

function CarsForm({ onDestChange }) {
  return (
    <div className="sk-search-bar">
      <div className="sk-field-row">
        <div className="sk-field sk-field--airport">
          <AirportInput
            value=""
            placeholder="Pick-up location"
            onChange={(ap) => onDestChange?.(ap.city)}
          />
        </div>
        <div className="sk-field sk-field--airport">
          <AirportInput
            value=""
            placeholder="Drop-off (same as pick-up)"
            onChange={() => {}}
          />
        </div>
        <div className="sk-field sk-field--date">
          <SkyrioPicker
            className="sk-orange-picker"
            placeholder={["Pick-up date", "Drop-off date"]}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <SearchBtn />
      </div>
    </div>
  );
}

// Flight + Stay. There's no bundled package rate, so this runs the real
// searches in order: the flight first, then the stay at the destination.
function PackagesForm({ onDestChange, onDatesChange, onHandoff }) {
  const [origin, setOrigin] = useState(null);
  const [originDisplay, setOriginDisplay] = useState("");
  const [dest, setDest] = useState(null);
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);

  const handleDates = (v) => {
    const nd = v ?? [null, null];
    setDates(nd);
    onDatesChange?.({
      dates: nd,
      nights: nd[0] && nd[1] ? nd[1].diff(nd[0], "day") : null,
    });
  };

  const handleSearch = () => {
    if (!origin) return antdMessage.warning("Where are you leaving from?");
    if (!dest) return antdMessage.warning("Where are you going?");
    if (!dates[0] || !dates[1])
      return antdMessage.warning("Pick your travel dates");
    const depart = dates[0].format("YYYY-MM-DD");
    const ret = dates[1].format("YYYY-MM-DD");
    onHandoff?.({
      tab: "Flights",
      params: { from: origin.code, to: dest.code, depart, return: ret, adults },
      plan: { city: dest.city, code: dest.code, depart, ret, adults, rooms },
    });
  };

  const nights = dates[0] && dates[1] ? dates[1].diff(dates[0], "day") : null;

  return (
    <div className="sk-search-bar">
      <div className="sk-pkg-steps" aria-label="How packages work">
        <span className="sk-pkg-step">
          <IconFlight size={12} /> 1 · Flight
        </span>
        <span className="sk-pkg-step-line" aria-hidden="true" />
        <span className="sk-pkg-step">
          <IconHotel size={12} /> 2 · Stay
        </span>
        <span className="sk-pkg-step-note">Earn XP on both bookings</span>
      </div>
      <div className="sk-pass sk-pass--flights">
        <div className="sk-pass-seg sk-pass-seg--from sk-pass-flat">
          <span className="sk-pass-label">
            <PlaneIcon
              size={12}
              aria-hidden="true"
              style={{ transform: "rotate(45deg)" }}
            />{" "}
            From
          </span>
          <AirportInput
            value={originDisplay}
            placeholder="Leaving from"
            onChange={(ap) => {
              setOrigin(ap);
              setOriginDisplay(`${ap.city} (${ap.code})`);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--to sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> To
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="Going to"
            onChange={(ap) => {
              setDest(ap);
              setDestDisplay(`${ap.city} (${ap.code})`);
              onDestChange?.(ap.city);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
            {nights > 0 && (
              <span className="sk-pass-nights">
                · {nights} night{nights !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            value={dates}
            onChange={handleDates}
            placeholder={["Depart", "Return"]}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <GuestsRoomsPicker
            adults={adults}
            rooms={rooms}
            maxRooms={MAX_ROOMS_PER_TRIP}
            onChange={({ adults: a, rooms: r }) => {
              setAdults(Math.min(a, 9)); // flights allow up to 9 travelers
              setRooms(r);
            }}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={handleSearch}
          aria-label="Start your package"
        >
          <SearchOutlined />
          <span className="sk-pass-go-text">Find flight + stay</span>
        </button>
      </div>
    </div>
  );
}

function ExcursionsForm({
  onDestChange,
  onSearch,
  onSearchStart,
  onSearchEnd,
  initial = null,
}) {
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [category, setCategory] = useState("any");
  const {
    loading,
    results,
    error,
    search: runExcursionSearch,
  } = useExcursionSearch();

  // Forward results/errors up to BookingPage whenever they change —
  // mirrors how FlightsForm/StaysForm call onSearch(data) after their
  // own fetch resolves, just via effect since this hook owns its
  // own state instead of returning data directly from search().
  useEffect(() => {
    onSearch?.(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  useEffect(() => {
    if (error) antdMessage.warning(error);
  }, [error]);

  const handleSearch = async (opts = {}) => {
    const dest = (opts.city ?? destDisplay).trim();
    const range = opts.dates ?? dates;
    if (!dest) return antdMessage.warning("Enter a destination city");

    onSearchStart?.();
    await runExcursionSearch({
      destination: dest,
      startDate: range[0]
        ? dayjs(range[0].toDate()).format("YYYY-MM-DD")
        : undefined,
      endDate: range[1]
        ? dayjs(range[1].toDate()).format("YYYY-MM-DD")
        : undefined,
      category: category !== "any" ? category : undefined,
    });
    onSearchEnd?.();
  };

  // Prefill from the link (e.g. "Find activities" on a Sync Together trip).
  const excursionPrefilledRef = useRef(false);
  useEffect(() => {
    if (!initial || excursionPrefilledRef.current) return;
    excursionPrefilledRef.current = true;
    if (initial.city) {
      setDestDisplay(initial.city);
      onDestChange?.(initial.city);
    }
    const start = initial.start ? dayjs(initial.start) : null;
    const end = initial.end ? dayjs(initial.end) : null;
    const range =
      start?.isValid() && end?.isValid() ? [start, end] : [null, null];
    setDates(range);
    if (initial.autoSearch && initial.city) {
      setTimeout(() => handleSearch({ city: initial.city, dates: range }), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="sk-search-bar">
      <div className="sk-pass">
        <div className="sk-pass-seg sk-pass-seg--where sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> Where
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="Destination city"
            onChange={(ap) => {
              setDestDisplay(ap.city);
              onDestChange?.(ap.city);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--when sk-pass-flat">
          <span className="sk-pass-label">
            <Calendar size={12} aria-hidden="true" /> When
            <span className="sk-pass-nights">· optional</span>
          </span>
          <SkyrioPicker
            className="sk-orange-picker"
            placeholder={["Any day", "Any day"]}
            value={dates}
            onChange={(v) => setDates(v ?? [null, null])}
            disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who sk-pass-flat">
          <span className="sk-pass-label">
            <Zap size={12} aria-hidden="true" /> What
          </span>
          <Select
            className="sk-select-cabin"
            value={category}
            onChange={setCategory}
            variant="borderless"
            suffixIcon={null}
            classNames={{ popup: { root: "sk-select-popup" } }}
            aria-label="Activity type"
            options={[
              { value: "any", label: "Anything fun" },
              { value: "tours", label: "Tours" },
              { value: "adventure", label: "Adventure" },
              { value: "food", label: "Food & Drink" },
              { value: "culture", label: "Culture" },
              { value: "wellness", label: "Wellness" },
            ]}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={() => handleSearch()}
          disabled={loading}
          aria-label="Search things to do"
        >
          {loading ? <LoadingOutlined /> : <SearchOutlined />}
          <span className="sk-pass-go-text">
            {loading ? "Searching…" : "Find things to do"}
          </span>
        </button>
      </div>
    </div>
  );
}

// Curated quick picks for "where should I go?" — each is a real airport,
// so tapping one fills TO and the search is a normal live flight search.
const LAST_MINUTE_IDEAS = [
  { vibe: "Beach", city: "Miami", code: "MIA" },
  { vibe: "Beach", city: "Cancún", code: "CUN" },
  { vibe: "City", city: "New York", code: "JFK" },
  { vibe: "Parks", city: "Orlando", code: "MCO" },
  { vibe: "Mountains", city: "Denver", code: "DEN" },
];

function LastMinuteForm({ onHandoff }) {
  const [when, setWhen] = useState("this"); // "this" | "next" weekend
  const [origin, setOrigin] = useState(null);
  const [originDisplay, setOriginDisplay] = useState("");
  const [dest, setDest] = useState(null);
  const [destDisplay, setDestDisplay] = useState("");
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState("economy");

  const range = weekendRange(when === "this" ? 0 : 1);

  const handleSearch = () => {
    if (!origin) return antdMessage.warning("Where are you leaving from?");
    if (!dest)
      return antdMessage.warning("Pick a destination — or tap an idea below");
    onHandoff?.({
      tab: "Flights",
      params: {
        from: origin.code,
        to: dest.code,
        depart: range[0].format("YYYY-MM-DD"),
        return: range[1].format("YYYY-MM-DD"),
        adults,
        cabin,
      },
    });
  };

  return (
    <div className="sk-search-bar">
      <div className="sk-trip-type-row">
        <div
          className="sk-trip-type"
          role="radiogroup"
          aria-label="Which weekend"
        >
          {[
            ["this", "This weekend"],
            ["next", "Next weekend"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={when === key}
              className={`sk-trip-type-btn${when === key ? " is-active" : ""}`}
              onClick={() => setWhen(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="sk-pass sk-pass--flights">
        <div className="sk-pass-seg sk-pass-seg--leaving">
          <span className="sk-pass-label">
            <Clock size={12} aria-hidden="true" /> Leaving
            <span className="sk-pass-nights">
              · {range[1].diff(range[0], "day")} night
              {range[1].diff(range[0], "day") !== 1 ? "s" : ""}
            </span>
          </span>
          <span className="sk-pass-value">
            {range[0].format("ddd, MMM D")} → {range[1].format("ddd, MMM D")}
          </span>
        </div>
        <div className="sk-pass-seg sk-pass-seg--from sk-pass-flat">
          <span className="sk-pass-label">
            <PlaneIcon
              size={12}
              aria-hidden="true"
              style={{ transform: "rotate(45deg)" }}
            />{" "}
            From
          </span>
          <AirportInput
            value={originDisplay}
            placeholder="Departing from"
            onChange={(ap) => {
              setOrigin(ap);
              setOriginDisplay(`${ap.city} (${ap.code})`);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--to sk-pass-flat">
          <span className="sk-pass-label">
            <MapPin size={12} aria-hidden="true" /> To
          </span>
          <AirportInput
            value={destDisplay}
            placeholder="Pick an idea below"
            onChange={(ap) => {
              setDest(ap);
              setDestDisplay(`${ap.city} (${ap.code})`);
            }}
          />
        </div>
        <div className="sk-pass-seg sk-pass-seg--who">
          <span className="sk-pass-label">
            <Users size={12} aria-hidden="true" /> Who
          </span>
          <TravelersCabinPicker
            adults={adults}
            cabin={cabin}
            onChange={({ adults: a, cabin: c }) => {
              setAdults(a);
              setCabin(c);
            }}
          />
        </div>
        <button
          type="button"
          className="sk-pass-go"
          onClick={handleSearch}
          aria-label="Search last-minute flights"
        >
          <SearchOutlined />
          <span className="sk-pass-go-text">Find a getaway</span>
        </button>
      </div>

      <div className="sk-stay-shortcuts">
        <div className="sk-stay-shortcut-row sk-ideas-row">
          <span className="sk-stay-shortcut-label">Ideas</span>
          {LAST_MINUTE_IDEAS.map((idea) => (
            <button
              key={idea.code}
              type="button"
              className={`sk-stay-chip${
                dest?.code === idea.code ? " is-active" : ""
              }`}
              onClick={() => {
                setDest({ code: idea.code, city: idea.city });
                setDestDisplay(`${idea.city} (${idea.code})`);
              }}
            >
              <span className="sk-chip-vibe">{idea.vibe}</span> {idea.city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SavedForm() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/api/saved-trips`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok)
          throw new Error(data.message || "Failed to load saved trips");
        setTrips(data.savedTrips);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/saved-trips/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Delete failed");
      setTrips((prev) => prev.filter((t) => (t.id || t._id) !== id));
      antdMessage.success("Trip removed");
    } catch (err) {
      antdMessage.error(err.message || "Failed to remove trip");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading)
    return (
      <div className="sk-search-bar" style={{ justifyContent: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          <LoadingOutlined style={{ marginRight: 8 }} />
          Loading saved trips…
        </Text>
      </div>
    );
  if (error)
    return (
      <div className="sk-search-bar" style={{ justifyContent: "center" }}>
        <Text style={{ color: "#ff4d4f", fontSize: 14 }}>
          <IconWarning size={14} /> {error}
        </Text>
      </div>
    );
  if (!trips.length)
    return (
      <div className="sk-search-bar" style={{ justifyContent: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
          No saved trips yet — hit Save on any result to add one
        </Text>
      </div>
    );

  return (
    <div className="sk-search-bar sk-saved-list">
      {trips.map((trip) => {
        const id = trip.id || trip._id;
        return (
          <div key={id} className="sk-saved-chip">
            <span className="sk-saved-chip-title">{trip.title}</span>
            {trip.destination && (
              <span className="sk-saved-chip-dest">
                <MapPin
                  size={11}
                  style={{ marginRight: 3, verticalAlign: "middle" }}
                />
                {trip.destination}
              </span>
            )}
            {trip.price > 0 && (
              <span className="sk-saved-chip-price">
                ${trip.price.toLocaleString()}
              </span>
            )}
            <button
              type="button"
              className="sk-saved-chip-delete"
              onClick={() => handleDelete(id)}
              disabled={deletingId === id}
              aria-label="Remove saved trip"
            >
              {deletingId === id ? <LoadingOutlined /> : <DeleteOutlined />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skyrio Logo Loading State
// ─────────────────────────────────────────────
function FlightSkeleton({ destCity, fromCode }) {
  const [stepIdx, setStepIdx] = useState(0);
  // Seconds since this search started — drives the honest "still
  // searching" messages below so a slow airline response never looks frozen.
  const [waitedSec, setWaitedSec] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const t = setInterval(
      () => setWaitedSec(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(t);
  }, []);
  const providers = fromCode ? "Airlines" : "Hotels";
  const waitMessage =
    waitedSec >= 50
      ? `Taking longer than usual — we're checking with the ${
          fromCode ? "airline" : "hotels"
        } again…`
      : waitedSec >= 20
      ? `Still searching — ${providers} can be slow to respond. Hang tight…`
      : "Live prices can take up to a minute to load.";
  useEffect(() => {
    const iv = setInterval(
      () => setStepIdx((i) => (i + 1) % ATLAS_LOADING_STEPS.length),
      1800
    );
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="sk-search-loading">
      <div className="sk-search-loading__logo-wrap">
        <div className="sk-search-loading__glow" />
        <div className="sk-search-loading__ring" />
        <div className="sk-search-loading__ring-2" />
        <img
          src={skyrioLogo}
          alt="Skyrio"
          className="sk-search-loading__logo"
        />
      </div>
      <div className="sk-search-loading__label">Skyrio AI active</div>
      <div className="sk-search-loading__copy">
        {ATLAS_LOADING_STEPS[stepIdx]}
      </div>
      <div className="sk-search-loading__sub">
        {fromCode && destCity
          ? `Comparing options for ${fromCode} → ${destCity} based on timing, comfort & value.`
          : "Finding the best flights for your trip."}
      </div>
      <div className="sk-search-loading__sub" role="status" aria-live="polite">
        {waitMessage}
      </div>
      <div className="sk-search-loading__bar">
        <div className="sk-search-loading__bar-fill" />
      </div>
      <div className="sk-flight-skeleton">
        {[1, 2, 3].map((i) => (
          <div key={i} className="sk-skeleton-card">
            <div className="sk-skeleton-thumb sk-shimmer" />
            <div className="sk-skeleton-body">
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "52%" }}
              />
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "38%", marginTop: 8 }}
              />
              <div
                className="sk-skeleton-line sk-shimmer"
                style={{ width: "28%", marginTop: 8 }}
              />
            </div>
            <div className="sk-skeleton-price sk-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RoomCartBar — shows the rooms a user has queued up for this
// stay so they can book one room, then add another for family
// or friends, before checking out as a single trip.
// ─────────────────────────────────────────────
function RoomCartBar({ rooms, onRemove, onCheckout, destCity }) {
  if (!rooms.length) return null;
  const total = rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
  const currency = rooms[0]?.totalCurrency || "USD";

  return (
    <div className="sk-room-cart-bar">
      <div className="sk-room-cart-top">
        <div className="sk-room-cart-headline">
          <Users size={14} className="sk-room-cart-icon" />
          <span>
            <strong>{rooms.length}</strong> room{rooms.length !== 1 ? "s" : ""}{" "}
            selected{destCity ? ` in ${destCity}` : ""}
          </span>
        </div>
        <div className="sk-room-cart-total">
          ${total.toFixed(0)}{" "}
          <span className="sk-room-cart-currency">{currency}</span> total
        </div>
      </div>

      <div className="sk-room-cart-chips">
        {rooms.map((r, i) => (
          <span key={`${roomKey(r)}-${i}`} className="sk-room-cart-chip">
            <span className="sk-room-cart-chip-name">{r.name}</span>
            <span className="sk-room-cart-chip-price">
              ${r.totalAmount?.toFixed(0) ?? "—"}
            </span>
            <button
              type="button"
              className="sk-room-cart-chip-remove"
              onClick={() => onRemove(r)}
              aria-label={`Remove ${r.name} from trip`}
            >
              <CloseOutlined />
            </button>
          </span>
        ))}
      </div>

      <div className="sk-room-cart-actions">
        <span className="sk-room-cart-hint">
          Need a room for someone else? Add another before you check out.
        </span>
        <Button className="sk-btn-orange" onClick={onCheckout}>
          Checkout {rooms.length} room{rooms.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { updateAtlasContext } = useAtlasContext();

  const fromCode = searchParams.get("from") || "EWR";

  // ── Sync Together: booking your own part of a group trip ──
  // /booking?groupId=… comes from the trip page. Kept in sessionStorage so
  // it survives switching tabs/searches until checkout.
  const syncGroupId = useMemo(() => {
    const fromUrl = searchParams.get("groupId");
    try {
      if (fromUrl) window.sessionStorage.setItem("skyrio_sync_group", fromUrl);
      return (
        fromUrl || window.sessionStorage.getItem("skyrio_sync_group") || null
      );
    } catch {
      return fromUrl || null;
    }
  }, [searchParams]);
  const leaveSyncGroup = useCallback(() => {
    try {
      window.sessionStorage.removeItem("skyrio_sync_group");
    } catch {
      /* non-fatal */
    }
    window.location.assign("/booking");
  }, []);
  const tabParam = searchParams.get("tab");
  // ── Sync Together trip info: is this person the organizer, and has the
  // group picked a hotel? (Lets the organizer pick it from these results.)
  const [syncInfo, setSyncInfo] = useState(null);
  const [savingGroupHotel, setSavingGroupHotel] = useState(null);
  useEffect(() => {
    if (!syncGroupId) return;
    let alive = true;
    const token = localStorage.getItem("token");
    fetch(`${API}/api/sync-together/${syncGroupId}/parts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => alive && d.ok && setSyncInfo(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [syncGroupId]);
  const groupHotelId = syncInfo?.groupHotel?.hotelId || null;
  const makeGroupHotel = useCallback(
    async (hotel) => {
      if (!syncGroupId) return;
      setSavingGroupHotel(hotel.hotelId);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API}/api/sync-together/${syncGroupId}/group-hotel`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              hotel: {
                hotelId: hotel.hotelId,
                name: hotel.name,
                address: hotel.address,
                thumbnail: hotel.thumbnail,
                stars: hotel.stars,
                rating: hotel.rating,
              },
            }),
          }
        );
        const d = await res.json();
        if (!res.ok || !d.ok)
          throw new Error(d.error || "Couldn't save the group's hotel");
        setSyncInfo((prev) => ({ ...(prev || {}), groupHotel: d.groupHotel }));
        antdMessage.success(
          `${hotel.name} is now the group's hotel. Everyone's "Book my room" opens here.`
        );
      } catch (e) {
        antdMessage.error(e.message);
      } finally {
        setSavingGroupHotel(null);
      }
    },
    [syncGroupId]
  );

  // ── Group shortlist: "Suggest to group" on any flight or hotel ──
  const flightKey = (f) =>
    [
      "flight",
      f.ownerCode || f.owner,
      f.origin,
      f.destination,
      f.departingAt,
      f.returningAt || "",
    ]
      .map((x) => String(x || "").slice(0, 40))
      .join(":");
  // Excursion results come from Viator; accept the common field names.
  const activityFor = (ex) => ({
    id: String(ex.productCode || ex.id || ex.code || ""),
    name: ex.title || ex.name || "",
    image:
      ex.image ||
      ex.imageUrl ||
      ex.thumbnail ||
      ex.images?.[0]?.url ||
      ex.images?.[0]?.variants?.slice?.(-1)?.[0]?.url ||
      (typeof ex.images?.[0] === "string" ? ex.images[0] : undefined),
    city:
      ex.city ||
      ex.destination ||
      ex.location ||
      syncInfo?.destination ||
      undefined,
    duration: ex.duration || ex.durationText || undefined,
    rating: ex.rating ?? ex.reviews?.combinedAverageRating ?? undefined,
    reviews:
      ex.reviewCount ??
      ex.reviews?.totalReviews ??
      (typeof ex.reviews === "number" ? ex.reviews : undefined),
    url: ex.productUrl || ex.bookingUrl || ex.url || ex.link || undefined,
  });
  const activityKey = (ex) => {
    const a = activityFor(ex);
    return `activity:${String(a.id || a.url || "").slice(0, 120)}`;
  };
  const shortlistKeys = useMemo(
    () => new Set((syncInfo?.shortlist || []).map((i) => i.key)),
    [syncInfo]
  );
  const [suggesting, setSuggesting] = useState(null);
  const suggestToGroup = useCallback(
    async (kind, data, e) => {
      e?.stopPropagation?.();
      if (!syncGroupId) return;
      const key =
        kind === "hotel"
          ? `hotel:${data.hotelId}`
          : kind === "activity"
          ? activityKey(data)
          : flightKey(data);
      setSuggesting(key);
      try {
        const token = localStorage.getItem("token");
        const body =
          kind === "activity"
            ? {
                kind,
                price:
                  parseFloat(
                    data.price ??
                      data.fromPrice ??
                      data.pricing?.summary?.fromPrice ??
                      data.totalAmount
                  ) || null,
                currency: data.currency || data.pricing?.currency || "USD",
                activity: activityFor(data),
              }
            : kind === "hotel"
            ? {
                kind,
                price: data.totalAmount ?? null,
                currency: data.totalCurrency || "USD",
                hotel: {
                  hotelId: data.hotelId,
                  name: data.name,
                  address: data.address,
                  thumbnail: data.thumbnail,
                  stars: data.stars,
                  rating: data.rating,
                  roomName: data.roomName,
                  boardName: data.boardName,
                  checkin: data.checkin,
                  checkout: data.checkout,
                  adults: data.adults,
                },
              }
            : {
                kind,
                price: parseFloat(data.totalAmount) || null,
                currency: data.totalCurrency || "USD",
                flight: {
                  airline: data.owner,
                  airlineCode: data.ownerCode,
                  logo: data.ownerLogo,
                  origin: data.origin,
                  destination: data.destination,
                  departAt: data.departingAt,
                  arriveAt: data.arrivingAt,
                  returnDepartAt: data.returningAt,
                  returnArriveAt: data.returnArrivingAt,
                  stops: data.stops,
                  cabin: data.cabinClass || data.cabin,
                },
              };
        const res = await fetch(
          `${API}/api/sync-together/${syncGroupId}/shortlist`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          }
        );
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok)
          throw new Error(d.error || "Couldn't add it to the shortlist");
        setSyncInfo((prev) => ({
          ...(prev || {}),
          shortlist: [...(prev?.shortlist || []), { key, kind }],
        }));
        antdMessage.success(
          d.alreadyListed
            ? "Already on the shortlist — we added your vote."
            : "Added to the group shortlist. The group can vote on it."
        );
      } catch (err) {
        antdMessage.error(err.message);
      } finally {
        setSuggesting(null);
      }
    },
    [syncGroupId, syncInfo]
  );
  const SuggestBtn = ({ kind, data }) => {
    if (!syncGroupId) return null;
    const key =
      kind === "hotel"
        ? `hotel:${data.hotelId}`
        : kind === "activity"
        ? activityKey(data)
        : flightKey(data);
    const done = shortlistKeys.has(key);
    const isPick =
      (kind === "flight" && syncInfo?.groupFlightKey === key) ||
      (kind === "hotel" && syncInfo?.groupHotel?.hotelId === data.hotelId) ||
      (kind === "activity" &&
        (syncInfo?.shortlist || []).some(
          (i) => i.key === key && i.status === "picked"
        ));
    if (isPick) {
      return (
        <span
          style={{
            background: "rgba(82,196,26,0.14)",
            border: "1px solid rgba(82,196,26,0.45)",
            color: "#52c41a",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          🏆 The group's pick
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={done || suggesting === key}
        onClick={(e) => suggestToGroup(kind, data, e)}
        style={{
          background: done ? "rgba(82,196,26,0.12)" : "rgba(255,138,42,0.12)",
          border: `1px solid ${
            done ? "rgba(82,196,26,0.4)" : "rgba(255,138,42,0.45)"
          }`,
          color: done ? "#52c41a" : "#ff8a2a",
          borderRadius: 10,
          padding: "7px 12px",
          fontSize: 13,
          fontWeight: 600,
          cursor: done ? "default" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {done
          ? "✓ On the shortlist"
          : suggesting === key
          ? "Adding…"
          : "🗳️ Suggest to group"}
      </button>
    );
  };

  // Prefill for the search forms (/booking?to=Miami&depart=2026-10-23&return=…).
  // auto=1 runs the search right away so results are waiting.
  const autoSearch = searchParams.get("auto") === "1";
  const flightInitial = useMemo(() => {
    const to = searchParams.get("to");
    const depart = searchParams.get("depart");
    if (!to && !depart) return null;
    return {
      from: searchParams.get("from"),
      to,
      depart,
      ret: searchParams.get("return"),
      cabin: searchParams.get("cabin") || undefined,
      adults: searchParams.get("adults") || undefined,
      autoSearch,
    };
  }, [searchParams, autoSearch]);
  const hotelIdParam = searchParams.get("hotelId");
  const stayInitial = useMemo(() => {
    const city = searchParams.get("city") || searchParams.get("to");
    const checkin = searchParams.get("depart");
    if (!city && !checkin && !hotelIdParam) return null;
    // Opening the group's hotel: wait until we know its name and photo.
    let hotel = null;
    if (hotelIdParam) {
      if (!syncInfo) return null;
      hotel =
        syncInfo.groupHotel?.hotelId === hotelIdParam
          ? syncInfo.groupHotel
          : { hotelId: hotelIdParam, name: "Your group's hotel" };
    }
    return {
      city,
      checkin,
      checkout: searchParams.get("return"),
      adults: searchParams.get("adults"),
      rooms: searchParams.get("rooms"),
      hotel,
      autoSearch,
    };
  }, [searchParams, hotelIdParam, syncInfo, autoSearch]);
  const excursionInitial = useMemo(() => {
    const city = searchParams.get("city") || searchParams.get("to");
    if (!city) return null;
    return {
      city,
      start: searchParams.get("depart"),
      end: searchParams.get("return"),
      autoSearch,
    };
  }, [searchParams, autoSearch]);

  const prefillData = useMemo(() => {
    const promptParam = searchParams.get("prompt");
    const planParam = searchParams.get("plan");
    const exampleParam = searchParams.get("example");
    if (exampleParam && EXAMPLE_PLANS[exampleParam])
      return { ...EXAMPLE_PLANS[exampleParam], source: "example" };
    if (planParam && PLAN_SEEDS[planParam]) {
      const seed = PLAN_SEEDS[planParam];
      const mergedPrompt = promptParam ?? seed.prompt;
      const mergedBudget = extractBudgetFromPrompt(mergedPrompt) ?? seed.budget;
      return {
        ...seed,
        prompt: mergedPrompt,
        budget: mergedBudget,
        source: "plan",
      };
    }
    if (promptParam) {
      return {
        prompt: promptParam,
        destination: extractDestFromPrompt(promptParam),
        budget: extractBudgetFromPrompt(promptParam),
        tripDays: null,
        tab: null,
        iata: null,
        source: "prompt",
      };
    }
    return null;
  }, [searchParams]);

  const [tab, setTab] = useState(
    prefillData?.tab ??
      (["Flights", "Stays", "Excursions"].includes(tabParam)
        ? tabParam
        : "Flights")
  );
  const [flightResults, setFlightResults] = useState([]);
  const [hotelResults, setHotelResults] = useState([]);
  const [excursionResults, setExcursionResults] = useState([]);
  const [selectedHotelOffer, setSelectedHotelOffer] = useState(null);
  // Rooms queued up for this Stays search — lets the user book one room,
  // then add another for family/friends before checking out together.
  const [roomCart, setRoomCart] = useState([]);
  // Normalized set of rooms actually going through checkout right now.
  // Populated either from a single "Book Now" click (one room) or the
  // cart's "Checkout N rooms" button (roomCart in full).
  const [checkoutRooms, setCheckoutRooms] = useState([]);
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [autoSearchLoading, setAutoSearchLoading] = useState(false);
  const [autoSearchError, setAutoSearchError] = useState(null);
  // Manual flight-search failure (plain-language message from the API) and a
  // handle that re-runs the last manual search from the "Try again" button.
  const [searchError, setSearchError] = useState(null);
  const flightRetryRef = useRef(null);
  const [destCity, setDestCity] = useState(prefillData?.destination ?? "");
  const [originCity, setOriginCity] = useState("");
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [smartFilters, setSmartFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("price");
  const [hotelFilters, setHotelFilters] = useState(DEFAULT_HOTEL_FILTERS);
  const [hotelSortBy, setHotelSortBy] = useState("price");
  const [aiInsightDismissed, setAiInsightDismissed] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [showHotelCheckout, setShowHotelCheckout] = useState(false);
  const [selectedNights, setSelectedNights] = useState(
    prefillData?.tripDays ?? null
  );
  const [budgetState, setBudgetState] = useState({
    planned: prefillData?.budget ?? null,
    used: 0,
    bookingTotal: 0,
    tripDays: prefillData?.tripDays ?? null,
  });
  const [visibleCount, setVisibleCount] = useState(RESULTS_PER_PAGE);
  const budgetRef = useRef(null);
  const searchFormRef = useRef(null);
  const [priceWatchOn, setPriceWatchOn] = useState(false);
  const [priceWatchRoute, setPriceWatchRoute] = useState(null);
  const [watchingId, setWatchingId] = useState(null);
  // FIX: this map (flightId -> watch document id) was referenced in
  // handleWatchFlight below but never declared, causing:
  //   Uncaught ReferenceError: watchIds is not defined
  const [watchIds, setWatchIds] = useState({});
  // Which outbound flight (by group key) the person has committed to in
  // step 1 of the round-trip flow. Null means still browsing departing
  // flights; once set, the results area switches to showing only that
  // outbound's available return flights — the two-step pattern used by
  // Google Flights / Expedia / Kayak, rather than an inline expander.
  const [selectedOutboundGroupKey, setSelectedOutboundGroupKey] =
    useState(null);

  const handlePriceWatchToggle = useCallback(async () => {
    const next = !priceWatchOn;
    setPriceWatchOn(next);
    if (next && priceWatchRoute) {
      try {
        await createNotification({
          type: "price_watch",
          event: "price_watch_enabled",
          title: "Price Watch enabled",
          message: `We'll alert you when prices drop for ${priceWatchRoute.from} → ${priceWatchRoute.to}.`,
          targetType: "route",
          metadata: priceWatchRoute,
        });
        antdMessage.success("Price Watch on — we'll notify you of drops!");
      } catch {
        antdMessage.info("Price Watch enabled — alerts coming soon.");
      }
    } else if (!next) {
      antdMessage.info("Price Watch disabled.");
    } else {
      antdMessage.info("Search for a route first to watch its price.");
      setPriceWatchOn(false);
    }
  }, [priceWatchOn, priceWatchRoute]);

  const handleWatchFlight = useCallback(
    async (flight) => {
      const token = localStorage.getItem("token");

      // Already watching this flight — turn it off
      if (watchingId === flight.id) {
        const existingWatchId = watchIds[flight.id];
        setWatchingId(null);
        if (existingWatchId) {
          try {
            await fetch(`${API}/api/watches/${existingWatchId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            setWatchIds((prev) => {
              const next = { ...prev };
              delete next[flight.id];
              return next;
            });
          } catch {
            // non-fatal — local state already reflects "off"
          }
        }
        antdMessage.info("Stopped watching this flight.");
        return;
      }

      setWatchingId(flight.id);
      const price = parseFloat(flight.totalAmount);

      try {
        const res = await fetch(`${API}/api/watches`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "flights",
            origin: flight.origin,
            destination: flight.destination,
            dates: [
              flight.departingAt
                ? dayjs(flight.departingAt).format("YYYY-MM-DD")
                : null,
            ],
            adults: 1,
            cabin: "economy",
            lastSeenPrice: price,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create watch");

        setWatchIds((prev) => ({ ...prev, [flight.id]: data.watch._id }));
        setPriceWatchRoute({
          from: flight.origin,
          to: flight.destination,
          price,
          flightId: flight.id,
          airline: flight.owner,
        });
        setPriceWatchOn(true);
        antdMessage.success(
          `Watching $${price.toFixed(0)} — you'll be notified if it drops!`
        );
      } catch (err) {
        setWatchingId(null);
        antdMessage.error(err.message || "Failed to set up price watch");
      }
    },
    [watchingId, watchIds]
  );

  const handleDatesChange = useCallback(({ nights }) => {
    if (nights !== null && nights > 0) {
      setSelectedNights(nights);
      setBudgetState((prev) => ({ ...prev, tripDays: nights }));
    }
  }, []);

  // Scroll to search form when "Search manually" is clicked from HeroPlanner
  const handleSearchManually = useCallback(() => {
    searchFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // ── Room cart helpers ──────────────────────────────────────
  // Adds a hotel offer to the trip's room cart so the user can keep
  // browsing and add rooms for other travelers before checking out.
  //
  // Duplicates are now ALLOWED on purpose: a group might genuinely
  // want two identical rooms at the same hotel (e.g. a sports team
  // booking several of the same room type). The card UI below turns
  // into a quantity stepper (−/+) once a room is in the cart, rather
  // than a confusing "already added" block — the stepper count IS
  // how many of that room are in the trip.
  const addRoomToCart = useCallback((hotel) => {
    setRoomCart((prev) => {
      if (prev.length >= MAX_ROOMS_PER_TRIP) {
        antdMessage.warning(
          `You can add up to ${MAX_ROOMS_PER_TRIP} rooms per trip.`
        );
        return prev;
      }
      return [...prev, hotel];
    });
  }, []);

  // Removes exactly ONE instance of this room from the cart (not every
  // matching entry) — needed now that the same room can appear more
  // than once for a multi-room group booking.
  const removeRoomFromCart = useCallback((hotel) => {
    setRoomCart((prev) => {
      const idx = prev.findIndex((r) => roomKey(r) === roomKey(hotel));
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, []);

  // "Book Now" on a single card. Folds the room into the same cart
  // instead of bypassing it — that's what let a solo "Book Now"
  // dead-end with no way to add a second room for a teammate/family
  // member. It still opens checkout immediately for a fast one-room
  // booking, but since the room joined the cart, hitting "Back to
  // results" from checkout (below) lands back on Stays with that room
  // still selected, ready to add more.
  const handleBookSingleRoom = useCallback(
    (hotel) => {
      let next = roomCart;
      if (roomCart.length >= MAX_ROOMS_PER_TRIP) {
        antdMessage.warning(
          `You can add up to ${MAX_ROOMS_PER_TRIP} rooms per trip.`
        );
        next = roomCart.length ? roomCart : [hotel];
      } else {
        next = [...roomCart, hotel];
        setRoomCart(next);
      }
      setSelectedHotelOffer(next[0] ?? hotel);
      setCheckoutRooms(next.length ? next : [hotel]);
      setShowHotelCheckout(true);
    },
    [roomCart]
  );

  // "Checkout N rooms" from the cart bar — send the whole cart to
  // HotelCheckout as one bundled booking.
  const handleCheckoutCart = useCallback(() => {
    if (!roomCart.length) return;
    setSelectedHotelOffer(roomCart[0]);
    setCheckoutRooms(roomCart);
    setShowHotelCheckout(true);
  }, [roomCart]);

  // "Back to results" / "Add another room" from the checkout screen.
  // Deliberately does NOT clear roomCart or checkoutRooms — the whole
  // point is letting the user return to Stays, add one more room (e.g.
  // for a teammate), and come back to checkout with the full set intact.
  // The cart is only cleared once a booking actually completes, via
  // handleHotelBookingComplete below.
  const handleHotelCheckoutBack = useCallback(() => {
    setShowHotelCheckout(false);
  }, []);

  // Called by HotelCheckout once payment/booking actually succeeds —
  // clears the cart so a completed trip doesn't linger in the builder.
  const handleHotelBookingComplete = useCallback(() => {
    setRoomCart([]);
    setShowHotelCheckout(false);
    setSelectedHotelOffer(null);
    setCheckoutRooms([]);
  }, []);

  // ── Read trip type from landing page URL param on mount ──
  useEffect(() => {
    const typeFromUrl = searchParams.get("type");
    if (
      typeFromUrl &&
      ["solo", "romantic", "family", "group"].includes(typeFromUrl)
    ) {
      updateAtlasContext({ tripType: typeFromUrl });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateAtlasContext({
      destination: destCity,
      budget: budgetState.planned,
      tripDays: budgetState.tripDays,
      bookingTotal: budgetState.bookingTotal,
      spent: budgetState.used,
      flights: flightResults,
    });
  }, [destCity, budgetState, flightResults, updateAtlasContext]);

  const [prefillEditing, setPrefillEditing] = useState(false);
  const [prefillDismissed, setPrefillDismissed] = useState(false);
  const [editPrompt, setEditPrompt] = useState(prefillData?.prompt ?? "");
  const [editBudget, setEditBudget] = useState(prefillData?.budget ?? null);
  const [editDays, setEditDays] = useState(prefillData?.tripDays ?? null);

  const budgetSeed = prefillData?.budget ?? null;
  const tripDaySeed = prefillData?.tripDays ?? null;

  const runAutoSearch = useCallback(() => {
    if (!prefillData?.iata) return;
    const { iata, tripDays: days = 10 } = prefillData;
    const { departDate, returnDate } = getAutoSearchDates(days);
    setAutoSearchLoading(true);
    setAutoSearchError(null);
    setTab("Flights");
    const params = new URLSearchParams({
      from: fromCode,
      to: iata,
      departDate,
      returnDate,
      adults: "1",
      cabin: "economy",
    });
    fetch(`${API}/api/flights/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "Search failed");
        setFlightResults(data.flights ?? []);
        setAutoSearchDone(true);
        setVisibleCount(RESULTS_PER_PAGE);
        if (data.flights?.length) {
          const cheapest = [...data.flights].sort(
            (a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
          )[0];
          setPriceWatchRoute({
            from: fromCode,
            to: iata,
            price: parseFloat(cheapest.totalAmount),
            airline: cheapest.owner,
          });
          antdMessage.success(
            `Found ${data.flights.length} flights to ${prefillData.destination}`
          );
        } else {
          antdMessage.info(
            "No flights found for this route — try adjusting dates."
          );
        }
      })
      .catch((err) => {
        setAutoSearchError(err.message);
        antdMessage.error(`Flight search failed: ${err.message}`);
      })
      .finally(() => setAutoSearchLoading(false));
  }, [prefillData, fromCode]);

  useEffect(() => {
    runAutoSearch();
    // Runs once on mount, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrefillSave = useCallback(() => {
    const newDest = extractDestFromPrompt(editPrompt) ?? destCity;
    const newBudget = editBudget ?? extractBudgetFromPrompt(editPrompt);
    setDestCity(newDest);
    if (newBudget) setBudgetState((prev) => ({ ...prev, planned: newBudget }));
    if (editDays) {
      setSelectedNights(editDays);
      setBudgetState((prev) => ({ ...prev, tripDays: editDays }));
    }
    setPrefillEditing(false);
    antdMessage.success("Trip details updated!");
  }, [editPrompt, editBudget, editDays, destCity]);

  const visibleFlights = useMemo(
    () =>
      applyFilters(flightResults, smartFilters).sort(compareFlights(sortBy)),
    [flightResults, smartFilters, sortBy]
  );

  // Round-trip searches return one priced "journey" per outbound+return
  // pairing, so the same outbound flight can appear many times, once
  // per available return time. Grouping by outbound lets step 1 show
  // one card per outbound flight, then step 2 lists only that group's
  // return options — the two-step pattern most travel search sites use.
  // One-way results (no returningAt on any flight) skip grouping
  // entirely and render exactly as they did before.
  const hasReturnData = useMemo(
    () => flightResults.some((f) => f.returningAt),
    [flightResults]
  );

  const flightGroups = useMemo(() => {
    if (!hasReturnData) return [];
    const groups = new Map();
    visibleFlights.forEach((f) => {
      const key = getOutboundGroupKey(f);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    });
    return Array.from(groups.entries())
      .map(([key, options]) => ({
        key,
        options,
        cheapest: options.reduce(
          (min, f) =>
            parseFloat(f.totalAmount) < parseFloat(min.totalAmount) ? f : min,
          options[0]
        ),
      }))
      .sort((a, b) => compareFlights(sortBy)(a.cheapest, b.cheapest));
  }, [visibleFlights, hasReturnData, sortBy]);

  // The group the person committed to in step 1, if any. Falls back to
  // null automatically if a filter change makes that group disappear.
  const selectedGroup = useMemo(
    () => flightGroups.find((g) => g.key === selectedOutboundGroupKey) || null,
    [flightGroups, selectedOutboundGroupKey]
  );

  const paginatedFlights = useMemo(
    () => visibleFlights.slice(0, visibleCount),
    [visibleFlights, visibleCount]
  );
  const paginatedGroups = useMemo(
    () => flightGroups.slice(0, visibleCount),
    [flightGroups, visibleCount]
  );
  const flightDisplayCount = hasReturnData
    ? flightGroups.length
    : visibleFlights.length;
  // Pagination only applies to the step-1 outbound list — step 2 shows
  // a group's full set of return options at once (typically small).
  const hasMore = !selectedGroup && visibleCount < flightDisplayCount;
  const activeFilterCount = useMemo(
    () => Object.values(smartFilters).filter((v) => v !== "any").length,
    [smartFilters]
  );

  // Hotels — pagination mirrors flights (no separate filter set yet)
  const visibleHotels = useMemo(
    () =>
      applyHotelFilters(hotelResults, hotelFilters).sort(
        compareHotels(hotelSortBy)
      ),
    [hotelResults, hotelFilters, hotelSortBy]
  );
  const activeHotelFilterCount = useMemo(
    () => Object.values(hotelFilters).filter((v) => v !== "any").length,
    [hotelFilters]
  );
  const paginatedHotels = useMemo(
    () => visibleHotels.slice(0, visibleCount),
    [visibleHotels, visibleCount]
  );
  const hotelHasMore = visibleCount < visibleHotels.length;

  // A new hotel search starts with clean filters (the old hotel pick won't exist).
  useEffect(() => {
    setHotelFilters(DEFAULT_HOTEL_FILTERS);
  }, [hotelResults]);

  useEffect(() => {
    setVisibleCount(RESULTS_PER_PAGE);
    setSelectedOutboundGroupKey(null);
  }, [flightResults, hotelResults, smartFilters, hotelFilters, hotelSortBy]);

  // Only the destination's weather is surfaced anywhere in the booking flow —
  // origin weather (e.g. "Newark · Avg 58°/44°") was dropped since the user
  // already knows their own local forecast; it just ate space on the busiest
  // screen without helping anyone decide anything. Destination weather is
  // folded into the single-line trip summary (sk-tripMeta) below instead of
  // its own standalone widget.
  const weather = useMemo(() => getWeatherForCity(destCity), [destCity]);
  const weatherTitle = weather.label
    ? `${weather.label}${weather.temp ? `  ·  ${weather.temp}` : ""}`
    : "Select a destination";
  const heroRoute = destCity
    ? `${originCity ? originCity.toUpperCase() : fromCode} → ${destCity}`
    : "Where to next?";
  const heroNights = selectedNights
    ? `${selectedNights} night${selectedNights !== 1 ? "s" : ""}`
    : "";

  // Quick chips are shortcuts into the SAME smartFilters the dropdowns use, so a
  // chip and its dropdown always agree. (The old Luxury / Unwind / Adventure /
  // Romantic chips only toggled their own highlight — flight data has nothing to
  // filter those on, so they were removed rather than left as fake controls.)
  const quickFilters = useMemo(
    () => [
      { label: "Under $500", key: "price", value: 500 },
      { label: "Nonstop", key: "stops", value: 0 },
      { label: "Morning", key: "time", value: "morning" },
      { label: "Max XP", key: "xp", value: 150 },
    ],
    []
  );
  const isQuickActive = (qf) =>
    String(smartFilters[qf.key]) === String(qf.value);
  const toggleFilter = (qf) =>
    setSmartFilters((prev) => ({
      ...prev,
      [qf.key]: String(prev[qf.key]) === String(qf.value) ? "any" : qf.value,
    }));
  const clearFilters = () => setSmartFilters(DEFAULT_FILTERS);

  const [selectedResult, setSelectedResult] = useState({
    id: "",
    title: "",
    total: 0,
  });
  const handleSelectResult = useCallback((result) => {
    setSelectedResult(result);
    setBudgetState((prev) => ({ ...prev, bookingTotal: result.total ?? 0 }));
  }, []);
  const handleBudgetChange = useCallback((state) => {
    setBudgetState(state);
  }, []);
  const scrollToBudget = useCallback(() => {
    budgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Confirms a specific outbound+return combination and sends the
  // person straight to checkout with that exact flight object — used
  // both for single-return groups ("Book Now") and for a chosen return
  // time in step 2 of the round-trip flow.
  const selectFlightForCheckout = useCallback(
    (flight) => {
      setSelectedFlight(flight);
      setShowCheckout(true);
      handleSelectResult({
        id: flight.id,
        title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
        total: parseFloat(flight.totalAmount),
      });
    },
    [handleSelectResult]
  );

  // Packages / Last-Minute hand off to a real Flights (or Stays) search:
  // the URL carries the prefill and auto=1 runs it as soon as the form opens.
  const [packagePlan, setPackagePlan] = useState(null);
  const runHandoff = useCallback(
    ({ tab: nextTab, params = {}, plan }) => {
      const next = new URLSearchParams();
      const gid = searchParams.get("groupId");
      if (gid) next.set("groupId", gid);
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== "") next.set(k, String(v));
      });
      next.set("tab", nextTab);
      next.set("auto", "1");
      setSearchParams(next);
      if (plan !== undefined) setPackagePlan(plan);
      setFlightResults([]);
      setHotelResults([]);
      setExcursionResults([]);
      setSearchError(null);
      setSmartFilters(DEFAULT_FILTERS);
      setHotelFilters(DEFAULT_HOTEL_FILTERS);
      setVisibleCount(RESULTS_PER_PAGE);
      setTab(nextTab);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, setSearchParams]
  );

  const searchFormProps = {
    onDestChange: setDestCity,
    onDatesChange: handleDatesChange,
    onHandoff: runHandoff,
  };
  const isSearching = autoSearchLoading || manualSearchLoading;

  const searchForm = useMemo(() => {
    switch (tab) {
      case "Flights":
        return (
          <FlightsForm
            onSearch={(f) => {
              setFlightResults(f);
              setSmartFilters(DEFAULT_FILTERS);
              setVisibleCount(RESULTS_PER_PAGE);
              setAiInsightDismissed(false);
              if (f.length > 0) {
                const cheapest = [...f].sort(
                  (a, b) =>
                    parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
                )[0];
                setPriceWatchRoute({
                  from: cheapest.origin,
                  to: cheapest.destination,
                  price: parseFloat(cheapest.totalAmount),
                  airline: cheapest.owner,
                });
              }
            }}
            onDestChange={setDestCity}
            onDatesChange={handleDatesChange}
            onOriginChange={setOriginCity}
            onSearchStart={() => setManualSearchLoading(true)}
            onSearchEnd={() => setManualSearchLoading(false)}
            onSearchError={setSearchError}
            retryRef={flightRetryRef}
            initial={flightInitial}
          />
        );
      case "Stays":
        return (
          <StaysForm
            onSearch={(hotels) => {
              setHotelResults(hotels);
              setVisibleCount(RESULTS_PER_PAGE);
            }}
            onDestChange={setDestCity}
            onDatesChange={handleDatesChange}
            onSearchStart={() => setManualSearchLoading(true)}
            onSearchEnd={() => setManualSearchLoading(false)}
            initial={stayInitial}
          />
        );
      case "Cars":
        return <CarsForm onDestChange={setDestCity} />;
      case "Saved":
        return <SavedForm />;
      case "Excursions":
        return (
          <ExcursionsForm
            onDestChange={setDestCity}
            onSearch={(excursions) => {
              setExcursionResults(excursions);
              setVisibleCount(RESULTS_PER_PAGE);
            }}
            onSearchStart={() => setManualSearchLoading(true)}
            onSearchEnd={() => setManualSearchLoading(false)}
            initial={excursionInitial}
          />
        );
      case "Packages":
        return <PackagesForm {...searchFormProps} />;
      case "Last-Minute":
        return <LastMinuteForm onHandoff={runHandoff} />;
      default:
        return null;
    }
    // The initial values are listed so a link's prefill reaches the form even
    // when it's ready a moment after the page (e.g. the group's hotel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    handleDatesChange,
    flightInitial,
    stayInitial,
    excursionInitial,
    runHandoff,
  ]);

  const resultsTitle =
    tab === "Stays"
      ? isSearching
        ? "Searching hotels…"
        : hotelResults.length > 0
        ? activeHotelFilterCount > 0
          ? `${visibleHotels.length} of ${hotelResults.length} Room Options`
          : `${hotelResults.length} Room Option${
              hotelResults.length !== 1 ? "s" : ""
            } Found`
        : "Results"
      : tab === "Excursions"
      ? isSearching
        ? "Searching experiences…"
        : excursionResults.length > 0
        ? `${excursionResults.length} Experience${
            excursionResults.length !== 1 ? "s" : ""
          } Found`
        : "Things to Do"
      : isSearching
      ? "Searching flights…"
      : hasReturnData && selectedGroup
      ? `${selectedGroup.options.length} Return Flight${
          selectedGroup.options.length !== 1 ? "s" : ""
        }`
      : flightDisplayCount > 0
      ? `${flightDisplayCount} ${
          hasReturnData ? "Departing Flight" : "Flight"
        }${flightDisplayCount !== 1 ? "s" : ""} Found${
          activeFilterCount > 0 ? " (filtered)" : ""
        }`
      : flightResults.length > 0
      ? "No flights match your filters"
      : "Results";

  // Checkout screens render as overlays ON TOP of the results page rather
  // than replacing it via a separate top-level return. Swapping the whole
  // return tree used to force React to fully unmount, then rebuild from
  // scratch, the entire results page (hundreds of cards, heavy
  // backdrop-filter blur on nearly every panel, re-triggered entry
  // animations) on every single "Book Now" / "Back" click — THAT
  // unmount+remount was the real source of the sluggish transitions, not
  // anything checkout-specific. Keeping the results tree mounted
  // underneath (just hidden) makes "Back" effectively instant.
  const checkoutOverlay =
    showCheckout && selectedFlight ? (
      <div
        className="sk-checkout-overlay"
        style={{ "--sk-bg-image": `url(${heroImg})` }}
      >
        <BookingCheckout
          flight={selectedFlight}
          groupId={syncGroupId}
          onBack={() => {
            setShowCheckout(false);
            setSelectedFlight(null);
          }}
        />
      </div>
    ) : showHotelCheckout && checkoutRooms.length > 0 ? (
      <div
        className="sk-checkout-overlay"
        style={{ "--sk-bg-image": `url(${heroImg})` }}
      >
        <HotelCheckout
          rooms={checkoutRooms}
          // `hotel` kept for backward compatibility with any code still
          // reading a single-offer prop — always the first room in the set.
          hotel={selectedHotelOffer}
          destCity={destCity}
          groupId={syncGroupId}
          onBack={handleHotelCheckoutBack}
          onBookingComplete={handleHotelBookingComplete}
        />
      </div>
    ) : null;

  return (
    <>
      {checkoutOverlay}
      {syncGroupId && !checkoutOverlay && (
        <div
          role="status"
          style={{
            position: "relative",
            zIndex: 5,
            maxWidth: 960,
            margin: "12px auto 0",
            padding: "10px 16px",
            borderRadius: 12,
            background: "rgba(124,58,237,0.14)",
            border: "1px solid rgba(124,58,237,0.35)",
            color: "#fff",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            Planning a Sync Together trip — tap “Suggest to group” on anything
            you like so everyone can vote, or book your own part.
          </span>
          <span style={{ display: "flex", gap: 12 }}>
            <Link
              to={`/sync-together/${syncGroupId}`}
              style={{ color: "#ffb347" }}
            >
              Back to the trip
            </Link>
            <button
              type="button"
              onClick={leaveSyncGroup}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
              }}
            >
              Book something else
            </button>
          </span>
        </div>
      )}
      <div
        className="sk-booking"
        style={{
          "--sk-bg-image": `url(${heroImg})`,
          // Hidden (not unmounted) while a checkout overlay is open —
          // display:none is nearly free for the browser (no layout/paint/
          // compositing of the blur-heavy cards underneath) and preserves
          // all existing state, scroll position, and DOM nodes so
          // returning from checkout doesn't rebuild anything.
          display: checkoutOverlay ? "none" : undefined,
        }}
      >
        <div className="sk-booking-hero">
          <Title className="sk-hero-title">
            Lock in your{" "}
            <span className="sk-hero-title-accent">next adventure.</span>
          </Title>

          <div className="sk-tripState">
            <div className="sk-tripRoute">{heroRoute}</div>
            <div className="sk-tripMeta">
              {heroNights && `${heroNights}  ·  `}
              {destCity &&
                weather.label &&
                `${weather.label} ${weather.temp}  ·  `}
              {weather.sub}
              {destCity && "  ·  Best value window"}
            </div>
            <div className="sk-tripAssist">
              {isSearching
                ? "Searching live flights for you…"
                : autoSearchDone && flightResults.length > 0
                ? `Found ${flightResults.length} flights — scroll down to pick`
                : destCity
                ? "Smart Plan found great options for you"
                : "Enter your destination to get started"}
            </div>

            {prefillData && !prefillDismissed && (
              <div className="sk-prefill-strip">
                {!prefillEditing ? (
                  <div className="sk-prefill-collapsed">
                    <span className="sk-prefill-bolt">
                      <Zap size={12} />
                    </span>
                    <span className="sk-prefill-loaded">Loaded from AI</span>
                    <span className="sk-prefill-divider">·</span>
                    {destCity && (
                      <span className="sk-prefill-chip">
                        <MapPin
                          size={11}
                          style={{ marginRight: 3, verticalAlign: "middle" }}
                        />
                        {destCity}
                      </span>
                    )}
                    {budgetSeed && (
                      <span className="sk-prefill-chip">
                        <DollarSign
                          size={11}
                          style={{ marginRight: 2, verticalAlign: "middle" }}
                        />
                        {budgetSeed.toLocaleString()}
                      </span>
                    )}
                    {tripDaySeed && (
                      <span className="sk-prefill-chip">
                        <Calendar
                          size={11}
                          style={{ marginRight: 3, verticalAlign: "middle" }}
                        />
                        {tripDaySeed}d
                      </span>
                    )}
                    <button
                      type="button"
                      className="sk-prefill-editBtn"
                      onClick={() => setPrefillEditing(true)}
                    >
                      <EditOutlined /> Edit
                    </button>
                    <button
                      type="button"
                      className="sk-prefill-dismissBtn"
                      onClick={() => setPrefillDismissed(true)}
                      aria-label="Dismiss"
                    >
                      <CloseOutlined />
                    </button>
                  </div>
                ) : (
                  <div className="sk-prefill-expanded">
                    <div className="sk-prefill-expandedRow">
                      <div className="sk-prefill-field sk-prefill-field--grow">
                        <label className="sk-prefill-label">Prompt</label>
                        <Input
                          className="sk-prefill-input"
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                        />
                      </div>
                      <div className="sk-prefill-field">
                        <label className="sk-prefill-label">Budget ($)</label>
                        <InputNumber
                          className="sk-prefill-numInput"
                          prefix="$"
                          value={editBudget}
                          min={0}
                          step={100}
                          controls={false}
                          onChange={(v) => setEditBudget(v ?? null)}
                          placeholder="2500"
                        />
                      </div>
                      <div className="sk-prefill-field">
                        <label className="sk-prefill-label">Nights</label>
                        <InputNumber
                          className="sk-prefill-numInput"
                          value={editDays}
                          min={1}
                          max={60}
                          controls={false}
                          onChange={(v) => setEditDays(v ?? null)}
                          placeholder="7"
                        />
                      </div>
                    </div>
                    <div className="sk-prefill-expandedActions">
                      <button
                        type="button"
                        className="sk-prefill-saveBtn"
                        onClick={handlePrefillSave}
                      >
                        <CheckOutlined /> Save
                      </button>
                      <button
                        type="button"
                        className="sk-prefill-cancelBtn"
                        onClick={() => setPrefillEditing(false)}
                      >
                        <CloseOutlined /> Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Price Watch Card ── */}
          <div className="sk-price-watch-card">
            <div className="sk-pwc-header">
              <div className="sk-pwc-xp">
                <Zap size={13} className="sk-pwc-xp-icon" />
                <span className="sk-pwc-xp-label">
                  Earn up to <strong>150 XP</strong> on booking
                </span>
              </div>
              <button
                type="button"
                className={`sk-pwc-toggle${priceWatchOn ? " is-on" : ""}`}
                onClick={handlePriceWatchToggle}
                aria-pressed={priceWatchOn}
              >
                {priceWatchOn ? (
                  <Bell size={13} className="sk-pwc-bell" />
                ) : (
                  <BellOff size={13} className="sk-pwc-bell" />
                )}
                <span className="sk-pwc-toggle-label">
                  Price Watch {priceWatchOn ? "On" : "Off"}
                </span>
                <span className={`sk-pwc-dot${priceWatchOn ? " is-on" : ""}`} />
              </button>
            </div>
            <div className="sk-pwc-desc">
              {priceWatchOn
                ? `Watching ${priceWatchRoute?.from ?? "your route"} → ${
                    priceWatchRoute?.to ?? "destination"
                  } — we'll notify you when prices drop.`
                : priceWatchRoute
                ? "Search results loaded — turn on to get alerted if this route drops in price."
                : "Search for a route above, then turn on price alerts."}
            </div>
            {!aiInsightDismissed &&
              priceWatchRoute &&
              flightResults.length >= 3 &&
              (() => {
                const prices = flightResults
                  .map((f) => parseFloat(f.totalAmount))
                  .filter(Boolean);
                const cheapest = Math.min(...prices);
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const delta = Math.round(avg - cheapest);
                if (delta < 20) return null;
                return (
                  <div className="sk-pwc-insight">
                    <Zap size={12} className="sk-pwc-insight-icon" />
                    <span className="sk-pwc-insight-text">
                      The cheapest option is ${cheapest.toFixed(0)} — prices on
                      this route vary by up to ${delta} right now. Turn on Price
                      Watch to catch any drops.
                    </span>
                    <button
                      type="button"
                      className="sk-pwc-insight-dismiss"
                      onClick={() => setAiInsightDismissed(true)}
                      aria-label="Dismiss AI insight"
                    >
                      ×
                    </button>
                  </div>
                );
              })()}
          </div>

          <Text className="sk-hero-sub">
            Smart Plan AI helps balance budget, comfort, and XP.
          </Text>

          {/* ── Who's traveling + HeroPlanner ── */}
          <TripTypeSelector />

          <HeroPlanner
            onDestinationSelect={(city) => {
              if (city) setDestCity(city);
              else setDestCity("");
            }}
            onSearchManually={handleSearchManually}
          />

          <BookingTabBar
            value={tab}
            onChange={(val) => {
              setTab(val);
              if (val !== "Flights" && val !== "Stays") setPackagePlan(null);
              setFlightResults([]);
              setHotelResults([]);
              setExcursionResults([]);
              setSearchError(null);
              setSmartFilters(DEFAULT_FILTERS);
              setSortBy("price");
              setHotelFilters(DEFAULT_HOTEL_FILTERS);
              setHotelSortBy("price");
              setVisibleCount(RESULTS_PER_PAGE);
              // Leaving Stays clears any in-progress room cart so a
              // half-built trip from a previous search doesn't linger
              // silently in the background.
              if (val !== "Stays") setRoomCart([]);
            }}
          />

          {/* ── Search form (scroll target for "Search manually") ── */}
          <div ref={searchFormRef}>{searchForm}</div>

          {/* Package in progress: flight first, then the stay */}
          {packagePlan && (tab === "Flights" || tab === "Stays") && (
            <div className="sk-pkg-banner" role="status">
              <span className="sk-pkg-banner-steps">
                <span className={tab === "Flights" ? "is-now" : "is-done"}>
                  <IconFlight size={12} /> 1 · Flight
                </span>
                <span className="sk-pkg-step-line" aria-hidden="true" />
                <span className={tab === "Stays" ? "is-now" : ""}>
                  <IconHotel size={12} /> 2 · Stay in {packagePlan.city}
                </span>
              </span>
              {tab === "Flights" ? (
                <button
                  type="button"
                  className="sk-pkg-banner-btn"
                  onClick={() =>
                    runHandoff({
                      tab: "Stays",
                      params: {
                        city: packagePlan.city,
                        depart: packagePlan.depart,
                        return: packagePlan.ret,
                        adults: packagePlan.adults,
                        rooms: packagePlan.rooms,
                      },
                    })
                  }
                >
                  Next: find your stay <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="sk-pkg-banner-btn sk-pkg-banner-btn--ghost"
                  onClick={() => setPackagePlan(null)}
                >
                  Done
                </button>
              )}
            </div>
          )}

          <SmartFilterBar
            filters={smartFilters}
            onChange={setSmartFilters}
            flightResults={flightResults}
            visible={tab === "Flights"}
          />

          <HotelFilterBar
            filters={hotelFilters}
            onChange={setHotelFilters}
            hotelResults={hotelResults}
            visible={tab === "Stays"}
          />

          <Space className="sk-action-row" wrap>
            {tab === "Flights" && (
              <Button
                className="sk-btn-orange"
                onClick={() => {
                  const i = SORT_OPTIONS.findIndex((o) => o.key === sortBy);
                  setSortBy(SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length].key);
                }}
                title="Click to change sort"
              >
                Sort: {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
              </Button>
            )}
            {tab === "Stays" && (
              <Button
                className="sk-btn-orange"
                onClick={() => {
                  const i = HOTEL_SORT_OPTIONS.findIndex(
                    (o) => o.key === hotelSortBy
                  );
                  setHotelSortBy(
                    HOTEL_SORT_OPTIONS[(i + 1) % HOTEL_SORT_OPTIONS.length].key
                  );
                }}
                title="Click to change sort"
              >
                Sort:{" "}
                {HOTEL_SORT_OPTIONS.find((o) => o.key === hotelSortBy)?.label}
              </Button>
            )}
            <Link to="/sync-together">
              <Button className="sk-btn-sync" icon={<SyncOutlined />}>
                Sync Together
              </Button>
            </Link>
            {(visibleFlights.length > 0 || hotelResults.length > 0) && (
              <button
                type="button"
                className="sk-scroll-budget-btn"
                onClick={scrollToBudget}
              >
                <ChevronsDown
                  size={13}
                  style={{ marginRight: 4, verticalAlign: "middle" }}
                />
                Trip Budget
              </button>
            )}
          </Space>

          {tab === "Flights" && (
            <Space className="sk-filters" wrap>
              {quickFilters.map((qf) => (
                <button
                  key={qf.label}
                  type="button"
                  className={`sk-qf${isQuickActive(qf) ? " is-active" : ""}`}
                  aria-pressed={isQuickActive(qf)}
                  onClick={() => toggleFilter(qf)}
                >
                  {qf.label}
                </button>
              ))}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="sk-qf sk-qf-clear"
                  onClick={clearFilters}
                >
                  Clear filters →
                </button>
              )}
            </Space>
          )}

          {/* ── Room cart — book one room, then add more for others ── */}
          {tab === "Stays" && (
            <RoomCartBar
              rooms={roomCart}
              onRemove={removeRoomFromCart}
              onCheckout={handleCheckoutCart}
              destCity={destCity}
            />
          )}
        </div>

        <Row gutter={[24, 24]} className="sk-results-wrap">
          <Col xs={24} lg={16}>
            <div className="sk-resultsHeader">
              <Title level={4} className="sk-section-title">
                {resultsTitle}
              </Title>
              <div className="sk-resultsSub">
                {tab === "Stays"
                  ? isSearching
                    ? `Searching hotels in ${destCity || "your destination"}…`
                    : hotelResults.length > 0
                    ? `Sorted by price · ${destCity}`
                    : "Search above to find hotels."
                  : tab === "Excursions"
                  ? isSearching
                    ? `Searching experiences in ${
                        destCity || "your destination"
                      }…`
                    : excursionResults.length > 0
                    ? `Powered by Viator · ${destCity}`
                    : "Search above to find tours & activities."
                  : isSearching
                  ? `Searching ${fromCode} → ${
                      prefillData?.iata ?? destCity
                    } · live prices`
                  : hasReturnData && selectedGroup
                  ? "Pick a return time to continue"
                  : flightDisplayCount > 0
                  ? `Sorted by price · ${fromCode} → ${
                      prefillData?.iata ?? destCity
                    }${
                      activeFilterCount > 0
                        ? ` · ${activeFilterCount} filter${
                            activeFilterCount > 1 ? "s" : ""
                          } active`
                        : ""
                    }`
                  : flightResults.length > 0 && flightDisplayCount === 0
                  ? "Try relaxing your filters to see more results"
                  : "Search above to find flights."}
              </div>
              {tab === "Flights" &&
                !isSearching &&
                !selectedGroup &&
                flightResults.length > 0 &&
                flightDisplayCount === 0 && (
                  <button
                    type="button"
                    className="sk-clear-filters-cta"
                    onClick={() => setSmartFilters(DEFAULT_FILTERS)}
                  >
                    Clear all filters
                  </button>
                )}
            </div>

            {isSearching && tab === "Flights" && (
              <FlightSkeleton destCity={destCity} fromCode={fromCode} />
            )}
            {isSearching && tab === "Stays" && (
              <FlightSkeleton destCity={destCity} fromCode={null} />
            )}

            {!isSearching && tab === "Flights" && autoSearchError && (
              <div className="sk-search-error">
                <IconWarning size={14} /> {autoSearchError} —{" "}
                <button
                  type="button"
                  className="sk-search-retry"
                  onClick={() => {
                    setAutoSearchError(null);
                    runAutoSearch();
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!isSearching && tab === "Flights" && searchError && (
              <div className="sk-search-error" role="alert">
                <IconWarning size={14} /> {searchError} —{" "}
                <button
                  type="button"
                  className="sk-search-retry"
                  onClick={() => flightRetryRef.current?.()}
                >
                  Try again
                </button>
              </div>
            )}

            {/* One-way results — unchanged single-flight cards, one per
                journey (there's no return leg to group by, so no
                two-step flow needed). */}
            {!isSearching &&
              tab === "Flights" &&
              !hasReturnData &&
              paginatedFlights.length > 0 &&
              paginatedFlights.map((flight) => (
                <Card
                  key={flight.id}
                  variant="borderless"
                  className={`sk-result-card${
                    selectedResult.id === flight.id ? " is-selected" : ""
                  }`}
                  onClick={() =>
                    handleSelectResult({
                      id: flight.id,
                      title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                      total: parseFloat(flight.totalAmount),
                    })
                  }
                  style={{ cursor: "pointer", marginBottom: 14 }}
                >
                  <div className="sk-resultRow">
                    <div
                      className="sk-thumb"
                      style={
                        flight.ownerLogo
                          ? {
                              backgroundImage: `url(${flight.ownerLogo})`,
                              backgroundSize: "60%",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "center",
                              backgroundColor: "rgba(255,255,255,0.06)",
                            }
                          : undefined
                      }
                    />
                    <div className="sk-resultMain">
                      <div className="sk-resultTop">
                        <div>
                          <div className="sk-resultTitle">{flight.owner}</div>
                          <div className="sk-resultMeta">
                            <span className="sk-metaItem">
                              <EnvironmentOutlined /> {flight.origin} →{" "}
                              {flight.destination}
                            </span>
                            <span className="sk-metaDot">·</span>
                            <span className="sk-metaItem">
                              {describeStops(flight.stops, flight.slices?.[0])}
                            </span>
                            {flight.departingAt && (
                              <>
                                <span className="sk-metaDot">·</span>
                                <span className="sk-metaItem">
                                  {dayjs(flight.departingAt).format(
                                    "MMM D · h:mm A"
                                  )}{" "}
                                  → {dayjs(flight.arrivingAt).format("h:mm A")}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="sk-pickedWhy">
                            Best price + comfort score
                          </div>
                        </div>
                        <div className="sk-resultRight">
                          <div className="sk-priceLine">
                            <span className="sk-priceAmt">
                              ${parseFloat(flight.totalAmount).toFixed(0)}
                            </span>
                            <span className="sk-priceSub">
                              {flight.totalCurrency}
                            </span>
                          </div>
                          <SaveTripButton
                            size="small"
                            variant="ghost"
                            label="Save"
                            tripData={{
                              tripType: "flight",
                              title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                              destination: flight.destination,
                              price: parseFloat(flight.totalAmount),
                              currency: flight.totalCurrency || "USD",
                              startDate: flight.departingAt
                                ? dayjs(flight.departingAt).format("YYYY-MM-DD")
                                : "",
                              metadata: {
                                flightId: flight.id,
                                stops: flight.stops,
                              },
                            }}
                            onSaveError={(msg) => antdMessage.error(msg)}
                          />
                          <button
                            type="button"
                            className={`sk-watch-btn${
                              watchingId === flight.id ? " is-watching" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWatchFlight(flight);
                            }}
                            title={
                              watchingId === flight.id
                                ? "Stop watching price"
                                : "Watch price"
                            }
                          >
                            {watchingId === flight.id ? (
                              <>
                                <Bell
                                  size={11}
                                  style={{
                                    marginRight: 3,
                                    verticalAlign: "middle",
                                  }}
                                />{" "}
                                Watching
                              </>
                            ) : (
                              <>
                                <BellOff
                                  size={11}
                                  style={{
                                    marginRight: 3,
                                    verticalAlign: "middle",
                                  }}
                                />{" "}
                                Watch
                              </>
                            )}
                          </button>
                          <Button
                            className="sk-btn-orange"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectFlightForCheckout(flight);
                            }}
                          >
                            Book Now
                          </Button>
                        </div>
                      </div>
                      <div className="sk-tagRow">
                        <span className="sk-tag sk-tag-good">
                          {flight.stops === 0
                            ? "Nonstop"
                            : `${flight.stops} stop`}
                        </span>
                        <span className="sk-tag sk-tag-orange">
                          {flight.ownerCode}
                        </span>
                        {budgetSeed &&
                          parseFloat(flight.totalAmount) <= budgetSeed && (
                            <span className="sk-tag sk-tag-good">
                              Within budget
                            </span>
                          )}
                        <span className="sk-tag sk-tag-xp">
                          <Zap
                            size={11}
                            style={{ marginRight: 3, verticalAlign: "middle" }}
                          />{" "}
                          {getFlightXP(flight)} XP
                        </span>
                      </div>
                    </div>
                  </div>
                  {syncGroupId && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 10,
                      }}
                    >
                      <SuggestBtn kind="flight" data={flight} />
                    </div>
                  )}
                </Card>
              ))}

            {/* Round-trip results, STEP 1 — one card per outbound
                flight. Clicking commits to that outbound and moves to
                step 2 (return-flight picker) below, unless there's
                only one possible return, in which case it books
                immediately, same as a one-way flight would. */}
            {!isSearching &&
              tab === "Flights" &&
              hasReturnData &&
              !selectedGroup &&
              paginatedGroups.length > 0 &&
              paginatedGroups.map((group) => {
                const outbound = group.options[0];
                const cheapest = group.cheapest;
                const multipleReturns = group.options.length > 1;

                return (
                  <Card
                    key={group.key}
                    variant="borderless"
                    className={`sk-result-card${
                      selectedResult.id === cheapest.id ? " is-selected" : ""
                    }`}
                    onClick={() =>
                      handleSelectResult({
                        id: cheapest.id,
                        title: `${outbound.owner} · ${outbound.origin} → ${outbound.destination}`,
                        total: parseFloat(cheapest.totalAmount),
                      })
                    }
                    style={{ cursor: "pointer", marginBottom: 14 }}
                  >
                    <div className="sk-resultRow">
                      <div
                        className="sk-thumb"
                        style={
                          outbound.ownerLogo
                            ? {
                                backgroundImage: `url(${outbound.ownerLogo})`,
                                backgroundSize: "60%",
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                backgroundColor: "rgba(255,255,255,0.06)",
                              }
                            : undefined
                        }
                      />
                      <div className="sk-resultMain">
                        <div className="sk-resultTop">
                          <div>
                            <div className="sk-resultTitle">
                              {outbound.owner}
                            </div>
                            <div className="sk-resultMeta">
                              <span className="sk-metaItem">
                                <EnvironmentOutlined /> {outbound.origin} →{" "}
                                {outbound.destination}
                              </span>
                              <span className="sk-metaDot">·</span>
                              <span className="sk-metaItem">
                                {describeStops(
                                  outbound.stops,
                                  outbound.slices?.[0]
                                )}
                              </span>
                              {outbound.departingAt && (
                                <>
                                  <span className="sk-metaDot">·</span>
                                  <span className="sk-metaItem">
                                    {dayjs(outbound.departingAt).format(
                                      "MMM D · h:mm A"
                                    )}{" "}
                                    →{" "}
                                    {dayjs(outbound.arrivingAt).format(
                                      "h:mm A"
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="sk-pickedWhy">
                              {multipleReturns
                                ? `${group.options.length} return times to choose from`
                                : "Best price + comfort score"}
                            </div>
                          </div>
                          <div className="sk-resultRight">
                            <div className="sk-priceLine">
                              {multipleReturns && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.45)",
                                    marginRight: 4,
                                  }}
                                >
                                  from
                                </span>
                              )}
                              <span className="sk-priceAmt">
                                ${parseFloat(cheapest.totalAmount).toFixed(0)}
                              </span>
                              <span className="sk-priceSub">
                                {cheapest.totalCurrency}
                              </span>
                            </div>
                            <SaveTripButton
                              size="small"
                              variant="ghost"
                              label="Save"
                              tripData={{
                                tripType: "flight",
                                title: `${outbound.owner} · ${outbound.origin} → ${outbound.destination}`,
                                destination: outbound.destination,
                                price: parseFloat(cheapest.totalAmount),
                                currency: cheapest.totalCurrency || "USD",
                                startDate: outbound.departingAt
                                  ? dayjs(outbound.departingAt).format(
                                      "YYYY-MM-DD"
                                    )
                                  : "",
                                metadata: {
                                  flightId: cheapest.id,
                                  stops: outbound.stops,
                                },
                              }}
                              onSaveError={(msg) => antdMessage.error(msg)}
                            />
                            <button
                              type="button"
                              className={`sk-watch-btn${
                                watchingId === cheapest.id ? " is-watching" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWatchFlight(cheapest);
                              }}
                              title={
                                watchingId === cheapest.id
                                  ? "Stop watching price"
                                  : "Watch price"
                              }
                            >
                              {watchingId === cheapest.id ? (
                                <>
                                  <Bell
                                    size={11}
                                    style={{
                                      marginRight: 3,
                                      verticalAlign: "middle",
                                    }}
                                  />{" "}
                                  Watching
                                </>
                              ) : (
                                <>
                                  <BellOff
                                    size={11}
                                    style={{
                                      marginRight: 3,
                                      verticalAlign: "middle",
                                    }}
                                  />{" "}
                                  Watch
                                </>
                              )}
                            </button>
                            <Button
                              className="sk-btn-orange"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                // FIX: previously skipped straight to
                                // checkout when a group had only one
                                // return option — inconsistent with
                                // every other round-trip result, which
                                // showed a review step. Now every
                                // round-trip flight always goes through
                                // "Choose your return flight," even if
                                // there's only one option to confirm —
                                // consistent with how the person
                                // actually books, and it's still just
                                // one extra click for the single-option
                                // case.
                                setSelectedOutboundGroupKey(group.key);
                              }}
                            >
                              Select Flight
                            </Button>
                          </div>
                        </div>
                        <div className="sk-tagRow">
                          <span className="sk-tag sk-tag-good">
                            {outbound.stops === 0
                              ? "Nonstop"
                              : `${outbound.stops} stop`}
                          </span>
                          <span className="sk-tag sk-tag-orange">
                            {outbound.ownerCode}
                          </span>
                          {budgetSeed &&
                            parseFloat(cheapest.totalAmount) <= budgetSeed && (
                              <span className="sk-tag sk-tag-good">
                                Within budget
                              </span>
                            )}
                          <span className="sk-tag sk-tag-xp">
                            <Zap
                              size={11}
                              style={{
                                marginRight: 3,
                                verticalAlign: "middle",
                              }}
                            />{" "}
                            {getFlightXP(cheapest)} XP
                          </span>
                        </div>
                      </div>
                    </div>
                    {syncGroupId && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginTop: 10,
                        }}
                      >
                        <SuggestBtn kind="flight" data={cheapest} />
                      </div>
                    )}
                  </Card>
                );
              })}

            {/* Round-trip results, STEP 2 — return-flight picker for
                the outbound flight chosen in step 1. Shown instead of
                the outbound list entirely, with a way back up top,
                the same way Google Flights/Expedia hand off from
                "pick your departing flight" to "pick your return
                flight" as two distinct screens. */}
            {!isSearching &&
              tab === "Flights" &&
              hasReturnData &&
              selectedGroup && (
                <>
                  {/* Restyled from a plain text link to a bordered
                    button — the text link was easy to miss as an
                    actual control. This is the primary way back if
                    someone changes their mind about the departing
                    flight after reaching the return-flight step. */}
                  <button
                    type="button"
                    onClick={() => setSelectedOutboundGroupKey(null)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      padding: "9px 16px",
                      marginBottom: 18,
                      transition: "border-color .2s, background .2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,138,42,0.5)";
                      e.currentTarget.style.background =
                        "rgba(255,138,42,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.15)";
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                    }}
                  >
                    <ArrowLeftOutlined /> Back to departing flights
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      marginBottom: 20,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.45)",
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Departing flight selected
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {selectedGroup.options[0].owner} ·{" "}
                        {selectedGroup.options[0].origin} →{" "}
                        {selectedGroup.options[0].destination}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.55)",
                          marginTop: 2,
                        }}
                      >
                        {dayjs(selectedGroup.options[0].departingAt).format(
                          "ddd, MMM D · h:mm A"
                        )}{" "}
                        →{" "}
                        {dayjs(selectedGroup.options[0].arrivingAt).format(
                          "h:mm A"
                        )}
                        {" · "}
                        {describeStops(
                          selectedGroup.options[0].stops,
                          selectedGroup.options[0].slices?.[0]
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOutboundGroupKey(null)}
                      style={{
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10,
                        color: "rgba(255,255,255,0.75)",
                        padding: "8px 14px",
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        flexShrink: 0,
                      }}
                    >
                      Change flight
                    </button>
                  </div>

                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      marginBottom: 14,
                    }}
                  >
                    Choose your return flight
                  </div>

                  {selectedGroup.options
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.returningAt) - new Date(b.returningAt)
                    )
                    .map((opt) => {
                      const outbound = selectedGroup.options[0];
                      const returnSlice = opt.slices?.[1];
                      const retOrigin =
                        returnSlice?.origin ?? outbound.destination;
                      const retDestination =
                        returnSlice?.destination ?? outbound.origin;
                      const retStops = returnSlice?.stops ?? 0;

                      return (
                        <Card
                          key={opt.id}
                          variant="borderless"
                          className={`sk-result-card${
                            selectedResult.id === opt.id ? " is-selected" : ""
                          }`}
                          style={{ cursor: "pointer", marginBottom: 14 }}
                          onClick={() => selectFlightForCheckout(opt)}
                        >
                          <div className="sk-resultRow">
                            <div
                              className="sk-thumb"
                              style={
                                outbound.ownerLogo
                                  ? {
                                      backgroundImage: `url(${outbound.ownerLogo})`,
                                      backgroundSize: "60%",
                                      backgroundRepeat: "no-repeat",
                                      backgroundPosition: "center",
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                    }
                                  : undefined
                              }
                            />
                            <div className="sk-resultMain">
                              <div className="sk-resultTop">
                                <div>
                                  <div className="sk-resultTitle">
                                    {opt.owner}
                                  </div>
                                  <div className="sk-resultMeta">
                                    <span className="sk-metaItem">
                                      <EnvironmentOutlined /> {retOrigin} →{" "}
                                      {retDestination}
                                    </span>
                                    <span className="sk-metaDot">·</span>
                                    <span className="sk-metaItem">
                                      {describeStops(retStops, returnSlice)}
                                    </span>
                                    {opt.returningAt && (
                                      <>
                                        <span className="sk-metaDot">·</span>
                                        <span className="sk-metaItem">
                                          {dayjs(opt.returningAt).format(
                                            "MMM D · h:mm A"
                                          )}
                                          {opt.returnArrivingAt &&
                                            ` → ${dayjs(
                                              opt.returnArrivingAt
                                            ).format("h:mm A")}`}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="sk-pickedWhy">
                                    Total price for this trip
                                  </div>
                                </div>
                                <div className="sk-resultRight">
                                  <div className="sk-priceLine">
                                    <span className="sk-priceAmt">
                                      ${parseFloat(opt.totalAmount).toFixed(0)}
                                    </span>
                                    <span className="sk-priceSub">
                                      {opt.totalCurrency}
                                    </span>
                                  </div>
                                  <Button
                                    className="sk-btn-orange"
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectFlightForCheckout(opt);
                                    }}
                                  >
                                    Select
                                  </Button>
                                </div>
                              </div>
                              <div className="sk-tagRow">
                                <span className="sk-tag sk-tag-good">
                                  {retStops === 0
                                    ? "Nonstop"
                                    : `${retStops} stop`}
                                </span>
                                {budgetSeed &&
                                  parseFloat(opt.totalAmount) <= budgetSeed && (
                                    <span className="sk-tag sk-tag-good">
                                      Within budget
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                          {syncGroupId && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginTop: 10,
                              }}
                            >
                              <SuggestBtn kind="flight" data={opt} />
                            </div>
                          )}
                        </Card>
                      );
                    })}
                </>
              )}

            {/* ── Hotel result cards ── */}
            {!isSearching &&
              tab === "Stays" &&
              paginatedHotels.length > 0 &&
              paginatedHotels.map((hotel) => {
                const countInCart = roomCart.filter(
                  (r) => roomKey(r) === roomKey(hotel)
                ).length;
                const inCart = countInCart > 0;
                return (
                  <Card
                    key={roomKey(hotel)}
                    variant="borderless"
                    className={`sk-result-card${inCart ? " is-selected" : ""}`}
                    style={{ cursor: "pointer", marginBottom: 14 }}
                  >
                    <div className="sk-resultRow">
                      <div
                        className="sk-thumb"
                        style={
                          hotel.thumbnail
                            ? {
                                backgroundImage: `url(${hotel.thumbnail})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                      />
                      <div className="sk-resultMain">
                        <div className="sk-resultTop">
                          <div>
                            <div className="sk-resultTitle">{hotel.name}</div>
                            <div className="sk-resultMeta">
                              {hotel.address && (
                                <span className="sk-metaItem">
                                  <EnvironmentOutlined /> {hotel.address}
                                </span>
                              )}
                              {hotel.stars && (
                                <>
                                  <span className="sk-metaDot">·</span>
                                  <span className="sk-metaItem">
                                    {hotel.stars}★
                                  </span>
                                </>
                              )}
                              {hotel.rating && (
                                <>
                                  <span className="sk-metaDot">·</span>
                                  <span className="sk-metaItem">
                                    {hotel.rating}/10
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="sk-pickedWhy">
                              {hotel.roomName}
                              {hotel.boardName ? ` · ${hotel.boardName}` : ""}
                            </div>
                          </div>
                          <div className="sk-resultRight">
                            <div className="sk-priceLine">
                              <span className="sk-priceAmt">
                                ${hotel.totalAmount?.toFixed(0) ?? "—"}
                              </span>
                              <span className="sk-priceSub">
                                {hotel.totalCurrency}
                              </span>
                            </div>
                            {(() => {
                              const nights =
                                hotel.checkin && hotel.checkout
                                  ? dayjs(hotel.checkout).diff(
                                      dayjs(hotel.checkin),
                                      "day"
                                    )
                                  : 0;
                              const total = Number(hotel.totalAmount);
                              if (!(nights > 0) || !Number.isFinite(total))
                                return null;
                              return (
                                <div className="sk-pernight">
                                  ${Math.round(total / nights).toLocaleString()}
                                  /night · {nights} night
                                  {nights !== 1 ? "s" : ""} total
                                </div>
                              );
                            })()}
                            <SaveTripButton
                              size="small"
                              variant="ghost"
                              label="Save"
                              tripData={{
                                tripType: "hotel",
                                title: hotel.name,
                                destination: hotel.address || destCity,
                                price: hotel.totalAmount ?? 0,
                                currency: hotel.totalCurrency || "USD",
                                startDate: hotel.checkin || "",
                                metadata: {
                                  hotelId: hotel.hotelId,
                                  offerId: hotel.offerId,
                                },
                              }}
                              onSaveError={(msg) => antdMessage.error(msg)}
                            />
                            {/* Quantity stepper once at least one is in the cart —
                              replaces the old binary "Add Room"/"Added" toggle,
                              which blocked adding a second identical room (e.g.
                              a group wanting two of the same room type) and read
                              as "already added" rather than a real quantity. */}
                            {inCart ? (
                              <div
                                className="sk-room-stepper"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="sk-room-stepper-btn"
                                  onClick={() => removeRoomFromCart(hotel)}
                                  aria-label="Remove one of this room"
                                >
                                  −
                                </button>
                                <span className="sk-room-stepper-count">
                                  {countInCart}
                                </span>
                                <button
                                  type="button"
                                  className="sk-room-stepper-btn"
                                  onClick={() => addRoomToCart(hotel)}
                                  aria-label="Add another of this room"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="sk-add-room-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addRoomToCart(hotel);
                                }}
                                title="Add this room for another traveler"
                              >
                                <PlusOutlined
                                  style={{
                                    marginRight: 4,
                                    verticalAlign: "middle",
                                  }}
                                />
                                Add Room
                              </button>
                            )}
                            <Button
                              className="sk-btn-orange"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBookSingleRoom(hotel);
                              }}
                            >
                              Book Now
                            </Button>
                          </div>
                        </div>
                        <div className="sk-tagRow">
                          {hotel.refundableTag === "RFN" && (
                            <span className="sk-tag sk-tag-good">
                              Refundable
                            </span>
                          )}
                          {hotel.refundableTag === "NRFN" && (
                            <span className="sk-tag sk-tag-orange">
                              Non-refundable
                            </span>
                          )}
                          {hotel.roomCount > 1 && (
                            <span className="sk-tag sk-tag-xp">
                              <Users
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />
                              {hotel.roomCount} rooms in this rate
                            </span>
                          )}
                          {groupHotelId && hotel.hotelId === groupHotelId && (
                            <span className="sk-tag sk-tag-xp">
                              <Users
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />
                              Your group's hotel
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {syncGroupId && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 10,
                        }}
                      >
                        <SuggestBtn kind="hotel" data={hotel} />
                        {syncInfo?.isOrganizer &&
                          hotel.hotelId !== groupHotelId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                makeGroupHotel(hotel);
                              }}
                              disabled={savingGroupHotel === hotel.hotelId}
                              style={{
                                background: "rgba(124,58,237,0.14)",
                                border: "1px solid rgba(124,58,237,0.4)",
                                color: "#fff",
                                borderRadius: 10,
                                padding: "7px 12px",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              {savingGroupHotel === hotel.hotelId
                                ? "Saving…"
                                : "Make this the group's hotel"}
                            </button>
                          )}
                      </div>
                    )}
                  </Card>
                );
              })}

            {tab === "Excursions" && (
              <ExcursionResults
                results={excursionResults}
                loading={isSearching}
                destination={destCity}
                renderAction={
                  syncGroupId
                    ? (ex) => <SuggestBtn kind="activity" data={ex} />
                    : undefined
                }
              />
            )}

            {!isSearching && tab === "Flights" && hasMore && (
              <div
                style={{ textAlign: "center", marginTop: 8, marginBottom: 28 }}
              >
                <button
                  type="button"
                  className="sk-view-more-btn"
                  onClick={() => setVisibleCount((c) => c + RESULTS_PER_PAGE)}
                >
                  <ArrowRight
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  View{" "}
                  {Math.min(
                    RESULTS_PER_PAGE,
                    flightDisplayCount - visibleCount
                  )}{" "}
                  more {hasReturnData ? "departing flights" : "flights"}
                  <span style={{ opacity: 0.4, marginLeft: 10, fontSize: 12 }}>
                    {visibleCount} of {flightDisplayCount}
                  </span>
                </button>
              </div>
            )}

            {!isSearching && tab === "Stays" && hotelHasMore && (
              <div
                style={{ textAlign: "center", marginTop: 8, marginBottom: 28 }}
              >
                <button
                  type="button"
                  className="sk-view-more-btn"
                  onClick={() => setVisibleCount((c) => c + RESULTS_PER_PAGE)}
                >
                  <ArrowRight
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  View{" "}
                  {Math.min(
                    RESULTS_PER_PAGE,
                    visibleHotels.length - visibleCount
                  )}{" "}
                  more rooms
                  <span style={{ opacity: 0.4, marginLeft: 10, fontSize: 12 }}>
                    {visibleCount} of {visibleHotels.length}
                  </span>
                </button>
              </div>
            )}

            {!isSearching &&
              tab === "Stays" &&
              hotelResults.length > 0 &&
              visibleHotels.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 24px",
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.8)",
                      marginBottom: 6,
                    }}
                  >
                    No rooms match these filters
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    Try a higher price or fewer filters.
                  </div>
                  <button
                    type="button"
                    className="sk-clear-filters-cta"
                    onClick={() => setHotelFilters(DEFAULT_HOTEL_FILTERS)}
                  >
                    Clear all filters
                  </button>
                </div>
              )}

            {!isSearching &&
              tab === "Flights" &&
              flightResults.length === 0 &&
              !autoSearchError &&
              !searchError && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "52px 24px",
                    color: "rgba(255,255,255,0.38)",
                    fontSize: 14,
                  }}
                >
                  <div style={{ marginBottom: 14 }}>
                    <PlaneIcon
                      size={40}
                      strokeWidth={1.25}
                      color="rgba(255,255,255,0.28)"
                    />
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 17,
                      color: "rgba(255,255,255,0.75)",
                      letterSpacing: "-0.01em",
                      marginBottom: 7,
                    }}
                  >
                    Ready when you are
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 300,
                      color: "rgba(255,255,255,0.38)",
                    }}
                  >
                    Select airports and dates above to search live flights
                  </div>
                </div>
              )}

            {!isSearching && tab === "Stays" && hotelResults.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "52px 24px",
                  color: "rgba(255,255,255,0.38)",
                  fontSize: 14,
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <IconHotel size={40} />
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 17,
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: "-0.01em",
                    marginBottom: 7,
                  }}
                >
                  Ready when you are
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 300,
                    color: "rgba(255,255,255,0.38)",
                  }}
                >
                  Enter a destination and dates above to search live hotel rates
                </div>
              </div>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <div ref={budgetRef}>
              <TripBudgetCard
                initialBookingTotal={selectedResult?.total ?? 0}
                initialTripDays={selectedNights}
                initialDestination={destCity}
                onStateChange={handleBudgetChange}
              />
            </div>
          </Col>
        </Row>
      </div>
    </>
  );
}
