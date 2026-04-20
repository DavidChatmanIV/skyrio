import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Typography,
  Space,
  Segmented,
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
  StarFilled,
  EnvironmentOutlined,
  LoadingOutlined,
  SwapOutlined,
  SyncOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Link, useSearchParams } from "react-router-dom";

import heroImg from "@/assets/Booking/skyrio-hero.jpg";
import "@/styles/BookingPage.css";

import SaveTripButton from "@/components/trips/SaveTripButton";
import TripBudgetCard from "./booking/TripBudgetCard";
import AirportInput from "@/pages/booking/AirportInput";
import SmartFilterBar from "@/pages/booking/SmartFilterBar";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

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

    if (filters.time !== "any" && getFlightTimeSlot(f) !== filters.time) {
      return false;
    }

    if (filters.airline !== "any" && f.owner !== filters.airline) {
      return false;
    }

    if (filters.xp !== "any" && getFlightXP(f) < filters.xp) {
      return false;
    }

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
  const departDate = dayjs().add(14, "day").format("YYYY-MM-DD");
  const returnDate = dayjs()
    .add(14 + tripDays, "day")
    .format("YYYY-MM-DD");
  return { departDate, returnDate };
}

const CITY_WEATHER = {
  "new york": {
    label: "New York",
    icon: "🌥",
    temp: "Avg 62° / 48°",
    sub: "Partly cloudy • Light wind",
  },
  miami: {
    label: "Miami",
    icon: "🌤",
    temp: "Avg 78° / 65°",
    sub: "Mostly sunny • Low rain risk",
  },
  paris: {
    label: "Paris",
    icon: "🌦",
    temp: "Avg 59° / 46°",
    sub: "Occasional showers • Mild temps",
  },
  london: {
    label: "London",
    icon: "🌧",
    temp: "Avg 54° / 44°",
    sub: "Overcast • Bring an umbrella",
  },
  barcelona: {
    label: "Barcelona",
    icon: "⛅",
    temp: "Avg 70° / 58°",
    sub: "Warm & breezy • Great for exploring",
  },
  rome: {
    label: "Rome",
    icon: "☀️",
    temp: "Avg 72° / 56°",
    sub: "Warm & sunny • Low humidity",
  },
  tokyo: {
    label: "Tokyo",
    icon: "🌸",
    temp: "Avg 68° / 55°",
    sub: "Mild & clear • Cherry blossom season",
  },
  japan: {
    label: "Japan",
    icon: "🌸",
    temp: "Avg 68° / 55°",
    sub: "Mild & clear • Cherry blossom season",
  },
  kyoto: {
    label: "Kyoto",
    icon: "🌸",
    temp: "Avg 67° / 54°",
    sub: "Cherry blossoms peak • Stunning season",
  },
  osaka: {
    label: "Osaka",
    icon: "🌸",
    temp: "Avg 66° / 53°",
    sub: "Mild & pleasant • Spring conditions",
  },
  seoul: {
    label: "Seoul",
    icon: "🌤",
    temp: "Avg 60° / 46°",
    sub: "Clear & cool • Low humidity",
  },
  dubai: {
    label: "Dubai",
    icon: "☀️",
    temp: "Avg 95° / 78°",
    sub: "Hot & dry • Low humidity at night",
  },
  bali: {
    label: "Bali",
    icon: "🌴",
    temp: "Avg 84° / 72°",
    sub: "Tropical • Some afternoon showers",
  },
  bangkok: {
    label: "Bangkok",
    icon: "🌤",
    temp: "Avg 92° / 78°",
    sub: "Very hot • Sunny with some clouds",
  },
  singapore: {
    label: "Singapore",
    icon: "🌦",
    temp: "Avg 88° / 76°",
    sub: "Hot & humid • Daily showers",
  },
  "los angeles": {
    label: "Los Angeles",
    icon: "☀️",
    temp: "Avg 75° / 60°",
    sub: "Sunny all week • Low rain risk",
  },
  chicago: {
    label: "Chicago",
    icon: "💨",
    temp: "Avg 55° / 42°",
    sub: "Windy with clear skies • Cool evenings",
  },
  "las vegas": {
    label: "Las Vegas",
    icon: "☀️",
    temp: "Avg 85° / 64°",
    sub: "Hot & dry • Clear skies",
  },
  cancun: {
    label: "Cancún",
    icon: "🌊",
    temp: "Avg 88° / 74°",
    sub: "Hot & humid • Perfect beach weather",
  },
  hawaii: {
    label: "Hawaii",
    icon: "🌺",
    temp: "Avg 82° / 70°",
    sub: "Sunny with trade winds • Ideal conditions",
  },
  sydney: {
    label: "Sydney",
    icon: "🌤",
    temp: "Avg 72° / 60°",
    sub: "Mostly sunny • Comfortable",
  },
};

