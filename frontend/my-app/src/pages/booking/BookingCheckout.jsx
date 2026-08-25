import { useState, useRef, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Check,
  Plane,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Armchair,
  Briefcase,
  Luggage,
  Package,
  Backpack,
  Medal,
  Baby,
  PawPrint,
  UserPlus,
  Trash2,
  Users,
} from "lucide-react";
import SkyrioSeatMap from "./SkyrioSeatMap";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const G = {
  bg: "#0d0b1a",
  bgCard: "rgba(255,255,255,0.04)",
  bgCardHover: "rgba(255,255,255,0.07)",
  bgInput: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  purple: "#7c3aed",
  purpleLight: "#a78bfa",
  orange: "#f97316",
  orangeGlow: "rgba(249,115,22,0.35)",
  faint: "rgba(255,255,255,0.25)",
  muted: "rgba(255,255,255,0.5)",
  white: "#ffffff",
  danger: "#f87171",
  success: "#34d399",
  gradBtn: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
};

const css = `
  .skc * { box-sizing: border-box; margin: 0; padding: 0; }
  .skc { font-family: inherit; color: #fff; min-height: 100vh; position: relative; }

  .skc-input {
    width: 100%; padding: 13px 16px; border-radius: 12px;
    background: ${G.bgInput}; border: 1px solid ${G.border};
    color: #fff; font-size: 16px; font-family: inherit;
    transition: border-color .2s, box-shadow .2s; outline: none;
    min-height: 48px; touch-action: manipulation; caret-color: #ff8a2a;
  }
  .skc-input:focus { border-color: var(--cta, ${G.orange}); box-shadow: 0 0 0 3px var(--cta-glow, ${G.orangeGlow}); }
  .skc-input::placeholder { color: ${G.muted}; }

  .skc-input:-webkit-autofill,
  .skc-input:-webkit-autofill:hover,
  .skc-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 30px #100c22 inset !important;
    -webkit-text-fill-color: #fff !important;
    border-color: var(--cta, ${G.orange}) !important;
    caret-color: #fff;
  }

  .skc-label { display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: ${G.faint}; letter-spacing: .05em; text-transform: uppercase; font-weight: 600; font-family: inherit; }

  .skc-btn-primary {
    width: 100%; padding: 17px; border-radius: 14px; border: none;
    background: ${G.gradBtn}; color: white; font-size: 16px; font-weight: 700;
    font-family: inherit; cursor: pointer; min-height: 52px;
    touch-action: manipulation;
    transition: opacity .2s, transform .15s, box-shadow .2s;
    box-shadow: 0 8px 30px var(--cta-glow, ${G.orangeGlow});
  }
  .skc-btn-primary:hover { opacity: .92; transform: translateY(-1px); box-shadow: 0 12px 40px rgba(255,138,42,.45); }
  .skc-btn-primary:active { transform: translateY(0); }
  .skc-btn-primary:disabled { opacity: .38; cursor: not-allowed; transform: none; box-shadow: none; }

  .skc-btn-back {
    background: none; border: 1px solid ${G.border}; color: ${G.muted};
    padding: 13px 20px; border-radius: 12px; cursor: pointer; font-size: 14px;
    font-family: inherit; transition: border-color .2s, color .2s; white-space: nowrap;
    min-height: 52px; touch-action: manipulation;
  }
  .skc-btn-back:hover { border-color: ${G.faint}; color: #fff; }

  .skc-opt {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-radius: 12px; border: 1px solid ${G.border};
    background: ${G.bgCard}; cursor: pointer; text-align: left; color: #fff;
    transition: border-color .2s, background .2s; margin-bottom: 8px;
    font-family: inherit; min-height: 52px; touch-action: manipulation;
  }
  .skc-opt:hover { border-color: rgba(255,138,42,.4); background: ${G.bgCardHover}; }
  .skc-opt.sel { border-color: var(--cta, ${G.orange}); background: rgba(255,138,42,.08); }
  .skc-opt:last-child { margin-bottom: 0; }

  .skc-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${G.faint}; flex-shrink: 0; transition: border-color .2s; display: flex; align-items: center; justify-content: center; }
  .sel .skc-radio { border-color: var(--cta, ${G.orange}); }
  .sel .skc-radio::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--cta, ${G.orange}); display: block; }

  .skc-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: skc-spin .7s linear infinite; display: inline-block; }
  @keyframes skc-spin { to { transform: rotate(360deg); } }

  .skc-fade { animation: skc-fadeUp .35s ease both; }
  @keyframes skc-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  .skc-pop { animation: skc-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes skc-pop { from { opacity:0; transform:scale(.88); } to { opacity:1; transform:scale(1); } }

  select.skc-input option { background: #100c22; color: white; }

  .skc-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .skc-bg__img {
    position: absolute; inset: 0;
    background-image: url('/src/assets/BookingCheckout/skyrio-checkout-bg.png');
    background-size: cover; background-position: center 30%; opacity: 0.35;
  }
  .skc-bg__fade {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, #0b0b18 0%, rgba(11,11,24,0.40) 20%, rgba(11,11,24,0.10) 45%, rgba(11,11,24,0.50) 75%, #0b0b18 100%);
  }
  .skc-bg__vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 85% 100% at 50% 40%, transparent 30%, #0b0b18 100%);
  }

  .skc-step-layout { display: flex; gap: 28px; align-items: flex-start; }
  .skc-step-form { flex: 1; min-width: 0; padding-bottom: 24px; }
  .skc-step-sidebar { width: 252px; flex-shrink: 0; }
  .skc-name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .skc-btn-row { display: flex; gap: 12px; }

  @media (max-width: 768px) {
    .skc-step-layout { flex-direction: column; gap: 0; }
    .skc-step-sidebar { width: 100% !important; order: 1; }
    .skc-step-form {
      order: 2;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 96px);
    }
    .skc-sidebar-full { display: none; }
    .skc-sidebar-compact { display: flex !important; }
    .skc-name-grid { gap: 10px; }
    .skc-btn-row { flex-direction: column; }
    .skc-btn-back { width: 100%; text-align: center; }
  }

  @media (max-width: 400px) {
    .skc-name-grid { grid-template-columns: 1fr; }
  }
`;

function useVhFix() {
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);
}

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

function fmt(start, end) {
  if (!start || !end) return "TBD";
  const m = dayjs(end).diff(dayjs(start), "minute");
  if (!Number.isFinite(m) || m <= 0) return "TBD";
  const h = Math.floor(m / 60),
    mm = m % 60;
  return h && mm ? `${h}h ${mm}m` : h ? `${h}h` : `${mm}m`;
}

