import { useMemo, useState } from "react";
import { Baby, PawPrint, Users } from "lucide-react";

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
 * - segments: [{ key, label, index, total, direction, flightNumber, departLabel }]
 *     one entry per FLIGHT (a connecting trip has several per direction).
 *     Tabs render when > 1. direction is "Outbound" | "Return" | null.
 * - notice: string  short status message shown above the tabs (e.g. what was
 *     just saved and which flight is shown next).
 * - activeSegmentKey: string | null  which leg is currently being seated
 * - onSetActiveSegment(segmentKey): void
 * - knownOccupancy: { [segmentKey]: { [seatNumber]: { type?, hasPet? } } }  OPTIONAL
 *     other Skyrio bookings on the same flight, per leg (Tier 2, add later)
 * - activePassengerIndex: number
 * - onSetActivePassenger(passengerIndex): void
 * - onSelectSeat(segmentKey, passengerIndex, seatNumber, serviceId, price): void
 * - isGroupTrip: boolean  booking for a Sync Together trip — shows the
 *     "sit together" explanation.
 * - groupSeats: { [segmentKey]: { [seatNumber]: { name } } }  seats friends
 *     on the trip picked in Skyrio, per leg. Shown on the map, with a
 *     "Sit next to <name>" button.
 * - friendsWithoutSeat: { [segmentKey]: string[] }  friends on this flight
 *     who didn't pick a seat in Skyrio (so we can't show where they sit).
 * - columns / rows / aisleAfter: OPTIONAL overrides. When omitted, they are
 *     derived from the active leg's seat data (falling back to a 6-wide
 *     11-15 mock layout when there is no data).
 * ------------------------------------------------------------------
 */

const G = {
  bgCard: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.10)",
  orange: "#f97316",
  muted: "rgba(255,255,255,0.5)",
  exitRow: "#F2C200",
};

const DEFAULT_COLUMNS = ["A", "B", "C", "D", "E", "F"];
const DEFAULT_ROWS = [11, 12, 13, 14, 15];

function seatKey(row, col) {
  return `${row}${col}`;
}

function parseSeatNumber(seatNumber) {
  const m = /^(\d+)([A-Za-z]+)$/.exec(String(seatNumber || "").trim());
  return m ? { row: parseInt(m[1], 10), col: m[2].toUpperCase() } : null;
}

function fullName(p) {
  return (
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    `Traveler ${p.index + 1}`
  );
}

