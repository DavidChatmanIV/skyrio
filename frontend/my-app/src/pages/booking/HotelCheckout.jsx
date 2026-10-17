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
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getSkyrioStripe, useSkyrioStripeStatus } from "@/utils/skyrioStripe";
import {
  CheckCircle2,
  Users,
  BedDouble,
  MapPin,
  AlertTriangle,
  CalendarCheck,
  Info,
  Check,
} from "lucide-react";
import { createPortal } from "react-dom";

import "@/styles/BookingPage.css"; // reuses sk-* dark-glass tokens/classes
import OverBudgetCheck, {
  overBudgetBy,
} from "@/components/syncTogether/OverBudgetCheck";

const { Title, Text } = Typography;

const API = import.meta.env.VITE_API_URL || "";

// Hotels are paid on SKYRIO's own Stripe account (Skyrio is the merchant;
// LiteAPI is then paid from the card on file with ACC_CREDIT_CARD).
// Hotels/shared rooms use Skyrio's own Stripe. The key comes from the build
// or, if missing there, from the backend at runtime (see skyrioStripe.js).
const stripePromise = getSkyrioStripe();

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

// Same rules as flight checkout: 2+ letters each, as on the guest's ID.
const nameOk = (v) => (v || "").replace(/[^\p{L}]/gu, "").length >= 2;
const NAME_HINT = "Enter the full name exactly as it appears on the ID";
const guestComplete = (g) => nameOk(g?.firstName) && nameOk(g?.lastName);

// Stripe's card field is an iframe; give it a plain system font stack
// (custom page fonts can stop it from loading).
const CARD_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Real cancellation terms from the room rate, when LiteAPI sends them.
// Returns null when unknown — we never guess a policy.
function cancellationOf(room) {
  const cp = room?.cancellationPolicies || room?.cancellationPolicy || null;
  const tag = room?.refundableTag || cp?.refundableTag || null;
  const infos = cp?.cancelPolicyInfos || cp?.cancelPolicies || [];
  const deadline = Array.isArray(infos)
    ? infos
        .map((x) => x?.cancelTime || x?.cancelDeadline || x?.from)
        .filter(Boolean)
        .sort()[0]
    : null;
  if (tag === "NRFN") return { refundable: false };
  if (tag === "RFN") return { refundable: true, deadline: deadline || null };
  return null;
}

const LABEL = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.62)",
  marginBottom: 6,
};
const REQ = <span style={{ color: "#f97316", marginLeft: 4 }}>*</span>;
const ERR = { color: "#f87171", fontSize: 12, marginTop: 4 };

// The antd Button + BookingPage.css rules override inline backgrounds, which
// turned Pay grey. A plain <button> with this scoped class matches the flight
// checkout's button exactly (same gradient, height, glow and hover).
const PAY_BTN_CSS = `
  .sk-hc-pay {
    width: 100% !important; min-height: 52px !important; padding: 15px 17px !important;
    border: none !important; border-radius: 14px !important;
    background: linear-gradient(135deg, #f97316 0%, #ec4899 100%) !important;
    color: #fff !important; font-size: 16px !important; font-weight: 700 !important;
    font-family: inherit !important; cursor: pointer;
    display: flex !important; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 8px 30px rgba(249,115,22,0.35) !important;
    transition: opacity .2s, transform .15s, box-shadow .2s;
    touch-action: manipulation;
  }
  .sk-hc-pay:hover:not(:disabled) {
    opacity: .92; transform: translateY(-1px);
    box-shadow: 0 12px 40px rgba(255,138,42,.45) !important;
  }
  .sk-hc-pay:active:not(:disabled) { transform: translateY(0); }
  .sk-hc-pay:disabled { opacity: .45 !important; cursor: not-allowed; transform: none; box-shadow: none !important; }
`;

