/**
 * OnboardingModal.jsx
 *
 * 3-step post-registration onboarding flow.
 * Appears once for new users on their first visit to Passport.
 * Dismissed forever after completion or skip — stored in localStorage
 * and optionally synced to the API.
 *
 * Steps:
 *   1. Welcome — what Skyrio is, what they unlocked
 *   2. Home airport — sets localStorage + API so Book page auto-searches correctly
 *   3. Travel vibe — picks 1–3 interests so Atlas can personalise suggestions
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Select, Button, message } from "antd";
import "@/styles/OnboardingModal.css";

const { Option } = Select;

const STORAGE_KEY = "skyrio_onboarding_done";
const AIRPORT_KEY = "skyrio_home_airport";
const API = import.meta.env.VITE_API_URL || "";

// ── Same 30-airport list as LandingPage ──────────────────────
const COMMON_AIRPORTS = [
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

const TRAVEL_VIBES = [
  { key: "beach", emoji: "🏖", label: "Beach & sun" },
  { key: "city", emoji: "🏙", label: "City breaks" },
  { key: "adventure", emoji: "🏔", label: "Adventure" },
  { key: "culture", emoji: "🏛", label: "Culture & history" },
  { key: "food", emoji: "🍜", label: "Food & drink" },
  { key: "luxury", emoji: "✨", label: "Luxury" },
  { key: "budget", emoji: "💰", label: "Budget travel" },
  { key: "nature", emoji: "🌿", label: "Nature & wildlife" },
  { key: "roadtrip", emoji: "🚗", label: "Road trips" },
  { key: "family", emoji: "👨‍👩‍👧", label: "Family friendly" },
];

const TOTAL_STEPS = 3;

// ── Check if onboarding was already completed ─────────────────
function isOnboardingDone() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

// ── Step indicators ───────────────────────────────────────────
function StepDots({ current }) {
  return (
    <div className="ob-dots">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <span
          key={i}
          className={`ob-dot${
            i === current
              ? " ob-dot--active"
              : i < current
              ? " ob-dot--done"
              : ""
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 1: Welcome ───────────────────────────────────────────
function StepWelcome({ displayName, onNext }) {
  return (
    <div className="ob-step">
      <div className="ob-step__icon">✦</div>
      <h2 className="ob-step__title">Welcome aboard, {displayName}!</h2>
      <p className="ob-step__sub">
        Your Skyrio Passport is active. Here's what you just unlocked:
      </p>
      <div className="ob-perks">
        {[
          { icon: "⚡", text: "XP on every search, save, and booking" },
          { icon: "🏅", text: "Badges as you hit travel milestones" },
          { icon: "🤖", text: "Atlas AI — your personal trip planner" },
          { icon: "💰", text: "Redeem XP for real travel discounts" },
        ].map((p) => (
          <div key={p.text} className="ob-perk">
            <span className="ob-perk__icon">{p.icon}</span>
            <span className="ob-perk__text">{p.text}</span>
          </div>
        ))}
      </div>
      <button type="button" className="ob-btn ob-btn--primary" onClick={onNext}>
        Let's set you up →
      </button>
    </div>
  );
}

// ── Step 2: Home airport ──────────────────────────────────────
function StepAirport({ onNext, onSkip }) {
  const [selected, setSelected] = useState(() => {
    try {
      const raw = localStorage.getItem(AIRPORT_KEY);
      if (raw) return JSON.parse(raw)?.code || "EWR";
    } catch {}
    return "EWR";
  });

  const handleNext = () => {
    const ap = COMMON_AIRPORTS.find((a) => a.code === selected);
    if (ap) {
      try {
        localStorage.setItem(AIRPORT_KEY, JSON.stringify(ap));
      } catch {}
    }
    onNext({ homeAirport: ap });
  };

  return (
    <div className="ob-step">
      <div className="ob-step__icon">🛫</div>
      <h2 className="ob-step__title">Where do you fly from?</h2>
      <p className="ob-step__sub">
        We'll use this to auto-search flights from your home airport.
      </p>
      <Select
        value={selected}
        onChange={setSelected}
        showSearch
        optionFilterProp="children"
        filterOption={(input, option) =>
          String(option?.children || "")
            .toLowerCase()
            .includes(input.toLowerCase())
        }
        classNames={{ popup: { root: "ob-select-popup" } }}
        className="ob-airport-select"
        size="large"
      >
        {COMMON_AIRPORTS.map((ap) => (
          <Option key={ap.code} value={ap.code}>
            {ap.city} ({ap.code}) — {ap.name}
          </Option>
        ))}
      </Select>
      <div className="ob-actions">
        <button
          type="button"
          className="ob-btn ob-btn--primary"
          onClick={handleNext}
        >
          Save & continue →
        </button>
        <button type="button" className="ob-btn ob-btn--ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Travel vibe ───────────────────────────────────────
function StepVibes({ onDone, onSkip }) {
  const [selected, setSelected] = useState([]);

  const toggle = (key) => {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < 3
        ? [...prev, key]
        : prev
    );
  };

  return (
    <div className="ob-step">
      <div className="ob-step__icon">🎯</div>
      <h2 className="ob-step__title">What's your travel vibe?</h2>
      <p className="ob-step__sub">
        Pick up to 3 — Atlas will use these to personalise your suggestions.
      </p>
      <div className="ob-vibes">
        {TRAVEL_VIBES.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`ob-vibe${
              selected.includes(v.key) ? " ob-vibe--active" : ""
            }`}
            onClick={() => toggle(v.key)}
          >
            <span className="ob-vibe__emoji">{v.emoji}</span>
            <span className="ob-vibe__label">{v.label}</span>
          </button>
        ))}
      </div>
      {selected.length === 3 && (
        <p className="ob-vibe-hint">Max 3 selected — deselect one to change</p>
      )}
      <div className="ob-actions">
        <button
          type="button"
          className="ob-btn ob-btn--primary"
          onClick={() => onDone({ vibes: selected })}
          disabled={selected.length === 0}
        >
          {selected.length === 0 ? "Select at least one" : "Finish setup ✓"}
        </button>
        <button type="button" className="ob-btn ob-btn--ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function OnboardingModal({ user, token }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [collected, setCollected] = useState({});

  // ── Only show for new users who haven't completed onboarding ──
  useEffect(() => {
    if (isOnboardingDone()) return;
    // Small delay so the page settles first
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const displayName = useMemo(() => {
    if (!user) return "Traveler";
    return (
      user.name || user.username || user.email?.split("@")[0] || "Traveler"
    );
  }, [user]);

  const close = useCallback(() => {
    markOnboardingDone();
    setVisible(false);
  }, []);

  const handleNext = useCallback((data = {}) => {
    setCollected((prev) => ({ ...prev, ...data }));
    setStep((s) => s + 1);
  }, []);

  const handleSkip = useCallback(() => {
    setStep((s) => s + 1);
  }, []);

  // ── Final step: save everything to API ───────────────────────
  const handleDone = useCallback(
    async (data = {}) => {
      const final = { ...collected, ...data };
      setSaving(true);

      try {
        if (token) {
          // Save home airport to profile
          if (final.homeAirport) {
            await fetch(`${API}/api/profile/settings`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ homeAirport: final.homeAirport }),
            }).catch(() => {});
          }

          // Save travel vibes to profile
          if (final.vibes?.length) {
            await fetch(`${API}/api/profile/settings`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ travelVibes: final.vibes }),
            }).catch(() => {});
          }
        }

        message.success("You're all set! Welcome to Skyrio ✈️");
      } catch {
        // Silent — onboarding shouldn't block if API fails
      } finally {
        setSaving(false);
        close();
      }
    },
    [collected, token, close]
  );

  const handleFinalSkip = useCallback(() => {
    close();
  }, [close]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="ob-backdrop" onClick={close} aria-hidden="true" />

      {/* Modal */}
      <div
        className="ob-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Skyrio"
      >
        {/* Close */}
        <button
          type="button"
          className="ob-close"
          onClick={close}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Progress */}
        <StepDots current={step} />

        {/* Steps */}
        <div className="ob-body">
          {step === 0 && (
            <StepWelcome displayName={displayName} onNext={handleNext} />
          )}
          {step === 1 && (
            <StepAirport onNext={handleNext} onSkip={handleSkip} />
          )}
          {step === 2 && (
            <StepVibes onDone={handleDone} onSkip={handleFinalSkip} />
          )}
        </div>

        {saving && <div className="ob-saving">Saving your preferences…</div>}
      </div>
    </>
  );
}
