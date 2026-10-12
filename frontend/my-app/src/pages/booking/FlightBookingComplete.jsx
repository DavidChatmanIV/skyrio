// pages/booking/FlightBookingComplete.jsx
// The LiteAPI payment SDK redirects here after the traveler pays.
// Reads what LiteApiPayForm saved, then finalizes with your EXISTING
// POST /api/flights/complete (TRANSACTION_ID), same as the old flow did.

import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plane, AlertTriangle } from "lucide-react";

const PENDING_KEY = "skyrio_pending_flight_payment";
const API = import.meta.env?.VITE_API_URL || "";

function readPending() {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writePending(data) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
  } catch {
    /* non-fatal */
  }
}

const card = {
  maxWidth: 440,
  margin: "60px auto",
  padding: 28,
  borderRadius: 18,
  background: "rgba(16,12,34,0.85)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#fff",
  textAlign: "center",
};

export default function FlightBookingComplete() {
  const [params] = useSearchParams();
  const redirectStatus = params.get("redirect_status");
  const [state, setState] = useState({ phase: "booking" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const pending = readPending();

    if (redirectStatus && redirectStatus !== "succeeded") {
      setState({ phase: "error", error: "Your payment didn't go through, so you weren't charged. Go back and try again." });
      return;
    }
    if (!pending?.prebookId || !pending?.transactionId) {
      setState({
        phase: "error",
        error: "We couldn't find your checkout details. If your card shows a pending charge, it releases on its own in 1–2 business days. Contact support if you need help.",
      });
      return;
    }
    // Refresh after success: show the result again instead of re-booking.
    if (pending.completed) {
      setState({ phase: "done", pending });
      return;
    }

    (async () => {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      try {
        const res = await fetch(`${API}/api/flights/complete`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            prebookId: pending.prebookId,
            prebookID: pending.prebookId,
            payment: { method: "TRANSACTION_ID", transactionId: pending.transactionId },
            ...(pending.groupId && { groupId: pending.groupId }),
            confirmationEmail: pending.confirmationEmail,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(
            data.message || "Payment went through but we couldn't finalize your booking. Contact support — you won't be charged twice."
          );
        }

        const done = { ...pending, completed: true, bookingId: data.booking?._id || null };
        writePending(done);
        if (pending.progressKey) {
          try { window.sessionStorage.removeItem(pending.progressKey); } catch { /* non-fatal */ }
        }
        setState({ phase: "done", pending: done });
      } catch (e) {
        setState({ phase: "error", error: e.message });
      }
    })();
  }, [redirectStatus]);

  if (state.phase === "booking") {
    return (
      <div style={card}>
        <span className="skc-spinner" />
        <p style={{ marginTop: 14, color: "rgba(255,255,255,0.62)" }}>Confirming your seats with the airline…</p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div style={card}>
        <AlertTriangle size={28} color="#f87171" />
        <p role="alert" style={{ marginTop: 12, color: "#f87171", lineHeight: 1.5 }}>{state.error}</p>
        <Link to="/booking" style={{ display: "inline-block", marginTop: 16, color: "#ff8a2a" }}>Back to booking</Link>
      </div>
    );
  }

  const p = state.pending;
  return (
    <div style={card}>
      <div
        style={{
          width: 72,
          height: 72,
          margin: "0 auto 16px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plane size={32} color="#1b1024" />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>You're booked!</h1>
      {p.confirmationEmail?.to && (
        <p style={{ color: "rgba(255,255,255,0.62)", marginTop: 8 }}>
          Confirmation sent to <strong style={{ color: "#fff" }}>{p.confirmationEmail.to}</strong>
        </p>
      )}
      <div style={{ textAlign: "left", marginTop: 20, fontSize: 14, lineHeight: 1.8 }}>
        {p.summary?.outbound && <div>{p.summary.outbound}</div>}
        {p.summary?.return && <div>{p.summary.return}</div>}
        {typeof p.total === "number" && (
          <div style={{ marginTop: 10, fontWeight: 800, fontSize: 20, color: "#ff8a2a" }}>
            Total: ${p.total.toFixed(2)}
          </div>
        )}
      </div>
      {p.groupId && (
        <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 13, marginTop: 14 }}>
          Your seat is on the group trip page.{" "}
          <Link to={`/sync-together/${p.groupId}`} style={{ color: "#ff8a2a" }}>
            Back to the trip
          </Link>
        </p>
      )}
      <Link to="/saved-trips" style={{ display: "inline-block", marginTop: 18, color: "#ff8a2a" }}>
        View my trips
      </Link>
    </div>
  );
}
