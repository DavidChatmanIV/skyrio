// ─────────────────────────────────────────────────────────────
// Sync Together — "plan together, pay separately".
//
// Shown on the trip page once the plan is approved:
//   • Your part      — book your own flight and room (or hold your share
//                      of a shared room). You cancel your own part from
//                      My Trips.
//   • Shared rooms   — each person holds their share on their own card.
//                      Nobody is charged until everyone is in; if the
//                      deadline passes first, every hold is released.
//                      Only the organizer can release or cancel one.
//   • Who's ready    — everyone's progress, with a Remind button for the
//                      organizer.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Modal, Spin, message as antdMessage } from "antd";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  Plane,
  BedDouble,
  Users,
  Bell,
  Info,
  Lock,
  PlaneLanding,
  Mail,
  PartyPopper,
} from "lucide-react";
import dayjs from "dayjs";
import AttachBookingCard, { fmtRange } from "./AttachBookingCard";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
// Same Stripe key the hotel checkout uses (Skyrio is the merchant for rooms).
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");
// Vite bakes env vars in at BUILD time. If this is empty on the live site,
// the card box renders blank — show a clear message instead.
const STRIPE_KEY_MISSING = !String(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || ""
).startsWith("pk_");
if (STRIPE_KEY_MISSING) {
  console.error(
    "[payments] VITE_STRIPE_PUBLIC_KEY is missing or invalid in this build — card forms can't load. Add it in Vercel and redeploy."
  );
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/sync-together${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(
      data.error || data.message || "Something went wrong. Please try again."
    );
  }
  return data;
}

const money = (cents, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency).toUpperCase(),
  }).format((Number(cents) || 0) / 100);

function timeLeft(deadline) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "closing now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/* ── shared styles (match SyncGroupPage) ── */
const card = {
  marginTop: 20,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: "20px 18px",
  backdropFilter: "blur(8px)",
};
const title = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  marginBottom: 14,
};
const muted = { color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 };
const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  marginBottom: 8,
  flexWrap: "wrap",
};

const CHIP = {
  done: { bg: "rgba(82,196,26,0.12)", fg: "#52c41a" },
  wait: { bg: "rgba(255,138,42,0.12)", fg: "#ff8a2a" },
  off: { bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.4)" },
  bad: { bg: "rgba(255,77,79,0.12)", fg: "#ff6b6b" },
};
function Chip({ tone = "off", children }) {
  const c = CHIP[tone];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const SHARE_LABEL = {
  unpaid: ["wait", "Not held yet"],
  authorized: ["done", "Held"],
  paid: ["done", "Paid"],
  failed: ["bad", "Card declined"],
  released: ["off", "Released"],
  refunded: ["off", "Refunded"],
};
const ROOM_LABEL = {
  collecting: ["wait", "Collecting holds"],
  booking: ["wait", "Booking…"],
  booked: ["done", "Booked"],
  expired: ["off", "Released — deadline passed"],
  released: ["off", "Released"],
  failed: ["bad", "Couldn't book — released"],
  cancelled: ["off", "Cancelled"],
};
const CLOSED_REASON = {
  price_changed:
    "The hotel raised the price before everyone was in, so every hold was released.",
  sold_out: "The hotel no longer had this room, so every hold was released.",
  failed: "The hotel couldn't confirm the room, so every hold was released.",
  member_left:
    "Someone sharing the room left the trip, so every hold was released.",
  expired: "Not everyone held their share in time, so every hold was released.",
  released: "The organizer released the room. Nobody was charged.",
};

/* ── Confirm dialogs ──
   The app's modals have a dark background, but antd's confirm text is dark
   by default — unreadable. This sets light, high-contrast text explicitly. */
function confirmDark({ title, content, ...rest }) {
  return Modal.confirm({
    ...rest,
    title: (
      <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
        {title}
      </span>
    ),
    content: (
      <div
        style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {content}
      </div>
    ),
  });
}

/* ═══ Hold my share — card form ═══ */
function HoldShareForm({ groupId, room, share, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const hold = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const start = await api(
        `/${groupId}/shared-rooms/${room.id}/shares/${share.id}/hold`,
        { method: "POST" }
      );
      if (!start.alreadyHeld) {
        const { error: err, paymentIntent } = await stripe.confirmCardPayment(
          start.clientSecret,
          {
            payment_method: { card: elements.getElement(CardElement) },
          }
        );
        if (err) throw new Error(err.message || "Your card was declined.");
        if (paymentIntent?.status !== "requires_capture") {
          throw new Error(
            "Your card wasn't authorized. Please try another card."
          );
        }
      }
      await api(`/${groupId}/shared-rooms/${room.id}/shares/${share.id}/held`, {
        method: "POST",
      });
      antdMessage.success(
        "Your share is held. You'll be charged only when everyone is in."
      );
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
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
      {STRIPE_KEY_MISSING && (
        <div
          role="alert"
          style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}
        >
          Card payments aren't available on this site right now. Please try
          again later or contact Skyrio support.
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}
        >
          {error}
        </div>
      )}
      <Button
        className="sk-sync-cta-btn"
        block
        style={{ marginTop: 10 }}
        disabled={busy || !stripe}
        icon={busy ? <LoadingOutlined /> : <Lock size={14} />}
        onClick={hold}
      >
        {busy
          ? "Holding…"
          : `Hold ${money(share.amountOwed, room.currency)} on my card`}
      </Button>
      <div
        style={{ ...muted, fontSize: 12, marginTop: 8, textAlign: "center" }}
      >
        Held, not charged. If not everyone is in by the deadline, the hold is
        released.
      </div>
    </div>
  );
}