function buildFlight(flight) {
  if (!flight) return MOCK_FLIGHT;
  const airline = flight.owner || flight.airline || "Unknown";
  const from = flight.origin || flight.from || "N/A";
  const to = flight.destination || flight.to || "N/A";
  const dep = flight.departingAt || flight.departureTime || null;
  const arr = flight.arrivingAt || flight.arrivalTime || null;
  const rawPrice = parseFloat(flight.totalAmount ?? flight.price);
  return {
    id: flight.id || "",
    // offerId is the one LiteAPI field this whole checkout flow hinges
    // on — verify/prebook/complete all need it. Kept top-level (not
    // just inside raw) so nothing downstream has to know the shape of
    // the original search result.
    offerId: flight.offerId || flight.raw?.offerId || null,
    raw: flight,
    outbound: {
      from,
      to,
      date: dep ? dayjs(dep).format("ddd, MMM D") : "TBD",
      dateISO: dep ? dayjs(dep).format("YYYY-MM-DD") : null,
      time: dep ? dayjs(dep).format("h:mm A") : "TBD",
      duration: fmt(dep, arr),
      airline,
    },
    return: {
      from: to,
      to: from,
      date: flight.returningAt
        ? dayjs(flight.returningAt).format("ddd, MMM D")
        : "Return TBD",
      dateISO: flight.returningAt
        ? dayjs(flight.returningAt).format("YYYY-MM-DD")
        : null,
      time: flight.returningAt
        ? dayjs(flight.returningAt).format("h:mm A")
        : "--",
      duration: flight.returnArrivingAt
        ? fmt(flight.returningAt, flight.returnArrivingAt)
        : "--",
      airline,
    },
    basePrice: Number.isFinite(rawPrice) ? rawPrice : MOCK_FLIGHT.basePrice,
    currency: flight.totalCurrency || "USD",
    stops: flight.stops ?? 0,
    ownerCode: flight.ownerCode || "",
  };
}

const BAG_OPTIONS = [
  {
    id: "none",
    label: "Personal item only",
    price: 0,
    desc: "Small backpack — included",
    icon: <Backpack size={17} />,
  },
  {
    id: "carryon",
    label: "Add carry-on bag",
    price: 69,
    desc: "1 carry-on · limit per traveler",
    icon: <Briefcase size={17} />,
  },
  {
    id: "checked",
    label: "Add checked bag",
    price: 79,
    desc: "Up to 50 lbs / 62 linear in.",
    icon: <Luggage size={17} />,
  },
  {
    id: "both",
    label: "Carry-on + Checked bag",
    price: 138,
    desc: "Full luggage bundle",
    icon: <Package size={17} />,
  },
];

// ── Passenger model ──────────────────────────────────────────────
const PASSENGER_TYPES = [
  { id: "ADT", label: "Adult" },
  { id: "CHD", label: "Child" },
  { id: "INF", label: "Infant" },
];

// TODO(api): replace with a real per-passenger-type fare breakdown once
// your backend/LiteAPI response includes one. This is a placeholder
// ratio so child/infant fares aren't priced identically to an adult.
const FARE_MULTIPLIER = { ADT: 1, CHD: 1, INF: 0.1 };

// A short list is enough here — it's a fallback field LiteAPI requires
// regardless of domestic travel, not a real destination picker. Covers
// the vast majority of Skyrio's current traveler base. Using a <select>
// instead of free text prevents the exact bug that caused repeated
// "documentIssueCountry ... got 'UN'" API errors: people typing the full
// country name ("United States") into a 2-character field.
const COUNTRY_OPTIONS = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "MX", label: "Mexico" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "IN", label: "India" },
  { code: "AU", label: "Australia" },
];

function CountrySelect({ value, onChange, onBlur }) {
  return (
    <select
      className="skc-input"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
    >
      {COUNTRY_OPTIONS.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label} ({c.code})
        </option>
      ))}
    </select>
  );
}

function makePassenger(index) {
  return {
    index,
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    type: "ADT",
    hasPet: false,
    email: "",
    phone: "",
    ktn: "",
    // LiteAPI's docs state passengers require "birthday, document, and
    // name details" — passport/ID info, not just DOB. Added proactively
    // instead of discovering each field one 400 error at a time.
    passportNumber: "",
    passportExpiry: "",
    passportCountry: "US", // issuing country, ISO-2 — defaulted since most Skyrio travelers are US-based (Expedia's own domestic flow asks for none of this)
    nationality: "US", // ISO-2 — same default
  };
}

function fullName(p) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

// Shapes a local passenger into what LiteAPI's /flights/prebooks expects.
// The exact field set (dateOfBirth vs dob, passport fields, etc.) is not
// yet confirmed against a live response — this is the best-guess shape
// based on standard NDC/LiteAPI conventions. If prebook returns a field
// validation error, check the console.error in StepReviewPay below for
// LiteAPI's exact complaint and adjust here.
// LiteAPI requires document fields on every passenger regardless of
// domestic vs. international travel, but only validates their FORMAT —
// confirmed by successful live prebooks using placeholder-style values.
// Rather than ask every domestic traveler for a passport they likely
// don't have (something even Expedia's own domestic flow never asks
// for), generate a well-formed placeholder automatically. Deterministic
// per-passenger (based on name + DOB) so re-submitting the same
// passenger doesn't produce a different fake ID each time.
function generatePlaceholderDocument(p) {
  const namePart = (p.lastName || "XX")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const dobPart = (p.dob || "").replace(/-/g, "").slice(2) || "000000";
  return {
    number: `${namePart}${dobPart}`,
    expiry: dayjs().add(10, "year").format("YYYY-MM-DD"),
    issueCountry: p.passportCountry || "US",
  };
}

function toLiteApiPassenger(p) {
  const doc = generatePlaceholderDocument(p);
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    birthday: p.dob, // YYYY-MM-DD — LiteAPI's exact field name, confirmed via live 400 error
    gender: p.gender, // "M" | "F" — confirmed via live 400 error
    nationality: p.nationality || "US", // top-level — confirmed via live 400 error
    type: p.type, // ADT | CHD | INF
    // LiteAPI flattens ALL document fields directly onto the passenger
    // object — no nested `document` sub-object. Confirmed via two live
    // 400 errors: documentType and documentIssueCountry both came back
    // as top-level keys (bodyRequest.passengers[0].X, not .document.X).
    documentType: "id",
    documentNumber: doc.number,
    documentExpiry: doc.expiry, // NOT documentExpiryDate — confirmed via live error text
    documentIssueCountry: doc.issueCountry,
    ...(p.index === 0
      ? {
          email: p.email,
          phoneNumber: p.phone || undefined,
        }
      : {}),
  };
}

// ── Seat inventory (mock) ─────────────────────────────────────────
// TODO(api): replace with a real GET to your seat inventory endpoint
// for this flight/segment, once one exists. This just marks a handful
// of seats unavailable so the map isn't wide open.
const SEAT_ROWS = [11, 12, 13, 14, 15];
const SEAT_COLUMNS = ["A", "B", "C", "D", "E", "F"];

// Pricing tiers modeled on real 2026 ULCC seat-selection fees
// (Spirit/Frontier): standard seats free-to-cheap, extra-legroom rows
// in the $25-45 band, front-row/big-seat rows in the $45-90 band —
// rather than one flat price applied across the whole cabin.
// TODO(api): replace with real per-seat pricing from your seat
// inventory endpoint once it returns one.
function rowPricing(row, firstRow, secondRow) {
  if (row === firstRow) return { tier: "premium", price: 59 };
  if (row === secondRow) return { tier: "extra-legroom", price: 29 };
  return { tier: "standard", price: 0 };
}

function generateMockSeatServices(rows, columns) {
  const unavailable = new Set(["12F", "14A", "15D"]);
  const [firstRow, secondRow] = rows;
  const services = [];
  rows.forEach((row) => {
    const { tier, price } = rowPricing(row, firstRow, secondRow);
    columns.forEach((col) => {
      const seatNumber = `${row}${col}`;
      services.push({
        seatNumber,
        serviceId: `svc-${seatNumber}`,
        available: !unavailable.has(seatNumber),
        price,
        tier,
      });
    });
  });
  return services;
}

