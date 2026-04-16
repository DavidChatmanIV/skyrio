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

export default function LandingPage() {
  const nav = useNavigate();
  const landingRef = useRef(null);

  // ── Time-aware background ──
  const [timePeriod, setTimePeriod] = useState(() =>
    getTimePeriod(new Date().getHours())
  );

  useEffect(() => {
    // Set data-time on the landing element
    if (landingRef.current) {
      landingRef.current.setAttribute("data-time", timePeriod);
    }
    // Refresh every minute
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

  return (
    <div
      className="sk-landing"
      ref={landingRef}
      data-time={timePeriod}
      style={{ "--sk-hero-bg": `url(${heroBg})` }}
    >
      <div className="sk-landing__bg" />

      {/* Time badge */}
      <div className="sk-time-badge">
        <span className="sk-time-dot" />
        {timeMeta.label} mode
      </div>

      <div className="sk-landing__content">
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
      </div>
    </div>
  );
}