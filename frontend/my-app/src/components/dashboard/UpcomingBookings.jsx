import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton, Button } from "antd";
import { useAuth } from "@/auth/useAuth";
import { apiUrl } from "@/lib/api";

/* ── Styles live here so this stays a single drop-in file ──────────
   Compact "ticket stub" rows that match the Book page boarding pass. */
const UB_CSS = `
.ub { padding: 14px 14px 12px; border-radius: 16px; background: rgba(16,11,34,0.6); border: 1px solid rgba(255,255,255,0.1); }
.ub__head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 12px; margin-bottom:10px; }
.ub__title { display:inline-flex; align-items:center; gap:7px; margin:0; color:#fff; font-size:15px; font-weight:800; letter-spacing:-0.01em; }
.ub__title svg { color:#ffb347; }

/* Filter dropdown */
.ub__filter { position:relative; display:inline-flex; align-items:center; }
.ub__filter select { appearance:none; -webkit-appearance:none; height:34px; padding:0 32px 0 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff; font-family:"DM Sans",sans-serif; font-size:13px; font-weight:600; cursor:pointer; }
.ub__filter select:hover { border-color:rgba(255,138,42,0.5); }
.ub__filter select:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }
.ub__filter select option { background:#1a1233; color:#fff; }
.ub__filter svg { position:absolute; right:11px; pointer-events:none; color:rgba(255,255,255,0.7); }

.ub__list { display:flex; flex-direction:column; gap:8px; }

.ub-row { all:unset; box-sizing:border-box; display:flex; align-items:stretch; width:100%; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); cursor:pointer; transition:border-color .18s, background .18s; }
.ub-row:hover { border-color:rgba(255,138,42,0.45); background:rgba(255,138,42,0.06); }
.ub-row:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }

.ub-row__main { flex:1; min-width:0; display:flex; align-items:center; gap:10px; padding:9px 12px; }
.ub-row__icon { flex-shrink:0; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#ffb347; background:rgba(255,138,42,0.12); border:1px solid rgba(255,138,42,0.28); }
.ub-row__body { min-width:0; flex:1; }
.ub-row__name { color:#fff; font-size:13.5px; font-weight:700; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ub-row__meta { margin-top:3px; display:flex; flex-wrap:wrap; align-items:center; gap:3px 10px; font-size:12px; color:rgba(255,255,255,0.68); }
.ub-row__meta > span { display:inline-flex; align-items:center; gap:4px; }
.ub-row__meta b { color:#fff; font-weight:600; font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace; letter-spacing:0.03em; }

.ub-tag { display:inline-flex; align-items:center; gap:4px; height:19px; padding:0 7px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:0.02em; border:1px solid rgba(255,255,255,0.16); color:rgba(255,255,255,0.85); background:rgba(255,255,255,0.05); }
.ub-tag--ok { color:#6ee7a8; border-color:rgba(110,231,168,0.35); background:rgba(110,231,168,0.1); }
.ub-tag--warn { color:#ffc27a; border-color:rgba(255,180,107,0.4); background:rgba(255,138,42,0.12); }
.ub-tag--group { color:#c4b5fd; border-color:rgba(167,139,250,0.4); background:rgba(167,139,250,0.12); }

/* Perforated stub with the price */
.ub-row__stub { flex-shrink:0; width:112px; display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:2px; padding:8px 12px; border-left:2px dashed rgba(255,255,255,0.14); }
.ub-row__price { color:#ff9a47; font-size:15px; font-weight:800; font-variant-numeric:tabular-nums; }
.ub-row__manage { display:inline-flex; align-items:center; gap:3px; font-size:11.5px; font-weight:600; color:rgba(255,255,255,0.62); }
.ub-row:hover .ub-row__manage { color:#ffb347; }

.ub__more { all:unset; box-sizing:border-box; margin-top:8px; width:100%; min-height:38px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:10px; border:1px dashed rgba(255,255,255,0.18); color:rgba(255,255,255,0.8); font-size:13px; font-weight:700; cursor:pointer; }
.ub__more:hover { border-color:rgba(255,138,42,0.5); color:#ffb347; }
.ub__more:focus-visible { outline:2px solid #ff8a2a; outline-offset:2px; }

.ub__empty { text-align:center; padding:10px 0 4px; }
.ub__emptyText { display:block; color:rgba(255,255,255,0.65); margin-bottom:10px; font-size:13px; }
.ub__error { color:#ff9b9b; }

@media (max-width: 600px) {
  .ub { padding:12px 10px 10px; border-radius:14px; }
  .ub__title { font-size:14px; }
  .ub__filter select { height:32px; font-size:12.5px; }
  .ub-row__main { padding:8px 10px; gap:9px; align-items:flex-start; }
  .ub-row__icon { width:26px; height:26px; margin-top:1px; }
  .ub-row__name { font-size:13px; }
  .ub-row__meta { font-size:11.5px; }
  .ub-row__stub { width:auto; min-width:84px; padding:8px 10px; }
  .ub-row__price { font-size:14px; }
}
`;

