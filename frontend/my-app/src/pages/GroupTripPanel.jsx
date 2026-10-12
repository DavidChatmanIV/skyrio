// src/pages/GroupTripPanel.jsx
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
import { CheckCircleFilled, ClockCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { Plane, BedDouble, Users, Bell, Info, Lock, PlaneLanding, Mail, PartyPopper } from "lucide-react";
import dayjs from "dayjs";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
// Same Stripe key the hotel checkout uses (Skyrio is the merchant for rooms).
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

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
    throw new Error(data.error || data.message || "Something went wrong. Please try again.");
  }
  return data;
}

const money = (cents, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency).toUpperCase() }).format(
    (Number(cents) || 0) / 100
  );

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
const title = { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 14 };
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
  price_changed: "The hotel raised the price before everyone was in, so every hold was released.",
  sold_out: "The hotel no longer had this room, so every hold was released.",
  failed: "The hotel couldn't confirm the room, so every hold was released.",
  member_left: "Someone sharing the room left the trip, so every hold was released.",
  expired: "Not everyone held their share in time, so every hold was released.",
  released: "The organizer released the room. Nobody was charged.",
};

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
      const start = await api(`/${groupId}/shared-rooms/${room.id}/shares/${share.id}/hold`, { method: "POST" });
      if (!start.alreadyHeld) {
        const { error: err, paymentIntent } = await stripe.confirmCardPayment(start.clientSecret, {
          payment_method: { card: elements.getElement(CardElement) },
        });
        if (err) throw new Error(err.message || "Your card was declined.");
        if (paymentIntent?.status !== "requires_capture") {
          throw new Error("Your card wasn't authorized. Please try another card.");
        }
      }
      await api(`/${groupId}/shared-rooms/${room.id}/shares/${share.id}/held`, { method: "POST" });
      antdMessage.success("Your share is held. You'll be charged only when everyone is in.");
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
              base: { color: "#fff", fontSize: "15px", "::placeholder": { color: "rgba(255,255,255,0.35)" } },
              invalid: { color: "#ff6b6b" },
            },
          }}
        />
      </div>
      {error && (
        <div role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>
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
        {busy ? "Holding…" : `Hold ${money(share.amountOwed, room.currency)} on my card`}
      </Button>
      <div style={{ ...muted, fontSize: 12, marginTop: 8, textAlign: "center" }}>
        Held, not charged. If not everyone is in by the deadline, the hold is released.
      </div>
    </div>
  );
}