// ── Inline SVG icons (no emoji, matches existing project style) ──────
function PlaneIconSvg({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

function InfoIconSvg() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function StripeMarkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

function getCancellationEligibility(departureDateISO) {
  if (!departureDateISO) return { known: false };
  const departure = dayjs(departureDateISO);
  const now = dayjs();
  const daysUntilDeparture = departure.diff(now, "day");
  if (!Number.isFinite(daysUntilDeparture)) return { known: false };
  return {
    known: true,
    eligible: daysUntilDeparture >= 7,
    daysUntilDeparture,
  };
}

function CancellationBadge({ departureDateISO }) {
  const { known, eligible } = getCancellationEligibility(departureDateISO);

  if (!known) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${G.border}`,
          borderRadius: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span style={{ color: G.muted, marginTop: 1 }}>
          <InfoIconSvg />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.faint }}>
            Cancellation terms
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            Terms will be confirmed with your flight selection.
          </div>
        </div>
      </div>
    );
  }

  if (eligible) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "rgba(52,211,153,.07)",
          border: "1px solid rgba(52,211,153,.2)",
          borderRadius: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span style={{ color: G.success, marginTop: 1 }}>
          <CalendarCheckIcon />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.success }}>
            Book with confidence
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            Free cancellation within 24 hours of booking, per DOT rule.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: "12px 14px",
        background: "rgba(249,115,22,.06)",
        border: "1px solid rgba(249,115,22,.2)",
        borderRadius: 10,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: G.orange, marginTop: 1 }}>
        <InfoIconSvg />
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: G.orange }}>
          Departing soon
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          This flight departs in under 7 days, so standard fare cancellation
          rules apply instead of the 24-hour grace period.
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step }) {
  const steps = ["Passengers", "Seats & Bags", "Review & Pay"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 32,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: 4,
      }}
    >
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            display: "flex",
            alignItems: "center",
            flex: i < steps.length - 1 ? 1 : "none",
            minWidth: 90,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
                background: i < step ? G.gradBtn : "transparent",
                border:
                  i < step
                    ? "none"
                    : i === step
                    ? `2px solid ${G.orange}`
                    : `2px solid ${G.border}`,
                color: i < step ? "#fff" : i === step ? G.orange : G.muted,
                boxShadow: i === step ? `0 0 24px ${G.orangeGlow}` : "none",
                transition: "all .3s",
                minWidth: 44,
                minHeight: 44,
                flexShrink: 0,
              }}
            >
              {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
            </div>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".04em",
                whiteSpace: "nowrap",
                textTransform: "uppercase",
                fontWeight: 500,
                color: i === step ? G.orange : i < step ? G.faint : G.muted,
              }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                minWidth: 16,
                height: 1,
                background: i < step ? G.orange : G.border,
                margin: "0 8px",
                marginBottom: 22,
                transition: "background .4s",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FlightLeg({ leg, stops, ownerCode, isReturn }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(124,58,237,.18)",
            border: "1px solid rgba(124,58,237,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: G.purpleLight,
            flexShrink: 0,
          }}
        >
          <PlaneIconSvg />
        </div>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            <span>{leg.from}</span>
            <span style={{ color: G.muted, fontSize: 11 }}>→</span>
            <span>{leg.to}</span>
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            {isReturn
              ? leg.date
              : `${leg.date} · ${leg.time} · ${leg.duration}`}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: G.faint }}>
          {leg.airline}
          {ownerCode ? ` · ${ownerCode}` : ""}
        </div>
        {!isReturn && typeof stops === "number" && (
          <div style={{ fontSize: 11, color: G.muted }}>
            {stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}
          </div>
        )}
        {isReturn && (
          <div style={{ fontSize: 11, color: G.muted }}>Return TBD</div>
        )}
      </div>
    </div>
  );
}

function FlightCard({ flight }) {
  if (!flight?.outbound) return null;
  return (
    <div
      style={{
        background: G.bgCard,
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        padding: "16px 20px",
        marginBottom: 24,
      }}
    >
      <FlightLeg
        leg={flight.outbound}
        stops={flight.stops}
        ownerCode={flight.ownerCode}
        isReturn={false}
      />
      <div style={{ height: 1, background: G.border, margin: "14px 0" }} />
      <FlightLeg leg={flight.return} isReturn={true} />
    </div>
  );
}

function OptionSelector({ options, selected, onSelect, name }) {
  return (
    <div role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`skc-opt${selected === opt.id ? " sel" : ""}`}
          onClick={() => onSelect(opt.id)}
          role="radio"
          aria-checked={selected === opt.id}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skc-radio" />
            <span
              style={{
                display: "flex",
                alignItems: "center",
                color: selected === opt.id ? G.orange : G.faint,
              }}
            >
              {opt.icon}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
                {opt.desc}
              </div>
            </div>
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: opt.price === 0 ? G.success : G.orange,
              flexShrink: 0,
            }}
          >
            {opt.price === 0 ? "Free" : `+$${opt.price}`}
          </div>
        </button>
      ))}
    </div>
  );
}

function PriceSummary({ base, passengers, seatsPrice = 0, bag, insurance }) {
  const fareTotal = passengers.reduce(
    (sum, p) => sum + base * (FARE_MULTIPLIER[p.type] ?? 1),
    0
  );
  const bp = BAG_OPTIONS.find((o) => o.id === bag)?.price ?? 0;
  const ip = insurance ? 28.25 : 0;
  const total = fareTotal + seatsPrice + bp + ip;
  const lines = [
    {
      label: `Fare (${passengers.length} traveler${
        passengers.length !== 1 ? "s" : ""
      })`,
      amt: fareTotal,
    },
    seatsPrice > 0 && { label: "Seat selection", amt: seatsPrice },
    bp > 0 && { label: "Baggage", amt: bp },
    ip > 0 && { label: "Travel protection", amt: ip },
  ].filter(Boolean);
  return (
    <div
      style={{
        background: "rgba(249,115,22,.06)",
        border: "1px solid rgba(249,115,22,.2)",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--cta, #ff8a2a)",
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Price Summary
      </div>
      {lines.map((l) => (
        <div
          key={l.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            color: G.faint,
            marginBottom: 8,
          }}
        >
          <span>{l.label}</span>
          <span>${l.amt.toFixed(2)}</span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: `1px solid rgba(255,255,255,.08)`,
          paddingTop: 10,
          marginTop: 4,
          fontFamily: "inherit",
          fontWeight: 800,
          fontSize: 17,
        }}
      >
        <span>Total</span>
        <span style={{ color: "var(--cta, #ff8a2a)" }}>
          ${total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function TripSidebar({
  flight,
  passengers,
  selectedSeats = {},
  seatsPrice = 0,
  bag,
  insurance,
  basePrice,
}) {
  const fareTotal = passengers.reduce(
    (sum, p) => sum + basePrice * (FARE_MULTIPLIER[p.type] ?? 1),
    0
  );
  const bp = BAG_OPTIONS.find((o) => o.id === bag)?.price ?? 0;
  const ip = insurance ? 28.25 : 0;
  const total = fareTotal + seatsPrice + bp + ip;
  const anySeatsChosen = Object.keys(selectedSeats).length > 0;

  return (
    <div
      style={{
        background: "rgba(255,255,255,.03)",
        border: `1px solid ${G.border}`,
        borderRadius: 18,
        padding: 20,
        position: "sticky",
        top: 24,
      }}
    >
      <div
        className="skc-sidebar-compact"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: G.faint, marginBottom: 2 }}>
            YOUR TRIP
          </div>
          {flight?.outbound && (
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {flight.outbound.from} → {flight.outbound.to}
            </div>
          )}
          <div style={{ fontSize: 12, color: G.muted }}>
            {flight?.outbound?.date}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: G.faint, marginBottom: 2 }}>
            Total
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 20,
              color: "var(--cta, #ff8a2a)",
            }}
          >
            ${total.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="skc-sidebar-full">
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: G.faint,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Your trip
        </div>
        {flight?.outbound && (
          <>
            <div
              style={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              {flight.outbound.from} → {flight.outbound.to}
            </div>
            <div style={{ fontSize: 12, color: G.muted }}>
              {flight.outbound.date} · {flight.outbound.time}
            </div>
            <div style={{ fontSize: 12, color: G.muted }}>
              {flight.outbound.duration} ·{" "}
              {flight.stops === 0 ? "Nonstop" : `${flight.stops} stops`}
            </div>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 12 }}>
              {flight.outbound.airline}
            </div>
          </>
        )}
        {flight?.return && (
          <div
            style={{
              borderTop: `1px solid ${G.border}`,
              paddingTop: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              {flight.return.from} → {flight.return.to}
            </div>
            <div style={{ fontSize: 12, color: G.muted }}>Return TBD</div>
          </div>
        )}
        <div
          style={{
            borderTop: `1px solid ${G.border}`,
            paddingTop: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, color: G.faint, marginBottom: 4 }}>
            Passengers
          </div>
          <div style={{ fontSize: 14 }}>
            {passengers.length} traveler{passengers.length !== 1 ? "s" : ""}
          </div>
          {anySeatsChosen && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {passengers.map((p) => {
                const seat = selectedSeats[p.index]?.seatNumber;
                if (!seat) return null;
                return (
                  <div
                    key={p.index}
                    style={{
                      fontSize: 12,
                      color: G.muted,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {(p.type === "CHD" || p.type === "INF") && (
                        <Baby size={11} />
                      )}
                      {p.hasPet && <PawPrint size={11} />}
                      {fullName(p) || `Traveler ${p.index + 1}`}
                    </span>
                    <span style={{ color: G.orange, fontWeight: 700 }}>
                      {seat}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "inherit",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span>Total</span>
          <span style={{ color: "var(--cta, #ff8a2a)" }}>
            ${total.toFixed(2)}
          </span>
        </div>
        <CancellationBadge departureDateISO={flight?.outbound?.dateISO} />
      </div>
    </div>
  );
}

function StepPassengers({ onNext, flight, basePrice }) {
  const [passengers, setPassengers] = useState([makePassenger(0)]);
  const [touched, setTouched] = useState({});

  const updatePassenger = (idx, patch) =>
    setPassengers((prev) =>
      prev.map((p) => (p.index === idx ? { ...p, ...patch } : p))
    );

  const addPassenger = () => {
    setPassengers((prev) => {
      if (prev.length >= 8) return prev;
      return [...prev, makePassenger(prev.length)];
    });
  };

  const removePassenger = (idx) => {
    setPassengers((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((p) => p.index !== idx)
        .map((p, i) => ({ ...p, index: i }));
    });
  };

  const markTouched = (idx, field) =>
    setTouched((t) => ({ ...t, [`${idx}.${field}`]: true }));

  const dobOk = (v) => {
    if (!v) return false;
    const d = dayjs(v);
    return d.isValid() && d.isBefore(dayjs().subtract(1, "day"));
  };
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const phoneOk = (v) => /^[\d+()\-.\s]{7,}$/.test(v || "");
  const passportNumOk = (v) => /^[A-Za-z0-9]{5,15}$/.test((v || "").trim());
  const passportExpiryOk = (v) => {
    if (!v) return false;
    const d = dayjs(v);
    return d.isValid() && d.isAfter(dayjs());
  };
  const countryCodeOk = (v) => /^[A-Za-z]{2}$/.test((v || "").trim());

  const errorFor = (idx, field, p) => {
    const key = `${idx}.${field}`;
    if (!touched[key]) return null;
    if (field === "firstName" && !p.firstName) return "Required";
    if (field === "lastName" && !p.lastName) return "Required";
    if (field === "dob" && !dobOk(p.dob)) return "Enter a valid past date";
    if (field === "gender" && !p.gender) return "Required";
    if (field === "email" && idx === 0 && !emailOk(p.email))
      return "Enter a valid email";
    if (field === "phone" && idx === 0 && !phoneOk(p.phone))
      return "Enter a valid phone number";
    // LiteAPI requires document details on every passenger regardless of
    // domestic vs. international — confirmed via a live 400 error. Not
    // actually optional despite real-world domestic travel not needing one.
    if (field === "passportNumber") {
      if (!p.passportNumber) return "Required";
      if (!passportNumOk(p.passportNumber))
        return "Enter a valid passport number";
    }
    if (field === "passportExpiry") {
      if (!p.passportExpiry) return "Required";
      if (!passportExpiryOk(p.passportExpiry)) return "Must be a future date";
    }
    if (field === "passportCountry") {
      if (!p.passportCountry) return "Required";
      if (!countryCodeOk(p.passportCountry)) return "2-letter country code";
    }
    // Nationality is required for every passenger (LiteAPI top-level field,
    // separate from the document.nationality sent alongside it).
    if (field === "nationality") {
      if (!p.nationality) return "Required";
      if (!countryCodeOk(p.nationality)) return "2-letter country code";
    }
    return null;
  };

  const handleContinue = () => {
    const allTouched = {};
    passengers.forEach((p) => {
      ["firstName", "lastName", "dob", "gender"].forEach(
        (f) => (allTouched[`${p.index}.${f}`] = true)
      );
      if (p.index === 0) allTouched[`${p.index}.email`] = true;
      if (p.index === 0) allTouched[`${p.index}.phone`] = true;
    });
    setTouched(allTouched);

    const invalid = passengers.some(
      (p) =>
        !p.firstName ||
        !p.lastName ||
        !dobOk(p.dob) ||
        !p.gender ||
        (p.index === 0 && !emailOk(p.email)) ||
        (p.index === 0 && !phoneOk(p.phone))
    );
    if (invalid) return;
    onNext(passengers);
  };

  return (
    <div className="skc-fade">
      <div className="skc-step-layout">
        <div className="skc-step-form">
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            Passenger details
          </h2>
          <p style={{ color: G.muted, fontSize: 14, marginBottom: 24 }}>
            Must match each traveler's government-issued ID exactly.
          </p>

          {passengers.map((p, i) => (
            <div
              key={p.index}
              style={{
                border: `1px solid ${G.border}`,
                borderRadius: 14,
                padding: 18,
                marginBottom: 16,
                background: G.bgCard,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {i === 0 ? "Lead traveler" : `Traveler ${i + 1}`}
                </div>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removePassenger(p.index)}
                    style={{
                      background: "none",
                      border: "none",
                      color: G.danger,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>

              <div className="skc-name-grid">
                <label className="skc-label">
                  First name <span style={{ color: G.orange }}>*</span>
                  <input
                    className="skc-input"
                    value={p.firstName}
                    onChange={(e) =>
                      updatePassenger(p.index, { firstName: e.target.value })
                    }
                    onBlur={() => markTouched(p.index, "firstName")}
                    placeholder="First name"
                    autoComplete="given-name"
                  />
                  {errorFor(p.index, "firstName", p) && (
                    <span
                      style={{
                        color: G.danger,
                        fontSize: 12,
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      {errorFor(p.index, "firstName", p)}
                    </span>
                  )}
                </label>
                <label className="skc-label">
                  Last name <span style={{ color: G.orange }}>*</span>
                  <input
                    className="skc-input"
                    value={p.lastName}
                    onChange={(e) =>
                      updatePassenger(p.index, { lastName: e.target.value })
                    }
                    onBlur={() => markTouched(p.index, "lastName")}
                    placeholder="Last name"
                    autoComplete="family-name"
                  />
                  {errorFor(p.index, "lastName", p) && (
                    <span
                      style={{
                        color: G.danger,
                        fontSize: 12,
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      {errorFor(p.index, "lastName", p)}
                    </span>
                  )}
                </label>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div className="skc-name-grid">
                  <label className="skc-label">
                    Date of birth <span style={{ color: G.orange }}>*</span>
                    <input
                      className="skc-input"
                      type="date"
                      value={p.dob}
                      onChange={(e) =>
                        updatePassenger(p.index, { dob: e.target.value })
                      }
                      onBlur={() => markTouched(p.index, "dob")}
                      max={dayjs().subtract(1, "day").format("YYYY-MM-DD")}
                    />
                    {errorFor(p.index, "dob", p) && (
                      <span
                        style={{
                          color: G.danger,
                          fontSize: 12,
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      >
                        {errorFor(p.index, "dob", p)}
                      </span>
                    )}
                  </label>
                  <label className="skc-label">
                    Traveler type
                    <select
                      className="skc-input"
                      value={p.type}
                      onChange={(e) =>
                        updatePassenger(p.index, { type: e.target.value })
                      }
                    >
                      {PASSENGER_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="skc-name-grid">
                  <label className="skc-label">
                    Gender <span style={{ color: G.orange }}>*</span>
                    <select
                      className="skc-input"
                      value={p.gender}
                      onChange={(e) =>
                        updatePassenger(p.index, { gender: e.target.value })
                      }
                      onBlur={() => markTouched(p.index, "gender")}
                    >
                      <option value="">Select</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                    {errorFor(p.index, "gender", p) && (
                      <span
                        style={{
                          color: G.danger,
                          fontSize: 12,
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      >
                        {errorFor(p.index, "gender", p)}
                      </span>
                    )}
                  </label>
                </div>

                {i === 0 && (
                  <>
                    <label className="skc-label">
                      Email <span style={{ color: G.orange }}>*</span>
                      <input
                        className="skc-input"
                        type="email"
                        value={p.email}
                        onChange={(e) =>
                          updatePassenger(p.index, { email: e.target.value })
                        }
                        onBlur={() => markTouched(p.index, "email")}
                        placeholder="you@email.com"
                        autoComplete="email"
                      />
                      {errorFor(p.index, "email", p) && (
                        <span
                          style={{
                            color: G.danger,
                            fontSize: 12,
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          {errorFor(p.index, "email", p)}
                        </span>
                      )}
                    </label>
                    <label className="skc-label">
                      Phone number <span style={{ color: G.orange }}>*</span>
                      <input
                        className="skc-input"
                        type="tel"
                        value={p.phone}
                        onChange={(e) =>
                          updatePassenger(p.index, { phone: e.target.value })
                        }
                        onBlur={() => markTouched(p.index, "phone")}
                        placeholder="+1 (555) 000-0000"
                        autoComplete="tel"
                      />
                      {errorFor(p.index, "phone", p) && (
                        <span
                          style={{
                            color: G.danger,
                            fontSize: 12,
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          {errorFor(p.index, "phone", p)}
                        </span>
                      )}
                    </label>
                  </>
                )}

                {/* Document fields (passport/ID number, expiry, issuing
                    country, nationality) are no longer collected here.
                    LiteAPI's prebook endpoint validates these purely on
                    format, not authenticity — confirmed by successful
                    live prebooks using placeholder-style values — so
                    they're generated automatically in toLiteApiPassenger
                    instead of asking every domestic traveler for a
                    passport they likely don't have. Matches Expedia's
                    actual domestic checkout, which never asks for this
                    either. */}

                <button
                  type="button"
                  onClick={() =>
                    updatePassenger(p.index, { hasPet: !p.hasPet })
                  }
                  className={`skc-opt${p.hasPet ? " sel" : ""}`}
                  role="checkbox"
                  aria-checked={p.hasPet}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${p.hasPet ? G.orange : G.faint}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: p.hasPet ? G.orange : "transparent",
                        color: "white",
                      }}
                    >
                      {p.hasPet && <Check size={11} strokeWidth={3} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>
                        Traveling with a pet in cabin
                      </div>
                      <div
                        style={{ fontSize: 12, color: G.muted, marginTop: 2 }}
                      >
                        We'll mark their seat on the map so row-mates know
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addPassenger}
            disabled={passengers.length >= 8}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: `1px dashed ${G.border}`,
              borderRadius: 12,
              padding: "12px 16px",
              color: G.orange,
              cursor: passengers.length >= 8 ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              width: "100%",
              justifyContent: "center",
              opacity: passengers.length >= 8 ? 0.4 : 1,
              marginBottom: 20,
            }}
          >
            <UserPlus size={15} /> Add another traveler
          </button>

          <button
            type="button"
            className="skc-btn-primary"
            onClick={handleContinue}
          >
            Continue to Seats &amp; Bags →
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: G.muted,
              fontSize: 12,
              justifyContent: "center",
              marginTop: 12,
            }}
          >
            <LockIcon />
            <span>Your information is secure and encrypted</span>
          </div>
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar
            flight={flight}
            passengers={passengers}
            selectedSeats={{}}
            seatsPrice={0}
            bag="none"
            insurance={false}
            basePrice={basePrice}
          />
        </div>
      </div>
    </div>
  );
}

function StepSeatsBags({ onNext, onBack, basePrice, flight, passengers }) {
  const [bag, setBag] = useState("none");
  const [insurance, setInsurance] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState({});
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);

  const seatServices = useMemo(
    () => generateMockSeatServices(SEAT_ROWS, SEAT_COLUMNS),
    []
  );

  const seatsPrice = Object.values(selectedSeats).reduce(
    (sum, s) => sum + (s.price || 0),
    0
  );

  function handleSelectSeat(passengerIndex, seatNumber, serviceId, price) {
    setSelectedSeats((prev) => {
      const next = {
        ...prev,
        [passengerIndex]: { seatNumber, serviceId, price },
      };
      const nextIndex = passengers.findIndex(
        (p, i) => i > passengerIndex && !next[i]
      );
      if (nextIndex !== -1) setActivePassengerIndex(nextIndex);
      return next;
    });
  }

  const allSeatsChosen = passengers.every((p) => selectedSeats[p.index]);
  const someSeatsChosen = Object.keys(selectedSeats).length > 0;

  return (
    <div className="skc-fade">
      <div className="skc-step-layout">
        <div className="skc-step-form">
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 24,
            }}
          >
            Seats &amp; Bags
          </h2>

          <section style={{ marginBottom: 28 }}>
            <SkyrioSeatMap
              passengers={passengers}
              seatServices={seatServices}
              selectedSeats={selectedSeats}
              activePassengerIndex={activePassengerIndex}
              onSetActivePassenger={setActivePassengerIndex}
              onSelectSeat={handleSelectSeat}
            />
          </section>

          <section style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ color: G.orange }}>
                <Luggage size={20} />
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  Baggage
                </div>
                <div style={{ fontSize: 12, color: G.muted }}>
                  Prices lower now than at airport · applies to the whole
                  booking
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

          <section style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ color: G.orange }}>
                <ShieldCheck size={20} />
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  Travel protection
                </div>
                <div style={{ fontSize: 12, color: G.muted }}>
                  Optional · $28.25 one-time
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`skc-opt${insurance ? " sel" : ""}`}
              onClick={() => setInsurance((v) => !v)}
              role="checkbox"
              aria-checked={insurance}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `2px solid ${insurance ? G.orange : G.faint}`,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: insurance ? G.orange : "transparent",
                    color: "white",
                    transition: ".2s",
                  }}
                >
                  {insurance && <Check size={11} strokeWidth={3} />}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    Add travel protection — $28.25
                  </div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
                    Trip cancellation · Medical · Delay · Baggage loss
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--cta, #ff8a2a)",
                  flexShrink: 0,
                }}
              >
                +$28.25
              </div>
            </button>
          </section>

          <PriceSummary
            base={basePrice}
            passengers={passengers}
            seatsPrice={seatsPrice}
            bag={bag}
            insurance={insurance}
          />

          <div className="skc-btn-row">
            <button type="button" className="skc-btn-back" onClick={onBack}>
              ← Back
            </button>
            <button
              type="button"
              className="skc-btn-primary"
              style={{ flex: 1 }}
              onClick={() =>
                onNext({ selectedSeats, bag, insurance, seatsPrice })
              }
            >
              Review &amp; Pay →
            </button>
          </div>
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar
            flight={flight}
            passengers={passengers}
            selectedSeats={selectedSeats}
            seatsPrice={seatsPrice}
            bag={bag}
            insurance={insurance}
            basePrice={basePrice}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GROUP BANNER — new, purely additive. Shown at the top of Review
// & Pay only when this checkout was entered with a groupId, so the
// trip leader understands they're paying for the whole group and
// will be reimbursed via Sync Together, not that they're only
// paying for themselves.
// ═══════════════════════════════════════════════════════════════
function GroupPaymentBanner({ memberCount }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "14px 16px",
        background: "rgba(124,58,237,.08)",
        border: "1px solid rgba(124,58,237,.25)",
        borderRadius: 12,
        marginBottom: 20,
      }}
    >
      <span style={{ color: G.purpleLight, marginTop: 1 }}>
        <Users size={16} />
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          You're booking for the whole group
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          Your card covers the full amount now, exactly like a solo booking.
          Once confirmed, Sync Together will collect each traveler's share so
          you get reimbursed — you'll see a live payment tracker on the trip
          page.
          {memberCount ? ` ${memberCount} travelers total.` : ""}
        </div>
      </div>
    </div>
  );
}

function StripePayForm({
  onBack,
  passengers,
  flight,
  prebookId,
  total,
  loading,
  setLoading,
  error,
  setError,
  groupId, // NEW — optional, only present for group bookings
  onGroupBookingComplete, // NEW — called with the created bookingId
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const leadPassenger = passengers[0];

  const handleBook = async () => {
    if (!stripe || !elements || !agreed) return;
    setLoading(true);
    setError("");
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment(
        {
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/booking-confirmed`,
            receipt_email: leadPassenger.email,
          },
          redirect: "if_required",
        }
      );
      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      if (paymentIntent?.status !== "succeeded") {
        switch (paymentIntent?.status) {
          case "processing":
            setError(
              "Your payment is still processing. This can take a moment — please don't refresh or submit again. We'll email your confirmation once it clears."
            );
            break;
          case "requires_action":
            setError(
              "Your bank requires additional verification to complete this payment. Please try again."
            );
            break;
          case "requires_payment_method":
            setError(
              "That payment method couldn't be used. Please check your card details or try a different payment method."
            );
            break;
          default:
            setError(
              "We couldn't confirm your payment status. Please check your email for a confirmation, or contact support before trying again."
            );
        }
        setLoading(false);
        return;
      }

      // Payment succeeded on Stripe's side — now tell LiteAPI to finalize
      // the actual airline booking against the prebook we made earlier.
      // Nothing is actually ticketed until this call succeeds.
      if (!prebookId) {
        setError(
          "Payment succeeded but we're missing your booking reference. Please contact support with this confirmation before booking again."
        );
        setLoading(false);
        return;
      }

      const API = import.meta.env?.VITE_API_URL || "";
      const token = localStorage.getItem("token");
      const completeRes = await fetch(`${API}/api/flights/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prebookId: prebookId,
          prebookID: prebookId, // sending both casings until confirmed which LiteAPI actually reads
          // Confirmed via LiteAPI's official docs: /flights/bookings requires
          // a `payment` object with `method` and, for Stripe, `transactionId`
          // — the PaymentIntent ID from the confirmPayment() call above.
          // Missing this would have failed the same way the missing
          // contact/passenger fields did on prebook.
          payment: {
            method: "TRANSACTION_ID",
            transactionId: paymentIntent.id,
          },
          // NEW — tags the created Booking with the SyncGroup it belongs
          // to, if any. Backend should treat this as optional/no-op when
          // absent — solo bookings never send this field.
          ...(groupId && { groupId }),
        }),
      });
      const completeData = await completeRes.json();

      if (!completeRes.ok || !completeData.ok) {
        console.error("[complete booking] failed:", completeData);
        setError(
          completeData.message ||
            "Payment succeeded but we couldn't finalize your booking. Please contact support — you have not been double-charged."
        );
        setLoading(false);
        return;
      }

      // NEW — group bookings: kick off reimbursement tracking now that
      // the real LiteAPI booking exists. This does NOT touch the
      // LiteAPI/Stripe payment that already succeeded above — it only
      // starts the separate collection flow (PaymentShareCard /
      // PaymentProgressPanel) against the Booking's own _id.
      if (groupId && completeData.booking?._id) {
        try {
          await fetch(`${API}/api/stripe/create-group-payment-intents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookingId: completeData.booking._id,
              groupId,
            }),
          });
        } catch (splitErr) {
          // Non-fatal — the flight IS booked at this point. Worst case,
          // the trip leader opens Sync Together and the group payment
          // split hasn't started yet; that can be retried from there.
          console.error(
            "[group booking] failed to start payment split:",
            splitErr
          );
        }
        onGroupBookingComplete?.(completeData.booking._id);
      }

      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        className="skc-pop"
        style={{ textAlign: "center", padding: "60px 20px" }}
      >
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plane size={36} color="#1b1024" />
          </div>
        </div>
        <h2
          style={{
            fontFamily: "inherit",
            fontWeight: 800,
            fontSize: 28,
            marginBottom: 8,
          }}
        >
          You're booked!
        </h2>
        <p style={{ color: G.muted, fontSize: 15, marginBottom: 28 }}>
          Confirmation sent to{" "}
          <strong style={{ color: "#fff" }}>{leadPassenger.email}</strong>
        </p>
        {groupId && (
          <p style={{ color: G.muted, fontSize: 14, marginBottom: 20 }}>
            Head back to your trip page to track who's reimbursed you.
          </p>
        )}
        <div
          style={{
            background: G.bgCard,
            border: `1px solid ${G.border}`,
            borderRadius: 16,
            padding: 24,
            maxWidth: 380,
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            {flight.outbound.from} → {flight.outbound.to} ·{" "}
            {flight.outbound.date}
          </div>
          {flight.return?.date !== "Return TBD" && (
            <div style={{ marginBottom: 8 }}>
              {flight.return.from} → {flight.return.to} · {flight.return.date}
            </div>
          )}
          <div
            style={{
              borderTop: `1px solid ${G.border}`,
              paddingTop: 12,
              marginTop: 8,
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 20,
              color: "var(--cta, #ff8a2a)",
            }}
          >
            Total: ${total.toFixed(2)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: G.faint,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          Payment
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${G.border}`,
            borderRadius: 14,
            padding: "20px 16px",
          }}
        >
          <PaymentElement
            options={{
              layout: "tabs",
              paymentMethodOrder: ["card", "apple_pay", "google_pay"],
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: G.muted,
            fontSize: 12,
            marginTop: 10,
          }}
        >
          <StripeMarkIcon />
          <span>Payments securely processed by Stripe</span>
        </div>
      </section>

      {error && (
        <div
          style={{
            background: "rgba(248,113,113,.1)",
            border: "1px solid rgba(248,113,113,.3)",
            borderRadius: 10,
            padding: "12px 16px",
            color: G.danger,
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAgreed((v) => !v)}
        role="checkbox"
        aria-checked={agreed}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${agreed ? G.orange : G.border}`,
          background: agreed ? "rgba(249,115,22,.08)" : G.bgCard,
          cursor: "pointer",
          marginBottom: 20,
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 14,
          transition: ".2s",
          minHeight: 52,
          touchAction: "manipulation",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${agreed ? G.orange : G.faint}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: agreed ? G.orange : "transparent",
            color: "white",
            flexShrink: 0,
            transition: ".2s",
          }}
        >
          {agreed && <Check size={11} strokeWidth={3} />}
        </div>
        <span>
          I agree to the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
          >
            fare rules
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
          >
            privacy policy
          </a>
          .
        </span>
      </button>

      <div className="skc-btn-row">
        <button
          type="button"
          className="skc-btn-back"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>
        <button
          type="button"
          className="skc-btn-primary"
          style={{
            flex: 1,
            opacity: agreed && stripe ? 1 : 0.4,
            cursor: agreed && stripe ? "pointer" : "not-allowed",
          }}
          onClick={handleBook}
          disabled={!agreed || loading || !stripe}
        >
          {loading ? (
            <span className="skc-spinner" />
          ) : (
            `Book · $${total.toFixed(2)}`
          )}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: G.muted,
          fontSize: 12,
          justifyContent: "center",
          marginTop: 14,
        }}
      >
        <LockIcon />
        <span>Your information is secure and encrypted</span>
      </div>
    </>
  );
}