/* ── Icons (stroke SVG, replaces the emoji) ── */
function Svg({ size = 16, children }) {
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
    >
      {children}
    </svg>
  );
}
const PlaneIcon = (p) => (
  <Svg {...p}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </Svg>
);
const BedIcon = (p) => (
  <Svg {...p}>
    <path d="M2 18V6M2 11h18a2 2 0 0 1 2 2v5M2 16h20" />
    <circle cx="7" cy="8.5" r="1.8" />
  </Svg>
);
const BagIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
  </Svg>
);
const PinIcon = (p) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
const ShipIcon = (p) => (
  <Svg {...p}>
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M19.4 17 21 12H3l1.6 5M12 12V4M8 8h8" />
  </Svg>
);
const CarIcon = (p) => (
  <Svg {...p}>
    <path d="M5 17h14M5 17a2 2 0 1 1-4 0v-4l2-5h18l2 5v4a2 2 0 1 1-4 0" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
  </Svg>
);
const CompassIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Svg>
);
const CalendarIcon = (p) => (
  <Svg size={13} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </Svg>
);
const HashIcon = (p) => (
  <Svg size={13} {...p}>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </Svg>
);
const UsersIcon = (p) => (
  <Svg size={12} {...p}>
    <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.5" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
  </Svg>
);
const UserIcon = (p) => (
  <Svg size={12} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </Svg>
);
const ChevronIcon = ({ flip }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={flip ? { transform: "rotate(180deg)" } : undefined}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ArrowIcon = (p) => (
  <Svg size={13} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

const TYPE_ICON = {
  Flight: PlaneIcon,
  Hotel: BedIcon,
  Package: BagIcon,
  Place: PinIcon,
  Cruise: ShipIcon,
  Car: CarIcon,
};

// Dates are stored as midnight UTC (e.g. 2026-11-20T00:00:00Z). Formatting in
// UTC keeps New York users from seeing the day before their real departure.
function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtMoney(amount, currency = "USD") {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

// tripDetails often repeats the dates ("Hotel · 2026-11-20 → 2026-11-24 ·
// shared room"). The dates already have their own line, so drop that part.
function titleFor(b) {
  const raw = b.tripDetails || b.hotelName || `${b.type || "Trip"} booking`;
  return raw
    .replace(/\s*·\s*\d{4}-\d{2}-\d{2}\s*(→|->|–|-)\s*\d{4}-\d{2}-\d{2}/g, "")
    .trim();
}

function StatusTag({ status }) {
  if (status === "cancel_pending")
    return <span className="ub-tag ub-tag--warn">Cancellation pending</span>;
  if (status === "confirmed")
    return <span className="ub-tag ub-tag--ok">Confirmed</span>;
  return <span className="ub-tag">{status}</span>;
}

const UpcomingBookings = () => {
  const nav = useNavigate();
  const { token, isAuthed } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (signal) => {
      if (!isAuthed) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl("/api/bookings/upcoming"), {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || `Request failed (${res.status})`);
        setBookings(Array.isArray(data.bookings) ? data.bookings : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("[UpcomingBookings]", err);
        setError("We couldn't load your trips right now.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [isAuthed, token]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // ── Filter + "show more" ──
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const PREVIEW_COUNT = 3;

  // Options are built from the trips you actually have, with counts —
  // a filter with 0 trips is never offered.
  const filterOptions = useMemo(() => {
    const isGroupTrip = (b) => b.kind === "group" || !!b.syncGroup;
    const opts = [
      { value: "all", label: "All trips", test: () => true },
      { value: "solo", label: "Solo", test: (b) => !isGroupTrip(b) },
      { value: "group", label: "Group trips", test: isGroupTrip },
      { value: "Flight", label: "Flights", test: (b) => b.type === "Flight" },
      { value: "Hotel", label: "Hotels", test: (b) => b.type === "Hotel" },
      {
        value: "Package",
        label: "Packages",
        test: (b) => b.type === "Package",
      },
      { value: "Place", label: "Places", test: (b) => b.type === "Place" },
      { value: "Cruise", label: "Cruises", test: (b) => b.type === "Cruise" },
      { value: "Car", label: "Cars", test: (b) => b.type === "Car" },
    ];
    return opts
      .map((o) => ({ ...o, count: bookings.filter(o.test).length }))
      .filter((o) => o.value === "all" || o.count > 0);
  }, [bookings]);

  const activeOption =
    filterOptions.find((o) => o.value === filter) || filterOptions[0];
  const filtered = activeOption ? bookings.filter(activeOption.test) : [];
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filtered.length - visible.length;

  // A filter that no longer has trips (e.g. after a cancellation) falls back to All
  useEffect(() => {
    if (!filterOptions.some((o) => o.value === filter)) setFilter("all");
  }, [filterOptions, filter]);

  return (
    <section className="ub" aria-label="Your upcoming trips">
      <style>{UB_CSS}</style>

      <div className="ub__head">
        <h3 className="ub__title">
          <PlaneIcon size={17} /> Your upcoming trips
        </h3>
        {!loading && !error && bookings.length > 0 && (
          <label className="ub__filter">
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              Filter trips
            </span>
            <select
              value={activeOption?.value || "all"}
              onChange={(e) => {
                setFilter(e.target.value);
                setShowAll(false);
              }}
            >
              {filterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.count})
                </option>
              ))}
            </select>
            <ChevronIcon />
          </label>
        )}
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        // Never fall through to the empty state on an error — that hid this bug before.
        <div className="ub__empty">
          <span className="ub__emptyText ub__error">{error}</span>
          <Button onClick={() => load()}>Try again</Button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="ub__empty">
          <span className="ub__emptyText">
            You don't have any upcoming trips yet.
          </span>
          <Button
            type="primary"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Plan a trip
          </Button>
        </div>
      ) : (
        <>
          <div className="ub__list">
            {visible.map((b) => {
              const start = fmtDate(b.startDate);
              const end = fmtDate(b.endDate);
              const paid = fmtMoney(b.total, b.totalCurrency || "USD");
              const code = b.confirmation;
              const isGroup = b.kind === "group" || !!b.syncGroup;
              const TypeIcon = TYPE_ICON[b.type] || CompassIcon;
              const name = titleFor(b);

              return (
                <button
                  key={b._id}
                  type="button"
                  className="ub-row"
                  onClick={() => nav("/saved-trips")}
                  aria-label={`Manage ${name}`}
                >
                  <div className="ub-row__main">
                    <span className="ub-row__icon">
                      <TypeIcon size={15} />
                    </span>
                    <div className="ub-row__body">
                      <div className="ub-row__name" title={name}>
                        {name}
                      </div>
                      <div className="ub-row__meta">
                        {start && (
                          <span>
                            <CalendarIcon />
                            {start}
                            {end && end !== start ? ` → ${end}` : ""}
                          </span>
                        )}
                        {code && (
                          <span>
                            <HashIcon />
                            <b>{code}</b>
                          </span>
                        )}
                        <StatusTag status={b.status} />
                        <span
                          className={`ub-tag${isGroup ? " ub-tag--group" : ""}`}
                        >
                          {isGroup ? <UsersIcon /> : <UserIcon />}
                          {isGroup ? "Group" : "Solo"}
                        </span>
                        {b.sharedRoom && (
                          <span className="ub-tag ub-tag--group">
                            Shared room
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ub-row__stub">
                    {paid && <span className="ub-row__price">{paid}</span>}
                    <span className="ub-row__manage">
                      Manage <ArrowIcon />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {(hiddenCount > 0 ||
            (showAll && filtered.length > PREVIEW_COUNT)) && (
            <button
              type="button"
              className="ub__more"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll
                ? "Show fewer"
                : `Show ${hiddenCount} more trip${
                    hiddenCount !== 1 ? "s" : ""
                  }`}
              <ChevronIcon flip={showAll} />
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default UpcomingBookings;
