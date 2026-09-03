import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Typography,
  Card,
  Button,
  Input,
  Divider,
  message as antdMessage,
} from "antd";
import {
  ArrowLeftOutlined,
  LoadingOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { CheckCircle2, Users, BedDouble, MapPin, Clock } from "lucide-react";

import "@/styles/BookingPage.css"; // reuses sk-* dark-glass tokens/classes

const { Title, Text } = Typography;

const API = import.meta.env.VITE_API_URL || "";

// Assumes the same Stripe publishable key setup used elsewhere in Skyrio.
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

// A "room" prop entry (one cart entry / one bookable offer) can itself
// bundle several physical rooms when it came from a multi-occupancy
// search (Rooms > 1 on the search form) — that offer has one offerId/
// prebookId but a `rates` array with one entry PER PHYSICAL ROOM. This
// helper always returns that array, falling back to a single synthetic
// entry (from the flat roomName/boardName fields) for any offer that
// only ever had one room to begin with.
function ratesForRoom(room) {
  if (room.rates?.length) return room.rates;
  return [
    {
      name: room.roomName,
      boardName: room.boardName,
      refundableTag: room.refundableTag,
    },
  ];
}

// ─────────────────────────────────────────────
// Per-booking summary line — expands into one sub-line per physical
// room when this booking bundles more than one (rates.length > 1).
// ─────────────────────────────────────────────
function RoomLineItem({ room, index, footer }) {
  const nights = nightsBetween(room.checkin, room.checkout);
  const rates = ratesForRoom(room);
  const bundlesMultiple = rates.length > 1;

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
          {room.name}
          {bundlesMultiple && (
            <span className="sk-checkout-roomcount-badge">
              {rates.length} rooms
            </span>
          )}
        </div>

        {bundlesMultiple ? (
          <div className="sk-checkout-subrates">
            {rates.map((rate, ri) => (
              <div key={ri} className="sk-checkout-subrate-line">
                <BedDouble
                  size={11}
                  style={{ marginRight: 4, verticalAlign: "middle" }}
                />
                Room {ri + 1}: {rate.name}
                {rate.boardName ? ` · ${rate.boardName}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <div className="sk-checkout-room-meta">
            <BedDouble
              size={12}
              style={{ marginRight: 4, verticalAlign: "middle" }}
            />
            {rates[0].name}
            {rates[0].boardName ? ` · ${rates[0].boardName}` : ""}
          </div>
        )}

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
        {footer}
      </div>
      <div className="sk-checkout-room-price">
        ${(room.totalAmount ?? 0).toFixed(0)}
        <span className="sk-priceSub">{room.totalCurrency || "USD"}</span>
        {bundlesMultiple && (
          <div className="sk-checkout-room-price-note">
            for all {rates.length} rooms
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Guest name fields for one physical room (maps to LiteAPI's
// guests: [{ occupancyNumber, firstName, lastName, email }])
// ─────────────────────────────────────────────
function RoomGuestFields({ label, value, onChange }) {
  return (
    <div className="sk-checkout-guest-field">
      <label className="sk-prefill-label">{label}</label>
      <div className="sk-checkout-guest-name-row">
        <Input
          className="sk-prefill-input"
          placeholder="First name"
          value={value.firstName}
          onChange={(e) => onChange({ ...value, firstName: e.target.value })}
        />
        <Input
          className="sk-prefill-input"
          placeholder="Last name"
          value={value.lastName}
          onChange={(e) => onChange({ ...value, lastName: e.target.value })}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Payment form (wrapped in <Elements> below) — the "one person pays
// everything" path, unchanged from before.
// ─────────────────────────────────────────────
function PaymentForm({
  rooms,
  roomGroups,
  totalSlots,
  holder,
  guestFields,
  onSuccess,
}) {
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

    if (
      !holder.firstName.trim() ||
      !holder.lastName.trim() ||
      !holder.email.trim()
    ) {
      return antdMessage.warning(
        "Enter the primary contact's first name, last name, and email"
      );
    }
    if (guestFields.some((g) => !g.firstName.trim() || !g.lastName.trim())) {
      return antdMessage.warning("Enter a guest name for every room");
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");

      const intentRes = await fetch(`${API}/api/hotels/checkout-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offers: rooms.map((r) => ({
            offerId: r.offerId,
            hotelName: r.name,
          })),
          guestEmail: holder.email.trim(),
        }),
      });
      const intentData = await intentRes.json();
      if (!intentRes.ok || !intentData.ok) {
        throw new Error(intentData.message || "Couldn't start hotel checkout");
      }

      const { clientSecret, prebookIds } = intentData;

      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: `${holder.firstName} ${holder.lastName}`,
              email: holder.email.trim(),
            },
          },
        });

      if (confirmError) {
        throw new Error(confirmError.message || "Payment failed");
      }
      if (paymentIntent?.status !== "succeeded") {
        throw new Error("Payment was not completed — please try again.");
      }

      const bookRes = await fetch(`${API}/api/hotels/confirm-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          bookings: roomGroups.map((group, roomIndex) => ({
            prebookId: prebookIds[roomIndex],
            holder: {
              firstName: holder.firstName.trim(),
              lastName: holder.lastName.trim(),
              email: holder.email.trim(),
            },
            guests: group.slotIndices.map((slotIndex, occIdx) => ({
              occupancyNumber: occIdx + 1,
              firstName: guestFields[slotIndex].firstName.trim(),
              lastName: guestFields[slotIndex].lastName.trim(),
              email: holder.email.trim(),
            })),
          })),
        }),
      });
      const bookData = await bookRes.json();

      if (!bookRes.ok || !bookData.ok) {
        if (bookData.failures?.length) {
          throw new Error(
            `Payment succeeded, but ${bookData.failures.length} booking${
              bookData.failures.length !== 1 ? "s" : ""
            } couldn't be confirmed. Our team will follow up to fix this — please contact support.`
          );
        }
        throw new Error(bookData.message || "Booking confirmation failed");
      }

      antdMessage.success("Booking confirmed!");
      onSuccess({
        confirmationId: paymentIntent.id,
        rooms,
      });
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
          : `Pay $${grandTotal.toFixed(0)} · Book ${totalSlots} room${
              totalSlots !== 1 ? "s" : ""
            }`}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// SPLIT MODE — one card per room, each assigned to a different
