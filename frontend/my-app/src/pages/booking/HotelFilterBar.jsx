import React, { useMemo, useState } from "react";
import {
  FilterDropdown,
  ApplyBtn,
  PanelLabel,
  RadioRow,
} from "./SmartFilterBar";

// ─────────────────────────────────────────────
// Stays filters — every option is built from fields LiteAPI actually returns
// on each room offer: hotelId/name, totalAmount, stars, rating (out of 10),
// refundableTag (RFN / NRFN) and boardName (meal plan).
// ─────────────────────────────────────────────

export const DEFAULT_HOTEL_FILTERS = {
  hotel: "any", // hotelId
  price: "any", // max total stay price
  stars: "any", // minimum stars
  rating: "any", // minimum guest rating (/10)
  refundable: "any", // "any" | "refundable"
  board: "any", // exact boardName, e.g. "Breakfast Included"
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function applyHotelFilters(hotels, f) {
  return hotels.filter((h) => {
    if (f.hotel !== "any" && String(h.hotelId) !== String(f.hotel))
      return false;
    if (f.price !== "any" && (num(h.totalAmount) ?? Infinity) > Number(f.price))
      return false;
    // Hotels without a star/rating value can't prove they meet the minimum, so they're hidden.
    if (f.stars !== "any" && (num(h.stars) ?? 0) < Number(f.stars))
      return false;
    if (f.rating !== "any" && (num(h.rating) ?? 0) < Number(f.rating))
      return false;
    if (f.refundable === "refundable" && h.refundableTag !== "RFN")
      return false;
    if (f.board !== "any" && (h.boardName || "Room only") !== f.board)
      return false;
    return true;
  });
}

export const HOTEL_SORT_OPTIONS = [
  { key: "price", label: "Cheapest" },
  { key: "rating", label: "Top rated" },
  { key: "stars", label: "Most stars" },
];

export function compareHotels(sortKey) {
  const price = (h) => num(h.totalAmount) ?? Infinity;
  if (sortKey === "rating")
    return (a, b) =>
      (num(b.rating) ?? -1) - (num(a.rating) ?? -1) || price(a) - price(b);
  if (sortKey === "stars")
    return (a, b) =>
      (num(b.stars) ?? -1) - (num(a.stars) ?? -1) || price(a) - price(b);
  return (a, b) => price(a) - price(b);
}

// ─────────────────────────────────────────────
// Panels
// ─────────────────────────────────────────────

// options can carry `count` (how many hotels match). An option that matches
// nothing is grayed out, so a filter can never leave an empty page. "Any"
// options have no count and are always available.
function OptionsPanel({ title, value, options, onChange, close, note }) {
  const [local, setLocal] = useState(value);
  const countLabel = (n) => `${n} hotel${n === 1 ? "" : "s"}`;
  return (
    <>
      <PanelLabel>{title}</PanelLabel>
      {note && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            margin: "-6px 0 8px",
            lineHeight: 1.4,
          }}
        >
          {note}
        </div>
      )}
      {options.map((o) => {
        const empty = o.count === 0;
        return (
          <div
            key={String(o.val)}
            style={empty ? { opacity: 0.35, pointerEvents: "none" } : undefined}
            aria-disabled={empty || undefined}
            title={empty ? "No hotels in these results match" : undefined}
          >
            <RadioRow
              checked={String(local) === String(o.val)}
              onClick={() => !empty && setLocal(o.val)}
            >
              <span
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                }}
              >
                <span>{o.label}</span>
                {o.count != null && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.45)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {countLabel(o.count)}
                  </span>
                )}
              </span>
            </RadioRow>
          </div>
        );
      })}
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </>
  );
}

