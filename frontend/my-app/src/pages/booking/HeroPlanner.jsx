/**
 * Appears on BookingPage when a trip type is selected.
 *
 * Order (what the prices depend on comes first):
 *   1. Flying from — prefilled with the traveler's home airport
 *   2. Budget — slider, or tap the amount to type an exact number
 *   3. Destination ideas — scrollable cards with arrows + edge fade
 *   4. CTAs — Plan with Atlas / Search flights to <city>
 *
 * Props
 *   initialBudget       number   starting budget (default 1500)
 *   onDestinationSelect (city|null, iata|null)
 *   onOriginSelect      (airport|null)        → keeps the pass's FROM in sync
 *   onBudgetChange      (number)              → keeps the pass's BUDGET in sync
 *   onSearchManually    ({ origin, dest })    → scroll + prefill the search form
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import AirportInput from "@/pages/booking/AirportInput";
import { readHomeAirport, fetchHomeAirport } from "@/lib/homeAirport";

const MIN_BUDGET = 200;
const MAX_BUDGET = 5000;
const BUDGET_STEP = 100;

const clampBudget = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 1500;
  return Math.min(MAX_BUDGET, Math.max(MIN_BUDGET, v));
};

// "Newark (EWR)" — or just "EWR" when the city is unknown.
const airportLabel = (ap) => {
  if (!ap?.code) return "";
  const city = String(ap.city || "").trim();
  return city && city.toUpperCase() !== ap.code.toUpperCase()
    ? `${city} (${ap.code})`
    : ap.code;
};

const TRIP_HEADLINES = {
  solo: {
    title: "Your solo adventure starts here.",
    sub: "Just you, the world, and your own pace.",
  },
  romantic: {
    title: "Plan your perfect getaway for two.",
    sub: "Unforgettable moments, beautifully planned.",
  },
  family: {
    title: "A trip the whole family will love.",
    sub: "Kid-friendly, stress-free, and full of memories.",
  },
  group: {
    title: "Get the whole crew together.",
    sub: "Easy coordination, maximum fun.",
  },
};

// ── Fare estimates ─────────────────────────────────────────────
// What each number MEANS (this exact wording is shown on the page):
//   typical round-trip economy fare, per person,
//   from New York-area airports (EWR / JFK / LGA).
// It is NOT a live price, and it does NOT include hotels or anything else.
// One number per airport, so the same city never shows two prices
// (Cancún and Tulum share CUN, so they share a fare).
// Re-check these every few months (e.g. Google Flights "Explore" from NYC)
// and update FARES_CHECKED to the month you checked.
const FARES_CHECKED = "Oct 2026";
const NYC_AREA_AIRPORTS = ["EWR", "JFK", "LGA", "NYC"];
const ROUND_TRIP_FARE_FROM_NYC = {
  LIS: 750,
  MDE: 480,
  BKK: 750,
  PRG: 580,
  MEX: 320,
  BUD: 590,
  DPS: 900,
  NRT: 1100,
  BOG: 420,
  SGN: 850,
  CDG: 950,
  JTR: 1100,
  CUN: 680,
  FLR: 820,
  KIX: 1100,
  MLE: 1400,
  NAP: 950,
  BCN: 780,
  MCO: 320,
  PUJ: 620,
  SJO: 750,
  SJU: 480,
  HNL: 1200,
  LHR: 1100,
  NAS: 720,
  SAN: 380,
  LAS: 280,
  AMS: 880,
  MIA: 320,
  MSY: 350,
};

const DESTINATION_IDEAS = {
  solo: [
    { name: "Lisbon", iata: "LIS", vibe: "Culture & Cafés" },
    { name: "Medellín", iata: "MDE", vibe: "Adventure" },
    { name: "Bangkok", iata: "BKK", vibe: "Food & Temples" },
    { name: "Prague", iata: "PRG", vibe: "Architecture" },
    { name: "Mexico City", iata: "MEX", vibe: "Food & Art" },
    { name: "Budapest", iata: "BUD", vibe: "Nightlife" },
    { name: "Bali", iata: "DPS", vibe: "Wellness" },
    { name: "Tokyo", iata: "NRT", vibe: "Urban Explorer" },
    { name: "Bogotá", iata: "BOG", vibe: "Off the Path" },
    { name: "Ho Chi Minh City", iata: "SGN", vibe: "Backpacker Friendly" },
  ],
  romantic: [
    { name: "Paris", iata: "CDG", vibe: "Classic Romance" },
    { name: "Santorini", iata: "JTR", vibe: "Sunset Views" },
    { name: "Tulum", iata: "CUN", vibe: "Boho Luxury" },
    { name: "Florence", iata: "FLR", vibe: "Art & Wine" },
    { name: "Bali", iata: "DPS", vibe: "Intimate Retreat" },
    { name: "Kyoto", iata: "KIX", vibe: "Peaceful & Beautiful" },
    { name: "Maldives", iata: "MLE", vibe: "Overwater Luxury" },
    { name: "Amalfi Coast", iata: "NAP", vibe: "Coastal Charm" },
    { name: "Barcelona", iata: "BCN", vibe: "Vibrant & Warm" },
    { name: "Prague", iata: "PRG", vibe: "Fairytale City" },
  ],
  family: [
    { name: "Cancún", iata: "CUN", vibe: "Beach & Resorts" },
    { name: "Orlando", iata: "MCO", vibe: "Theme Parks" },
    { name: "Punta Cana", iata: "PUJ", vibe: "All-Inclusive" },
    { name: "Costa Rica", iata: "SJO", vibe: "Nature & Wildlife" },
    { name: "Puerto Rico", iata: "SJU", vibe: "Beach + Culture" },
    { name: "Hawaii", iata: "HNL", vibe: "Island Paradise" },
    { name: "London", iata: "LHR", vibe: "History & Museums" },
    { name: "Bahamas", iata: "NAS", vibe: "Crystal Waters" },
    { name: "Paris", iata: "CDG", vibe: "Magic & Wonder" },
    { name: "San Diego", iata: "SAN", vibe: "Zoo & Beaches" },
  ],
  group: [
    { name: "Cancún", iata: "CUN", vibe: "Party & Beach" },
    { name: "Las Vegas", iata: "LAS", vibe: "Non-Stop Fun" },
    { name: "Tulum", iata: "CUN", vibe: "Chill & Explore" },
    { name: "Medellín", iata: "MDE", vibe: "Adventure" },
    { name: "Lisbon", iata: "LIS", vibe: "Culture & Nightlife" },
    { name: "Amsterdam", iata: "AMS", vibe: "Iconic City Break" },
    { name: "Miami", iata: "MIA", vibe: "Beaches & Vibes" },
    { name: "Tokyo", iata: "NRT", vibe: "Epic Experience" },
    { name: "Barcelona", iata: "BCN", vibe: "Sun & Culture" },
    { name: "New Orleans", iata: "MSY", vibe: "Food & Music" },
  ],
};

// Attach the fare to each idea (null if we don't have one).
const TRIP_DESTINATIONS = Object.fromEntries(
  Object.entries(DESTINATION_IDEAS).map(([type, list]) => [
    type,
    list.map((d) => ({ ...d, cost: ROUND_TRIP_FARE_FROM_NYC[d.iata] ?? null })),
  ])
);

const ATLAS_PROMPTS = {
  solo: (dest, budget, from) =>
    `I'm planning a solo trip${dest ? ` to ${dest}` : ""}${
      from ? ` departing from ${from}` : ""
    }${
      budget ? ` with a $${budget.toLocaleString()} budget` : ""
    }. What are my best options and where should I start?`,
  romantic: (dest, budget, from) =>
    `I'm planning a romantic trip for two${dest ? ` to ${dest}` : ""}${
      from ? ` departing from ${from}` : ""
    }${
      budget ? ` with a $${budget.toLocaleString()} per person budget` : ""
    }. What should we focus on and how can you help us plan it?`,
  family: (dest, budget, from) =>
    `I'm planning a family trip with kids${dest ? ` to ${dest}` : ""}${
      from ? ` departing from ${from}` : ""
    }${
      budget ? ` with a $${budget.toLocaleString()} per person budget` : ""
    }. What should I keep in mind and how can you help?`,
  group: (dest, budget, from) =>
    `I'm planning a group trip with friends${dest ? ` to ${dest}` : ""}${
      from ? ` departing from ${from}` : ""
    }${
      budget ? ` with a $${budget.toLocaleString()} per person budget` : ""
    }. What's the best way to coordinate and what would you suggest?`,
};

const STYLES = `
  .sk-hp {
    width: 100%;
    box-sizing: border-box;
    margin-top: 16px;
    padding: 20px 20px 18px;
    border-radius: 16px;
    background: rgba(255,138,42,0.05);
    border: 1px solid rgba(255,138,42,0.15);
    animation: heroFadeIn 0.3s ease forwards;
  }
  .sk-hp-title {
    font-size: 17px; font-weight: 700; color: #fff;
    font-family: 'Syne', sans-serif; margin-bottom: 4px;
  }
  .sk-hp-sub { font-size: 13px; color: rgba(255,255,255,0.62); }
  .sk-hp-section { margin-bottom: 18px; }
  .sk-hp-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.68);
    margin-bottom: 8px;
  }
  .sk-hp-home {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 700; letter-spacing: .03em;
    padding: 2px 8px; border-radius: 20px;
    color: #ff8a2a; background: rgba(255,138,42,0.12);
    border: 1px solid rgba(255,138,42,0.3);
  }
  .sk-hp-clear {
    margin-left: auto; background: none; border: none; padding: 0;
    color: rgba(255,255,255,0.55); font-size: 11px; cursor: pointer;
    font-family: inherit;
  }
  .sk-hp-clear:hover { color: #fff; }

  /* Budget */
  .sk-hp-budget-head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .sk-hp-budget-amt {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: 1px dashed transparent; border-radius: 8px;
    padding: 2px 6px; margin-right: -6px;
    font-size: 15px; font-weight: 700; color: #ff8a2a;
    cursor: text; font-family: inherit;
  }
  .sk-hp-budget-amt:hover, .sk-hp-budget-amt:focus-visible {
    border-color: rgba(255,138,42,0.5); outline: none;
  }
  .sk-hp-budget-amt small { font-size: 11px; opacity: .7; font-weight: 600; }
  .sk-hp-budget-input {
    width: 110px; padding: 4px 8px; border-radius: 8px;
    border: 1px solid #ff8a2a; background: rgba(0,0,0,0.25);
    color: #fff; font-size: 15px; font-weight: 700; text-align: right;
    font-family: inherit; outline: none;
  }
  .sk-hero-slider {
    width: 100%; appearance: none; -webkit-appearance: none;
    height: 4px; border-radius: 2px; outline: none; cursor: pointer;
  }
  .sk-hero-slider:focus-visible { box-shadow: 0 0 0 3px rgba(255,138,42,0.35); }
  .sk-hero-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
    background: #ff8a2a; cursor: pointer; border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(255,138,42,0.5);
  }
  .sk-hero-slider::-moz-range-thumb {
    width: 20px; height: 20px; border-radius: 50%;
    background: #ff8a2a; cursor: pointer; border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(255,138,42,0.5);
  }
  .sk-hp-range {
    display: flex; justify-content: space-between; margin-top: 6px;
    font-size: 11px; color: rgba(255,255,255,0.5);
  }

  /* Destination row */
  .sk-hp-row-wrap { position: relative; }
  .sk-hp-row {
    display: flex; gap: 8px; width: 100%; box-sizing: border-box;
    overflow-x: auto; padding: 2px 2px 6px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .sk-hp-row::-webkit-scrollbar { display: none; }
  .sk-hp-row.fade-right {
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
            mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
  }
  .sk-hp-row.fade-left {
    -webkit-mask-image: linear-gradient(to right, transparent, #000 48px);
            mask-image: linear-gradient(to right, transparent, #000 48px);
  }
  .sk-hp-row.fade-left.fade-right {
    -webkit-mask-image: linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent);
            mask-image: linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent);
  }
  .sk-hp-arrow {
    position: absolute; top: 50%; transform: translateY(-60%);
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(20,14,32,0.92); color: #fff;
    border: 1px solid rgba(255,255,255,0.18);
    box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    cursor: pointer; z-index: 2; font-size: 16px; line-height: 1;
    font-family: inherit;
  }
  .sk-hp-arrow:hover { border-color: #ff8a2a; color: #ff8a2a; }
  .sk-hp-arrow--left { left: -6px; }
  .sk-hp-arrow--right { right: -6px; }

  .sk-dest-chip {
    position: relative; flex-shrink: 0; scroll-snap-align: start;
    display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
    min-width: 118px; padding: 11px 14px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    cursor: pointer; font-family: inherit; text-align: left;
    transition: border-color .15s, background .15s, transform .15s;
  }
  .sk-dest-chip:hover {
    border-color: rgba(255,138,42,0.5); background: rgba(255,138,42,0.08);
  }
  .sk-dest-chip:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
  .sk-dest-chip.is-selected {
    border-color: #ff8a2a; background: rgba(255,138,42,0.14);
  }
  .sk-dest-name { font-size: 13px; font-weight: 700; color: #fff; }
  .sk-dest-chip.is-selected .sk-dest-name { color: #ff8a2a; }
  .sk-dest-vibe { font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.3; }
  .sk-dest-cost {
    margin-top: 3px; font-size: 12px; font-weight: 700; color: #ffa257;
  }
  .sk-dest-cost small { font-size: 10px; font-weight: 600; opacity: .75; margin-left: 4px; }
  .sk-dest-cost--muted { color: rgba(255,255,255,0.55); font-weight: 600; font-size: 11px; }
  .sk-dest-check {
    position: absolute; top: 8px; right: 8px;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: #ff8a2a; color: #fff; font-size: 11px; font-weight: 800;
  }
  /* "Cheapest" sits on the price line, so it never covers the city name. */
  .sk-dest-tag {
    display: inline-block; margin-left: 6px; vertical-align: 1px;
    font-size: 9px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    padding: 1px 5px; border-radius: 5px;
    color: #4ade80; background: rgba(74,222,128,0.12);
    border: 1px solid rgba(74,222,128,0.3);
  }
  /* Room for the ✓ badge so a long name doesn't run under it. */
  .sk-dest-chip.is-selected { padding-right: 32px; }
  .sk-hp-note {
    margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.5);
  }
  .sk-hp-empty {
    color: rgba(255,255,255,0.55); font-size: 13px; padding: 10px 0;
  }

  /* CTAs */
  .sk-hero-cta-row { display: flex; gap: 10px; }
  .sk-hp-cta {
    flex: 1; padding: 12px 16px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #ff8a2a, #e0621a); color: #fff;
    font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 20px rgba(255,138,42,0.3);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: opacity .15s;
  }
  .sk-hp-cta:hover { opacity: .9; }
  .sk-hero-manual-btn {
    flex: 1; padding: 12px 16px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.82);
    font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all .15s;
  }
  .sk-hero-manual-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

  @keyframes heroFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 560px) {
    .sk-hero-cta-row { flex-direction: column; }
    .sk-hero-cta-row > button { width: 100%; }
  }
  @media (max-width: 480px) {
    .sk-hp { padding: 16px 14px 14px; }
    .sk-dest-chip { min-width: 104px; padding: 10px 12px; }
    /* Phones swipe — the fade alone signals there's more. */
    .sk-hp-arrow { display: none; }
  }
`;

export default function HeroPlanner({
  initialBudget = 1500,
  onDestinationSelect,
  onOriginSelect,
  onBudgetChange,
  onSearchManually,
}) {
  // ── All hooks first — no early returns before this block ──
  const { atlasContext, updateAtlasContext, sendAtlasMessage } =
    useAtlasContext();
  const { tripType } = atlasContext;

  const [heroBudget, setHeroBudget] = useState(() =>
    clampBudget(initialBudget)
  );
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [selectedDest, setSelectedDest] = useState(null);

  // Flying from: starts on the saved home airport.
  const [homeAirport, setHomeAirport] = useState(readHomeAirport);
  const [departureAirport, setDepartureAirport] = useState(
    () => readHomeAirport() || null
  );
  const [departureDisplay, setDepartureDisplay] = useState(() =>
    airportLabel(readHomeAirport())
  );
  const userTouchedOrigin = useRef(false);

  // New device: nothing saved in this browser, so ask the account.
  useEffect(() => {
    if (homeAirport) return;
    let alive = true;
    fetchHomeAirport()
      .then(({ homeAirport: ap } = {}) => {
        if (!alive || !ap) return;
        setHomeAirport(ap);
        if (!userTouchedOrigin.current) {
          setDepartureAirport(ap);
          setDepartureDisplay(airportLabel(ap));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the boarding pass in sync.
  useEffect(() => {
    onOriginSelect?.(departureAirport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureAirport]);

  useEffect(() => {
    if (tripType) onBudgetChange?.(heroBudget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroBudget, tripType]);

  // The fares are from New York-area airports. From anywhere else they'd be
  // wrong, so we hide them (and don't filter by them) instead of guessing.
  const faresApply =
    !departureAirport?.code ||
    NYC_AREA_AIRPORTS.includes(departureAirport.code.toUpperCase());

  const destinations = useMemo(() => {
    if (!tripType) return [];
    const all = TRIP_DESTINATIONS[tripType] || [];
    if (!faresApply) return all;
    return all.filter((d) => d.cost != null && d.cost <= heroBudget);
  }, [tripType, heroBudget, faresApply]);

  const lowestCost = useMemo(
    () =>
      faresApply && destinations.length > 1
        ? Math.min(...destinations.map((d) => d.cost))
        : null,
    [destinations, faresApply]
  );

  const clearDest = useCallback(() => {
    setSelectedDest(null);
    updateAtlasContext({ destination: null });
    onDestinationSelect?.(null, null);
  }, [updateAtlasContext, onDestinationSelect]);

  // Switching trip type swaps the list — drop a pick from the old list.
  const prevTripType = useRef(tripType);
  useEffect(() => {
    if (prevTripType.current !== tripType) {
      prevTripType.current = tripType;
      if (selectedDest) clearDest();
      scrollerRef.current?.scrollTo({ left: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripType]);

  // Scroll arrows + edge fade.
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, destinations, tripType]);

  // ── Safe to return early now — all hooks above ──
  const headline = TRIP_HEADLINES[tripType] || null;
  if (!tripType || !headline) return null;

  const isSolo = tripType === "solo";

  const applyBudget = (value) => {
    const next = clampBudget(value);
    setHeroBudget(next);
    // Keep the pick if it still fits; only drop it if it doesn't.
    if (faresApply && selectedDest && selectedDest.cost > next) clearDest();
  };

  const startBudgetEdit = () => {
    setBudgetDraft(String(heroBudget));
    setEditingBudget(true);
  };
  const commitBudgetEdit = () => {
    const n = Number(String(budgetDraft).replace(/[^\d]/g, ""));
    if (n) applyBudget(n);
    setEditingBudget(false);
  };

  const scrollRow = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const handleChipClick = (dest) => {
    const isDeselecting =
      selectedDest?.name === dest.name && selectedDest?.iata === dest.iata;
    if (isDeselecting) {
      clearDest();
    } else {
      setSelectedDest(dest);
      updateAtlasContext({ destination: dest.name, budget: heroBudget });
      onDestinationSelect?.(dest.name, dest.iata);
    }
  };

  const handlePlanWithAtlas = () => {
    updateAtlasContext({ budget: heroBudget });
    const fromLabel = departureAirport ? airportLabel(departureAirport) : null;
    const prompt = ATLAS_PROMPTS[tripType]?.(
      selectedDest?.name,
      heroBudget,
      fromLabel
    );
    if (prompt) sendAtlasMessage(prompt);
  };

  const sliderPct =
    ((heroBudget - MIN_BUDGET) / (MAX_BUDGET - MIN_BUDGET)) * 100;

  const planBtnLabel = () => {
    if (selectedDest && departureAirport)
      return `Plan ${departureAirport.code} → ${selectedDest.name} with Atlas`;
    if (selectedDest) return `Plan ${selectedDest.name} with Atlas`;
    if (departureAirport)
      return `Plan from ${departureAirport.code} with Atlas`;
    return "Plan with Atlas";
  };

  const isHomeOrigin =
    !!departureAirport?.code &&
    departureAirport.code.toUpperCase() === homeAirport?.code?.toUpperCase();

  const rowClass = [
    "sk-hp-row",
    edges.left ? "fade-left" : "",
    edges.right ? "fade-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="sk-hp">
      <style>{STYLES}</style>

      {/* Headline */}
      <div style={{ marginBottom: 18 }}>
        <div className="sk-hp-title">{headline.title}</div>
        <div className="sk-hp-sub">{headline.sub}</div>
      </div>

      {/* 1 · Flying from — first, because every price depends on it */}
      <div className="sk-hp-section">
        <div className="sk-hp-label">
          <span>Flying from</span>
          {isHomeOrigin && (
            <span className="sk-hp-home" title="Your home airport">
              ⌂ Home
            </span>
          )}
          {departureAirport && (
            <button
              type="button"
              className="sk-hp-clear"
              onClick={() => {
                userTouchedOrigin.current = true;
                setDepartureAirport(null);
                setDepartureDisplay("");
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
        <AirportInput
          value={departureDisplay}
          placeholder="Search departure city or airport"
          onChange={(ap) => {
            userTouchedOrigin.current = true;
            setDepartureAirport(ap);
            setDepartureDisplay(airportLabel(ap));
          }}
        />
      </div>

      {/* 2 · Budget */}
      <div className="sk-hp-section">
        <div className="sk-hp-budget-head">
          <label
            className="sk-hp-label"
            style={{ marginBottom: 0 }}
            htmlFor="sk-hp-slider"
          >
            {isSolo ? "Your budget" : "Budget per person"}
          </label>
          {editingBudget ? (
            <input
              autoFocus
              className="sk-hp-budget-input"
              inputMode="numeric"
              aria-label="Type your budget in dollars"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              onBlur={commitBudgetEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitBudgetEdit();
                if (e.key === "Escape") setEditingBudget(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="sk-hp-budget-amt"
              onClick={startBudgetEdit}
              aria-label={`Budget $${heroBudget.toLocaleString()}. Tap to type an exact amount`}
              title="Tap to type an exact amount"
            >
              ${heroBudget.toLocaleString()}
              <small aria-hidden="true">✎</small>
            </button>
          )}
        </div>
        <input
          id="sk-hp-slider"
          type="range"
          min={MIN_BUDGET}
          max={MAX_BUDGET}
          step={BUDGET_STEP}
          value={heroBudget}
          onChange={(e) => applyBudget(e.target.value)}
          className="sk-hero-slider"
          aria-valuetext={`$${heroBudget.toLocaleString()}`}
          style={{
            background: `linear-gradient(to right, #ff8a2a ${sliderPct}%, rgba(255,255,255,0.14) ${sliderPct}%)`,
          }}
        />
        <div className="sk-hp-range">
          <span>${MIN_BUDGET.toLocaleString()}</span>
          <span>${MAX_BUDGET.toLocaleString()}+</span>
        </div>
      </div>

      {/* 3 · Destination ideas */}
      <div style={{ marginBottom: 20 }}>
        <div className="sk-hp-label" aria-live="polite">
          {!faresApply
            ? "Destination ideas"
            : destinations.length > 0
            ? `${destinations.length} destination${
                destinations.length !== 1 ? "s" : ""
              } where the flight fits your budget`
            : "No flights fit this budget yet"}
        </div>

        <div className="sk-hp-row-wrap">
          {edges.left && (
            <button
              type="button"
              className="sk-hp-arrow sk-hp-arrow--left"
              onClick={() => scrollRow(-1)}
              aria-label="Show previous destinations"
            >
              ‹
            </button>
          )}

          <div
            ref={scrollerRef}
            className={rowClass}
            onScroll={updateEdges}
            role="group"
            aria-label="Destination ideas"
          >
            {destinations.map((dest) => {
              const isSelected =
                selectedDest?.name === dest.name &&
                selectedDest?.iata === dest.iata;
              const isLowest = !isSelected && dest.cost === lowestCost;
              return (
                <button
                  key={`${dest.name}-${dest.iata}`}
                  type="button"
                  onClick={() => handleChipClick(dest)}
                  className={`sk-dest-chip${isSelected ? " is-selected" : ""}`}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <span className="sk-dest-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  <span className="sk-dest-name">{dest.name}</span>
                  <span className="sk-dest-vibe">{dest.vibe}</span>
                  {faresApply ? (
                    <span className="sk-dest-cost">
                      Flight ~${dest.cost.toLocaleString()}
                      <small>round trip</small>
                      {isLowest && (
                        <span className="sk-dest-tag">Cheapest</span>
                      )}
                    </span>
                  ) : (
                    <span className="sk-dest-cost sk-dest-cost--muted">
                      Price shows when you search
                    </span>
                  )}
                </button>
              );
            })}

            {destinations.length === 0 && (
              <div className="sk-hp-empty">
                No round-trip flights in this list fit $
                {heroBudget.toLocaleString()} — slide the budget up to see more.
              </div>
            )}
          </div>

          {edges.right && (
            <button
              type="button"
              className="sk-hp-arrow sk-hp-arrow--right"
              onClick={() => scrollRow(1)}
              aria-label="Show more destinations"
            >
              ›
            </button>
          )}
        </div>

        {destinations.length > 0 && (
          <div className="sk-hp-note">
            {faresApply ? (
              <>
                Prices are typical round-trip economy fares per person from New
                York-area airports (EWR, JFK, LGA), checked {FARES_CHECKED}.
                They don&rsquo;t include hotels. Not a live price — you&rsquo;ll
                see real fares when you search.
              </>
            ) : (
              <>
                We don&rsquo;t have fare estimates from {departureAirport.code}{" "}
                yet, so these are ideas only. Search to see real prices.
              </>
            )}
          </div>
        )}
      </div>

      {/* 4 · CTAs */}
      <div className="sk-hero-cta-row">
        <button
          type="button"
          className="sk-hp-cta"
          onClick={handlePlanWithAtlas}
        >
          <span aria-hidden="true">✦</span>
          {planBtnLabel()}
        </button>

        <button
          type="button"
          onClick={() =>
            onSearchManually?.({
              origin: departureAirport,
              dest: selectedDest,
            })
          }
          className="sk-hero-manual-btn"
        >
          {selectedDest
            ? `Search flights to ${selectedDest.name} ↓`
            : "Search manually ↓"}
        </button>
      </div>
    </div>
  );
}
