// ─────────────────────────────────────────────────────────────
// Find my booking — /find-booking
//
// For anyone who booked as a guest (no account) or lost their email.
// Email + confirmation code (airline/hotel code or Skyrio booking ID) opens
// the booking right here, where it can be viewed or cancelled. A "Manage or
// cancel" link is also emailed so they can come back later.
// ─────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Hash,
  CheckCircle2,
  AlertTriangle,
  Plane,
  BedDouble,
} from "lucide-react";
import { MT_CSS } from "./SavedTripsPage";

const API = import.meta.env.VITE_API_URL || "";

const PAGE_CSS = `
.fb-wrap { max-width: 520px; }
.fb-form { margin-top: 18px; padding: 20px; border-radius: 18px; background: rgba(16,11,34,0.78); border: 1px solid rgba(255,255,255,0.1); }
.fb-label { display: block; margin: 0 0 6px; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.85); }
.fb-field { position: relative; margin-bottom: 14px; }
.fb-field svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.5); }
.fb-input { width: 100%; box-sizing: border-box; min-height: 46px; padding: 0 12px 0 38px; border-radius: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,0.16); color: #fff; font: inherit; font-size: 15px; }
.fb-input:focus { outline: none; border-color: #ff8a2a; box-shadow: 0 0 0 3px rgba(255,138,42,.25); }
.fb-hint { margin: -8px 0 14px; font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5; }
.fb-submit { width: 100%; justify-content: center; }
.fb-submit:disabled { opacity: .6; cursor: default; }
.fb-done { display: flex; gap: 10px; align-items: flex-start; margin-top: 18px; padding: 16px; border-radius: 16px; background: rgba(110,231,168,.07); border: 1px solid rgba(110,231,168,.3); font-size: 14px; line-height: 1.6; }
.fb-done svg { color: #6ee7a8; flex-shrink: 0; margin-top: 2px; }
.fb-alt { margin-top: 20px; font-size: 13px; color: rgba(255,255,255,0.72); line-height: 1.6; }
.fb-alt a { color: #ffb347; font-weight: 700; }
.fb-pick { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; font: inherit; font-size: 14px; font-weight: 700; text-align: left; cursor: pointer; }
.fb-pick:hover { border-color: #ff8a2a; }
.fb-pick svg { color: #ffb347; flex-shrink: 0; }
`;

export default function FindBookingPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [found, setFound] = useState([]); // more than one match: pick one
  const navigate = useNavigate();
  const open = (b) =>
    navigate(`/manage-booking/${b.id}?t=${encodeURIComponent(b.token)}`);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim();
    const cleanCode = code.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter the email you booked with.");
      return;
    }
    if (cleanCode.length < 4) {
      setError("Enter your confirmation code from the booking email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/bookings/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Something went wrong.");
      const list = Array.isArray(data.bookings) ? data.bookings : [];
      if (list.length === 1) {
        // Straight to the booking, where Cancel booking is.
        open(list[0]);
        return;
      }
      if (list.length > 1) {
        setFound(list);
        setSentMessage(data.message);
        return;
      }
      setSentMessage(data.message);
    } catch (err) {
      setError(err.message || "We couldn't reach Skyrio. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt fb-wrap">
      <style>{MT_CSS + PAGE_CSS}</style>
      <div className="mt-kicker mt-mono">Manage booking</div>
      <h1 className="mt-title" style={{ fontSize: "clamp(26px,4vw,34px)" }}>
        Find my booking
      </h1>
      <p className="mt-sub">
        View or cancel a flight or hotel, with or without a Skyrio account.
        Enter your email and confirmation code to open your booking.
      </p>

      {sentMessage ? (
        <div className="fb-done" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            {found.length > 1 ? (
              <>
                <b>We found {found.length} bookings.</b> Pick one to view or
                cancel it.
                {found.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="fb-pick"
                    onClick={() => open(b)}
                  >
                    {b.type === "Hotel" ? (
                      <BedDouble size={18} aria-hidden="true" />
                    ) : (
                      <Plane size={18} aria-hidden="true" />
                    )}
                    <span>{b.title}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <b>Check your email.</b> {sentMessage}
              </>
            )}
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="mt-link"
                onClick={() => {
                  setSentMessage("");
                  setFound([]);
                  setCode("");
                }}
              >
                Look up another booking
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form className="fb-form" onSubmit={submit} noValidate>
          <label className="fb-label" htmlFor="fb-email">
            Email you booked with
          </label>
          <div className="fb-field">
            <Mail size={16} aria-hidden="true" />
            <input
              id="fb-email"
              className="fb-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <label className="fb-label" htmlFor="fb-code">
            Confirmation code
          </label>
          <div className="fb-field">
            <Hash size={16} aria-hidden="true" />
            <input
              id="fb-code"
              className="fb-input mt-mono"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ABC123"
            />
          </div>
          <p className="fb-hint">
            It&apos;s in your booking confirmation email: the airline or hotel
            confirmation code, or your Skyrio booking ID.
          </p>

          {error && (
            <div
              className="mt-note"
              role="alert"
              style={{ color: "#ff9db0", marginBottom: 12 }}
            >
              <AlertTriangle size={14} aria-hidden="true" /> {error}
            </div>
          )}

          <button type="submit" className="mt-cta fb-submit" disabled={busy}>
            {busy ? "Looking it up…" : "Find my booking"}
          </button>
        </form>
      )}

      <p className="fb-alt">
        Have a Skyrio account? <Link to="/saved-trips">Go to My trips</Link> to
        see and cancel all your bookings in one place.
      </p>
    </div>
  );
}
