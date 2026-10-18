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
import OverBudgetCheck, {
  overBudgetBy,
} from "@/components/syncTogether/OverBudgetCheck";

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
function PaymentForm({ rooms, guestNames, contactEmail, groupId, onSuccess }) {
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
          // Sync Together: shows this stay on the group trip page.
          ...(groupId ? { groupId } : {}),
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
// Sync Together: share this room with the group
//
// The organizer picks who shares the room. Skyrio checks the price with
// the hotel and splits it evenly; each person then holds their share on
// their own card from the trip page. Nobody is charged until everyone is
// in — if the deadline passes first, every hold is released.
// ─────────────────────────────────────────────
function useGroupParts(groupId) {
  const [parts, setParts] = useState(null);
  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    fetch(`${API}/api/sync-together/${groupId}/parts`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((d) => alive && d.ok && setParts(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [groupId]);
  return parts;
}

function ShareRoomPanel({ groupId, parts, room, guestName, contactEmail }) {
  const travelers = (parts?.travelers || []).filter(
    (t) => t.hasAccount && t.userId
  );
  const [picked, setPicked] = useState(() =>
    travelers.filter((t) => t.isYou).map((t) => t.userId)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const capacity = Number(room.adults) || null;
  const people = picked.length;
  const each = people ? (room.totalAmount ?? 0) / people : 0;

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const submit = async () => {
    setError(null);
    const name = splitName(guestName);
    const email = contactEmail.trim();
    if (!name)
      return setError(
        "Enter the guest's first and last name (the room is booked under this name)."
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("Enter a valid contact email.");
    if (people < 2)
      return setError("Pick at least 2 people to share the room.");
    if (capacity && people > capacity)
      return setError(
        `This room was priced for ${capacity} guest${
          capacity === 1 ? "" : "s"
        }. Search again with ${people} guests.`
      );

    setBusy(true);
    try {
      const res = await fetch(
        `${API}/api/sync-together/${groupId}/shared-rooms`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            userIds: picked,
            holder: { ...name, email },
            room: {
              hotelId: room.hotelId,
              offerId: room.offerId,
              name: room.name,
              roomName: room.roomName,
              boardName: room.boardName,
              address: room.address,
              thumbnail: room.thumbnail,
              checkin: room.checkin,
              checkout: room.checkout,
              adults: room.adults,
            },
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok)
        throw new Error(data.error || "Couldn't set up the shared room.");
      antdMessage.success(
        "Shared room set up. Everyone can now hold their share from the trip page."
      );
      try {
        window.sessionStorage.removeItem("skyrio_sync_group");
      } catch {
        /* non-fatal */
      }
      window.location.assign(`/sync-together/${groupId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-checkout-payment">
      <div className="sk-prefill-label" style={{ marginBottom: 8 }}>
        Who's sharing this room?
      </div>
      {travelers.map((t) => (
        <label
          key={t.userId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 0",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={picked.includes(t.userId)}
            onChange={() => toggle(t.userId)}
          />
          {t.name}
          {t.isYou ? " (you)" : ""}
        </label>
      ))}
      {travelers.length < 2 && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Only travelers who've joined the trip with a Skyrio account can share
          a room.
        </div>
      )}
      <div
        style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.7)" }}
      >
        {people >= 2 ? `About $${each.toFixed(2)} each · ` : ""}
        Everyone holds their own share. Nobody is charged until everyone is in
        {parts?.holdHours ? ` (${parts.holdHours} hours to do it)` : ""}.
      </div>
      {error && <div className="sk-checkout-error">{error}</div>}
      <Button
        className="sk-btn-orange sk-checkout-pay-btn"
        block
        onClick={submit}
        disabled={busy}
        icon={busy ? <LoadingOutlined /> : undefined}
        style={{ marginTop: 12 }}
      >
        {busy
          ? "Checking the price with the hotel…"
          : "Share this room · ask everyone to hold their share"}
      </Button>
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
export default function HotelCheckout({
  rooms: roomsProp,
  hotel,
  onBack,
  groupId = null,
  tripBudget = null,
  onBudgetSaved,
}) {
  // Accept either `rooms` (array, preferred) or a single legacy `hotel`.
  const rooms = useMemo(
    () => (roomsProp && roomsProp.length ? roomsProp : hotel ? [hotel] : []),
    [roomsProp, hotel]
  );

  const [guestNames, setGuestNames] = useState(() => rooms.map(() => ""));
  const [contactEmail, setContactEmail] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const groupParts = useGroupParts(groupId);
  // Only the organizer can set up a shared room, one room at a time.
  const canShare = Boolean(
    groupId && groupParts?.isOrganizer && rooms.length === 1
  );
  const [shareMode, setShareMode] = useState(false);
  // Sync Together: soft check before paying if this goes past your budget.
  const [budgetOk, setBudgetOk] = useState(false);

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

            {canShare && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <Button
                  className={shareMode ? undefined : "sk-btn-orange"}
                  onClick={() => setShareMode(false)}
                  style={{ flex: 1 }}
                >
                  Just me — pay now
                </Button>
                <Button
                  className={shareMode ? "sk-btn-orange" : undefined}
                  onClick={() => setShareMode(true)}
                  style={{ flex: 1 }}
                >
                  Share this room with the group
                </Button>
              </div>
            )}

            {canShare && shareMode ? (
              <ShareRoomPanel
                groupId={groupId}
                parts={groupParts}
                room={rooms[0]}
                guestName={guestNames[0] ?? ""}
                contactEmail={contactEmail}
              />
            ) : !budgetOk && overBudgetBy(grandTotal, tripBudget) > 0 ? (
              <OverBudgetCheck
                total={grandTotal}
                tb={tripBudget}
                groupId={groupId}
                onBudgetSaved={onBudgetSaved}
                onProceed={() => setBudgetOk(true)}
              />
            ) : (
              <Elements stripe={stripePromise}>
                <PaymentForm
                  rooms={rooms}
                  guestNames={guestNames}
                  contactEmail={contactEmail}
                  groupId={groupId}
                  onSuccess={setConfirmation}
                />
              </Elements>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
