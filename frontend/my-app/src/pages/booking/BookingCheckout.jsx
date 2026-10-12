import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import {
  Check,
  Plane,
  AlertTriangle,
  Luggage,
  Baby,
  PawPrint,
  UserPlus,
  Trash2,
  Users,
} from "lucide-react";
import SkyrioSeatMap from "./SkyrioSeatMap";
import LiteApiPayForm from "./LiteApiPayForm";


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
  // 0.42/0.62 clear WCAG AA (4.5:1) on this near-black background.
  faint: "rgba(255,255,255,0.42)",
  muted: "rgba(255,255,255,0.62)",
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

// Persists in-progress checkout (step, passenger details, seat
// selections, group context, prebook refs) to sessionStorage, keyed by
// the offer, so an accidental refresh doesn't throw away what someone
// just typed. sessionStorage (not localStorage) on purpose: survives a
// refresh in the same tab but doesn't linger across visits with a fare
// that may no longer be valid.
//
// NOTE: LiteAPI's Flight Booking Architecture guide recommends against
// persisting offerId/prebookId/transactionId client-side in favor of a
// server-side session store. This diverges deliberately (no server-side
// session table exists yet). Worth revisiting once one does.
//
// v2: selectedSeats changed shape to { [segmentKey]: { [passengerIndex]: ... } }.
// The prefix was bumped so a stored v1 snapshot is never restored into
// the new shape.
const CHECKOUT_PROGRESS_PREFIX = "skyrio_checkout_progress_v2:";

function getProgressStorageKey(flight) {
  const id = flight?.offerId || flight?.id;
  return id ? `${CHECKOUT_PROGRESS_PREFIX}${id}` : null;
}

function readCheckoutProgress(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCheckoutProgress(key, data) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage can fail (private browsing, quota) — never worth breaking checkout over.
  }
}

function clearCheckoutProgress(key) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Non-fatal.
  }
}

// ---- Per-segment seat selection helpers -------------------------------
// selectedSeats shape: { [segmentKey]: { [passengerIndex]: { seatNumber, serviceId, price } } }

const anySeats = (selectedSeats) =>
  Object.values(selectedSeats || {}).some(
    (seg) => seg && Object.keys(seg).length > 0
  );

const sumSeatPrices = (selectedSeats) =>
  Object.values(selectedSeats || {}).reduce(
    (total, seg) =>
      total + Object.values(seg || {}).reduce((s, x) => s + (x?.price || 0), 0),
    0
  );

const collectServiceIds = (selectedSeats) =>
  Object.values(selectedSeats || {})
    .flatMap((seg) => Object.values(seg || {}))
    .map((s) => s.serviceId)
    .filter(Boolean);

// ---- Flights (segments) a seat can be chosen on -----------------------
// LiteAPI returns one seat map per FLIGHT (segment), not per direction.
// A trip with one connection each way is 4 flights, so a customer must
// never see anything like "Leg 3". Every flight gets a plain-language
// description: which number it is, outbound or return, the route, the
// time, and the flight number.
//
// Each flight is matched to LiteAPI's seat-map keys by ORDER (the n-th
// distinct segmentKey is the n-th flight of the itinerary). That is only
// trusted when the counts agree; otherwise flights are named
// "Flight 1 of 4" without a route rather than showing a wrong route.
function buildSeatSegments(seatServices, flight) {
  const keys = [
    ...new Set((seatServices || []).map((s) => s.segmentKey).filter(Boolean)),
  ];
  if (!keys.length) {
    return [
      {
        key: "default",
        index: 0,
        total: 1,
        label: "Your flight",
        shortLabel: "Your flight",
        direction: null,
        flightNumber: "",
        departLabel: "",
      },
    ];
  }

  const slices = Array.isArray(flight?.raw?.slices) ? flight.raw.slices : [];
  const flat = slices.flatMap((slice, sliceIdx) =>
    (Array.isArray(slice?.segments) ? slice.segments : []).map((seg) => ({
      ...seg,
      // Only name a direction when the itinerary really has two slices.
      direction:
        slices.length > 1 ? (sliceIdx === 0 ? "Outbound" : "Return") : null,
      sliceIdx,
    }))
  );
  const canMap = flat.length === keys.length;

  return keys.map((key, i) => {
    const seg = canMap ? flat[i] : null;
    const prevSeg = canMap ? flat[i - 1] : null;
    const nextSeg = canMap ? flat[i + 1] : null;
    const route =
      seg?.origin && seg?.destination
        ? `${seg.origin} → ${seg.destination}`
        : `Flight ${i + 1}`;
    const flightNumber =
      seg?.carrierCode && seg?.flightNumber
        ? `${seg.carrierCode} ${seg.flightNumber}`
        : "";
    const departLabel =
      seg?.departureTime && dayjs(seg.departureTime).isValid()
        ? dayjs(seg.departureTime).format("ddd, MMM D · h:mm A")
        : "";
    return {
      key,
      index: i,
      total: keys.length,
      label: route,
      shortLabel: route,
      direction: seg?.direction ?? null,
      flightNumber,
      departLabel,
      // Where the traveler changes planes after / arrives from, when this
      // flight is one half of a connection within the same direction.
      layoverAt:
        seg && nextSeg && nextSeg.sliceIdx === seg.sliceIdx
          ? seg.destination
          : null,
      connectingFrom:
        seg && prevSeg && prevSeg.sliceIdx === seg.sliceIdx ? seg.origin : null,
    };
  });
}

// One entry per flight on which this traveler has a seat:
// [{ label: "EWR → FLL", seat: "4B" }, ...]
const seatLines = (selectedSeats, segments, passengerIndex) => {
  const list = segments?.length
    ? segments
    : Object.keys(selectedSeats || {}).map((key) => ({
        key,
        shortLabel: "Flight",
      }));
  return list
    .map((s) => {
      const seat = selectedSeats?.[s.key]?.[passengerIndex]?.seatNumber;
      return seat ? { label: s.shortLabel || s.label || "Flight", seat } : null;
    })
    .filter(Boolean);
};

// How many flights have a seat chosen for EVERY traveler.
const countFlightsFullySeated = (selectedSeats, segments, passengers) =>
  (segments || []).filter((s) =>
    passengers.every((p) => selectedSeats?.[s.key]?.[p.index])
  ).length;

