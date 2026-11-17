// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { tripPrice } from "@/lib/tripPrice";
import { ArrowRight, Check, AlertTriangle } from "lucide-react";
import { IconHotel, IconFlight } from "./shared";
import { countRooms } from "./RoomCart";

// ─────────────────────────────────────────────
// "Your trip" tray for packages: flight + stay with a running total, so
// nobody picks a hotel without seeing what the whole trip costs.
// It's two separate bookings (each paid and cancelled on its own), and the
// tray says so — no bundle "savings", just the two real prices added up.
// ─────────────────────────────────────────────
export function PackageTray({
  plan,
  tab,
  stayRooms,
  flightBusy,
  onNextStay,
  onChangeFlight,
  onPayFlight,
  onPayStay,
  onDone,
}) {
  const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
  const flight = plan.flight;
  const bookedStay = plan.stay?.booked ? plan.stay : null;
  // A booked stay wins; otherwise the rooms picked in this search.
  const cartTotal = (stayRooms || []).reduce(
    (sum, r) => sum + (Number(r.totalAmount) || 0),
    0
  );
  const stayTotal = bookedStay ? bookedStay.total : cartTotal;
  // One cart entry can cover several rooms (a bundled offer).
  const roomsPicked = bookedStay ? bookedStay.rooms : countRooms(stayRooms || []);
  // PRICE CHECK (lib/tripPrice): flight = per person × travelers, stay =
  // per room × rooms × nights, then Flight + Stay = Trip total, per person.
  const firstRoom = (stayRooms || [])[0];
  const price = tripPrice({
    flight: flight ? { price: flight.price, raw: flight.raw } : null,
    stay: roomsPicked
      ? {
          total: stayTotal,
          rooms: roomsPicked,
          checkin: bookedStay?.checkin || firstRoom?.checkin || plan.depart,
          checkout: bookedStay?.checkout || firstRoom?.checkout || plan.ret,
        }
      : null,
    travelers: plan.adults,
  });
  if (roomsPicked && !bookedStay && roomsPicked < (Number(plan.rooms) || 1))
    price.problems.push(
      `You've added ${roomsPicked} room${roomsPicked === 1 ? "" : "s"}. This trip has ${plan.rooms}. Add ${
        plan.rooms - roomsPicked
      } more so everyone has a bed.`
    );
  const total = price.tripTotal;
  const nights = price.nights;
  const allBooked = flight?.booked && bookedStay;

  const Booked = () => (
    <span className="sk-pkg-tray-booked">
      <Check size={12} aria-hidden="true" /> Booked
    </span>
  );

  return (
    <div className="sk-pkg-tray" role="status" aria-label="Your trip">
      <div className="sk-pkg-tray-head">
        <span className="sk-pkg-tray-title">Your trip</span>
        <span className="sk-pkg-tray-steps">
          <span
            className={tab === "Flights" ? "is-now" : flight ? "is-done" : ""}
          >
            1 · Flight
          </span>
          <span className="sk-pkg-step-line" aria-hidden="true" />
          <span
            className={
              tab === "Stays" && !(flight && roomsPicked)
                ? "is-now"
                : roomsPicked
                ? "is-done"
                : ""
            }
          >
            2 · Stay
          </span>
          <span className="sk-pkg-step-line" aria-hidden="true" />
          <span className={flight && roomsPicked ? "is-now" : ""}>3 · Pay</span>
        </span>
      </div>

      {/* ── Flight ── */}
      <div className="sk-pkg-tray-row">
        <span className="sk-pkg-tray-icon">
          <IconFlight size={14} />
        </span>
        <span className="sk-pkg-tray-what">
          {flight ? (
            <>
              Flight · {flight.origin} → {flight.destination}
              <small>
                {[flight.airline, price.flightLine]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </>
          ) : (
            <>
              Flight
              <small>
                {tab === "Flights" ? "Pick a flight below" : "Not picked yet"}
              </small>
            </>
          )}
        </span>
        <span className="sk-pkg-tray-amt">
          {flight ? usd(flight.price) : "—"}
          {flight?.booked ? (
            <Booked />
          ) : (
            tab === "Stays" && (
              <button
                type="button"
                className="sk-pkg-tray-link"
                onClick={onChangeFlight}
              >
                {flight ? "Change" : "Pick flight"}
              </button>
            )
          )}
        </span>
      </div>

      {/* ── Stay ── */}
      <div className="sk-pkg-tray-row">
        <span className="sk-pkg-tray-icon">
          <IconHotel size={14} />
        </span>
        <span className="sk-pkg-tray-what">
          {bookedStay?.name || `Stay in ${plan.city}`}
          <small>
            {roomsPicked
              ? price.stayLine ||
                `${roomsPicked} room${roomsPicked !== 1 ? "s" : ""}${
                  nights ? ` · ${nights} night${nights !== 1 ? "s" : ""}` : ""
                }`
              : tab === "Stays"
              ? "Pick a room below (Add to trip)"
              : "Next step"}
          </small>
        </span>
        <span className="sk-pkg-tray-amt">
          {roomsPicked ? usd(stayTotal) : "—"}
          {bookedStay && <Booked />}
        </span>
      </div>

      {/* ── Total + what to do next ── */}
      <div className="sk-pkg-tray-foot">
        <span className="sk-pkg-tray-total">
          {total > 0 ? (
            <>
              {flight && roomsPicked ? (
                <span className="sk-pkg-tray-sum">
                  Flight {usd(price.flightTotal)} + Stay {usd(price.stayTotal)} =
                </span>
              ) : null}
              {allBooked ? "Trip total paid" : "Trip total"}{" "}
              <strong>{usd(total)}</strong>
              {flight && roomsPicked && price.travelers > 1 ? (
                <span className="sk-pkg-tray-pp">
                  {usd(price.perPerson)} per person · {price.travelers} travelers
                </span>
              ) : null}
            </>
          ) : (
            "Pick a flight and a stay to see your trip total"
          )}
        </span>
        <span className="sk-pkg-tray-actions">
          {tab === "Flights" && !flight && (
            <button
              type="button"
              className="sk-pkg-banner-btn sk-pkg-banner-btn--ghost"
              onClick={onNextStay}
            >
              Skip to stays <ArrowRight size={14} />
            </button>
          )}
          {tab === "Flights" && flight && !roomsPicked && (
            <button
              type="button"
              className="sk-pkg-banner-btn"
              onClick={onNextStay}
            >
              Next: find your stay <ArrowRight size={14} />
            </button>
          )}
          {flight && !flight.booked && roomsPicked > 0 && (
            <button
              type="button"
              className="sk-pkg-banner-btn"
              onClick={onPayFlight}
              disabled={flightBusy}
            >
              {flightBusy
                ? "Checking your fare…"
                : `Pay for flight · ${usd(flight.price)}`}
            </button>
          )}
          {roomsPicked > 0 && !bookedStay && tab === "Stays" && (
            <button
              type="button"
              className={`sk-pkg-banner-btn${
                flight && !flight.booked ? " sk-pkg-banner-btn--ghost" : ""
              }`}
              onClick={onPayStay}
            >
              Pay for stay · {usd(stayTotal)}
            </button>
          )}
          {allBooked && (
            <button
              type="button"
              className="sk-pkg-banner-btn sk-pkg-banner-btn--ghost"
              onClick={onDone}
            >
              Done
            </button>
          )}
        </span>
      </div>
      {price.problems.length > 0 && !allBooked && (
        <ul className="sk-pkg-tray-warn" role="alert">
          {price.problems.map((p) => (
            <li key={p}>
              <AlertTriangle size={13} aria-hidden="true" /> {p}
            </li>
          ))}
        </ul>
      )}
      {price.low && !allBooked && (
        <p className="sk-pkg-tray-low">
          This price is lower than usual. It's checked again before you pay.
        </p>
      )}
      <p className="sk-pkg-tray-note">
        {allBooked
          ? "All set. Two bookings, two confirmations, both in My Trips."
          : flight && !flight.booked
          ? "2 payments: flight first, then hotel. Fare rechecked before you pay."
          : "2 payments: flight (airline), then hotel. Each has its own confirmation."}
      </p>
    </div>
  );
}
