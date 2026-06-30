/**
 * HeroPlanner.jsx
 * Appears on BookingPage when a trip type is selected.
 * Shows: dynamic headline, budget slider, destination chips,
 * departure city picker, and two CTAs.
 */

import { useState, useMemo } from "react";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import AirportInput from "@/pages/booking/AirportInput";

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

const TRIP_DESTINATIONS = {
  solo: [
    { name: "Lisbon", iata: "LIS", cost: 650, vibe: "Culture & Cafés" },
    { name: "Medellín", iata: "MDE", cost: 480, vibe: "Adventure" },
    { name: "Bangkok", iata: "BKK", cost: 750, vibe: "Food & Temples" },
    { name: "Prague", iata: "PRG", cost: 580, vibe: "Architecture" },
    { name: "Mexico City", iata: "MEX", cost: 320, vibe: "Food & Art" },
    { name: "Budapest", iata: "BUD", cost: 590, vibe: "Nightlife" },
    { name: "Bali", iata: "DPS", cost: 900, vibe: "Wellness" },
    { name: "Tokyo", iata: "NRT", cost: 1100, vibe: "Urban Explorer" },
    { name: "Bogotá", iata: "BOG", cost: 420, vibe: "Off the Path" },
    { name: "Vietnam", iata: "SGN", cost: 850, vibe: "Backpacker Friendly" },
  ],
  romantic: [
    { name: "Paris", iata: "CDG", cost: 850, vibe: "Classic Romance" },
    { name: "Santorini", iata: "JTR", cost: 1100, vibe: "Sunset Views" },
    { name: "Tulum", iata: "CUN", cost: 580, vibe: "Boho Luxury" },
    { name: "Florence", iata: "FLR", cost: 820, vibe: "Art & Wine" },
    { name: "Bali", iata: "DPS", cost: 900, vibe: "Intimate Retreat" },
    { name: "Kyoto", iata: "KIX", cost: 1100, vibe: "Peaceful & Beautiful" },
    { name: "Maldives", iata: "MLE", cost: 1400, vibe: "Overwater Luxury" },
    { name: "Amalfi", iata: "NAP", cost: 950, vibe: "Coastal Charm" },
    { name: "Barcelona", iata: "BCN", cost: 780, vibe: "Vibrant & Warm" },
    { name: "Prague", iata: "PRG", cost: 580, vibe: "Fairytale City" },
  ],
  family: [
    { name: "Cancún", iata: "CUN", cost: 680, vibe: "Beach & Resorts" },
    { name: "Orlando", iata: "MCO", cost: 320, vibe: "Theme Parks" },
    { name: "Punta Cana", iata: "PUJ", cost: 620, vibe: "All-Inclusive" },
    { name: "Costa Rica", iata: "SJO", cost: 750, vibe: "Nature & Wildlife" },
    { name: "Puerto Rico", iata: "SJU", cost: 480, vibe: "Beach + Culture" },
    { name: "Hawaii", iata: "HNL", cost: 1200, vibe: "Island Paradise" },
    { name: "London", iata: "LHR", cost: 1100, vibe: "History & Museums" },
    { name: "Bahamas", iata: "NAS", cost: 720, vibe: "Crystal Waters" },
    { name: "Paris", iata: "CDG", cost: 950, vibe: "Magic & Wonder" },
    { name: "San Diego", iata: "SAN", cost: 380, vibe: "Zoo & Beaches" },
  ],
  group: [
    { name: "Cancún", iata: "CUN", cost: 580, vibe: "Party & Beach" },
    { name: "Las Vegas", iata: "LAS", cost: 280, vibe: "Non-Stop Fun" },
    { name: "Tulum", iata: "CUN", cost: 620, vibe: "Chill & Explore" },
    { name: "Medellín", iata: "MDE", cost: 480, vibe: "Adventure" },
    { name: "Lisbon", iata: "LIS", cost: 750, vibe: "Culture & Nightlife" },
    { name: "Amsterdam", iata: "AMS", cost: 880, vibe: "Iconic City Break" },
    { name: "Miami", iata: "MIA", cost: 320, vibe: "Beaches & Vibes" },
    { name: "Tokyo", iata: "NRT", cost: 1100, vibe: "Epic Experience" },
    { name: "Barcelona", iata: "BCN", cost: 780, vibe: "Sun & Culture" },
    { name: "New Orleans", iata: "MSY", cost: 350, vibe: "Food & Music" },
  ],
};

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
      budget ? ` with a $${budget.toLocaleString()} budget` : ""
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