// traveler who pays their own share separately.
// ─────────────────────────────────────────────

const SPLIT_STATUS_LABEL = {
  pending: "Waiting to pay",
  paid: "Paid",
  failed: "Card declined — can retry",
  refunded: "Refunded (split expired)",
};

function SplitAssignFields({ room, index, value, onChange }) {
  return (
    <div className="sk-checkout-split-assign">
      <div className="sk-checkout-split-assign-label">
        Room {index + 1} · {room.name}
        <span className="sk-checkout-split-assign-amount">
          ${(room.totalAmount ?? 0).toFixed(0)} {room.totalCurrency || "USD"}
        </span>
      </div>
      <div className="sk-checkout-guest-name-row">
        <Input
          className="sk-prefill-input"
          placeholder="Full name"
          value={value.assignedName}
          onChange={(e) => onChange({ ...value, assignedName: e.target.value })}
        />
        <Input
          className="sk-prefill-input"
          placeholder="Email"
          value={value.assignedEmail}
          onChange={(e) =>
            onChange({ ...value, assignedEmail: e.target.value })
          }
        />
      </div>
    </div>
  );
}

function SplitStatusScreen({ splitPaymentId, onBookingComplete }) {
  const [status, setStatus] = useState(null);
  const [copiedShareId, setCopiedShareId] = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/split-payments/${splitPaymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.ok) setStatus(data);
    } catch {
      // transient — next poll retries
    }
  }, [splitPaymentId]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 4000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  useEffect(() => {
    if (
      status?.status === "completed" ||
      status?.status === "booking_failed" ||
      status?.status === "cancelled"
    ) {
      clearInterval(pollRef.current);
    }
  }, [status?.status]);

  const copyLink = (shareId) => {
    const url = `${window.location.origin}/pay-share/${splitPaymentId}/${shareId}`;
    navigator.clipboard?.writeText(url);
    setCopiedShareId(shareId);
    antdMessage.success("Pay link copied");
    setTimeout(() => setCopiedShareId(null), 2000);
  };

  if (!status) {
    return (
      <div className="sk-checkout-split-loading">
        <LoadingOutlined /> Loading split payment…
      </div>
    );
  }

  if (status.status === "completed") {
    return (
      <div className="sk-checkout-confirm">
        <CheckCircle2 size={48} color="#ff8a2a" />
        <Title level={3} style={{ color: "#fff", marginTop: 14 }}>
          Everyone paid — you're booked!
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.6)" }}>
          {status.shares.length} rooms confirmed
        </Text>
        <Button
          className="sk-btn-orange"
          style={{ marginTop: 24 }}
          onClick={onBookingComplete}
        >
          Back to Stays
        </Button>
      </div>
    );
  }

  if (status.status === "booking_failed") {
    return (
      <div className="sk-checkout-confirm">
        <Text style={{ color: "#ff6b6b", fontSize: 16, fontWeight: 700 }}>
          Everyone paid, but something went wrong booking with the hotel.
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Please contact support — your payment is safe, this needs manual
          follow-up.
        </Text>
        <Button
          className="sk-btn-orange"
          style={{ marginTop: 24 }}
          onClick={onBookingComplete}
        >
          Back to Stays
        </Button>
      </div>
    );
  }

  if (status.status === "cancelled") {
    return (
      <div className="sk-checkout-confirm">
        <Text style={{ color: "#ff8a2a", fontSize: 16, fontWeight: 700 }}>
          This split payment expired before everyone paid.
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Anyone who already paid has been automatically refunded. Start a new
          split to try again.
        </Text>
        <Button
          className="sk-btn-orange"
          style={{ marginTop: 24 }}
          onClick={onBookingComplete}
        >
          Back to Stays
        </Button>
      </div>
    );
  }

  const paidCount = status.shares.filter((s) => s.status === "paid").length;

  return (
    <Card
      variant="borderless"
      className="sk-result-card sk-checkout-split-status"
    >
      <div className="sk-checkout-summary-header">
        <Users size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
        {paidCount} of {status.shares.length} paid
      </div>
      <div className="sk-checkout-split-expiry">
        <Clock size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
        Everyone needs to pay by {dayjs(status.expiresAt).format("h:mm A")} or
        the split expires
      </div>
      {status.shares.map((s) => (
        <div key={s.shareId} className="sk-checkout-split-row">
          <div className="sk-checkout-split-row-info">
            <div className="sk-checkout-split-row-name">{s.assignedName}</div>
            <div className="sk-checkout-split-row-label">{s.label}</div>
          </div>
          <div className="sk-checkout-split-row-amount">
            ${s.amount.toFixed(0)}
          </div>
          <div className={`sk-checkout-split-row-status is-${s.status}`}>
            {SPLIT_STATUS_LABEL[s.status] || s.status}
          </div>
          {s.status !== "paid" && (
            <button
              type="button"
              className="sk-checkout-split-copy-btn"
              onClick={() => copyLink(s.shareId)}
            >
              <CopyOutlined />{" "}
              {copiedShareId === s.shareId ? "Copied!" : "Copy link"}
            </button>
          )}
        </div>
      ))}
      <Text
        style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
          marginTop: 12,
          display: "block",
        }}
      >
        Send each person their link — the room books automatically once
        everyone's paid.
      </Text>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export default function HotelCheckout({
  rooms: roomsProp,
  hotel,
  onBack,
  onBookingComplete,
}) {
  const rooms = useMemo(
    () => (roomsProp && roomsProp.length ? roomsProp : hotel ? [hotel] : []),
    [roomsProp, hotel]
  );

  const roomGroups = useMemo(() => {
    let cursor = 0;
    return rooms.map((room) => {
      const rates = ratesForRoom(room);
      const slotIndices = rates.map(() => cursor++);
      return { room, rates, slotIndices };
    });
  }, [rooms]);

  const totalSlots = useMemo(
    () => roomGroups.reduce((n, g) => n + g.rates.length, 0),
    [roomGroups]
  );

  // "together" — one person pays the full total (original flow).
  // "split"    — each room is assigned to a different traveler who
  //              pays their own share separately. Only available with
  //              2+ rooms — splitting a single room doesn't mean anything.
  const [payMode, setPayMode] = useState("together");

  const [holder, setHolder] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [guestFields, setGuestFields] = useState(() =>
    Array.from({ length: totalSlots }, () => ({ firstName: "", lastName: "" }))
  );
  const [confirmation, setConfirmation] = useState(null);

  const [splitAssignees, setSplitAssignees] = useState(() =>
    rooms.map(() => ({ assignedName: "", assignedEmail: "" }))
  );
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  const [splitPaymentId, setSplitPaymentId] = useState(null);

  const updateGuestField = useCallback((slotIndex, value) => {
    setGuestFields((prev) => {
      const next = [...prev];
      next[slotIndex] = value;
      return next;
    });
  }, []);

  const updateSplitAssignee = useCallback((roomIndex, value) => {
    setSplitAssignees((prev) => {
      const next = [...prev];
      next[roomIndex] = value;
      return next;
    });
  }, []);

  const grandTotal = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0),
    [rooms]
  );

  const handleSendSplitRequests = async () => {
    if (
      splitAssignees.some(
        (s) => !s.assignedName.trim() || !s.assignedEmail.trim()
      )
    ) {
      return antdMessage.warning("Enter a name and email for every room");
    }
    const emails = splitAssignees.map((s) =>
      s.assignedEmail.trim().toLowerCase()
    );
    if (new Set(emails).size !== emails.length) {
      return antdMessage.warning(
        "Each room needs a different email — that's how each person's pay link is identified"
      );
    }

    setSplitSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/split-payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingType: "hotel",
          offers: rooms.map((r, i) => ({
            offerId: r.offerId,
            hotelName: r.name,
            assignedName: splitAssignees[i].assignedName.trim(),
            assignedEmail: splitAssignees[i].assignedEmail.trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Couldn't start the split payment");
      }
      antdMessage.success(
        "Payment requests created — send everyone their link"
      );
      setSplitPaymentId(data.splitPaymentId);
    } catch (err) {
      antdMessage.error(err.message || "Failed to create split payment");
    } finally {
      setSplitSubmitting(false);
    }
  };

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
    return (
      <div className="sk-booking sk-checkout-page">
        <div className="sk-checkout-confirm">
          <CheckCircle2 size={48} color="#ff8a2a" />
          <Title level={3} style={{ color: "#fff", marginTop: 14 }}>
            You're booked!
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.6)" }}>
            Confirmation #{confirmation.confirmationId} · {totalSlots} room
            {totalSlots !== 1 ? "s" : ""}
          </Text>
          <Card
            variant="borderless"
            className="sk-result-card"
            style={{ marginTop: 24, width: "100%", maxWidth: 560 }}
          >
            {confirmation.rooms.map((r, i) => (
              <RoomLineItem key={`${roomKey(r)}-${i}`} room={r} index={i} />
            ))}
            <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />
            <div className="sk-checkout-total-row">
              <span>Total paid</span>
              <span className="sk-priceAmt">${grandTotal.toFixed(0)}</span>
            </div>
          </Card>
          <Button
            className="sk-btn-orange"
            style={{ marginTop: 24 }}
            onClick={onBookingComplete}
          >
            Back to Stays
          </Button>
        </div>
      </div>
    );
  }

  if (splitPaymentId) {
    return (
      <div className="sk-booking sk-checkout-page">
        <div className="sk-checkout-wrap">
          <Title className="sk-hero-title" style={{ fontSize: 28 }}>
            Waiting on <span className="sk-hero-title-accent">your group</span>
          </Title>
          <SplitStatusScreen
            splitPaymentId={splitPaymentId}
            onBookingComplete={onBookingComplete}
          />
        </div>
      </div>
    );
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
            {totalSlots > 1 ? `${totalSlots} rooms` : "stay"}
          </span>
        </Title>

        {rooms.length > 1 && (
          <div className="sk-checkout-paymode-toggle">
            <button
              type="button"
              className={`sk-checkout-paymode-btn${
                payMode === "together" ? " is-active" : ""
              }`}
              onClick={() => setPayMode("together")}
            >
              I'll pay for everyone
            </button>
            <button
              type="button"
              className={`sk-checkout-paymode-btn${
                payMode === "split" ? " is-active" : ""
              }`}
              onClick={() => setPayMode("split")}
            >
              Split the bill — each person pays their own room
            </button>
          </div>
        )}

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
              {totalSlots} room{totalSlots !== 1 ? "s" : ""} in this trip
            </div>
            {rooms.map((r, i) => (
              <RoomLineItem key={`${roomKey(r)}-${i}`} room={r} index={i} />
            ))}
            <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />
            <div className="sk-checkout-total-row">
              <span>Total</span>
              <span className="sk-priceAmt">${grandTotal.toFixed(0)}</span>
            </div>
            <button
              type="button"
              className="sk-checkout-add-room-link"
              onClick={onBack}
            >
              + Add another room for someone else in your group
            </button>
          </Card>

          {payMode === "together" ? (
            <Card
              variant="borderless"
              className="sk-result-card sk-checkout-form-card"
            >
              <div className="sk-prefill-label" style={{ marginBottom: 6 }}>
                Primary contact (booking holder)
              </div>
              <div className="sk-checkout-guest-name-row">
                <Input
                  className="sk-prefill-input"
                  placeholder="First name"
                  value={holder.firstName}
                  onChange={(e) =>
                    setHolder((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
                <Input
                  className="sk-prefill-input"
                  placeholder="Last name"
                  value={holder.lastName}
                  onChange={(e) =>
                    setHolder((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                />
              </div>
              <Input
                className="sk-prefill-input"
                placeholder="you@example.com"
                value={holder.email}
                onChange={(e) =>
                  setHolder((prev) => ({ ...prev, email: e.target.value }))
                }
                style={{ marginTop: 8, marginBottom: 18 }}
              />

              {roomGroups.map((group, gi) => (
                <div
                  key={`${roomKey(group.room)}-${gi}`}
                  className="sk-checkout-guest-group"
                >
                  {group.rates.length > 1 && (
                    <div className="sk-checkout-guest-group-title">
                      {group.room.name} — {group.rates.length} rooms
                    </div>
                  )}
                  {group.rates.map((rate, ri) => (
                    <RoomGuestFields
                      key={group.slotIndices[ri]}
                      label={
                        group.rates.length > 1
                          ? `Room ${ri + 1} guest — ${rate.name}`
                          : `${group.room.name} guest`
                      }
                      value={guestFields[group.slotIndices[ri]]}
                      onChange={(v) =>
                        updateGuestField(group.slotIndices[ri], v)
                      }
                    />
                  ))}
                </div>
              ))}

              <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />

              <Elements stripe={stripePromise}>
                <PaymentForm
                  rooms={rooms}
                  roomGroups={roomGroups}
                  totalSlots={totalSlots}
                  holder={holder}
                  guestFields={guestFields}
                  onSuccess={setConfirmation}
                />
              </Elements>
            </Card>
          ) : (
            <Card
              variant="borderless"
              className="sk-result-card sk-checkout-form-card"
            >
              <div className="sk-prefill-label" style={{ marginBottom: 10 }}>
                Who's paying for each room?
              </div>
              <Text
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  display: "block",
                  marginBottom: 14,
                }}
              >
                Each person gets their own link to enter their own card. The
                rooms are only actually booked once everyone has paid.
              </Text>

              {rooms.map((r, i) => (
                <SplitAssignFields
                  key={`${roomKey(r)}-${i}`}
                  room={r}
                  index={i}
                  value={splitAssignees[i]}
                  onChange={(v) => updateSplitAssignee(i, v)}
                />
              ))}

              <Button
                className="sk-btn-orange sk-checkout-pay-btn"
                block
                style={{ marginTop: 14 }}
                onClick={handleSendSplitRequests}
                disabled={splitSubmitting}
                icon={splitSubmitting ? <LoadingOutlined /> : undefined}
              >
                {splitSubmitting ? "Setting up…" : "Create payment requests"}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
