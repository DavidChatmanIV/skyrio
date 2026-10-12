// src/pages/admin/AdminBookings.jsx
// Route: /admin/bookings  (admin-only — the backend enforces it)
//
// Find any booking fast: search by traveler name or email, airline/hotel
// confirmation code, LiteAPI booking ID, Stripe payment ID, route, or Skyrio
// booking ID. Open one to see everything, check its live status with
// LiteAPI, get a cancellation quote, cancel + refund, handle cancellation
// requests, and keep notes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plane,
  BedDouble,
  X,
  Copy,
  RefreshCw,
  AlertTriangle,
  StickyNote,
  ExternalLink,
  Clock,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const STRIPE_TEST = String(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || ""
).startsWith("pk_test");

const C = {
  bg: "#0b0817",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.10)",
  text: "#fff",
  muted: "rgba(255,255,255,0.6)",
  faint: "rgba(255,255,255,0.4)",
  orange: "#ff8a2a",
  green: "#34d399",
  red: "#f87171",
  amber: "#ffb347",
};

// Sends both logins the server accepts here: the admin-dashboard session
// (cookie, plus x-admin-email for local dev) and a regular Skyrio login.
const authHeaders = () => {
  const token = localStorage.getItem("token");
  const adminEmail = localStorage.getItem("admin_email");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(adminEmail && { "x-admin-email": adminEmail }),
  };
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    credentials: "include",
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202 && res.status !== 207) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return { status: res.status, data };
}

const money = (n, cur = "USD") =>
  Number.isFinite(Number(n))
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur || "USD",
      }).format(Number(n))
    : "—";
const when = (v, withTime = false) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return withTime
    ? d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};
const travelerName = (b) => b.name || b.user?.name || b.user?.username || "—";
const travelerEmail = (b) => b.email || b.user?.email || "—";
const codeOf = (b) =>
  b.confirmationCodes?.[0] ||
  b.flight?.bookingRef ||
  b.hotelStay?.confirmation?.find((c) => c?.hotelConfirmationCode)
    ?.hotelConfirmationCode ||
  null;
const openRequest = (b) => b?.cancelRequest?.status === "open";

const STATUS_COLOR = {
  confirmed: C.green,
  pending: C.amber,
  cancel_pending: C.amber,
  cancelled: C.red,
};

function StatusBadge({ status }) {
  const col = STATUS_COLOR[status] || C.muted;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        color: col,
        border: `1px solid ${col}55`,
        background: `${col}14`,
        borderRadius: 20,
        padding: "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {String(status || "unknown").replace("_", " ")}
    </span>
  );
}

function RequestFlag() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        color: C.amber,
        marginTop: 4,
      }}
    >
      <Clock size={11} /> Cancel requested
    </span>
  );
}

function CopyVal({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span style={{ color: C.faint }}>—</span>;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        wordBreak: "break-all",
      }}
    >
      <code style={{ color: C.text, fontSize: 12 }}>{value}</code>
      <button
        type="button"
        title="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(String(value));
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        style={{
          background: "none",
          border: "none",
          color: copied ? C.green : C.faint,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Copy size={13} />
      </button>
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "7px 0",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 13,
      }}
    >
      <div style={{ width: 170, flexShrink: 0, color: C.muted }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, color: C.text }}>{children}</div>
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: C.faint,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const btn = (variant = "ghost", disabled = false) => ({
  opacity: disabled ? 0.45 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
  padding: "9px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  ...(variant === "danger"
    ? {
        background: "rgba(248,113,113,.12)",
        border: `1px solid ${C.red}66`,
        color: C.red,
      }
    : variant === "primary"
    ? {
        background: "linear-gradient(135deg,#f97316,#ec4899)",
        border: "none",
        color: "#fff",
      }
    : {
        background: "transparent",
        border: `1px solid ${C.border}`,
        color: C.text,
      }),
});

const inputStyle = {
  flex: 1,
  padding: "9px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,.06)",
  border: `1px solid ${C.border}`,
  color: C.text,
  fontFamily: "inherit",
};

