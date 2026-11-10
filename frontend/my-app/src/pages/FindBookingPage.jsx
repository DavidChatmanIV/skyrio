// ─────────────────────────────────────────────────────────────
// Find my booking — /find-booking
//
// For anyone who booked as a guest (no account) or lost their email.
// Email + confirmation code (airline/hotel code or Skyrio booking ID) opens
// the booking right here, where it can be viewed or cancelled. A "Manage or
// cancel" link is also emailed so they can come back later.
//
// Look: boarding-pass ticket (matches the Book page) — main panel holds the
// form, a perforated tear-off stub on the right (bottom on mobile).
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
  ShieldCheck,
  LifeBuoy,
  ChevronRight,
  Search,
} from "lucide-react";
import { MT_CSS } from "./SavedTripsPage";

const API = import.meta.env.VITE_API_URL || "";

const PAGE_CSS = `
.fb-wrap { max-width: 820px; margin: 0 auto; }

/* ── Header ── */
.fb-kicker { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #ff8a2a;
  background: rgba(255,138,42,.12); border: 1px solid rgba(255,138,42,.35); }
.fb-title { margin: 14px 0 8px; font-size: clamp(28px, 4.4vw, 40px); font-weight: 800; line-height: 1.1;
  background: linear-gradient(90deg, #fff 0%, #ffd2ad 55%, #ff8a2a 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.fb-sub { margin: 0; max-width: 560px; font-size: 15px; line-height: 1.6; color: rgba(244,239,255,.72); }

/* ── Ticket ── */
.fb-ticket { position: relative; display: grid; grid-template-columns: 1fr 190px; margin-top: 26px;
  border-radius: 22px; background: rgba(18,10,38,.62); border: 1px solid rgba(255,255,255,.12);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 18px 50px rgba(0,0,0,.4); overflow: hidden; }
.fb-ticket::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
  background: linear-gradient(90deg, #ff8a2a, #ff5e3a 45%, #9b5cff); }

.fb-main { padding: 26px 26px 24px; }
.fb-route { display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
  font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: rgba(244,239,255,.55); }
.fb-route-line { flex: 1; height: 0; border-top: 1px dashed rgba(255,255,255,.22); }
.fb-route svg { color: #ff8a2a; }

.fb-label { display: block; margin: 0 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(244,239,255,.6); }
.fb-field { position: relative; margin-bottom: 16px; }
.fb-field > svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #ff8a2a; opacity: .85; }
.fb-input { width: 100%; box-sizing: border-box; min-height: 50px; padding: 0 14px 0 42px; border-radius: 14px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); color: #fff; font: inherit; font-size: 15px;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
.fb-input::placeholder { color: rgba(244,239,255,.38); }
.fb-input:focus { outline: none; background: rgba(255,255,255,.08); border-color: #ff8a2a; box-shadow: 0 0 0 3px rgba(255,138,42,.22); }
.fb-input--code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 17px; font-weight: 700;
  letter-spacing: .22em; text-transform: uppercase; }
.fb-input--code::placeholder { letter-spacing: .12em; font-weight: 500; text-transform: none; }
.fb-hint { margin: -8px 0 18px; font-size: 12.5px; color: rgba(244,239,255,.55); line-height: 1.5; }

.fb-error { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 10px 12px; border-radius: 12px;
  font-size: 13.5px; color: #ffb3c1; background: rgba(255,90,120,.1); border: 1px solid rgba(255,90,120,.3); }

.fb-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 52px;
  border: 0; border-radius: 999px; cursor: pointer; font: inherit; font-size: 16px; font-weight: 800; color: #1a0d05;
  background: linear-gradient(135deg, #ff8a2a, #ffb347); box-shadow: 0 8px 24px rgba(255,138,42,.35);
  transition: transform .15s ease, box-shadow .15s ease; }
.fb-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(255,138,42,.45); }
.fb-submit:disabled { opacity: .6; cursor: default; }

/* ── Stub (tear-off) ── */
.fb-stub { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
  padding: 26px 20px; border-left: 2px dashed rgba(255,255,255,.18);
  background: linear-gradient(180deg, rgba(255,138,42,.08), rgba(155,92,255,.1)); }
/* punched notches where the perforation meets the edges */
.fb-stub::before, .fb-stub::after { content: ""; position: absolute; left: -12px; width: 22px; height: 22px;
  border-radius: 50%; background: #2a1748; }
.fb-stub::before { top: -11px; }
.fb-stub::after { bottom: -11px; }
.fb-stub-label { font-size: 10px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: rgba(244,239,255,.5); }
.fb-stub-value { margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20px;
  font-weight: 800; letter-spacing: .14em; color: #fff; word-break: break-all; min-height: 26px; }
.fb-stub-value--empty { color: rgba(244,239,255,.28); }
.fb-barcode { height: 54px; border-radius: 6px; opacity: .85;
  background: repeating-linear-gradient(90deg,
    #f4efff 0 2px, transparent 2px 4px, #f4efff 4px 5px, transparent 5px 8px,
    #f4efff 8px 11px, transparent 11px 13px, #f4efff 13px 14px, transparent 14px 17px); }
.fb-stub-brand { font-size: 12px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: #ff8a2a; }

/* ── Result state ── */
.fb-done { display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; line-height: 1.6; color: rgba(244,239,255,.85); }
.fb-done > svg { color: #6ee7a8; flex-shrink: 0; margin-top: 2px; }
.fb-done b { color: #fff; }
.fb-pick { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 10px; padding: 14px 16px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: #fff; font: inherit; font-size: 14px;
  font-weight: 700; text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
.fb-pick:hover { border-color: #ff8a2a; background: rgba(255,138,42,.08); }
.fb-pick > svg:first-child { color: #ffb347; flex-shrink: 0; }
.fb-pick span { flex: 1; }
.fb-pick > svg:last-child { color: rgba(244,239,255,.45); }
.fb-again { margin-top: 14px; padding: 0; border: 0; background: none; cursor: pointer; font: inherit; font-size: 13.5px;
  font-weight: 700; color: #ffb347; }
.fb-again:hover { text-decoration: underline; }

/* ── Help row ── */
.fb-help { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin-top: 18px; }
.fb-help a { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: 16px; text-decoration: none;
  background: rgba(18,10,38,.5); border: 1px solid rgba(255,255,255,.1); color: rgba(244,239,255,.85);
  font-size: 13.5px; font-weight: 700; line-height: 1.35; transition: border-color .15s ease; }
.fb-help a:hover { border-color: rgba(255,138,42,.6); }
.fb-help a svg { color: #ff8a2a; flex-shrink: 0; }
.fb-help small { display: block; font-weight: 500; font-size: 12px; color: rgba(244,239,255,.5); }

/* ── Mobile ── */
@media (max-width: 720px) {
  .fb-ticket { grid-template-columns: 1fr; }
  .fb-main { padding: 22px 18px 20px; }
  .fb-stub { flex-direction: row; align-items: center; border-left: 0; border-top: 2px dashed rgba(255,255,255,.18);
    padding: 18px; }
  .fb-stub::before, .fb-stub::after { top: -12px; left: auto; bottom: auto; }
  .fb-stub::before { left: -11px; }
  .fb-stub::after { right: -11px; }
  .fb-barcode { width: 90px; height: 40px; flex-shrink: 0; }
  .fb-stub-brand { display: none; }
  .fb-help { grid-template-columns: 1fr; }
}
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

  const shownCode = code.trim().toUpperCase();

  return (
    <div className="mt fb-wrap">
      <style>{MT_CSS + PAGE_CSS}</style>

      <span className="fb-kicker">
        <Search size={13} aria-hidden="true" /> Manage booking
      </span>
      <h1 className="fb-title">Find my booking</h1>
      <p className="fb-sub">
        View or cancel a flight or hotel, with or without a Skyrio account.
        Enter your email and confirmation code to open your booking.
      </p>

      <div className="fb-ticket">
        <div className="fb-main">
          <div className="fb-route" aria-hidden="true">
            <span>Lookup</span>
            <span className="fb-route-line" />
            <Plane size={14} />
            <span className="fb-route-line" />
            <span>Your trip</span>
          </div>

          {sentMessage ? (
            <div className="fb-done" role="status">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div style={{ flex: 1 }}>
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
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <b>Check your email.</b> {sentMessage}
                  </>
                )}
                <div>
                  <button
                    type="button"
                    className="fb-again"
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
            <form onSubmit={submit} noValidate>
              <label className="fb-label" htmlFor="fb-email">
                Email you booked with
              </label>
              <div className="fb-field">
                <Mail size={17} aria-hidden="true" />
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
                <Hash size={17} aria-hidden="true" />
                <input
                  id="fb-code"
                  className="fb-input fb-input--code"
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
                It&apos;s in your booking confirmation email: the airline or
                hotel confirmation code, or your Skyrio booking ID.
              </p>

              {error && (
                <div className="fb-error" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" /> {error}
                </div>
              )}

              <button type="submit" className="fb-submit" disabled={busy}>
                {busy ? (
                  "Looking it up…"
                ) : (
                  <>
                    Find my booking{" "}
                    <ChevronRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Tear-off stub — mirrors the code as it's typed */}
        <aside className="fb-stub" aria-hidden="true">
          <div>
            <div className="fb-stub-label">Confirmation</div>
            <div
              className={`fb-stub-value ${
                shownCode ? "" : "fb-stub-value--empty"
              }`}
            >
              {shownCode || "––––––"}
            </div>
          </div>
          <div className="fb-barcode" />
          <div className="fb-stub-brand">Skyrio</div>
        </aside>
      </div>

      <nav className="fb-help" aria-label="More help">
        <Link to="/saved-trips">
          <Plane size={18} aria-hidden="true" />
          <span>
            My Trips
            <small>Have an account? See every booking.</small>
          </span>
        </Link>
        <Link to="/guarantee">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            Booking Guarantee
            <small>What we cover if something goes wrong.</small>
          </span>
        </Link>
        <Link to="/support">
          <LifeBuoy size={18} aria-hidden="true" />
          <span>
            Support
            <small>Talk to a real person.</small>
          </span>
        </Link>
      </nav>
    </div>
  );
}
