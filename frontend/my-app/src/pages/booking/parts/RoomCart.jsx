// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Plus, Minus, Trash2, ChevronUp, BedDouble, Check, X as XIcon } from "lucide-react";
import { wholeUsd } from "./shared";

// A stable identity for a hotel offer, used to dedupe the room cart and
// as the React key across the results list + cart chips.
export function roomKey(hotel) {
  return `${hotel.hotelId}-${hotel.offerId}`;
}

// How many rooms one offer covers. A search for 2 rooms can return one
// rate that already prices both (LiteAPI's roomCount).
export const roomsIn = (r) => Math.max(1, Number(r?.roomCount) || 1);
export const countRooms = (list) => list.reduce((n, r) => n + roomsIn(r), 0);

// Same room picked more than once → one line with a count.
export function groupCart(rooms) {
  const map = new Map();
  rooms.forEach((r) => {
    const k = roomKey(r);
    const g = map.get(k);
    if (g) g.count += 1;
    else map.set(k, { key: k, room: r, count: 1 });
  });
  return [...map.values()];
}

// − 2 rooms + . At 1, the minus becomes a bin so "remove" is obvious.
export function RoomStepper({
  count,
  perEntry = 1,
  label,
  onMinus,
  onPlus,
  plusDisabled,
}) {
  const shown = count * perEntry;
  return (
    <div
      className="sk-rstep"
      role="group"
      aria-label={`How many: ${label}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onMinus}
        aria-label={
          count === 1 ? `Remove ${label} from your trip` : `One less ${label}`
        }
        title={count === 1 ? "Remove" : "One less"}
      >
        {count === 1 ? (
          <Trash2 size={14} aria-hidden="true" />
        ) : (
          <Minus size={14} aria-hidden="true" />
        )}
      </button>
      <span className="sk-rstep-count" aria-live="polite">
        {shown} <small>room{shown !== 1 ? "s" : ""}</small>
      </span>
      <button
        type="button"
        onClick={onPlus}
        disabled={plusDisabled}
        aria-label={`Add one more ${label}`}
        title={plusDisabled ? "Room limit reached" : "One more"}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

// Short 3-step guide above the hotel results. Can be hidden for good.
export const ROOMS_TIP_KEY = "skyrio_rooms_tip_hidden";
export function RoomsHowTo({ onClose }) {
  return (
    <div
      className="sk-roomhow"
      role="note"
      aria-label="How to book more than one room"
    >
      <div className="sk-roomhow-head">
        <span className="sk-roomhow-icon" aria-hidden="true">
          <BedDouble size={16} />
        </span>
        <b>Need more than one room?</b>
        <button
          type="button"
          className="sk-roomhow-close"
          onClick={onClose}
          aria-label="Hide this tip"
        >
          <XIcon size={14} aria-hidden="true" />
        </button>
      </div>
      <ol className="sk-roomhow-steps">
        <li>
          <span className="sk-roomhow-num">1</span>
          <span>
            Tap <b>Add to trip</b> on each room you want. Mix room types if you
            like.
          </span>
        </li>
        <li>
          <span className="sk-roomhow-num">2</span>
          <span>
            Need two of the same room? Tap <b>+</b> on that room.
          </span>
        </li>
        <li>
          <span className="sk-roomhow-num">3</span>
          <span>
            Tap <b>Check out</b> on the bar at the bottom to book all your rooms
            together.
          </span>
        </li>
      </ol>
    </div>
  );
}

// Bar pinned to the bottom of the screen while the trip has rooms.
// Collapsed: count, total, Check out. Open: every room with − / + .
export function RoomCartBar({
  rooms,
  onAdd,
  onRemove,
  onClear,
  onCheckout,
  // Flight + Stay with the flight not paid yet: the bar's button says
  // what comes next instead of "Check out" (flight first, then stay).
  checkoutLabel = "Check out",
  destCity,
  max,
}) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const has = rooms.length > 0;

  useEffect(() => {
    if (!has) {
      setOpen(false);
      setConfirmClear(false);
    }
  }, [has]);

  // Lets the floating Help / Atlas buttons move up out of the bar's way.
  useEffect(() => {
    document.body.classList.toggle("sk-roombar-on", has);
    return () => document.body.classList.remove("sk-roombar-on");
  }, [has]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!has) return null;

  const groups = groupCart(rooms);
  const roomTotal = countRooms(rooms);
  const total = rooms.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  const currency = rooms[0]?.totalCurrency || "USD";
  const full = rooms.length >= max;
  const plural = roomTotal !== 1 ? "s" : "";

  return createPortal(
    <section
      className={`sk-roombar${open ? " is-open" : ""}`}
      aria-label="Rooms in your trip"
    >
      {open && (
        <div className="sk-roombar-list" id="sk-roombar-list">
          <div className="sk-roombar-listHead">
            <span className="sk-roombar-eyebrow">Your rooms</span>
            {confirmClear ? (
              <span
                className="sk-roombar-confirm"
                role="alertdialog"
                aria-label="Remove every room?"
              >
                Remove all?
                <button type="button" className="is-danger" onClick={onClear}>
                  Remove
                </button>
                <button type="button" onClick={() => setConfirmClear(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="sk-roombar-clear"
                onClick={() => setConfirmClear(true)}
              >
                Remove all
              </button>
            )}
          </div>
          <ul className="sk-roombar-items">
            {groups.map((g) => (
              <li key={g.key} className="sk-roombar-item">
                <div className="sk-roombar-itemMain">
                  <b title={g.room.name}>{g.room.name}</b>
                  <span>
                    {g.room.roomName || "Room"}
                    {g.room.boardName ? ` · ${g.room.boardName}` : ""}
                  </span>
                  <span className="sk-roombar-each">
                    ${wholeUsd(g.room.totalAmount)} each
                    {roomsIn(g.room) > 1
                      ? ` (covers ${roomsIn(g.room)} rooms)`
                      : ""}
                  </span>
                </div>
                <RoomStepper
                  count={g.count}
                  perEntry={roomsIn(g.room)}
                  label={g.room.roomName || g.room.name}
                  onMinus={() => onRemove(g.room)}
                  onPlus={() => onAdd(g.room)}
                  plusDisabled={full}
                />
              </li>
            ))}
          </ul>
          <p className="sk-roombar-note">
            {full
              ? `That's the most rooms for one trip (${max}).`
              : "Need another room? Tap Add to trip."}
          </p>
        </div>
      )}

      <div className="sk-roombar-main">
        <button
          type="button"
          className="sk-roombar-toggle"
          aria-expanded={open}
          aria-controls="sk-roombar-list"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sk-roombar-badge" aria-hidden="true">
            {roomTotal}
          </span>
          <span className="sk-roombar-text">
            <b>
              {roomTotal} room{plural} in your trip
            </b>
            <small>
              {open ? "Hide list" : "See or change rooms"}
              {destCity ? ` · ${destCity}` : ""}
            </small>
          </span>
          <ChevronUp size={16} className="sk-roombar-chev" aria-hidden="true" />
        </button>
        <div className="sk-roombar-total">
          <small>Total</small>
          <b>
            ${wholeUsd(total)} <span>{currency}</span>
          </b>
        </div>
        <button type="button" className="sk-roombar-go" onClick={onCheckout}>
          {checkoutLabel}
          <span className="sk-roombar-goCount">
            {" "}
            {roomTotal} room{plural}
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>,
    document.body
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Big "this isn't available anymore" notice.
// Used when someone opens a flight, room or activity the group suggested
// and it can't be booked any more. A small toast in the corner was easy to
// miss, so this takes over the screen with what happened and what's next.
// ─────────────────────────────────────────────
/* ── "How do you want to plan?" ─────────────────────────────────────
   Testers found the Book page overwhelming: planner, Atlas, budget, search
   and results all at once. Each mode shows only what it needs; the rest
   stays mounted but out of sight, so switching never loses anything. */