// ─────────────────────────────────────────────
// Manual tools — for when automation can't do it
// ─────────────────────────────────────────────
const labelStyle = { fontSize: 12, color: C.muted, marginBottom: 4 };

function ManualCancel({ b, id, busy, run, onDone }) {
  const isHotel = b.type === "Hotel";
  const paid = Number(b.totalAmount ?? b.total) || 0;
  const cur = b.totalCurrency || "USD";
  const canStripe = Boolean(b.stripePaymentIntentId);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");
  const [method, setMethod] = useState(canStripe ? "stripe" : "supplier");
  const [amount, setAmount] = useState("");
  const [notify, setNotify] = useState(true);
  const amt = Number(amount);
  const amountOk =
    method === "none" ||
    (Number.isFinite(amt) && amt > 0 && amt <= paid);
  const ready = note.trim() && amountOk && !busy;

  if (!open) {
    return (
      <button type="button" style={btn()} onClick={() => setOpen(true)}>
        Cancel manually…
      </button>
    );
  }
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        fontSize: 13,
      }}
    >
      <div style={{ color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
        Use this after you've cancelled with the{" "}
        {isHotel ? "hotel" : "airline"} or LiteAPI support yourself (phone,
        email, ticket). Skyrio marks the trip cancelled, handles the refund
        the way you choose, and notifies the traveler.
      </div>

      <div style={labelStyle}>What happened? (required)</div>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Cancelled via LiteAPI support ticket; airline confirmed full refund"
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
      />

      <div style={labelStyle}>Supplier reference (optional)</div>
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="LiteAPI ticket #, hotel cancellation code…"
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 10 }}
      />

      <div style={labelStyle}>Refund to the traveler</div>
      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        {[
          canStripe && ["stripe", "Skyrio refunds their card now (Stripe)"],
          ["supplier", "Refunded by the airline / LiteAPI"],
          ["none", "No refund"],
        ]
          .filter(Boolean)
          .map(([value, label]) => (
            <label key={value} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                name={`refund-method-${id}`}
                checked={method === value}
                onChange={() => setMethod(value)}
              />
              {label}
            </label>
          ))}
      </div>

      {method !== "none" && (
        <>
          <div style={labelStyle}>
            Refund amount ({cur}) — paid {money(paid, cur)}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />
            <button type="button" style={btn()} onClick={() => setAmount(String(paid))}>
              Full amount
            </button>
          </div>
        </>
      )}

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Email and notify the traveler
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btn()} onClick={() => setOpen(false)} disabled={!!busy}>
          Close
        </button>
        <button
          type="button"
          style={btn("danger", !ready)}
          disabled={!ready}
          onClick={() => {
            const refundText =
              method === "none" ? "no refund" : `a ${money(amt, cur)} refund`;
            if (!window.confirm(`Mark this trip cancelled with ${refundText}? This can't be undone.`)) return;
            run("manual-cancel", async () => {
              const { data } = await api(`/api/bookings/admin/${id}/manual-cancel`, {
                method: "POST",
                body: JSON.stringify({
                  note,
                  supplierReference: ref,
                  refundMethod: method,
                  refundAmount: method === "none" ? 0 : amt,
                  notifyTraveler: notify,
                }),
              });
              setOpen(false);
              await onDone();
              if (data?.ok === false && data?.message) throw new Error(data.message);
            });
          }}
        >
          {busy === "manual-cancel" ? "Saving…" : "Mark cancelled"}
        </button>
      </div>
    </div>
  );
}