function PayButton({ busy, disabled, onClick, children, style }) {
  return (
    <>
      <style>{PAY_BTN_CSS}</style>
      <button
        type="button"
        className="sk-hc-pay"
        onClick={onClick}
        disabled={disabled}
        style={style}
      >
        {busy && <LoadingOutlined />}
        {children}
      </button>
    </>
  );
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
        {(() => {
          const c = cancellationOf(room);
          if (!c) return null;
          return (
            <div
              className="sk-checkout-room-meta"
              style={{ color: c.refundable ? "#34d399" : "#ffb347" }}
            >
              <CalendarCheck
                size={12}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />
              {c.refundable
                ? c.deadline
                  ? `Free cancellation until ${dayjs(c.deadline).format(
                      "MMM D, h:mm A"
                    )}`
                  : "Refundable rate"
                : "Non-refundable rate"}
            </div>
          );
        })()}
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
function RoomGuestField({
  room,
  index,
  value,
  onChange,
  showErrors,
  savedOptions = [],
}) {
  const g = value || {};
  const err = (v) =>
    showErrors || v ? (!v ? "Required" : !nameOk(v) ? NAME_HINT : null) : null;
  const firstErr = err(g.firstName);
  const lastErr = err(g.lastName);
  return (
    <div className="sk-checkout-guest-field" style={{ marginBottom: 16 }}>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
        Room {index + 1} guest
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 10,
        }}
      >
        {room.name} · the name must match the guest's ID at check-in
      </div>
      {savedOptions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {savedOptions.map((t) => (
            <button
              key={t._id || `${t.firstName}-${t.lastName}`}
              type="button"
              onClick={() =>
                onChange({ firstName: t.firstName, lastName: t.lastName })
              }
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                border: "1px solid rgba(249,115,22,.35)",
                background: "rgba(249,115,22,.08)",
                color: "#fff",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              + {t.firstName} {t.lastName}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <label>
          <span style={LABEL}>First name{REQ}</span>
          <Input
            className="sk-prefill-input"
            placeholder="First name"
            autoComplete={index === 0 ? "given-name" : "off"}
            value={g.firstName || ""}
            status={firstErr && (showErrors || g.firstName) ? "error" : ""}
            onChange={(e) => onChange({ ...g, firstName: e.target.value })}
          />
          {firstErr && (showErrors || g.firstName) && (
            <div role="alert" style={ERR}>
              {firstErr}
            </div>
          )}
        </label>
        <label>
          <span style={LABEL}>Last name{REQ}</span>
          <Input
            className="sk-prefill-input"
            placeholder="Last name"
            autoComplete={index === 0 ? "family-name" : "off"}
            value={g.lastName || ""}
            status={lastErr && (showErrors || g.lastName) ? "error" : ""}
            onChange={(e) => onChange({ ...g, lastName: e.target.value })}
          />
          {lastErr && (showErrors || g.lastName) && (
            <div role="alert" style={ERR}>
              {lastErr}
            </div>
          )}
        </label>
      </div>
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
function PaymentForm({
  rooms,
  guests,
  contactEmail,
  groupId,
  onSuccess,
  onInvalid,
  onUnavailable,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState(null);
  // Never leave an empty card box with a dead Pay button: if the card form
  // hasn't loaded after 10s, say so plainly.
  const stripeStatus = useSkyrioStripeStatus();
  const STRIPE_KEY_MISSING = stripeStatus === "missing";
  const [cardReady, setCardReady] = useState(false);
  const [cardSlow, setCardSlow] = useState(false);
  useEffect(() => {
    if (cardReady) return;
    const t = setTimeout(() => setCardSlow(true), 10000);
    return () => clearTimeout(t);
  }, [cardReady]);

  const grandTotal = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0),
    [rooms]
  );

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const email = contactEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onInvalid?.();
      return antdMessage.warning("Enter a valid contact email for the booking");
    }
    if (!localStorage.getItem("token")) {
      setError(
        "Please sign in to book. Your stay is saved to your Skyrio account, so you need to be signed in before you pay."
      );
      return;
    }
    if (!guests.every(guestComplete)) {
      onInvalid?.();
      return antdMessage.warning(
        "Enter the full first and last name for every room's guest"
      );
    }
    const names = guests.map((g) => ({
      firstName: g.firstName.trim(),
      lastName: g.lastName.trim(),
    }));

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
      const msg = err.message || "Booking failed";
      // Room gone → the big notice, not a small line.
      if (
        /sold out|no longer available|not available|unavailable|no rooms/i.test(
          msg
        )
      ) {
        onUnavailable?.(msg);
      } else {
        antdMessage.error(msg);
      }
      setError(msg);
    } finally {
      setSubmitting(false);
      setStage("");
    }
  };

  return (
    <div className="sk-checkout-payment">
      <span style={LABEL}>Card details{REQ}</span>
      <div
        style={{
          padding: "15px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          marginBottom: 14,
        }}
      >
        <CardElement
          onReady={() => {
            setCardReady(true);
            setCardSlow(false);
          }}
          options={{
            style: {
              base: {
                color: "#fff",
                fontSize: "16px",
                fontFamily: CARD_FONT,
                iconColor: "rgba(255,255,255,0.7)",
                "::placeholder": { color: "rgba(255,255,255,0.45)" },
              },
              invalid: { color: "#f87171", iconColor: "#f87171" },
            },
          }}
        />
      </div>
      {STRIPE_KEY_MISSING && (
        <div
          role="alert"
          style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}
        >
          Card payments aren't available on this site right now. Please try
          again later or contact Skyrio support.
        </div>
      )}
      {!STRIPE_KEY_MISSING && cardSlow && !cardReady && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: "#ffb347",
            marginBottom: 12,
          }}
        >
          The card form didn't load. Check your connection and refresh the page
          — your room details stay the same.
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(248,113,113,.1)",
            border: "1px solid rgba(248,113,113,.3)",
            color: "#f87171",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </div>
      )}
      <PayButton
        onClick={handlePay}
        disabled={submitting || !stripe || !cardReady}
        busy={submitting}
      >
        {submitting
          ? stage || "Processing…"
          : `Pay $${grandTotal.toFixed(2)} · Book ${rooms.length} room${
              rooms.length !== 1 ? "s" : ""
            }`}
      </PayButton>
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

