import { useMemo, useRef, useState } from "react";
import { Baby, PawPrint, Users, Sparkles } from "lucide-react";

/**
 * SkyrioSeatMap
 * ------------------------------------------------------------------
 * Matches BookingCheckout.jsx's G token palette (purple/orange dark theme).
 *
 * Props:
 * - passengers: Passenger[]  { index, firstName, lastName, type: 'ADT'|'CHD'|'INF', hasPet }
 * - seatServices: SeatService[]  { seatNumber, serviceId, available, price?, tier?, segmentKey? }
 *     (produced by parsePrebookSeatOptions on the backend)
 * - selectedSeats: { [segmentKey]: { [passengerIndex]: { seatNumber, serviceId, price } } }
 * - segments: [{ key, label, index, total, direction, flightNumber, departLabel,
 *     layoverAt?, connectingFrom? }] one entry per FLIGHT. Tabs render when > 1.
 * - notice: string  short status message shown above the tabs.
 * - activeSegmentKey / onSetActiveSegment(segmentKey)
 * - knownOccupancy: { [segmentKey]: { [seatNumber]: { type?, hasPet? } } }  OPTIONAL
 *     other Skyrio bookings on the same flight. The "avoid kids/pets" switch
 *     only appears when this has data for the leg.
 * - activePassengerIndex / onSetActivePassenger(passengerIndex)
 * - onSelectSeat(segmentKey, passengerIndex, seatNumber, serviceId, price)
 * - onClearSeat(segmentKey, passengerIndex)  OPTIONAL. When given, clicking
 *     your own selected seat again removes it.
 * - autoAdvance: boolean (default true)  after a pick, jump to the next
 *     traveler on this flight who has no seat yet.
 * - isGroupTrip / groupSeats / friendsWithoutSeat  (Sync Together)
 * - stickyTop: number (default 80)  px from the top of the screen where
 *     the seat bar pins while scrolling; set it to your site header height.
 * - columns / rows / aisleAfter: OPTIONAL overrides. aisleAfter can be a
 *     column letter or an array of letters (wide-body jets have two aisles).
 *     When omitted, everything is derived from the active leg's seat data.
 *
 * Passengers are looked up by their .index (never array position), so the
 * parent can pass a filtered list, e.g. without lap infants.
 * ------------------------------------------------------------------
 */

const G = {
  bgCard: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.10)",
  orange: "#f97316",
  muted: "rgba(255,255,255,0.5)",
  soft: "rgba(255,255,255,0.74)",
  green: "#34d399",
  violet: "#a78bfa",
  amber: "#F2C200",
};

// One look per seat type: a tinted fill plus a matching edge. Unavailable
// seats get neither, so the cabin never reads as "all one colour".
const TIER = {
  standard: {
    label: "Standard",
    tint: "rgba(255,255,255,0.06)",
    edge: "rgba(255,255,255,0.16)",
  },
  "extra-legroom": {
    label: "Extra legroom",
    tint: "rgba(124,58,237,0.20)",
    edge: "rgba(167,139,250,0.6)",
  },
  "exit-row": {
    label: "Exit row",
    tint: "rgba(242,194,0,0.10)",
    edge: "rgba(242,194,0,0.5)",
  },
  premium: {
    label: "Front row",
    tint: "rgba(249,115,22,0.16)",
    edge: "rgba(249,115,22,0.6)",
  },
};
const TIER_ORDER = ["standard", "extra-legroom", "exit-row", "premium"];

const DEFAULT_COLUMNS = ["A", "B", "C", "D", "E", "F"];
const DEFAULT_ROWS = [11, 12, 13, 14, 15];
const SEAT = 38; // seat size in px

const CSS = `
  .skm-pick { transition: background .15s ease, border-color .15s ease, color .15s ease; }
  .skm-pick:hover { background: rgba(249,115,22,0.2) !important; border-color: rgba(249,115,22,0.75) !important; color: #fff !important; }
  .skm-pick:focus-visible, .skm-pref:focus-visible { outline: 2px solid ${G.orange}; outline-offset: 2px; }
  .skm-pref:not([aria-pressed="true"]):hover { color: #fff !important; }
  .skm-seat { transition: transform .12s ease, background .15s ease, border-color .15s ease; }
  .skm-seat:not(:disabled):hover { transform: translateY(-1px); }
  .skm-seat:focus-visible { outline: 2px solid ${G.orange}; outline-offset: 2px; }
  .skm-pop { animation: skm-pop .28s ease; }
  @keyframes skm-pop { 0% { transform: scale(.82); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
  .skm-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  @media (prefers-reduced-motion: reduce) { .skm-seat, .skm-pop { transition: none; animation: none; } }
`;

function seatKey(row, col) {
  return `${row}${col}`;
}

