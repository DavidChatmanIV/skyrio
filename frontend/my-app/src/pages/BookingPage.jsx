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
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Link, useSearchParams } from "react-router-dom";

import heroImg from "@/assets/Booking/skyrio-hero.jpg";
import "@/styles/BookingPage.css";

import BookingCheckout from "@/pages/booking/BookingCheckout";
import SaveTripButton from "@/components/trips/SaveTripButton";
import TripBudgetCard from "./booking/TripBudgetCard";
import AirportInput from "@/pages/booking/AirportInput";
import SmartFilterBar from "@/pages/booking/SmartFilterBar";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import { createNotification } from "@/services/notificationsService";
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

// ── Form-specific icons ──────────────────────────────────────
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

const DEFAULT_FILTERS = {
  price: "any",
  stops: "any",
  time: "any",
  airline: "any",
  xp: "any",
};

function getFlightXP(flight) {
  let xp = 40;
  if (flight.stops === 0) xp += 30;
  else if (flight.stops === 1) xp += 10;
  const price = parseFloat(flight.totalAmount);
  if (price < 300) xp += 20;
  else if (price < 600) xp += 10;
  return xp;
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
    if (filters.price !== "any" && price > filters.price) return false;
    if (filters.stops !== "any") {
      if (filters.stops === 2 && f.stops < 2) return false;
      if (filters.stops !== 2 && f.stops !== filters.stops) return false;
    }
    if (filters.time !== "any" && getFlightTimeSlot(f) !== filters.time)
      return false;
    if (filters.airline !== "any" && f.owner !== filters.airline) return false;
    if (filters.xp !== "any" && getFlightXP(f) < filters.xp) return false;
    return true;
  });
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
    sub: "Partly cloudy • Light wind",
  },
  newark: {
    label: "Newark",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 58° / 44°",
    sub: "Partly cloudy • Cool winds",
  },
  miami: {
    label: "Miami",
    Icon: WeatherMostlySunny,
    temp: "Avg 78° / 65°",
    sub: "Mostly sunny • Low rain risk",
  },
  paris: {
    label: "Paris",
    Icon: WeatherRainSun,
    temp: "Avg 59° / 46°",
    sub: "Occasional showers • Mild temps",
  },
  london: {
    label: "London",
    Icon: WeatherRainy,
    temp: "Avg 54° / 44°",
    sub: "Overcast • Bring an umbrella",
  },
  barcelona: {
    label: "Barcelona",
    Icon: WeatherPartlyCloudy,
    temp: "Avg 70° / 58°",
    sub: "Warm & breezy • Great for exploring",
  },
  rome: {
    label: "Rome",
    Icon: WeatherSunny,
    temp: "Avg 72° / 56°",
    sub: "Warm & sunny • Low humidity",
  },
  tokyo: {
    label: "Tokyo",
    Icon: WeatherCherryBlossom,
    temp: "Avg 68° / 55°",
    sub: "Mild & clear • Cherry blossom season",
  },
  japan: {
    label: "Japan",
    Icon: WeatherCherryBlossom,
    temp: "Avg 68° / 55°",
    sub: "Mild & clear • Cherry blossom season",
  },
  kyoto: {
    label: "Kyoto",
    Icon: WeatherCherryBlossom,
    temp: "Avg 67° / 54°",
    sub: "Cherry blossoms peak • Stunning season",
  },
  osaka: {
    label: "Osaka",
    Icon: WeatherCherryBlossom,
    temp: "Avg 66° / 53°",
    sub: "Mild & pleasant • Spring conditions",
  },
  seoul: {
    label: "Seoul",
    Icon: WeatherMostlySunny,
    temp: "Avg 60° / 46°",
    sub: "Clear & cool • Low humidity",
  },
  dubai: {
    label: "Dubai",
    Icon: WeatherSunny,
    temp: "Avg 95° / 78°",
    sub: "Hot & dry • Low humidity at night",
  },
  bali: {
    label: "Bali",
    Icon: WeatherTropical,
    temp: "Avg 84° / 72°",
    sub: "Tropical • Some afternoon showers",
  },
  bangkok: {
    label: "Bangkok",
    Icon: WeatherMostlySunny,
    temp: "Avg 92° / 78°",
    sub: "Very hot • Sunny with some clouds",
  },
  singapore: {
    label: "Singapore",
    Icon: WeatherRainSun,
    temp: "Avg 88° / 76°",
    sub: "Hot & humid • Daily showers",
  },
  "los angeles": {
    label: "Los Angeles",
    Icon: WeatherSunny,
    temp: "Avg 75° / 60°",
    sub: "Sunny all week • Low rain risk",
  },
  chicago: {
    label: "Chicago",
    Icon: WeatherWindy,
    temp: "Avg 55° / 42°",
    sub: "Windy with clear skies • Cool evenings",
  },
  "las vegas": {
    label: "Las Vegas",
    Icon: WeatherSunny,
    temp: "Avg 85° / 64°",
    sub: "Hot & dry • Clear skies",
  },
  cancun: {
    label: "Cancún",
    Icon: WeatherWaves,
    temp: "Avg 88° / 74°",
    sub: "Hot & humid • Perfect beach weather",
  },
  hawaii: {
    label: "Hawaii",
    Icon: WeatherHibiscus,
    temp: "Avg 82° / 70°",
    sub: "Sunny with trade winds • Ideal conditions",
  },
  sydney: {
    label: "Sydney",
    Icon: WeatherMostlySunny,
    temp: "Avg 72° / 60°",
    sub: "Mostly sunny • Comfortable",
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

// ── Tab bar ──────────────────────────────────
const PRIMARY_TABS = [
  { key: "Flights", label: "Flights" },
  { key: "Stays", label: "Stays" },
  { key: "Saved", label: "Saved" },
];

const MORE_TABS = [
  { key: "Cars", label: "Cars" },
  { key: "Excursions", label: "Excursions" },
  { key: "Packages", label: "Packages" },
  { key: "Last-Minute", label: "Last-Minute" },
];

function BookingTabBar({ value, onChange }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const isMoreActive = MORE_TABS.some((t) => t.key === value);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target))
        setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const handleSelect = (key) => {
    onChange(key);
    setMoreOpen(false);
  };

  return (
    <div className="sk-tab-bar">
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`sk-tab-btn${value === t.key ? " is-active" : ""}`}
          onClick={() => handleSelect(t.key)}
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
          onClick={() => setMoreOpen((v) => !v)}
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
        {moreOpen && (
          <div className="sk-tab-more-menu">
            {MORE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`sk-tab-more-item${
                  value === t.key ? " is-active" : ""
                }`}
                onClick={() => handleSelect(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trip type toggle ──────────────────────────
const TRIP_TYPES = [
  { key: "roundtrip", label: "Round trip" },
  { key: "oneway", label: "One way" },
  { key: "multi-city", label: "Multi-city" },
];

function TripTypeToggle({ value, onChange }) {
  return (
    <div className="sk-trip-type">
      {TRIP_TYPES.map(({ key, label }) => (
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

// ── Multi-city form ───────────────────────────
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

  const updateLeg = (index, patch) => {
    setLegs((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  };

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

  // Propagate last destination for weather strip
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
      // Build params for each leg individually and collect results
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
      const combined = results.flat();
      antdMessage.success(
        `Found ${combined.length} options across ${legs.length} flights`
      );
    } catch (err) {
      antdMessage.error(err.message || "Multi-city search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sk-search-bar sk-multicity-bar">
      {/* Legs */}
      <div className="sk-mc-legs">
        {legs.map((leg, index) => (
          <div key={leg.id} className="sk-mc-leg">
            {/* Leg number badge */}
            <div className="sk-mc-leg-badge">
              <span className="sk-mc-leg-num">{index + 1}</span>
              {index < legs.length - 1 && <div className="sk-mc-leg-line" />}
            </div>

            {/* Leg fields */}
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
                      // Auto-fill next leg's origin
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
                      // Must be after previous leg's date
                      if (index > 0 && legs[index - 1].date) {
                        return d.isBefore(legs[index - 1].date, "day");
                      }
                      return false;
                    }}
                    onChange={(date) => updateLeg(index, { date })}
                  />
                </div>

                {/* Remove leg button — only show when > 2 legs */}
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

      {/* Bottom controls row */}
      <div className="sk-mc-controls">
        <button
          type="button"
          className="sk-mc-add-btn"
          onClick={addLeg}
          disabled={legs.length >= 6}
        >
          <span className="sk-mc-add-icon">+</span>
          Add flight
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

// ── Search forms ──────────────────────────────
function FlightsForm({ onSearch, onDestChange, onDatesChange }) {
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

  const handleSearch = async () => {
    if (!originAirport)
      return antdMessage.warning("Select a departure airport");
    if (!destAirport)
      return antdMessage.warning("Select a destination airport");
    if (!dates[0]) return antdMessage.warning("Select a departure date");
    if (tripType === "roundtrip" && !dates[1])
      return antdMessage.warning("Select a return date, or switch to One way");

    setLoading(true);
    try {
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
      const res = await fetch(`${API}/api/flights/search?${params}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Search failed");
      onSearch(data.flights ?? []);
      antdMessage.success(`Found ${data.flights?.length ?? 0} flights`);
    } catch (err) {
      antdMessage.error(err.message || "Flight search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const newDestCity = originAirport?.city ?? null;
    setOriginAirport(destAirport);
    setDestAirport(originAirport);
    setOriginDisplay(destDisplay);
    setDestDisplay(originDisplay);
    if (newDestCity) onDestChange?.(newDestCity);
  };

  // Multi-city mode — hand off entirely to MultiCityForm
  if (tripType === "multi-city") {
    return (
      <div className="sk-search-bar">
        <div
          style={{
            flex: "0 0 100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
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
      <div
        style={{
          flex: "0 0 100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TripTypeToggle value={tripType} onChange={setTripType} />
      </div>

      <div className="sk-airport-pair">
        <AirportInput
          value={originDisplay}
          placeholder="From: City or airport"
          onChange={(ap) => {
            setOriginAirport(ap);
            setOriginDisplay(`${ap.city} (${ap.code})`);
          }}
        />
        <button
          type="button"
          className="sk-swap-btn"
          onClick={handleSwap}
          aria-label="Swap airports"
        >
          <SwapOutlined />
        </button>
        <AirportInput
          value={destDisplay}
          placeholder="To: City or airport"
          onChange={(ap) => {
            setDestAirport(ap);
            setDestDisplay(`${ap.city} (${ap.code})`);
            onDestChange?.(ap.city);
          }}
        />
      </div>

      {tripType === "roundtrip" ? (
        <SkyrioPicker
          className="sk-orange-picker"
          onChange={handleDatesChange}
          placeholder={["Depart", "Return"]}
          disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
        />
      ) : (
        <DatePicker
          className="sk-orange-picker"
          placeholder="Departure date"
          disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
          onChange={(date) => {
            const nd = [date, null];
            setDates(nd);
            onDatesChange?.({ dates: nd, nights: null });
          }}
        />
      )}

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
  );
}

function StaysForm({ onDestChange, onDatesChange }) {
  const handleDatesChange = useCallback(
    (v) => {
      const nd = v ?? [null, null];
      if (nd[0] && nd[1])
        onDatesChange?.({ dates: nd, nights: nd[1].diff(nd[0], "day") });
      else onDatesChange?.({ dates: nd, nights: null });
    },
    [onDatesChange]
  );

  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Where to? City or hotel"
        onChange={(ap) => onDestChange?.(ap.city)}
      />
      <SkyrioPicker
        className="sk-orange-picker"
        placeholder={["Check-in", "Check-out"]}
        onChange={handleDatesChange}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        defaultValue="2t1r"
        classNames={{ popup: { root: "sk-select-popup" } }}
      >
        <Option value="1t1r">1 traveler, 1 room</Option>
        <Option value="2t1r">2 travelers, 1 room</Option>
        <Option value="3t1r">3 travelers, 1 room</Option>
        <Option value="2t2r">2 travelers, 2 rooms</Option>
      </Select>
      <SearchBtn />
    </div>
  );
}

function CarsForm({ onDestChange }) {
  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Pick-up location"
        onChange={(ap) => onDestChange?.(ap.city)}
      />
      <AirportInput
        value=""
        placeholder="Drop-off (same as pick-up)"
        onChange={() => {}}
      />
      <SkyrioPicker
        className="sk-orange-picker"
        placeholder={["Pick-up date", "Drop-off date"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <SearchBtn />
    </div>
  );
}

function PackagesForm({ onDestChange, onDatesChange }) {
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");
  const [pkgOptions, setPkgOptions] = useState({
    stay: true,
    flight: true,
    car: false,
  });
  const toggle = (key) =>
    setPkgOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleDatesChange = useCallback(
    (v) => {
      const nd = v ?? [null, null];
      if (nd[0] && nd[1])
        onDatesChange?.({ dates: nd, nights: nd[1].diff(nd[0], "day") });
      else onDatesChange?.({ dates: nd, nights: null });
    },
    [onDatesChange]
  );

  const PKG_PILLS = [
    { key: "stay", Icon: IconHotel, label: "Stay" },
    { key: "flight", Icon: IconFlight, label: "Flight" },
    { key: "car", Icon: IconCar, label: "Car" },
  ];

  return (
    <div className="sk-search-bar">
      <div className="sk-search-bar-pills">
        {PKG_PILLS.map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            className={`sk-pkg-pill ${pkgOptions[key] ? "is-active" : ""}`}
            onClick={() => toggle(key)}
          >
            <Icon size={13} /> {label}
            {pkgOptions[key] ? " added" : ""}
          </button>
        ))}
      </div>
      <AirportInput
        value={originDisplay}
        placeholder="Leaving from"
        onChange={(ap) => setOriginDisplay(`${ap.city} (${ap.code})`)}
      />
      <AirportInput
        value={destDisplay}
        placeholder="Going to"
        onChange={(ap) => {
          setDestDisplay(`${ap.city} (${ap.code})`);
          onDestChange?.(ap.city);
        }}
      />
      <SkyrioPicker
        className="sk-orange-picker"
        onChange={handleDatesChange}
        placeholder={["Depart", "Return"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        defaultValue="2t1r"
        classNames={{ popup: { root: "sk-select-popup" } }}
      >
        <Option value="1t1r">1 traveler, 1 room</Option>
        <Option value="2t1r">2 travelers, 1 room</Option>
        <Option value="2t2r">2 travelers, 2 rooms</Option>
      </Select>
      <SearchBtn />
    </div>
  );
}

function ExcursionsForm({ onDestChange }) {
  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Destination city"
        onChange={(ap) => onDestChange?.(ap.city)}
      />
      <SkyrioPicker
        className="sk-orange-picker"
        placeholder={["Activity from", "Activity to"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <Select
        className="sk-select-cabin"
        defaultValue="any"
        classNames={{ popup: { root: "sk-select-popup" } }}
      >
        <Option value="any">Any category</Option>
        <Option value="tours">Tours</Option>
        <Option value="adventure">Adventure</Option>
        <Option value="food">Food & Drink</Option>
        <Option value="culture">Culture</Option>
        <Option value="wellness">Wellness</Option>
      </Select>
      <SearchBtn />
    </div>
  );
}

function LastMinuteForm() {
  return (
    <div className="sk-search-bar">
      <AirportInput value="" placeholder="Departing from" onChange={() => {}} />
      <Select
        className="sk-select-cabin"
        defaultValue="anywhere"
        classNames={{ popup: { root: "sk-select-popup" } }}
      >
        <Option value="anywhere">Anywhere</Option>
        <Option value="beach">Beach</Option>
        <Option value="city">City break</Option>
        <Option value="mountains">Mountains</Option>
        <Option value="theme">Theme parks</Option>
      </Select>
      <SkyrioPicker
        className="sk-orange-picker"
        placeholder={["This weekend", "Next weekend"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />
      <SearchBtn />
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

// ── Skeleton ──────────────────────────────────
function FlightSkeleton() {
  return (
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
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const { updateAtlasContext } = useAtlasContext();

  const fromCode = searchParams.get("from") || "EWR";

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

  const [tab, setTab] = useState(prefillData?.tab ?? "Flights");
  const [flightResults, setFlightResults] = useState([]);
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [autoSearchLoading, setAutoSearchLoading] = useState(false);
  const [autoSearchError, setAutoSearchError] = useState(null);
  const [destCity, setDestCity] = useState(prefillData?.destination ?? "");
  const [smartFilters, setSmartFilters] = useState(DEFAULT_FILTERS);
  const [aiInsightDismissed, setAiInsightDismissed] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);
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

  const [priceWatchOn, setPriceWatchOn] = useState(false);
  const [priceWatchRoute, setPriceWatchRoute] = useState(null);
  const [watchingId, setWatchingId] = useState(null);

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
      if (watchingId === flight.id) {
        setWatchingId(null);
        antdMessage.info("Stopped watching this flight.");
        return;
      }
      setWatchingId(flight.id);
      const price = parseFloat(flight.totalAmount);
      const route = {
        from: flight.origin,
        to: flight.destination,
        price,
        flightId: flight.id,
        airline: flight.owner,
      };
      setPriceWatchRoute(route);
      setPriceWatchOn(true);
      try {
        await createNotification({
          type: "price_watch",
          event: "flight_price_watch",
          title: "Watching flight price",
          message: `Alert set for ${flight.owner} ${flight.origin} → ${
            flight.destination
          } at $${price.toFixed(0)}.`,
          targetType: "flight",
          targetId: flight.id,
          metadata: route,
        });
        antdMessage.success(
          `Watching $${price.toFixed(0)} — you'll be notified if it drops!`
        );
      } catch {
        antdMessage.info("Price watch set — alerts coming soon.");
      }
    },
    [watchingId]
  );

  const handleDatesChange = useCallback(({ nights }) => {
    if (nights !== null && nights > 0) {
      setSelectedNights(nights);
      setBudgetState((prev) => ({ ...prev, tripDays: nights }));
    }
  }, []);

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

  // Auto-search on mount when prefillData has an IATA code
  useEffect(() => {
    if (!prefillData?.iata || autoSearchDone) return;
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
    () => applyFilters(flightResults, smartFilters),
    [flightResults, smartFilters]
  );
  const paginatedFlights = useMemo(
    () => visibleFlights.slice(0, visibleCount),
    [visibleFlights, visibleCount]
  );
  const hasMore = visibleCount < visibleFlights.length;

  const activeFilterCount = useMemo(
    () => Object.values(smartFilters).filter((v) => v !== "any").length,
    [smartFilters]
  );

  useEffect(() => {
    setVisibleCount(RESULTS_PER_PAGE);
  }, [flightResults, smartFilters]);

  const weather = useMemo(() => getWeatherForCity(destCity), [destCity]);
  const weatherTitle = weather.label
    ? `${weather.label}${weather.temp ? `  ·  ${weather.temp}` : ""}`
    : "Select a destination";

  const heroRoute = destCity ? `${fromCode} → ${destCity}` : "Where to next?";
  const heroNights = selectedNights
    ? `${selectedNights} night${selectedNights !== 1 ? "s" : ""}`
    : "";

  const quickFilters = useMemo(
    () => ["Under $500", "Luxury", "Unwind", "Adventure", "Romantic"],
    []
  );
  const [activeFilters, setActiveFilters] = useState([]);
  const toggleFilter = (label) =>
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  const clearFilters = () => setActiveFilters([]);

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

  const searchFormProps = {
    onDestChange: setDestCity,
    onDatesChange: handleDatesChange,
  };

  const searchForm = useMemo(() => {
    switch (tab) {
      case "Flights":
        return (
          <FlightsForm
            onSearch={(f) => {
              setFlightResults(f);
              setSmartFilters(DEFAULT_FILTERS);
              setVisibleCount(RESULTS_PER_PAGE);
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
          />
        );
      case "Stays":
        return <StaysForm {...searchFormProps} />;
      case "Cars":
        return <CarsForm onDestChange={setDestCity} />;
      case "Saved":
        return <SavedForm />;
      case "Excursions":
        return <ExcursionsForm onDestChange={setDestCity} />;
      case "Packages":
        return <PackagesForm {...searchFormProps} />;
      case "Last-Minute":
        return <LastMinuteForm />;
      default:
        return null;
    }
  }, [tab, handleDatesChange]);

  const resultsTitle = autoSearchLoading
    ? "Searching flights…"
    : visibleFlights.length > 0
    ? `${visibleFlights.length} Flight${
        visibleFlights.length !== 1 ? "s" : ""
      } Found${activeFilterCount > 0 ? " (filtered)" : ""}`
    : flightResults.length > 0
    ? "No flights match your filters"
    : "Results";

  if (showCheckout && selectedFlight) {
    return (
      <BookingCheckout
        flight={selectedFlight}
        onBack={() => {
          setShowCheckout(false);
          setSelectedFlight(null);
        }}
      />
    );
  }

  return (
    <div className="sk-booking" style={{ "--sk-bg-image": `url(${heroImg})` }}>
      <div className="sk-booking-hero">
        {/* ── Hero headline ── */}
        <Title className="sk-hero-title">
          Lock in your{" "}
          <span className="sk-hero-title-accent">next adventure.</span>
        </Title>

        {/* ── Trip state card ── */}
        <div className="sk-tripState">
          <div className="sk-tripRoute">{heroRoute}</div>
          <div className="sk-tripMeta">
            {heroNights && `${heroNights}  ·  `}
            {weather.sub}
            {destCity && "  ·  Best value window"}
          </div>
          <div className="sk-tripAssist">
            {autoSearchLoading
              ? "Searching live flights for you…"
              : autoSearchDone && flightResults.length > 0
              ? `Found ${flightResults.length} flights — scroll down to pick`
              : destCity
              ? "Smart Plan found great options for you"
              : "Enter your destination to get started"}
          </div>

          {/* Prefill strip */}
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

          {/* Pills row */}
          <Space size={8} className="sk-hero-pills">
            <div className="sk-pill sk-pill-orange">
              <Zap
                size={12}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />
              XP 60
            </div>

            {!aiInsightDismissed ? (
              <div className="sk-ai-insight-pill">
                <span className="sk-ai-insight-icon">
                  <Zap size={13} />
                </span>
                <span className="sk-ai-insight-text">
                  <strong>AI Insight:</strong> Prices expected to rise +$40
                </span>
                <button
                  type="button"
                  className="sk-ai-insight-dismiss"
                  onClick={() => setAiInsightDismissed(true)}
                  aria-label="Dismiss insight"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sk-pill sk-pill-glass"
                onClick={() => setAiInsightDismissed(false)}
              >
                <Zap
                  size={12}
                  style={{ marginRight: 4, verticalAlign: "middle" }}
                />{" "}
                AI Insight
              </button>
            )}

            <button
              type="button"
              className={`sk-pill sk-pill-glass sk-pill-toggle${
                priceWatchOn ? " is-active" : ""
              }`}
              onClick={handlePriceWatchToggle}
            >
              {priceWatchOn ? (
                <>
                  <Bell
                    size={12}
                    style={{ marginRight: 4, verticalAlign: "middle" }}
                  />{" "}
                  Price Watch On
                </>
              ) : (
                <>
                  <BellOff
                    size={12}
                    style={{ marginRight: 4, verticalAlign: "middle" }}
                  />{" "}
                  Price Watch Off
                </>
              )}
            </button>
          </Space>
        </div>

        <Text className="sk-hero-sub">
          Smart Plan AI helps balance budget, comfort, and XP.
        </Text>

        {/* ── Tab bar ── */}
        <BookingTabBar
          value={tab}
          onChange={(val) => {
            setTab(val);
            setFlightResults([]);
            setSmartFilters(DEFAULT_FILTERS);
            setActiveFilters([]);
            setVisibleCount(RESULTS_PER_PAGE);
          }}
        />

        {/* ── Weather strip ── */}
        <div className="sk-weatherStrip">
          <div className="sk-weatherInner">
            <div className="sk-weatherTop">
              <span className="sk-weatherIcon">
                <weather.Icon size={20} />
              </span>
              <span>{weatherTitle}</span>
            </div>
            <div className="sk-weatherSub">{weather.sub}</div>
          </div>
        </div>

        {/* ── Search form ── */}
        {searchForm}

        {/* ── Smart filter bar ── */}
        <SmartFilterBar
          filters={smartFilters}
          onChange={setSmartFilters}
          flightResults={flightResults}
          visible={tab === "Flights"}
        />

        {/* ── Action row ── */}
        <Space className="sk-action-row" wrap>
          <Button className="sk-btn-orange">Sort: Recommended</Button>
          <Link to="/sync-together">
            <Button className="sk-btn-sync" icon={<SyncOutlined />}>
              Sync Together
            </Button>
          </Link>
          {visibleFlights.length > 0 && (
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

        {/* ── Quick filters ── */}
        {tab === "Flights" && (
          <Space className="sk-filters" wrap>
            {quickFilters.map((f) => (
              <button
                key={f}
                type="button"
                className={`sk-qf${
                  activeFilters.includes(f) ? " is-active" : ""
                }`}
                onClick={() => toggleFilter(f)}
              >
                {f}
              </button>
            ))}
            {activeFilters.length > 0 && (
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
      </div>

      {/* ═══════════════════════════════════
          RESULTS + BUDGET
      ═══════════════════════════════════ */}
      <Row gutter={[24, 24]} className="sk-results-wrap">
        <Col xs={24} lg={16}>
          {/* Results header */}
          <div className="sk-resultsHeader">
            <Title level={4} className="sk-section-title">
              {resultsTitle}
            </Title>
            <div className="sk-resultsSub">
              {autoSearchLoading
                ? `Searching ${fromCode} → ${
                    prefillData?.iata ?? destCity
                  } · today +14 days`
                : visibleFlights.length > 0
                ? `Sorted by price · ${fromCode} → ${
                    prefillData?.iata ?? destCity
                  }${
                    activeFilterCount > 0
                      ? ` · ${activeFilterCount} filter${
                          activeFilterCount > 1 ? "s" : ""
                        } active`
                      : ""
                  }`
                : flightResults.length > 0 && visibleFlights.length === 0
                ? "Try relaxing your filters to see more results"
                : "Search above to find flights."}
            </div>
            {!autoSearchLoading &&
              flightResults.length > 0 &&
              visibleFlights.length === 0 && (
                <button
                  type="button"
                  className="sk-clear-filters-cta"
                  onClick={() => setSmartFilters(DEFAULT_FILTERS)}
                >
                  Clear all filters
                </button>
              )}
          </div>

          {/* Loading skeleton */}
          {autoSearchLoading && <FlightSkeleton />}

          {/* Error state */}
          {!autoSearchLoading && autoSearchError && (
            <div className="sk-search-error">
              <IconWarning size={14} /> {autoSearchError} —{" "}
              <button
                type="button"
                className="sk-search-retry"
                onClick={() => {
                  setAutoSearchDone(false);
                  setAutoSearchError(null);
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Flight results */}
          {!autoSearchLoading &&
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
                  <div className="sk-thumb" />
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
                            {flight.stops === 0
                              ? "Nonstop"
                              : `${flight.stops} stop${
                                  flight.stops > 1 ? "s" : ""
                                }`}
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
                            setSelectedFlight(flight);
                            setShowCheckout(true);
                            handleSelectResult({
                              id: flight.id,
                              title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                              total: parseFloat(flight.totalAmount),
                            });
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
              </Card>
            ))}

          {/* Load more */}
          {!autoSearchLoading && hasMore && (
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
                  visibleFlights.length - visibleCount
                )}{" "}
                more flights
                <span style={{ opacity: 0.4, marginLeft: 10, fontSize: 12 }}>
                  {visibleCount} of {visibleFlights.length}
                </span>
              </button>
            </div>
          )}

          {/* Empty state */}
          {!autoSearchLoading &&
            flightResults.length === 0 &&
            !autoSearchError && (
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
        </Col>

        {/* Budget sidebar */}
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
  );
}
