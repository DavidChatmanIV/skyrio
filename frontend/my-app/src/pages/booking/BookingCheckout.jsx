import { useState } from "react";
import dayjs from "dayjs";
import "@/styles/BookingCheckout.css";

// ─── Mock Data (fallback only) ─────────────────────────────────────────────────
const MOCK_FLIGHT = {
  outbound: {
    from: "EWR",
    to: "CHS",
    date: "Fri, Jun 5",
    time: "11:36 AM",
    duration: "2h 8m",
    airline: "Spirit Airlines",
  },
  return: {
    from: "CHS",
    to: "EWR",
    date: "Sun, Jun 7",
    time: "2:39 PM",
    duration: "2h 5m",
    airline: "Spirit Airlines",
  },
  basePrice: 268.38,
  stops: 0,
  ownerCode: "",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(start, end) {
  if (!start || !end) return "TBD";
  const minutes = dayjs(end).diff(dayjs(start), "minute");
  if (!Number.isFinite(minutes) || minutes <= 0) return "TBD";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

// Normalises a raw Duffel flight object into the shape all sub-components expect.
// If flight is null/undefined it returns MOCK_FLIGHT so nothing ever crashes.
function buildFlightData(flight) {
  if (!flight) return MOCK_FLIGHT;

  const airline = flight.owner || flight.airline || "Unknown Airline";
  const from = flight.origin || flight.from || "N/A";
  const to = flight.destination || flight.to || "N/A";
  const departingAt = flight.departingAt || flight.departureTime || null;
  const arrivingAt = flight.arrivingAt || flight.arrivalTime || null;
  const rawPrice = Number.parseFloat(flight.totalAmount ?? flight.price);

  return {
    id: flight.id || flight.flightId || "",
    raw: flight,
    outbound: {
      from,
      to,
      date: departingAt ? dayjs(departingAt).format("ddd, MMM D") : "TBD",
      time: departingAt ? dayjs(departingAt).format("h:mm A") : "TBD",
      duration: formatDuration(departingAt, arrivingAt),
      airline,
    },
    return: {
      from: to,
      to: from,
      date: flight.returningAt
        ? dayjs(flight.returningAt).format("ddd, MMM D")
        : "Return TBD",
      time: flight.returningAt
        ? dayjs(flight.returningAt).format("h:mm A")
        : "--",
      duration: flight.returnArrivingAt
        ? formatDuration(flight.returningAt, flight.returnArrivingAt)
        : "--",
      airline,
    },
    basePrice: Number.isFinite(rawPrice) ? rawPrice : MOCK_FLIGHT.basePrice,
    currency: flight.totalCurrency || flight.currency || "USD",
    stops: flight.stops ?? 0,
    ownerCode: flight.ownerCode || "",
  };
}

// ─── Options ───────────────────────────────────────────────────────────────────

const SEAT_OPTIONS = [
  {
    id: "none",
    label: "Skip — assign at check-in",
    price: 0,
    desc: "Random seat assigned free",
  },
  {
    id: "standard",
    label: "Preferred Standard",
    price: 48,
    desc: "Rows 3–5 · Sit up front",
  },
  {
    id: "premium",
    label: "Premium — Extra Legroom",
    price: 69,
    desc: "Rows 4–6 · Extra legroom",
  },
  {
    id: "big",
    label: "Big Front Seat",
    price: 89,
    desc: "Row 1–2 · 11 in. more legroom",
  },
];

const BAG_OPTIONS = [
  {
    id: "none",
    label: "Personal item only (included)",
    price: 0,
    desc: "Small backpack or purse",
  },
  {
    id: "carryon",
    label: "Add carry-on bag",
    price: 69,
    desc: "1 carry-on, limit per traveler",
  },
  {
    id: "checked",
    label: "Add checked bag",
    price: 79,
    desc: "Up to 50 lbs / 62 linear in.",
  },
  {
    id: "both",
    label: "Carry-on + Checked bag",
    price: 138,
    desc: "Full luggage bundle",
  },
];

// ─── Shared sub-components ─────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const steps = ["Passengers", "Seats & Bags", "Review & Pay"];
  return (
    <div className="sk-progress">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`sk-progress__step ${
            i < step ? "done" : i === step ? "active" : ""
          }`}
        >
          <div className="sk-progress__dot">{i < step ? "✓" : i + 1}</div>
          <span className="sk-progress__label">{s}</span>
          {i < steps.length - 1 && <div className="sk-progress__line" />}
        </div>
      ))}
    </div>
  );
}