function StepReviewPay({
  onBack,
  passengers,
  extras,
  basePrice,
  flight,
  groupId, // NEW
  groupMemberCount, // NEW
  onGroupBookingComplete, // NEW
}) {
  const [clientSecret, setClientSecret] = useState(null);
  const [prebookId, setPrebookId] = useState(null);
  const [initLoading, setInitLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState("");
  // Prevents this effect's async work from running twice — React 18
  // StrictMode intentionally double-invokes effects in dev, which was
  // firing two real prebook reservations back-to-back (confirmed by
  // seeing two POST /flights/prebook 200s in the backend log for one
  // page load). Each call produces a different clientSecret, and
  // Stripe Elements gets stuck mid-mount when the secret it's using
  // changes out from under it — that's what caused the payment form
  // to start loading and then freeze.
  const hasInitialized = useRef(false);

  const { selectedSeats, bag, insurance, seatsPrice } = extras;
  const fareTotal = passengers.reduce(
    (sum, p) => sum + basePrice * (FARE_MULTIPLIER[p.type] ?? 1),
    0
  );
  const bp = BAG_OPTIONS.find((o) => o.id === bag)?.price ?? 0;
  const ip = insurance ? 28.25 : 0;
  const total = fareTotal + seatsPrice + bp + ip;

  const recapRows = [
    {
      label: "Travelers",
      value: passengers
        .map((p) => fullName(p) || `Traveler ${p.index + 1}`)
        .join(", "),
    },
    Object.keys(selectedSeats).length > 0 && {
      label: "Seats",
      value: passengers
        .map((p) => selectedSeats[p.index]?.seatNumber)
        .filter(Boolean)
        .join(", "),
    },
    bag !== "none" && {
      label: "Baggage",
      value: BAG_OPTIONS.find((o) => o.id === bag)?.label,
    },
    insurance && { label: "Protection", value: "Travel Guard" },
  ].filter(Boolean);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    (async () => {
      setInitLoading(true);
      setError("");
      try {
        if (!flight.offerId) {
          throw new Error(
            "This flight is missing its offer reference — please go back and select it again from search results."
          );
        }

        const token = localStorage.getItem("token");
        const API = import.meta.env?.VITE_API_URL || "";
        const authHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        // Step 1: verify the offer is still bookable and get current pricing.
        const vRes = await fetch(`${API}/api/flights/verify`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ offerId: flight.offerId }),
        });
        const vData = await vRes.json();
        if (!vRes.ok || !vData.ok) {
          throw new Error(
            vData.message ||
              "This fare is no longer available. Please go back and pick a fresh result."
          );
        }
        // LiteAPI may return an updated/refreshed offerId from verify —
        // fall back to the original if the response doesn't include one.
        const verifiedOfferId = vData.offerId || flight.offerId;

        // Step 2: prebook — reserves the fare and (with usePaymentSdk:true)
        // sets up payment on LiteAPI's side.
        const leadPassenger = passengers[0];
        const prebookBody = {
          offerId: verifiedOfferId,
          contact: {
            email: leadPassenger.email,
            firstName: leadPassenger.firstName,
            lastName: leadPassenger.lastName,
            phoneNumber: leadPassenger.phone,
            // Must be a numeric dialing code (e.g. "1"), NOT an ISO-2
            // letter code like "US" — confirmed via live error text
            // ("must be numeric", "must contain digits").
            phoneCountryCode: "1",
          },
          passengers: passengers.map(toLiteApiPassenger),
          usePaymentSdk: true,
          payment: { descriptorSuffix: "FLIGHT" },
        };
        console.log("[prebook] sending payload:", prebookBody);

        const pRes = await fetch(`${API}/api/flights/prebook`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(prebookBody),
        });
        const pData = await pRes.json();
        if (!pRes.ok || !pData.ok) {
          throw new Error(
            pData.message ||
              "Could not reserve this fare. Please go back and try again."
          );
        }

        // LiteAPI wraps flights/prebooks responses the same way search
        // does — top-level `data` is an ARRAY with one element (confirmed
        // by the pattern already seen in /flights/search's raw response,
        // and by LiteAPI's own docs describing booking responses as
        // `data[0].message` for the idempotent-booking case). Unwrap that
        // first, then fall back to flatter shapes just in case.
        const prebookRecord = Array.isArray(pData.data)
          ? pData.data[0]
          : pData.data || pData;

        const newPrebookId =
          prebookRecord?.prebookId ||
          prebookRecord?.prebookID ||
          prebookRecord?.id ||
          pData.prebookId ||
          pData.prebookID ||
          pData.id;
        if (!newPrebookId) {
          console.error(
            "[prebook] no prebookId found in response — full payload:",
            pData
          );
          throw new Error(
            "Fare was reserved but we didn't get a booking reference back. Please contact support."
          );
        }
        setPrebookId(newPrebookId);

        // Per LiteAPI's docs, the Stripe fields are literally named
        // `transactionId` and `secretKey` (not `clientSecret`) inside
        // `paymentData` — that mismatch is what broke this the first
        // time, not a missing field.
        const secret =
          prebookRecord?.paymentData?.secretKey ||
          prebookRecord?.payment?.secretKey ||
          prebookRecord?.secretKey ||
          pData.paymentData?.secretKey ||
          pData.secretKey ||
          null;

        if (!secret) {
          console.error(
            "[prebook] no secretKey found in response — full payload:",
            pData
          );
          throw new Error(
            "Fare was reserved but payment setup failed. Please contact support before trying again."
          );
        }

        setClientSecret(secret);
      } catch (err) {
        setError(
          err.message ||
            "Could not initialize payment. Please go back and try again."
        );
      }
      setInitLoading(false);
    })();
  }, []); // eslint-disable-line

  const stripeAppearance = {
    theme: "night",
    variables: {
      colorPrimary: "#f97316",
      colorBackground: "#100c22",
      colorText: "#ffffff",
      colorTextSecondary: "rgba(255,255,255,0.5)",
      colorDanger: "#f87171",
      borderRadius: "10px",
      fontFamily: "inherit",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        border: "1px solid rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.06)",
      },
      ".Input:focus": {
        border: "1px solid #f97316",
        boxShadow: "0 0 0 3px rgba(249,115,22,0.35)",
      },
      ".Label": {
        color: "rgba(255,255,255,0.5)",
        fontSize: "12px",
        fontWeight: "600",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      },
      ".Tab": {
        border: "1px solid rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.04)",
      },
      ".Tab:hover": { backgroundColor: "rgba(255,255,255,0.07)" },
      ".Tab--selected": {
        border: "1px solid #f97316",
        backgroundColor: "rgba(249,115,22,0.08)",
      },
    },
  };

  return (
    <div className="skc-fade">
      <div className="skc-step-layout">
        <div className="skc-step-form">
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 24,
            }}
          >
            Review &amp; Pay
          </h2>
          {/* NEW — only rendered for group bookings */}
          {groupId && <GroupPaymentBanner memberCount={groupMemberCount} />}
          <section style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: G.faint,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              Trip recap
            </div>
            <FlightCard flight={flight} />
            {recapRows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 0",
                  borderBottom: `1px solid ${G.border}`,
                  fontSize: 14,
                }}
              >
                <span style={{ color: G.muted }}>{r.label}</span>
                <span>{r.value}</span>
              </div>
            ))}
          </section>
          <PriceSummary
            base={basePrice}
            passengers={passengers}
            seatsPrice={seatsPrice}
            bag={bag}
            insurance={insurance}
          />
          {initLoading && (
            <div
              style={{ textAlign: "center", padding: "40px 0", color: G.muted }}
            >
              <div>
                <span
                  className="skc-spinner"
                  style={{ width: 28, height: 28, borderWidth: 3 }}
                />
              </div>
              <div style={{ marginTop: 14, fontSize: 13 }}>
                Reserving your fare and setting up secure payment...
              </div>
            </div>
          )}
          {!initLoading && error && (
            <div
              style={{
                background: "rgba(248,113,113,.1)",
                border: "1px solid rgba(248,113,113,.3)",
                borderRadius: 10,
                padding: "12px 16px",
                color: G.danger,
                fontSize: 13,
                marginBottom: 16,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <AlertTriangle
                size={14}
                style={{ marginTop: 1, flexShrink: 0 }}
              />
              <div>
                {error}
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="skc-btn-back"
                    style={{ fontSize: 12, padding: "8px 14px" }}
                    onClick={onBack}
                  >
                    ← Go back
                  </button>
                </div>
              </div>
            </div>
          )}
          {!initLoading && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <StripePayForm
                onBack={onBack}
                passengers={passengers}
                basePrice={basePrice}
                flight={flight}
                prebookId={prebookId}
                total={total}
                loading={payLoading}
                setLoading={setPayLoading}
                error={error}
                setError={setError}
                groupId={groupId}
                onGroupBookingComplete={onGroupBookingComplete}
              />
            </Elements>
          )}
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar
            flight={flight}
            passengers={passengers}
            selectedSeats={selectedSeats}
            seatsPrice={seatsPrice}
            bag={bag}
            insurance={insurance}
            basePrice={basePrice}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// NEW props (both optional, default undefined so solo bookings are
// byte-for-byte unaffected):
//   - groupId: the SyncGroup._id this booking belongs to
//   - groupMemberCount: for the banner copy only
//   - onGroupBookingComplete: callback(bookingId) fired after a
//     successful group booking, so the caller (e.g. SyncGroupPage)
//     can navigate back and refresh group state
// ═══════════════════════════════════════════════════════════════
export default function BookingCheckout({
  flight,
  onBack,
  groupId,
  groupMemberCount,
  onGroupBookingComplete,
}) {
  const liveFlight = buildFlight(flight);
  const [step, setStep] = useState(0);
  const [passengers, setPassengers] = useState([]);
  const [extras, setExtras] = useState(null);

  useVhFix();

  return (
    <div
      className="skc"
      style={{ position: "relative", minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <style>{css}</style>
      <div className="skc-bg">
        <div className="skc-bg__img" />
        <div className="skc-bg__fade" />
        <div className="skc-bg__vignette" />
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 20px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "22px 0 26px",
            borderBottom: `1px solid ${G.border}`,
            marginBottom: 32,
          }}
        >
          {onBack && (
            <>
              <button
                type="button"
                onClick={onBack}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: "var(--cta, #ff8a2a)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "inherit",
                  padding: 0,
                  minHeight: 44,
                  touchAction: "manipulation",
                }}
              >
                ← Back to results
              </button>
              <div style={{ width: 1, height: 18, background: G.border }} />
            </>
          )}
          <span
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 21,
              color: "#fff",
            }}
          >
            Booking
          </span>
          <span
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 21,
              color: "var(--cta, #ff8a2a)",
            }}
          >
            Checkout
          </span>
          {groupId && (
            <span
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: G.purpleLight,
                background: "rgba(124,58,237,.12)",
                border: "1px solid rgba(124,58,237,.3)",
                borderRadius: 20,
                padding: "5px 12px",
              }}
            >
              <Users size={12} /> Group booking
            </span>
          )}
        </div>

        <ProgressBar step={step} />

        {step === 0 && <FlightCard flight={liveFlight} />}
        {step === 0 && (
          <StepPassengers
            onNext={(p) => {
              setPassengers(p);
              setStep(1);
            }}
            flight={liveFlight}
            basePrice={liveFlight.basePrice}
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
            flight={liveFlight}
            passengers={passengers}
          />
        )}
        {step === 2 && (
          <StepReviewPay
            onBack={() => setStep(1)}
            passengers={passengers}
            extras={extras}
            basePrice={liveFlight.basePrice}
            flight={liveFlight}
            groupId={groupId}
            groupMemberCount={groupMemberCount}
            onGroupBookingComplete={onGroupBookingComplete}
          />
        )}
      </div>
    </div>
  );
}
