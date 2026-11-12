// Payment step for Duffel fares (offerId starts with "off_").
//
// Unlike LiteAPI fares (paid on LiteAPI's Stripe account), Skyrio is the
// merchant here: the card is AUTHORIZED on Skyrio's Stripe account, then
// /api/flights/duffel/complete books the ticket with Duffel and only then
// charges the card. If the airline can't book, the hold is released and the
// traveler is never charged.
//
// The publishable key must be from the SAME Stripe account as the backend's
// STRIPE_SECRET_KEY. It comes from GET /api/stripe-config, or from
// VITE_STRIPE_PUBLISHABLE_KEY / VITE_STRIPE_PK in the frontend .env.

import { useEffect, useMemo, useState } from "react";
import { skyrioStripeAppearance } from "@/lib/stripeAppearance";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Check, AlertTriangle } from "lucide-react";
import { apiHeaders, getCheckoutToken } from "@/utils/checkoutToken";

const API = import.meta.env.VITE_API_URL || "";
const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const APPEARANCE = skyrioStripeAppearance(SANS);

const stripePromises = new Map();
const getStripe = (pk) => {
  if (!stripePromises.has(pk)) stripePromises.set(pk, loadStripe(pk));
  return stripePromises.get(pk);
};
const cleanKey = (k) =>
  String(k || "").trim().replace(/^["']|["']$/g, "").trim() || null;

// Same account check LiteApiPayForm uses: "pi_3ABCDEFGHIJ…" → account fragment.
function accountFragment(secret) {
  const id = String(secret || "").split("_secret")[0];
  return id.startsWith("pi_") && id.length >= 19 ? id.slice(9, 19) : null;
}
// First "pk_test_…"/"pk_live_…" anywhere in the config response.
function findPk(obj, depth = 0) {
  if (typeof obj === "string") return /^pk_(test|live)_/.test(obj) ? obj : null;
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  for (const v of Object.values(obj)) {
    const k = findPk(v, depth + 1);
    if (k) return k;
  }
  return null;
}

const money = (n, cur = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(
    Number(n) || 0
  );
const fullName = (p) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();

function CardForm({ email, onAuthorized, onError, busy, setBusy, amountLabel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    onError("");
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
        ...(email && { receipt_email: email }),
      },
      redirect: "if_required",
    });
    if (error) {
      onError(error.message || "Your payment didn't go through.");
      setBusy(false);
      return;
    }
    // Manual capture: an authorized card shows "requires_capture".
    if (paymentIntent?.status === "requires_capture") {
      onAuthorized();
      return;
    }
    onError("Your card needs another step. Please try again or use a different card.");
    setBusy(false);
  }

  return (
    <>
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setReady(true)}
        onLoadError={() =>
          onError("The payment form couldn't load. Refresh the page and try again.")
        }
      />
      <button
        type="button"
        className="skc-btn-primary"
        style={{ marginTop: 16 }}
        onClick={pay}
        disabled={!stripe || !ready || busy}
      >
        {busy ? <span className="skc-spinner" /> : `Pay ${amountLabel}`}
      </button>
    </>
  );
}

