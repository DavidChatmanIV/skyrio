// ─────────────────────────────────────────────────────────────
// Manage booking — /manage-booking/:id?t=<link token>
//
// One booking: what was booked, its status, and a clear Cancel booking
// button. Opened from the "Manage or cancel" button in confirmation emails
// or the Find my booking email, so it works WITHOUT an account (guests).
// A signed-in owner can open /manage-booking/:id with no token too.
//
// Cancelling uses the same screen as My Trips: the real refund terms load
// first, nothing is cancelled until the traveler confirms, and if terms
// can't load they can send a request to Skyrio support instead.
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Plane,
  BedDouble,
  CalendarDays,
  Hash,
  Receipt,
  AlertTriangle,
  Clock,
  Users,
  Search,
} from "lucide-react";
import {
  MT_CSS,
  CancelTripModal,
  AirlineCredit,
  STATUS,
  fmtDate,
  fmtMoney,
  stripDates,
  confirmationCodeOf,
} from "./SavedTripsPage";

const API = import.meta.env.VITE_API_URL || "";
const SUPPORT_EMAIL = "skyrioofficial@gmail.com";

// Remember the link token for this tab, so a refresh (or the URL losing
// ?t=) doesn't lock the traveler out mid-cancellation.
const tokenKey = (id) => `skyrio_manage_token:${id}`;
function useManageToken(id) {
  const [params] = useSearchParams();
  const fromUrl = params.get("t");
  return useMemo(() => {
    if (fromUrl) {
      try {
        sessionStorage.setItem(tokenKey(id), fromUrl);
      } catch {
        /* fine */
      }
      return fromUrl;
    }
    try {
      return sessionStorage.getItem(tokenKey(id));
    } catch {
      return null;
    }
  }, [fromUrl, id]);
}

function isUpcoming(b) {
  const end = b.dates?.end || b.dates?.start;
  if (!end) return true;
  return new Date(end).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

const PAGE_CSS = `
.mb-wrap { max-width: 640px; }
.mb-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; color: #ffb347; font-size: 13.5px; font-weight: 700; text-decoration: none; }
.mb-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
.mb-primary { min-height: 48px; border-radius: 999px; font-size: 15px; font-weight: 800; cursor: pointer; border: 1px solid rgba(255,107,133,.55); background: rgba(255,107,133,.12); color: #ff8fa3; }
.mb-primary:hover { background: rgba(255,107,133,.2); }
.mb-help { margin-top: 22px; font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.7); }
.mb-help a { color: #ffb347; }
.mb-card { display: block; }
.mb-card .mt-main { padding: 18px; }
.mb-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 18px; border-top: 2px dashed rgba(255,255,255,0.12); }
`;

export default function ManageBookingPage() {
  const { id } = useParams();
  const manageToken = useManageToken(id);
  const loginToken = (() => {
    try {
      return localStorage.getItem("token");
    } catch {
      return null;
    }
  })();
  // The link works on its own; a signed-in owner without a link uses their login.
  const authHeaders = useMemo(
    () =>
      manageToken
        ? { "x-manage-token": manageToken }
        : loginToken
        ? { Authorization: `Bearer ${loginToken}` }
        : null,
    [manageToken, loginToken]
  );

  const [state, setState] = useState({
    loading: true,
    booking: null,
    error: "",
    expired: false,
  });
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!authHeaders) {
      setState({
        loading: false,
        booking: null,
        error: "",
        expired: true,
      });
      return;
    }
    try {
      const res = await fetch(`${API}/api/bookings/manage/${id}`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          loading: false,
          booking: null,
          error:
            data.message ||
            "We couldn't open this booking. Use Find my booking to get a new link.",
          expired: res.status === 401 || res.status === 403,
        });
        return;
      }
      setState({
        loading: false,
        booking: data.booking,
        error: "",
        expired: false,
      });
    } catch {
      setState({
        loading: false,
        booking: null,
        error: "We couldn't reach Skyrio. Check your connection and try again.",
        expired: false,
      });
    }
  }, [id, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const b = state.booking;

  return (
    <div className="mt mb-wrap">
      <style>{MT_CSS + PAGE_CSS}</style>
      {loginToken && (
        <Link to="/saved-trips" className="mb-back">
          ← My trips
        </Link>
      )}
      <div className="mt-kicker mt-mono">Manage booking</div>
      <h1 className="mt-title" style={{ fontSize: "clamp(26px,4vw,34px)" }}>
        {b
          ? b.status === "cancelled"
            ? "This booking is cancelled"
            : "Your booking"
          : "Manage your booking"}
      </h1>

      {state.loading ? (
        <div className="mt-skel" style={{ marginTop: 16 }} />
      ) : !b ? (
        <div style={{ marginTop: 12 }}>
          {state.error && (
            <div className="mt-error" role="alert" style={{ marginBottom: 14 }}>
              <AlertTriangle size={15} aria-hidden="true" />
              {state.error}
            </div>
          )}
          {state.expired && (
            <>
              <p className="mt-sub" style={{ marginBottom: 16 }}>
                Enter the email you booked with and your confirmation code, and
                we&apos;ll email you a new link to manage or cancel it.
              </p>
              <Link to="/find-booking" className="mt-cta">
                <Search size={16} aria-hidden="true" /> Find my booking
              </Link>
            </>
          )}
        </div>
      ) : (
        <BookingDetails b={b} onCancel={() => setCancelling(true)} />
      )}

      <p className="mb-help">
        Need help? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {b ? ` with booking ID ${String(b._id).slice(-10)}` : ""}.
      </p>

      {cancelling && b && (
        <CancelTripModal
          booking={b}
          authHeaders={authHeaders}
          onClose={() => setCancelling(false)}
          onDone={() => load()}
        />
      )}
    </div>
  );
}