// Airports a connecting itinerary stops at, per direction: EWR → ATL → MIA
// gives ["ATL"]. Comes from LiteAPI's own segments, so it is real data.
const connectionCodes = (slice) =>
  (Array.isArray(slice?.segments) ? slice.segments : [])
    .slice(0, -1)
    .map((seg) => seg?.destination)
    .filter(Boolean);

// "Nonstop" | "1 stop · via ATL" | "" when unknown
const stopsText = (stops, via) => {
  if (typeof stops !== "number") return "";
  if (stops === 0) return "Nonstop";
  return `${stops} stop${stops > 1 ? "s" : ""}${
    via?.length ? ` · via ${via.join(", ")}` : ""
  }`;
};

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
      via: connectionCodes(flight.slices?.[0]),
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
      stops:
        typeof flight.slices?.[1]?.stops === "number"
          ? flight.slices[1].stops
          : null,
      via: connectionCodes(flight.slices?.[1]),
    },
    basePrice: Number.isFinite(rawPrice) ? rawPrice : MOCK_FLIGHT.basePrice,
    currency: flight.totalCurrency || "USD",
    stops: flight.stops ?? 0,
    ownerCode: flight.ownerCode || "",
    fareExpiresAt: flight.fareExpiresAt || null,
  };
}

const PASSENGER_TYPES = [
  { id: "ADT", label: "Adult" },
  { id: "CHD", label: "Child" },
  { id: "INF", label: "Infant" },
];

const FARE_MULTIPLIER = { ADT: 1, CHD: 1, INF: 0.1 };

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
    passportNumber: "",
    passportExpiry: "",
    passportCountry: "US",
    nationality: "US",
  };
}

function fullName(p) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

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
    birthday: p.dob,
    gender: p.gender,
    nationality: p.nationality || "US",
    type: p.type,
    documentType: "id",
    documentNumber: doc.number,
    documentExpiry: doc.expiry,
    documentIssueCountry: doc.issueCountry,
    ...(p.index === 0
      ? {
          email: p.email,
          phoneNumber: p.phone || undefined,
        }
      : {}),
  };
}

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

function ClockIconSvg() {
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// Live "price locked for N:NN" countdown against the fare's real
// expiration from LiteAPI. Turns to a warning under 2 minutes and to a
// blocking "fare expired" state at zero. Screen readers are told once at
// each transition, not every tick.
function FareCountdown({ expiresAt, onExpired }) {
  const [now, setNow] = useState(() => dayjs());
  const hasFiredExpiry = useRef(false);
  const announcedRef = useRef(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const iv = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const expiry = expiresAt ? dayjs(expiresAt) : null;
  const totalSeconds = expiry ? Math.max(0, expiry.diff(now, "second")) : null;
  const expired = totalSeconds !== null && totalSeconds <= 0;
  const isWarning = totalSeconds !== null && totalSeconds <= 120 && !expired;

  useEffect(() => {
    if (expired && !hasFiredExpiry.current) {
      hasFiredExpiry.current = true;
      onExpired?.();
    }
  }, [expired, onExpired]);

  useEffect(() => {
    if (expired && announcedRef.current !== "expired") {
      announcedRef.current = "expired";
      setAnnouncement(
        "This fare has expired. Please go back and search again."
      );
    } else if (isWarning && announcedRef.current !== "warning") {
      announcedRef.current = "warning";
      setAnnouncement("Less than two minutes left on this price.");
    }
  }, [expired, isWarning]);

  if (!expiresAt) return null;

  const srOnlyLiveRegion = (
    <span
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {announcement}
    </span>
  );

  if (expired) {
    return (
      <div
        style={{
          marginBottom: 16,
          padding: "12px 14px",
          background: "rgba(248,113,113,.1)",
          border: "1px solid rgba(248,113,113,.3)",
          borderRadius: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        {srOnlyLiveRegion}
        <span style={{ color: G.danger, marginTop: 1 }} aria-hidden="true">
          <AlertTriangle size={14} />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.danger }}>
            This fare has expired
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            Prices can change — please go back and search again to get a current
            price.
          </div>
        </div>
      </div>
    );
  }

  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 10,
        background: isWarning
          ? "rgba(248,113,113,.1)"
          : "rgba(255,255,255,.04)",
        border: `1px solid ${isWarning ? "rgba(248,113,113,.3)" : G.border}`,
        color: isWarning ? G.danger : G.muted,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {srOnlyLiveRegion}
      <span aria-hidden="true">
        <ClockIconSvg />
      </span>
      <span aria-hidden="true">
        Price locked for{" "}
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {mm}:{String(ss).padStart(2, "0")}
        </span>
      </span>
    </div>
  );
}

// Replaces a step's primary action once the fare has expired, with one
// clear way out: back to results to search fresh.
function FareExpiredBlock({ onBackToResults }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        marginBottom: 20,
        borderRadius: 14,
        background: "rgba(248,113,113,.08)",
        border: "1px solid rgba(248,113,113,.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 14,
        }}
      >
        <span style={{ color: G.danger, marginTop: 1 }}>
          <AlertTriangle size={16} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: G.danger }}>
            This fare has expired
          </div>
          <div style={{ fontSize: 13, color: G.muted, marginTop: 3 }}>
            Prices and availability can change. Please go back and search again
            to get a current price before continuing.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onBackToResults}
        className="skc-btn-primary"
        style={{ background: G.gradBtn }}
      >
        ← Back to results
      </button>
    </div>
  );
}