function parseSeatNumber(seatNumber) {
  const m = /^(\d+)([A-Za-z]+)$/.exec(String(seatNumber || "").trim());
  return m ? { row: parseInt(m[1], 10), col: m[2].toUpperCase() } : null;
}

function fullName(p) {
  return (
    [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
    `Traveler ${(p?.index ?? 0) + 1}`
  );
}

function firstName(p) {
  return p?.firstName || fullName(p);
}

function initials(p) {
  return (
    `${p?.firstName?.[0] ?? ""}${p?.lastName?.[0] ?? ""}`.toUpperCase() || "?"
  );
}

function tierOf(svc) {
  return TIER[svc?.tier] ? svc.tier : "standard";
}

function formatPrice(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

// Short price for inside a seat: $16, $9, $120.
function seatPriceTag(n) {
  const v = Number(n) || 0;
  return v > 0 ? `$${Math.round(v)}` : "";
}

// Single aisle up to 6 across; two aisles for wide-bodies
// (2-3-2, 2-4-2, 3-3-3, 3-4-3).
function defaultAisles(columns) {
  const n = columns.length;
  if (n <= 2) return [];
  if (n <= 6) return [columns[Math.ceil(n / 2) - 1]];
  const side = n >= 9 ? 3 : 2;
  return [columns[side - 1], columns[n - side - 1]];
}

function isChildType(t) {
  return t === "CHD" || t === "INF";
}

// Airlines don't seat children or travelers with a pet in exit rows.
function exitRowRestricted(p) {
  return isChildType(p?.type) || p?.hasPet === true;
}

export default function SkyrioSeatMap({
  columns: columnsProp,
  rows: rowsProp,
  aisleAfter: aisleAfterProp,
  passengers = [],
  seatServices = [],
  selectedSeats = {},
  knownOccupancy = {},
  segments = [],
  activeSegmentKey = null,
  notice = "",
  onSetActiveSegment = () => {},
  activePassengerIndex = 0,
  onSetActivePassenger = () => {},
  onSelectSeat = () => {},
  onClearSeat,
  autoAdvance = true,
  isGroupTrip = false,
  groupSeats = {},
  friendsWithoutSeat = {},
  stickyTop = 80,
}) {
  const [avoidKidsPets, setAvoidKidsPets] = useState(false);
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [pickPref, setPickPref] = useState("any"); // any | window | aisle
  const [pickMessage, setPickMessage] = useState("");
  const [justPicked, setJustPicked] = useState(null);
  const gridRef = useRef(null);

  const byIndex = useMemo(() => {
    const m = new Map();
    passengers.forEach((p) => m.set(p.index, p));
    return m;
  }, [passengers]);

  // Everything below is scoped to one flight leg.
  const segKey = activeSegmentKey ?? segments[0]?.key ?? "default";
  const legSelected = selectedSeats[segKey] ?? {};
  const legKnown = knownOccupancy[segKey] ?? {};
  const legFriends = groupSeats[segKey] ?? {};
  const legFriendsNoSeat = friendsWithoutSeat[segKey] ?? [];
  const hasOtherBookings = Object.keys(legKnown).length > 0;
  const activePassenger = byIndex.get(activePassengerIndex);
  const activeRestricted = exitRowRestricted(activePassenger);

  const scopedSeatServices = useMemo(() => {
    const hasSegments = seatServices.some((s) => s.segmentKey);
    if (!hasSegments) return seatServices;
    return seatServices.filter((s) => s.segmentKey === segKey);
  }, [seatServices, segKey]);

  const seatServiceByNumber = useMemo(() => {
    const map = new Map();
    scopedSeatServices.forEach((s) => map.set(s.seatNumber, s));
    return map;
  }, [scopedSeatServices]);

  const { rows, columns } = useMemo(() => {
    const rowSet = new Set();
    const colSet = new Set();
    scopedSeatServices.forEach((s) => {
      const parsed = parseSeatNumber(s.seatNumber);
      if (parsed) {
        rowSet.add(parsed.row);
        colSet.add(parsed.col);
      }
    });
    const derivedRows = [...rowSet].sort((a, b) => a - b);
    const derivedCols = [...colSet].sort();
    return {
      rows: rowsProp ?? (derivedRows.length ? derivedRows : DEFAULT_ROWS),
      columns:
        columnsProp ?? (derivedCols.length ? derivedCols : DEFAULT_COLUMNS),
    };
  }, [scopedSeatServices, rowsProp, columnsProp]);

  const aisles = useMemo(() => {
    if (aisleAfterProp == null) return defaultAisles(columns);
    return Array.isArray(aisleAfterProp) ? aisleAfterProp : [aisleAfterProp];
  }, [aisleAfterProp, columns]);
  const aisleIdxs = aisles.map((c) => columns.indexOf(c)).filter((i) => i >= 0);
  const hasAisleAfter = (col) => aisles.includes(col);
  const sectionOf = (ci) => aisleIdxs.filter((a) => a < ci).length;

  function seatPosition(seat) {
    const parsed = parseSeatNumber(seat);
    if (!parsed) return "";
    const ci = columns.indexOf(parsed.col);
    if (ci === 0 || ci === columns.length - 1) return "Window";
    if (aisleIdxs.includes(ci) || aisleIdxs.includes(ci - 1)) return "Aisle";
    return "Middle";
  }

  // Cheapest price per tier, among seats that can actually be chosen.
  const tierPrices = useMemo(() => {
    const out = {};
    scopedSeatServices.forEach((s) => {
      if (s.available === false) return;
      const tier = tierOf(s);
      const price = Number(s.price) || 0;
      out[tier] = Math.min(out[tier] ?? Infinity, price);
    });
    return out;
  }, [scopedSeatServices]);

  // A row takes the tier most of its seats have.
  const rowTier = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const counts = {};
      columns.forEach((c) => {
        const svc = seatServiceByNumber.get(seatKey(row, c));
        if (svc) counts[tierOf(svc)] = (counts[tierOf(svc)] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      map.set(row, top ? top[0] : "standard");
    });
    return map;
  }, [rows, columns, seatServiceByNumber]);

  const partyOccupiedSeats = useMemo(() => {
    const map = new Map();
    Object.entries(legSelected).forEach(([passengerIndex, sel]) => {
      if (sel?.seatNumber) map.set(sel.seatNumber, Number(passengerIndex));
    });
    return map;
  }, [legSelected]);

  const flaggedSeats = useMemo(() => {
    const flagged = new Set();
    partyOccupiedSeats.forEach((passengerIndex, seat) => {
      const p = byIndex.get(passengerIndex);
      if (isChildType(p?.type) || p?.hasPet) flagged.add(seat);
    });
    Object.entries(legKnown).forEach(([seat, occ]) => {
      if (isChildType(occ?.type) || occ?.hasPet) flagged.add(seat);
    });
    return flagged;
  }, [partyOccupiedSeats, byIndex, legKnown]);

  // Only other people's kids/pets count — never block a traveler from
  // sitting next to their own child.
  const avoidZone = useMemo(() => {
    if (!avoidKidsPets || !hasOtherBookings) return new Set();
    const zone = new Set();
    Object.entries(legKnown).forEach(([seat, occ]) => {
      if (!(isChildType(occ?.type) || occ?.hasPet)) return;
      const parsed = parseSeatNumber(seat);
      if (!parsed) return;
      const colIdx = columns.indexOf(parsed.col);
      for (let r = parsed.row - 1; r <= parsed.row + 1; r++) {
        for (let c = colIdx - 1; c <= colIdx + 1; c++) {
          if (columns[c]) zone.add(seatKey(r, columns[c]));
        }
      }
    });
    return zone;
  }, [avoidKidsPets, hasOtherBookings, legKnown, columns]);

  const seatFeeTotal = useMemo(
    () =>
      Object.values(selectedSeats).reduce(
        (sum, leg) =>
          sum +
          Object.values(leg || {}).reduce(
            (s, sel) => s + (Number(sel?.price) || 0),
            0
          ),
        0
      ),
    [selectedSeats]
  );

  // Can the traveler being seated right now take this seat?
  function isFreeSeat(seat) {
    const svc = seatServiceByNumber.get(seat);
    if (!svc || svc.available === false) return false;
    if (legFriends[seat] || legKnown[seat]) return false;
    if (avoidZone.has(seat)) return false;
    if (activeRestricted && tierOf(svc) === "exit-row") return false;
    const holder = partyOccupiedSeats.get(seat);
    return holder === undefined || holder === activePassengerIndex;
  }

  function choose(seat, svc) {
    setPickMessage("");
    setJustPicked(seat);
    onSelectSeat(
      segKey,
      activePassengerIndex,
      seat,
      svc.serviceId,
      svc.price ?? 0
    );
    if (!autoAdvance) return;
    const next = passengers.find(
      (p) =>
        p.index !== activePassengerIndex && !legSelected[p.index]?.seatNumber
    );
    if (next) onSetActivePassenger(next.index);
  }

  // Closest free seat to someone: same row and same section first, then
  // across the aisle, then the row in front / behind.
  function seatNextTo(otherSeat) {
    const parsed = parseSeatNumber(otherSeat);
    if (!parsed) return null;
    const ci = columns.indexOf(parsed.col);
    if (ci === -1) return null;
    const mySection = sectionOf(ci);
    const byDistance = columns
      .map((c, i) => ({ c, i, d: Math.abs(i - ci) }))
      .filter((x) => x.d > 0)
      .sort(
        (a, b) =>
          Number(sectionOf(a.i) !== mySection) -
            Number(sectionOf(b.i) !== mySection) || a.d - b.d
      );
    for (const { c } of byDistance) {
      const seat = seatKey(parsed.row, c);
      if (isFreeSeat(seat)) return seat;
    }
    for (const r of [parsed.row - 1, parsed.row + 1]) {
      const seat = seatKey(r, parsed.col);
      if (isFreeSeat(seat)) return seat;
    }
    return null;
  }

  function sitNextTo(otherSeat) {
    const seat = seatNextTo(otherSeat);
    const svc = seat ? seatServiceByNumber.get(seat) : null;
    if (seat && svc) choose(seat, svc);
  }

  // "Pick for me": next to your own party if someone's already seated on
  // this flight, otherwise the cheapest seat matching the preference,
  // avoiding middles, closest to the front — and out of exit rows when
  // the party includes a child or a pet.
  const partyHasRestricted = passengers.some(exitRowRestricted);
  function pickForMe() {
    const partner = [...partyOccupiedSeats.entries()].find(
      ([, idx]) => idx !== activePassengerIndex
    );
    if (partner && pickPref === "any") {
      const seat = seatNextTo(partner[0]);
      if (seat) return choose(seat, seatServiceByNumber.get(seat));
    }
    const candidates = [];
    rows.forEach((row) =>
      columns.forEach((col) => {
        const seat = seatKey(row, col);
        if (!isFreeSeat(seat)) return;
        if (partyOccupiedSeats.get(seat) === activePassengerIndex) return;
        const pos = seatPosition(seat);
        if (pickPref !== "any" && pos.toLowerCase() !== pickPref) return;
        const svc = seatServiceByNumber.get(seat);
        // Families stay together: if anyone in the party can't use an exit
        // row, don't put the others there either.
        if (partyHasRestricted && tierOf(svc) === "exit-row") return;
        candidates.push({
          seat,
          svc,
          price: Number(svc.price) || 0,
          middle: pos === "Middle",
          row,
        });
      })
    );
    candidates.sort(
      (a, b) =>
        a.price - b.price ||
        Number(a.middle) - Number(b.middle) ||
        a.row - b.row
    );
    const best = candidates[0];
    if (best) {
      choose(best.seat, best.svc);
    } else {
      setPickMessage(
        pickPref === "any"
          ? "No open seats left on this flight."
          : `No open ${pickPref} seats left — try "Any".`
      );
    }
  }

  // Arrow keys move between seats, skipping ones that can't be chosen.
  function onGridKeyDown(e) {
    const dirs = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = dirs[e.key];
    const cur = parseSeatNumber(e.target?.dataset?.seat);
    if (!d || !cur) return;
    e.preventDefault();
    let ri = rows.indexOf(cur.row);
    let ci = columns.indexOf(cur.col);
    for (;;) {
      ri += d[0];
      ci += d[1];
      if (ri < 0 || ri >= rows.length || ci < 0 || ci >= columns.length) return;
      const el = gridRef.current?.querySelector(
        `[data-seat="${seatKey(rows[ri], columns[ci])}"]`
      );
      if (el && !el.disabled) {
        el.focus();
        return;
      }
    }
  }

  function describeSeat(seat) {
    const svc = seatServiceByNumber.get(seat);
    const price = svc?.price > 0 ? `+$${formatPrice(svc.price)}` : "Included";
    return [seat, seatPosition(seat), TIER[tierOf(svc)].label, price]
      .filter(Boolean)
      .join(" · ");
  }

  function renderCell(row, col) {
    const seat = seatKey(row, col);
    const seatService = seatServiceByNumber.get(seat);
    const tier = TIER[tierOf(seatService)];
    const isKnown = Boolean(seatService);
    const isAvailable = seatService?.available !== false;

    const ownPassengerIndex = partyOccupiedSeats.get(seat);
    const isOwnParty = ownPassengerIndex !== undefined;
    const ownPassenger = isOwnParty ? byIndex.get(ownPassengerIndex) : null;

    const known = legKnown[seat];
    const isChild = isChildType(ownPassenger?.type) || isChildType(known?.type);
    const hasPet = ownPassenger?.hasPet === true || known?.hasPet === true;

    const isSelectedForActive =
      legSelected[activePassengerIndex]?.seatNumber === seat;
    const isAvoided = avoidZone.has(seat) && !isOwnParty;
    const isExitBlocked =
      !isOwnParty &&
      activeRestricted &&
      tierOf(seatService) === "exit-row" &&
      isAvailable;

    let bg = tier.tint;
    let border = tier.edge;
    let color = "rgba(255,255,255,0.78)";
    let content = (
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: -0.2 }}>
        {seatPriceTag(seatService?.price)}
      </span>
    );
    let disabled = false;

    if (!isKnown || !isAvailable) {
      bg = "rgba(255,255,255,0.015)";
      border = "rgba(255,255,255,0.04)";
      content = <span style={{ opacity: 0.25 }}>×</span>;
      disabled = true;
    } else if (isOwnParty) {
      bg = "rgba(249,115,22,0.16)";
      border = G.orange;
      color = "#fff";
      content = isChild ? (
        <Baby size={15} />
      ) : hasPet ? (
        <PawPrint size={15} />
      ) : (
        initials(ownPassenger)
      );
      if (ownPassengerIndex !== activePassengerIndex) disabled = true;
    } else if (legFriends[seat]) {
      bg = "rgba(167,139,250,0.2)";
      border = G.violet;
      color = "#fff";
      content = (
        <span style={{ fontSize: 11 }}>
          {String(legFriends[seat].name || "?")
            .slice(0, 2)
            .toUpperCase()}
        </span>
      );
      disabled = true;
    } else if (known) {
      bg = "rgba(255,255,255,0.015)";
      border = "rgba(255,255,255,0.04)";
      content = isChild ? (
        <Baby size={14} style={{ opacity: 0.6 }} />
      ) : hasPet ? (
        <PawPrint size={14} style={{ opacity: 0.6 }} />
      ) : (
        <span style={{ opacity: 0.25 }}>×</span>
      );
      disabled = true;
    }

    if ((isAvoided || isExitBlocked) && !disabled) {
      bg = "rgba(255,255,255,0.015)";
      border = "rgba(255,255,255,0.06)";
      disabled = true;
      content = <span style={{ opacity: 0.25 }}>—</span>;
    }

    const canClear = isSelectedForActive && typeof onClearSeat === "function";
    const isHovered = hoveredSeat === seat && !disabled && !isSelectedForActive;
    if (isHovered) {
      bg = "rgba(249,115,22,0.18)";
      border = "rgba(249,115,22,0.75)";
      color = "#fff";
    }
    if (isSelectedForActive) {
      border = G.orange;
      bg = "#fff";
      color = "#1b1024";
    }

    function handleClick() {
      if (disabled) return;
      if (isSelectedForActive) {
        if (canClear) onClearSeat(segKey, activePassengerIndex);
        return;
      }
      choose(seat, seatService);
    }

    const friendHere = !isOwnParty ? legFriends[seat] : null;
    const accessibleLabel = friendHere
      ? `Seat ${seat}, ${friendHere.name}'s seat`
      : isExitBlocked
      ? `Seat ${seat}, exit row — not allowed for children or travelers with a pet`
      : isAvoided
      ? `Seat ${seat}, near a child or pet, hidden`
      : isOwnParty && !isSelectedForActive
      ? `Seat ${seat}, taken by ${fullName(ownPassenger)}`
      : disabled
      ? `Seat ${seat}, unavailable`
      : `${describeSeat(seat)}${
          isSelectedForActive
            ? canClear
              ? ", selected. Press again to remove"
              : ", selected"
            : ""
        }`;

    return (
      <button
        key={seat}
        type="button"
        data-seat={seat}
        className={`skm-seat${
          isSelectedForActive && justPicked === seat ? " skm-pop" : ""
        }`}
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={() => !disabled && setHoveredSeat(seat)}
        onMouseLeave={() => setHoveredSeat((s) => (s === seat ? null : s))}
        onFocus={() => !disabled && setHoveredSeat(seat)}
        onBlur={() => setHoveredSeat((s) => (s === seat ? null : s))}
        aria-label={accessibleLabel}
        aria-pressed={isSelectedForActive}
        title={accessibleLabel}
        style={{
          width: SEAT,
          height: SEAT,
          borderRadius: "10px 10px 7px 7px",
          background: bg,
          border: `1.5px solid ${border}`,
          color,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          marginRight: hasAisleAfter(col) ? 18 : 5,
          flexShrink: 0,
          padding: 0,
        }}
      >
        {content}
      </button>
    );
  }

  const activeSeat = legSelected[activePassengerIndex]?.seatNumber;
  const seatsChosenCount = passengers.filter(
    (p) => legSelected[p.index]?.seatNumber
  ).length;
  const currentSeg = segments.find((s) => s.key === segKey) || null;
  const multiFlight = segments.length > 1;
  const flightsSeated = segments.filter(
    (s) =>
      passengers.length > 0 &&
      passengers.every((p) => selectedSeats[s.key]?.[p.index]?.seatNumber)
  ).length;
  const layoverCities = [
    ...new Set(segments.map((s) => s.layoverAt).filter(Boolean)),
  ];
  // No seat data for this flight (common with sandbox test fares), or every
  // seat unavailable: say so plainly instead of drawing a made-up cabin.
  const noSeatsOffered =
    !rowsProp &&
    (scopedSeatServices.length === 0 ||
      scopedSeatServices.every((sv) => sv.available === false));
  const showKidPetLegend = flaggedSeats.size > 0;
  const exitRowsHere = [...rowTier.values()].includes("exit-row");

  // Flights grouped by direction: "Outbound" row, "Return" row.
  const flightGroups = useMemo(() => {
    const order = [];
    segments.forEach((s) => {
      const dir = s.direction || "Flights";
      if (!order.includes(dir)) order.push(dir);
    });
    return order.map((dir) => ({
      dir,
      items: segments.filter((s) => (s.direction || "Flights") === dir),
    }));
  }, [segments]);

  // The bar under the map previews the hovered/focused seat, otherwise the
  // active traveler's current pick, otherwise a hint.
  const detailSeat = hoveredSeat ?? activeSeat ?? null;
  const detailText = detailSeat
    ? describeSeat(detailSeat)
    : pickMessage || "Tap a seat, or let us pick one";
  const detailCaption = hoveredSeat
    ? hoveredSeat === activeSeat
      ? `${firstName(activePassenger)}'s seat`
      : `Seat for ${firstName(activePassenger)}`
    : activeSeat
    ? `${firstName(activePassenger)}'s seat${
        onClearSeat ? " · tap it again to remove" : ""
      }`
    : activePassenger
    ? `Choosing for ${fullName(activePassenger)}`
    : "";

  const sideCell = { width: 26, flexShrink: 0 };

  const columnHeader = (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <span style={{ ...sideCell, marginRight: 6 }} aria-hidden="true" />
      {columns.map((col) => (
        <span
          key={col}
          aria-hidden="true"
          style={{
            width: SEAT,
            marginRight: hasAisleAfter(col) ? 18 : 5,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            color: G.muted,
            letterSpacing: 0.5,
          }}
        >
          {col}
        </span>
      ))}
      <span style={sideCell} aria-hidden="true" />
    </div>
  );

  const prefButton = (value, label) => (
    <button
      key={value}
      type="button"
      onClick={() => {
        setPickPref(value);
        setPickMessage("");
      }}
      aria-pressed={pickPref === value}
      className="skm-pref"
      style={{
        padding: "6px 10px",
        border: `1px solid ${
          pickPref === value ? "rgba(249,115,22,0.55)" : "transparent"
        }`,
        borderRadius: 8,
        background: pickPref === value ? "rgba(249,115,22,0.14)" : "none",
        color: pickPref === value ? "#ff8a2a" : G.soft,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <style>{CSS}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>Choose your seats</div>
        {seatFeeTotal > 0 && (
          <div style={{ fontSize: 13, color: G.soft }}>
            Seat fees:{" "}
            <strong style={{ color: "#fff" }}>
              +${formatPrice(seatFeeTotal)}
            </strong>
          </div>
        )}
      </div>
      <p style={{ color: G.soft, fontSize: 13, marginBottom: 14 }}>
        {multiFlight
          ? `${segments.length} flights${
              layoverCities.length
                ? `, connecting in ${layoverCities.join(" and ")}`
                : ""
            }. Pick a seat on each, or skip any and the airline assigns one at check-in.`
          : "Pick a seat for each traveler, or skip and the airline assigns one at check-in."}
      </p>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            borderRadius: 10,
            background: "rgba(52,211,153,.08)",
            border: "1px solid rgba(52,211,153,.25)",
            color: "#fff",
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}

      {/* Flights, grouped by direction */}
      {multiFlight && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: flightsSeated === segments.length ? G.green : G.soft,
              marginBottom: 8,
            }}
          >
            Seats chosen on {flightsSeated} of {segments.length} flights
          </div>
          <div
            role="tablist"
            aria-label="Choose which flight to pick seats for"
          >
            {flightGroups.map((g) => (
              <div
                key={g.dir}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 64,
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: G.muted,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {g.dir}
                </span>
                <div className="skm-chips">
                  {g.items.map((s) => {
                    const seatedCount = passengers.filter(
                      (p) => selectedSeats[s.key]?.[p.index]?.seatNumber
                    ).length;
                    const allSeated =
                      passengers.length > 0 &&
                      seatedCount === passengers.length;
                    const active = s.key === segKey;
                    const mySeat =
                      passengers.length === 1
                        ? selectedSeats[s.key]?.[passengers[0].index]
                            ?.seatNumber
                        : null;
                    const status = allSeated
                      ? mySeat || "✓"
                      : seatedCount > 0
                      ? `${seatedCount}/${passengers.length}`
                      : "—";
                    return (
                      <button
                        key={s.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={`${s.label}${
                          s.direction ? `, ${s.direction}` : ""
                        }, ${allSeated ? "seat chosen" : "no seat yet"}`}
                        onClick={() => onSetActiveSegment(s.key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          color: "#fff",
                          whiteSpace: "nowrap",
                          border: `1px solid ${active ? G.orange : G.border}`,
                          background: active
                            ? "rgba(249,115,22,.12)"
                            : G.bgCard,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>
                          {s.label}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 6,
                            color: allSeated ? "#0d0b1a" : G.soft,
                            background: allSeated
                              ? G.green
                              : "rgba(255,255,255,0.08)",
                          }}
                        >
                          {status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {currentSeg && (
            <div style={{ fontSize: 12, color: G.soft, marginTop: 4 }}>
              {[
                currentSeg.departLabel,
                currentSeg.flightNumber,
                currentSeg.layoverAt
                  ? `change planes in ${currentSeg.layoverAt} after this flight`
                  : currentSeg.connectingFrom
                  ? `connecting from ${currentSeg.connectingFrom}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Traveler switcher */}
      {passengers.length > 1 && (
        <>
          <div style={{ fontSize: 12, color: G.soft, marginBottom: 6 }}>
            Who are you seating? ({seatsChosenCount} of {passengers.length}{" "}
            seated on this flight)
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {passengers.map((p) => {
              const seat = legSelected[p.index]?.seatNumber;
              const active = p.index === activePassengerIndex;
              return (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => {
                    onSetActivePassenger(p.index);
                    setPickMessage("");
                  }}
                  aria-pressed={active}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${active ? G.orange : G.border}`,
                    background: active ? "rgba(249,115,22,.08)" : G.bgCard,
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {isChildType(p.type) && <Baby size={12} />}
                  {p.hasPet && <PawPrint size={12} />}
                  {fullName(p)}
                  <span
                    style={{
                      color: seat ? G.orange : "rgba(255,255,255,0.3)",
                      fontWeight: 700,
                    }}
                  >
                    {seat ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Sitting together (Sync Together trips) */}
      {isGroupTrip && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(167,139,250,0.35)",
            background: "rgba(124,58,237,0.08)",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            <Users size={14} color={G.violet} /> Sit with your group
          </div>
          <div style={{ fontSize: 12.5, color: G.soft, lineHeight: 1.55 }}>
            We can only see seats your group picked here in Skyrio. Seats chosen
            with the airline or at check-in won't show up.
          </div>
          {Object.entries(legFriends).length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              {Object.entries(legFriends).map(([fSeat, f]) => {
                const next = seatNextTo(fSeat);
                return next ? (
                  <button
                    key={fSeat}
                    type="button"
                    onClick={() => sitNextTo(fSeat)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: `1px solid ${G.violet}`,
                      background: "rgba(167,139,250,0.15)",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sit next to {f.name} → {next}
                  </button>
                ) : (
                  <span key={fSeat} style={{ fontSize: 12, color: G.soft }}>
                    {f.name} is in {fSeat}, and the seats around them are taken.
                    Pick the closest open seat on the map.
                  </span>
                );
              })}
            </div>
          )}
          {legFriendsNoSeat.length > 0 && (
            <div style={{ fontSize: 12, color: G.soft, marginTop: 8 }}>
              {legFriendsNoSeat.join(" & ")}{" "}
              {legFriendsNoSeat.length > 1 ? "haven't" : "hasn't"} picked a seat
              in Skyrio yet.
            </div>
          )}
        </div>
      )}

      {/* Avoid kids/pets — only meaningful when we know about other bookings */}
      {hasOtherBookings && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${G.border}`,
            background: G.bgCard,
            marginBottom: 14,
          }}
        >
          <div id="avoid-kids-pets-label">
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Hide seats near kids and pets
            </div>
            <div style={{ fontSize: 11, color: G.muted, maxWidth: 380 }}>
              Based on other Skyrio bookings on this flight. Seats booked
              elsewhere aren't included.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={avoidKidsPets}
            aria-labelledby="avoid-kids-pets-label"
            onClick={() => setAvoidKidsPets((v) => !v)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background: avoidKidsPets
                ? `linear-gradient(135deg, ${G.orange} 0%, #ec4899 100%)`
                : "rgba(255,255,255,0.1)",
              position: "relative",
              flexShrink: 0,
              cursor: "pointer",
              transition: "background .2s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: avoidKidsPets ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .2s ease",
              }}
            />
          </button>
        </div>
      )}

      {noSeatsOffered && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            borderRadius: 10,
            border: `1px solid ${G.border}`,
            background: G.bgCard,
            color: G.soft,
            fontSize: 12.5,
          }}
        >
          {multiFlight
            ? "The airline isn't offering seat selection on this flight. You can pick seats on your other flights, or continue — the airline assigns a seat here at check-in."
            : "The airline isn't offering seat selection on this flight. You can continue — the airline assigns your seat at check-in."}
        </div>
      )}

      {!noSeatsOffered && (
        <>
          {/* Legend: above the map so it's read before choosing; only what's on
          this flight, with each type's starting price. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 14px",
              fontSize: 11.5,
              color: G.soft,
              marginBottom: 10,
            }}
          >
            {TIER_ORDER.filter((t) => tierPrices[t] != null).map((t) => (
              <LegendItem
                key={t}
                swatch={TIER[t].tint}
                border={TIER[t].edge}
                label={`${TIER[t].label} · ${
                  tierPrices[t] > 0
                    ? `from $${formatPrice(tierPrices[t])}`
                    : "included"
                }`}
              />
            ))}
            <LegendItem
              swatch="rgba(249,115,22,0.16)"
              border={G.orange}
              label="Your party"
            />
            {isGroupTrip && (
              <LegendItem
                swatch="rgba(167,139,250,0.2)"
                border={G.violet}
                label="Your group"
              />
            )}
            {showKidPetLegend && (
              <>
                <LegendItem icon={<Baby size={12} />} label="Child" />
                <LegendItem
                  icon={<PawPrint size={12} />}
                  label="Pet in cabin"
                />
              </>
            )}
            <LegendItem
              swatch="rgba(255,255,255,0.015)"
              border="rgba(255,255,255,0.08)"
              label="Taken"
            />
          </div>
          {activeRestricted && exitRowsHere && (
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 10 }}>
              Exit rows are greyed out for {firstName(activePassenger)} —
              airlines don't seat children or travelers with a pet there.
            </div>
          )}

          {/* Map + sticky seat bar */}
          <div>
            {/* Above the map, and stays pinned under the site header while
            scrolling a long cabin. */}
            <div
              aria-live="polite"
              style={{
                position: "sticky",
                top: stickyTop,
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 10,
                padding: "10px 12px 10px 14px",
                borderRadius: 14,
                border: `1px solid ${
                  detailSeat ? "rgba(249,115,22,0.4)" : G.border
                }`,
                background: "rgba(32,20,52,0.72)",
                backdropFilter: "blur(16px) saturate(140%)",
                WebkitBackdropFilter: "blur(16px) saturate(140%)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: G.soft }}>
                  {detailCaption}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: !detailSeat && pickMessage ? G.amber : "#fff",
                  }}
                >
                  {detailText}
                </div>
              </div>
              {!noSeatsOffered && activePassenger && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    role="group"
                    aria-label="Seat preference"
                    style={{
                      display: "flex",
                      padding: 2,
                      borderRadius: 10,
                      gap: 2,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${G.border}`,
                    }}
                  >
                    {prefButton("window", "Window")}
                    {prefButton("aisle", "Aisle")}
                    {prefButton("any", "Any")}
                  </div>
                  <button
                    type="button"
                    className="skm-pick"
                    onClick={pickForMe}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(249,115,22,0.5)",
                      background: "rgba(249,115,22,0.1)",
                      color: "#ff8a2a",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Sparkles size={13} /> Pick for me
                  </button>
                </div>
              )}
            </div>

            <div
              ref={gridRef}
              role="group"
              aria-label="Aircraft seat map. Use arrow keys to move between seats."
              onKeyDown={onGridKeyDown}
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
                border: `1px solid ${G.border}`,
                borderRadius: "48px 48px 16px 16px",
                padding: "22px 14px 18px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: 12,
                }}
              >
                ▲ FRONT
              </div>

              {columnHeader}

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {rows.map((row, i) => {
                  const prevRow = rows[i - 1];
                  const tier = rowTier.get(row);
                  const showDivider = i > 0 && rowTier.get(prevRow) !== tier;
                  const isExit = tier === "exit-row";
                  const exitMark = (
                    <span
                      aria-hidden="true"
                      style={{
                        ...sideCell,
                        fontSize: 8,
                        fontWeight: 800,
                        letterSpacing: 0.3,
                        color: isExit ? G.amber : "transparent",
                        textAlign: "center",
                      }}
                    >
                      EXIT
                    </span>
                  );
                  return (
                    <div key={row}>
                      {showDivider && (
                        <div
                          role="separator"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            margin: "6px 0",
                            color: "rgba(255,255,255,0.32)",
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                          }}
                        >
                          <span
                            style={{ flex: 1, height: 1, background: G.border }}
                          />
                          {TIER[tier].label}
                          <span
                            style={{ flex: 1, height: 1, background: G.border }}
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span
                          style={{
                            ...sideCell,
                            marginRight: 6,
                            fontSize: 10,
                            color: G.muted,
                            textAlign: "right",
                          }}
                        >
                          {row}
                        </span>
                        {columns.map((col) => renderCell(row, col))}
                        {exitMark}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 12,
                }}
              >
                REAR ▼
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LegendItem({ swatch, border, icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon ?? (
        <span
          style={{
            width: 13,
            height: 13,
            borderRadius: "4px 4px 3px 3px",
            background: swatch,
            border: `1.5px solid ${border || "rgba(255,255,255,0.15)"}`,
            display: "inline-block",
          }}
        />
      )}
      {label}
    </div>
  );
}
