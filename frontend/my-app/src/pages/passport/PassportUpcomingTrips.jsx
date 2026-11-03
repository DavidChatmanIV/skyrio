// ─────────────────────────────────────────────────────────────
// Upcoming trips card for the Digital Passport sidebar.
//
// Shows the traveler's next few booked flights and hotels, each with a
// Cancel button, so cancelling doesn't require finding My trips first.
// Uses the same cancel flow as My trips (CancelTripModal): the refund or
// credit is shown before anything is cancelled.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plane, BedDouble, X, ChevronRight, Clock } from "lucide-react";
import {
  CancelTripModal,
  MT_CSS,
  fmtDate,
  stripDates,
} from "@/pages/SavedTripsPage";

const API = import.meta.env.VITE_API_URL || "";
const SHOW = 3;

const CSS = `
  .put { margin-bottom: 12px; }
  .put__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .put__label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,0.45); }
  .put__all { border: 0; background: none; padding: 0; color: #ffb347; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; }
  .put__all:hover { color: #fff; }
  /* Cancel sits under the dates (not beside them), so the trip name
     gets the full width even on narrow phones and the sidebar. */
  .put__row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.07); }
  .put__row:first-of-type { border-top: 0; padding-top: 2px; }
  .put__icon { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #ffb347; background: rgba(255,138,42,0.12); border: 1px solid rgba(255,138,42,0.25); }
  .put__body { flex: 1; min-width: 0; }
  .put__title { font-size: 13.5px; font-weight: 700; color: #fff; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
  .put__actions { margin-top: 6px; }
  .put__when { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 1px; }
  .put__cancel { display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(255,107,133,.45); background: rgba(255,107,133,.06); color: #ff9db0; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .put__cancel:hover { border-color: rgba(255,107,133,.8); background: rgba(255,107,133,.16); color: #fff; }
  .put__status { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #ffc27a; }
  .put__empty { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.5; }
  .put__empty button { border: 0; background: none; padding: 0; color: #ffb347; font: inherit; font-weight: 700; cursor: pointer; }
`;

function whenText(b) {
  const start = fmtDate(b.startDate);
  const end = fmtDate(b.endDate);
  if (!start) return "Date to be confirmed";
  return end && end !== start ? `${start} → ${end}` : start;
}

export default function PassportUpcomingTrips({ token }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, items: [] });
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setState({ loading: false, items: [] });
      return undefined;
    }
    fetch(`${API}/api/bookings/upcoming`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => {
        if (alive)
          setState({
            loading: false,
            items: Array.isArray(d.bookings) ? d.bookings : [],
          });
      })
      .catch(() => alive && setState({ loading: false, items: [] }));
    return () => {
      alive = false;
    };
  }, [token]);

  // Once cancelled (or a request was sent), update this row in place.
  const onDone = (updated) => {
    if (!updated?._id) return;
    setState((s) => ({
      ...s,
      items: s.items
        .map((b) =>
          String(b._id) === String(updated._id)
            ? { ...b, status: updated.status || b.status }
            : b
        )
        .filter((b) => b.status !== "cancelled"),
    }));
  };

  if (state.loading) return null;
  const list = state.items.slice(0, SHOW);

  return (
    <>
      <style>{CSS + MT_CSS}</style>
      <div className="put">
        <div className="put__head">
          <span className="put__label">Upcoming trips</span>
          <button
            type="button"
            className="put__all"
            onClick={() => navigate("/saved-trips")}
          >
            My trips <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        {list.length === 0 ? (
          <div className="put__empty">
            No upcoming trips.{" "}
            <button type="button" onClick={() => navigate("/booking")}>
              Book a flight or hotel
            </button>
          </div>
        ) : (
          list.map((b) => {
            const isHotel = b.type === "Hotel";
            const title =
              (isHotel && b.hotelName) || stripDates(b.tripDetails) || "Trip";
            // Same rules as My trips: shared rooms are cancelled by the
            // organizer from the group trip, and a pending cancellation
            // can't be cancelled again.
            const canCancel = b.status === "confirmed" && !b.sharedRoom;
            return (
              <div key={b._id} className="put__row">
                <span className="put__icon" aria-hidden="true">
                  {isHotel ? <BedDouble size={17} /> : <Plane size={17} />}
                </span>
                <div className="put__body">
                  <div className="put__title" title={title}>
                    {title}
                  </div>
                  <div className="put__when">{whenText(b)}</div>
                  {(canCancel || b.status === "cancel_pending") && (
                    <div className="put__actions">
                      {canCancel ? (
                        <button
                          type="button"
                          className="put__cancel"
                          onClick={() =>
                            setCancelling({
                              _id: b._id,
                              type: b.type,
                              tripDetails: b.tripDetails,
                              totalCurrency: b.totalCurrency,
                            })
                          }
                          aria-label={`Cancel ${title}`}
                        >
                          <X size={13} aria-hidden="true" /> Cancel booking
                        </button>
                      ) : (
                        <span className="put__status">
                          <Clock size={12} aria-hidden="true" /> Cancelling
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {state.items.length > SHOW && (
          <button
            type="button"
            className="put__all"
            style={{ marginTop: 8 }}
            onClick={() => navigate("/saved-trips")}
          >
            See all {state.items.length} upcoming trips
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {cancelling && (
        <CancelTripModal
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onDone={onDone}
        />
      )}
    </>
  );
}