function ShareRoomPanel({ groupId, parts, room, guest, contactEmail }) {
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
    const name = guestComplete(guest)
      ? { firstName: guest.firstName.trim(), lastName: guest.lastName.trim() }
      : null;
    const email = contactEmail.trim();
    if (!name)
      return setError(
        "Enter the guest's full first and last name (the room is booked under this name)."
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
      // Straight to the trip page with YOUR hold form open, so you can
      // pay (hold) your part right away.
      const roomId = data.sharedRoom?.id;
      window.location.assign(
        `/sync-together/${groupId}${
          roomId ? `?holdRoom=${encodeURIComponent(roomId)}` : ""
        }`
      );
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
      {/* What happens next, step by step */}
      {(() => {
        const others = travelers
          .filter((t) => picked.includes(t.userId) && !t.isYou)
          .map((t) => String(t.name || "Friend").split(" ")[0]);
        const share = people >= 2 ? `$${each.toFixed(2)}` : "your share";
        const steps = [
          "Skyrio checks the price with the hotel and sets up the shared room.",
          `You hold your part (${share}) on your card — we take you there next.`,
          others.length
            ? `${others.join(" & ")} ${
                others.length > 1 ? "each hold their" : "holds their"
              } part from the trip page. We notify them.`
            : "Everyone sharing holds their part from the trip page.",
          `The room is booked once everyone's in${
            parts?.holdHours ? ` (within ${parts.holdHours} hours)` : ""
          }. Nobody is charged before that — if time runs out, every hold is released.`,
        ];
        return (
          <ol
            style={{
              margin: "12px 0 0",
              paddingLeft: 20,
              fontSize: 13,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            {steps.map((t) => (
              <li key={t} style={{ marginBottom: 4 }}>
                {t}
              </li>
            ))}
          </ol>
        );
      })()}
      {error && <div className="sk-checkout-error">{error}</div>}
      <PayButton
        onClick={submit}
        disabled={busy}
        busy={busy}
        style={{ marginTop: 12 }}
      >
        {busy
          ? "Checking the price with the hotel…"
          : `Set up shared room · then hold my part${
              people >= 2 ? ` ($${each.toFixed(2)})` : ""
            }`}
      </PayButton>
    </div>
  );
}

// ─────────────────────────────────────────────
// Big "room isn't available anymore" notice (same as flights)
// ─────────────────────────────────────────────
function RoomUnavailableNotice({ rooms, onFindAnother, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const r = rooms[0] || {};
  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sk-room-gone-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000000,
        background: "rgba(8,6,18,0.82)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#150f28",
          border: "1px solid rgba(248,113,113,.35)",
          borderRadius: 20,
          padding: "28px 24px 24px",
          textAlign: "center",
          color: "#fff",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "rgba(248,113,113,.12)",
            border: "1px solid rgba(248,113,113,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f87171",
          }}
        >
          <BedDouble size={28} />
        </div>
        <div
          id="sk-room-gone-title"
          style={{ fontWeight: 800, fontSize: 21, marginBottom: 8 }}
        >
          This room isn't available anymore
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
          {[r.name, r.roomName].filter(Boolean).join(" · ")}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.55,
            marginBottom: 22,
          }}
        >
          The hotel no longer has it at this price, so it can't be booked. Your
          card was not charged.
        </div>
        <PayButton onClick={onFindAnother}>Find another room →</PayButton>
        <Button
          block
          type="text"
          onClick={onClose}
          style={{ marginTop: 10, color: "rgba(255,255,255,0.75)" }}
        >
          Close
        </Button>
      </div>
    </div>,
    document.body
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

  const [guests, setGuests] = useState(() =>
    rooms.map(() => ({ firstName: "", lastName: "" }))
  );
  const [contactEmail, setContactEmail] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [roomGone, setRoomGone] = useState(false);
  // People saved on the profile (partner, family…) — tap to fill a room.
  const [savedTravelers, setSavedTravelers] = useState([]);
  const signedIn = Boolean(localStorage.getItem("token"));

  // Open at the top so the title isn't hidden under the menu bar.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Fill email + room 1's guest from the Skyrio profile (empty fields only).
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let alive = true;
    fetch(`${API}/api/profile/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u = d?.user;
        if (!alive || !u) return;
        const parts = String(u.name || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ");
        setContactEmail((prev) => prev || u.email || "");
        setGuests((prev) =>
          prev.map((g, i) =>
            i !== 0 || g.firstName || g.lastName ? g : { firstName, lastName }
          )
        );
        if (u.email || firstName) setAutofilled(true);
        if (Array.isArray(u.savedTravelers)) {
          // Hotels need adults as room guests (the ID check is at check-in).
          setSavedTravelers(
            u.savedTravelers.filter(
              (t) => t.firstName && t.lastName && (t.type || "ADT") === "ADT"
            )
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [confirmation, setConfirmation] = useState(null);
  const groupParts = useGroupParts(groupId);
  // Only the organizer can set up a shared room, one room at a time.
  const canShare = Boolean(
    groupId && groupParts?.isOrganizer && rooms.length === 1
  );
  const [shareMode, setShareMode] = useState(false);
  // Sync Together: soft check before paying if this goes past your budget.
  const [budgetOk, setBudgetOk] = useState(false);

  // Keep one guest per room if the room list changes.
  useEffect(() => {
    setGuests((prev) =>
      rooms.map((_, i) => prev[i] ?? { firstName: "", lastName: "" })
    );
  }, [rooms]);

  const updateGuest = useCallback((index, value) => {
    setGuests((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);
  const emailBad =
    (showErrors || contactEmail) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());

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
        <button
          type="button"
          className="sk-checkout-back"
          onClick={onBack}
          style={{ marginTop: 24 }}
        >
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
            {!signedIn && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(249,115,22,.08)",
                  border: "1px solid rgba(249,115,22,.3)",
                  color: "#fff",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                Please sign in to book. Your stay is saved to your Skyrio
                account, so you need to be signed in before you pay.
              </div>
            )}
            {autofilled && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#34d399",
                  background: "rgba(52,211,153,.1)",
                  border: "1px solid rgba(52,211,153,.25)",
                  borderRadius: 20,
                  padding: "3px 9px",
                  marginBottom: 12,
                }}
              >
                Filled from your profile
              </span>
            )}
            <label style={{ display: "block", marginBottom: 18 }}>
              <span style={LABEL}>Contact email{REQ}</span>
              <Input
                className="sk-prefill-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={contactEmail}
                status={emailBad ? "error" : ""}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              {emailBad && (
                <div role="alert" style={ERR}>
                  Enter a valid email — your confirmation goes here
                </div>
              )}
            </label>

            {rooms.map((r, i) => (
              <RoomGuestField
                key={roomKey(r)}
                room={r}
                index={i}
                value={guests[i]}
                showErrors={showErrors}
                onChange={(v) => updateGuest(i, v)}
                savedOptions={savedTravelers.filter(
                  (t) =>
                    !guests.some(
                      (g, j) =>
                        j !== i &&
                        (g?.firstName || "").trim().toLowerCase() ===
                          t.firstName.trim().toLowerCase() &&
                        (g?.lastName || "").trim().toLowerCase() ===
                          t.lastName.trim().toLowerCase()
                    ) &&
                    !(
                      (guests[i]?.firstName || "").trim().toLowerCase() ===
                        t.firstName.trim().toLowerCase() &&
                      (guests[i]?.lastName || "").trim().toLowerCase() ===
                        t.lastName.trim().toLowerCase()
                    )
                )}
              />
            ))}

            <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />

            {canShare && (
              <div
                role="radiogroup"
                aria-label="How do you want to pay for this room?"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[
                  {
                    on: !shareMode,
                    set: false,
                    title: "Just me — pay now",
                    sub: "You pay for the whole room.",
                  },
                  {
                    on: shareMode,
                    set: true,
                    title: "Share with the group",
                    sub: "Split it — everyone holds their own share.",
                  },
                ].map((o) => (
                  <button
                    key={o.title}
                    type="button"
                    role="radio"
                    aria-checked={o.on}
                    onClick={() => setShareMode(o.set)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: "#fff",
                      border: `1.5px solid ${
                        o.on ? "#f97316" : "rgba(255,255,255,0.12)"
                      }`,
                      background: o.on
                        ? "rgba(249,115,22,0.12)"
                        : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${
                            o.on ? "#f97316" : "rgba(255,255,255,0.45)"
                          }`,
                          background: o.on ? "#f97316" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {o.on && <Check size={11} strokeWidth={3} />}
                      </span>
                      {o.title}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.65)",
                        marginTop: 4,
                        paddingLeft: 26,
                      }}
                    >
                      {o.sub}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {canShare && shareMode ? (
              <ShareRoomPanel
                groupId={groupId}
                parts={groupParts}
                room={rooms[0]}
                guest={guests[0]}
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
                  guests={guests}
                  contactEmail={contactEmail}
                  groupId={groupId}
                  onSuccess={setConfirmation}
                  onInvalid={() => setShowErrors(true)}
                  onUnavailable={() => setRoomGone(true)}
                />
              </Elements>
            )}
          </Card>
        </div>
      </div>
      {roomGone && (
        <RoomUnavailableNotice
          rooms={rooms}
          onFindAnother={onBack}
          onClose={() => setRoomGone(false)}
        />
      )}
    </div>
  );
}