/* ═══ One shared room ═══ */
function SharedRoomCard({
  groupId,
  room,
  isOrganizer,
  onChanged,
  autoOpen = false,
}) {
  // Opened from "Set up shared room" at hotel checkout: show your hold form
  // straight away and scroll to it.
  const [showForm, setShowForm] = useState(autoOpen);
  const cardRef = React.useRef(null);
  useEffect(() => {
    if (autoOpen && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [autoOpen]);
  const [working, setWorking] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const mine = room.shares.find((s) => s.isYou);
  const heldCount = room.shares.filter(
    (s) => s.status === "authorized" || s.status === "paid"
  ).length;
  const [tone, label] = ROOM_LABEL[room.status] || ROOM_LABEL.collecting;
  const perPerson =
    room.status === "booked" && room.bookedCents != null
      ? null
      : room.totalCents / room.people;

  const release = () =>
    confirmDark({
      title: "Release this room?",
      content:
        "Every hold is let go and nobody is charged. You can set up a new shared room afterwards.",
      okText: "Release room",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/${groupId}/shared-rooms/${room.id}/release`, {
            method: "POST",
          });
          antdMessage.success("Room released. Nobody was charged.");
          onChanged?.();
        } catch (e) {
          antdMessage.error(e.message);
        }
      },
    });

  const openCancel = async () => {
    setWorking(true);
    try {
      const { quote: q } = await api(
        `/${groupId}/shared-rooms/${room.id}/cancel-quote`
      );
      setQuote(q);
      setQuoteOpen(true);
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const confirmCancel = async () => {
    setWorking(true);
    try {
      const out = await api(`/${groupId}/shared-rooms/${room.id}/cancel`, {
        method: "POST",
      });
      setQuoteOpen(false);
      antdMessage.success(
        out.refundedCents > 0
          ? `Cancelled. ${money(
              out.refundedCents,
              out.currency
            )} is being refunded, split by what each person paid.`
          : "Cancelled. Under the hotel's policy, no refund applies."
      );
      onChanged?.();
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      ref={cardRef}
      style={{
        ...row,
        display: "block",
        ...(autoOpen
          ? {
              border: "1px solid rgba(249,115,22,0.5)",
              boxShadow: "0 0 0 3px rgba(249,115,22,0.12)",
            }
          : {}),
      }}
    >
      {autoOpen &&
        room.status === "collecting" &&
        mine &&
        ["unpaid", "failed"].includes(mine.status) && (
          <div
            role="status"
            style={{
              marginBottom: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(52,211,153,.08)",
              border: "1px solid rgba(52,211,153,.25)",
              color: "#fff",
              fontSize: 13,
            }}
          >
            Shared room set up. Last step: hold your part below. You're only
            charged once everyone sharing is in.
          </div>
        )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
            {room.room?.name || "Shared room"}
          </div>
          <div style={muted}>
            {room.room?.roomName || "Room"}
            {room.room?.boardName ? ` · ${room.room.boardName}` : ""}
          </div>
          <div style={muted}>
            {room.room?.checkin
              ? `${dayjs(room.room.checkin).format("MMM D")} → ${dayjs(
                  room.room.checkout
                ).format("MMM D")}`
              : ""}
            {` · ${room.people} people`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <Chip tone={tone}>{label}</Chip>
          <div
            style={{
              color: "#ff8a2a",
              fontWeight: 800,
              fontSize: 16,
              marginTop: 6,
            }}
          >
            {money(
              room.status === "booked" && room.bookedCents != null
                ? room.bookedCents
                : room.totalCents,
              room.currency
            )}
          </div>
          {perPerson != null && (
            <div style={{ ...muted, fontSize: 12 }}>
              about {money(perPerson, room.currency)} each
            </div>
          )}
        </div>
      </div>

      {room.status === "collecting" && (
        <div
          style={{
            ...muted,
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ClockCircleOutlined />
          {heldCount} of {room.people} held · {timeLeft(room.deadline)} (until{" "}
          {dayjs(room.deadline).format("ddd MMM D, h:mm A")})
        </div>
      )}
      {room.closedReason &&
        CLOSED_REASON[room.closedReason] &&
        room.status !== "booked" &&
        room.status !== "cancelled" && (
          <div style={{ ...muted, marginTop: 10 }}>
            {CLOSED_REASON[room.closedReason]}
          </div>
        )}
      {room.status === "booked" && room.hotelConfirmationCode && (
        <div style={{ ...muted, marginTop: 10 }}>
          Hotel confirmation:{" "}
          <strong style={{ color: "#fff" }}>
            {room.hotelConfirmationCode}
          </strong>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {room.shares.map((s) => {
          const [t, l] = SHARE_LABEL[s.status] || SHARE_LABEL.unpaid;
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                gap: 8,
              }}
            >
              <span style={{ color: "#fff", fontSize: 13 }}>
                {s.name}
                {s.isYou ? " (you)" : ""}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...muted, fontSize: 12 }}>
                  {money(
                    s.status === "paid" || s.status === "refunded"
                      ? s.capturedCents
                      : s.amountOwed,
                    room.currency
                  )}
                </span>
                <Chip tone={t}>{l}</Chip>
              </span>
            </div>
          );
        })}
      </div>

      {room.status === "collecting" &&
        mine &&
        ["unpaid", "failed"].includes(mine.status) && (
          <>
            {!showForm ? (
              <Button
                className="sk-sync-cta-btn"
                block
                style={{ marginTop: 12 }}
                onClick={() => setShowForm(true)}
              >
                Hold my share · {money(mine.amountOwed, room.currency)}
              </Button>
            ) : (
              <Elements stripe={stripePromise}>
                <HoldShareForm
                  groupId={groupId}
                  room={room}
                  share={mine}
                  onDone={onChanged}
                />
              </Elements>
            )}
          </>
        )}

      {isOrganizer && room.status === "collecting" && (
        <Button type="text" danger style={{ marginTop: 8 }} onClick={release}>
          Release room (nobody is charged)
        </Button>
      )}
      {isOrganizer && room.status === "booked" && (
        <Button
          type="text"
          danger
          style={{ marginTop: 8 }}
          loading={working}
          onClick={openCancel}
        >
          Cancel this room
        </Button>
      )}
      {!isOrganizer && room.status === "booked" && (
        <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
          Only the organizer can cancel a shared room. If it's cancelled, you
          get your share of the hotel's refund.
        </div>
      )}

      <Modal
        open={quoteOpen}
        title="Cancel the shared room?"
        onCancel={() => setQuoteOpen(false)}
        onOk={confirmCancel}
        okText="Cancel room"
        okButtonProps={{ danger: true, loading: working }}
        cancelText="Keep room"
      >
        {quote && (
          <div>
            <p>
              Everyone paid{" "}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: quote.currency,
              }).format(quote.paid)}{" "}
              in total.
              {quote.estimatedRefund != null && (
                <>
                  {" "}
                  Based on the hotel's policy, about{" "}
                  <strong>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: quote.currency,
                    }).format(quote.estimatedRefund)}
                  </strong>{" "}
                  comes back.
                </>
              )}
            </p>
            {quote.perPerson && (
              <ul style={{ paddingLeft: 18 }}>
                {quote.perPerson.map((p) => (
                  <li key={p.shareId}>
                    {p.name}: {money(p.refundCents, quote.currency)}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              The hotel confirms the final amount when you cancel. Each person
              is refunded in proportion to what they paid, to the card they
              used.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ═══ Land-by time ═══
   Flight times are the airport's local time, shown exactly as the airline
   sends them. The organizer can ask everyone to land by one time; each
   traveler's landing shows on their row in "The group". */
const fmtLocal = (v) => (v ? dayjs(v).format("ddd MMM D, h:mm A") : "");

// "Land by Fri Nov 20, 2:00 PM". Older trips may still have a start time.
function describeWindow(win) {
  if (win.start && win.end)
    return `Land between ${fmtLocal(win.start)} and ${fmtLocal(win.end)}`;
  if (win.end) return `Land by ${fmtLocal(win.end)}`;
  if (win.start) return `Land after ${fmtLocal(win.start)}`;
  return "";
}

function LandByEditor({
  groupId,
  window: win,
  destination,
  defaultDay,
  onSaved,
  onClose,
}) {
  const [end, setEnd] = useState(
    win?.end || (defaultDay ? `${defaultDay}T15:00` : "")
  );
  const [note, setNote] = useState(win?.note || "");
  const [saving, setSaving] = useState(false);
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontFamily: "inherit",
    colorScheme: "dark",
  };
  const save = async (clear = false) => {
    if (!clear && !end) {
      antdMessage.warning("Pick a date and time");
      return;
    }
    setSaving(true);
    try {
      await api(`/${groupId}/arrival-window`, {
        method: "PATCH",
        body: clear
          ? { start: null, end: null, note: null }
          : { start: null, end, note },
      });
      antdMessage.success(
        clear ? "Land-by time removed" : "Saved — everyone will see it"
      );
      onSaved?.();
      onClose?.();
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{ ...row, display: "block" }}>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
        When should everyone arrive by?
      </div>
      <p style={{ ...muted, margin: "4px 0 10px" }}>
        Pick the latest time you'd like everyone to land — for example before
        hotel check-in or a group dinner. Everyone sees it, and anyone whose
        flight lands later gets a heads-up so they can pick an earlier one.
      </p>
      <label style={muted}>
        Land by{" "}
        <span style={{ color: "rgba(255,255,255,0.35)" }}>
          (
          {destination
            ? `${destination} time — where you're landing`
            : "destination time — where you're landing"}
          )
        </span>
        <input
          id="land-by"
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ ...muted, display: "block", marginTop: 10 }}>
        Reason (optional) — helps everyone understand
        <input
          id="land-by-note"
          type="text"
          maxLength={200}
          placeholder="e.g. Hotel check-in is at 3 PM"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={inputStyle}
        />
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Button
          className="sk-sync-cta-btn"
          loading={saving}
          onClick={() => save(false)}
        >
          Save
        </Button>
        {(win?.start || win?.end) && (
          <Button disabled={saving} onClick={() => save(true)}>
            Remove
          </Button>
        )}
        <Button
          type="text"
          disabled={saving}
          onClick={onClose}
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ═══ Confirmation email status + Resend ═══ */
function EmailLine({ groupId, bookingId, status, canResend = true, onResent }) {
  const [busy, setBusy] = useState(false);
  if (!bookingId) return null;
  const resend = async () => {
    setBusy(true);
    try {
      await api(`/${groupId}/resend-confirmation`, {
        method: "POST",
        body: { bookingId },
      });
      antdMessage.success("Confirmation email sent");
      onResent?.();
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const text =
    status === "sent"
      ? "Confirmation emailed"
      : status === "failed"
      ? "Confirmation email didn't send"
      : "Confirmation email";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        marginTop: 2,
      }}
    >
      <Mail
        size={12}
        color={
          status === "failed"
            ? "#ff6b6b"
            : status === "sent"
            ? "#52c41a"
            : "rgba(255,255,255,0.45)"
        }
      />
      <span
        style={{
          color: status === "failed" ? "#ff6b6b" : "rgba(255,255,255,0.55)",
        }}
      >
        {text}
      </span>
      {canResend && (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            color: "#ff8a2a",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          {busy ? "Sending…" : "Resend"}
        </button>
      )}
    </div>
  );
}