const DEFAULT_WEATHER = {
  label: null,
  icon: "🌍",
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

  return {
    label: cityStr
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    icon: "🌍",
    temp: "",
    sub: "Weather data not available for this destination",
  };
}

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

function FlightsForm({ onSearch, onDestChange }) {
  const [originAirport, setOriginAirport] = useState(null);
  const [destAirport, setDestAirport] = useState(null);
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");
  const [dates, setDates] = useState([null, null]);
  const [cabin, setCabin] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!originAirport) {
      return antdMessage.warning("Select a departure airport");
    }
    if (!destAirport) {
      return antdMessage.warning("Select a destination airport");
    }
    if (!dates[0]) {
      return antdMessage.warning("Select a departure date");
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        from: originAirport.code,
        to: destAirport.code,
        departDate: dayjs(dates[0].toDate()).format("YYYY-MM-DD"),
        adults: String(adults),
        cabin,
      });

      if (dates[1]) {
        params.set("returnDate", dayjs(dates[1].toDate()).format("YYYY-MM-DD"));
      }

      const res = await fetch(`/api/flights/search?${params}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Search failed");
      }

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

  return (
    <div className="sk-search-bar">
      <div className="sk-airport-pair">
        <AirportInput
          value={originDisplay}
          placeholder="From: City or airport"
          onChange={(ap) => {
            setOriginAirport(ap);
            setOriginDisplay(`${ap.city} (${ap.code})`);
          }}
        />

        <button type="button" className="sk-swap-btn" onClick={handleSwap}>
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

      <RangePicker
        className="sk-orange-picker"
        onChange={(v) => setDates(v ?? [null, null])}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />

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

function StaysForm({ onDestChange }) {
  return (
    <div className="sk-search-bar">
      <AirportInput
        value=""
        placeholder="Where to? City or hotel"
        onChange={(ap) => onDestChange?.(ap.city)}
      />

      <RangePicker
        className="sk-orange-picker"
        placeholder={["Check-in", "Check-out"]}
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

      <RangePicker
        className="sk-orange-picker"
        placeholder={["Pick-up date", "Drop-off date"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />

      <SearchBtn />
    </div>
  );
}

function PackagesForm({ onDestChange }) {
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");
  const [pkgOptions, setPkgOptions] = useState({
    stay: true,
    flight: true,
    car: false,
  });

  const toggle = (key) => {
    setPkgOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="sk-search-bar">
      <div className="sk-search-bar-pills">
        {[
          ["stay", "🏨", "Stay"],
          ["flight", "✈", "Flight"],
          ["car", "🚗", "Car"],
        ].map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            className={`sk-pkg-pill ${pkgOptions[key] ? "is-active" : ""}`}
            onClick={() => toggle(key)}
          >
            {icon} {label}
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

      <RangePicker
        className="sk-orange-picker"
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

      <RangePicker
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
        <Option value="anywhere">✨ Anywhere</Option>
        <Option value="beach">🏖 Beach</Option>
        <Option value="city">🏙 City break</Option>
        <Option value="mountains">⛰ Mountains</Option>
        <Option value="theme">🎡 Theme parks</Option>
      </Select>

      <RangePicker
        className="sk-orange-picker"
        placeholder={["This weekend", "Next weekend"]}
        disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
      />

      <SearchBtn />
    </div>
  );
}

function SavedForm() {
  return (
    <div className="sk-search-bar" style={{ justifyContent: "center" }}>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
        💾 Your saved trips will appear in results below
      </Text>
    </div>
  );
}

function FlightSkeleton() {
  return (
    <div className="sk-flight-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="sk-skeleton-card">
          <div className="sk-skeleton-thumb sk-shimmer" />
          <div className="sk-skeleton-body">
            <div
              className="sk-skeleton-line sk-shimmer"
              style={{ width: "55%" }}
            />
            <div
              className="sk-skeleton-line sk-shimmer"
              style={{ width: "40%", marginTop: 8 }}
            />
            <div
              className="sk-skeleton-line sk-shimmer"
              style={{ width: "30%", marginTop: 8 }}
            />
          </div>
          <div className="sk-skeleton-price sk-shimmer" />
        </div>
      ))}
    </div>
  );
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const { updateAtlasContext } = useAtlasContext();

  const prefillData = useMemo(() => {
    const promptParam = searchParams.get("prompt");
    const planParam = searchParams.get("plan");
    const exampleParam = searchParams.get("example");

    if (exampleParam && EXAMPLE_PLANS[exampleParam]) {
      return { ...EXAMPLE_PLANS[exampleParam], source: "example" };
    }

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

  const [tab, setTab] = useState(prefillData?.tab ?? "Stays");
  const [flightResults, setFlightResults] = useState([]);
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [autoSearchLoading, setAutoSearchLoading] = useState(false);
  const [autoSearchError, setAutoSearchError] = useState(null);
  const [destCity, setDestCity] = useState(prefillData?.destination ?? "miami");

  const [smartFilters, setSmartFilters] = useState(DEFAULT_FILTERS);
  const [aiInsightDismissed, setAiInsightDismissed] = useState(false);
  const [priceWatchOn, setPriceWatchOn] = useState(false);

  const [budgetState, setBudgetState] = useState({
    planned: prefillData?.budget ?? null,
    used: 0,
    bookingTotal: 0,
    tripDays: prefillData?.tripDays ?? 3,
  });

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
  const [editDays, setEditDays] = useState(prefillData?.tripDays ?? 3);

  const budgetSeed = prefillData?.budget ?? null;
  const tripDaySeed = prefillData?.tripDays ?? 3;

  useEffect(() => {
    if (!prefillData?.iata || autoSearchDone) return;

    const { iata, tripDays: days = 10 } = prefillData;
    const { departDate, returnDate } = getAutoSearchDates(days);

    setAutoSearchLoading(true);
    setAutoSearchError(null);
    setTab("Flights");

    const params = new URLSearchParams({
      from: "EWR",
      to: iata,
      departDate,
      returnDate,
      adults: "1",
      cabin: "economy",
    });

    fetch(`/api/flights/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          throw new Error(data.message || "Search failed");
        }

        setFlightResults(data.flights ?? []);
        setAutoSearchDone(true);

        if (data.flights?.length) {
          antdMessage.success(
            `✈️ Found ${data.flights.length} flights to ${prefillData.destination}`
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
    if (newBudget) {
      setBudgetState((prev) => ({ ...prev, planned: newBudget }));
    }

    if (editDays) {
      setBudgetState((prev) => ({ ...prev, tripDays: editDays }));
    }

    setPrefillEditing(false);
    antdMessage.success("Trip details updated!");
  }, [editPrompt, editBudget, editDays, destCity]);

  const visibleFlights = useMemo(
    () => applyFilters(flightResults, smartFilters),
    [flightResults, smartFilters]
  );

  const activeFilterCount = useMemo(
    () => Object.values(smartFilters).filter((v) => v !== "any").length,
    [smartFilters]
  );

  const weather = useMemo(() => getWeatherForCity(destCity), [destCity]);

  const weatherTitle = weather.label
    ? `${weather.label} Weather${weather.temp ? ` • ${weather.temp}` : ""}`
    : "Select a destination";

  const heroRoute = destCity ? `New York → ${destCity}` : "New York → Miami";
  const heroNights = `${tripDaySeed} nights`;

  const quickFilters = useMemo(
    () => ["Under $500", "Luxury", "Unwind", "Adventure", "Romantic"],
    []
  );

  const [activeFilters, setActiveFilters] = useState(["Under $500"]);

  const toggleFilter = (label) => {
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const clearFilters = () => setActiveFilters([]);

  const [selectedResult, setSelectedResult] = useState({
    id: "stay-1",
    title: "Skyrio Select Stay – Deluxe",
    total: 168,
  });

  const handleSaveTrip = (src = "page") => {
    antdMessage.success(`Trip saved! (${src})`);
  };

  const rating = 4.7;
  const reviews = 1243;
  const bestFor = useMemo(
    () => ["Beach access", "Couples", "Great breakfast"],
    []
  );

  const handleSelectResult = useCallback((result) => {
    setSelectedResult(result);
    setBudgetState((prev) => ({ ...prev, bookingTotal: result.total ?? 0 }));
  }, []);

  const handleBudgetChange = useCallback((state) => {
    setBudgetState(state);
  }, []);

  const searchForm = useMemo(() => {
    const props = { onDestChange: setDestCity };

    switch (tab) {
      case "Flights":
        return (
          <FlightsForm
            onSearch={(f) => {
              setFlightResults(f);
              setSmartFilters(DEFAULT_FILTERS);
            }}
            onDestChange={setDestCity}
          />
        );
      case "Stays":
        return <StaysForm {...props} />;
      case "Cars":
        return <CarsForm {...props} />;
      case "Saved":
        return <SavedForm />;
      case "Excursions":
        return <ExcursionsForm {...props} />;
      case "Packages":
        return <PackagesForm {...props} />;
      case "Last-Minute":
        return <LastMinuteForm />;
      default:
        return null;
    }
  }, [tab]);

  const resultsTitle = autoSearchLoading
    ? "Searching flights…"
    : visibleFlights.length > 0
    ? `${visibleFlights.length} Flight${
        visibleFlights.length !== 1 ? "s" : ""
      } Found${activeFilterCount > 0 ? " (filtered)" : ""}`
    : flightResults.length > 0
    ? "No flights match your filters"
    : "Results";

  return (
    <div className="sk-booking" style={{ "--sk-bg-image": `url(${heroImg})` }}>
      <div className="sk-booking-hero">
        <Title className="sk-hero-title">
          Let's lock in your next adventure ✈️
        </Title>

        <div className="sk-tripState">
          <div className="sk-tripRoute">{heroRoute}</div>

          <div className="sk-tripMeta">
            {heroNights} • {weather.sub} • Best value window
          </div>

          <div className="sk-tripAssist">
            {autoSearchLoading
              ? "⏳ Searching live flights for you…"
              : autoSearchDone && flightResults.length > 0
              ? `✈️ Found ${flightResults.length} flights — scroll down to pick`
              : "Smart Plan found 4 great options for you"}
          </div>

          {prefillData && !prefillDismissed && (
            <div className="sk-prefill-strip">
              {!prefillEditing ? (
                <div className="sk-prefill-collapsed">
                  <span className="sk-prefill-bolt">⚡</span>
                  <span className="sk-prefill-loaded">Loaded from AI</span>
                  <span className="sk-prefill-divider">·</span>

                  {destCity && (
                    <span className="sk-prefill-chip">📍 {destCity}</span>
                  )}

                  {budgetSeed && (
                    <span className="sk-prefill-chip">
                      💰 ${budgetSeed.toLocaleString()}
                    </span>
                  )}

                  {tripDaySeed && (
                    <span className="sk-prefill-chip">🗓 {tripDaySeed}d</span>
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
                      <label className="sk-prefill-label">Days</label>
                      <InputNumber
                        className="sk-prefill-numInput"
                        value={editDays}
                        min={1}
                        max={60}
                        controls={false}
                        onChange={(v) => setEditDays(v ?? 3)}
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

          <Space size="middle" className="sk-hero-pills">
            <div className="sk-pill sk-pill-orange">⚡ XP 60</div>

            {!aiInsightDismissed ? (
              <div className="sk-ai-insight-pill">
                <span className="sk-ai-insight-icon">⚡</span>
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
                ⚡ AI Insight
              </button>
            )}

            <button
              type="button"
              className={`sk-pill sk-pill-glass sk-pill-toggle ${
                priceWatchOn ? "is-active" : ""
              }`}
              onClick={() => {
                setPriceWatchOn((p) => !p);
                antdMessage.info(
                  priceWatchOn
                    ? "Price Watch disabled"
                    : "Price Watch enabled — we'll alert you on drops!"
                );
              }}
            >
              {priceWatchOn ? "🔔 Price Watch On" : "🔕 Price Watch Off"}
            </button>
          </Space>
        </div>

        <Text className="sk-hero-sub">
          Smart Plan AI helps balance budget, comfort, and XP.
        </Text>

        <Segmented
          className="sk-booking-tabs sk-orange-segmented"
          value={tab}
          onChange={(val) => {
            setTab(val);
            setFlightResults([]);
            setSmartFilters(DEFAULT_FILTERS);
          }}
          options={[
            "Stays",
            "Flights",
            "Cars",
            "Saved",
            "Excursions",
            "Packages",
            "Last-Minute",
          ]}
        />

        <div className="sk-weatherStrip">
          <div className="sk-weatherInner">
            <div className="sk-weatherTop">
              <span className="sk-weatherIcon">{weather.icon}</span>
              <span className="sk-weatherTitle">{weatherTitle}</span>
            </div>
            <div className="sk-weatherSub">{weather.sub}</div>
          </div>
        </div>

        {searchForm}

        <SmartFilterBar
          filters={smartFilters}
          onChange={setSmartFilters}
          flightResults={flightResults}
          visible={tab === "Flights"}
        />

        <Space className="sk-action-row" wrap>
          <Button className="sk-btn-orange">Sort: Recommended</Button>

          <SaveTripButton onSaveConfirmed={() => handleSaveTrip("hero")} />

          <Link to="/sync-together">
            <Button className="sk-btn-sync" icon={<SyncOutlined />}>
              ✈️ Sync Together
            </Button>
          </Link>
        </Space>

        <Space className="sk-filters" wrap>
          {quickFilters.map((f) => (
            <button
              key={f}
              type="button"
              className={`sk-qf ${
                activeFilters.includes(f) ? "is-active" : ""
              }`}
              onClick={() => toggleFilter(f)}
            >
              {f}
            </button>
          ))}

          <button
            type="button"
            className="sk-qf sk-qf-clear"
            onClick={clearFilters}
          >
            Clear quick filters →
          </button>
        </Space>
      </div>

      <Row gutter={[24, 24]} className="sk-results-wrap">
        <Col xs={24} lg={16}>
          <div className="sk-resultsHeader">
            <Title level={4} className="sk-section-title">
              {resultsTitle}
            </Title>

            <div className="sk-resultsSub">
              {autoSearchLoading
                ? `Searching EWR → ${
                    prefillData?.iata ?? destCity
                  } • today +14 days`
                : visibleFlights.length > 0
                ? `Sorted by price • EWR → ${prefillData?.iata ?? destCity}${
                    activeFilterCount > 0
                      ? ` • ${activeFilterCount} filter${
                          activeFilterCount > 1 ? "s" : ""
                        } active`
                      : ""
                  }`
                : flightResults.length > 0 && visibleFlights.length === 0
                ? "Try relaxing your filters to see more results"
                : "Curated picks based on your budget + comfort preferences."}
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

          {autoSearchLoading && <FlightSkeleton />}

          {!autoSearchLoading && autoSearchError && (
            <div className="sk-search-error">
              ⚠️ {autoSearchError} —{" "}
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

          {!autoSearchLoading &&
            visibleFlights.length > 0 &&
            visibleFlights.map((flight) => (
              <Card
                key={flight.id}
                variant="borderless"
                className={`sk-result-card ${
                  selectedResult.id === flight.id ? "is-selected" : ""
                }`}
                onClick={() =>
                  handleSelectResult({
                    id: flight.id,
                    title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                    total: parseFloat(flight.totalAmount),
                  })
                }
                style={{ cursor: "pointer", marginBottom: 16 }}
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

                          <span className="sk-metaDot">•</span>

                          <span className="sk-metaItem">
                            {flight.stops === 0
                              ? "Nonstop"
                              : `${flight.stops} stop${
                                  flight.stops > 1 ? "s" : ""
                                }`}
                          </span>

                          {flight.departingAt && (
                            <>
                              <span className="sk-metaDot">•</span>
                              <span className="sk-metaItem">
                                {dayjs(flight.departingAt).format(
                                  "MMM D • h:mm A"
                                )}{" "}
                                → {dayjs(flight.arrivingAt).format("h:mm A")}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="sk-pickedWhy">
                          Why Skyrio picked this: best price + comfort score
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
                          onSaveConfirmed={() => handleSaveTrip("result")}
                        />
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
                        ⚡ {getFlightXP(flight)} XP
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

          {!autoSearchLoading &&
            flightResults.length === 0 &&
            !autoSearchError && (
              <Card
                variant="borderless"
                className={`sk-result-card ${
                  selectedResult.id === "stay-1" ? "is-selected" : ""
                }`}
                onClick={() =>
                  handleSelectResult({
                    id: "stay-1",
                    title: "Skyrio Select Stay – Deluxe",
                    total: 168,
                  })
                }
                style={{ cursor: "pointer" }}
              >
                <div className="sk-resultRow">
                  <div className="sk-thumb" />

                  <div className="sk-resultMain">
                    <div className="sk-resultTop">
                      <div>
                        <div className="sk-resultTitle">
                          Skyrio Select Stay – Deluxe
                        </div>

                        <div className="sk-resultMeta">
                          <span className="sk-metaItem">
                            <EnvironmentOutlined /> {heroRoute}
                          </span>

                          <span className="sk-metaDot">•</span>

                          <span className="sk-metaItem">
                            <StarFilled className="sk-star" /> {rating}
                            <span className="sk-reviews">
                              {" "}
                              ({reviews.toLocaleString()})
                            </span>
                          </span>
                        </div>

                        <div className="sk-pickedWhy">
                          Why Skyrio picked this: high rating + best value this
                          window
                        </div>
                      </div>

                      <div className="sk-resultRight">
                        <div className="sk-priceLine">
                          <span className="sk-priceAmt">$168</span>
                          <span className="sk-priceSub">total</span>
                        </div>

                        <SaveTripButton
                          size="small"
                          variant="ghost"
                          label="Save"
                          onSaveConfirmed={() => handleSaveTrip("result")}
                        />
                      </div>
                    </div>

                    <div className="sk-tagRow">
                      <span className="sk-tag sk-tag-good">Best Value</span>
                      <span className="sk-tag sk-tag-orange">
                        Free cancellation
                      </span>
                      <span className="sk-tag sk-tag-soft">No resort fee</span>
                    </div>

                    <div className="sk-bestFor">
                      <span className="sk-bestForLabel">Best for:</span>
                      {bestFor.map((t) => (
                        <span key={t} className="sk-tag sk-tag-bestfor">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
        </Col>

        <Col xs={24} lg={8}>
          <TripBudgetCard
            initialBookingTotal={selectedResult?.total ?? 0}
            initialTripDays={tripDaySeed}
            initialDestination={destCity}
            onStateChange={handleBudgetChange}
          />
        </Col>
      </Row>
    </div>
  );
}