/* ═══ One shared room ═══ */
function SharedRoomCard({ groupId, room, isOrganizer, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [working, setWorking] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const mine = room.shares.find((s) => s.isYou);
  const heldCount = room.shares.filter((s) => s.status === "authorized" || s.status === "paid").length;
  const [tone, label] = ROOM_LABEL[room.status] || ROOM_LABEL.collecting;
  const perPerson = room.status === "booked" && room.bookedCents != null ? null : room.totalCents / room.people;

  const release = () =>
    Modal.confirm({
      title: "Release this room?",
      content: "Every hold is let go and nobody is charged. You can set up a new shared room afterwards.",
      okText: "Release room",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/${groupId}/shared-rooms/${room.id}/release`, { method: "POST" });
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
      const { quote: q } = await api(`/${groupId}/shared-rooms/${room.id}/cancel-quote`);
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
      const out = await api(`/${groupId}/shared-rooms/${room.id}/cancel`, { method: "POST" });
      setQuoteOpen(false);
      antdMessage.success(
        out.refundedCents > 0
          ? `Cancelled. ${money(out.refundedCents, out.currency)} is being refunded, split by what each person paid.`
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
    <div style={{ ...row, display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{room.room?.name || "Shared room"}</div>
          <div style={muted}>
            {room.room?.roomName || "Room"}
            {room.room?.boardName ? ` · ${room.room.boardName}` : ""}
          </div>
          <div style={muted}>
            {room.room?.checkin ? `${dayjs(room.room.checkin).format("MMM D")} → ${dayjs(room.room.checkout).format("MMM D")}` : ""}
            {` · ${room.people} people`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <Chip tone={tone}>{label}</Chip>
          <div style={{ color: "#ff8a2a", fontWeight: 800, fontSize: 16, marginTop: 6 }}>
            {money(room.status === "booked" && room.bookedCents != null ? room.bookedCents : room.totalCents, room.currency)}
          </div>
          {perPerson != null && (
            <div style={{ ...muted, fontSize: 12 }}>about {money(perPerson, room.currency)} each</div>
          )}
        </div>
      </div>

      {room.status === "collecting" && (
        <div style={{ ...muted, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <ClockCircleOutlined />
          {heldCount} of {room.people} held · {timeLeft(room.deadline)} (until{" "}
          {dayjs(room.deadline).format("ddd MMM D, h:mm A")})
        </div>
      )}
      {room.closedReason && CLOSED_REASON[room.closedReason] && room.status !== "booked" && room.status !== "cancelled" && (
        <div style={{ ...muted, marginTop: 10 }}>{CLOSED_REASON[room.closedReason]}</div>
      )}
      {room.status === "booked" && room.hotelConfirmationCode && (
        <div style={{ ...muted, marginTop: 10 }}>
          Hotel confirmation: <strong style={{ color: "#fff" }}>{room.hotelConfirmationCode}</strong>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {room.shares.map((s) => {
          const [t, l] = SHARE_LABEL[s.status] || SHARE_LABEL.unpaid;
          return (
            <div
              key={s.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", gap: 8 }}
            >
              <span style={{ color: "#fff", fontSize: 13 }}>
                {s.name}
                {s.isYou ? " (you)" : ""}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...muted, fontSize: 12 }}>
                  {money(s.status === "paid" || s.status === "refunded" ? s.capturedCents : s.amountOwed, room.currency)}
                </span>
                <Chip tone={t}>{l}</Chip>
              </span>
            </div>
          );
        })}
      </div>

      {room.status === "collecting" && mine && ["unpaid", "failed"].includes(mine.status) && (
        <>
          {!showForm ? (
            <Button className="sk-sync-cta-btn" block style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
              Hold my share · {money(mine.amountOwed, room.currency)}
            </Button>
          ) : (
            <Elements stripe={stripePromise}>
              <HoldShareForm groupId={groupId} room={room} share={mine} onDone={onChanged} />
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
        <Button type="text" danger style={{ marginTop: 8 }} loading={working} onClick={openCancel}>
          Cancel this room
        </Button>
      )}
      {!isOrganizer && room.status === "booked" && (
        <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
          Only the organizer can cancel a shared room. If it's cancelled, you get your share of the hotel's refund.
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
              Everyone paid {new Intl.NumberFormat("en-US", { style: "currency", currency: quote.currency }).format(quote.paid)} in
              total.
              {quote.estimatedRefund != null && (
                <>
                  {" "}
                  Based on the hotel's policy, about{" "}
                  <strong>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: quote.currency }).format(quote.estimatedRefund)}
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
              The hotel confirms the final amount when you cancel. Each person is refunded in proportion to what they paid, to the card
              they used.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ═══ Arrivals — who lands when ═══
   Flight times are the airport's local time, shown exactly as the airline
   sends them. The organizer can set a window everyone should land in. */
const fmtLocal = (v) => (v ? dayjs(v).format("ddd MMM D, h:mm A") : "");

function ArrivalWindowEditor({ groupId, window: win, onSaved, onClose }) {
  const [start, setStart] = useState(win?.start || "");
  const [end, setEnd] = useState(win?.end || "");
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
    setSaving(true);
    try {
      await api(`/${groupId}/arrival-window`, {
        method: "PATCH",
        body: clear ? { start: null, end: null, note: null } : { start: start || null, end: end || null, note },
      });
      antdMessage.success(clear ? "Arrival window cleared" : "Arrival window saved");
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label style={muted}>
          Land after
          <input id="arrival-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </label>
        <label style={muted}>
          Land before
          <input id="arrival-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <label style={{ ...muted, display: "block", marginTop: 10 }}>
        Note for the group (optional)
        <input
          id="arrival-note"
          type="text"
          maxLength={200}
          placeholder="e.g. Check-in is at 3 PM — try to land by 2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={inputStyle}
        />
      </label>
      <div style={{ ...muted, fontSize: 12, marginTop: 6 }}>Use the destination's local time.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Button className="sk-sync-cta-btn" loading={saving} onClick={() => save(false)}>
          Save window
        </Button>
        {(win?.start || win?.end) && (
          <Button disabled={saving} onClick={() => save(true)}>
            Clear
          </Button>
        )}
        <Button type="text" disabled={saving} onClick={onClose} style={{ color: "rgba(255,255,255,0.6)" }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ArrivalsCard({ groupId, data, onChanged }) {
  const [editing, setEditing] = useState(false);
  const win = data.arrivalWindow || {};
  const hasWindow = Boolean(win.start || win.end);
  const withFlights = data.travelers
    .filter((t) => t.flight && t.flight.status !== "cancelled" && t.flight.arrivesAt)
    .sort((a, b) => (a.flight.arrivesAt < b.flight.arrivesAt ? -1 : 1));
  const noFlight = data.travelers.filter((t) => !t.flight || t.flight.status === "cancelled");
  const outside = withFlights.filter((t) => t.flight.outsideWindow).length;

  let spread = null;
  if (withFlights.length > 1) {
    const mins = dayjs(withFlights[withFlights.length - 1].flight.arrivesAt).diff(dayjs(withFlights[0].flight.arrivesAt), "minute");
    spread = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }

  return (
    <div style={card}>
      <div style={{ ...title, justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PlaneLanding size={16} color="#ff8a2a" /> Arrivals
        </span>
        {data.isOrganizer && !editing && (
          <Button size="small" onClick={() => setEditing(true)}>
            {hasWindow ? "Edit window" : "Set arrival window"}
          </Button>
        )}
      </div>

      {hasWindow && !editing && (
        <div style={{ ...muted, marginTop: -6, marginBottom: 12 }}>
          Land between <strong style={{ color: "#fff" }}>{win.start ? fmtLocal(win.start) : "any time"}</strong> and{" "}
          <strong style={{ color: "#fff" }}>{win.end ? fmtLocal(win.end) : "any time"}</strong>
          {win.note ? ` · ${win.note}` : ""}
        </div>
      )}
      {editing && (
        <ArrivalWindowEditor groupId={groupId} window={win} onSaved={onChanged} onClose={() => setEditing(false)} />
      )}

      {withFlights.length === 0 ? (
        <p style={{ ...muted, margin: 0 }}>Arrival times show up here as people book their flights.</p>
      ) : (
        <>
          {(spread || (hasWindow && outside > 0)) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {spread && <Chip tone="off">First to last landing: {spread}</Chip>}
              {hasWindow && outside > 0 && (
                <Chip tone="bad">
                  {outside} outside the window
                </Chip>
              )}
              {hasWindow && outside === 0 && <Chip tone="done">Everyone lands in the window</Chip>}
            </div>
          )}
          {withFlights.map((t) => (
            <div key={t.memberId || "organizer"} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  {t.name}
                  {t.isYou ? " (you)" : ""}
                </div>
                <div style={muted}>
                  {[t.flight.origin && t.flight.destination ? `${t.flight.origin} → ${t.flight.destination}` : null, t.flight.airline]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {t.flight.returnDepartsAt && (
                  <div style={{ ...muted, fontSize: 12 }}>Leaves {fmtLocal(t.flight.returnDepartsAt)}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: t.flight.outsideWindow ? "#ff6b6b" : "#fff", fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                  Lands {fmtLocal(t.flight.arrivesAt)}
                </div>
                {t.flight.outsideWindow && (
                  <div style={{ color: "#ff6b6b", fontSize: 12 }}>
                    {win.start && t.flight.arrivesAt < win.start ? "Before the window" : "After the window"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
      {withFlights.length > 0 && noFlight.length > 0 && (
        <div style={{ ...muted, fontSize: 12, marginTop: 6 }}>
          No flight yet: {noFlight.map((t) => t.name).join(", ")}
        </div>
      )}
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
      await api(`/${groupId}/resend-confirmation`, { method: "POST", body: { bookingId } });
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
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 2 }}>
      <Mail size={12} color={status === "failed" ? "#ff6b6b" : status === "sent" ? "#52c41a" : "rgba(255,255,255,0.45)"} />
      <span style={{ color: status === "failed" ? "#ff6b6b" : "rgba(255,255,255,0.55)" }}>{text}</span>
      {canResend && (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          style={{ background: "none", border: 0, padding: 0, color: "#ff8a2a", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
        >
          {busy ? "Sending…" : "Resend"}
        </button>
      )}
    </div>
  );
}

/* ═══ Main panel ═══ */
export default function GroupTripPanel({ groupId, myAirport, onChanged }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(null);

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
    () => (data?.sharedRooms || []).some((r) => r.status === "collecting" || r.status === "booking"),
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

  const remind = async (t) => {
    setReminding(t.memberId);
    try {
      await api(`/${groupId}/remind`, { method: "POST", body: { memberId: t.memberId } });
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
  const activeRooms = data.sharedRooms.filter((r) => ["collecting", "booking", "booked"].includes(r.status));
  const pastRooms = data.sharedRooms.filter((r) => !["collecting", "booking", "booked"].includes(r.status)).slice(0, 3);
  const readyCount = data.travelers.filter((t) => t.done).length;

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
            <div style={{ color: "#fff", fontWeight: 700 }}>Everyone's booked!</div>
            <div style={muted}>Every traveler has a flight and a room. We emailed the group with who lands when.</div>
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
            Everyone books and pays for their own seat and room, so nobody covers anyone else. You can cancel your own part from My
            Trips anytime.
          </p>

          {(data.groupHotel || data.isOrganizer) && (
            <div
              style={{
                ...row,
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                {data.groupHotel?.thumbnail ? (
                  <img
                    src={data.groupHotel.thumbnail}
                    alt=""
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <BedDouble size={20} color="#b794f6" />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...muted, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>Where the group stays</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    {data.groupHotel ? data.groupHotel.name : "No hotel picked yet"}
                  </div>
                  <div style={muted}>
                    {data.groupHotel
                      ? data.groupHotel.address || "Everyone's room search opens at this hotel."
                      : "Pick one hotel so everyone books rooms in the same place."}
                  </div>
                </div>
              </div>
              {data.isOrganizer && (
                <Button onClick={() => navigate(bookLink("Stays", { adults: 1 }))}>
                  {data.groupHotel ? "Change hotel" : "Choose the group's hotel"}
                </Button>
              )}
            </div>
          )}

          <div style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Plane size={16} color="#ff8a2a" />
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Your flight</div>
                <div style={muted}>{me.flight ? me.flight.tripDetails : "Not booked yet"}</div>
                {me.flight && me.flight.status !== "cancelled" && (
                  <EmailLine groupId={groupId} bookingId={me.flight.id} status={me.flight.emailStatus} onResent={load} />
                )}
              </div>
            </div>
            {me.flight && me.flight.status !== "cancelled" ? (
              <Chip tone="done">{me.flight.status === "confirmed" ? "Booked" : me.flight.status}</Chip>
            ) : (
              <Button className="sk-sync-cta-btn" onClick={() => navigate(bookLink("Flights"))}>
                Book my flight
              </Button>
            )}
          </div>

          <div style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BedDouble size={16} color="#ff8a2a" />
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Your room</div>
                <div style={muted}>
                  {me.stay?.kind === "shared"
                    ? `Shared room at ${me.stay.hotel || "the hotel"}`
                    : me.stay
                    ? me.stay.tripDetails
                    : "Not booked yet"}
                </div>
                {me.stay && me.stay.status !== "cancelled" && (me.stay.kind === "own" || me.stay.roomStatus === "booked") && (
                  <EmailLine groupId={groupId} bookingId={me.stay.id} status={me.stay.emailStatus} onResent={load} />
                )}
              </div>
            </div>
            {me.stay?.kind === "shared" ? (
              (() => {
                const [t, l] = SHARE_LABEL[me.stay.shareStatus] || SHARE_LABEL.unpaid;
                return <Chip tone={t}>{me.stay.roomStatus === "booked" ? "Booked" : l}</Chip>;
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

          {data.isOrganizer && (
            <div style={{ ...muted, fontSize: 12, display: "flex", gap: 6, marginTop: 6 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                To pick the group's hotel, tap <strong style={{ color: "#fff" }}>Choose the group's hotel</strong> and then{" "}
                <strong style={{ color: "#fff" }}>Make this the group's hotel</strong> on any result. Sharing a room? Search Stays with the number of people sharing, pick the room, and choose{" "}
                <strong style={{ color: "#fff" }}>Share this room with the group</strong> at checkout. Everyone holds their own share
                — you have {data.holdHours} hours to get everyone in.
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
            <SharedRoomCard key={r.id} groupId={groupId} room={r} isOrganizer={data.isOrganizer} onChanged={refresh} />
          ))}
          {pastRooms.length > 0 && (
            <div style={{ marginTop: activeRooms.length ? 12 : 0 }}>
              {pastRooms.map((r) => (
                <SharedRoomCard key={r.id} groupId={groupId} room={r} isOrganizer={data.isOrganizer} onChanged={refresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ARRIVALS ═══ */}
      <ArrivalsCard groupId={groupId} data={data} onChanged={load} />

      {/* ═══ WHO'S READY ═══ */}
      <div style={card}>
        <div style={{ ...title, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} color="#ff8a2a" /> Who's ready
          </span>
          <span style={{ ...muted, fontWeight: 600 }}>
            {readyCount} of {data.travelers.length}
          </span>
        </div>
        {data.travelers.map((t) => {
          const flightOk = t.flight && t.flight.status !== "cancelled";
          const stayOk =
            (t.stay?.kind === "own" && t.stay.status !== "cancelled") ||
            (t.stay?.kind === "shared" && ["authorized", "paid"].includes(t.stay.shareStatus));
          return (
            <div key={t.memberId || "organizer"} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  {t.name}
                  {t.isYou ? " (you)" : ""}
                  {t.isOrganizer ? <span style={{ ...muted, fontSize: 12 }}> · organizer</span> : null}
                </div>
                {!t.hasAccount && <div style={{ ...muted, fontSize: 12 }}>Invited — hasn't joined yet</div>}
                {t.hasAccount && t.rsvp === "pending" && !t.isOrganizer && (
                  <div style={{ ...muted, fontSize: 12 }}>Hasn't said if they're coming</div>
                )}
                {data.isOrganizer && !t.isYou && (
                  <>
                    {t.flight && t.flight.status !== "cancelled" && t.flight.emailStatus === "failed" && (
                      <EmailLine groupId={groupId} bookingId={t.flight.id} status="failed" onResent={load} />
                    )}
                    {t.stay?.id && t.stay.emailStatus === "failed" && (
                      <EmailLine groupId={groupId} bookingId={t.stay.id} status="failed" onResent={load} />
                    )}
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Chip tone={flightOk ? "done" : "wait"}>
                  <Plane size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                  {flightOk ? "Flight" : "No flight"}
                </Chip>
                <Chip tone={stayOk ? "done" : "wait"}>
                  <BedDouble size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                  {stayOk ? "Room" : t.stay?.kind === "shared" ? "Share not held" : "No room"}
                </Chip>
                {data.isOrganizer && !t.isOrganizer && !t.done && (
                  <Button
                    size="small"
                    disabled={!t.canRemind || reminding === t.memberId}
                    loading={reminding === t.memberId}
                    icon={<Bell size={12} />}
                    onClick={() => remind(t)}
                    title={t.canRemind ? "Email them a reminder" : "Reminded recently — you can remind again in 12 hours"}
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
          If someone doesn't book, it only affects their own seat and room. A shared room books only once everyone sharing it is in.
        </p>
      </div>
    </>
  );
}