/* ═══ Fly with friends ═══
   Shows the flights friends already booked from YOUR airport, checks each
   one live for seats, and offers "Book this flight". Flights that sold out
   are taken off the list so nobody taps a dead option. Different airport →
   not the same flight, so it isn't offered. */
const SAME_FLIGHT_CACHE_MS = 10 * 60 * 1000;
const minuteOf = (v) => (v ? String(v).slice(0, 16) : "");

function flightKeyOf(f) {
  return [
    f.origin,
    f.destination,
    (f.airline || "").toLowerCase(),
    minuteOf(f.departsAt),
    minuteOf(f.returnDepartsAt),
  ].join("|");
}

// "available" | "gone" | "unknown" (search failed — let them try anyway)
async function checkSeats(f, cabin) {
  const cacheKey = `skyrio_same_flight:${flightKeyOf(f)}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (hit && Date.now() - hit.at < SAME_FLIGHT_CACHE_MS) return hit.result;
  } catch {
    /* no cache */
  }
  const q = new URLSearchParams({
    from: f.origin,
    to: f.destination,
    departDate: String(f.departsAt).slice(0, 10),
    adults: "1",
    cabin: cabin || "economy",
  });
  if (f.returnDepartsAt)
    q.set("returnDate", String(f.returnDepartsAt).slice(0, 10));
  let result = "unknown";
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || ""}/api/flights/search?${q}`
    );
    const d = await res.json();
    if (res.ok && d.ok && !d.stale) {
      const found = (d.flights || []).some(
        (x) =>
          x.origin === f.origin &&
          x.destination === f.destination &&
          minuteOf(x.departingAt) === minuteOf(f.departsAt) &&
          (!f.returnDepartsAt ||
            minuteOf(x.returningAt) === minuteOf(f.returnDepartsAt)) &&
          (!f.airline ||
            !x.owner ||
            String(x.owner).toLowerCase() === f.airline.toLowerCase())
      );
      result = found ? "available" : "gone";
    }
  } catch {
    /* unknown */
  }
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ at: Date.now(), result })
    );
  } catch {
    /* fine */
  }
  return result;
}

