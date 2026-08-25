import React, { useState, useEffect, useCallback } from "react";
import { Button, Spin, message as antdMessage } from "antd";
import { LoadingOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { DollarSign, CreditCard, Users, Clock } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Loaded once, module-level — same pattern as any other Stripe.js usage
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/* ═══ SECTION WRAPPER — mirrors SyncGroupPage.jsx exactly ═══ */
const Section = ({ children, mt = 20 }) => (
  <div
    style={{
      marginTop: mt,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "20px 18px",
      backdropFilter: "blur(8px)",
    }}
  >
    {children}
  </div>
);
const SectionTitle = ({ icon, children, right }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 15,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {icon}
      {children}
    </div>
    {right}
  </div>
);

/* ═══ Inner form — needs Stripe context, so it's a child of <Elements> ═══ */
function PayForm({ bookingId, amountOwed, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      antdMessage.success("Your share is paid!");
      onPaid?.();
    } else {
      // e.g. "processing" — webhook will confirm shortly; the
      // PaymentProgressPanel / a follow-up poll will pick this up.
      antdMessage.info("Payment is processing...");
      onPaid?.();
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          padding: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <PaymentElement />
      </div>
      {error && (
        <p style={{ color: "#ff4d4f", fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}
      <Button
        htmlType="submit"
        className="sk-sync-cta-btn"
        icon={<CreditCard size={14} />}
        loading={submitting}
        disabled={!stripe || submitting}
        style={{ width: "100%" }}
      >
        {submitting ? "Processing..." : `Pay $${(amountOwed / 100).toFixed(2)}`}
      </Button>
    </form>
  );
}

/* ═══ MAIN COMPONENT ═══
   Drop this into SyncGroupPage.jsx once group.status === "payment_pending"
   and the current user's share is unpaid, e.g.:

     {group.status === "payment_pending" && myMember?.paymentStatus !== "paid" && (
       <PaymentShareCard bookingId={group.bookingId} onPaid={fetchGroup} />
     )}
*/
export default function PaymentShareCard({ bookingId, onPaid }) {
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState(null);
  const [amountOwed, setAmountOwed] = useState(0);
  const [status, setStatus] = useState("unpaid"); // unpaid | paid | failed
  const [notFound, setNotFound] = useState(false);

  const fetchMyShare = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/my-split/${bookingId}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setClientSecret(data.clientSecret);
        setAmountOwed(data.amountOwed);
        setStatus(data.status);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      antdMessage.error("Failed to load your payment share");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchMyShare();
  }, [fetchMyShare]);

  if (loading) {
    return (
      <Section>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Spin
            indicator={
              <LoadingOutlined style={{ fontSize: 22, color: "#ff8a2a" }} />
            }
          />
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              marginTop: 12,
              fontSize: 13,
            }}
          >
            Loading your share...
          </p>
        </div>
      </Section>
    );
  }

  if (notFound) return null; // this user isn't on a split for this booking

  if (status === "paid") {
    return (
      <Section>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <CheckCircleOutlined style={{ fontSize: 36, color: "#52c41a" }} />
          <p style={{ color: "#52c41a", fontWeight: 600, marginTop: 10 }}>
            You've paid your share
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Waiting on the rest of the group.
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <SectionTitle
        icon={<Users size={16} style={{ color: "#ff8a2a" }} />}
        right={
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <Clock size={11} /> Your share
          </span>
        }
      >
        Pay Your Share
      </SectionTitle>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          color: "#ff8a2a",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        <DollarSign size={20} />
        {(amountOwed / 100).toFixed(2)}
      </div>
      {clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#ff8a2a",
                colorBackground: "#1e0b35",
                colorText: "#ffffff",
                borderRadius: "10px",
              },
            },
          }}
        >
          <PayForm
            bookingId={bookingId}
            amountOwed={amountOwed}
            onPaid={() => {
              setStatus("paid");
              onPaid?.();
            }}
          />
        </Elements>
      )}
    </Section>
  );
}