export default function DuffelPayForm({
  clientSecret,
  checkoutId,
  total,
  currency = "USD",
  flight,
  passengers,
  groupId,
  fareExpired,
  onBack,
  onRestart,
  onBookingSuccess,
}) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("pay"); // pay | booking | done | pending | failed
  const [result, setResult] = useState(null);
  const lead = passengers?.[0] || {};

  // Skyrio's own publishable key (must match the backend's secret key).
  const frag = accountFragment(clientSecret);
  const fits = (k) => Boolean(k && (!frag || k.includes(frag)));
  const envKey = [
    cleanKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
    cleanKey(import.meta.env.VITE_STRIPE_PK),
  ].find(fits);
  const [pk, setPk] = useState(envKey || null);
  const [keyError, setKeyError] = useState("");
  useEffect(() => {
    if (pk || !clientSecret) return;
    let cancelled = false;
    fetch(`${API}/api/stripe-config`, { headers: apiHeaders() })
      .then((r) => r.json())
      .then((cfg) => {
        if (cancelled) return;
        const key = cleanKey(findPk(cfg));
        if (fits(key)) setPk(key);
        else {
          console.error("[duffel-pay] no Stripe publishable key matching this payment", {
            paymentAccount: frag,
            found: key ? key.slice(0, 16) + "…" : null,
          });
          setKeyError("The payment form couldn't load. Please contact support.");
        }
      })
      .catch(() => !cancelled && setKeyError("The payment form couldn't load. Refresh and try again."));
    return () => {
      cancelled = true;
    };
  }, [pk, clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  const stripePromise = useMemo(() => (pk ? getStripe(pk) : null), [pk]);
  const ready = agreed && clientSecret && checkoutId && !fareExpired;

  // Card authorized → book with Duffel → server captures or releases the hold.
  async function finish() {
    setStage("booking");
    setError("");
    try {
      const res = await fetch(`${API}/api/flights/duffel/complete`, {
        method: "POST",
        headers: apiHeaders(getCheckoutToken("flight", checkoutId)),
        body: JSON.stringify({
          checkoutId,
          groupId: groupId || null,
          confirmationEmail: {
            to: lead.email,
            passengerName: fullName(lead) || lead.firstName,
            airline: flight?.outbound?.airline,
            origin: flight?.raw?.origin || flight?.outbound?.from,
            destination: flight?.raw?.destination || flight?.outbound?.to,
            originName: flight?.raw?.slices?.[0]?.originName,
            destinationName: flight?.raw?.slices?.[0]?.destinationName,
            departureAt: flight?.raw?.departingAt,
            arrivalAt: flight?.raw?.arrivingAt,
            returnDepartureAt: flight?.raw?.returningAt || null,
            returnArrivingAt: flight?.raw?.returnArrivingAt || null,
            seats: [],
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setResult({ pnr: data.data?.bookingReference || null });
        setStage("done");
        onBookingSuccess?.();
        return;
      }
      if (res.status === 202 || data.pending) {
        setStage("pending");
        setError(data.message || "We're confirming your booking. You'll get an email shortly.");
        return;
      }
      // Every other failure released the hold on the server.
      setStage("failed");
      setError(data.message || "We couldn't book this flight. Your card was not charged.");
    } catch {
      // Network dropped mid-booking: the booking may or may not exist.
      setStage("pending");
      setError(
        "We lost connection while confirming. Please don't book again — check your email or My Trips in a few minutes."
      );
    } finally {
      setBusy(false);
    }
  }

  if (stage === "done") {
    return (
      <div
        role="status"
        style={{
          padding: "22px 20px",
          borderRadius: 14,
          background: "rgba(34,197,94,.08)",
          border: "1px solid rgba(34,197,94,.35)",
          color: "#fff",
          marginBottom: 20,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
          You're booked!
        </div>
        {result?.pnr && (
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            Airline confirmation: <strong>{result.pnr}</strong>
          </div>
        )}
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginBottom: 14 }}>
          {lead.email ? `We sent your confirmation to ${lead.email}.` : "Your confirmation is in My Trips."}
        </div>
        <a href="/saved-trips" className="skc-btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
          View My Trips
        </a>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAgreed((v) => !v)}
        role="checkbox"
        aria-checked={agreed}
        disabled={stage !== "pay"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${agreed ? "#f97316" : "rgba(255,255,255,0.10)"}`,
          background: agreed ? "rgba(249,115,22,.08)" : "rgba(255,255,255,0.04)",
          cursor: "pointer",
          marginBottom: 20,
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 14,
          minHeight: 52,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${agreed ? "#f97316" : "rgba(255,255,255,0.42)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: agreed ? "#f97316" : "transparent",
            flexShrink: 0,
          }}
        >
          {agreed && <Check size={11} strokeWidth={3} />}
        </div>
        <span>
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}>
            fare rules
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}>
            privacy policy
          </a>
          .
        </span>
      </button>

      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", fontWeight: 600, marginBottom: 14 }}>
          Payment
        </div>

        {!agreed && (
          <div style={{ padding: "18px 16px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.62)", fontSize: 13, textAlign: "center" }}>
            Agree to the fare rules above to enter your card.
          </div>
        )}

        {ready && (
          <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
            <strong style={{ color: "#fff" }}>Total: {money(total, currency)}</strong>
            <div style={{ marginTop: 4 }}>
              Fare including taxes and fees. Your card is charged only after the airline confirms your ticket.
            </div>
          </div>
        )}

        {stage === "booking" && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            <span className="skc-spinner" /> <span style={{ marginLeft: 8 }}>Confirming your ticket with the airline… don't close this page.</span>
          </div>
        )}

        {ready && stage === "pay" && !pk && !keyError && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.62)", fontSize: 13 }}>
            <span className="skc-spinner" /> <span style={{ marginLeft: 8 }}>Loading secure payment…</span>
          </div>
        )}

        {ready && stage === "pay" && stripePromise && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: "20px 16px" }}>
            <Elements key={`${pk}:${clientSecret}`} stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
              <CardForm
                email={lead.email}
                onAuthorized={finish}
                onError={setError}
                busy={busy}
                setBusy={setBusy}
                amountLabel={money(total, currency)}
              />
            </Elements>
          </div>
        )}
      </section>

      {(error || keyError) && (
        <div role="alert" style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            {error || keyError}
            {stage === "failed" && onRestart && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="skc-btn-back" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onRestart}>
                  Get a fresh price
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage !== "booking" && stage !== "pending" && (
        <div className="skc-btn-row">
          <button type="button" className="skc-btn-back" onClick={onBack}>
            ← Back
          </button>
        </div>
      )}
    </>
  );
}
