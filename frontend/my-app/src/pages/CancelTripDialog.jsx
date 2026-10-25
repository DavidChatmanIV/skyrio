// "Cancel trip" dialog for Sync Together (organizer only).
//
// One simple screen:
//   1. Who will be told the trip is off.
//   2. Your bookings on the trip, each with its real refund (from
//      /api/bookings/:id/cancel-quote — the same quote My Trips uses).
//   3. Two choices: cancel my bookings too, or keep them.
// Cancelling goes through /api/bookings/:id/cancel — the same code as
// My Trips — one booking at a time. If any booking doesn't cancel, the trip
// is NOT deleted and the dialog says which one failed.

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

/* What happens to one booking if you choose "cancel".
   mode: "cancel"  — cancel it now (refund shown)
         "request" — terms unavailable; send a request to support instead
         "keep"    — can't be cancelled here; it stays as is            */
function planFor(b, quote) {
  if (b.status === "cancel_pending")
    return { mode: "keep", line: "Already being cancelled by the airline." };
  if (!quote) return { mode: "loading", line: "Checking the refund…" };
  if (quote.error)
    return {
      mode: "request",
      line: "We can't get the refund amount right now. We'll send a cancellation request, and support will confirm with you before anything is cancelled.",
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
  if (quote.estimatedRefund == null)
    return {
      mode: "cancel",
      line: "Refund is decided by the airline after you cancel.",
      refund: 0,
      upTo: true,
    };
  if (quote.estimatedRefund <= 0)
    return {
      mode: "cancel",
      line: `No refund — ${
        isFlight ? "the fare" : "this room"
      } is non-refundable.`,
      refund: 0,
    };
  return {
    mode: "cancel",
    line: `${isFlight ? "Refund up to" : "Refund"} ${money(
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
  const [choice, setChoice] = useState(null); // "cancel" | "keep"
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
        if (!data.myBookings.length) setChoice("keep");
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

  /* Escape closes (unless we're mid-cancel) */
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !working && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [working, onClose]);

  const bookings = preview?.myBookings || [];
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
  const currency = bookings[0]?.currency || "USD";

  const confirm = async () => {
    setWorking(true);
    setFailure("");
    try {
      // 1. Cancel bookings one at a time — stop at the first one that fails
      if (choice === "cancel") {
        for (const b of bookings) {
          const mode = plans[b.id]?.mode;
          if (mode !== "cancel" && mode !== "request") continue;
          setProgress((p) => ({ ...p, [b.id]: "doing" }));
          const path =
            mode === "cancel"
              ? `/bookings/${b.id}/cancel`
              : `/bookings/${b.id}/cancel-request`;
          const res = await call(path, {
            method: "POST",
            body: JSON.stringify(
              mode === "request" ? { reason: "Cancelling a group trip" } : {}
            ),
          });
          const data = await res.json().catch(() => ({}));
          // 200 cancelled · 202 airline processing — both fine. 207 = partly.
          if (!res.ok || res.status === 207 || data.ok === false) {
            setProgress((p) => ({ ...p, [b.id]: "failed" }));
            throw new Error(
              `${b.title}: ${
                data.message ||
                "the airline/hotel didn't accept the cancellation"
              } The trip was not cancelled, so you can try again.`
            );
          }
          setProgress((p) => ({ ...p, [b.id]: "done" }));
        }
      }

      // 2. Cancel (delete) the trip
      const res = await call(`/sync-together/${tripId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "Couldn't cancel the trip.");

      onCancelled?.({
        cancelledBookings: choice === "cancel",
        keptBookings: data.keptBookings || 0,
      });
    } catch (err) {
      setFailure(
        err.message || "Something went wrong. Nothing else was changed."
      );
      setWorking(false);
    }
  };

  const canConfirm = preview?.canCancel && choice && !stillLoading && !working;
  const title = preview?.trip?.title || "this trip";

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

        {preview && (
          <>
            <h2 id="ct-title" className="ct-title">
              Cancel {title}?
            </h2>

            {!preview.canCancel ? (
              <>
                <p className="ct-block">
                  <AlertTriangle size={16} />
                  {preview.blockReason}
                </p>
                <div className="ct-actions">
                  <button type="button" className="ct-btn" onClick={onClose}>
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="ct-sub">
                  {preview.notify.length
                    ? `${joinNames(
                        preview.notify
                      )} will be told the trip is off.`
                    : "Nobody else is on this trip yet."}
                </p>

                {bookings.length > 0 && (
                  <>
                    <div className="ct-label">Your bookings on this trip</div>
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
                                  <span className="ct-itemDates">
                                    {" "}
                                    · {dates}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`ct-itemLine${
                                  state === "failed" ? " is-bad" : ""
                                }`}
                              >
                                {state === "failed"
                                  ? "Didn't cancel."
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
                      aria-label="What should happen to your bookings?"
                    >
                      <label
                        className={`ct-choice${
                          choice === "cancel" ? " is-on" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="ct-choice"
                          checked={choice === "cancel"}
                          onChange={() => setChoice("cancel")}
                          disabled={working}
                        />
                        <span>
                          <strong>Cancel my bookings too</strong>
                          <span className="ct-choiceSub">
                            {stillLoading
                              ? "Checking your refund…"
                              : refundTotal > 0
                              ? `You get back ${
                                  refundUpTo ? "up to " : ""
                                }${money(
                                  refundTotal,
                                  currency
                                )} to your card (5–10 business days).`
                              : "Everything is cancelled. See the refund for each booking above."}
                          </span>
                        </span>
                      </label>
                      <label
                        className={`ct-choice${
                          choice === "keep" ? " is-on" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="ct-choice"
                          checked={choice === "keep"}
                          onChange={() => setChoice("keep")}
                          disabled={working}
                        />
                        <span>
                          <strong>Keep my bookings</strong>
                          <span className="ct-choiceSub">
                            They stay in My Trips. You can still cancel them
                            there later.
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
                    className="ct-btn is-danger"
                    onClick={confirm}
                    disabled={!canConfirm}
                  >
                    {working ? (
                      <>
                        <Loader2 size={15} className="ct-spin" /> Cancelling…
                      </>
                    ) : choice === "cancel" ? (
                      "Cancel trip and bookings"
                    ) : (
                      "Cancel trip"
                    )}
                  </button>
                  <button
                    type="button"
                    className="ct-btn"
                    onClick={onClose}
                    disabled={working}
                  >
                    Keep trip
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>,
    document.body
  );
}

const CSS = `
.ct-scrim { position: fixed; inset: 0; z-index: 2147483600; background: rgba(5,3,12,0.65); animation: ctFade .18s ease both; }
.ct-dialog { position: fixed; z-index: 2147483601; left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px 22px 20px; border-radius: 20px; background: rgba(16,11,34,0.98); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 28px 70px rgba(0,0,0,0.55); color: #fff; font-family: "DM Sans", system-ui, sans-serif; animation: ctIn .2s cubic-bezier(.22,1,.36,1) both; }
.ct-dialog::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 20px 20px 0 0; background: linear-gradient(90deg,#ff8a2a,#ffb347,rgba(147,51,234,.85)); }
.ct-dialog button { font: inherit; }
.ct-x { position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 10px; background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; }
.ct-x:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #fff; }
.ct-title { margin: 0 36px 6px 0; font-size: 20px; font-weight: 800; line-height: 1.25; }
.ct-sub { margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.72); }
.ct-label { margin: 4px 0 8px; font: 700 10.5px/1 ui-monospace,Menlo,monospace; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
.ct-list { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 8px; }
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
.ct-choice input { margin-top: 3px; accent-color: #ff8a2a; width: 16px; height: 16px; flex-shrink: 0; }
.ct-choice strong { display: block; font-size: 14.5px; }
.ct-choiceSub { display: block; margin-top: 2px; font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.68); }
.ct-block { display: flex; gap: 10px; align-items: flex-start; margin: 4px 0 16px; padding: 12px 14px; border-radius: 14px; background: rgba(255,107,133,0.08); border: 1px solid rgba(255,107,133,0.3); font-size: 13.5px; line-height: 1.5; }
.ct-block svg { flex-shrink: 0; margin-top: 2px; color: #ff8fa3; }
.ct-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ct-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }
.ct-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); }
.ct-btn.is-danger { flex: 1; border: 0; background: #ff6b85; color: #1a0e06; }
.ct-btn.is-danger:hover:not(:disabled) { background: #ff8399; }
.ct-btn:disabled { opacity: .45; cursor: default; }
.ct-btn:focus-visible, .ct-x:focus-visible, .ct-choice:focus-within { outline: 2px solid #ff8a2a; outline-offset: 2px; }
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