function ManualRefund({ b, id, busy, run, onDone }) {
  const cur = b.totalCurrency || "USD";
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const amt = Number(amount);
  const ready = Number.isFinite(amt) && amt > 0 && reason.trim() && !busy;
  return (
    <div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
        Refund part or all of this booking to the traveler's card through
        Stripe — for goodwill credits or a refund that failed. Already
        refunded: {money(b.refundAmount || 0, cur)}. The traveler gets the
        refund email once Stripe confirms it.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount (${cur})`}
          style={{ ...inputStyle, flex: "0 1 160px" }}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          style={{ ...inputStyle, flex: "1 1 220px" }}
        />
        <button
          type="button"
          style={btn("primary", !ready)}
          disabled={!ready}
          onClick={() => {
            if (!window.confirm(`Refund ${money(amt, cur)} to the traveler's card?`)) return;
            run("refund", async () => {
              await api(`/api/bookings/admin/${id}/refund`, {
                method: "POST",
                body: JSON.stringify({ amount: amt, reason }),
              });
              setAmount("");
              setReason("");
              await onDone();
            });
          }}
        >
          {busy === "refund" ? "Refunding…" : "Issue refund"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Booking detail drawer
// ─────────────────────────────────────────────
function BookingDetail({ id, onClose, onChanged }) {
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(null);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api(`/api/bookings/admin/${id}`);
      setBooking(data.booking);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (label, fn) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const b = booking;
  const cur = b?.totalCurrency || "USD";
  const isHotel = b?.type === "Hotel";
  const canCancel = b && b.status === "confirmed";
  // Typed confirmation, any capitalization ("cancel", "Cancel", "CANCEL").
  const cancelConfirmed = confirmText.trim().toUpperCase() === "CANCEL";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,3,12,.65)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          height: "100%",
          overflowY: "auto",
          background: "#120d24",
          borderLeft: `1px solid ${C.border}`,
          padding: 24,
          color: C.text,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {b?.tripDetails || "Booking"}
            </div>
            {b && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <StatusBadge status={b.status} />
                <span style={{ color: C.muted, fontSize: 13 }}>
                  {b.type} · booked {when(b.createdAt, true)}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btn(), padding: 8 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              color: C.red,
              background: "rgba(248,113,113,.08)",
              border: `1px solid ${C.red}44`,
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              marginBottom: 16,
              display: "flex",
              gap: 8,
            }}
          >
            <AlertTriangle size={15} /> {error}
          </div>
        )}
        {!b && !error && <div style={{ color: C.muted }}>Loading…</div>}

        {b && (
          <>
            {b.cancelRequest && (
              <Section title="Cancellation request">
                <div
                  style={{
                    background: openRequest(b)
                      ? "rgba(255,179,71,.08)"
                      : C.card,
                    border: `1px solid ${
                      openRequest(b) ? `${C.amber}55` : C.border
                    }`,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <div
                    style={{
                      color: openRequest(b) ? C.amber : C.green,
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    {openRequest(b)
                      ? "Open — the traveler is waiting to hear from you"
                      : "Resolved"}
                  </div>
                  <div>Requested {when(b.cancelRequest.at, true)}</div>
                  <div style={{ color: C.muted }}>
                    Traveler's note: {b.cancelRequest.reason || "(none)"}
                  </div>
                  {!openRequest(b) && (
                    <div style={{ color: C.muted }}>
                      Resolved {when(b.cancelRequest.resolvedAt, true)}:{" "}
                      {b.cancelRequest.resolution}
                    </div>
                  )}
                  {openRequest(b) && (
                    <>
                      <div style={{ color: C.muted, margin: "8px 0" }}>
                        Confirm the terms with{" "}
                        {isHotel ? "the hotel" : "the airline / LiteAPI support"}
                        , contact the traveler, then cancel below (that closes
                        this request automatically) — or mark it resolved if
                        they decided to keep the trip.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          placeholder="e.g. Traveler decided to keep the trip"
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          style={btn("ghost", !resolution.trim() || !!busy)}
                          disabled={!resolution.trim() || !!busy}
                          onClick={() =>
                            run("resolve", async () => {
                              const { data } = await api(
                                `/api/bookings/admin/${id}/cancel-request/resolve`,
                                {
                                  method: "POST",
                                  body: JSON.stringify({ resolution }),
                                }
                              );
                              setBooking((prev) => ({
                                ...data.booking,
                                user: prev?.user,
                              }));
                              setResolution("");
                              onChanged?.();
                            })
                          }
                        >
                          {busy === "resolve" ? "Saving…" : "Mark resolved"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Section>
            )}

            <Section title="Traveler">
              <Row label="Name">{travelerName(b)}</Row>
              <Row label="Contact email">
                <CopyVal value={b.email} />
              </Row>
              <Row label="Account email">
                <CopyVal value={b.user?.email} />
              </Row>
              <Row label="Account">
                {b.user?.username || b.user?.name || "—"}{" "}
                {b.user?._id && <CopyVal value={b.user._id} />}
              </Row>
              <Row label="Passengers / guests">
                {(b.passengers || [])
                  .map((p) => p.name)
                  .filter(Boolean)
                  .join(", ") || "—"}
              </Row>
            </Section>

            <Section title="Trip">
              <Row label="Dates">
                {when(b.dates?.start)} → {when(b.dates?.end)}
              </Row>
              {isHotel ? (
                (b.hotelStay?.rooms || []).map((r, i) => (
                  <Row key={i} label={`Room ${i + 1}`}>
                    <div>{r.name}</div>
                    <div style={{ color: C.muted }}>
                      {[r.roomName, r.boardName].filter(Boolean).join(" · ")}
                      {r.address ? ` · ${r.address}` : ""}
                    </div>
                  </Row>
                ))
              ) : (
                <>
                  <Row label="Route">
                    {b.flight?.origin} → {b.flight?.destination}
                  </Row>
                  <Row label="Airline">{b.flight?.airline || "—"}</Row>
                  <Row label="Departs">{when(b.flight?.departureAt, true)}</Row>
                  {b.flight?.returnDepartureAt && (
                    <Row label="Returns">
                      {when(b.flight.returnDepartureAt, true)}
                    </Row>
                  )}
                </>
              )}
            </Section>

            <Section title="References">
              <Row
                label={
                  isHotel ? "Hotel confirmation" : "Airline confirmation (PNR)"
                }
              >
                <CopyVal value={codeOf(b)} />
              </Row>
              <Row label="LiteAPI booking ID(s)">
                {(b.providerBookingIds?.length
                  ? b.providerBookingIds
                  : [b.flight?.bookingId]
                )
                  .filter(Boolean)
                  .map((x) => (
                    <div key={x}>
                      <CopyVal value={x} />
                    </div>
                  ))}
                {!b.providerBookingIds?.length && !b.flight?.bookingId && (
                  <span style={{ color: C.faint }}>—</span>
                )}
              </Row>
              {!isHotel && (
                <Row label="LiteAPI prebook ID">
                  <CopyVal value={b.flight?.prebookId} />
                </Row>
              )}
              <Row label="Stripe payment">
                {b.stripePaymentIntentId ? (
                  <span
                    style={{
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <CopyVal value={b.stripePaymentIntentId} />
                    <a
                      href={`https://dashboard.stripe.com/${
                        STRIPE_TEST ? "test/" : ""
                      }payments/${b.stripePaymentIntentId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: C.orange, display: "inline-flex" }}
                      title="Open in Stripe"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </span>
                ) : (
                  <span style={{ color: C.muted }}>
                    {isHotel
                      ? "—"
                      : "Collected by LiteAPI (not in Skyrio's Stripe)"}
                  </span>
                )}
              </Row>
              <Row label="Skyrio booking ID">
                <CopyVal value={b._id} />
              </Row>
            </Section>

            <Section title="Money">
              <Row label="Paid">{money(b.totalAmount ?? b.total, cur)}</Row>
              <Row label="Paid at">{when(b.paidAt, true)}</Row>
              <Row label="Refund">
                {b.refundStatus && b.refundStatus !== "none"
                  ? `${money(b.refundAmount, cur)} · ${b.refundStatus}`
                  : "None"}
              </Row>
              {b.cancellation && (
                <Row label="Cancellation">
                  <div>
                    {when(b.cancellation.at, true)} by {b.cancellation.by}
                    {b.cancellation.partial
                      ? " · PARTIAL — needs attention"
                      : ""}
                    {b.cancellation.manual ? " · handled by hand" : ""}
                  </div>
                  {b.cancellation.manual && (
                    <div style={{ color: C.muted }}>
                      {b.cancellation.note}
                      {b.cancellation.supplierReference
                        ? ` · Ref: ${b.cancellation.supplierReference}`
                        : ""}
                    </div>
                  )}
                  <div style={{ color: C.muted }}>
                    Supplier refund {money(b.cancellation.supplierRefund, cur)}{" "}
                    · fee {money(b.cancellation.cancellationFee, cur)} · to
                    traveler {money(b.cancellation.customerRefund, cur)}
                  </div>
                  {b.cancellation.refundError && (
                    <div style={{ color: C.red }}>
                      Stripe refund failed: {b.cancellation.refundError} —
                      refund manually in Stripe.
                    </div>
                  )}
                </Row>
              )}
            </Section>

            <Section
              title="Live status from LiteAPI"
              right={
                <button
                  type="button"
                  style={btn()}
                  disabled={!!busy}
                  onClick={() =>
                    run("live", async () => {
                      const { data } = await api(
                        `/api/bookings/admin/${id}/live`
                      );
                      setLive(data.results);
                    })
                  }
                >
                  <RefreshCw size={13} />{" "}
                  {busy === "live" ? "Checking…" : "Check now"}
                </button>
              }
            >
              {!live && (
                <div style={{ color: C.muted, fontSize: 13 }}>
                  Fetches the booking's current state directly from LiteAPI.
                </div>
              )}
              {live?.map((r) => (
                <pre
                  key={r.bookingId}
                  style={{
                    fontSize: 11,
                    color: r.ok ? C.muted : C.red,
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: 10,
                    overflowX: "auto",
                    maxHeight: 260,
                  }}
                >
                  {r.ok
                    ? JSON.stringify(r.data, null, 2)
                    : `${r.bookingId}: ${r.message}`}
                </pre>
              ))}
            </Section>

            <Section title="Cancel">
              {!canCancel ? (
                <div style={{ color: C.muted, fontSize: 13 }}>
                  {b.status === "cancelled"
                    ? "Already cancelled."
                    : b.status === "cancel_pending"
                    ? "The airline is still processing this cancellation. Use “Check now” above to see its status."
                    : "Only confirmed bookings can be cancelled."}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <button
                      type="button"
                      style={btn()}
                      disabled={!!busy}
                      onClick={() =>
                        run("quote", async () => {
                          const { data } = await api(
                            `/api/bookings/${id}/cancel-quote`
                          );
                          setQuote(data);
                        })
                      }
                    >
                      {busy === "quote"
                        ? "Getting quote…"
                        : "Get cancellation quote"}
                    </button>
                  </div>
                  {quote && (
                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13,
                        marginBottom: 12,
                      }}
                    >
                      {quote.cancellable === false ? (
                        <div style={{ color: C.amber }}>{quote.reason}</div>
                      ) : (
                        <>
                          <div>
                            Paid:{" "}
                            <strong>{money(quote.paid, quote.currency)}</strong>
                          </div>
                          <div>
                            Estimated refund:{" "}
                            <strong style={{ color: C.green }}>
                              {quote.estimatedRefund != null
                                ? money(quote.estimatedRefund, quote.currency)
                                : "not stated"}
                            </strong>
                          </div>
                          <div>
                            Estimated fee:{" "}
                            {quote.estimatedFee != null
                              ? money(quote.estimatedFee, quote.currency)
                              : "not stated"}
                          </div>
                          {quote.type === "Flight" && (
                            <div style={{ color: C.muted }}>
                              Refundable: {String(quote.isRefundable)} ·
                              Voidable: {String(quote.isVoidable)}
                            </div>
                          )}
                          <div style={{ color: C.muted, marginTop: 6 }}>
                            {quote.note}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div
                    style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}
                  >
                    Cancels with the {isHotel ? "hotel" : "airline"} first, then{" "}
                    {isHotel
                      ? "refunds the traveler's card through Stripe for whatever the hotel refunds"
                      : "the airline refunds the traveler's card through LiteAPI"}
                    . The traveler gets a notification. Type{" "}
                    <strong>cancel</strong> to confirm.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type cancel to confirm"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      style={btn("danger", !cancelConfirmed || !!busy)}
                      disabled={!cancelConfirmed || !!busy}
                      onClick={() =>
                        run("cancel", async () => {
                          const { data } = await api(
                            `/api/bookings/${id}/cancel`,
                            { method: "POST" }
                          );
                          setConfirmText("");
                          setQuote(null);
                          await load();
                          onChanged?.();
                          if (data?.message)
                            setError(data.ok === false ? data.message : "");
                        })
                      }
                    >
                      {busy === "cancel" ? "Cancelling…" : "Cancel booking"}
                    </button>
                  </div>
                </>
              )}
            </Section>

            {b.sharedRoom && b.status === "confirmed" && (
              <Section title="Shared room (Sync Together)">
                <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5, marginBottom: 10 }}>
                  This is one person's share of a room shared by {b.sharedRoom.people} people
                  (room total {money(b.sharedRoom.roomTotal, b.totalCurrency)}). The normal
                  cancel would cancel everyone's room but refund only this person, so it's
                  blocked. Cancel the whole room here instead — every person gets their share
                  of the hotel's refund.
                </div>
                <button
                  type="button"
                  style={btn("danger", Boolean(busy))}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (!window.confirm("Cancel the WHOLE shared room for everyone and refund each person their share?")) return;
                    run("shared-cancel", async () => {
                      const { data } = await api(`/api/bookings/admin/${id}/shared-room/cancel`, { method: "POST" });
                      if (data?.message) setError("");
                      await load();
                      onChanged?.();
                    });
                  }}
                >
                  {busy === "shared-cancel" ? "Cancelling…" : "Cancel whole shared room"}
                </button>
              </Section>
            )}

            {["confirmed", "cancel_pending"].includes(b.status) && (
              <Section title="Handle by hand">
                <ManualCancel
                  b={b}
                  id={id}
                  busy={busy}
                  run={run}
                  onDone={async () => {
                    await load();
                    onChanged?.();
                  }}
                />
              </Section>
            )}

            {b.stripePaymentIntentId &&
              ["confirmed", "cancelled"].includes(b.status) && (
                <Section title="Issue a refund">
                  <ManualRefund
                    b={b}
                    id={id}
                    busy={busy}
                    run={run}
                    onDone={async () => {
                      await load();
                      onChanged?.();
                    }}
                  />
                </Section>
              )}

            {b.status === "pending" && !b.paidAt && (
              <Section title="Abandoned checkout">
                <div
                  style={{
                    color: C.muted,
                    fontSize: 13,
                    lineHeight: 1.6,
                    marginBottom: 10,
                  }}
                >
                  This checkout was started but never paid, so nothing was
                  booked and no one was charged. Removing it only deletes
                  Skyrio's record. (Records from the last hour can't be
                  removed, in case the traveler is still checking out.)
                </div>
                <button
                  type="button"
                  style={btn("danger", !!busy)}
                  disabled={!!busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Remove this unpaid checkout record? This can't be undone."
                      )
                    )
                      return;
                    run("delete", async () => {
                      await api(`/api/bookings/${id}`, { method: "DELETE" });
                      onChanged?.();
                      onClose();
                    });
                  }}
                >
                  {busy === "delete" ? "Removing…" : "Remove record"}
                </button>
              </Section>
            )}

            <Section title="Changes (names, dates, flights)">
              <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
                Name corrections and date or flight changes are made by the
                airline or hotel, not in Skyrio. Contact LiteAPI support with
                the <strong>LiteAPI booking ID</strong> and the confirmation
                code above, then record what changed in the notes below so the
                history stays in one place.
              </div>
            </Section>

            <Section title="Admin notes (internal)">
              {(b.adminNotes || []).length === 0 && (
                <div style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>
                  No notes yet.
                </div>
              )}
              {(b.adminNotes || []).map((n, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{ color: C.faint, fontSize: 11, marginBottom: 3 }}
                  >
                    {when(n.at, true)}
                    {n.by === "system" ? " · automatic" : ""}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Called traveler 10/2, name corrected via LiteAPI ticket #123"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <button
                  type="button"
                  style={btn("primary", !note.trim() || !!busy)}
                  disabled={!note.trim() || !!busy}
                  onClick={() =>
                    run("note", async () => {
                      const { data } = await api(
                        `/api/bookings/admin/${id}/notes`,
                        { method: "POST", body: JSON.stringify({ text: note }) }
                      );
                      setBooking((prev) => ({
                        ...prev,
                        adminNotes: data.adminNotes,
                      }));
                      setNote("");
                    })
                  }
                >
                  <StickyNote size={14} /> Save
                </button>
              </div>
            </Section>

            <Section
              title="Raw record"
              right={
                <button
                  type="button"
                  style={btn()}
                  onClick={() => setShowRaw((v) => !v)}
                >
                  {showRaw ? "Hide" : "Show"}
                </button>
              }
            >
              {showRaw && (
                <pre
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: 10,
                    overflowX: "auto",
                    maxHeight: 400,
                  }}
                >
                  {JSON.stringify(b, null, 2)}
                </pre>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function AdminBookings() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    p.set("page", String(page));
    p.set("limit", "25");
    return p.toString();
  }, [q, type, status, page]);

  useEffect(() => {
    setPage(1);
  }, [q, type, status]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api(`/api/bookings/admin/search?${params}`);
        if (!cancelled) {
          setResult(data);
          setError("");
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e.status === 403 || e.status === 401
              ? "Admin access required. Log in at /admin/login first."
              : e.message
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [params, reloadKey]);

  const selectStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,.06)",
    border: `1px solid ${C.border}`,
    color: C.text,
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        padding: "28px 24px 60px",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Bookings</div>
            <div style={{ color: C.muted, fontSize: 13 }}>
              Find any trip by traveler, email, confirmation code, or payment
              ID.
            </div>
          </div>
          <Link to="/admin" style={{ color: C.orange, fontSize: 14 }}>
            ← Admin dashboard
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div style={{ flex: "1 1 320px", position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                color: C.faint,
              }}
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, confirmation code, LiteAPI ID, pi_…, EWR, hotel name…"
              style={{
                ...selectStyle,
                width: "100%",
                paddingLeft: 36,
                boxSizing: "border-box",
              }}
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={selectStyle}
          >
            <option value="">All types</option>
            <option value="Flight">Flights</option>
            <option value="Hotel">Hotels</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            <option value="cancel_requested">Cancellation requested</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancel_pending">Cancel pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {error && (
          <div style={{ color: C.red, marginBottom: 12, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
          {loading
            ? "Searching…"
            : `${result.total} booking${result.total === 1 ? "" : "s"}`}
        </div>

        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {result.items.length === 0 && !loading && (
            <div
              style={{
                padding: 24,
                color: C.muted,
                textAlign: "center",
                fontSize: 14,
              }}
            >
              No bookings match.
            </div>
          )}
          {result.items.map((b) => (
            <button
              key={b._id}
              type="button"
              onClick={() => setOpenId(b._id)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "28px 1.6fr 1.4fr 1fr 110px 120px",
                gap: 12,
                alignItems: "center",
                padding: "12px 14px",
                background: openRequest(b)
                  ? "rgba(255,179,71,.05)"
                  : "transparent",
                border: "none",
                borderBottom: `1px solid ${C.border}`,
                color: C.text,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            >
              <span style={{ color: C.orange }}>
                {b.type === "Hotel" ? (
                  <BedDouble size={16} />
                ) : (
                  <Plane size={16} />
                )}
              </span>
              <span style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.tripDetails}
                </div>
                <div style={{ color: C.muted }}>
                  {when(b.dates?.start)}
                  {codeOf(b) ? ` · ${codeOf(b)}` : ""}
                </div>
              </span>
              <span style={{ minWidth: 0 }}>
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {travelerName(b)}
                </div>
                <div
                  style={{
                    color: C.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {travelerEmail(b)}
                </div>
              </span>
              <span style={{ color: C.muted }}>{when(b.createdAt)}</span>
              <span>{money(b.totalAmount ?? b.total, b.totalCurrency)}</span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <StatusBadge status={b.status} />
                {openRequest(b) && <RequestFlag />}
              </span>
            </button>
          ))}
        </div>

        {result.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginTop: 14,
            }}
          >
            <button
              type="button"
              style={btn()}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span style={{ color: C.muted, fontSize: 13, alignSelf: "center" }}>
              Page {page} of {result.totalPages}
            </span>
            <button
              type="button"
              style={btn()}
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {openId && (
        <BookingDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
