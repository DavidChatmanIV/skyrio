// "Leave or end trip" dialog for Sync Together (organizer only).
//
// Two simple questions on one screen:
//   1. The trip:  hand it to someone (it keeps going without you)
//                 or end it for everyone (only if nobody else booked).
//   2. Shared rooms (if any are booked): cancel the room for everyone in
//      it (each gets their share of the hotel's refund), or keep it.
//   3. Your bookings (if you have any): keep them as your own trip,
//                 or cancel them — each shows its real refund from
//                 /api/bookings/:id/cancel-quote (same as My Trips).
// Cancelling goes through /api/bookings/:id/cancel — the same code as
// My Trips — one booking at a time. If any booking doesn't cancel, nothing
// else happens and the dialog says which one failed.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BedDouble,
  Check,
  Loader2,
  Plane,
  X,
} from "lucide-react";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
const call = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, { headers: authHeaders(), ...opts });

const money = (n, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number(n) % 1 ? 2 : 0,
  }).format(Number(n) || 0);

const shortDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        // Trip dates are calendar days stored at midnight UTC — show them
        // in UTC or they slip a day earlier in US time zones.
        timeZone: "UTC",
      })
    : "";

const joinNames = (names) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const firstName = (name) => String(name || "").split(" ")[0] || name;

// "EWR → MIA · 2026-11-20 · round trip" → "EWR → MIA · round trip"
const stripDates = (t) =>
  String(t || "")
    .replace(
      /\s*·\s*\d{4}-\d{2}-\d{2}(\s*(→|->|–|-)\s*\d{4}-\d{2}-\d{2})?/g,
      ""
    )
    .trim();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* What happens to one booking if you choose "cancel".
   mode: "cancel"  — cancel it now (refund shown)
         "request" — terms unavailable; send a request to support instead
         "keep"    — can't be cancelled here; it stays as is            */
function planFor(b, quote) {
  if (b.status === "cancel_pending")
    return { mode: "keep", line: "Already being cancelled by the airline." };
  if (!quote) return { mode: "loading", line: "Checking the refund…" };
  if (quote.inProgress)
    return {
      mode: "keep",
      line: "The airline is already processing a cancellation for this one.",
    };
  if (quote.error)
    return {
      mode: "request",
      line: "We can't get the refund amount right now. If you cancel, we'll send a request and support will confirm with you before anything is cancelled.",
    };
  if (quote.alreadyCancelledWithSupplier)
    return {
      mode: "cancel",
      line: "Already cancelled with the airline. This just updates your trip.",
      refund: 0,
    };
  if (!quote.cancellable)
    return {
      mode: "keep",
      line: quote.reason || "This one can't be cancelled here.",
    };
  const isFlight = quote.type === "Flight";
  // The airline gives credit instead of money back — say so up front
  if (quote.refundTo === "airline_credit")
    return {
      mode: "cancel",
      line: `If cancelled: ${
        quote.airlineCredit?.amount
          ? `about ${money(
              quote.airlineCredit.amount,
              quote.airlineCredit.currency || quote.currency
            )} in airline credit`
          : "airline credit"
      } instead of money back. You'd use it to book with the airline later.`,
      refund: 0,
      credit: quote.airlineCredit?.amount || 0,
    };
  if (quote.estimatedRefund == null)
    return {
      mode: "cancel",
      line: "If cancelled, the airline decides the refund.",
      refund: 0,
      upTo: true,
    };
  if (quote.estimatedRefund <= 0)
    return {
      mode: "cancel",
      line: `If cancelled: no refund — ${
        isFlight ? "the fare" : "this room"
      } is non-refundable.`,
      refund: 0,
    };
  return {
    mode: "cancel",
    line: `If cancelled: ${isFlight ? "refund up to" : "refund"} ${money(
      quote.estimatedRefund,
      quote.currency
    )} of ${money(quote.paid, quote.currency)}${
      isFlight ? " (the airline confirms the final amount)" : ""
    }.`,
    refund: quote.estimatedRefund,
    upTo: isFlight,
  };
}

