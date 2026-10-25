import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/styles/WhereToNext.css";
import { apiUrl } from "@/lib/api";

// Where To Next — "where can my budget take me from my home base?"
// Prices come from the deal cache (refreshed every few hours), so every
// price says when it was found, and tapping one runs a real live search.
//
// Two modes:
//   Flight only    → round-trip fare, 1 traveler
//   Flight + hotel → that fare + the cheapest well-rated hotel for the
//                    same dates, 1 traveler and 1 room

const TRIP_TYPES = [
  { key: "weekend", label: "Weekend trip", sub: "Fri–Sun" },
  { key: "getaway", label: "4-night getaway", sub: "Thu–Mon" },
];
const MODES = [
  { key: "flight", label: "Flight only" },
  { key: "package", label: "Flight + hotel" },
];
const BUDGET_MIN = 100;
const BUDGET_MAX = 2500;
const BUDGET_STEP = 25;

function timeAgo(date) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(date)) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

function shortDates(a, b) {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  const d1 = new Date(`${a}T00:00:00Z`).toLocaleDateString("en-US", opts);
  const d2 = new Date(`${b}T00:00:00Z`).toLocaleDateString("en-US", opts);
  return `${d1} – ${d2}`;
}

// "Fri, Nov 6 – Sun, Nov 8" for the trip summary line
function longDates(a, b) {
  const opts = {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  const d1 = new Date(`${a}T00:00:00Z`).toLocaleDateString("en-US", opts);
  const d2 = new Date(`${b}T00:00:00Z`).toLocaleDateString("en-US", opts);
  return `${d1} – ${d2}`;
}

function nightsBetween(a, b) {
  const n = Math.round(
    (new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

const money = (n) => `$${Number(n).toLocaleString("en-US")}`;

// Ticket-stub pin: "Miami | $142" — city names read easier than codes
function pinIcon(city, price, { active, dim }) {
  return L.divIcon({
    className: "",
    html: `<div class="wtn-pin${active ? " is-active" : ""}${
      dim ? " is-dim" : ""
    }">
      <span class="wtn-pin__code">${city}</span>
      <span class="wtn-pin__price">${money(price)}</span>
    </div>`,
    iconSize: null,
    iconAnchor: [34, 30],
  });
}

const PlaneIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);

const BedIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 18V6M2 11h18a2 2 0 0 1 2 2v5M2 16h20" />
    <circle cx="7" cy="8.5" r="1.8" />
  </svg>
);

export default function WhereToNext({ homeCode, homeCity }) {
  const nav = useNavigate();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const [tripType, setTripType] = useState("weekend");
  const [mode, setMode] = useState("flight");
  const [budget, setBudget] = useState(300);
  const [warmOnly, setWarmOnly] = useState(false);
  const [view, setView] = useState("map");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);

  const withHotel = mode === "package";

  // ── Load cached deals for this home base ──
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setSelected(null);
    const params = new URLSearchParams({ origin: homeCode, tripType });
    fetch(apiUrl(`/api/deals?${params}`), { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((err) => {
        if (err?.name !== "AbortError") setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [homeCode, tripType]);

  // The number shown everywhere: the fare, or fare + hotel.
  const priceOf = (d) => (withHotel ? d.tripTotal : d.price);

  const allDeals = data?.deals || [];
  const deals = useMemo(() => {
    let list = allDeals;
    if (withHotel) list = list.filter((d) => d.tripTotal != null);
    // Warm = the city's typical high is 75°F+ in the month of the trip.
    if (warmOnly) list = list.filter((d) => d.climate?.warm);
    return [...list].sort((a, b) =>
      withHotel ? a.tripTotal - b.tripTotal : a.price - b.price
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, warmOnly, withHotel]);

  const inBudget = deals.filter((d) => priceOf(d) <= budget);
  // Lowest price on the map right now. Trips that TIE for it all count
  // as cheapest (deals are sorted by price, so the first one has it).
  const lowestPrice = deals.length ? priceOf(deals[0]) : null;
  // Every trip of one type shares the same dates, so any deal gives them.
  const tripDates = allDeals[0]
    ? longDates(allDeals[0].departDate, allDeals[0].returnDate)
    : null;
  const hasDeals = deals.length > 0;
  const noFares = !loading && allDeals.length === 0;
  const noHotels =
    !noFares && withHotel && !allDeals.some((d) => d.tripTotal != null);
  const tripLabel =
    tripType === "weekend" ? "weekend trips" : "4-night getaways";

  // Switching to Flight + hotel: a flight-sized budget would hide every
  // trip, so start it at a sensible trip-sized number.
  const chooseMode = (next) => {
    setMode(next);
    setSelected(null);
    if (next === "package" && budget < 700) setBudget(700);
  };

  // ── Map: create once there are trips to show ──
  // `loading` is in the deps on purpose: while trips load, the map box is
  // taken off the page and a NEW box appears afterwards. The cleanup below
  // removes the old map, and this rebuilds it on the new box — otherwise
  // pins and tiles get drawn on a map nobody can see (blank box).
  useEffect(() => {
    if (
      loading ||
      view !== "map" ||
      !hasDeals ||
      !mapEl.current ||
      mapRef.current
    )
      return;
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([33, -75], 3);
    // OpenStreetMap tiles (no key needed), turned dark in CSS (.wtn__map
    // .leaflet-tile-pane) to match the dark-glass theme.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 10,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Measure the box once it's laid out, so tiles fill it fully.
    const sizeFix = setTimeout(() => map.invalidateSize(), 0);
    return () => {
      clearTimeout(sizeFix);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [view, hasDeals, loading]);

  // ── Map: redraw pins when deals / budget / selection / mode change ──
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // Tapped trip: dashed orange line from the departure airport, plus a
    // small dot marking home, so the whole trip reads at a glance.
    if (selected?.from) {
      L.polyline([selected.from, [selected.lat, selected.lng]], {
        color: "#ff8a2a",
        weight: 2.5,
        opacity: 0.9,
        dashArray: "6 8",
        interactive: false,
      }).addTo(layer);
      L.circleMarker(selected.from, {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#ff8a2a",
        fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
    }

    deals.forEach((deal) => {
      const price = priceOf(deal);
      const marker = L.marker([deal.lat, deal.lng], {
        icon: pinIcon(deal.city, price, {
          active: selected?.destination === deal.destination,
          dim: price > budget,
        }),
        keyboard: true,
        title: `${deal.city}, ${money(price)}`,
        zIndexOffset: price <= budget ? 500 : 0,
      });
      marker.on("click", () => setSelected(deal));
      marker.addTo(layer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, budget, selected, view, hasDeals, withHotel, loading]);

  // Opens the booking page and runs the live search. Flight + hotel uses
  // the booking page's package flow (flight first, then "find your stay").
  const seeLivePrice = (deal) => {
    const params = new URLSearchParams({
      tab: "Flights",
      kind: withHotel ? "package" : "flight",
      from: deal.fromCode,
      fromName: deal.fromCode === homeCode ? homeCity : deal.fromCode,
      to: deal.destination,
      toName: deal.city,
      depart: deal.departDate,
      return: deal.returnDate,
      prompt: deal.city,
      auto: "1",
    });
    nav(`/booking?${params}`);
  };

  return (
    <section className="wtn" aria-label="Where To Next">
      <div className="wtn__head">
        <div className="wtn__kicker">Where To Next</div>
        <h2 className="wtn__title">
          Where can <span>{money(budget)}</span> take you from {homeCode}?
        </h2>
        <p className="wtn__sub">
          {withHotel
            ? "Round-trip flight plus a well-rated hotel for the same dates, for one traveler and one room, found by Skyrio in the last day. Prices change often, so tap a trip to see today's live prices before you book."
            : "The lowest round-trip fares Skyrio found in the last day, for one traveler, including taxes and fees. Fares change often, so tap a trip to see today's live price before you book."}
        </p>
      </div>

      {data?.preview && (
        <div className="wtn__preview" role="note">
          Preview: these are test prices while Skyrio finishes setup. They
          aren't real prices yet.
        </div>
      )}

      {/* What every price on the map means, in one line */}
      {tripDates && (
        <div className="wtn__summary">
          <span>
            <PlaneIcon /> From {homeCode}
          </span>
          <span>{tripDates}</span>
          <span>1 traveler{withHotel ? " · 1 room" : ""}</span>
          <span>Economy</span>
        </div>
      )}

      <div className="wtn__controls">
        <div
          className="wtn__toggle wtn__toggle--mode"
          role="tablist"
          aria-label="What to include"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              className={mode === m.key ? "is-on" : ""}
              onClick={() => chooseMode(m.key)}
            >
              {m.key === "flight" ? (
                <PlaneIcon />
              ) : (
                <>
                  <PlaneIcon /> <BedIcon />
                </>
              )}{" "}
              {m.label}
            </button>
          ))}
        </div>

        <label className="wtn__budget">
          <span className="wtn__label">My budget</span>
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            aria-valuetext={money(budget)}
          />
          <strong>{money(budget)}</strong>
        </label>

        <div className="wtn__chips">
          {TRIP_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`wtn-chip${tripType === t.key ? " is-on" : ""}`}
              onClick={() => setTripType(t.key)}
            >
              {t.label} <em>{t.sub}</em>
            </button>
          ))}
          <button
            type="button"
            className={`wtn-chip${warmOnly ? " is-on" : ""}`}
            onClick={() => setWarmOnly((v) => !v)}
            disabled={noFares}
            title={
              noFares
                ? "Available once prices are loaded"
                : "Places where the typical high is 75°F or warmer in the month of your trip"
            }
          >
            Warm weather
          </button>
        </div>

        <div className="wtn__toggle" role="tablist" aria-label="View">
          {["map", "list"].map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={view === v ? "is-on" : ""}
              disabled={noFares}
              title={noFares ? "Available once prices are loaded" : undefined}
              onClick={() => {
                setView(v);
                setSelected(null);
              }}
            >
              {v === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
      </div>

      <div className="wtn__count">
        {loading
          ? "Loading trips…"
          : failed
          ? "Couldn't load trips right now."
          : hasDeals
          ? `${inBudget.length} of ${deals.length} trips fit your budget`
          : ""}
      </div>

      {loading ? null : noFares ? (
        // No fares for this trip type yet: a small note, not a blank map.
        <div className="wtn__empty">
          No {tripLabel} from {homeCode} yet. New prices are added every few
          hours, so check back soon, or tell Atlas your budget above.
        </div>
      ) : noHotels ? (
        // Flights are in, hotel prices aren't yet.
        <div className="wtn__empty">
          Hotel prices for {tripLabel} aren't in yet. They're added every few
          hours.{" "}
          <button
            type="button"
            className="wtn__linkBtn"
            onClick={() => chooseMode("flight")}
          >
            Show flights only
          </button>
        </div>
      ) : !hasDeals ? (
        // Prices exist, but the Warm weather filter hid them all.
        <div className="wtn__empty">
          None of the {tripLabel} from {homeCode} are usually 75°F or warmer at
          that time of year.{" "}
          <button
            type="button"
            className="wtn__linkBtn"
            onClick={() => setWarmOnly(false)}
          >
            Show all trips
          </button>
        </div>
      ) : view === "map" ? (
        <div className="wtn__mapWrap">
          <div ref={mapEl} className="wtn__map" />
          {selected && (
            <DealSheet
              deal={selected}
              withHotel={withHotel}
              homeCode={homeCode}
              budget={budget}
              isCheapest={
                lowestPrice != null && priceOf(selected) === lowestPrice
              }
              onClose={() => setSelected(null)}
              onGo={() => seeLivePrice(selected)}
            />
          )}
        </div>
      ) : (
        <ul className="wtn__list">
          {deals.map((d) => (
            <li key={d.destination}>
              <button
                type="button"
                className={`wtn-row${priceOf(d) > budget ? " is-dim" : ""}`}
                onClick={() => seeLivePrice(d)}
              >
                <span className="wtn-row__stub">
                  <PlaneIcon /> {d.fromCode} → {d.destination}
                </span>
                <span className="wtn-row__city">
                  {d.city}
                  <small>
                    {shortDates(d.departDate, d.returnDate)}
                    {d.climate ? ` · usually ${d.climate.avgHighF}°F` : ""}
                    {withHotel && d.hotel ? ` · ${d.hotel.name}` : ""} · found{" "}
                    {timeAgo(d.foundAt)}
                  </small>
                </span>
                <span className="wtn-row__price">
                  {money(priceOf(d))}
                  {withHotel ? (
                    <small className="is-plain">flight + hotel</small>
                  ) : (
                    d.savesVsHome > 0 && (
                      <small>
                        ${d.savesVsHome} less than {homeCode}
                      </small>
                    )
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DealSheet({
  deal,
  withHotel,
  homeCode,
  budget,
  isCheapest,
  onClose,
  onGo,
}) {
  const fromOther = deal.fromCode !== homeCode;
  const hotel = withHotel ? deal.hotel : null;
  const shown = hotel ? deal.tripTotal : deal.price;
  const nights = nightsBetween(deal.departDate, deal.returnDate);
  const stops =
    deal.stops == null
      ? null
      : deal.stops === 0
      ? "Nonstop"
      : `${deal.stops} stop${deal.stops > 1 ? "s" : ""}`;

  return (
    <div className="wtn-sheet" role="dialog" aria-label={`${deal.city} trip`}>
      <button
        type="button"
        className="wtn-sheet__close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div className="wtn-sheet__route">
        <PlaneIcon /> {deal.fromCode} → {deal.destination}
      </div>
      <div className="wtn-sheet__city">{deal.city}</div>
      {/* Only facts we can back up from the data */}
      {(isCheapest || deal.stops === 0) && (
        <div className="wtn-sheet__tags">
          {isCheapest && (
            <span className="wtn-tag is-green">Cheapest on the map</span>
          )}
          {deal.stops === 0 && <span className="wtn-tag">Nonstop</span>}
        </div>
      )}
      <div className="wtn-sheet__price">
        {money(shown)}{" "}
        <span>
          {hotel ? "total · 1 traveler, 1 room" : "round trip"} · found{" "}
          {timeAgo(deal.foundAt)}
        </span>
      </div>
      <div className="wtn-sheet__meta">
        {shortDates(deal.departDate, deal.returnDate)}
        {nights ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
      </div>
      {deal.climate && (
        <div className="wtn-sheet__meta">
          Usually around {deal.climate.avgHighF}°F in {deal.climate.month}{" "}
          (typical high, not a forecast)
        </div>
      )}

      {hotel ? (
        <div className="wtn-sheet__parts">
          <div className="wtn-sheet__part">
            <span>
              <PlaneIcon /> Flight
              <small>
                {[stops, deal.airline].filter(Boolean).join(" · ") ||
                  "Round trip"}
              </small>
            </span>
            <strong>{money(deal.price)}</strong>
          </div>
          <div className="wtn-sheet__part">
            <span>
              <BedIcon /> {hotel.name}
              <small>
                {[
                  hotel.stars ? `${hotel.stars}-star` : null,
                  hotel.rating ? `${hotel.rating}/10 guest rating` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            <strong>{money(hotel.price + (hotel.payAtHotel || 0))}</strong>
          </div>
          {/* The hotel line includes fees paid at check-in, so it adds up
              to the total. Say how it splits so nothing is a surprise. */}
          {hotel.payAtHotel > 0 && (
            <div className="wtn-sheet__meta">
              Hotel: {money(hotel.price)} when you book +{" "}
              {money(hotel.payAtHotel)} in fees paid at the hotel.
            </div>
          )}
        </div>
      ) : (
        <div className="wtn-sheet__meta">
          {[stops, deal.airline].filter(Boolean).join(" · ")}
        </div>
      )}

      {!hotel && fromOther && deal.savesVsHome > 0 && (
        <div className="wtn-sheet__tip">
          When we checked, flying from {deal.fromCode} was about $
          {deal.savesVsHome} less than from {homeCode}.
        </div>
      )}
      {shown > budget && (
        <div className="wtn-sheet__tip is-over">
          {money(shown - budget)} over your budget.
        </div>
      )}
      <button type="button" className="wtn-sheet__go" onClick={onGo}>
        {hotel ? "See live prices" : "See live price"}
      </button>
    </div>
  );
}
