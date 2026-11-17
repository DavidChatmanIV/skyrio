// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useEffect, useRef } from "react";
import { Typography, Button, Select } from "antd";
import { SearchOutlined, LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Users } from "lucide-react";

export function crispLogo(url) {
  const u = String(url || "");
  // pics.avs.io/64/64/B6.png → /200/200/B6@2x.png
  if (/pics\.avs\.io\/\d+\/\d+\//.test(u))
    return u
      .replace(/pics\.avs\.io\/\d+\/\d+\//, "pics.avs.io/200/200/")
      .replace(/(\/[A-Z0-9]{2})(?:@2x)?\.png/i, "$1@2x.png");
  // images.kiwi.com/airlines/64/B6.png → /128/
  if (/images\.kiwi\.com\/airlines\/\d+\//.test(u))
    return u.replace(/airlines\/\d+\//, "airlines/128/");
  return u;
}

// Whole-dollar price with thousands commas: 1165 → "1,165". "—" if unknown.
export const wholeUsd = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : "—";
};

export const { Title, Text } = Typography;
export const { Option } = Select;

export const API = import.meta.env.VITE_API_URL || "";

export function IconHotel({ size = 14 }) {
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

export function IconFlight({ size = 14 }) {
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

export function IconCar({ size = 14 }) {
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

export function IconWarning({ size = 14 }) {
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
export const RESULTS_PER_PAGE = 5;
export const MAX_ROOMS_PER_TRIP = 8;

export function getAutoSearchDates(tripDays = 10) {
  return {
    departDate: dayjs().add(14, "day").format("YYYY-MM-DD"),
    returnDate: dayjs()
      .add(14 + tripDays, "day")
      .format("YYYY-MM-DD"),
  };
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

export function SearchBtn({ onClick, loading }) {
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

export function airportLabel(ap) {
  if (!ap?.code) return "";
  const city = String(ap.city || "").trim();
  return city && city.toUpperCase() !== ap.code.toUpperCase()
    ? `${city} (${ap.code})`
    : ap.code;
}

// "2 travelers, 1 room" in a single control, like the big travel sites.
export function GuestsRoomsPicker({ adults, rooms, maxRooms, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Stepper = ({ label, sub, value, min, max, onSet }) => (
    <div className="sk-guests-row">
      <div>
        <div className="sk-guests-row-label">{label}</div>
        {sub && <div className="sk-guests-row-sub">{sub}</div>}
      </div>
      <div className="sk-guests-stepper">
        <button
          type="button"
          onClick={() => onSet(value - 1)}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          −
        </button>
        <span aria-live="polite">{value}</span>
        <button
          type="button"
          onClick={() => onSet(value + 1)}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="sk-guests" ref={ref}>
      <button
        type="button"
        className="sk-guests-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Users size={17} style={{ opacity: 0.7, flexShrink: 0 }} />
        <span>
          {adults} traveler{adults !== 1 ? "s" : ""}, {rooms} room
          {rooms !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div
          className="sk-guests-pop"
          role="dialog"
          aria-label="Travelers and rooms"
        >
          {Stepper({
            label: "Travelers",
            sub: "Adults",
            value: adults,
            min: Math.max(1, rooms),
            max: 40,
            onSet: (v) => onChange({ adults: v, rooms }),
          })}
          {Stepper({
            label: "Rooms",
            sub: "Each room needs at least 1 traveler",
            value: rooms,
            min: 1,
            max: Math.min(maxRooms, adults),
            onSet: (v) => onChange({ adults, rooms: v }),
          })}
          <button
            type="button"
            className="sk-guests-done"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export const CABINS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First Class" },
];

// "1 traveler · Economy" in one control for the Flights pass.
export function TravelersCabinPicker({ adults, cabin, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cabinLabel = CABINS.find((c) => c.value === cabin)?.label ?? "Economy";

  return (
    <div className="sk-guests" ref={ref}>
      <button
        type="button"
        className="sk-guests-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Users size={17} style={{ opacity: 0.7, flexShrink: 0 }} />
        <span>
          {adults} traveler{adults !== 1 ? "s" : ""} · {cabinLabel}
        </span>
      </button>
      {open && (
        <div
          className="sk-guests-pop"
          role="dialog"
          aria-label="Travelers and cabin"
        >
          <div className="sk-guests-row">
            <div>
              <div className="sk-guests-row-label">Travelers</div>
              <div className="sk-guests-row-sub">Adults · up to 9</div>
            </div>
            <div className="sk-guests-stepper">
              <button
                type="button"
                onClick={() => onChange({ adults: adults - 1, cabin })}
                disabled={adults <= 1}
                aria-label="Fewer travelers"
              >
                −
              </button>
              <span aria-live="polite">{adults}</span>
              <button
                type="button"
                onClick={() => onChange({ adults: adults + 1, cabin })}
                disabled={adults >= 9}
                aria-label="More travelers"
              >
                +
              </button>
            </div>
          </div>
          <div className="sk-guests-row sk-guests-row--stack">
            <div className="sk-guests-row-label">Cabin</div>
            <div
              className="sk-cabin-options"
              role="radiogroup"
              aria-label="Cabin"
            >
              {CABINS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={cabin === c.value}
                  className={`sk-cabin-opt${
                    cabin === c.value ? " is-active" : ""
                  }`}
                  onClick={() => onChange({ adults, cabin: c.value })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="sk-guests-done"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// Weekend shortcuts: Friday → Sunday (or Saturday → Sunday if it's already Saturday).
export function weekendRange(weeksAhead = 0) {
  const today = dayjs().startOf("day");
  const dow = today.day(); // 0 Sun … 6 Sat
  let start;
  if (dow === 6) {
    // Saturday: "this weekend" starts today; later weekends start on the coming Fridays.
    start =
      weeksAhead === 0 ? today : today.add(6 + 7 * (weeksAhead - 1), "day");
  } else {
    start = today.day(5).add(7 * weeksAhead, "day");
  }
  const end = start.day() === 6 ? start.add(1, "day") : start.add(2, "day");
  return [start, end];
}
