import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/styles/WhereToNext.css";
import { apiUrl } from "@/lib/api";

// Where To Next — "where can my budget take me from my home base?"
// Prices come from the deal cache (refreshed every few hours), so every
// price says when it was found, and tapping one runs a real live search.

const TRIP_TYPES = [
  { key: "weekend", label: "Weekend trip", sub: "Fri–Sun" },
  { key: "getaway", label: "4-night getaway", sub: "Thu–Mon" },
];
const BUDGET_MIN = 100;
const BUDGET_MAX = 1000;
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

// Ticket-stub pin: "MIA | $142"
function pinIcon(deal, { active, dim }) {
  return L.divIcon({
    className: "",
    html: `<div class="wtn-pin${active ? " is-active" : ""}${
      dim ? " is-dim" : ""
    }">
      <span class="wtn-pin__code">${deal.destination}</span>
      <span class="wtn-pin__price">$${deal.price}</span>
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

export default function WhereToNext({ homeCode, homeCity }) {
  const nav = useNavigate();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const [tripType, setTripType] = useState("weekend");
  const [budget, setBudget] = useState(300);
  const [warmOnly, setWarmOnly] = useState(false);
  const [view, setView] = useState("map");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);

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

  const deals = useMemo(() => {
    const list = data?.deals || [];
    return warmOnly ? list.filter((d) => d.tags?.includes("warm")) : list;
  }, [data, warmOnly]);
  const inBudget = deals.filter((d) => d.price <= budget);
  const hasDeals = deals.length > 0;

  // ── Map: create once there are trips to show ──
  useEffect(() => {
    if (view !== "map" || !hasDeals || !mapEl.current || mapRef.current) return;
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
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [view, hasDeals]);

  // ── Map: redraw pins when deals / budget / selection change ──
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    deals.forEach((deal) => {
      const marker = L.marker([deal.lat, deal.lng], {
        icon: pinIcon(deal, {
          active: selected?.destination === deal.destination,
          dim: deal.price > budget,
        }),
        keyboard: true,
        title: `${deal.city}, $${deal.price}`,
        zIndexOffset: deal.price <= budget ? 500 : 0,
      });
      marker.on("click", () => setSelected(deal));
      marker.addTo(layer);
    });
  }, [deals, budget, selected, view, hasDeals]);

  const seeLivePrice = (deal) => {
    const params = new URLSearchParams({
      tab: "Flights",
      kind: "flight",
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
          Where can <span>${budget}</span> take you from {homeCode}?
        </h2>
        <p className="wtn__sub">
          The lowest round-trip fares Skyrio found in the last day, for one
          traveler, including taxes and fees. Fares change often, so tap a trip
          to see today's live price before you book.
        </p>
      </div>

      {data?.preview && (
        <div className="wtn__preview" role="note">
          Preview: these are test fares while Skyrio finishes setup. They aren't
          real prices yet.
        </div>
      )}

      <div className="wtn__controls">
        <label className="wtn__budget">
          <span className="wtn__label">My budget</span>
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            aria-valuetext={`$${budget}`}
          />
          <strong>${budget}</strong>
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
          : deals.length === 0
          ? ""
          : `${inBudget.length} of ${deals.length} trips fit your budget`}
      </div>

      {!hasDeals ? (
        // No trips yet: a small note instead of a big empty map.
        <div className="wtn__empty">
          New fares from {homeCode} are added every few hours. Check back soon,
          or tell Atlas your budget above.
        </div>
      ) : view === "map" ? (
        <div className="wtn__mapWrap">
          <div ref={mapEl} className="wtn__map" />
          {selected && (
            <DealSheet
              deal={selected}
              homeCode={homeCode}
              budget={budget}
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
                className={`wtn-row${d.price > budget ? " is-dim" : ""}`}
                onClick={() => seeLivePrice(d)}
              >
                <span className="wtn-row__stub">
                  <PlaneIcon /> {d.fromCode} → {d.destination}
                </span>
                <span className="wtn-row__city">
                  {d.city}
                  <small>
                    {shortDates(d.departDate, d.returnDate)} · found{" "}
                    {timeAgo(d.foundAt)}
                  </small>
                </span>
                <span className="wtn-row__price">
                  ${d.price}
                  {d.savesVsHome > 0 && (
                    <small>
                      ${d.savesVsHome} less than {homeCode}
                    </small>
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

function DealSheet({ deal, homeCode, budget, onClose, onGo }) {
  const fromOther = deal.fromCode !== homeCode;
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
      <div className="wtn-sheet__price">
        ${deal.price} <span>round trip · found {timeAgo(deal.foundAt)}</span>
      </div>
      <div className="wtn-sheet__meta">
        {shortDates(deal.departDate, deal.returnDate)}
        {deal.stops != null &&
          ` · ${
            deal.stops === 0
              ? "Nonstop"
              : `${deal.stops} stop${deal.stops > 1 ? "s" : ""}`
          }`}
        {deal.airline && ` · ${deal.airline}`}
      </div>
      {fromOther && deal.savesVsHome > 0 && (
        <div className="wtn-sheet__tip">
          When we checked, flying from {deal.fromCode} was about $
          {deal.savesVsHome} less than from {homeCode}.
        </div>
      )}
      {deal.price > budget && (
        <div className="wtn-sheet__tip is-over">
          ${deal.price - budget} over your budget.
        </div>
      )}
      <button type="button" className="wtn-sheet__go" onClick={onGo}>
        See live price
      </button>
    </div>
  );
}