function BookingDetails({ b, onCancel }) {
  const isHotel = b.type === "Hotel";
  const room = b.hotelStay?.rooms?.[0];
  const f = b.flight || {};
  const code = confirmationCodeOf(b);
  const start = fmtDate(b.dates?.start);
  const end = fmtDate(b.dates?.end);
  const paid = fmtMoney(b.totalAmount, b.totalCurrency);
  const st = STATUS[b.status] || { label: b.status, tone: "orange" };
  const title = isHotel
    ? room?.name || stripDates(b.tripDetails)
    : f.origin && f.destination
    ? `${f.origin} → ${f.destination}`
    : stripDates(b.tripDetails);
  const subtitle = isHotel
    ? [room?.roomName, room?.boardName].filter(Boolean).join(" · ")
    : f.airline;
  const requestOpen = b.cancelRequest?.status === "open";
  const canCancel =
    !b.sharedRoom && b.status === "confirmed" && isUpcoming(b) && !requestOpen;

  return (
    <>
      <article
        className={`mt-card mb-card${
          b.status === "cancelled" ? " is-cancelled" : ""
        }`}
        style={{ marginTop: 16 }}
      >
        <div className="mt-main">
          <div
            className="mt-thumb"
            style={
              room?.thumbnail
                ? { backgroundImage: `url(${room.thumbnail})` }
                : undefined
            }
            aria-hidden="true"
          >
            {!room?.thumbnail &&
              (isHotel ? <BedDouble size={24} /> : <Plane size={24} />)}
          </div>
          <div className="mt-body">
            <div className="mt-name">{title || "Trip"}</div>
            {subtitle && <div className="mt-sub2">{subtitle}</div>}
            <div className="mt-meta">
              {(start || end) && (
                <span>
                  <CalendarDays size={13} aria-hidden="true" />
                  {start}
                  {end && end !== start ? ` → ${end}` : ""}
                </span>
              )}
              {code && (
                <span>
                  <Hash size={13} aria-hidden="true" />
                  {isHotel ? "Hotel conf." : "Airline conf."}{" "}
                  <b className="mt-mono">{code}</b>
                </span>
              )}
            </div>

            {b.status === "cancelled" && b.cancellation?.airlineCredit && (
              <AirlineCredit
                credit={b.cancellation.airlineCredit}
                airline={f.airline}
              />
            )}
            {b.status === "cancelled" && b.refundAmount > 0 && (
              <div className="mt-note is-good">
                <Receipt size={13} aria-hidden="true" />
                Refund {fmtMoney(b.refundAmount, b.totalCurrency)}{" "}
                {b.refundStatus === "succeeded"
                  ? "issued"
                  : "on its way to your card"}
              </div>
            )}
            {b.status === "cancel_pending" && (
              <div className="mt-note is-warn">
                <Clock size={13} aria-hidden="true" />
                Cancellation sent. The {isHotel ? "hotel" : "airline"} has to
                confirm it on their end, which usually takes a few hours to a
                couple of days. It&apos;ll switch to Cancelled when it&apos;s
                done, and we&apos;ll email you.
              </div>
            )}
            {b.status === "confirmed" && requestOpen && (
              <div className="mt-note is-warn">
                <Clock size={13} aria-hidden="true" />
                Cancellation requested. Our team will contact you before
                anything is cancelled.
              </div>
            )}
            {b.sharedRoom && b.status === "confirmed" && (
              <div className="mt-note is-muted">
                <Users size={13} aria-hidden="true" />
                <span>
                  This room is shared with your Sync Together group (
                  {b.sharedRoom.people} people). Only the trip organizer can
                  cancel it, from the trip page.
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mb-row">
          <span className={`mt-pill is-${st.tone}`}>{st.label}</span>
          {paid && (
            <div style={{ textAlign: "right" }}>
              <div className="mt-priceLabel">Paid</div>
              <div className="mt-price">{paid}</div>
            </div>
          )}
        </div>
      </article>

      {canCancel && (
        <div className="mb-actions">
          <button type="button" className="mb-primary" onClick={onCancel}>
            Cancel booking
          </button>
          <p className="mt-sub" style={{ fontSize: 13, textAlign: "center" }}>
            You&apos;ll see what you get back before anything is cancelled.
          </p>
        </div>
      )}
      {b.status === "confirmed" && !isUpcoming(b) && (
        <p className="mt-sub" style={{ marginTop: 16, fontSize: 13 }}>
          This trip has already happened, so it can&apos;t be cancelled online.
        </p>
      )}
    </>
  );
}