const SLIDER_STYLES = `
  .sk-hero-slider {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    height: 4px;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .sk-hero-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ff8a2a;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(255,138,42,0.5);
  }
  .sk-hero-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ff8a2a;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(255,138,42,0.5);
  }
  .sk-dest-chip:hover {
    border-color: rgba(255,138,42,0.5) !important;
    background: rgba(255,138,42,0.08) !important;
  }
  .sk-hero-manual-btn:hover {
    background: rgba(255,255,255,0.08) !important;
    color: #fff !important;
  }
  @keyframes heroFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export default function HeroPlanner({ onDestinationSelect, onSearchManually }) {
  // ── All hooks first — no early returns before this block ──
  const { atlasContext, updateAtlasContext, sendAtlasMessage } =
    useAtlasContext();
  const { tripType } = atlasContext;

  const [heroBudget, setHeroBudget] = useState(1500);
  const [selectedDest, setSelectedDest] = useState(null);
  const [departureAirport, setDepartureAirport] = useState(null);
  const [departureDisplay, setDepartureDisplay] = useState("");

  const headline = TRIP_HEADLINES[tripType] || null;

  const destinations = useMemo(() => {
    if (!tripType) return [];
    const all = TRIP_DESTINATIONS[tripType] || [];
    return all.filter((d) => d.cost <= heroBudget);
  }, [tripType, heroBudget]);

  // ── Safe to return early now — all hooks above ──
  if (!tripType || !headline) return null;

  const handleChipClick = (dest) => {
    const isDeselecting =
      selectedDest?.name === dest.name && selectedDest?.iata === dest.iata;
    if (isDeselecting) {
      setSelectedDest(null);
      updateAtlasContext({ destination: null });
      onDestinationSelect?.(null, null);
    } else {
      setSelectedDest(dest);
      updateAtlasContext({ destination: dest.name, budget: heroBudget });
      onDestinationSelect?.(dest.name, dest.iata);
    }
  };

  const handlePlanWithAtlas = () => {
    updateAtlasContext({ budget: heroBudget });
    const fromLabel = departureAirport
      ? `${departureAirport.city} (${departureAirport.code})`
      : null;
    const prompt = ATLAS_PROMPTS[tripType]?.(
      selectedDest?.name,
      heroBudget,
      fromLabel
    );
    if (prompt) sendAtlasMessage(prompt);
  };

  const sliderPct = ((heroBudget - 200) / 4800) * 100;

  const planBtnLabel = () => {
    if (selectedDest && departureAirport)
      return `Plan ${departureAirport.code} → ${selectedDest.name} with Atlas`;
    if (selectedDest) return `Plan ${selectedDest.name} with Atlas`;
    if (departureAirport)
      return `Plan from ${departureAirport.code} with Atlas`;
    return "Plan with Atlas";
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: "20px 20px 18px",
        borderRadius: 16,
        background: "rgba(255,138,42,0.05)",
        border: "1px solid rgba(255,138,42,0.15)",
        animation: "heroFadeIn 0.3s ease forwards",
      }}
    >
      <style>{SLIDER_STYLES}</style>

      {/* Headline */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            marginBottom: 4,
          }}
        >
          {headline.title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          {headline.sub}
        </div>
      </div>

      {/* Budget Slider */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              fontWeight: 600,
            }}
          >
            Budget per person
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#ff8a2a" }}>
            ${heroBudget.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={200}
          max={5000}
          step={100}
          value={heroBudget}
          onChange={(e) => {
            setHeroBudget(Number(e.target.value));
            setSelectedDest(null);
            updateAtlasContext({ destination: null });
            onDestinationSelect?.(null, null);
          }}
          className="sk-hero-slider"
          style={{
            background: `linear-gradient(to right, #ff8a2a ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%)`,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 5,
          }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
            $200
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
            $5,000
          </span>
        </div>
      </div>

      {/* Destination Chips */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {destinations.length > 0
            ? `${destinations.length} destination${
                destinations.length !== 1 ? "s" : ""
              } within budget`
            : "No destinations match — try increasing your budget"}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 6,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {destinations.map((dest) => {
            const isSelected =
              selectedDest?.name === dest.name &&
              selectedDest?.iata === dest.iata;
            return (
              <button
                key={`${dest.name}-${dest.iata}`}
                type="button"
                onClick={() => handleChipClick(dest)}
                className="sk-dest-chip"
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 3,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: isSelected
                    ? "1px solid #ff8a2a"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: isSelected
                    ? "rgba(255,138,42,0.14)"
                    : "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  minWidth: 110,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isSelected ? "#ff8a2a" : "#fff",
                  }}
                >
                  {dest.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.3,
                  }}
                >
                  {dest.vibe}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isSelected ? "#ff8a2a" : "rgba(255,138,42,0.7)",
                    marginTop: 3,
                  }}
                >
                  ~${dest.cost.toLocaleString()}
                </span>
              </button>
            );
          })}

          {destinations.length === 0 && (
            <div
              style={{
                color: "rgba(255,255,255,0.25)",
                fontSize: 13,
                padding: "10px 0",
                whiteSpace: "nowrap",
              }}
            >
              Slide the budget up to see destinations ↑
            </div>
          )}
        </div>
      </div>

      {/* Departure City */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Where are you flying from?
        </div>
        <AirportInput
          value={departureDisplay}
          placeholder="Search departure city or airport"
          onChange={(ap) => {
            setDepartureAirport(ap);
            setDepartureDisplay(`${ap.city} (${ap.code})`);
          }}
        />
        {departureAirport && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                background: "rgba(255,138,42,0.12)",
                border: "1px solid rgba(255,138,42,0.3)",
                fontSize: 12,
                fontWeight: 600,
                color: "#ff8a2a",
              }}
            >
              ✈ {departureAirport.code} — {departureAirport.city}
            </span>
            <button
              type="button"
              onClick={() => {
                setDepartureAirport(null);
                setDepartureDisplay("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.25)",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={handlePlanWithAtlas}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #ff8a2a, #e0621a)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 20px rgba(255,138,42,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <span>✦</span>
          {planBtnLabel()}
        </button>

        <button
          type="button"
          onClick={onSearchManually}
          className="sk-hero-manual-btn"
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s",
          }}
        >
          Search manually ↓
        </button>
      </div>
    </div>
  );
}
