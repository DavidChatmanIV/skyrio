// ─────────────────────────────────────────────────────────────
// The page a single traveler opens via their own link
// (/pay-share/:splitPaymentId/:shareId) to pay just their assigned
// share of a split hotel booking. Add a route for this in your
// router config, e.g.:
//
//   import PayShare from "@/pages/booking/PayShare";
//   <Route path="/pay-share/:splitPaymentId/:shareId" element={<PayShare />} />
//
// Deliberately does NOT require the visitor to be logged in as the
// organizer — anyone with the link can pay their own share. If your
// app requires auth for all routes, this one should be an exception
// (or at minimum should not require the SAME account as the
// organizer's).
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Typography, Button, message as antdMessage } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { CheckCircle2 } from "lucide-react";

import "@/styles/BookingPage.css";

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || "";
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

function PayForm({ shareInfo, splitPaymentId, shareId, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(shareInfo.clientSecret, {
          payment_method: { card: elements.getElement(CardElement) },
        });
      if (confirmError)
        throw new Error(confirmError.message || "Payment failed");
      if (paymentIntent?.status !== "succeeded") {
        throw new Error("Payment was not completed — please try again.");
      }
      // The Stripe webhook (server-side) marks this share paid and
      // finalizes the whole booking once every share is in — this
      // page just needs to reflect that this ONE payment succeeded.
      onPaid();
    } catch (err) {
      setError(err.message || "Payment failed");
      antdMessage.error(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sk-checkout-payment">
      <label className="sk-prefill-label">Card details</label>
      <div className="sk-checkout-card-element">
        <CardElement
          options={{
            style: {
              base: {
                color: "#fff",
                fontSize: "15px",
                "::placeholder": { color: "rgba(255,255,255,0.35)" },
              },
              invalid: { color: "#ff6b6b" },
            },
          }}
        />
      </div>
      {error && <div className="sk-checkout-error">{error}</div>}
      <Button
        className="sk-btn-orange sk-checkout-pay-btn"
        block
        onClick={handlePay}
        disabled={submitting || !stripe}
        icon={submitting ? <LoadingOutlined /> : undefined}
      >
        {submitting ? "Processing…" : `Pay $${shareInfo.amount.toFixed(0)}`}
      </Button>
    </div>
  );
}

export default function PayShare() {
  const { splitPaymentId, shareId } = useParams();
  const [shareInfo, setShareInfo] = useState(null);
  const [error, setError] = useState(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    fetch(
      `${API}/api/split-payments/${splitPaymentId}/shares/${shareId}/client-secret`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok)
          throw new Error(
            data.message || "This payment link isn't valid anymore."
          );
        setShareInfo(data);
      })
      .catch((err) => setError(err.message));
  }, [splitPaymentId, shareId]);

  if (paid) {
    return (
      <div className="sk-booking sk-checkout-page">
        <div className="sk-checkout-confirm">
          <CheckCircle2 size={48} color="#ff8a2a" />
          <Title level={3} style={{ color: "#fff", marginTop: 14 }}>
            You're all set!
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.6)" }}>
            Your payment went through. The room books automatically once
            everyone in your group has paid their share.
          </Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sk-booking sk-checkout-page">
        <div className="sk-checkout-empty">
          <Text style={{ color: "#ff6b6b" }}>{error}</Text>
        </div>
      </div>
    );
  }

  if (!shareInfo) {
    return (
      <div className="sk-booking sk-checkout-page">
        <div className="sk-checkout-empty">
          <LoadingOutlined /> Loading your payment details…
        </div>
      </div>
    );
  }

  return (
    <div className="sk-booking sk-checkout-page">
      <div className="sk-checkout-wrap" style={{ maxWidth: 480 }}>
        <Title className="sk-hero-title" style={{ fontSize: 26 }}>
          Pay for your <span className="sk-hero-title-accent">room</span>
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.55)" }}>
          {shareInfo.label} — {shareInfo.assignedName}
        </Text>

        <div
          className="sk-result-card"
          style={{ padding: 20, marginTop: 20, borderRadius: 16 }}
        >
          <div className="sk-checkout-total-row" style={{ marginBottom: 16 }}>
            <span>Your share</span>
            <span className="sk-priceAmt">
              ${shareInfo.amount.toFixed(0)} {shareInfo.currency}
            </span>
          </div>
          <Elements stripe={stripePromise}>
            <PayForm
              shareInfo={shareInfo}
              splitPaymentId={splitPaymentId}
              shareId={shareId}
              onPaid={() => setPaid(true)}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
}