function initials(p) {
  return (
    `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?"
  );
}

function tierLabel(tier) {
  if (tier === "premium") return "Front row";
  if (tier === "extra-legroom") return "Extra legroom";
  if (tier === "exit-row") return "Exit row";
  return "Standard";
}

function formatPrice(n) {
  return Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
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
  isGroupTrip = false,
  groupSeats = {},
  friendsWithoutSeat = {},
}) {
  const [avoidKidsPets, setAvoidKidsPets] = useState(false);
  const [hoveredSeat, setHoveredSeat] = useState(null);

  // Everything below is scoped to one flight leg.
  const segKey = activeSegmentKey ?? segments[0]?.key ?? "default";
  const legSelected = selectedSeats[segKey] ?? {};
  const legKnown = knownOccupancy[segKey] ?? {};
  const legFriends = groupSeats[segKey] ?? {};
  const legFriendsNoSeat = friendsWithoutSeat[segKey] ?? [];

  // Only filters when the data carries segmentKey values. One-way flights
  // (or data without keys) fall through unfiltered, as before.
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

  // Derive the grid from real data so real cabins (more rows, different
  // layouts per leg) don't fall off the map.
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

  // Aisle sits in the middle of the cabin unless explicitly overridden.
  const aisleAfter =
    aisleAfterProp ?? columns[Math.max(0, Math.ceil(columns.length / 2) - 1)];

  // Legend prices come from the real services, not hardcoded numbers.
  const tierPrices = useMemo(() => {
    const out = {};
    scopedSeatServices.forEach((s) => {
      if (!s.tier || s.tier === "standard" || !(s.price > 0)) return;
      out[s.tier] = Math.min(out[s.tier] ?? Infinity, s.price);
    });
    return out;
  }, [scopedSeatServices]);

  const rowTier = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const col = columns.find((c) => seatServiceByNumber.get(seatKey(row, c)));
      const svc = col ? seatServiceByNumber.get(seatKey(row, col)) : null;
      map.set(row, svc?.tier ?? "standard");
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
      const p = passengers[passengerIndex];
      if (p?.type === "CHD" || p?.type === "INF" || p?.hasPet)
        flagged.add(seat);
    });
    Object.entries(legKnown).forEach(([seat, occ]) => {
      if (occ?.type === "CHD" || occ?.type === "INF" || occ?.hasPet)
        flagged.add(seat);
    });
    return flagged;
  }, [partyOccupiedSeats, passengers, legKnown]);

  const avoidZone = useMemo(() => {
    if (!avoidKidsPets) return new Set();
    const zone = new Set();
    flaggedSeats.forEach((seat) => {
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
  }, [avoidKidsPets, flaggedSeats, columns]);

  // Free for the traveler being seated right now?
  function isFreeSeat(seat) {
    const svc = seatServiceByNumber.get(seat);
    if (!svc || svc.available === false) return false;
    if (legFriends[seat] || legKnown[seat]) return false;
    if (avoidZone.has(seat)) return false;
    const holder = partyOccupiedSeats.get(seat);
    return holder === undefined || holder === activePassengerIndex;
  }

  // Closest free seat to a friend: same row on the same side of the aisle,
  // then across the aisle, then the row in front / behind.
  function seatNextTo(friendSeat) {
    const parsed = parseSeatNumber(friendSeat);
    if (!parsed) return null;
    const ci = columns.indexOf(parsed.col);
    if (ci === -1) return null;
    const aisleIdx = columns.indexOf(aisleAfter);
    const sameSide = (c) => ci <= aisleIdx === c <= aisleIdx;
    const byDistance = columns
      .map((c, i) => ({ c, d: Math.abs(i - ci) }))
      .filter((x) => x.d > 0)
      .sort(
        (a, b) =>
          Number(!sameSide(columns.indexOf(a.c))) -
            Number(!sameSide(columns.indexOf(b.c))) || a.d - b.d
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

  function sitNextTo(friendSeat) {
    const seat = seatNextTo(friendSeat);
    const svc = seat ? seatServiceByNumber.get(seat) : null;
    if (!seat || !svc) return;
    onSelectSeat(
      segKey,
      activePassengerIndex,
      seat,
      svc.serviceId,
      svc.price ?? 0
    );
  }

  function renderCell(row, col) {
    const seat = seatKey(row, col);
    const seatService = seatServiceByNumber.get(seat);
    const isKnown = Boolean(seatService);
    const isAvailable = seatService?.available !== false;

    const ownPassengerIndex = partyOccupiedSeats.get(seat);
    const isOwnParty = ownPassengerIndex !== undefined;
    const ownPassenger = isOwnParty ? passengers[ownPassengerIndex] : null;

    const known = legKnown[seat];
    const isChild =
      ownPassenger?.type === "CHD" ||
      ownPassenger?.type === "INF" ||
      known?.type === "CHD" ||
      known?.type === "INF";
    const hasPet = ownPassenger?.hasPet === true || known?.hasPet === true;

    const isSelectedForActive =
      legSelected[activePassengerIndex]?.seatNumber === seat;
    const isAvoided = avoidZone.has(seat) && !isOwnParty;

    const tierBorder =
      seatService?.tier === "premium"
        ? "rgba(249,115,22,0.55)"
        : seatService?.tier === "extra-legroom"
        ? "rgba(124,58,237,0.55)"
        : seatService?.tier === "exit-row"
        ? "rgba(242,194,0,0.6)"
        : "transparent";

    let bg = G.bgCard;
    let border = tierBorder;
    let content = null;
    let disabled = false;

    if (!isKnown || !isAvailable) {
      bg = "rgba(255,255,255,0.02)";
      content = <span style={{ opacity: 0.35 }}>×</span>;
      disabled = true;
    } else if (isOwnParty) {
      bg = "rgba(249,115,22,0.14)";
      border = G.orange;
      content = isChild ? (
        <Baby size={15} />
      ) : hasPet ? (
        <PawPrint size={15} />
      ) : (
        initials(ownPassenger)
      );
      // A seat already held by another traveler in this party can't be
      // assigned to a second person on the same leg.
      if (ownPassengerIndex !== activePassengerIndex) disabled = true;
    } else if (legFriends[seat]) {
      // A friend on this trip picked this seat in Skyrio.
      bg = "rgba(167,139,250,0.18)";
      border = "#a78bfa";
      content = (
        <span style={{ fontSize: 11 }}>
          {String(legFriends[seat].name || "?")
            .slice(0, 2)
            .toUpperCase()}
        </span>
      );
      disabled = true;
    } else if (known) {
      bg = "rgba(255,255,255,0.02)";
      content = isChild ? (
        <Baby size={14} style={{ opacity: 0.6 }} />
      ) : hasPet ? (
        <PawPrint size={14} style={{ opacity: 0.6 }} />
      ) : (
        <span style={{ opacity: 0.35 }}>×</span>
      );
      disabled = true;
    }

    if (isAvoided && !disabled) {
      bg = "rgba(255,255,255,0.015)";
      disabled = true;
      content = <span style={{ opacity: 0.2 }}>—</span>;
    }

    const isHovered = hoveredSeat === seat && !disabled && !isSelectedForActive;
    if (isHovered) {
      bg = "rgba(255,138,42,0.12)";
      border = "rgba(255,138,42,0.5)";
    }

    if (isSelectedForActive) {
      border = G.orange;
      bg = "#fff";
    }

    function handleClick() {
      if (disabled) return;
      onSelectSeat(
        segKey,
        activePassengerIndex,
        seat,
        seatService.serviceId,
        seatService.price ?? 0
      );
    }

    const priceNote = seatService?.price ? ` — +$${seatService.price}` : "";
    const friendHere = !isOwnParty ? legFriends[seat] : null;
    const accessibleLabel = friendHere
      ? `Seat ${seat}, ${friendHere.name}'s seat`
      : isAvoided
      ? `Seat ${seat}, too close to a flagged seat, unavailable`
      : isOwnParty
      ? `Seat ${seat}, assigned to ${fullName(ownPassenger)}`
      : disabled
      ? `Seat ${seat}, unavailable`
      : `Seat ${seat}, ${tierLabel(seatService?.tier)}${priceNote}${
          isSelectedForActive ? ", selected" : ""
        }`;

    return (
      <button
        key={seat}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={() => !disabled && setHoveredSeat(seat)}
        onMouseLeave={() => setHoveredSeat((s) => (s === seat ? null : s))}
        aria-label={accessibleLabel}
        aria-pressed={isSelectedForActive}
        title={
          friendHere
            ? `${friendHere.name} — ${seat}`
            : isAvoided
            ? "Too close to a flagged seat"
            : isOwnParty
            ? `${fullName(ownPassenger)} — ${seat}`
            : seatService?.price
            ? `${seat} — +$${seatService.price}`
            : seat
        }
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: bg,
          border: `1.5px solid ${border}`,
          color: bg === "#fff" ? "#1b1024" : "#fff",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all .15s ease",
          marginRight: col === aisleAfter ? 16 : 5,
          flexShrink: 0,
        }}
      >
        {content}
      </button>
    );
  }

  const activePassenger = passengers[activePassengerIndex];
  const seatsChosenCount = Object.keys(legSelected).length;
  const currentSeg = segments.find((s) => s.key === segKey) || null;
  const multiFlight = segments.length > 1;
  const flightsSeated = segments.filter((s) =>
    passengers.length
      ? passengers.every((p) => selectedSeats[s.key]?.[p.index])
      : false
  ).length;
  // Cities where this trip changes planes, e.g. ["ATL"].
  const layoverCities = [
    ...new Set(segments.map((s) => s.layoverAt).filter(Boolean)),
  ];
  // Slightly brighter than G.muted so captions stay readable on the dark card.
  const soft = "rgba(255,255,255,0.74)";

  const columnHeader = (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <span
        style={{ width: 18, marginRight: 8, flexShrink: 0 }}
        aria-hidden="true"
      />
      {columns.map((col) => (
        <span
          key={col}
          aria-hidden="true"
          style={{
            width: 38,
            marginRight: col === aisleAfter ? 16 : 5,
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
    </div>
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <div style={{ fontFamily: "inherit", fontWeight: 700, fontSize: 16 }}>
          Choose your seats
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background: `linear-gradient(135deg, ${G.orange} 0%, #ec4899 100%)`,
            color: "#1b1024",
            letterSpacing: 0.3,
          }}
        >
          SKYRIO EXCLUSIVE
        </span>
      </div>
      {/* Plain-language orientation: what this step is and how many flights */}
      <p style={{ color: soft, fontSize: 13, marginBottom: 12 }}>
        {multiFlight
          ? `Your trip has ${segments.length} flights${
              layoverCities.length
                ? ` because it connects through ${layoverCities.join(
                    " and "
                  )}, so each direction is split into separate flights, each with its own seat map`
                : ""
            }. Choose a seat on each flight you want one for. You can skip any flight, and the airline will assign a seat at check-in.`
          : "Choose a seat for each traveler, or skip and the airline will assign one at check-in."}
      </p>

      {multiFlight && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: flightsSeated === segments.length ? "#34d399" : soft,
            marginBottom: 10,
          }}
        >
          Seats chosen on {flightsSeated} of {segments.length} flights
        </div>
      )}

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

      {/* One tab per flight. Each says which flight it is, the direction,
          the route, and whether a seat is chosen yet. */}
      {multiFlight && (
        <div
          role="tablist"
          aria-label="Choose which flight to pick seats for"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {segments.map((s, i) => {
            const seatedCount = passengers.filter(
              (p) => selectedSeats[s.key]?.[p.index]
            ).length;
            const allSeated =
              passengers.length > 0 && seatedCount === passengers.length;
            const active = s.key === segKey;
            const status = allSeated
              ? passengers.length > 1
                ? "✓ Seats chosen"
                : "✓ Seat chosen"
              : seatedCount > 0
              ? `${seatedCount} of ${passengers.length} travelers seated`
              : "No seat yet";
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSetActiveSegment(s.key)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#fff",
                  border: `1px solid ${active ? G.orange : G.border}`,
                  background: active ? "rgba(249,115,22,.10)" : G.bgCard,
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: soft,
                  }}
                >
                  {`Flight ${(s.index ?? i) + 1} of ${segments.length}`}
                  {s.direction ? ` · ${s.direction}` : ""}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginTop: 3,
                    fontWeight: 600,
                    color: allSeated ? "#34d399" : soft,
                  }}
                >
                  {status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Which flight and traveler the map below is for */}
      {multiFlight && currentSeg && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: 16,
            borderRadius: 12,
            border: `1px solid ${G.border}`,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: soft }}>
            {`Now choosing seats for flight ${(currentSeg.index ?? 0) + 1} of ${
              segments.length
            }`}
            {currentSeg.direction ? ` · ${currentSeg.direction}` : ""}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>
            {currentSeg.label}
          </div>
          {(currentSeg.layoverAt || currentSeg.connectingFrom) && (
            <div style={{ fontSize: 12, color: soft, marginTop: 2 }}>
              {currentSeg.layoverAt
                ? `You change planes in ${currentSeg.layoverAt} after this flight.`
                : `This is your connecting flight from ${currentSeg.connectingFrom}.`}
            </div>
          )}
          {(currentSeg.departLabel || currentSeg.flightNumber) && (
            <div style={{ fontSize: 12, color: soft, marginTop: 2 }}>
              {[currentSeg.departLabel, currentSeg.flightNumber]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          {activePassenger && (
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Choosing a seat for <strong>{fullName(activePassenger)}</strong> (
              {seatsChosenCount} of {passengers.length} traveler
              {passengers.length !== 1 ? "s" : ""} seated on this flight)
            </div>
          )}
        </div>
      )}

      {!multiFlight && activePassenger && (
        <p style={{ color: soft, fontSize: 13, marginBottom: 12 }}>
          Choosing a seat for <strong>{fullName(activePassenger)}</strong> (
          {seatsChosenCount} of {passengers.length} chosen).
        </p>
      )}

      <p style={{ color: G.muted, fontSize: 12, marginBottom: 16 }}>
        We show kids and pets on the map — no other travel site does this.
      </p>

      {/* Passenger switcher — pick who you're seating */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        {passengers.map((p) => {
          const seat = legSelected[p.index]?.seatNumber;
          return (
            <button
              key={p.index}
              type="button"
              onClick={() => onSetActivePassenger(p.index)}
              aria-pressed={p.index === activePassengerIndex}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${
                  p.index === activePassengerIndex ? G.orange : G.border
                }`,
                background:
                  p.index === activePassengerIndex
                    ? "rgba(249,115,22,.08)"
                    : G.bgCard,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {(p.type === "CHD" || p.type === "INF") && <Baby size={12} />}
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

      {/* Sitting together (Sync Together trips) */}
      {isGroupTrip && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(167,139,250,0.35)",
            background: "rgba(124,58,237,0.08)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            <Users size={14} color="#a78bfa" /> Want to sit with your group?
          </div>
          <div style={{ fontSize: 12.5, color: soft, lineHeight: 1.55 }}>
            Pick your seat here in Skyrio. That's how we show where your friends
            and family are sitting and seat you next to them. Seats chosen on
            the airline's website or app, or at check-in, aren't visible to
            Skyrio — we can't see or control those, so we can't match them.
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
                      border: "1px solid #a78bfa",
                      background: "rgba(167,139,250,0.15)",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sit next to {f.name} ({fSeat}) → {next}
                  </button>
                ) : (
                  <span key={fSeat} style={{ fontSize: 12, color: soft }}>
                    {f.name} is in {fSeat}. No free seat right next to them —
                    pick the closest open seat on the map.
                  </span>
                );
              })}
            </div>
          )}

          {legFriendsNoSeat.length > 0 && (
            <div style={{ fontSize: 12, color: soft, marginTop: 8 }}>
              {legFriendsNoSeat.join(" & ")}{" "}
              {legFriendsNoSeat.length > 1 ? "are" : "is"} on this flight but
              didn't pick a seat in Skyrio, so we can't show where they're
              sitting.
            </div>
          )}
        </div>
      )}

      {/* Avoid toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${G.border}`,
          background: G.bgCard,
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Avoid seats near kids/pets
          </div>
          <div style={{ fontSize: 11, color: G.muted, maxWidth: 380 }}>
            Based on Skyrio bookings we know about on this flight. We can't see
            seats booked elsewhere.
          </div>
        </div>
        <div
          onClick={() => setAvoidKidsPets((v) => !v)}
          style={{
            width: 40,
            height: 22,
            borderRadius: 999,
            background: avoidKidsPets
              ? `linear-gradient(135deg, ${G.orange} 0%, #ec4899 100%)`
              : "rgba(255,255,255,0.1)",
            position: "relative",
            flexShrink: 0,
            transition: "background .2s ease",
          }}
        >
          <div
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
        </div>
      </label>

      {scopedSeatServices.every((sv) => sv.available === false) && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            borderRadius: 10,
            border: `1px solid ${G.border}`,
            background: G.bgCard,
            color: soft,
            fontSize: 12.5,
          }}
        >
          The airline isn't offering seats to choose on this flight right now.
          You can continue — the airline will assign a seat at check-in.
        </div>
      )}

      {/* Grid */}
      <div
        role="group"
        aria-label="Aircraft seat map"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${G.border}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: "rgba(255,255,255,0.35)",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>▲</span> FRONT OF AIRCRAFT
        </div>

        {columnHeader}

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {rows.map((row, i) => {
            const prevRow = rows[i - 1];
            const showDivider =
              i > 0 && rowTier.get(prevRow) !== rowTier.get(row);
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
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    <span
                      style={{ flex: 1, height: 1, background: G.border }}
                    />
                    {tierLabel(rowTier.get(row))} begins
                    <span
                      style={{ flex: 1, height: 1, background: G.border }}
                    />
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      width: 18,
                      fontSize: 10,
                      color: G.muted,
                      marginRight: 8,
                    }}
                  >
                    {row}
                  </span>
                  {columns.map((col) => renderCell(row, col))}
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
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          REAR OF AIRCRAFT <span style={{ fontSize: 13 }}>▼</span>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          fontSize: 11,
          color: G.muted,
          marginBottom: 10,
        }}
      >
        <LegendItem
          swatch="rgba(249,115,22,0.14)"
          border={G.orange}
          label="Your seats"
        />
        {isGroupTrip && (
          <LegendItem
            swatch="rgba(167,139,250,0.18)"
            border="#a78bfa"
            label="Friends on your trip"
          />
        )}
        <LegendItem icon={<Baby size={12} />} label="Child seated here" />
        <LegendItem icon={<PawPrint size={12} />} label="Pet in cabin" />
        <LegendItem
          swatch="rgba(255,255,255,0.02)"
          label="Unavailable / unknown"
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          fontSize: 11,
          color: G.muted,
        }}
      >
        <LegendItem swatch="transparent" label="Standard — free" />
        <LegendItem
          swatch="transparent"
          border="rgba(124,58,237,0.55)"
          label={`Extra legroom${
            tierPrices["extra-legroom"] != null
              ? ` — from +$${formatPrice(tierPrices["extra-legroom"])}`
              : ""
          }`}
        />
        <LegendItem
          swatch="transparent"
          border={G.exitRow}
          label={`Exit row${
            tierPrices["exit-row"] != null
              ? ` — from +$${formatPrice(tierPrices["exit-row"])}`
              : ""
          }`}
        />
        <LegendItem
          swatch="transparent"
          border="rgba(249,115,22,0.55)"
          label={`Front row${
            tierPrices.premium != null
              ? ` — from +$${formatPrice(tierPrices.premium)}`
              : ""
          }`}
        />
      </div>
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
            borderRadius: 4,
            background: swatch,
            border: border ? `1.5px solid ${border}` : "none",
            display: "inline-block",
          }}
        />
      )}
      {label}
    </div>
  );
}
