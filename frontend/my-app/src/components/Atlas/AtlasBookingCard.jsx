// src/components/atlas/AtlasBookingCard.jsx
// Rendered in the Atlas chat when a propose_booking tool result comes back.
// Rendered by AtlasPanel.jsx for an action of type "booking".
import { useEffect, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { atlasApi } from "./atlasApi";
import "@/styles/atlas-booking-card.css";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const money = (cents, currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

const PlaneIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
  </svg>
);
const BedIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M3 7v11h2v-2h14v2h2v-6a4 4 0 0 0-4-4h-6v5H5V7zm4 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
  </svg>
);

export default function AtlasBookingCard({ proposalId }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);

  const load = useCallback(async () => {
    const { ok, data } = await atlasApi(`/api/atlas/proposals/${proposalId}`);
    if (ok) setP(data);
  }, [proposalId]);

  useEffect(() => {
    load();
  }, [load]);

  // Countdown so the user knows the price is only held briefly
  useEffect(() => {
    if (!p || p.status !== "pending") return;
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(p.expiresAt) - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) setP((prev) => ({ ...prev, status: "expired" }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [p]);

  async function post(path) {
    const { ok, data } = await atlasApi(`/api/atlas/proposals/${proposalId}/${path}`, {
      method: "POST",
      body: {},
    });
    return { ok, body: data };
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const { ok, body } = await post("confirm");

      if (body.clientSecret) {
        // Bank asked for 3D Secure
        const stripe = await stripePromise;
        const { error: actionErr } = await stripe.handleNextAction({ clientSecret: body.clientSecret });
        if (actionErr) throw new Error(actionErr.message);
        const fin = await post("finalize");
        setP(fin.body);
        return;
      }

      setP(body);
      if (!ok) setError(body.error || body.failureReason || "Something went wrong.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    const { body } = await post("cancel");
    setP(body);
  }

  if (!p) return <div className="abc-card abc-loading">Loading booking…</div>;

  const mm = secondsLeft != null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "";

  return (
    <div className={`abc-card abc-${p.status}`}>
      <div className="abc-head">
        <span className="abc-icon">{p.kind === "flight" ? <PlaneIcon /> : <BedIcon />}</span>
        <div>
          <div className="abc-title">{p.summary.title}</div>
          {p.syncTrip && <div className="abc-tag">Your share · Sync Together</div>}
        </div>
      </div>

      <ul className="abc-lines">
        {p.summary.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      {p.summary.cancellation && <p className="abc-policy">{p.summary.cancellation}</p>}

      <div className="abc-total">
        <span>Total charged</span>
        <strong>{money(p.amount, p.currency)}</strong>
      </div>

      {p.status === "pending" && (
        <>
          <p className="abc-hold">Price held for {mm}. Charged to your saved card.</p>
          <div className="abc-actions">
            <button className="abc-btn abc-primary" onClick={confirm} disabled={busy}>
              {busy ? "Booking…" : "Confirm & Pay"}
            </button>
            <button className="abc-btn abc-ghost" onClick={cancel} disabled={busy}>
              Not now
            </button>
          </div>
        </>
      )}

      {(p.status === "processing" || p.status === "requires_action") && <p className="abc-hold">Finishing up…</p>}

      {p.status === "booked" && (
        <div className="abc-done">
          <CheckIcon /> Booked. It's in your Trips.
        </div>
      )}

      {p.status === "expired" && <p className="abc-msg">This price expired. Ask Atlas to search again.</p>}
      {p.status === "price_changed" && <p className="abc-msg">The price changed before booking. Nothing was charged.</p>}
      {p.status === "cancelled" && <p className="abc-msg">Cancelled. Nothing was charged.</p>}
      {p.status === "failed" && <p className="abc-msg">{p.failureReason || "Booking didn't go through."}</p>}
      {error && p.status === "pending" && <p className="abc-msg">{error}</p>}
    </div>
  );
}