// Pick one specific hotel. Searchable, because a city search can return dozens.
function HotelPanel({ value, onChange, close, hotels }) {
  const [local, setLocal] = useState(value);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? hotels.filter((h) => h.name.toLowerCase().includes(q)) : hotels;
  }, [hotels, query]);

  return (
    <div style={{ width: 300, maxWidth: "100%" }}>
      <PanelLabel>Hotel</PanelLabel>
      {hotels.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            padding: "2px 4px",
            lineHeight: 1.4,
          }}
        >
          Search for stays to choose from the hotels in your destination.
        </div>
      ) : (
        <>
          {hotels.length > 6 && (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hotel name"
              aria-label="Search hotel name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 8,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
          )}
          <RadioRow checked={local === "any"} onClick={() => setLocal("any")}>
            Any hotel
          </RadioRow>
          <div
            style={{
              maxHeight: 260,
              overflowY: "auto",
              marginRight: -8,
              paddingRight: 8,
            }}
          >
            {shown.map((h) => (
              <RadioRow
                key={h.id}
                checked={String(local) === String(h.id)}
                onClick={() => setLocal(h.id)}
              >
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {h.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                      fontWeight: 400,
                    }}
                  >
                    {h.stars ? `${h.stars}★ · ` : ""}
                    {h.rooms} room option{h.rooms !== 1 ? "s" : ""}
                    {Number.isFinite(h.from)
                      ? ` · from $${Math.round(h.from).toLocaleString()}`
                      : ""}
                  </span>
                </span>
              </RadioRow>
            ))}
            {shown.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  padding: "6px 4px",
                }}
              >
                No hotel matches "{query}".
              </div>
            )}
          </div>
        </>
      )}
      <ApplyBtn
        onClick={() => {
          onChange(local);
          close();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main HotelFilterBar
// ─────────────────────────────────────────────
export default function HotelFilterBar({
  filters,
  onChange,
  hotelResults = [],
  visible = true,
}) {
  // Hooks first — see the note in SmartFilterBar about returning early.

  // One entry per hotel (a hotel can have several room offers).
  const hotels = useMemo(() => {
    const map = new Map();
    hotelResults.forEach((r) => {
      if (!r.hotelId) return;
      const price = num(r.totalAmount);
      const cur = map.get(r.hotelId);
      if (cur) {
        cur.rooms += 1;
        if (price != null && price < cur.from) cur.from = price;
      } else {
        map.set(r.hotelId, {
          id: r.hotelId,
          name: r.name || "Unnamed hotel",
          stars: num(r.stars),
          rating: num(r.rating),
          rooms: 1,
          from: price ?? Infinity,
          refundable: r.refundableTag === "RFN",
        });
      }
      // A hotel counts as refundable if ANY of its room offers is.
      if (cur && r.refundableTag === "RFN") cur.refundable = true;
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [hotelResults]);

  // How many HOTELS (not room offers) each option would keep — shown next
  // to the option, and used to gray out ones that would show nothing.
  const counts = useMemo(() => {
    const atLeast = (key, min) =>
      hotels.filter((h) => (h[key] ?? 0) >= min).length;
    return {
      stars: {
        3: atLeast("stars", 3),
        4: atLeast("stars", 4),
        5: atLeast("stars", 5),
      },
      rating: {
        7: atLeast("rating", 7),
        8: atLeast("rating", 8),
        9: atLeast("rating", 9),
      },
      price: Object.fromEntries(
        [200, 400, 800, 1500].map((p) => [
          p,
          hotels.filter((h) => h.from <= p).length,
        ])
      ),
      refundable: hotels.filter((h) => h.refundable).length,
    };
  }, [hotels]);

  const boards = useMemo(
    () =>
      [...new Set(hotelResults.map((r) => r.boardName || "Room only"))].sort(),
    [hotelResults]
  );

  const update = (key) => (val) => onChange({ ...filters, [key]: val });

  const hotelName = hotels.find(
    (h) => String(h.id) === String(filters.hotel)
  )?.name;

  const labels = {
    hotel:
      filters.hotel === "any" ? "Hotel" : `Hotel · ${hotelName ?? "Selected"}`,
    price:
      filters.price === "any"
        ? "Price"
        : `Price · Under $${Number(filters.price).toLocaleString()}`,
    stars:
      filters.stars === "any"
        ? "Stars"
        : `Stars · ${Number(filters.stars) >= 5 ? "5" : `${filters.stars}+`}★`,
    rating:
      filters.rating === "any" ? "Guest rating" : `Rating · ${filters.rating}+`,
    refundable:
      filters.refundable === "any" ? "Cancellation" : "Refundable only",
    board: filters.board === "any" ? "Meals" : `Meals · ${filters.board}`,
  };

  // No hotels yet (before a search): nothing to filter, so no filter row.
  // Keeps empty dropdowns from covering the buttons underneath.
  if (!visible || hotelResults.length === 0) return null;

  const truncate = {
    display: "inline-block",
    maxWidth: 220,
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "bottom",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        padding: "12px 0 4px",
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          alignSelf: "center",
          marginRight: 4,
        }}
      >
        FILTERS
      </div>

      <FilterDropdown
        label={<span style={truncate}>{labels.hotel}</span>}
        active={filters.hotel !== "any"}
      >
        {(close) => (
          <HotelPanel
            value={filters.hotel}
            onChange={update("hotel")}
            close={close}
            hotels={hotels}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={labels.price} active={filters.price !== "any"}>
        {(close) => (
          <OptionsPanel
            title="Max price (total stay)"
            value={filters.price}
            onChange={update("price")}
            close={close}
            options={[
              { val: "any", label: "Any price" },
              { val: 200, label: "Under $200", count: counts.price[200] },
              { val: 400, label: "Under $400", count: counts.price[400] },
              { val: 800, label: "Under $800", count: counts.price[800] },
              { val: 1500, label: "Under $1,500", count: counts.price[1500] },
            ]}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={labels.stars} active={filters.stars !== "any"}>
        {(close) => (
          <OptionsPanel
            title="Hotel class"
            value={filters.stars}
            onChange={update("stars")}
            close={close}
            options={[
              { val: "any", label: "Any stars" },
              { val: 3, label: "3★ and up", count: counts.stars[3] },
              { val: 4, label: "4★ and up", count: counts.stars[4] },
              { val: 5, label: "5★ only", count: counts.stars[5] },
            ]}
          />
        )}
      </FilterDropdown>

      <FilterDropdown label={labels.rating} active={filters.rating !== "any"}>
        {(close) => (
          <OptionsPanel
            title="Guest rating"
            value={filters.rating}
            onChange={update("rating")}
            close={close}
            options={[
              { val: "any", label: "Any rating" },
              { val: 7, label: "Good · 7+", count: counts.rating[7] },
              { val: 8, label: "Very good · 8+", count: counts.rating[8] },
              { val: 9, label: "Excellent · 9+", count: counts.rating[9] },
            ]}
          />
        )}
      </FilterDropdown>

      <FilterDropdown
        label={labels.refundable}
        active={filters.refundable !== "any"}
        align="right"
      >
        {(close) => (
          <OptionsPanel
            title="Cancellation"
            value={filters.refundable}
            onChange={update("refundable")}
            close={close}
            options={[
              { val: "any", label: "Any policy" },
              {
                val: "refundable",
                label: "Refundable only",
                count: counts.refundable,
              },
            ]}
          />
        )}
      </FilterDropdown>

      {boards.length > 1 && (
        <FilterDropdown
          label={<span style={truncate}>{labels.board}</span>}
          active={filters.board !== "any"}
          align="right"
        >
          {(close) => (
            <OptionsPanel
              title="Meals"
              value={filters.board}
              onChange={update("board")}
              close={close}
              options={[
                { val: "any", label: "Any meal plan" },
                ...boards.map((b) => ({ val: b, label: b })),
              ]}
            />
          )}
        </FilterDropdown>
      )}
    </div>
  );
}