// Expects a normalised flight object (output of buildFlightData), never raw Duffel.
function FlightSummaryCard({ flight }) {
  if (!flight?.outbound) return null;

  return (
    <div className="sk-flight-card">
      {/* Outbound leg */}
      <div className="sk-flight-card__leg">
        <div className="sk-flight-card__route">
          <span className="sk-flight-card__code">{flight.outbound.from}</span>
          <span className="sk-flight-card__arrow">→</span>
          <span className="sk-flight-card__code">{flight.outbound.to}</span>
        </div>
        <div className="sk-flight-card__meta">
          {flight.outbound.date} · {flight.outbound.time} ·{" "}
          {flight.outbound.duration}
        </div>
        <div className="sk-flight-card__meta">
          {flight.outbound.airline}
          {flight.ownerCode ? ` · ${flight.ownerCode}` : ""}
          {typeof flight.stops === "number"
            ? ` · ${
                flight.stops === 0
                  ? "Nonstop"
                  : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`
              }`
            : ""}
        </div>
      </div>

      <div className="sk-flight-card__divider" />

      {/* Return leg */}
      <div className="sk-flight-card__leg">
        <div className="sk-flight-card__route">
          <span className="sk-flight-card__code">{flight.return.from}</span>
          <span className="sk-flight-card__arrow">→</span>
          <span className="sk-flight-card__code">{flight.return.to}</span>
        </div>
        <div className="sk-flight-card__meta">
          {flight.return.date} · {flight.return.time} · {flight.return.duration}
        </div>
      </div>
    </div>
  );
}

function OptionSelector({ options, selected, onSelect, name }) {
  return (
    <div className="sk-option-group" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`sk-option ${
            selected === opt.id ? "sk-option--selected" : ""
          }`}
          onClick={() => onSelect(opt.id)}
          aria-checked={selected === opt.id}
          role="radio"
        >
          <div className="sk-option__left">
            <div className="sk-option__radio" />
            <div>
              <div className="sk-option__label">{opt.label}</div>
              <div className="sk-option__desc">{opt.desc}</div>
            </div>
          </div>
          <div className="sk-option__price">
            {opt.price === 0 ? (
              <span className="sk-option__free">Free</span>
            ) : (
              <span>+${opt.price}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function PriceSummary({ base, seat, bag, insurance }) {
  const seatPrice = SEAT_OPTIONS.find((o) => o.id === seat)?.price ?? 0;
  const bagPrice = BAG_OPTIONS.find((o) => o.id === bag)?.price ?? 0;
  const insPrice = insurance ? 28.25 : 0;
  const total = base + seatPrice + bagPrice + insPrice;

  const lines = [
    { label: "Base fare", amount: base },
    seatPrice > 0 && { label: "Seat upgrade", amount: seatPrice },
    bagPrice > 0 && { label: "Baggage", amount: bagPrice },
    insPrice > 0 && { label: "Travel protection", amount: insPrice },
  ].filter(Boolean);

  return (
    <div className="sk-price-summary">
      <div className="sk-price-summary__title">Price summary</div>
      {lines.map((l) => (
        <div key={l.label} className="sk-price-summary__line">
          <span>{l.label}</span>
          <span>${l.amount.toFixed(2)}</span>
        </div>
      ))}
      <div className="sk-price-summary__total">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── Step 1: Passengers ────────────────────────────────────────────────────────

function StepPassengers({ onNext }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
  });

  const valid = form.firstName && form.lastName && form.dob && form.email;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="sk-step">
      <h2 className="sk-step__title">Passenger details</h2>
      <p className="sk-step__sub">
        Must match your government-issued ID exactly.
      </p>

      <div className="sk-form-grid">
        <label className="sk-label">
          First name <span className="sk-req">*</span>
          <input
            className="sk-input"
            value={form.firstName}
            onChange={set("firstName")}
            placeholder="First Name"
            autoComplete="given-name"
          />
        </label>
        <label className="sk-label">
          Last name <span className="sk-req">*</span>
          <input
            className="sk-input"
            value={form.lastName}
            onChange={set("lastName")}
            placeholder="Last Name"
            autoComplete="family-name"
          />
        </label>
        <label className="sk-label sk-label--full">
          Date of birth <span className="sk-req">*</span>
          <input
            className="sk-input"
            type="date"
            value={form.dob}
            onChange={set("dob")}
          />
        </label>
        <label className="sk-label sk-label--full">
          Email <span className="sk-req">*</span>
          <input
            className="sk-input"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@email.com"
            autoComplete="email"
          />
        </label>
        <label className="sk-label sk-label--full">
          Phone number
          <input
            className="sk-input"
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
          />
        </label>
      </div>

      <button
        type="button"
        className={`sk-btn-primary ${!valid ? "sk-btn-primary--disabled" : ""}`}
        onClick={() => valid && onNext(form)}
        disabled={!valid}
      >
        Continue to Seats &amp; Bags →
      </button>
    </div>
  );
}

// ─── Step 2: Seats & Bags ──────────────────────────────────────────────────────

function StepSeatsBags({ onNext, onBack, basePrice }) {
  const [seat, setSeat] = useState("none");
  const [bag, setBag] = useState("none");
  const [insurance, setInsurance] = useState(false);

  return (
    <div className="sk-step">
      <h2 className="sk-step__title">Seats &amp; Bags</h2>

      <section className="sk-section">
        <div className="sk-section__header">
          <span className="sk-section__icon">💺</span>
          <div>
            <div className="sk-section__name">Seat preference</div>
            <div className="sk-section__hint">Applies to both flights</div>
          </div>
        </div>
        <OptionSelector
          options={SEAT_OPTIONS}
          selected={seat}
          onSelect={setSeat}
          name="Seat preference"
        />
      </section>

      <section className="sk-section">
        <div className="sk-section__header">
          <span className="sk-section__icon">🧳</span>
          <div>
            <div className="sk-section__name">Baggage</div>
            <div className="sk-section__hint">
              Applies to both flights · Prices lower now than at airport
            </div>
          </div>
        </div>
        <OptionSelector
          options={BAG_OPTIONS}
          selected={bag}
          onSelect={setBag}
          name="Baggage"
        />
      </section>

      <section className="sk-section">
        <div className="sk-section__header">
          <span className="sk-section__icon">🛡️</span>
          <div>
            <div className="sk-section__name">Travel protection</div>
            <div className="sk-section__hint">Optional · $28.25 one-time</div>
          </div>
        </div>
        <button
          type="button"
          className={`sk-option ${insurance ? "sk-option--selected" : ""}`}
          onClick={() => setInsurance(!insurance)}
          role="checkbox"
          aria-checked={insurance}
        >
          <div className="sk-option__left">
            <div
              className={`sk-option__check ${
                insurance ? "sk-option__check--on" : ""
              }`}
            >
              {insurance ? "✓" : ""}
            </div>
            <div>
              <div className="sk-option__label">
                Add travel protection — $28.25
              </div>
              <div className="sk-option__desc">
                Trip cancellation · Medical · Delay · Baggage loss
              </div>
            </div>
          </div>
        </button>
      </section>

      <PriceSummary
        base={basePrice}
        seat={seat}
        bag={bag}
        insurance={insurance}
      />

      <div className="sk-step__actions">
        <button type="button" className="sk-btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="sk-btn-primary"
          onClick={() => onNext({ seat, bag, insurance })}
        >
          Review &amp; Pay →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Review & Pay ──────────────────────────────────────────────────────

// NOTE: flight here is always the normalised object from buildFlightData — never raw.
function StepReviewPay({ onBack, passenger, extras, basePrice, flight }) {
  const [card, setCard] = useState({
    name: "",
    number: "",
    expMonth: "",
    expYear: "",
    cvv: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const seatPrice = SEAT_OPTIONS.find((o) => o.id === extras.seat)?.price ?? 0;
  const bagPrice = BAG_OPTIONS.find((o) => o.id === extras.bag)?.price ?? 0;
  const insPrice = extras.insurance ? 28.25 : 0;
  const total = basePrice + seatPrice + bagPrice + insPrice;

  const setC = (k) => (e) => setCard((c) => ({ ...c, [k]: e.target.value }));

  const formatCard = (v) =>
    v
      .replace(/\D/g, "")
      .replace(/(.{4})/g, "$1 ")
      .trim()
      .slice(0, 19);

  const canBook =
    card.name &&
    card.number.replace(/\s/g, "").length === 16 &&
    card.expMonth &&
    card.expYear &&
    card.cvv.length >= 3 &&
    agreed;

  const handleBook = () => {
    if (!canBook) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 1800);
  };

  if (done) {
    return (
      <div className="sk-done">
        <div className="sk-done__icon">✈️</div>
        <h2 className="sk-done__title">You're booked!</h2>
        <p className="sk-done__sub">
          Confirmation sent to <strong>{passenger.email}</strong>
        </p>
        <div className="sk-done__detail">
          <div>
            {flight.outbound.from} → {flight.outbound.to} ·{" "}
            {flight.outbound.date}
          </div>
          {flight.return.date !== "Return TBD" && (
            <div>
              {flight.return.from} → {flight.return.to} · {flight.return.date}
            </div>
          )}
          <div className="sk-done__total">
            Total charged: <strong>${total.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sk-step">
      <h2 className="sk-step__title">Review &amp; Pay</h2>

      {/* Trip recap */}
      <section className="sk-section">
        <div className="sk-section__name sk-section__name--spaced">
          Your trip
        </div>
        <FlightSummaryCard flight={flight} />
        <div className="sk-recap-row">
          <span>Passenger</span>
          <span>
            {passenger.firstName} {passenger.lastName}
          </span>
        </div>
        {extras.seat !== "none" && (
          <div className="sk-recap-row">
            <span>Seat</span>
            <span>{SEAT_OPTIONS.find((o) => o.id === extras.seat)?.label}</span>
          </div>
        )}
        {extras.bag !== "none" && (
          <div className="sk-recap-row">
            <span>Baggage</span>
            <span>{BAG_OPTIONS.find((o) => o.id === extras.bag)?.label}</span>
          </div>
        )}
        {extras.insurance && (
          <div className="sk-recap-row">
            <span>Protection</span>
            <span>Travel Guard</span>
          </div>
        )}
      </section>

      <PriceSummary
        base={basePrice}
        seat={extras.seat}
        bag={extras.bag}
        insurance={extras.insurance}
      />

      {/* Payment form */}
      <section className="sk-section">
        <div className="sk-section__name sk-section__name--spaced">Payment</div>
        <label className="sk-label sk-label--full">
          Name on card <span className="sk-req">*</span>
          <input
            className="sk-input"
            value={card.name}
            onChange={setC("name")}
            placeholder="David Chatman"
            autoComplete="cc-name"
          />
        </label>
        <label className="sk-label sk-label--full">
          Card number <span className="sk-req">*</span>
          <input
            className="sk-input sk-input--card"
            value={card.number}
            onChange={(e) =>
              setCard((c) => ({ ...c, number: formatCard(e.target.value) }))
            }
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={19}
          />
        </label>
        <div className="sk-form-row">
          <label className="sk-label">
            Month <span className="sk-req">*</span>
            <select
              className="sk-input sk-input--select"
              value={card.expMonth}
              onChange={setC("expMonth")}
              autoComplete="cc-exp-month"
            >
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
          <label className="sk-label">
            Year <span className="sk-req">*</span>
            <select
              className="sk-input sk-input--select"
              value={card.expYear}
              onChange={setC("expYear")}
              autoComplete="cc-exp-year"
            >
              <option value="">YYYY</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={2025 + i}>
                  {2025 + i}
                </option>
              ))}
            </select>
          </label>
          <label className="sk-label">
            CVV <span className="sk-req">*</span>
            <input
              className="sk-input"
              value={card.cvv}
              onChange={setC("cvv")}
              placeholder="•••"
              inputMode="numeric"
              maxLength={4}
              autoComplete="cc-csc"
            />
          </label>
        </div>
      </section>

      {/* Terms agreement */}
      <button
        type="button"
        className={`sk-agree ${agreed ? "sk-agree--checked" : ""}`}
        onClick={() => setAgreed(!agreed)}
        role="checkbox"
        aria-checked={agreed}
      >
        <div className={`sk-agree__box ${agreed ? "sk-agree__box--on" : ""}`}>
          {agreed ? "✓" : ""}
        </div>
        <span>
          I agree to the{" "}
          <a href="#" onClick={(e) => e.stopPropagation()} className="sk-link">
            fare rules
          </a>{" "}
          and{" "}
          <a href="#" onClick={(e) => e.stopPropagation()} className="sk-link">
            privacy policy
          </a>
          .
        </span>
      </button>

      <div className="sk-step__actions">
        <button
          type="button"
          className="sk-btn-secondary"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>
        <button
          type="button"
          className={`sk-btn-book ${!canBook ? "sk-btn-book--disabled" : ""} ${
            loading ? "sk-btn-book--loading" : ""
          }`}
          onClick={handleBook}
          disabled={!canBook || loading}
        >
          {loading ? (
            <span className="sk-spinner" />
          ) : (
            `Book · $${total.toFixed(2)}`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function BookingCheckout({ flight, onBack }) {
  // Always normalise to internal shape here — every child gets liveFlight, never raw
  const liveFlight = buildFlightData(flight);

  const [step, setStep] = useState(0);
  const [passenger, setPassenger] = useState(null);
  const [extras, setExtras] = useState(null);

  return (
    <div className="sk-checkout">
      <div className="sk-header">
        {onBack && (
          <button type="button" className="sk-btn-back" onClick={onBack}>
            ← Back to results
          </button>
        )}
        <span className="sk-header__logo">Skyrio</span>
        <span className="sk-header__sep">|</span>
        <span className="sk-header__title">Checkout</span>
      </div>

      <ProgressBar step={step} />

      {/* ✅ Always pass liveFlight here, never raw flight */}
      <div className="sk-checkout__flight-wrap">
        <FlightSummaryCard flight={liveFlight} />
      </div>

      {step === 0 && (
        <StepPassengers
          onNext={(p) => {
            setPassenger(p);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <StepSeatsBags
          onBack={() => setStep(0)}
          onNext={(e) => {
            setExtras(e);
            setStep(2);
          }}
          basePrice={liveFlight.basePrice}
        />
      )}
      {step === 2 && (
        <StepReviewPay
          onBack={() => setStep(1)}
          passenger={passenger}
          extras={extras}
          basePrice={liveFlight.basePrice}
          flight={liveFlight}
        />
      )}
    </div>
  );
}
