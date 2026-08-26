import React, { useMemo, useState, useCallback } from "react";
import {
  Typography,
  Card,
  Button,
  Input,
  Divider,
  message as antdMessage,
} from "antd";
import { ArrowLeftOutlined, LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { CheckCircle2, Users, BedDouble, MapPin } from "lucide-react";

import "@/styles/BookingPage.css"; // reuses sk-* dark-glass tokens/classes

const { Title, Text } = Typography;

const API = import.meta.env.VITE_API_URL || "";

// NOTE: assumes Stripe is already wired the same way BookingCheckout.jsx
// uses it elsewhere in Skyrio (VITE_STRIPE_PUBLIC_KEY env var + a backend
// route that returns a PaymentIntent client secret). Adjust the env var
// name and the /api/hotels/book route below if your existing setup differs.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return null;
  const n = dayjs(checkout).diff(dayjs(checkin), "day");
  return Number.isFinite(n) && n > 0 ? n : null;
}

function roomKey(r) {
  return `${r.hotelId}-${r.offerId}`;
}

// ─────────────────────────────────────────────
// Per-room summary line
// ─────────────────────────────────────────────
function RoomLineItem({ room, index }) {
  const nights = nightsBetween(room.checkin, room.checkout);
  return (
    <div className="sk-checkout-room-line">
      <div
        className="sk-thumb sk-checkout-room-thumb"
        style={
          room.thumbnail
            ? {
                backgroundImage: `url(${room.thumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />
      <div className="sk-checkout-room-info">
        <div className="sk-checkout-room-title">
          Room {index + 1} · {room.name}
        </div>
        <div className="sk-checkout-room-meta">
          <BedDouble
            size={12}
            style={{ marginRight: 4, verticalAlign: "middle" }}
          />
          {room.roomName || "Standard room"}
          {room.boardName ? ` · ${room.boardName}` : ""}
        </div>
        {room.address && (
          <div className="sk-checkout-room-meta">
            <MapPin
              size={12}
              style={{ marginRight: 4, verticalAlign: "middle" }}
            />
            {room.address}
          </div>
        )}
        <div className="sk-checkout-room-meta">
          {room.checkin && room.checkout
            ? `${dayjs(room.checkin).format("MMM D")} → ${dayjs(
                room.checkout
              ).format("MMM D")}${
                nights ? ` · ${nights} night${nights !== 1 ? "s" : ""}` : ""
              }`
            : "Dates TBD"}
        </div>
      </div>
      <div className="sk-checkout-room-price">
        ${(room.totalAmount ?? 0).toFixed(0)}
        <span className="sk-priceSub">{room.totalCurrency || "USD"}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Guest / traveler assignment for a single room
// (kept lightweight — one contact name per room so multi-room
// bookings can be attributed to whoever is staying in each one)
// ─────────────────────────────────────────────
function RoomGuestField({ room, index, value, onChange }) {
  return (
    <div className="sk-checkout-guest-field">
      <label className="sk-prefill-label">
        Room {index + 1} guest name ({room.name})
      </label>
      <Input
        className="sk-prefill-input"
        placeholder="Full name for this room"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Payment form (wrapped in <Elements> below)
// ─────────────────────────────────────────────
function PaymentForm({ rooms, guestNames, contactEmail, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const grandTotal = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0),
    [rooms]
  );

  const handlePay = async () => {
    if (!stripe || !elements) return;
    if (!contactEmail.trim()) {
      return antdMessage.warning("Enter a contact email for the booking");
    }
    if (guestNames.some((n) => !n.trim())) {
      return antdMessage.warning("Enter a guest name for every room");
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");

      // Backend should accept an array of rooms and return a single
      // PaymentIntent client secret covering the combined total —
      // adjust the route/payload shape to match your existing
      // /api/hotels/* naming if it differs.
      const res = await fetch(`${API}/api/hotels/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rooms: rooms.map((r, i) => ({
            hotelId: r.hotelId,
            offerId: r.offerId,
            checkin: r.checkin,
            checkout: r.checkout,
            totalAmount: r.totalAmount,
            totalCurrency: r.totalCurrency || "USD",
            guestName: guestNames[i],
          })),
          contactEmail: contactEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Couldn't start hotel booking");
      }

      const { clientSecret } = data;
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: { email: contactEmail.trim() },
          },
        });

      if (confirmError) {
        throw new Error(confirmError.message || "Payment failed");
      }

      if (paymentIntent?.status === "succeeded") {
        antdMessage.success("Booking confirmed!");
        onSuccess({
          confirmationId: data.bookingId || paymentIntent.id,
          rooms,
        });
      } else {
        throw new Error("Payment was not completed — please try again.");
      }
    } catch (err) {
      setError(err.message || "Booking failed");
      antdMessage.error(err.message || "Booking failed");
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
        {submitting
          ? "Processing…"
          : `Pay $${grandTotal.toFixed(0)} · Book ${rooms.length} room${
              rooms.length !== 1 ? "s" : ""
            }`}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirmation screen
// ─────────────────────────────────────────────
function ConfirmationScreen({ confirmation, onBack }) {
  const { confirmationId, rooms } = confirmation;
  const total = rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  return (
    <div className="sk-booking sk-checkout-page">
      <div className="sk-checkout-confirm">
        <CheckCircle2 size={48} color="#ff8a2a" />
        <Title level={3} style={{ color: "#fff", marginTop: 14 }}>
          You're booked!
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.6)" }}>
          Confirmation #{confirmationId}
        </Text>

        <Card
          variant="borderless"
          className="sk-result-card"
          style={{ marginTop: 24, width: "100%", maxWidth: 560 }}
        >
          {rooms.map((r, i) => (
            <RoomLineItem key={roomKey(r)} room={r} index={i} />
          ))}
          <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />
          <div className="sk-checkout-total-row">
            <span>Total paid</span>
            <span className="sk-priceAmt">${total.toFixed(0)}</span>
          </div>
        </Card>

        <Button
          className="sk-btn-orange"
          style={{ marginTop: 24 }}
          onClick={onBack}
        >
          Back to Stays
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export default function HotelCheckout({ rooms: roomsProp, hotel, onBack }) {
  // Backward-compatible: accept either `rooms` (array, preferred) or a
  // single legacy `hotel` object so any existing call sites that still
  // pass one offer keep working without changes.
  const rooms = useMemo(
    () => (roomsProp && roomsProp.length ? roomsProp : hotel ? [hotel] : []),
    [roomsProp, hotel]
  );

  const [guestNames, setGuestNames] = useState(() => rooms.map(() => ""));
  const [contactEmail, setContactEmail] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const updateGuestName = useCallback((index, value) => {
    setGuestNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const grandTotal = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0),
    [rooms]
  );

  if (!rooms.length) {
    return (
      <div className="sk-booking sk-checkout-page">
        <div className="sk-checkout-empty">
          <Text style={{ color: "rgba(255,255,255,0.6)" }}>
            No room selected.
          </Text>
          <Button
            className="sk-btn-orange"
            style={{ marginTop: 16 }}
            onClick={onBack}
          >
            <ArrowLeftOutlined /> Back to Stays
          </Button>
        </div>
      </div>
    );
  }

  if (confirmation) {
    return <ConfirmationScreen confirmation={confirmation} onBack={onBack} />;
  }

  return (
    <div className="sk-booking sk-checkout-page">
      <div className="sk-checkout-wrap">
        <button type="button" className="sk-checkout-back" onClick={onBack}>
          <ArrowLeftOutlined /> Back to results
        </button>

        <Title className="sk-hero-title" style={{ fontSize: 28 }}>
          Confirm your{" "}
          <span className="sk-hero-title-accent">
            {rooms.length > 1 ? `${rooms.length} rooms` : "stay"}
          </span>
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.55)" }}>
          {rooms.length > 1
            ? "Booking multiple rooms together — perfect for family or friends joining the trip."
            : "Review the details below before paying."}
        </Text>

        <div className="sk-checkout-grid">
          <Card
            variant="borderless"
            className="sk-result-card sk-checkout-summary-card"
          >
            <div className="sk-checkout-summary-header">
              <Users
                size={15}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              {rooms.length} room{rooms.length !== 1 ? "s" : ""} in this trip
            </div>
            {rooms.map((r, i) => (
              <RoomLineItem key={roomKey(r)} room={r} index={i} />
            ))}
            <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />
            <div className="sk-checkout-total-row">
              <span>Total</span>
              <span className="sk-priceAmt">${grandTotal.toFixed(0)}</span>
            </div>
          </Card>

          <Card
            variant="borderless"
            className="sk-result-card sk-checkout-form-card"
          >
            <div className="sk-prefill-label" style={{ marginBottom: 6 }}>
              Contact email
            </div>
            <Input
              className="sk-prefill-input"
              placeholder="you@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={{ marginBottom: 18 }}
            />

            {rooms.map((r, i) => (
              <RoomGuestField
                key={roomKey(r)}
                room={r}
                index={i}
                value={guestNames[i]}
                onChange={(v) => updateGuestName(i, v)}
              />
            ))}

            <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />

            <Elements stripe={stripePromise}>
              <PaymentForm
                rooms={rooms}
                guestNames={guestNames}
                contactEmail={contactEmail}
                onSuccess={setConfirmation}
              />
            </Elements>
          </Card>
        </div>
      </div>
    </div>
  );
}