// Confirms before discarding real progress. A blank, just-opened
// checkout skips this entirely (see hasProgress in the default export).
function DiscardProgressModal({ onKeepEditing, onDiscard }) {
  const keepEditingRef = useRef(null);

  useEffect(() => {
    keepEditingRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onKeepEditing();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onKeepEditing]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-progress-title"
      aria-describedby="discard-progress-desc"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000000,
        background: "rgba(8,6,18,0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onKeepEditing}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="skc-pop"
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#150f28",
          border: `1px solid ${G.border}`,
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <span style={{ color: G.orange, marginTop: 1 }} aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div>
            <div
              id="discard-progress-title"
              style={{ fontFamily: "inherit", fontWeight: 800, fontSize: 17 }}
            >
              Discard your progress?
            </div>
            <div
              id="discard-progress-desc"
              style={{ fontSize: 13, color: G.muted, marginTop: 6 }}
            >
              You'll lose the traveler details you've entered. This can't be
              undone.
            </div>
          </div>
        </div>
        <div className="skc-btn-row">
          <button
            ref={keepEditingRef}
            type="button"
            className="skc-btn-back"
            onClick={onKeepEditing}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="skc-btn-primary"
            style={{ flex: 1, background: G.gradBtn }}
            onClick={onDiscard}
          >
            Discard &amp; leave
          </button>
        </div>
      </div>
    </div>
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
  const steps = ["Passengers", "Seats", "Review & Pay"];
  return (
    <nav
      aria-label="Checkout progress"
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
          aria-current={i === step ? "step" : undefined}
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
              aria-hidden="true"
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
              {i < step && (
                <span
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                >
                  {" "}
                  (completed)
                </span>
              )}
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
    </nav>
  );
}

// leg.time/leg.date come from buildFlight(); "Return TBD" only shows when
// there is genuinely no return time.
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
        {stopsText(isReturn ? leg.stops : stops, leg.via) && (
          <div style={{ fontSize: 11, color: G.muted }}>
            {stopsText(isReturn ? leg.stops : stops, leg.via)}
          </div>
        )}
        {isReturn && (
          <div style={{ fontSize: 11, color: G.muted }}>
            {leg.time && leg.time !== "--" ? leg.time : "Return TBD"}
          </div>
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

// Estimate shown before payment. The exact amount charged is read from the
// payment itself on Review & Pay (see LiteApiPayForm).
function PriceSummary({ base, passengers, seatsPrice = 0 }) {
  const fareTotal = passengers.reduce(
    (sum, p) => sum + base * (FARE_MULTIPLIER[p.type] ?? 1),
    0
  );
  const total = fareTotal + seatsPrice;
  const lines = [
    {
      label: `Fare (${passengers.length} traveler${
        passengers.length !== 1 ? "s" : ""
      })`,
      amt: fareTotal,
    },
    seatsPrice > 0 && { label: "Seat selection", amt: seatsPrice },
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
        Estimated price
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
        <span>Estimated total</span>
        <span style={{ color: "var(--cta, #ff8a2a)" }}>
          ${total.toFixed(2)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: G.muted, marginTop: 8 }}>
        The airline confirms the final price, shown before you pay.
      </div>
    </div>
  );
}

function TripSidebar({
  flight,
  passengers,
  selectedSeats = {},
  seatsPrice = 0,
  basePrice,
  onFareExpired,
  segments = [],
}) {
  const fareTotal = passengers.reduce(
    (sum, p) => sum + basePrice * (FARE_MULTIPLIER[p.type] ?? 1),
    0
  );
  const total = fareTotal + seatsPrice;
  const anySeatsChosen = anySeats(selectedSeats);

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
            Est. total
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
              {stopsText(flight.stops, flight.outbound.via) || "—"}
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
            <div style={{ fontSize: 12, color: G.muted }}>
              {flight.return.dateISO
                ? `${flight.return.date} · ${flight.return.time}`
                : "Return TBD"}
            </div>
            {stopsText(flight.return.stops, flight.return.via) && (
              <div style={{ fontSize: 12, color: G.muted }}>
                {stopsText(flight.return.stops, flight.return.via)}
              </div>
            )}
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
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 11, color: G.faint }}>Your seats</div>
              {passengers.map((p) => {
                const lines = seatLines(selectedSeats, segments, p.index);
                if (!lines.length) return null;
                return (
                  <div key={p.index}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#fff",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 4,
                      }}
                    >
                      {(p.type === "CHD" || p.type === "INF") && (
                        <Baby size={11} />
                      )}
                      {p.hasPet && <PawPrint size={11} />}
                      {fullName(p) || `Traveler ${p.index + 1}`}
                    </div>
                    {lines.map((l) => (
                      <div
                        key={l.label + l.seat}
                        style={{
                          fontSize: 12,
                          color: G.muted,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          paddingLeft: 2,
                        }}
                      >
                        <span>{l.label}</span>
                        <span style={{ color: G.orange, fontWeight: 700 }}>
                          {l.seat}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <FareCountdown
          expiresAt={flight?.fareExpiresAt}
          onExpired={onFareExpired}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "inherit",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span>Est. total</span>
          <span style={{ color: "var(--cta, #ff8a2a)" }}>
            ${total.toFixed(2)}
          </span>
        </div>
        <CancellationBadge departureDateISO={flight?.outbound?.dateISO} />
      </div>
    </div>
  );
}

function StepPassengers({
  onNext,
  flight,
  basePrice,
  fareExpired,
  onFareExpired,
  onBackToResults,
  onFormDirty,
  initialPassengers,
  onPassengersChange,
}) {
  const [passengers, setPassengers] = useState(() =>
    initialPassengers?.length ? initialPassengers : [makePassenger(0)]
  );
  const [touched, setTouched] = useState({});
  const [autofilled, setAutofilled] = useState(false);

  // Reports upward whenever the person has typed something, so the parent
  // can decide whether leaving deserves a "discard?" confirmation.
  useEffect(() => {
    const dirty = passengers.some(
      (p) =>
        p.firstName || p.lastName || p.dob || p.gender || p.email || p.phone
    );
    onFormDirty?.(dirty);
  }, [passengers, onFormDirty]);

  // Live-syncs every keystroke to the parent's `passengers` state, which
  // is what gets persisted to sessionStorage.
  useEffect(() => {
    onPassengersChange?.(passengers);
  }, [passengers, onPassengersChange]);

  // Autofills the lead traveler's name/email from their Skyrio profile,
  // only into fields that are still empty. GET /api/profile/me returns
  // { ok, user: { name, email, ... } }; User has a single `name` field so
  // it is split on the first space. There is no phone field on User or
  // Profile, so phone is not autofilled.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const API = import.meta.env?.VITE_API_URL || "";
        const res = await fetch(`${API}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const user = data?.user || {};
        const fullName = (user.name || "").trim();
        const [firstName = "", ...rest] = fullName.split(/\s+/).filter(Boolean);
        const lastName = rest.join(" ");
        const email = user.email || "";
        if (cancelled) return;
        if (!firstName && !lastName && !email) return;
        setAutofilled(true);
        setPassengers((prev) =>
          prev.map((p) =>
            p.index === 0
              ? {
                  ...p,
                  firstName: p.firstName || firstName,
                  lastName: p.lastName || lastName,
                  email: p.email || email,
                }
              : p
          )
        );
      } catch {
        // Non-fatal — autofill is a convenience.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const errStyle = {
    color: G.danger,
    fontSize: 12,
    textTransform: "none",
    letterSpacing: 0,
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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
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
                  {i === 0 && autofilled && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.success,
                        background: "rgba(52,211,153,.1)",
                        border: "1px solid rgba(52,211,153,.25)",
                        borderRadius: 20,
                        padding: "3px 9px",
                      }}
                    >
                      Filled from your profile
                    </span>
                  )}
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
                  First name{" "}
                  <span style={{ color: G.orange }} aria-hidden="true">
                    *
                  </span>
                  <input
                    className="skc-input"
                    value={p.firstName}
                    onChange={(e) =>
                      updatePassenger(p.index, { firstName: e.target.value })
                    }
                    onBlur={() => markTouched(p.index, "firstName")}
                    placeholder="First name"
                    autoComplete="given-name"
                    aria-required="true"
                    aria-invalid={!!errorFor(p.index, "firstName", p)}
                    aria-describedby={
                      errorFor(p.index, "firstName", p)
                        ? `err-firstName-${p.index}`
                        : undefined
                    }
                  />
                  {errorFor(p.index, "firstName", p) && (
                    <span
                      id={`err-firstName-${p.index}`}
                      role="alert"
                      style={errStyle}
                    >
                      {errorFor(p.index, "firstName", p)}
                    </span>
                  )}
                </label>
                <label className="skc-label">
                  Last name{" "}
                  <span style={{ color: G.orange }} aria-hidden="true">
                    *
                  </span>
                  <input
                    className="skc-input"
                    value={p.lastName}
                    onChange={(e) =>
                      updatePassenger(p.index, { lastName: e.target.value })
                    }
                    onBlur={() => markTouched(p.index, "lastName")}
                    placeholder="Last name"
                    autoComplete="family-name"
                    aria-required="true"
                    aria-invalid={!!errorFor(p.index, "lastName", p)}
                    aria-describedby={
                      errorFor(p.index, "lastName", p)
                        ? `err-lastName-${p.index}`
                        : undefined
                    }
                  />
                  {errorFor(p.index, "lastName", p) && (
                    <span
                      id={`err-lastName-${p.index}`}
                      role="alert"
                      style={errStyle}
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
                    Date of birth{" "}
                    <span style={{ color: G.orange }} aria-hidden="true">
                      *
                    </span>
                    <input
                      className="skc-input"
                      type="date"
                      value={p.dob}
                      onChange={(e) =>
                        updatePassenger(p.index, { dob: e.target.value })
                      }
                      onBlur={() => markTouched(p.index, "dob")}
                      max={dayjs().subtract(1, "day").format("YYYY-MM-DD")}
                      aria-required="true"
                      aria-invalid={!!errorFor(p.index, "dob", p)}
                      aria-describedby={
                        errorFor(p.index, "dob", p)
                          ? `err-dob-${p.index}`
                          : undefined
                      }
                    />
                    {errorFor(p.index, "dob", p) && (
                      <span
                        id={`err-dob-${p.index}`}
                        role="alert"
                        style={errStyle}
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
                    Gender{" "}
                    <span style={{ color: G.orange }} aria-hidden="true">
                      *
                    </span>
                    <select
                      className="skc-input"
                      value={p.gender}
                      onChange={(e) =>
                        updatePassenger(p.index, { gender: e.target.value })
                      }
                      onBlur={() => markTouched(p.index, "gender")}
                      aria-required="true"
                      aria-invalid={!!errorFor(p.index, "gender", p)}
                      aria-describedby={
                        errorFor(p.index, "gender", p)
                          ? `err-gender-${p.index}`
                          : undefined
                      }
                    >
                      <option value="">Select</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                    {errorFor(p.index, "gender", p) && (
                      <span
                        id={`err-gender-${p.index}`}
                        role="alert"
                        style={errStyle}
                      >
                        {errorFor(p.index, "gender", p)}
                      </span>
                    )}
                  </label>
                </div>

                {i === 0 && (
                  <>
                    <label className="skc-label">
                      Email{" "}
                      <span style={{ color: G.orange }} aria-hidden="true">
                        *
                      </span>
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
                        aria-required="true"
                        aria-invalid={!!errorFor(p.index, "email", p)}
                        aria-describedby={
                          errorFor(p.index, "email", p)
                            ? `err-email-${p.index}`
                            : undefined
                        }
                      />
                      {errorFor(p.index, "email", p) && (
                        <span
                          id={`err-email-${p.index}`}
                          role="alert"
                          style={errStyle}
                        >
                          {errorFor(p.index, "email", p)}
                        </span>
                      )}
                    </label>
                    <label className="skc-label">
                      Phone number{" "}
                      <span style={{ color: G.orange }} aria-hidden="true">
                        *
                      </span>
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
                        aria-required="true"
                        aria-invalid={!!errorFor(p.index, "phone", p)}
                        aria-describedby={
                          errorFor(p.index, "phone", p)
                            ? `err-phone-${p.index}`
                            : undefined
                        }
                      />
                      {errorFor(p.index, "phone", p) && (
                        <span
                          id={`err-phone-${p.index}`}
                          role="alert"
                          style={errStyle}
                        >
                          {errorFor(p.index, "phone", p)}
                        </span>
                      )}
                    </label>
                  </>
                )}

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

          {fareExpired ? (
            <FareExpiredBlock onBackToResults={onBackToResults} />
          ) : (
            <button
              type="button"
              className="skc-btn-primary"
              onClick={handleContinue}
            >
              Continue to Seats →
            </button>
          )}
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
            basePrice={basePrice}
            onFareExpired={onFareExpired}
          />
        </div>
      </div>
    </div>
  );
}

function StepSeatsBags({
  onNext,
  onBack,
  basePrice,
  flight,
  passengers,
  fareExpired,
  onFareExpired,
  onBackToResults,
  prebookId,
  prebookLoading,
  prebookError,
  onServicesAttached,
  onRetryPrebook,
}) {
  // { [segmentKey]: { [passengerIndex]: { seatNumber, serviceId, price } } }
  const [selectedSeats, setSelectedSeats] = useState({});
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [activeSegmentKey, setActiveSegmentKey] = useState(null);

  // Real seat inventory for THIS prebook. LiteAPI ties seat/ancillary
  // services to a prebookId, so the parent creates the prebook when
  // Passengers submits and this effect waits for it.
  const [seatServices, setSeatServices] = useState([]);
  const [seatMapLoading, setSeatMapLoading] = useState(true);
  const [seatMapUnavailable, setSeatMapUnavailable] = useState(false);

  useEffect(() => {
    if (!prebookId) return;
    let cancelled = false;
    (async () => {
      setSeatMapLoading(true);
      setSeatMapUnavailable(false);
      try {
        const token = localStorage.getItem("token");
        const API = import.meta.env?.VITE_API_URL || "";
        const res = await fetch(`${API}/api/flights/prebook/${prebookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("seatmap request failed");
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.seats)) {
          throw new Error("seatmap not available");
        }
        setSeatServices(data.seats);
      } catch {
        // No fake fallback: showing fabricated seats/prices would be worse
        // than saying seat selection isn't available.
        if (!cancelled) {
          setSeatServices([]);
          setSeatMapUnavailable(true);
        }
      } finally {
        if (!cancelled) setSeatMapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prebookId]);

  // One entry per FLIGHT (not per direction) in the seat data, each with a
  // plain-language description. See buildSeatSegments above.
  const segments = useMemo(
    () => buildSeatSegments(seatServices, flight),
    [seatServices, flight]
  );

  // Short message that tells the customer what just happened and what is
  // next, so moving to another flight is never a surprise.
  const [notice, setNotice] = useState("");

  const segKey = segments.some((s) => s.key === activeSegmentKey)
    ? activeSegmentKey
    : segments[0].key;

  const seatsPrice = sumSeatPrices(selectedSeats);

  function handleSelectSeat(
    segmentKey,
    passengerIndex,
    seatNumber,
    serviceId,
    price
  ) {
    const next = {
      ...selectedSeats,
      [segmentKey]: {
        ...selectedSeats[segmentKey],
        [passengerIndex]: { seatNumber, serviceId, price },
      },
    };
    setSelectedSeats(next);

    // Advance to the next unseated passenger on this leg; if this leg is
    // complete, jump to the next leg that still needs seats.
    const thisSeg = segments.find((s) => s.key === segmentKey);
    const thisName = thisSeg?.shortLabel || "this flight";
    const pax = passengers[passengerIndex];
    const who =
      passengers.length > 1 ? ` for ${fullName(pax) || "your traveler"}` : "";

    const nextPax = passengers.findIndex(
      (p, i) => i > passengerIndex && !next[segmentKey][i]
    );
    if (nextPax !== -1) {
      setActivePassengerIndex(nextPax);
      const nextName = fullName(passengers[nextPax]) || "the next traveler";
      setNotice(
        `Seat ${seatNumber} saved${who} on ${thisName}. Now choose a seat for ${nextName}.`
      );
    } else {
      const nextSeg = segments.find(
        (s) =>
          s.key !== segmentKey &&
          !passengers.every((p) => next[s.key]?.[p.index])
      );
      if (nextSeg) {
        setActiveSegmentKey(nextSeg.key);
        setActivePassengerIndex(0);
        setNotice(
          `Seat ${seatNumber} saved${who} on ${thisName}. Now showing your next flight: ${
            nextSeg.shortLabel
          }${nextSeg.direction ? ` (${nextSeg.direction.toLowerCase()})` : ""}.`
        );
      } else {
        setNotice(
          `Seat ${seatNumber} saved${who} on ${thisName}. Seats are chosen on every flight.`
        );
      }
    }
  }

  const flightsSeated = countFlightsFullySeated(
    selectedSeats,
    segments,
    passengers
  );
  const someSeatsChosen = anySeats(selectedSeats);
  const notAllSeated =
    !seatMapUnavailable &&
    segments.length > 1 &&
    someSeatsChosen &&
    flightsSeated < segments.length;

  // Reserves the chosen seats with the airline against the real prebook.
  // Returns false on failure so the traveler stays on this step — they
  // never pay for seats that weren't actually reserved.
  async function attachSeatServices(seatsMap) {
    if (!prebookId) return;
    const serviceIds = collectServiceIds(seatsMap);
    if (!serviceIds.length) return;
    try {
      const token = localStorage.getItem("token");
      const API = import.meta.env?.VITE_API_URL || "";
      const res = await fetch(
        `${API}/api/flights/prebook/${prebookId}/services`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedServices: Object.values(seatsMap || {}).flatMap((seg) =>
              Object.entries(seg || {})
                .filter(([, v]) => v?.serviceId)
                .map(([pi, v]) => ({ passengerIndex: Number(pi), serviceId: v.serviceId, quantity: 1 }))
            ),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error("[attach seat services] failed:", data);
        setNotice("We couldn't reserve those seats with the airline. Pick different seats or skip seat selection.");
        return false;
      }
      // Per LiteAPI's Flight Booking Architecture guide, the
      // transactionId/secretKey returned from attach-services SUPERSEDE
      // the ones from the original prebook; /flights/bookings must use
      // transactionId_v2.
      const record = Array.isArray(data.data)
        ? data.data[0]
        : data.data || data;
      const newTransactionId =
        record?.transactionId || data.transactionId || null;
      const newSecret =
        record?.secretKey ||
        record?.paymentData?.secretKey ||
        record?.payment?.secretKey ||
        data.secretKey ||
        data.paymentData?.secretKey ||
        null;
      onServicesAttached?.(newTransactionId, newSecret);
    } catch (err) {
      console.error("[attach seat services] error:", err);
      setNotice("We couldn't reserve those seats with the airline. Pick different seats or skip seat selection.");
      return false;
    }
  }

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
            Seat selection
          </h2>

          <section style={{ marginBottom: 28 }}>
            {prebookLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: G.muted,
                }}
              >
                <span
                  className="skc-spinner"
                  style={{ width: 24, height: 24, borderWidth: 3 }}
                />
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  Reserving your fare…
                </div>
              </div>
            ) : prebookError ? (
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(248,113,113,.08)",
                  border: "1px solid rgba(248,113,113,.3)",
                  color: G.danger,
                  fontSize: 13,
                }}
              >
                We couldn't reserve this fare, so seat selection isn't
                available. See the message below to go back and try again.
              </div>
            ) : seatMapLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: G.muted,
                }}
              >
                <span
                  className="skc-spinner"
                  style={{ width: 24, height: 24, borderWidth: 3 }}
                />
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  Loading seat map…
                </div>
              </div>
            ) : seatMapUnavailable ? (
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${G.border}`,
                  color: G.muted,
                  fontSize: 13,
                }}
              >
                Seat selection isn't available for this flight right now. You
                can continue without picking seats — the airline will assign
                them at check-in.
              </div>
            ) : (
              <SkyrioSeatMap
                passengers={passengers}
                seatServices={seatServices}
                selectedSeats={selectedSeats}
                segments={segments}
                activeSegmentKey={segKey}
                notice={notice}
                onSetActiveSegment={(k) => {
                  setActiveSegmentKey(k);
                  setActivePassengerIndex(0);
                  setNotice("");
                }}
                activePassengerIndex={activePassengerIndex}
                onSetActivePassenger={setActivePassengerIndex}
                onSelectSeat={handleSelectSeat}
              />
            )}
          </section>

          <section
            data-note="skyrio-bags-note"
            style={{
              marginBottom: 28,
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${G.border}`,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <span style={{ color: G.orange, marginTop: 2 }}>
              <Luggage size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Bags are added with the airline
              </div>
              <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.5 }}>
                Your fare includes the bag allowance set by{" "}
                {flight?.outbound?.airline || "the airline"}. To add checked or
                carry-on bags, use your airline confirmation code on the
                airline's website or at check-in after booking. Skyrio doesn't
                sell bags, so you'll only ever pay the airline's own price.
              </div>
            </div>
          </section>

          <PriceSummary
            base={basePrice}
            passengers={passengers}
            seatsPrice={seatsPrice}
          />

          {fareExpired ? (
            <FareExpiredBlock onBackToResults={onBackToResults} />
          ) : prebookError ? (
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                background: "rgba(248,113,113,.08)",
                border: "1px solid rgba(248,113,113,.3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 14,
                }}
              >
                <span style={{ color: G.danger, marginTop: 1 }}>
                  <AlertTriangle size={16} />
                </span>
                <div style={{ fontSize: 13, color: G.danger }}>
                  {prebookError}
                </div>
              </div>
              {/* Temporary airline/LiteAPI hiccup → the SAME fare usually still
                  works a moment later, so offer a retry first. Sold-out fares
                  only get "Find another flight". */}
              {onRetryPrebook && !/sold out|no longer available|expired/i.test(prebookError) && (
                <button
                  type="button"
                  onClick={onRetryPrebook}
                  disabled={prebookLoading}
                  className="skc-btn-primary"
                  style={{ marginBottom: 10 }}
                >
                  {prebookLoading ? "Trying again…" : "Try again"}
                </button>
              )}
              <button
                type="button"
                onClick={onBackToResults}
                className={
                  onRetryPrebook && !/sold out|no longer available|expired/i.test(prebookError)
                    ? "skc-btn-back"
                    : "skc-btn-primary"
                }
                style={{ marginBottom: 10, width: "100%" }}
              >
                Find another flight →
              </button>
              <button
                type="button"
                onClick={onBack}
                className="skc-btn-back"
                style={{ width: "100%" }}
              >
                Edit travelers
              </button>
            </div>
          ) : (
            <>
              {notAllSeated && (
                <div
                  role="status"
                  style={{
                    padding: "12px 14px",
                    marginBottom: 14,
                    borderRadius: 12,
                    background: "rgba(255,255,255,.04)",
                    border: `1px solid ${G.border}`,
                    color: G.muted,
                    fontSize: 13,
                  }}
                >
                  You've chosen seats on {flightsSeated} of {segments.length}{" "}
                  flights. You can continue now — the airline will assign a seat
                  on the other flights at check-in.
                </div>
              )}
              <div className="skc-btn-row">
                <button type="button" className="skc-btn-back" onClick={onBack}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="skc-btn-primary"
                  style={{ flex: 1 }}
                  disabled={prebookLoading}
                  onClick={async () => {
                    if ((await attachSeatServices(selectedSeats)) === false) return;
                    onNext({
                      selectedSeats,
                      seatsPrice,
                      segments,
                    });
                  }}
                >
                  {prebookLoading ? "Reserving your fare…" : "Review & Pay →"}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button
                  type="button"
                  disabled={prebookLoading}
                  onClick={async () => {
                    await attachSeatServices({});
                    onNext({
                      selectedSeats: {},
                      seatsPrice: 0,
                    });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: G.muted,
                    fontSize: 13,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Skip seat selection
                </button>
              </div>
            </>
          )}
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar
            flight={flight}
            passengers={passengers}
            selectedSeats={selectedSeats}
            seatsPrice={seatsPrice}
            basePrice={basePrice}
            onFareExpired={onFareExpired}
            segments={segments}
          />
        </div>
      </div>
    </div>
  );
}

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
          You're booking your own seat for a group trip
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          Everyone in Sync Together books and pays for their own seat, so you
          only pay for yourself. It'll show on the trip page, and you can
          cancel it from My Trips.
        </div>
      </div>
    </div>
  );
}

