import { useState } from "react";
import { Star, Sparkles, Check, Lock } from "lucide-react";

/**
 * "How easy was booking?" card for the booking confirmation page.
 *
 *   <CheckoutFeedback bookingId={booking._id} />
 *
 * Tap a star and it saves right away (+10 XP, once per booking). A comment
 * box then opens for anyone who wants to say more. Saved as PRIVATE
 * feedback tagged "Checkout" in Admin → Feedback & reviews. It is not a
 * public review; the public review is asked for after the trip.
 */

const API = import.meta.env.VITE_API_URL || "";
const LABELS = ["", "Hard", "Not great", "Okay", "Easy", "Super easy"];
const doneKey = (id) => `skyrio_checkout_rated_${id}`;

function readDone(id) {
  try {
    return !!localStorage.getItem(doneKey(id));
  } catch {
    return false;
  }
}
function markDone(id) {
  try {
    localStorage.setItem(doneKey(id), "1");
  } catch {
    /* private mode: fine */
  }
}

async function send(path, body, method = "POST") {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(
      data.message || data.error || `Request failed (${res.status})`
    );
    err.already = res.status === 409 || data.already;
    throw err;
  }
  return data;
}

export default function CheckoutFeedback({ bookingId }) {
  // "ask" → "comment" (rated, comment box open) → "done"
  const [step, setStep] = useState(() =>
    bookingId && readDone(bookingId) ? "done" : "ask"
  );
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [xp, setXp] = useState(0);
  const [feedbackId, setFeedbackId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!bookingId) return null;

  async function rate(n) {
    if (busy) return;
    setRating(n);
    setBusy(true);
    setError("");
    try {
      const data = await send("/api/feedback", {
        type: "checkout",
        bookingId,
        rating: n,
        message: "",
        page: window.location.pathname,
      });
      setXp(data.xpAwarded || 0);
      setFeedbackId(data.id);
      if (data.xpAwarded)
        window.dispatchEvent(
          new CustomEvent("skyrio:xp", { detail: { amount: data.xpAwarded } })
        );
      markDone(bookingId);
      setStep("comment");
    } catch (err) {
      if (err.already) {
        markDone(bookingId);
        setStep("done");
      } else {
        setError(err.message);
        setRating(0);
      }
    } finally {
      setBusy(false);
    }
  }

  // The stars are already saved. The comment is added to that same item,
  // so the admin inbox shows one row per booking.
  async function sendComment() {
    const text = comment.trim();
    if (!text || !feedbackId) return setStep("done");
    setBusy(true);
    setError("");
    try {
      await send(
        `/api/feedback/${feedbackId}/comment`,
        { message: text },
        "PATCH"
      );
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;

  return (
    <section className="ckfb" aria-label="Rate your booking experience">
      <style>{css}</style>

      {step === "done" ? (
        <div className="ckfb__done">
          <span className="ckfb__check" aria-hidden="true">
            <Check size={16} strokeWidth={2.6} />
          </span>
          Thanks for rating your booking. After your trip we'll ask how it went.
        </div>
      ) : (
        <>
          <div className="ckfb__head">
            <div>
              <h3 className="ckfb__title">How easy was booking?</h3>
              <p className="ckfb__sub">
                <Lock size={12} aria-hidden="true" />
                Private. Only the Skyrio team sees this.
              </p>
            </div>
            {step === "ask" && (
              <span className="ckfb__xp">
                <Sparkles size={12} aria-hidden="true" />
                +10 XP
              </span>
            )}
          </div>

          <div
            className="ckfb__stars"
            role="radiogroup"
            aria-label="Booking ease, 1 to 5 stars"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}: ${LABELS[n]}`}
                disabled={busy || step !== "ask"}
                onMouseEnter={() => step === "ask" && setHover(n)}
                onClick={() => rate(n)}
                className="ckfb__star"
              >
                <Star
                  size={30}
                  fill={n <= shown ? "#ff8a2a" : "none"}
                  color={n <= shown ? "#ff8a2a" : "rgba(255,255,255,0.25)"}
                />
              </button>
            ))}
            <span className="ckfb__label" aria-live="polite">
              {shown ? LABELS[shown] : "Tap a star"}
            </span>
          </div>

          {step === "comment" && (
            <div className="ckfb__comment">
              {xp > 0 && (
                <div className="ckfb__earned">
                  <Sparkles size={14} aria-hidden="true" />+{xp} XP earned
                </div>
              )}
              <label className="ckfb__qlabel" htmlFor="ckfb-comment">
                {rating <= 3
                  ? "What got in the way? (optional)"
                  : "Anything we could make even easier? (optional)"}
              </label>
              <textarea
                id="ckfb-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={
                  rating <= 3
                    ? "e.g. the seat picker was confusing"
                    : "e.g. save my passport details for next time"
                }
              />
              <div className="ckfb__actions">
                <button
                  type="button"
                  className="ckfb__btn ckfb__btn--ghost"
                  onClick={() => setStep("done")}
                  disabled={busy}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="ckfb__btn"
                  onClick={sendComment}
                  disabled={busy || !comment.trim()}
                >
                  {busy ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="ckfb__error" role="alert">
              {error}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const css = `
.ckfb {
  font-family: 'DM Sans', sans-serif;
  color: #fff;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 18px;
  padding: 20px;
  margin: 20px 0;
  box-sizing: border-box;
}
.ckfb__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.ckfb__title { margin: 0; font-size: 17px; font-weight: 800; }
.ckfb__sub {
  display: flex; align-items: center; gap: 6px;
  margin: 4px 0 0; font-size: 12.5px; color: rgba(255,255,255,0.55);
}
.ckfb__sub svg { color: #ffb347; flex-shrink: 0; }
.ckfb__xp {
  display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
  font-size: 11px; font-weight: 800; color: #ffb347;
  background: rgba(255,179,71,0.12); border: 1px solid rgba(255,179,71,0.35);
  border-radius: 999px; padding: 3px 9px;
}
.ckfb__stars { display: flex; align-items: center; gap: 2px; margin-top: 14px; flex-wrap: wrap; }
.ckfb__star {
  background: none; border: none; padding: 4px; cursor: pointer;
  min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease;
}
.ckfb__star:disabled { cursor: default; }
.ckfb__star:not(:disabled):active { transform: scale(0.9); }
.ckfb__star:focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; border-radius: 8px; }
.ckfb__label { margin-left: 8px; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.6); }
.ckfb__comment { margin-top: 14px; animation: ckfbIn 0.25s ease both; }
.ckfb__earned {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px;
  font-size: 13px; font-weight: 800; color: #ffb347;
}
.ckfb__qlabel { display: block; font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 6px; }
.ckfb textarea {
  width: 100%; box-sizing: border-box; resize: vertical;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13);
  border-radius: 12px; color: #fff; font: inherit; font-size: 16px; padding: 12px; outline: none;
}
.ckfb textarea:focus { border-color: rgba(255,138,42,0.6); }
.ckfb__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.ckfb__btn {
  min-height: 40px; padding: 0 20px; border-radius: 10px; border: none; cursor: pointer;
  font: inherit; font-size: 13.5px; font-weight: 700; color: #1a0e06;
  background: linear-gradient(135deg, #ff8a2a, #ffb347);
}
.ckfb__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ckfb__btn--ghost { background: none; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.65); }
.ckfb__error { margin-top: 10px; font-size: 12.5px; color: #f87171; }
.ckfb__done { display: flex; align-items: center; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.75); }
.ckfb__check {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(135deg, #ff8a2a, #7c5cfc);
}
@keyframes ckfbIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ckfb__comment { animation: none; } }
`;