export default function CancelTripDialog({ tripId, onClose, onCancelled }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [quotes, setQuotes] = useState({}); // bookingId → quote | {error}
  const [tripChoice, setTripChoice] = useState(null); // "handoff" | "end"
  const [newOwnerId, setNewOwnerId] = useState("");
  const [bookingChoice, setBookingChoice] = useState(null); // "keep" | "cancel" | "none"
  const [roomChoice, setRoomChoice] = useState(null); // "cancel" | "keep" | "none"
  const [roomQuotes, setRoomQuotes] = useState({}); // splitId → quote | {error}
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState({}); // bookingId → "doing"|"done"|"failed"
  const [failure, setFailure] = useState("");

  /* Load the trip + your bookings, then each booking's refund */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await call(`/sync-together/${tripId}/cancel-preview`);
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) throw new Error(data.error);
        setPreview(data);
        // Pre-pick whatever is the only option
        const endPossible = data.canEnd || data.endOkIfRoomsCancelled;
        if (data.canHandOff && !endPossible) setTripChoice("handoff");
        if (endPossible && !data.canHandOff) setTripChoice("end");
        if (!(data.sharedRooms || []).length) setRoomChoice("none");
        (data.sharedRooms || []).forEach(async (r) => {
          let q;
          try {
            const res2 = await call(
              `/sync-together/${tripId}/shared-rooms/${r.id}/cancel-quote`
            );
            const d2 = await res2.json().catch(() => ({}));
            q = res2.ok && d2.quote ? d2.quote : { error: true };
          } catch {
            q = { error: true };
          }
          if (alive) setRoomQuotes((prev) => ({ ...prev, [r.id]: q }));
        });
        setNewOwnerId(data.candidates?.[0]?.userId || "");
        if (!data.myBookings.length) setBookingChoice("none");
        data.myBookings
          .filter((b) => b.status === "confirmed")
          .forEach(async (b) => {
            let q;
            try {
              const r = await call(`/bookings/${b.id}/cancel-quote`);
              q = r.ok ? await r.json() : { error: true };
            } catch {
              q = { error: true };
            }
            if (alive) setQuotes((prev) => ({ ...prev, [b.id]: q }));
          });
      } catch (err) {
        if (alive) setLoadError(err.message || "Couldn't load this trip.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  /* Escape closes (unless we're mid-way) */
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !working && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [working, onClose]);

  const bookings = (preview?.myBookings || []).map((b) => ({
    ...b,
    title: stripDates(b.title),
  }));
  const rooms = preview?.sharedRooms || [];
  // Ending is possible outright, or once the shared room is cancelled
  const canEnd =
    !!preview &&
    (preview.canEnd ||
      (preview.endOkIfRoomsCancelled && roomChoice === "cancel"));
  const roomsLoading = rooms.some((r) => !roomQuotes[r.id]);
  const candidates = preview?.candidates || [];
  const newOwner = candidates.find((c) => c.userId === newOwnerId);
  const plans = useMemo(
    () =>
      Object.fromEntries(bookings.map((b) => [b.id, planFor(b, quotes[b.id])])),
    [bookings, quotes]
  );
  const stillLoading = bookings.some((b) => plans[b.id]?.mode === "loading");
  const refundTotal = bookings.reduce(
    (sum, b) => sum + (plans[b.id]?.refund || 0),
    0
  );
  const refundUpTo = bookings.some((b) => plans[b.id]?.upTo);
  const creditTotal = bookings.reduce(
    (sum, b) => sum + (plans[b.id]?.credit || 0),
    0
  );
  const currency = bookings[0]?.currency || "USD";

  const confirm = async () => {
    setWorking(true);
    setFailure("");
    try {
      // 0. Cancel shared rooms (refunds everyone in them their share)
      if (roomChoice === "cancel") {
        for (const r of rooms) {
          const key = `room:${r.id}`;
          if (progress[key] === "done") continue;
          setProgress((p) => ({ ...p, [key]: "doing" }));
          const send = async () => {
            const res = await call(
              `/sync-together/${tripId}/shared-rooms/${r.id}/cancel`,
              { method: "POST" }
            );
            const data = await res.json().catch(() => ({}));
            return {
              ok: res.ok && data.ok !== false,
              retryable: res.status === 502,
            };
          };
          let out = await send();
          if (!out.ok && out.retryable) {
            await wait(2500);
            out = await send();
          }
          if (!out.ok) {
            setProgress((p) => ({ ...p, [key]: "failed" }));
            throw new Error(
              `The shared room at ${r.name} didn't cancel — the hotel didn't accept it. Nothing else was changed. Try again in a minute, or contact support if it keeps happening.`
            );
          }
          setProgress((p) => ({ ...p, [key]: "done" }));
        }
      }

      // 1. Cancel bookings one at a time — stop at the first one that fails
      if (bookingChoice === "cancel") {
        for (const b of bookings) {
          const mode = plans[b.id]?.mode;
          if (mode !== "cancel" && mode !== "request") continue;
          if (progress[b.id] === "done") continue; // retry skips finished ones
          setProgress((p) => ({ ...p, [b.id]: "doing" }));
          const path =
            mode === "cancel"
              ? `/bookings/${b.id}/cancel`
              : `/bookings/${b.id}/cancel-request`;
          const send = async () => {
            const res = await call(path, {
              method: "POST",
              body: JSON.stringify(
                mode === "request" ? { reason: "Leaving a group trip" } : {}
              ),
            });
            const data = await res.json().catch(() => ({}));
            // 200 cancelled · 202 airline processing — both fine. 207 = partly.
            const ok = res.ok && res.status !== 207 && data.ok !== false;
            return { ok, retryable: res.status === 502 };
          };
          let r = await send();
          // Airlines/hotels sometimes refuse once and accept a moment later.
          // Retrying is safe: "already cancelled" counts as done.
          if (!r.ok && r.retryable) {
            await wait(2500);
            r = await send();
          }
          if (!r.ok) {
            setProgress((p) => ({ ...p, [b.id]: "failed" }));
            throw new Error(
              `Your ${b.title} didn't cancel — the ${
                b.type === "Flight" ? "airline" : "hotel"
              } didn't accept it. Nothing else was changed. Try again in a minute, or contact support if it keeps happening.`
            );
          }
          setProgress((p) => ({ ...p, [b.id]: "done" }));
        }
      }

      // 2. Hand the trip off, or end it
      let data;
      if (tripChoice === "handoff") {
        const res = await call(`/sync-together/${tripId}/hand-off`, {
          method: "POST",
          body: JSON.stringify({ newOwnerId }),
        });
        data = await res.json().catch(() => ({}));
        if (!data.ok)
          throw new Error(data.error || "Couldn't hand off the trip.");
      } else {
        const solo = bookingChoice === "keep";
        const res = await call(
          `/sync-together/${tripId}${solo ? "?solo=1" : ""}`,
          { method: "DELETE" }
        );
        data = await res.json().catch(() => ({}));
        if (!data.ok) throw new Error(data.error || "Couldn't end the trip.");
      }

      onCancelled?.({
        mode: tripChoice,
        newOwner: data.newOwner || newOwner?.name || null,
        solo: tripChoice === "end" && bookingChoice === "keep",
        cancelledBookings: bookingChoice === "cancel",
        keptBookings: data.keptBookings || 0,
      });
    } catch (err) {
      setFailure(
        err.message || "Something went wrong. Nothing else was changed."
      );
      setWorking(false);
    }
  };

  const title = preview?.trip?.title || "this trip";
  const hasBookings = bookings.length > 0;
  const nothingPossible =
    preview &&
    !preview.canEnd &&
    !preview.endOkIfRoomsCancelled &&
    !preview.canHandOff;
  const canConfirm =
    tripChoice &&
    bookingChoice &&
    roomChoice &&
    !(tripChoice === "end" && !canEnd) &&
    !(roomChoice === "cancel" && roomsLoading) &&
    (tripChoice !== "handoff" || newOwnerId) &&
    !stillLoading &&
    !working;

  // Button wording says exactly what will happen
  const owner1 = firstName(newOwner?.name);
  const buttonLabel =
    tripChoice === "handoff"
      ? bookingChoice === "cancel"
        ? `Hand to ${owner1} and cancel my bookings`
        : `Hand to ${owner1} and leave`
      : tripChoice === "end"
      ? bookingChoice === "cancel"
        ? "End trip and cancel my bookings"
        : bookingChoice === "keep"
        ? "End group and go solo"
        : "End trip"
      : "Choose what happens";
  const destructive =
    bookingChoice === "cancel" ||
    roomChoice === "cancel" ||
    (tripChoice === "end" && bookingChoice === "none");

  const others = preview?.notify || [];

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="ct-scrim" onClick={() => !working && onClose()} />
      <div
        className="ct-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-title"
      >
        <button
          type="button"
          className="ct-x"
          onClick={onClose}
          disabled={working}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {!preview && !loadError && (
          <div className="ct-loading">
            <Loader2 size={22} className="ct-spin" /> Loading trip…
          </div>
        )}

        {loadError && (
          <>
            <h2 id="ct-title" className="ct-title">
              Couldn&rsquo;t load this trip
            </h2>
            <p className="ct-sub">{loadError}</p>
            <div className="ct-actions">
              <button type="button" className="ct-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

        {preview && nothingPossible && (
          <>
            <h2 id="ct-title" className="ct-title">
              You can&rsquo;t leave {title} yet
            </h2>
            <p className="ct-block">
              <AlertTriangle size={16} />
              {preview.handOffBlockReason && preview.endBlockReason
                ? preview.candidates.length
                  ? preview.handOffBlockReason
                  : preview.endBlockReason
                : preview.endBlockReason || preview.handOffBlockReason}
            </p>
            <div className="ct-actions">
              <button type="button" className="ct-btn" onClick={onClose}>
                OK
              </button>
            </div>
          </>
        )}

        {preview && !nothingPossible && (
          <>
            <h2 id="ct-title" className="ct-title">
              Can&rsquo;t make {title}?
            </h2>
            <p className="ct-sub">
              Things come up. Choose what happens to the trip and to your
              bookings.
            </p>

            {/* ── 1. The trip ── */}
            <div className="ct-label">The trip</div>
            <div className="ct-choices" role="radiogroup" aria-label="The trip">
              {candidates.length > 0 && (
                <label
                  className={`ct-choice${
                    tripChoice === "handoff" ? " is-on" : ""
                  }${!preview.canHandOff ? " is-off" : ""}`}
                >
                  <input
                    type="radio"
                    name="ct-trip"
                    checked={tripChoice === "handoff"}
                    onChange={() => setTripChoice("handoff")}
                    disabled={working || !preview.canHandOff}
                  />
                  <span>
                    <strong>
                      Hand it to{" "}
                      {candidates.length === 1 ? candidates[0].name : "someone"}
                    </strong>
                    <span className="ct-choiceSub">
                      {preview.canHandOff
                        ? `The trip keeps going without you. ${
                            candidates.length === 1
                              ? firstName(candidates[0].name)
                              : "They"
                          } become${
                            candidates.length === 1 ? "s" : ""
                          } the organizer and can keep planning or cancel it.`
                        : preview.handOffBlockReason}
                    </span>
                    {candidates.length > 1 && preview.canHandOff && (
                      <select
                        className="ct-select"
                        value={newOwnerId}
                        onChange={(e) => {
                          setNewOwnerId(e.target.value);
                          setTripChoice("handoff");
                        }}
                        disabled={working}
                        aria-label="New organizer"
                      >
                        {candidates.map((c) => (
                          <option key={c.userId} value={c.userId}>
                            {c.name}
                            {c.booked ? " (booked)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                </label>
              )}

              <label
                className={`ct-choice${tripChoice === "end" ? " is-on" : ""}${
                  !canEnd && !preview.endOkIfRoomsCancelled ? " is-off" : ""
                }`}
              >
                <input
                  type="radio"
                  name="ct-trip"
                  checked={tripChoice === "end"}
                  onChange={() => {
                    setTripChoice("end");
                    // Ending needs the shared room cancelled
                    if (preview.endOkIfRoomsCancelled) setRoomChoice("cancel");
                  }}
                  disabled={
                    working || (!canEnd && !preview.endOkIfRoomsCancelled)
                  }
                />
                <span>
                  <strong>End it for everyone</strong>
                  <span className="ct-choiceSub">
                    {!canEnd && !preview.endOkIfRoomsCancelled
                      ? preview.endBlockReason
                      : preview.endOkIfRoomsCancelled && roomChoice !== "cancel"
                      ? "The shared room below gets cancelled too."
                      : others.length
                      ? `${joinNames(others)} will be told it's off.`
                      : "Nobody else is on this trip yet."}
                  </span>
                </span>
              </label>
            </div>

            {/* ── 2. Shared rooms ── */}
            {rooms.length > 0 && (
              <>
                <div className="ct-label">
                  Shared room{rooms.length > 1 ? "s" : ""}
                </div>
                <ul className="ct-list">
                  {rooms.map((r) => {
                    const q = roomQuotes[r.id];
                    const state = progress[`room:${r.id}`];
                    const dates = [shortDate(r.checkin), shortDate(r.checkout)]
                      .filter(Boolean)
                      .join(" – ");
                    let line;
                    if (state === "failed") line = "Didn't cancel.";
                    else if (state === "done")
                      line = "Cancelled. Refunds are on their way.";
                    else if (!q) line = "Checking the refund…";
                    else if (q.error)
                      line =
                        "We can't get the hotel's refund right now. The hotel decides it when the room is cancelled.";
                    else if (q.estimatedRefund == null || !q.perPerson)
                      line = "If cancelled, the hotel decides the refund.";
                    else if (q.estimatedRefund <= 0)
                      line =
                        "If cancelled: no refund — this room is non-refundable.";
                    else
                      line = `If cancelled: the hotel refunds ${money(
                        q.estimatedRefund,
                        q.currency
                      )}, split as ${q.perPerson
                        .map(
                          (x) =>
                            `${firstName(x.name)} ${money(
                              x.refundCents / 100,
                              q.currency
                            )}`
                        )
                        .join(", ")}.`;
                    return (
                      <li key={r.id} className="ct-item">
                        <span className="ct-itemIcon">
                          {state === "doing" ? (
                            <Loader2 size={16} className="ct-spin" />
                          ) : state === "done" ? (
                            <Check size={16} />
                          ) : (
                            <BedDouble size={16} />
                          )}
                        </span>
                        <span>
                          <span className="ct-itemTitle">
                            {r.name}
                            {dates && (
                              <span className="ct-itemDates"> · {dates}</span>
                            )}
                          </span>
                          <span className="ct-itemLine">
                            Shared {r.includesMe ? "by you and " : "by "}
                            {joinNames(r.others)}.
                          </span>
                          <span
                            className={`ct-itemLine${
                              state === "failed" ? " is-bad" : ""
                            }`}
                          >
                            {line}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div
                  className="ct-choices"
                  role="radiogroup"
                  aria-label="Shared room"
                >
                  <label
                    className={`ct-choice${
                      roomChoice === "cancel" ? " is-on" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="ct-rooms"
                      checked={roomChoice === "cancel"}
                      onChange={() => setRoomChoice("cancel")}
                      disabled={working}
                    />
                    <span>
                      <strong>Cancel the room</strong>
                      <span className="ct-choiceSub">
                        {`It's cancelled for everyone in it. ${joinNames([
                          ...new Set(
                            rooms.flatMap((r) => r.others.map(firstName))
                          ),
                        ])} will be told and get their share of the refund.`}
                      </span>
                    </span>
                  </label>
                  <label
                    className={`ct-choice${
                      roomChoice === "keep" ? " is-on" : ""
                    }${tripChoice === "end" ? " is-off" : ""}`}
                  >
                    <input
                      type="radio"
                      name="ct-rooms"
                      checked={roomChoice === "keep"}
                      onChange={() => setRoomChoice("keep")}
                      disabled={working || tripChoice === "end"}
                    />
                    <span>
                      <strong>Keep the room</strong>
                      <span className="ct-choiceSub">
                        {tripChoice === "end"
                          ? "To end the trip for everyone, the room has to be cancelled."
                          : `It stays booked${
                              newOwner
                                ? ` and ${firstName(newOwner.name)} manages it`
                                : ""
                            }.${
                              rooms.some((r) => r.includesMe)
                                ? ` Your share (${money(
                                    rooms.reduce((a, r) => a + r.myShare, 0),
                                    rooms[0].currency
                                  )}) is not refunded.`
                                : ""
                            }`}
                      </span>
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* ── 3. Your bookings ── */}
            {hasBookings && (
              <>
                <div className="ct-label">Your bookings</div>
                <ul className="ct-list">
                  {bookings.map((b) => {
                    const plan = plans[b.id];
                    const state = progress[b.id];
                    const Icon = b.type === "Flight" ? Plane : BedDouble;
                    const dates = [shortDate(b.start), shortDate(b.end)]
                      .filter(Boolean)
                      .join(" – ");
                    return (
                      <li key={b.id} className="ct-item">
                        <span className="ct-itemIcon">
                          {state === "doing" ? (
                            <Loader2 size={16} className="ct-spin" />
                          ) : state === "done" ? (
                            <Check size={16} />
                          ) : (
                            <Icon size={16} />
                          )}
                        </span>
                        <span>
                          <span className="ct-itemTitle">
                            {b.title}
                            {dates && (
                              <span className="ct-itemDates"> · {dates}</span>
                            )}
                          </span>
                          <span
                            className={`ct-itemLine${
                              state === "failed" ? " is-bad" : ""
                            }`}
                          >
                            {state === "failed"
                              ? "Didn't cancel."
                              : state === "done"
                              ? "Cancelled."
                              : plan?.line}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div
                  className="ct-choices"
                  role="radiogroup"
                  aria-label="Your bookings"
                >
                  <label
                    className={`ct-choice${
                      bookingChoice === "keep" ? " is-on" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="ct-bookings"
                      checked={bookingChoice === "keep"}
                      onChange={() => setBookingChoice("keep")}
                      disabled={working}
                    />
                    <span>
                      <strong>Keep them</strong>
                      <span className="ct-choiceSub">
                        They become your own trip in My Trips. Nothing is
                        cancelled or charged.
                      </span>
                    </span>
                  </label>
                  <label
                    className={`ct-choice${
                      bookingChoice === "cancel" ? " is-on" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="ct-bookings"
                      checked={bookingChoice === "cancel"}
                      onChange={() => setBookingChoice("cancel")}
                      disabled={working}
                    />
                    <span>
                      <strong>Cancel them</strong>
                      <span className="ct-choiceSub">
                        {stillLoading
                          ? "Checking your refund…"
                          : refundTotal > 0 || creditTotal > 0
                          ? [
                              refundTotal > 0 &&
                                `You get back ${
                                  refundUpTo ? "up to " : ""
                                }${money(
                                  refundTotal,
                                  currency
                                )} to your card (5–10 business days).`,
                              creditTotal > 0 &&
                                `${money(
                                  creditTotal,
                                  currency
                                )} comes back as airline credit, not money.`,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : "No refund applies. See each booking above."}
                      </span>
                    </span>
                  </label>
                </div>
              </>
            )}

            {failure && (
              <p className="ct-block" role="alert">
                <AlertTriangle size={16} />
                {failure}
              </p>
            )}

            <div className="ct-actions">
              <button
                type="button"
                className={`ct-btn ${destructive ? "is-danger" : "is-primary"}`}
                onClick={confirm}
                disabled={!canConfirm}
              >
                {working ? (
                  <>
                    <Loader2 size={15} className="ct-spin" /> Working…
                  </>
                ) : (
                  buttonLabel
                )}
              </button>
              <button
                type="button"
                className="ct-btn"
                onClick={onClose}
                disabled={working}
              >
                Never mind
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}

const CSS = `
.ct-scrim { position: fixed; inset: 0; z-index: 2147483600; background: rgba(5,3,12,0.65); animation: ctFade .18s ease both; }
.ct-dialog { position: fixed; z-index: 2147483601; left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px 22px 20px; border-radius: 20px; background: rgba(16,11,34,0.98); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 28px 70px rgba(0,0,0,0.55); color: #fff; font-family: "DM Sans", system-ui, sans-serif; animation: ctIn .2s cubic-bezier(.22,1,.36,1) both; }
.ct-dialog::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 20px 20px 0 0; background: linear-gradient(90deg,#ff8a2a,#ffb347,rgba(147,51,234,.85)); }
.ct-dialog button, .ct-dialog select { font: inherit; }
.ct-x { position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 10px; background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; }
.ct-x:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #fff; }
.ct-title { margin: 0 36px 6px 0; font-size: 20px; font-weight: 800; line-height: 1.25; }
.ct-sub { margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.72); }
.ct-label { margin: 6px 0 8px; font: 700 10.5px/1 ui-monospace,Menlo,monospace; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
.ct-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
.ct-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
.ct-itemIcon { flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 10px; color: #ffb347; background: rgba(255,138,42,0.12); }
.ct-itemTitle { display: block; font-size: 14px; font-weight: 700; }
.ct-itemDates { font-weight: 500; color: rgba(255,255,255,0.6); }
.ct-itemLine { display: block; margin-top: 3px; font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.72); }
.ct-itemLine.is-bad { color: #ff8fa3; }
.ct-choices { display: grid; gap: 8px; margin-bottom: 16px; }
.ct-choice { display: flex; gap: 12px; align-items: flex-start; padding: 13px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); cursor: pointer; transition: border-color .15s, background .15s; }
.ct-choice:hover { background: rgba(255,255,255,0.04); }
.ct-choice.is-on { border-color: #ff8a2a; background: rgba(255,138,42,0.08); }
.ct-choice.is-off { cursor: default; opacity: .6; }
.ct-choice.is-off:hover { background: transparent; }
.ct-choice input { margin-top: 3px; accent-color: #ff8a2a; width: 16px; height: 16px; flex-shrink: 0; }
.ct-choice > span { flex: 1; min-width: 0; }
.ct-choice strong { display: block; font-size: 14.5px; }
.ct-choiceSub { display: block; margin-top: 2px; font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.68); }
.ct-select { display: block; width: 100%; margin-top: 10px; min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; }
.ct-select option { background: #160f2c; color: #fff; }
.ct-block { display: flex; gap: 10px; align-items: flex-start; margin: 4px 0 16px; padding: 12px 14px; border-radius: 14px; background: rgba(255,107,133,0.08); border: 1px solid rgba(255,107,133,0.3); font-size: 13.5px; line-height: 1.5; }
.ct-block svg { flex-shrink: 0; margin-top: 2px; color: #ff8fa3; }
.ct-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ct-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; text-align: center; }
.ct-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); }
.ct-btn.is-danger { flex: 1; border: 0; background: #ff6b85; color: #1a0e06; }
.ct-btn.is-danger:hover:not(:disabled) { background: #ff8399; }
.ct-btn.is-primary { flex: 1; border: 0; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; }
.ct-btn.is-primary:hover:not(:disabled) { filter: brightness(1.06); }
.ct-btn:disabled { opacity: .45; cursor: default; }
.ct-btn:focus-visible, .ct-x:focus-visible, .ct-choice:focus-within, .ct-select:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
.ct-loading { display: flex; align-items: center; gap: 10px; padding: 20px 0; color: rgba(255,255,255,0.75); }
.ct-spin { animation: ctSpin 1s linear infinite; }
@keyframes ctSpin { to { transform: rotate(360deg); } }
@keyframes ctFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ctIn { from { opacity: 0; transform: translate(-50%,-48%) scale(.98); } to { opacity: 1; transform: translate(-50%,-50%); } }
@media (max-width: 520px) {
  .ct-dialog { top: auto; bottom: 0; left: 0; right: 0; transform: none; width: auto; max-height: 90vh; border-radius: 22px 22px 0 0; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); animation: ctUp .24s cubic-bezier(.22,1,.36,1) both; }
  .ct-actions { flex-direction: column-reverse; }
  .ct-btn { width: 100%; }
}
@keyframes ctUp { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .ct-scrim, .ct-dialog, .ct-spin { animation: none; } }
`;