function StepReviewPay({
  progressKey,
  onBack,
  passengers,
  extras,
  basePrice,
  flight,
  groupId,
  groupMemberCount,
  onGroupBookingComplete,
  fareExpired,
  onFareExpired,
  onBackToResults,
  onBookingSuccess,
  prebookId,
  transactionId,
  clientSecret,
  prebookError,
}) {
  // verify + prebook happen in the parent right after Passengers submits;
  // payment itself is handled by LiteApiPayForm.
  const { selectedSeats, seatsPrice } = extras;
  const fareTotal = passengers.reduce(
    (sum, p) => sum + basePrice * (FARE_MULTIPLIER[p.type] ?? 1),
    0
  );
  // Estimate only — LiteApiPayForm reads the exact charge from the payment.
  const total = fareTotal + seatsPrice;

  const recapRows = [
    {
      label: "Travelers",
      value: passengers
        .map((p) => fullName(p) || `Traveler ${p.index + 1}`)
        .join(", "),
    },
    ...(extras?.segments?.length
      ? extras.segments
      : [{ key: "default", shortLabel: "Your flight" }]
    )
      .map((seg) => {
        const bySeg = passengers
          .map((p) => {
            const seat = selectedSeats?.[seg.key]?.[p.index]?.seatNumber;
            return seat
              ? `${fullName(p) || `Traveler ${p.index + 1}`}: ${seat}`
              : null;
          })
          .filter(Boolean);
        return bySeg.length
          ? {
              label: `Seats · ${seg.shortLabel || seg.label}${
                seg.direction ? ` (${seg.direction.toLowerCase()})` : ""
              }`,
              value: bySeg.join(", "),
            }
          : null;
      })
      .filter(Boolean),
  ].filter(Boolean);

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
                  gap: 12,
                  padding: "9px 0",
                  borderBottom: `1px solid ${G.border}`,
                  fontSize: 14,
                }}
              >
                <span style={{ color: G.muted }}>{r.label}</span>
                <span style={{ textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </section>
          <PriceSummary
            base={basePrice}
            passengers={passengers}
            seatsPrice={seatsPrice}
          />
          {fareExpired && (
            <FareExpiredBlock onBackToResults={onBackToResults} />
          )}
          {!fareExpired && prebookError && (
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
                {prebookError}
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
          {!fareExpired && !prebookError && !clientSecret && (
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
                Setting up secure payment...
              </div>
            </div>
          )}
          {!fareExpired && !prebookError && clientSecret && (
            <>
              <LiteApiPayForm
                clientSecret={clientSecret}
                prebookId={prebookId}
                transactionId={transactionId}
                total={total}
                flight={flight}
                passengers={passengers}
                groupId={groupId}
                progressKey={progressKey}
                fareExpired={fareExpired}
                onBack={onBack}
              />
              <CancellationBadge departureDateISO={flight?.outbound?.dateISO} />
            </>
          )}
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar
            flight={flight}
            passengers={passengers}
            selectedSeats={selectedSeats}
            seatsPrice={seatsPrice}
            basePrice={basePrice}
            onFareExpired={onFareExpired}
            segments={extras?.segments || []}
          />
        </div>
      </div>
    </div>
  );
}


// Turns raw LiteAPI errors into something a traveler understands.
function friendlyFareError(raw = "") {
  if (/sold out|52010|no longer available|expired/i.test(raw)) {
    return "This fare just sold out with the airline. Let's find you another flight.";
  }
  if (/51099|52099|53099|unable to process|failed to search|failed to create prebook|timeout|timed out|didn't respond/i.test(raw)) {
    return "The airline's system didn't respond. Please try again in a moment.";
  }
  return raw || "We couldn't reserve this fare. Please pick another flight.";
}

export default function BookingCheckout({
  flight,
  onBack,
  groupId,
  groupMemberCount,
  onGroupBookingComplete,
}) {
  const liveFlight = buildFlight(flight);
  const progressKey = getProgressStorageKey(liveFlight);
  // Read once at mount so a refresh restores everything as one snapshot.
  const [restoredProgress] = useState(() => readCheckoutProgress(progressKey));

  const [step, setStep] = useState(() => restoredProgress?.step ?? 0);
  const [passengers, setPassengers] = useState(
    () => restoredProgress?.passengers ?? []
  );
  const [extras, setExtras] = useState(() => restoredProgress?.extras ?? null);

  // Prebook happens right after Passengers submits (not at Review & Pay)
  // because real seat/ancillary data only exists once a prebook exists.
  // clientSecret is deliberately NOT persisted (short-lived; refetched on resume).
  const [prebookId, setPrebookId] = useState(
    () => restoredProgress?.prebookId ?? null
  );
  const [transactionId, setTransactionId] = useState(
    () => restoredProgress?.transactionId ?? null
  );
  const [clientSecret, setClientSecret] = useState(null);
  const [prebookLoading, setPrebookLoading] = useState(false);
  const [prebookError, setPrebookError] = useState("");
  const hasStartedPrebook = useRef(false);
  // Blocks a second parallel prebook if Continue is tapped twice while
  // verify+prebook are still in flight (state alone wouldn't stop it).
  const prebookInFlightRef = useRef(false);

  // Verify the fare, then prebook it.
  const runPrebook = useCallback(
    async (passengersList) => {
      if (prebookInFlightRef.current) return;
      prebookInFlightRef.current = true;
      setPrebookLoading(true);
      setPrebookError("");
      try {
        if (!liveFlight.offerId) {
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

        const vRes = await fetch(`${API}/api/flights/verify`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ offerId: liveFlight.offerId }),
        });
        const vData = await vRes.json().catch(() => ({}));
        let verifiedOfferId = liveFlight.offerId;
        if (vRes.ok && vData.ok) {
          verifiedOfferId = vData.offerId || liveFlight.offerId;
        } else if (vData.soldOut || vData.code === 52010) {
          // The fare is really gone — stop here.
          throw new Error(
            vData.message ||
              "This fare just sold out with the airline. Let's find you another flight."
          );
        } else if (vRes.status >= 500 || [51099, 52099, "TIMEOUT"].includes(vData.code)) {
          // LiteAPI's fare check itself failed (their side). It's only a
          // safety step: prebook below re-checks price + availability, and
          // the exact charge is shown before paying. So continue.
          console.warn("[checkout] fare check unavailable — continuing to reservation", vData);
        } else {
          throw new Error(
            vData.message ||
              "This fare is no longer available. Please go back and pick a fresh result."
          );
        }

        const leadPassenger = passengersList[0];
        const prebookBody = {
          offerId: verifiedOfferId,
          contact: {
            email: leadPassenger.email,
            firstName: leadPassenger.firstName,
            lastName: leadPassenger.lastName,
            phoneNumber: leadPassenger.phone,
            phoneCountryCode: "1",
          },
          passengers: passengersList.map(toLiteApiPassenger),
          usePaymentSdk: true,
          payment: { descriptorSuffix: "FLIGHT" },
        };

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
          throw new Error(
            "Fare was reserved but we didn't get a booking reference back. Please contact support."
          );
        }

        const newTransactionId =
          prebookRecord?.transactionId || pData.transactionId || null;
        if (!newTransactionId) {
          throw new Error(
            "Fare was reserved but payment setup is missing a required reference. Please contact support."
          );
        }

        const secret =
          prebookRecord?.secretKey ||
          prebookRecord?.paymentData?.secretKey ||
          prebookRecord?.payment?.secretKey ||
          pData.secretKey ||
          pData.paymentData?.secretKey ||
          null;
        if (!secret) {
          throw new Error(
            "Fare was reserved but payment setup failed. Please contact support before trying again."
          );
        }

        setPrebookId(newPrebookId);
        setTransactionId(newTransactionId);
        setClientSecret(secret);
      } catch (err) {
        setPrebookError(friendlyFareError(err.message));
      } finally {
        prebookInFlightRef.current = false;
        setPrebookLoading(false);
      }
    },
    [liveFlight.offerId]
  );

  // Resume after a refresh mid-checkout. StepSeatsBags refetches its own
  // seat data on mount, so the only thing missing on resume is the Stripe
  // client secret. With no prebookId (e.g. progress saved before this
  // feature existed), a fresh prebook is created from restored passengers.
  useEffect(() => {
    if (hasStartedPrebook.current) return;
    if (step === 0) return; // runPrebook fires from StepPassengers' onNext instead
    hasStartedPrebook.current = true;

    if (prebookId) {
      (async () => {
        setPrebookLoading(true);
        try {
          const API = import.meta.env?.VITE_API_URL || "";
          const token = localStorage.getItem("token");
          const res = await fetch(`${API}/api/flights/prebook/${prebookId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error("Could not restore your reservation.");
          }
          // ASSUMPTION FLAGGED: the exact field name for the Stripe client
          // secret in the raw prebook-details response is unconfirmed; this
          // mirrors the fallback chain runPrebook uses. Also verify this
          // returns the v2 secret after services were attached, otherwise
          // a resumed session pairs a v2 transactionId with a v1 secret.
          const secret =
            data.raw?.secretKey ||
            data.raw?.data?.[0]?.secretKey ||
            data.raw?.data?.secretKey ||
            data.raw?.paymentData?.secretKey ||
            null;
          if (!secret) {
            throw new Error(
              "Could not restore payment setup for this reservation — please go back and search again."
            );
          }
          setClientSecret(secret);
        } catch (err) {
          setPrebookError(
            err.message ||
              "Could not restore your reservation — please go back and search again."
          );
        } finally {
          setPrebookLoading(false);
        }
      })();
    } else if (passengers.length) {
      runPrebook(passengers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Falls back to the persisted group context if the page that renders
  // this component lost its own on refresh. The prop wins when present.
  const effectiveGroupId = groupId ?? restoredProgress?.groupId ?? null;
  const effectiveGroupMemberCount =
    groupMemberCount ?? restoredProgress?.groupMemberCount ?? null;

  // Shared across all three steps: once any TripSidebar countdown fires,
  // every step's primary action is replaced with FareExpiredBlock.
  const [fareExpired, setFareExpired] = useState(false);
  const handleFareExpired = useCallback(() => setFareExpired(true), []);

  const [formDirty, setFormDirty] = useState(false);
  // True once a booking completes — nothing left to protect, and asking
  // "discard your progress?" right after paying would be confusing.
  const [bookingComplete, setBookingComplete] = useState(false);
  const handleBookingSuccess = useCallback(() => setBookingComplete(true), []);

  const hasProgress = !bookingComplete && (step > 0 || formDirty);

  // Keeps sessionStorage in sync with live state; skipped once booking
  // completes (the effect below clears the entry instead).
  useEffect(() => {
    if (!progressKey || bookingComplete) return;
    writeCheckoutProgress(progressKey, {
      step,
      passengers,
      extras,
      groupId: effectiveGroupId,
      groupMemberCount: effectiveGroupMemberCount,
      prebookId,
      transactionId,
      savedAt: Date.now(),
    });
  }, [
    progressKey,
    bookingComplete,
    step,
    passengers,
    extras,
    effectiveGroupId,
    effectiveGroupMemberCount,
    prebookId,
    transactionId,
  ]);

  useEffect(() => {
    if (bookingComplete) clearCheckoutProgress(progressKey);
  }, [bookingComplete, progressKey]);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // Every real exit clears the stored snapshot so nothing stale is resumed later.
  const exitToResults = useCallback(() => {
    clearCheckoutProgress(progressKey);
    onBack?.();
  }, [progressKey, onBack]);
  const requestExit = useCallback(() => {
    if (hasProgress) {
      setShowDiscardConfirm(true);
    } else {
      exitToResults();
    }
  }, [hasProgress, exitToResults]);
  const confirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    exitToResults();
  }, [exitToResults]);
  const cancelDiscard = useCallback(() => setShowDiscardConfirm(false), []);

  useVhFix();

  // Checkout would otherwise inherit the results page's scroll position
  // and hide its own header/back button.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Same fix for step changes within checkout.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  return (
    <div
      className="skc"
      style={{ position: "relative", minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <style>{css}</style>
      {/* Fixed, always-visible back button, pinned to the viewport. */}
      {onBack && (
        <button
          type="button"
          onClick={requestExit}
          aria-label="Back to results"
          style={{
            position: "fixed",
            top: 18,
            left: 18,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(16,12,34,0.85)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            padding: "10px 16px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
            transition: "border-color .2s, background .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,138,42,0.5)";
            e.currentTarget.style.background = "rgba(255,138,42,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            e.currentTarget.style.background = "rgba(16,12,34,0.85)";
          }}
        >
          ← Back
        </button>
      )}
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
                onClick={requestExit}
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
          {effectiveGroupId && (
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
              // Start the real reservation as Passengers is submitted so a
              // prebookId (and real seat data) exists for the Seats step.
              runPrebook(p);
            }}
            flight={liveFlight}
            basePrice={liveFlight.basePrice}
            fareExpired={fareExpired}
            onFareExpired={handleFareExpired}
            onBackToResults={exitToResults}
            onFormDirty={setFormDirty}
            initialPassengers={passengers}
            onPassengersChange={setPassengers}
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
            fareExpired={fareExpired}
            onFareExpired={handleFareExpired}
            onBackToResults={exitToResults}
            prebookId={prebookId}
            prebookLoading={prebookLoading}
            prebookError={prebookError}
            onRetryPrebook={() => runPrebook(passengers)}
            onServicesAttached={(newTransactionId, newSecret) => {
              if (newTransactionId) setTransactionId(newTransactionId);
              if (newSecret) setClientSecret(newSecret);
            }}
          />
        )}
        {step === 2 && (
          <StepReviewPay
            progressKey={progressKey}
            onBack={() => setStep(1)}
            passengers={passengers}
            extras={extras}
            basePrice={liveFlight.basePrice}
            flight={liveFlight}
            groupId={effectiveGroupId}
            groupMemberCount={effectiveGroupMemberCount}
            onGroupBookingComplete={onGroupBookingComplete}
            fareExpired={fareExpired}
            onFareExpired={handleFareExpired}
            onBackToResults={exitToResults}
            onBookingSuccess={handleBookingSuccess}
            prebookId={prebookId}
            transactionId={transactionId}
            clientSecret={clientSecret}
            prebookError={prebookError}
          />
        )}
      </div>
      {showDiscardConfirm && (
        <DiscardProgressModal
          onKeepEditing={cancelDiscard}
          onDiscard={confirmDiscard}
        />
      )}
    </div>
  );
}
