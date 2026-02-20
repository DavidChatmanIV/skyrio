import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button } from "antd";
import {
  SearchOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import "@/styles/LandingPage.css";
import heroBg from "@/assets/landing/skyrio-cosmic.jpg";

export default function LandingPage() {
  const nav = useNavigate();
  const [q, setQ] = useState(
    "10-day Japan trip under $2,500 with cherry blossoms"
  );
  const [showSuggestion, setShowSuggestion] = useState(true);

  const suggestion = useMemo(() => {
    // Keep this simple for launch. Mock it.
    // Later: replace with real AI call.
    return {
      title: "Skyrio AI Suggestion",
      trip: "Tokyo + Kyoto",
      dates: "April 5–15",
      total: 1462,
      fit: "Excellent budget match",
    };
  }, []);

  const examples = useMemo(
    () => [
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
        subtitle: "under $600",
        meta: "",
        img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=70",
      },
      {
        key: "paris",
        title: "Paris Luxury",
        subtitle: "Honeymoon",
        meta: "",
        img: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1200&q=70",
      },
    ],
    []
  );

  function goPlan() {
    setShowSuggestion(true);
    nav(`/book?prompt=${encodeURIComponent(q || "")}`);
  }

  function viewPlan() {
    nav(`/book?plan=tokyo-kyoto&prompt=${encodeURIComponent(q || "")}`);
  }

  return (
    <div className="sk-landing" style={{ "--sk-hero-bg": `url(${heroBg})` }}>
      {/* Background layer uses --sk-hero-bg from inline style above */}
      <div className="sk-landing__bg" />

      <div className="sk-landing__content">
        {/* HERO */}
        <header className="sk-hero">
          <h1 className="sk-hero__title">
            Plan smarter.
            <br />
            Travel better.
          </h1>

          <p className="sk-hero__sub">
            Your entire trip, built in seconds by Skyrio AI.
          </p>

          <div className="sk-hero__search">
            <Input
              size="large"
              prefix={<SearchOutlined />}
              value={q}
              onChange={(e) => {
                const next = e.target.value;
                setQ(next);
                setShowSuggestion(next.trim().length >= 8);
              }}
              onPressEnter={goPlan}
              placeholder='Try: "Japan in April under $2500"'
              className="sk-searchInput"
            />
            <Button
              size="large"
              type="primary"
              className="sk-cta"
              onClick={goPlan}
            >
              Plan my trip
            </Button>
          </div>

          {/* AI SUGGESTION (minimal) */}
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
                    — {suggestion.dates}
                  </span>
                </div>
                <div className="sk-suggestion__fit">{suggestion.fit}</div>
              </div>

              <div className="sk-suggestion__right">
                <div className="sk-suggestion__total">
                  ${suggestion.total.toLocaleString()} <span>total</span>
                </div>

                <Button className="sk-viewBtn" onClick={viewPlan}>
                  View plan <ArrowRightOutlined />
                </Button>
              </div>
            </div>
          </section>
        </header>

        {/* EXAMPLES */}
        <section className="sk-examples">
          <h2 className="sk-examples__title">See what Skyrio can do</h2>

          <div className="sk-examples__grid">
            {examples.map((c) => (
              <button
                key={c.key}
                className="sk-card"
                onClick={() => nav(`/book?example=${c.key}`)}
                type="button"
              >
                <div
                  className="sk-card__media"
                  style={{ backgroundImage: `url(${c.img})` }}
                />
                <div className="sk-card__overlay" />
                <div className="sk-card__content">
                  <div className="sk-card__title">{c.title}</div>
                  <div className="sk-card__subtitle">{c.subtitle}</div>
                  {c.meta ? (
                    <div className="sk-card__meta">{c.meta}</div>
                  ) : null}
                  <div className="sk-card__footer">
                    <span>View Plan</span>
                    <ArrowRightOutlined />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="sk-footline">
            Travel planning shouldn’t feel stressful. Skyrio makes it feel
            effortless.
          </p>
        </section>
      </div>
    </div>
  );
}