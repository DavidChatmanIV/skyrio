import React, { useEffect, useState } from "react";
import { Typography, Button, Space } from "antd";
import { useNavigate } from "react-router-dom";
import {
  Plane,
  BedDouble,
  CalendarDays,
  Hash,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import SavedTrips from "../components/SavedTrips";

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || "";

// ─────────────────────────────────────────────
// Helpers — every value shown comes from the saved booking record
// ─────────────────────────────────────────────
const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
};

const fmtMoney = (amount, currency) =>
  Number.isFinite(Number(amount))
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(Number(amount))
    : null;

function confirmationCodeOf(b) {
  return (
    b.confirmationCodes?.[0] ||
    b.flight?.bookingRef ||
    b.hotelStay?.confirmation?.find((c) => c?.hotelConfirmationCode)
      ?.hotelConfirmationCode ||
    null
  );
}

function isUpcoming(b) {
  const end = b.dates?.end || b.dates?.start;
  if (!end) return true;
  return new Date(end).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

// ─────────────────────────────────────────────
// One booked trip
// ─────────────────────────────────────────────
function BookedTripCard({ b, onCancel }) {
  const isHotel = b.type === "Hotel";
  const room = b.hotelStay?.rooms?.[0];
  const code = confirmationCodeOf(b);
  const start = fmtDate(b.dates?.start);
  const end = fmtDate(b.dates?.end);
  const paid = fmtMoney(b.totalAmount ?? b.total, b.totalCurrency);
  const statusColor =
    b.status === "confirmed"
      ? "#34d399"
      : b.status === "cancelled"
      ? "#f87171"
      : "#ffb347";

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 16,
        borderRadius: 16,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        marginBottom: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: room?.thumbnail
            ? `center / cover no-repeat url(${room.thumbnail})`
            : "linear-gradient(135deg, rgba(255,138,42,.25), rgba(124,58,237,.25))",
          color: "#ff8a2a",
        }}
      >
        {!room?.thumbnail &&
          (isHotel ? <BedDouble size={26} /> : <Plane size={26} />)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
            {isHotel ? room?.name || b.tripDetails : b.tripDetails}
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".05em",
              color: statusColor,
              border: `1px solid ${statusColor}55`,
              background: `${statusColor}14`,
              borderRadius: 20,
              padding: "3px 10px",
              height: "fit-content",
            }}
          >
            {b.status}
          </span>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            marginTop: 4,
            lineHeight: 1.7,
          }}
        >
          {isHotel && room?.roomName && (
            <div>
              {room.roomName}
              {room.boardName ? ` · ${room.boardName}` : ""}
            </div>
          )}
          {!isHotel && b.flight?.airline && <div>{b.flight.airline}</div>}
          {(start || end) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarDays size={13} />
              {start}
              {end && end !== start ? ` → ${end}` : ""}
            </div>
          )}
          {code && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Hash size={13} />
              {isHotel ? "Hotel confirmation" : "Airline confirmation"}:{" "}
              <strong style={{ color: "#fff" }}>{code}</strong>
            </div>
          )}
          {paid && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Receipt size={13} />
              Paid <strong style={{ color: "#ff8a2a" }}>{paid}</strong>
            </div>
          )}
          {b.status === "cancelled" && b.refundAmount > 0 && (
            <div style={{ color: "#34d399" }}>
              Refund {fmtMoney(b.refundAmount, b.totalCurrency)}
              {b.refundStatus === "succeeded"
                ? " issued"
                : " on its way to your card"}
            </div>
          )}
          {b.status === "cancel_pending" && (
            <div style={{ color: "#ffb347" }}>
              The airline is processing your cancellation.
            </div>
          )}
        </div>
        {onCancel && b.status === "confirmed" && isUpcoming(b) && (
          <button
            type="button"
            onClick={() => onCancel(b)}
            style={{
              marginTop: 10,
              background: "none",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.75)",
              borderRadius: 10,
              padding: "7px 12px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel trip
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Cancel flow — shows the real terms BEFORE anything is cancelled
// ─────────────────────────────────────────────
function CancelTripModal({ booking, onClose, onDone }) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const cur = booking.totalCurrency || "USD";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/bookings/${booking._id}/cancel-quote`,
          { headers }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "Couldn't load cancellation terms.");
        if (!cancelled) setQuote(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking._id]);

  const confirmCancel = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/bookings/${booking._id}/cancel`, {
        method: "POST",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202 && res.status !== 207) {
        throw new Error(data.message || "Cancellation failed.");
      }
      setResult(data);
      onDone?.(data.booking);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const box = {
    maxWidth: 460,
    width: "100%",
    background: "#150f28",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 24,
    color: "#fff",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={busy ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(8,6,18,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={box}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          Cancel this trip?
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {booking.tripDetails}
        </div>

        {result ? (
          <>
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              {result.pending
                ? "Your cancellation request was sent. The airline will confirm it shortly, and we'll notify you."
                : result.partial
                ? result.message
                : result.customerRefund > 0
                ? `Cancelled. A refund of ${fmtMoney(
                    result.customerRefund,
                    cur
                  )} is on its way to your card (usually 5–10 business days).`
                : "Cancelled. Under the policy for this booking, no refund applies."}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#f97316,#ec4899)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            {!quote && !error && (
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                Checking the cancellation terms…
              </div>
            )}
            {quote && quote.cancellable === false && (
              <div style={{ color: "#ffb347", fontSize: 14, marginBottom: 16 }}>
                {quote.reason}
              </div>
            )}
            {quote && quote.cancellable !== false && (
              <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
                <div>
                  You paid:{" "}
                  <strong>{fmtMoney(quote.paid, quote.currency)}</strong>
                </div>
                <div>
                  Estimated refund:{" "}
                  <strong style={{ color: "#34d399" }}>
                    {quote.estimatedRefund != null
                      ? fmtMoney(quote.estimatedRefund, quote.currency)
                      : "set by the airline at cancellation"}
                  </strong>
                </div>
                {quote.estimatedFee != null && quote.estimatedFee > 0 && (
                  <div>
                    Cancellation fee:{" "}
                    {fmtMoney(quote.estimatedFee, quote.currency)}
                  </div>
                )}
                <div
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  {quote.note}
                </div>
              </div>
            )}
            {error && (
              <div
                style={{
                  color: "#f87171",
                  fontSize: 13,
                  marginBottom: 14,
                  display: "flex",
                  gap: 6,
                }}
              >
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Keep my trip
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={busy || !quote || quote.cancellable === false}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(248,113,113,.5)",
                  background: "rgba(248,113,113,.12)",
                  color: "#f87171",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity:
                    busy || !quote || quote.cancellable === false ? 0.5 : 1,
                }}
              >
                {busy ? "Cancelling…" : "Cancel trip"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Booked trips — the signed-in user's own bookings
// ─────────────────────────────────────────────
function BookedTrips() {
  const [state, setState] = useState({ loading: true, items: [], error: "" });
  const [cancelling, setCancelling] = useState(null);
  const replaceBooking = (updated) => {
    if (!updated?._id) return;
    setState((s) => ({
      ...s,
      items: s.items.map((b) =>
        b._id === updated._id ? { ...b, ...updated } : b
      ),
    }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          if (!cancelled) setState({ loading: false, items: [], error: "" });
          return;
        }
        const res = await fetch(`${API}/api/bookings?mine=1&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "Couldn't load your trips.");
        const items = (data.items || []).filter((b) =>
          ["confirmed", "cancel_pending", "cancelled"].includes(b.status)
        );
        if (!cancelled) setState({ loading: false, items, error: "" });
      } catch (e) {
        if (!cancelled)
          setState({ loading: false, items: [], error: e.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = state.items
    .filter(isUpcoming)
    .sort(
      (a, b) => new Date(a.dates?.start || 0) - new Date(b.dates?.start || 0)
    );
  const past = state.items.filter((b) => !isUpcoming(b));

  const heading = (label) => (
    <div
      style={{
        fontSize: 11,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.45)",
        fontWeight: 600,
        margin: "18px 0 10px",
      }}
    >
      {label}
    </div>
  );

  return (
    <section style={{ marginTop: 24, marginBottom: 36 }}>
      <Title level={4} style={{ color: "#fff", margin: 0 }}>
        Booked trips
      </Title>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
        Confirmed flights and stays. Your confirmation emails have the full
        details.
      </Text>

      {state.loading && (
        <div
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            marginTop: 16,
          }}
        >
          Loading your trips…
        </div>
      )}
      {!state.loading && state.error && (
        <div style={{ color: "#f87171", fontSize: 13, marginTop: 16 }}>
          {state.error}
        </div>
      )}
      {!state.loading && !state.error && state.items.length === 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "18px 16px",
            borderRadius: 14,
            border: "1px dashed rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          No booked trips yet.
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          {heading("Upcoming")}
          {upcoming.map((b) => (
            <BookedTripCard key={b._id} b={b} onCancel={setCancelling} />
          ))}
        </>
      )}
      {past.length > 0 && (
        <>
          {heading("Past")}
          {past.map((b) => (
            <BookedTripCard key={b._id} b={b} />
          ))}
        </>
      )}

      {cancelling && (
        <CancelTripModal
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onDone={replaceBooking}
        />
      )}
    </section>
  );
}

export default function SavedTripsPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 20px 48px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <Space
        style={{
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 8,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: "#fff" }}>
            My Trips
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Your booked trips, plus everything you've saved for later.
          </Text>
        </div>
        <Button
          onClick={() => navigate("/booking")}
          style={{
            background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
            border: "none",
            color: "#fff",
            fontWeight: 600,
            borderRadius: 10,
          }}
        >
          Find more trips
        </Button>
      </Space>

      <BookedTrips />

      <Title level={4} style={{ color: "#fff", margin: "0 0 4px" }}>
        Saved for later
      </Title>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
        Your shortlist — compare options, book when ready.
      </Text>
      <SavedTrips />
    </div>
  );
}
