import { useMemo, useState } from "react";
import { Baby, PawPrint } from "lucide-react";

/**
 * SkyrioSeatMap
 * ------------------------------------------------------------------
 * Matches BookingCheckout.jsx's existing G token palette (purple/orange
 * dark theme) instead of inventing a new one. Drop this file next to
 * BookingCheckout.jsx and it inherits the same visual language.
 *
 * Props:
 * - passengers: Passenger[]  { index, firstName, lastName, type: 'ADT'|'CHD'|'INF', hasPet, petLabel }
 * - seatServices: SeatService[]  from your seat inventory endpoint —
 *     each needs at least { seatNumber, serviceId, available, price? }
 *     TODO(api): replace the mock generator in BookingCheckout with a
 *     real GET to whatever endpoint returns this flight's seat map.
 * - selectedSeats: { [passengerIndex]: { seatNumber, serviceId, price } }
 * - knownOccupancy: { [seatNumber]: { type?, hasPet? } }  OPTIONAL —
 *     other Skyrio bookings on this same flight (Tier 2, add later)
 * - activePassengerIndex: number
 * - onSetActivePassenger(passengerIndex): void
 * - onSelectSeat(passengerIndex, seatNumber, serviceId, price): void
 * ------------------------------------------------------------------
 */

const G = {
  bgCard: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.10)",
  orange: "#f97316",
  muted: "rgba(255,255,255,0.5)",
};

function seatKey(row, col) {
  return `${row}${col}`;
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

export default function SkyrioSeatMap({
  columns = ["A", "B", "C", "D", "E", "F"],
  rows = [11, 12, 13, 14, 15],
  aisleAfter = "C",
  passengers = [],
  seatServices = [],
  selectedSeats = {},
  knownOccupancy = {},
  activePassengerIndex = 0,
  onSetActivePassenger = () => {},
  onSelectSeat = () => {},
}) {
  const [avoidKidsPets, setAvoidKidsPets] = useState(false);

  const seatServiceByNumber = useMemo(() => {
    const map = new Map();
    seatServices.forEach((s) => map.set(s.seatNumber, s));
    return map;
  }, [seatServices]);

  const partyOccupiedSeats = useMemo(() => {
    const map = new Map();
    Object.entries(selectedSeats).forEach(([passengerIndex, sel]) => {
      if (sel?.seatNumber) map.set(sel.seatNumber, Number(passengerIndex));
    });
    return map;
  }, [selectedSeats]);

  const flaggedSeats = useMemo(() => {
    const flagged = new Set();
    partyOccupiedSeats.forEach((passengerIndex, seat) => {
      const p = passengers[passengerIndex];
      if (p?.type === "CHD" || p?.type === "INF" || p?.hasPet)
        flagged.add(seat);
    });
    Object.entries(knownOccupancy).forEach(([seat, occ]) => {
      if (occ?.type === "CHD" || occ?.type === "INF" || occ?.hasPet)
        flagged.add(seat);
    });
    return flagged;
  }, [partyOccupiedSeats, passengers, knownOccupancy]);

  const avoidZone = useMemo(() => {
    if (!avoidKidsPets) return new Set();
    const zone = new Set();
    flaggedSeats.forEach((seat) => {
      const row = parseInt(seat, 10);
      const col = seat.slice(String(row).length);
      const colIdx = columns.indexOf(col);
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = colIdx - 1; c <= colIdx + 1; c++) {
          if (columns[c]) zone.add(seatKey(r, columns[c]));
        }
      }
    });
    return zone;
  }, [avoidKidsPets, flaggedSeats, columns]);

  function renderCell(row, col) {
    const seat = seatKey(row, col);
    const seatService = seatServiceByNumber.get(seat);
    const isKnown = Boolean(seatService);
    const isAvailable = seatService?.available !== false;

    const ownPassengerIndex = partyOccupiedSeats.get(seat);
    const isOwnParty = ownPassengerIndex !== undefined;
    const ownPassenger = isOwnParty ? passengers[ownPassengerIndex] : null;

    const known = knownOccupancy[seat];
    const isChild =
      ownPassenger?.type === "CHD" ||
      ownPassenger?.type === "INF" ||
      known?.type === "CHD" ||
      known?.type === "INF";
    const hasPet = ownPassenger?.hasPet === true || known?.hasPet === true;

    const isSelectedForActive =
      selectedSeats[activePassengerIndex]?.seatNumber === seat;
    const isAvoided = avoidZone.has(seat) && !isOwnParty;

    const tierBorder =
      seatService?.tier === "premium"
        ? "rgba(249,115,22,0.55)"
        : seatService?.tier === "extra-legroom"
        ? "rgba(124,58,237,0.55)"
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

    if (isSelectedForActive) {
      border = G.orange;
      bg = "#fff";
    }

    function handleClick() {
      if (disabled) return;
      onSelectSeat(
        activePassengerIndex,
        seat,
        seatService.serviceId,
        seatService.price ?? 0
      );
    }

    return (
      <button
        key={seat}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        title={
          isAvoided
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
  const seatsChosenCount = Object.keys(selectedSeats).length;

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
      <p style={{ color: G.muted, fontSize: 12, marginBottom: 16 }}>
        {activePassenger
          ? `Picking a seat for ${fullName(
              activePassenger
            )} (${seatsChosenCount}/${
              passengers.length
            } chosen). We show kids and pets on the map — no other travel site does this.`
          : "We show kids and pets on the map — no other travel site does this."}
      </p>

      {/* Passenger switcher — pick who you're seating */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        {passengers.map((p) => {
          const seat = selectedSeats[p.index]?.seatNumber;
          return (
            <button
              key={p.index}
              type="button"
              onClick={() => onSetActivePassenger(p.index)}
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

      {/* Grid */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${G.border}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 5,
          alignItems: "center",
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        {rows.map((row) => (
          <div key={row} style={{ display: "flex", alignItems: "center" }}>
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
        ))}
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
          label="Your group"
        />
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
          label="Extra legroom — +$29"
        />
        <LegendItem
          swatch="transparent"
          border="rgba(249,115,22,0.55)"
          label="Front row — +$59"
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