// One entry per distinct flight friends booked (several friends on the
// same flight are merged: "Fernanda & Ana"). Every friend's flight is
// offered — "same flight" means leaving from the same airport they do, so
// a different airport is shown plainly instead of hiding the option.
function friendFlightOptions(data, myAirport) {
  if (!data) return [];
  const byKey = new Map();
  for (const t of data.travelers || []) {
    const f = t.flight;
    if (t.isYou || !f || f.status === "cancelled") continue;
    if (!f.origin || !f.destination || !f.departsAt) continue;
    const key = flightKeyOf(f);
    const first = String(t.name || "Friend").split(" ")[0];
    if (byKey.has(key)) byKey.get(key).names.push(first);
    else
      byKey.set(key, {
        key,
        flight: f,
        names: [first],
        otherAirport: Boolean(
          myAirport &&
            String(f.origin).toUpperCase() !== String(myAirport).toUpperCase()
        ),
      });
  }
  return [...byKey.values()];
}

function FlyWithFriends({ options, seats, hasOwnFlight, onJoin }) {
  const visible = options.filter((o) => seats[o.key] !== "gone");
  const allGone =
    options.length > 0 && options.every((o) => seats[o.key] === "gone");

  if (allGone) {
    return (
      <div style={{ ...muted, fontSize: 12, margin: "4px 0 8px" }}>
        Your friends' flights are sold out. Pick any flight that lands around
        the same time.
      </div>
    );
  }
  if (!visible.length) return null;

  return (
    <div style={{ margin: "4px 0 8px" }}>
      <div
        style={{
          ...muted,
          fontSize: 11,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          margin: "4px 0 6px",
        }}
      >
        {hasOwnFlight
          ? "Want to switch to a friend's flight?"
          : "Fly with friends"}
      </div>
      {visible.map((o) => {
        const st = seats[o.key] || "checking";
        const f = o.flight;
        return (
          <div
            key={o.key}
            style={{
              ...row,
              background: "rgba(255,138,42,0.05)",
              border: "1px solid rgba(255,138,42,0.2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                {o.names.join(" & ")} {o.names.length > 1 ? "are" : "is"} on
                this flight
              </div>
              <div style={muted}>
                {[
                  `${f.origin} → ${f.destination}`,
                  f.departsAt ? `Leaves ${fmtLocal(f.departsAt)}` : null,
                  f.airline,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {f.arrivesAt && (
                <div style={{ ...muted, fontSize: 12 }}>
                  Lands {fmtLocal(f.arrivesAt)}
                </div>
              )}
              {o.otherAirport && (
                <div style={{ ...muted, fontSize: 12, color: "#ffb347" }}>
                  Leaves from {f.origin}, not your usual airport
                </div>
              )}
            </div>
            {st === "checking" ? (
              <Chip tone="off">
                <LoadingOutlined style={{ marginRight: 4 }} />
                Checking seats…
              </Chip>
            ) : (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {st === "available" && <Chip tone="done">Seats available</Chip>}
                <Button className="sk-sync-cta-btn" onClick={() => onJoin(o)}>
                  {hasOwnFlight ? "Switch to this flight" : "Join this flight"}
                </Button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Main panel ═══ */
export default function GroupTripPanel({ groupId, myAirport, onChanged }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(null);
  const [editingLandBy, setEditingLandBy] = useState(false);
  // Bumped after linking/unlinking so the "Already booked?" list reloads.
  const [linkKey, setLinkKey] = useState(0);
  // ?holdRoom=<id> — came from hotel checkout's "Set up shared room".
  const holdRoomId = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("holdRoom");
    } catch {
      return null;
    }
  }, []);
  // Live seat check for each friend's flight: "checking" | "available" |
  // "gone" | "unknown". Sold-out ones are hidden everywhere on the page.
  const [seats, setSeats] = useState({});
  const friendKeys = useMemo(
    () =>
      friendFlightOptions(data, myAirport)
        .map((o) => o.key)
        .join(","),
    [data, myAirport]
  );
  useEffect(() => {
    let alive = true;
    friendFlightOptions(data, myAirport).forEach((o) => {
      setSeats((s) => (s[o.key] ? s : { ...s, [o.key]: "checking" }));
      checkSeats(o.flight, data?.cabinClass).then(
        (r) => alive && setSeats((s) => ({ ...s, [o.key]: r }))
      );
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendKeys]);

  const load = useCallback(async () => {
    try {
      const d = await api(`/${groupId}/parts`);
      setData(d);
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while holds are being collected, and whenever the tab regains focus.
  const collecting = useMemo(
    () =>
      (data?.sharedRooms || []).some(
        (r) => r.status === "collecting" || r.status === "booking"
      ),
    [data]
  );
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const t = collecting ? setInterval(load, 20000) : null;
    return () => {
      window.removeEventListener("focus", onFocus);
      if (t) clearInterval(t);
    };
  }, [collecting, load]);

  const refresh = () => {
    load();
    onChanged?.();
  };

  // Take a booking you linked yourself off the trip. Nothing is cancelled.
  const unlink = (booking, what) =>
    confirmDark({
      title: `Unlink your ${what} from this trip?`,
      content:
        "Your booking stays active — nothing is cancelled. It just stops showing for the group.",
      okText: "Unlink",
      onOk: async () => {
        try {
          await api(`/${groupId}/detach-booking`, {
            method: "POST",
            body: { bookingId: booking.id },
          });
          antdMessage.success("Unlinked. Your booking is still active.");
          setLinkKey((k) => k + 1);
          refresh();
        } catch (e) {
          antdMessage.error(e.message);
        }
      },
    });

  const remind = async (t) => {
    setReminding(t.memberId);
    try {
      await api(`/${groupId}/remind`, {
        method: "POST",
        body: { memberId: t.memberId },
      });
      antdMessage.success(`Reminder sent to ${t.name}`);
      load();
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setReminding(null);
    }
  };

  if (loading) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }
  if (!data) return null;

  const me = data.travelers.find((t) => t.isYou);
  const activeRooms = data.sharedRooms.filter((r) =>
    ["collecting", "booking", "booked"].includes(r.status)
  );
  const pastRooms = data.sharedRooms
    .filter((r) => !["collecting", "booking", "booked"].includes(r.status))
    .slice(0, 3);
  const readyCount = data.travelers.filter((t) => t.done).length;
  const win = data.arrivalWindow || {};
  const hasWindow = Boolean(win.start || win.end);
  const flightOn = (t) => t?.flight && t.flight.status !== "cancelled";

  // "EWR → MIA · Nov 20–24 · Nuitée Air" — from the airline's local times,
  // the same ones the landing times come from, so the dates always agree.
  const flightLine = (f) => {
    if (!f) return "Not booked yet";
    if (!f.origin || !f.destination) return f.tripDetails;
    return [
      `${f.origin} → ${f.destination}`,
      fmtRange(f.departsAt, f.returnDepartsAt),
      f.airline,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const unlinkBtn = (booking, what) =>
    booking?.removable && booking.status !== "cancelled" ? (
      <button
        type="button"
        onClick={() => unlink(booking, what)}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          color: "rgba(255,255,255,0.45)",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "inherit",
          marginTop: 2,
        }}
      >
        Unlink
      </button>
    ) : null;

  // Search links open with the trip's destination and dates filled in.
  const ymd = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : null);
  // auto=1: results are already loading when the page opens.
  const bookLink = (tab, extra = {}) => {
    const p = new URLSearchParams({ groupId, tab, auto: "1" });
    if (tab === "Flights" && data.cabinClass) p.set("cabin", data.cabinClass);
    if (tab === "Flights" && myAirport) p.set("from", myAirport);
    if (data.destination) p.set("to", data.destination);
    if (data.dateRangeStart) p.set("depart", ymd(data.dateRangeStart));
    if (data.dateRangeEnd) p.set("return", ymd(data.dateRangeEnd));
    Object.entries(extra).forEach(([k, v]) => v != null && p.set(k, String(v)));
    return `/booking?${p.toString()}`;
  };

  const friendFlights = friendFlightOptions(data, myAirport);
  const myFlightKey = flightOn(me) ? flightKeyOf(me.flight) : null;
  const onFriendsFlight = friendFlights.find((o) => o.key === myFlightKey);
  const otherFriendFlights = friendFlights.filter((o) => o.key !== myFlightKey);

  // Opens Book on that exact flight; the booking page finds it in fresh
  // results or says clearly that it's gone.
  const bookFriendsFlight = (o) => {
    const f = o.flight;
    const p = new URLSearchParams({
      groupId,
      tab: "Flights",
      auto: "1",
      from: f.origin,
      to: f.destination,
      depart: String(f.departsAt).slice(0, 10),
      sf: "1",
      sfDepart: minuteOf(f.departsAt),
      sfWith: o.names.join(" & "),
    });
    if (data.cabinClass) p.set("cabin", data.cabinClass);
    if (f.returnDepartsAt) {
      p.set("return", String(f.returnDepartsAt).slice(0, 10));
      p.set("sfReturn", minuteOf(f.returnDepartsAt));
    }
    if (f.airline) p.set("sfAirline", f.airline);
    navigate(`/booking?${p.toString()}`);
  };

  // "Join this flight" — asks first if you already have a flight, because
  // your current one isn't cancelled automatically.
  const joinFlight = (o) => {
    if (!flightOn(me)) return bookFriendsFlight(o);
    confirmDark({
      title: `Switch to ${o.names.join(" & ")}'s flight?`,
      content: (
        <>
          <p style={{ margin: "0 0 10px" }}>
            You'll book {o.names.join(" & ")}'s flight as a new booking.
          </p>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: "#fff" }}>
              Your current flight is not cancelled automatically.
            </strong>{" "}
            After booking, cancel it from My Trips.
          </p>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
            Check its cancellation terms first: free cancellation only applies
            within 24 hours of booking, and airline fees may apply after that.
          </p>
        </>
      ),
      okText: "Book this flight",
      cancelText: "Keep my flight",
      onOk: () => bookFriendsFlight(o),
    });
  };
  const optionFor = (t) =>
    flightOn(t)
      ? friendFlights.find((o) => o.key === flightKeyOf(t.flight))
      : null;

  return (
    <>
      {data.allBookedAt && (
        <div
          role="status"
          style={{
            ...card,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(82,196,26,0.07)",
            border: "1px solid rgba(82,196,26,0.25)",
          }}
        >
          <PartyPopper size={22} color="#52c41a" />
          <div>
            <div style={{ color: "#fff", fontWeight: 700 }}>
              Everyone's booked!
            </div>
            <div style={muted}>
              Every traveler has a flight and a room. We emailed the group with
              who lands when.
            </div>
          </div>
        </div>
      )}

      {/* ═══ YOUR PART ═══ */}
      {me && (
        <div style={card}>
          <div style={title}>
            <CheckCircleFilled style={{ color: "#ff8a2a" }} /> Your part
          </div>
          <p style={{ ...muted, marginTop: -6, marginBottom: 14 }}>
            Everyone books and pays for their own seat and room, so nobody
            covers anyone else. You can cancel your own part from My Trips
            anytime.
          </p>

          {(data.groupHotel || data.isOrganizer) && (
            <div
              style={{
                ...row,
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minWidth: 0,
                }}
              >
                {data.groupHotel?.thumbnail ? (
                  <img
                    src={data.groupHotel.thumbnail}
                    alt=""
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <BedDouble size={20} color="#b794f6" />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      ...muted,
                      fontSize: 11,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Where the group stays
                  </div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    {data.groupHotel
                      ? data.groupHotel.name
                      : "No hotel picked yet"}
                  </div>
                  <div style={muted}>
                    {data.groupHotel
                      ? data.groupHotel.address ||
                        "Everyone's room search opens at this hotel."
                      : "Pick one hotel so everyone books rooms in the same place."}
                  </div>
                </div>
              </div>
              {data.isOrganizer && (
                <Button
                  onClick={() => navigate(bookLink("Stays", { adults: 1 }))}
                >
                  {data.groupHotel
                    ? "Change hotel"
                    : "Choose the group's hotel"}
                </Button>
              )}
            </div>
          )}

          <div style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Plane size={16} color="#ff8a2a" />
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  Your flight
                </div>
                <div style={muted}>{flightLine(me.flight)}</div>
                {flightOn(me) && me.flight.arrivesAt && (
                  <div style={{ ...muted, fontSize: 12 }}>
                    Lands {fmtLocal(me.flight.arrivesAt)}
                  </div>
                )}
                {flightOn(me) && (
                  <EmailLine
                    groupId={groupId}
                    bookingId={me.flight.id}
                    status={me.flight.emailStatus}
                    onResent={load}
                  />
                )}
                {unlinkBtn(me.flight, "flight")}
              </div>
            </div>
            {me.flight && me.flight.status !== "cancelled" ? (
              <Chip tone="done">
                {me.flight.status === "confirmed" ? "Booked" : me.flight.status}
              </Chip>
            ) : (
              <Button
                className="sk-sync-cta-btn"
                onClick={() => navigate(bookLink("Flights"))}
              >
                Book my flight
              </Button>
            )}
          </div>

          {onFriendsFlight && (
            <div style={{ ...muted, fontSize: 12, margin: "-2px 0 8px 2px" }}>
              ✓ Same flight as {onFriendsFlight.names.join(" & ")}
            </div>
          )}
          {/* Sitting together only works for seats picked in Skyrio. */}
          <div
            style={{
              ...muted,
              fontSize: 12,
              display: "flex",
              gap: 6,
              margin: "-2px 0 8px 2px",
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ color: "#fff" }}>Want to sit together?</strong>{" "}
              Choose your seat during Skyrio checkout — then friends on the same
              flight see where you are and can sit next to you. Seats picked on
              the airline's site or at check-in aren't visible to Skyrio.
            </span>
          </div>
          {otherFriendFlights.length > 0 && (
            <FlyWithFriends
              options={otherFriendFlights}
              seats={seats}
              hasOwnFlight={Boolean(flightOn(me))}
              onJoin={joinFlight}
            />
          )}

          <div style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BedDouble size={16} color="#ff8a2a" />
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  Your room
                </div>
                <div style={muted}>
                  {me.stay?.kind === "shared"
                    ? `Shared room at ${me.stay.hotel || "the hotel"}`
                    : me.stay
                    ? me.stay.tripDetails
                    : "Not booked yet"}
                </div>
                {me.stay &&
                  me.stay.status !== "cancelled" &&
                  (me.stay.kind === "own" ||
                    me.stay.roomStatus === "booked") && (
                    <EmailLine
                      groupId={groupId}
                      bookingId={me.stay.id}
                      status={me.stay.emailStatus}
                      onResent={load}
                    />
                  )}
                {me.stay?.kind === "own" && unlinkBtn(me.stay, "room")}
              </div>
            </div>
            {me.stay?.kind === "shared" ? (
              (() => {
                const [t, l] =
                  SHARE_LABEL[me.stay.shareStatus] || SHARE_LABEL.unpaid;
                return (
                  <Chip tone={t}>
                    {me.stay.roomStatus === "booked" ? "Booked" : l}
                  </Chip>
                );
              })()
            ) : me.stay && me.stay.status !== "cancelled" ? (
              <Chip tone="done">Booked</Chip>
            ) : (
              <Button
                className="sk-sync-cta-btn"
                onClick={() =>
                  navigate(
                    bookLink("Stays", {
                      adults: 1,
                      hotelId: data.groupHotel?.hotelId || null,
                    })
                  )
                }
              >
                {data.groupHotel ? "Book my room here" : "Book my room"}
              </Button>
            )}
          </div>

          {/* Booked outside the trip? Suggests only bookings that match the
              trip's destination and dates; the rest sit behind a quiet link. */}
          <AttachBookingCard
            key={linkKey}
            groupId={groupId}
            embedded
            hasFlight={Boolean(flightOn(me))}
            hasRoom={Boolean(me.stay && me.stay.status !== "cancelled")}
            onChanged={refresh}
          />

          {data.isOrganizer && (
            <div
              style={{
                ...muted,
                fontSize: 12,
                display: "flex",
                gap: 6,
                marginTop: 6,
              }}
            >
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                To pick the group's hotel, tap{" "}
                <strong style={{ color: "#fff" }}>
                  Choose the group's hotel
                </strong>{" "}
                and then{" "}
                <strong style={{ color: "#fff" }}>
                  Make this the group's hotel
                </strong>{" "}
                on any result. Sharing a room? Search Stays with the number of
                people sharing, pick the room, and choose{" "}
                <strong style={{ color: "#fff" }}>
                  Share this room with the group
                </strong>{" "}
                at checkout. Everyone holds their own share — you have{" "}
                {data.holdHours} hours to get everyone in.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══ SHARED ROOMS ═══ */}
      {(activeRooms.length > 0 || pastRooms.length > 0) && (
        <div style={card}>
          <div style={title}>
            <BedDouble size={16} color="#ff8a2a" /> Shared rooms
          </div>
          {activeRooms.map((r) => (
            <SharedRoomCard
              key={r.id}
              groupId={groupId}
              room={r}
              isOrganizer={data.isOrganizer}
              onChanged={refresh}
              autoOpen={String(r.id) === String(holdRoomId || "")}
            />
          ))}
          {pastRooms.length > 0 && (
            <div style={{ marginTop: activeRooms.length ? 12 : 0 }}>
              {pastRooms.map((r) => (
                <SharedRoomCard
                  key={r.id}
                  groupId={groupId}
                  room={r}
                  isOrganizer={data.isOrganizer}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ THE GROUP — who's ready and when they land ═══ */}
      <div style={card}>
        <div style={{ ...title, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} color="#ff8a2a" /> The group
          </span>
          <span style={{ ...muted, fontWeight: 600 }}>
            {readyCount} of {data.travelers.length} ready
          </span>
        </div>

        {/* Land-by line: the organizer's one ask about arrival times. */}
        {editingLandBy ? (
          <LandByEditor
            groupId={groupId}
            window={win}
            destination={data.destination}
            defaultDay={ymd(data.dateRangeStart)}
            onSaved={load}
            onClose={() => setEditingLandBy(false)}
          />
        ) : hasWindow ? (
          <div
            style={{
              ...muted,
              marginTop: -6,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <PlaneLanding size={14} color="#ff8a2a" />
            <span>
              {data.isOrganizer ? "You asked everyone to " : "Please "}
              <strong style={{ color: "#fff" }}>
                {describeWindow(win).replace(/^L/, "l")}
              </strong>
              {data.destination ? ` (${data.destination} time)` : ""}
              {win.note ? ` · ${win.note}` : ""}
              {!data.isOrganizer && (
                <span style={{ display: "block", fontSize: 12, width: "100%" }}>
                  If your flight lands later, try an earlier one so the group
                  arrives together.
                </span>
              )}
            </span>
            {data.isOrganizer && (
              <button
                type="button"
                onClick={() => setEditingLandBy(true)}
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  color: "#ff8a2a",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                Edit
              </button>
            )}
          </div>
        ) : data.isOrganizer ? (
          <>
            <button
              type="button"
              onClick={() => setEditingLandBy(true)}
              style={{
                background: "none",
                border: 0,
                padding: 0,
                marginTop: -6,
                marginBottom: 8,
                color: "#ff8a2a",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <PlaneLanding size={14} /> Set a "land by" time for the group
            </button>
            <div style={{ ...muted, fontSize: 12, marginBottom: 12 }}>
              Optional. Choose the latest time everyone should arrive (like
              before check-in), and Skyrio flags anyone who'd land later.
            </div>
          </>
        ) : null}

        {data.travelers.map((t) => {
          const flightOk = flightOn(t);
          const stayOk =
            (t.stay?.kind === "own" && t.stay.status !== "cancelled") ||
            (t.stay?.kind === "shared" &&
              ["authorized", "paid"].includes(t.stay.shareStatus));
          const late = flightOk && t.flight.outsideWindow;
          return (
            <div key={t.memberId || "organizer"} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  {t.name}
                  {t.isYou ? " (you)" : ""}
                  {t.isOrganizer ? (
                    <span style={{ ...muted, fontSize: 12 }}> · organizer</span>
                  ) : null}
                </div>
                {flightOk && t.flight.arrivesAt && (
                  <div
                    style={{
                      ...muted,
                      fontSize: 12.5,
                      color: late ? "#ff6b6b" : muted.color,
                    }}
                  >
                    Lands {fmtLocal(t.flight.arrivesAt)}
                    {t.flight.destination ? ` at ${t.flight.destination}` : ""}
                    {late
                      ? win.start && t.flight.arrivesAt < win.start
                        ? " · lands before the group's time"
                        : " · lands after the group's time"
                      : ""}
                  </div>
                )}
                {!t.hasAccount && (
                  <div style={{ ...muted, fontSize: 12 }}>
                    Invited — hasn't joined yet
                  </div>
                )}
                {t.hasAccount && t.rsvp === "pending" && !t.isOrganizer && (
                  <div style={{ ...muted, fontSize: 12 }}>
                    Hasn't said if they're coming
                  </div>
                )}
                {data.isOrganizer && !t.isYou && (
                  <>
                    {t.flight &&
                      t.flight.status !== "cancelled" &&
                      t.flight.emailStatus === "failed" && (
                        <EmailLine
                          groupId={groupId}
                          bookingId={t.flight.id}
                          status="failed"
                          onResent={load}
                        />
                      )}
                    {t.stay?.id && t.stay.emailStatus === "failed" && (
                      <EmailLine
                        groupId={groupId}
                        bookingId={t.stay.id}
                        status="failed"
                        onResent={load}
                      />
                    )}
                  </>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <Chip tone={flightOk ? "done" : "wait"}>
                  <Plane
                    size={11}
                    style={{ verticalAlign: "-1px", marginRight: 4 }}
                  />
                  {flightOk ? "Flight" : "No flight"}
                </Chip>
                <Chip tone={stayOk ? "done" : "wait"}>
                  <BedDouble
                    size={11}
                    style={{ verticalAlign: "-1px", marginRight: 4 }}
                  />
                  {stayOk
                    ? "Room"
                    : t.stay?.kind === "shared"
                    ? "Share not held"
                    : "No room"}
                </Chip>
                {!t.isYou &&
                  (() => {
                    const o = optionFor(t);
                    if (!o) return null;
                    if (o.key === myFlightKey)
                      return <Chip tone="done">Same flight as you</Chip>;
                    const st = seats[o.key] || "checking";
                    if (st === "gone")
                      return <Chip tone="off">Their flight sold out</Chip>;
                    return (
                      <Button
                        size="small"
                        className="sk-sync-cta-btn"
                        disabled={st === "checking"}
                        icon={
                          st === "checking" ? (
                            <LoadingOutlined />
                          ) : (
                            <Plane size={12} />
                          )
                        }
                        onClick={() => joinFlight(o)}
                        title={
                          o.otherAirport
                            ? `Leaves from ${o.flight.origin}, not your usual airport`
                            : undefined
                        }
                      >
                        {st === "checking"
                          ? "Checking seats…"
                          : flightOn(me)
                          ? "Switch to this flight"
                          : "Join this flight"}
                      </Button>
                    );
                  })()}
                {data.isOrganizer && !t.isOrganizer && !t.done && (
                  <Button
                    size="small"
                    disabled={!t.canRemind || reminding === t.memberId}
                    loading={reminding === t.memberId}
                    icon={<Bell size={12} />}
                    onClick={() => remind(t)}
                    title={
                      t.canRemind
                        ? "Email them a reminder"
                        : "Reminded recently — you can remind again in 12 hours"
                    }
                  >
                    {t.canRemind ? "Remind" : "Reminded"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {data.declined?.length > 0 && (
          <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
            Can't make it: {data.declined.map((d) => d.name).join(", ")}
          </div>
        )}
        <p style={{ ...muted, fontSize: 12, marginTop: 8 }}>
          If someone doesn't book, it only affects their own seat and room. A
          shared room books only once everyone sharing it is in.
        </p>
      </div>
    </>
  );
}
