// frontend/my-app/src/components/checkout/HotelPaymentStep.jsx
// Used inside BookingCheckout.jsx for hotels, after the guest form is filled:
//   <HotelPaymentStep offerId={offerId} holder={holder} guests={guests} onBooked={(b) => navigate("/trips")} />
// Needs: @stripe/stripe-js, @stripe/react-stripe-js
// Env:   VITE_STRIPE_PUBLISHABLE_KEY (Skyrio's own pk_test_/pk_live_ key)

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiUrl } from "@/lib/api";

const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PK ? loadStripe(PK) : null;

const appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#ff8a2a",
    colorBackground: "rgba(255,255,255,0.04)",
    colorText: "#f5f5f7",
    borderRadius: "12px",
  },
};

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export default function HotelPaymentStep({
  offerId,
  holder,
  guests,
  onBooked,
}) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/hotel-payments/intent"), {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({ offerId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  if (!stripePromise) {
    return (
      <p role="alert" style={{ color: "#ff6b6b" }}>
        Payments aren't configured. Add VITE_STRIPE_PUBLISHABLE_KEY.
      </p>
    );
  }
  if (error)
    return (
      <p role="alert" style={{ color: "#ff6b6b" }}>
        {error}
      </p>
    );
  if (!session) return <p>Locking in your rate…</p>;

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: session.clientSecret, appearance }}
    >
      <PayForm
        session={session}
        holder={holder}
        guests={guests}
        onBooked={onBooked}
      />
    </Elements>
  );
}

function PayForm({ session, holder, guests, onBooked }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState("idle"); // idle | paying | booking
  const [error, setError] = useState("");

  const price = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: session.currency || "USD",
  }).format(session.total || 0);

  async function handlePay() {
    if (!stripe || !elements) return;
    if (!holder?.firstName || !holder?.lastName || !holder?.email) {
      setError("Add the main guest's name and email before paying.");
      return;
    }
    setError("");
    setStatus("paying");

    const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (stripeErr) {
      setError(stripeErr.message);
      setStatus("idle");
      return;
    }
    if (paymentIntent?.status !== "requires_capture") {
      setError("Your card wasn't authorized. Try another card.");
      setStatus("idle");
      return;
    }

    setStatus("booking");
    try {
      const res = await fetch(apiUrl("/api/hotel-payments/confirm"), {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          holder,
          guests,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) {
        setError(
          "Still confirming with the hotel. Check My Trips in a minute."
        );
        return;
      }
      if (!res.ok) throw new Error(data.error || "Booking failed.");
      onBooked?.(data.booking);
    } catch (e) {
      setError(e.message);
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0 }}>
        Total: <strong>{price}</strong>
      </p>
      <PaymentElement />
      {error && (
        <p role="alert" style={{ color: "#ff6b6b", margin: 0 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || busy}
        style={{
          padding: "14px 20px",
          borderRadius: 12,
          border: 0,
          fontWeight: 600,
          color: "#fff",
          background:
            "var(--ap-grad, linear-gradient(135deg, #ff8a2a, #ff4d00))",
          opacity: busy ? 0.6 : 1,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {status === "paying"
          ? "Authorizing card…"
          : status === "booking"
          ? "Confirming with hotel…"
          : `Pay ${price}`}
      </button>
    </div>
  );
}
