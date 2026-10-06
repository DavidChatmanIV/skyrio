import React, { useMemo, useState, useCallback, useEffect } from "react";
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

// Hotels are paid on SKYRIO's own Stripe account (Skyrio is the merchant;
// LiteAPI is then paid from the card on file with ACC_CREDIT_CARD).
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

// "David Chatman IV" → { firstName: "David", lastName: "Chatman IV" }
function splitName(full) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
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
        ${(room.totalAmount ?? 0).toFixed(2)}
        <span className="sk-priceSub">{room.totalCurrency || "USD"}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Guest name for a single room
// ─────────────────────────────────────────────
function RoomGuestField({ room, index, value, onChange }) {
  return (
    <div className="sk-checkout-guest-field">
      <label className="sk-prefill-label">
        Room {index + 1} guest name ({room.name})
      </label>
      <Input
        className="sk-prefill-input"
        placeholder="First and last name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Payment form (wrapped in <Elements> below)
//
// Flow:
//   1. POST /api/hotels/checkout-intent  → prebook each room + authorize-only PaymentIntent
//   2. stripe.confirmCardPayment          → card is HELD (status "requires_capture"), not charged
//   3. POST /api/hotels/confirm-booking   → backend books with LiteAPI, then charges only
//                                           for the rooms that were confirmed
// ─────────────────────────────────────────────
function PaymentForm({ rooms, guestNames, contactEmail, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState(null);

  const grandTotal = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0),
    [rooms]
  );

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const email = contactEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return antdMessage.warning("Enter a valid contact email for the booking");
    }
    const names = guestNames.map(splitName);
    if (names.some((n) => !n)) {
      return antdMessage.warning(
        "Enter a first and last name for every room's guest"
      );
    }

    setSubmitting(true);
    setError(null);

    try {
      // ── 1. Lock prices + authorize-only PaymentIntent ──
      setStage("Locking in your rate…");
      const initRes = await fetch(`${API}/api/hotels/checkout-intent`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          offers: rooms.map((r) => ({ offerId: r.offerId, hotelName: r.name })),
          guestEmail: email,
        }),
      });
      const init = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !init.ok) {
        throw new Error(
          init.message || "We couldn't start your booking. Please try again."
        );
      }

      // ── 2. Authorize the card (held, not charged yet) ──
      setStage("Authorizing your card…");
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(init.clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: { email },
          },
        });

      if (confirmError) {
        throw new Error(confirmError.message || "Your card was declined.");
      }
      if (
        paymentIntent?.status !== "requires_capture" &&
        paymentIntent?.status !== "succeeded"
      ) {
        throw new Error(
          "Your card wasn't authorized. Please try another card."
        );
      }

      // ── 3. Book with LiteAPI; backend charges only what's confirmed ──
      setStage("Confirming with the hotel…");
      const bookings = init.rooms.map((p, i) => {
        const n = names[i];
        return {
          prebookId: p.prebookId,
          holder: { firstName: n.firstName, lastName: n.lastName, email },
          guests: [
            {
              occupancyNumber: 1,
              firstName: n.firstName,
              lastName: n.lastName,
              email,
            },
          ],
        };
      });

      const confRes = await fetch(`${API}/api/hotels/confirm-booking`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          bookings,
          // Display details saved on the Booking record (My Trips, emails).
          trip: rooms.map((r) => ({
            hotelId: r.hotelId,
            offerId: r.offerId,
            name: r.name,
            roomName: r.roomName,
            boardName: r.boardName,
            address: r.address,
            checkin: r.checkin,
            checkout: r.checkout,
            thumbnail: r.thumbnail,
            totalAmount: r.totalAmount,
            totalCurrency: r.totalCurrency || "USD",
          })),
        }),
      });
      const conf = await confRes.json().catch(() => ({}));

      if (confRes.status === 207) {
        // Some rooms booked; charged only for those.
        antdMessage.warning(conf.message);
        onSuccess({
          confirmationId:
            conf.bookings?.[0]?.booking?.data?.bookingId || paymentIntent.id,
          rooms: rooms.filter((_, i) =>
            conf.bookings?.some((b) => b.prebookId === init.rooms[i]?.prebookId)
          ),
          totalPaid: null,
          partialMessage: conf.message,
        });
        return;
      }
      if (!confRes.ok || !conf.ok) {
        throw new Error(
          conf.message ||
            "The hotel couldn't confirm your room, so your card was not charged."
        );
      }

      antdMessage.success("Booking confirmed!");
      const first = conf.bookings?.[0]?.booking;
      onSuccess({
        confirmationId:
          first?.data?.hotelConfirmationCode ||
          first?.data?.bookingId ||
          first?.bookingId ||
          paymentIntent.id,
        rooms,
        totalPaid: init.totalPrice,
      });
    } catch (err) {
      setError(err.message || "Booking failed");
      antdMessage.error(err.message || "Booking failed");
    } finally {
      setSubmitting(false);
      setStage("");
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
          ? stage || "Processing…"
          : `Pay $${grandTotal.toFixed(2)} · Book ${rooms.length} room${
              rooms.length !== 1 ? "s" : ""
            }`}
      </Button>
      <div
        style={{
          marginTop: 10,
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          textAlign: "center",
        }}
      >
        Your card is only charged once the hotel confirms your room.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirmation screen
// ─────────────────────────────────────────────
function ConfirmationScreen({ confirmation, onBack }) {
  const { confirmationId, rooms, totalPaid, partialMessage } = confirmation;
  const total =
    typeof totalPaid === "number"
      ? totalPaid
      : rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

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
        {partialMessage && (
          <Text style={{ color: "#ffb347", marginTop: 8 }}>
            {partialMessage}
          </Text>
        )}

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
            <span className="sk-priceAmt">${total.toFixed(2)}</span>
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
  // Accept either `rooms` (array, preferred) or a single legacy `hotel`.
  const rooms = useMemo(
    () => (roomsProp && roomsProp.length ? roomsProp : hotel ? [hotel] : []),
    [roomsProp, hotel]
  );

  const [guestNames, setGuestNames] = useState(() => rooms.map(() => ""));
  const [contactEmail, setContactEmail] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  // Keep guestNames the same length as rooms if the room list changes.
  useEffect(() => {
    setGuestNames((prev) => rooms.map((_, i) => prev[i] ?? ""));
  }, [rooms]);

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
              <span className="sk-priceAmt">${grandTotal.toFixed(2)}</span>
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
                value={guestNames[i] ?? ""}
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
