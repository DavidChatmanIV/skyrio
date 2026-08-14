import { useState, useRef, useEffect } from "react";
import dayjs from "dayjs";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Check,
  Hotel as HotelIcon,
  AlertTriangle,
  Star,
  Medal,
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// ─────────────────────────────────────────────
// Shared palette + CSS — identical to BookingCheckout.jsx
// so hotel checkout feels like the same product, not a
// bolted-on second flow.
// ─────────────────────────────────────────────
const G = {
  bg: "#0d0b1a",
  bgCard: "rgba(255,255,255,0.04)",
  bgCardHover: "rgba(255,255,255,0.07)",
  bgInput: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  purple: "#7c3aed",
  purpleLight: "#a78bfa",
  orange: "#f97316",
  orangeGlow: "rgba(249,115,22,0.35)",
  faint: "rgba(255,255,255,0.25)",
  muted: "rgba(255,255,255,0.5)",
  white: "#ffffff",
  danger: "#f87171",
  success: "#34d399",
  gradBtn: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
};

const css = `
  .skc * { box-sizing: border-box; margin: 0; padding: 0; }
  .skc { font-family: inherit; color: #fff; min-height: 100vh; position: relative; }

  .skc-input {
    width: 100%; padding: 13px 16px; border-radius: 12px;
    background: ${G.bgInput}; border: 1px solid ${G.border};
    color: #fff; font-size: 16px; font-family: inherit;
    transition: border-color .2s, box-shadow .2s; outline: none;
    min-height: 48px; touch-action: manipulation; caret-color: #ff8a2a;
  }
  .skc-input:focus { border-color: var(--cta, ${G.orange}); box-shadow: 0 0 0 3px var(--cta-glow, ${G.orangeGlow}); }
  .skc-input::placeholder { color: ${G.muted}; }

  .skc-input:-webkit-autofill,
  .skc-input:-webkit-autofill:hover,
  .skc-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 30px #100c22 inset !important;
    -webkit-text-fill-color: #fff !important;
    border-color: var(--cta, ${G.orange}) !important;
    caret-color: #fff;
  }

  .skc-label { display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: ${G.faint}; letter-spacing: .05em; text-transform: uppercase; font-weight: 600; font-family: inherit; }

  .skc-btn-primary {
    width: 100%; padding: 17px; border-radius: 14px; border: none;
    background: ${G.gradBtn}; color: white; font-size: 16px; font-weight: 700;
    font-family: inherit; cursor: pointer; min-height: 52px;
    touch-action: manipulation;
    transition: opacity .2s, transform .15s, box-shadow .2s;
    box-shadow: 0 8px 30px var(--cta-glow, ${G.orangeGlow});
  }
  .skc-btn-primary:hover { opacity: .92; transform: translateY(-1px); box-shadow: 0 12px 40px rgba(255,138,42,.45); }
  .skc-btn-primary:active { transform: translateY(0); }
  .skc-btn-primary:disabled { opacity: .38; cursor: not-allowed; transform: none; box-shadow: none; }

  .skc-btn-back {
    background: none; border: 1px solid ${G.border}; color: ${G.muted};
    padding: 13px 20px; border-radius: 12px; cursor: pointer; font-size: 14px;
    font-family: inherit; transition: border-color .2s, color .2s; white-space: nowrap;
    min-height: 52px; touch-action: manipulation;
  }
  .skc-btn-back:hover { border-color: ${G.faint}; color: #fff; }

  .skc-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: skc-spin .7s linear infinite; display: inline-block; }
  @keyframes skc-spin { to { transform: rotate(360deg); } }

  .skc-fade { animation: skc-fadeUp .35s ease both; }
  @keyframes skc-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  .skc-pop { animation: skc-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes skc-pop { from { opacity:0; transform:scale(.88); } to { opacity:1; transform:scale(1); } }

  .skc-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .skc-bg__img {
    position: absolute; inset: 0;
    background-image: url('/src/assets/BookingCheckout/skyrio-checkout-bg.png');
    background-size: cover; background-position: center 30%; opacity: 0.35;
  }
  .skc-bg__fade {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, #0b0b18 0%, rgba(11,11,24,0.40) 20%, rgba(11,11,24,0.10) 45%, rgba(11,11,24,0.50) 75%, #0b0b18 100%);
  }
  .skc-bg__vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 85% 100% at 50% 40%, transparent 30%, #0b0b18 100%);
  }

  .skc-step-layout { display: flex; gap: 28px; align-items: flex-start; }
  .skc-step-form { flex: 1; min-width: 0; }
  .skc-step-sidebar { width: 252px; flex-shrink: 0; }
  .skc-name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .skc-btn-row { display: flex; gap: 12px; }

  @media (max-width: 768px) {
    .skc-step-layout { flex-direction: column; gap: 0; }
    .skc-step-sidebar { width: 100% !important; order: 1; }
    .skc-step-form { order: 2; }
    .skc-sidebar-full { display: none; }
    .skc-sidebar-compact { display: flex !important; }
    .skc-name-grid { gap: 10px; }
    .skc-btn-row { flex-direction: column; }
    .skc-btn-back { width: 100%; text-align: center; }
  }

  @media (max-width: 400px) {
    .skc-name-grid { grid-template-columns: 1fr; }
  }
`;

function useVhFix() {
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);
}

const API = import.meta.env?.VITE_API_URL || "";

// ─────────────────────────────────────────────
// Normalize the hotel offer coming from BookingPage's
// StaysForm search results into what this checkout needs.
//
// NOTE: BookingPage's current hotel result objects don't
// carry checkin/checkout — only pricing + room info. Pass
// those two fields through when you call setSelectedHotelOffer
// in BookingPage (grab them from StaysForm's date state), or
// this will show "Dates TBD".
// ─────────────────────────────────────────────
function buildHotelBooking(hotel) {
  if (!hotel) return null;
  return {
    hotelId: hotel.hotelId,
    offerId: hotel.offerId,
    name: hotel.name || "Hotel",
    address: hotel.address || "",
    stars: hotel.stars ?? null,
    rating: hotel.rating ?? null,
    thumbnail: hotel.thumbnail || null,
    roomName: hotel.roomName || "Standard Room",
    boardName: hotel.boardName || "Room only",
    refundableTag: hotel.refundableTag ?? null,
    basePrice: Number.isFinite(hotel.totalAmount)
      ? hotel.totalAmount
      : parseFloat(hotel.totalAmount) || 0,
    currency: hotel.totalCurrency || "USD",
    checkin: hotel.checkin || null,
    checkout: hotel.checkout || null,
  };
}

// ── Inline SVG icons — matches BookingCheckout's style ──
function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function InfoIconSvg() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

// Generic card glyph rather than an attempted redraw of Stripe's
// actual "S" logomark, since that's a trademarked brand asset.
function StripeMarkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

function CancellationBadge({ refundableTag }) {
  if (refundableTag === "RFN") {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "rgba(52,211,153,.07)",
          border: "1px solid rgba(52,211,153,.2)",
          borderRadius: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span style={{ color: G.success, marginTop: 1 }}>
          <CalendarCheckIcon />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.success }}>
            Free cancellation
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            This rate can be cancelled — exact deadline confirmed at prebook.
          </div>
        </div>
      </div>
    );
  }
  if (refundableTag === "NRFN") {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "rgba(249,115,22,.06)",
          border: "1px solid rgba(249,115,22,.2)",
          borderRadius: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span style={{ color: G.orange, marginTop: 1 }}>
          <InfoIconSvg />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.orange }}>
            Non-refundable rate
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            This rate can't be cancelled or changed once booked.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 16,
        padding: "12px 14px",
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${G.border}`,
        borderRadius: 10,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: G.muted, marginTop: 1 }}>
        <InfoIconSvg />
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: G.faint }}>
          Cancellation terms
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          Terms will be confirmed at prebook.
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step }) {
  const steps = ["Guest Details", "Review & Pay"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 32,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: 4,
      }}
    >
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            display: "flex",
            alignItems: "center",
            flex: i < steps.length - 1 ? 1 : "none",
            minWidth: 90,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
                background: i < step ? G.gradBtn : "transparent",
                border:
                  i < step
                    ? "none"
                    : i === step
                    ? `2px solid ${G.orange}`
                    : `2px solid ${G.border}`,
                color: i < step ? "#fff" : i === step ? G.orange : G.muted,
                boxShadow: i === step ? `0 0 24px ${G.orangeGlow}` : "none",
                transition: "all .3s",
                minWidth: 44,
                minHeight: 44,
                flexShrink: 0,
              }}
            >
              {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
            </div>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".04em",
                whiteSpace: "nowrap",
                textTransform: "uppercase",
                fontWeight: 500,
                color: i === step ? G.orange : i < step ? G.faint : G.muted,
              }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                minWidth: 16,
                height: 1,
                background: i < step ? G.orange : G.border,
                margin: "0 8px",
                marginBottom: 22,
                transition: "background .4s",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function HotelCard({ hotel }) {
  if (!hotel) return null;
  return (
    <div
      style={{
        background: G.bgCard,
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: hotel.thumbnail
            ? `url(${hotel.thumbnail}) center/cover`
            : "rgba(124,58,237,.18)",
          border: "1px solid rgba(124,58,237,.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: G.purpleLight,
          flexShrink: 0,
        }}
      >
        {!hotel.thumbnail && <HotelIcon size={22} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "inherit", fontWeight: 700, fontSize: 15 }}>
          {hotel.name}
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          {hotel.roomName} · {hotel.boardName}
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          {hotel.checkin && hotel.checkout
            ? `${dayjs(hotel.checkin).format("MMM D")} → ${dayjs(
                hotel.checkout
              ).format("MMM D, YYYY")}`
            : "Dates TBD"}
        </div>
      </div>
      {hotel.stars && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            color: G.orange,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          <Star size={13} fill={G.orange} stroke="none" />
          {hotel.stars}
        </div>
      )}
    </div>
  );
}

function PriceSummary({ base, currency = "USD" }) {
  return (
    <div
      style={{
        background: "rgba(249,115,22,.06)",
        border: "1px solid rgba(249,115,22,.2)",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--cta, #ff8a2a)",
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Price Summary
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 14,
          color: G.faint,
          marginBottom: 8,
        }}
      >
        <span>Room total</span>
        <span>${base.toFixed(2)}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: `1px solid rgba(255,255,255,.08)`,
          paddingTop: 10,
          marginTop: 4,
          fontFamily: "inherit",
          fontWeight: 800,
          fontSize: 17,
        }}
      >
        <span>Total</span>
        <span style={{ color: "var(--cta, #ff8a2a)" }}>
          ${base.toFixed(2)} {currency}
        </span>
      </div>
    </div>
  );
}

function TripSidebar({ hotel }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,.03)",
        border: `1px solid ${G.border}`,
        borderRadius: 18,
        padding: 20,
        position: "sticky",
        top: 24,
      }}
    >
      <div
        className="skc-sidebar-compact"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: G.faint, marginBottom: 2 }}>
            YOUR STAY
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{hotel.name}</div>
          <div style={{ fontSize: 12, color: G.muted }}>
            {hotel.checkin ? dayjs(hotel.checkin).format("MMM D") : "Dates TBD"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: G.faint, marginBottom: 2 }}>
            Total
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 20,
              color: "var(--cta, #ff8a2a)",
            }}
          >
            ${hotel.basePrice.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="skc-sidebar-full">
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: G.faint,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Your stay
        </div>
        <div
          style={{
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          {hotel.name}
        </div>
        <div style={{ fontSize: 12, color: G.muted }}>{hotel.address}</div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>
          {hotel.checkin && hotel.checkout
            ? `${dayjs(hotel.checkin).format("MMM D")} → ${dayjs(
                hotel.checkout
              ).format("MMM D, YYYY")}`
            : "Dates TBD"}
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginBottom: 12 }}>
          {hotel.roomName} · {hotel.boardName}
        </div>
        <div
          style={{
            borderTop: `1px solid ${G.border}`,
            paddingTop: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, color: G.faint, marginBottom: 4 }}>
            Guests
          </div>
          <div style={{ fontSize: 14 }}>1 Adult</div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "inherit",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span>Total</span>
          <span style={{ color: "var(--cta, #ff8a2a)" }}>
            ${hotel.basePrice.toFixed(2)}
          </span>
        </div>
        <CancellationBadge refundableTag={hotel.refundableTag} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 0 — Guest Details
// ─────────────────────────────────────────────
function StepGuestDetails({ onNext, hotel }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [touched, setTouched] = useState({});
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loyaltyNumber, setLoyaltyNumber] = useState("");
  const firstRef = useRef();
  const lastRef = useRef();
  const emailRef = useRef();
  const phoneRef = useRef();

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const errs = {
    firstName: touched.firstName && !form.firstName ? "Required" : null,
    lastName: touched.lastName && !form.lastName ? "Required" : null,
    email: touched.email && !emailOk(form.email) ? "Enter a valid email" : null,
  };

  const handleContinue = () => {
    const live = {
      firstName: firstRef.current?.value || form.firstName,
      lastName: lastRef.current?.value || form.lastName,
      email: emailRef.current?.value || form.email,
      phone: phoneRef.current?.value || form.phone,
      loyaltyNumber,
    };
    setForm(live);
    setTouched({ firstName: true, lastName: true, email: true });
    if (!live.firstName || !live.lastName || !emailOk(live.email)) return;
    onNext(live);
  };

  return (
    <div className="skc-fade">
      <div className="skc-step-layout">
        <div className="skc-step-form">
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            Guest details
          </h2>
          <p style={{ color: G.muted, fontSize: 14, marginBottom: 24 }}>
            The name on the reservation should match your government-issued ID.
          </p>
          <div className="skc-name-grid">
            {[
              {
                k: "firstName",
                label: "First name",
                ref: firstRef,
                auto: "given-name",
                ph: "First name",
              },
              {
                k: "lastName",
                label: "Last name",
                ref: lastRef,
                auto: "family-name",
                ph: "Last name",
              },
            ].map(({ k, label, ref, auto, ph }) => (
              <label key={k} className="skc-label">
                {label} <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
                <input
                  ref={ref}
                  className="skc-input"
                  value={form[k]}
                  onChange={set(k)}
                  onBlur={blur(k)}
                  placeholder={ph}
                  autoComplete={auto}
                />
                {errs[k] && (
                  <span
                    style={{
                      color: G.danger,
                      fontSize: 12,
                      marginTop: 2,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    {errs[k]}
                  </span>
                )}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="skc-label">
              Email <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
              <input
                ref={emailRef}
                className="skc-input"
                type="email"
                value={form.email}
                onChange={set("email")}
                onBlur={blur("email")}
                placeholder="you@email.com"
                autoComplete="email"
              />
              {errs.email && (
                <span
                  style={{
                    color: G.danger,
                    fontSize: 12,
                    marginTop: 2,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  {errs.email}
                </span>
              )}
            </label>
            <label className="skc-label">
              Phone number
              <input
                ref={phoneRef}
                className="skc-input"
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowLoyalty((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${G.border}`,
                background: G.bgCard,
                color: G.faint,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 52,
                touchAction: "manipulation",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Medal size={15} />
                Add hotel loyalty number{" "}
                <span style={{ opacity: 0.6 }}>(optional)</span>
              </span>
              <span
                style={{
                  transition: ".2s",
                  display: "inline-block",
                  transform: showLoyalty ? "rotate(180deg)" : "none",
                }}
              >
                ▾
              </span>
            </button>
            {showLoyalty && (
              <input
                className="skc-input"
                value={loyaltyNumber}
                onChange={(e) => setLoyaltyNumber(e.target.value)}
                placeholder="Loyalty / rewards number"
              />
            )}
          </div>
          <button
            type="button"
            className="skc-btn-primary"
            style={{ marginTop: 28 }}
            onClick={handleContinue}
          >
            Continue to Review & Pay →
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: G.muted,
              fontSize: 12,
              justifyContent: "center",
              marginTop: 12,
            }}
          >
            <LockIcon />
            <span>Your information is secure and encrypted</span>
          </div>
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar hotel={hotel} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1a — HotelStripePayForm
//
// Lives inside <Elements>. Confirms the Stripe payment, then
// calls /api/hotels/confirm-booking to complete the LiteAPI
// booking. This mirrors StripePayForm from BookingCheckout.jsx.
// ─────────────────────────────────────────────
function HotelStripePayForm({
  onBack,
  guest,
  hotel,
  prebookId,
  total,
  loading,
  setLoading,
  error,
  setError,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);

  const handleBook = async () => {
    if (!stripe || !elements || !agreed) return;
    setLoading(true);
    setError("");
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment(
        {
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/booking-confirmed`,
            receipt_email: guest.email,
          },
          redirect: "if_required",
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      switch (paymentIntent?.status) {
        case "succeeded":
          break;
        case "processing":
          setError(
            "Your payment is still processing. This can take a moment — please don't refresh or submit again. We'll email your confirmation once it clears."
          );
          setLoading(false);
          return;
        case "requires_action":
          setError(
            "Your bank requires additional verification to complete this payment. Please try again."
          );
          setLoading(false);
          return;
        case "requires_payment_method":
          setError(
            "That payment method couldn't be used. Please check your card details or try a different payment method."
          );
          setLoading(false);
          return;
        default:
          setError(
            "We couldn't confirm your payment status. Please check your email for a confirmation, or contact support before trying again."
          );
          setLoading(false);
          return;
      }

      // ── Payment succeeded — now confirm the actual room booking ──
      const confirmRes = await fetch(`${API}/api/hotels/confirm-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          prebookId,
          holder: {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: guest.phone || "",
          },
          guests: [
            {
              occupancyNumber: 1,
              firstName: guest.firstName,
              lastName: guest.lastName,
              email: guest.email,
            },
          ],
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.ok) {
        // Payment succeeded but the room booking itself failed —
        // this needs a human, not a silent retry, since the guest
        // has already been charged.
        setError(
          `Payment succeeded, but we couldn't finalize the room booking: ${
            confirmData.message || "unknown error"
          }. Please contact support with this reference: ${paymentIntent.id}`
        );
        setLoading(false);
        return;
      }

      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        className="skc-pop"
        style={{ textAlign: "center", padding: "60px 20px" }}
      >
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HotelIcon size={36} color="#1b1024" />
          </div>
        </div>
        <h2
          style={{
            fontFamily: "inherit",
            fontWeight: 800,
            fontSize: 28,
            marginBottom: 8,
          }}
        >
          You're booked!
        </h2>
        <p style={{ color: G.muted, fontSize: 15, marginBottom: 28 }}>
          Confirmation sent to{" "}
          <strong style={{ color: "#fff" }}>{guest.email}</strong>
        </p>
        <div
          style={{
            background: G.bgCard,
            border: `1px solid ${G.border}`,
            borderRadius: 16,
            padding: 24,
            maxWidth: 380,
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <div style={{ marginBottom: 8 }}>{hotel.name}</div>
          <div style={{ marginBottom: 8, fontSize: 13, color: G.muted }}>
            {hotel.checkin && hotel.checkout
              ? `${dayjs(hotel.checkin).format("MMM D")} → ${dayjs(
                  hotel.checkout
                ).format("MMM D, YYYY")}`
              : "Dates TBD"}
          </div>
          <div
            style={{
              borderTop: `1px solid ${G.border}`,
              paddingTop: 12,
              marginTop: 8,
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 20,
              color: "var(--cta, #ff8a2a)",
            }}
          >
            Total: ${total.toFixed(2)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: G.faint,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          Payment
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${G.border}`,
            borderRadius: 14,
            padding: "20px 16px",
          }}
        >
          <PaymentElement
            options={{
              layout: "tabs",
              paymentMethodOrder: ["card", "apple_pay", "google_pay"],
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: G.muted,
            fontSize: 12,
            marginTop: 10,
          }}
        >
          <StripeMarkIcon />
          <span>Payments securely processed by Stripe</span>
        </div>
      </section>

      {error && (
        <div
          style={{
            background: "rgba(248,113,113,.1)",
            border: "1px solid rgba(248,113,113,.3)",
            borderRadius: 10,
            padding: "12px 16px",
            color: G.danger,
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAgreed((v) => !v)}
        role="checkbox"
        aria-checked={agreed}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${agreed ? G.orange : G.border}`,
          background: agreed ? "rgba(249,115,22,.08)" : G.bgCard,
          cursor: "pointer",
          marginBottom: 20,
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 14,
          transition: ".2s",
          minHeight: 52,
          touchAction: "manipulation",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${agreed ? G.orange : G.faint}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: agreed ? G.orange : "transparent",
            color: "white",
            flexShrink: 0,
            transition: ".2s",
          }}
        >
          {agreed && <Check size={11} strokeWidth={3} />}
        </div>
        <span>
          I agree to the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
          >
            rate rules
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
          >
            privacy policy
          </a>
          .
        </span>
      </button>

      <div className="skc-btn-row">
        <button
          type="button"
          className="skc-btn-back"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>
        <button
          type="button"
          className="skc-btn-primary"
          style={{
            flex: 1,
            opacity: agreed && stripe ? 1 : 0.4,
            cursor: agreed && stripe ? "pointer" : "not-allowed",
          }}
          onClick={handleBook}
          disabled={!agreed || loading || !stripe}
        >
          {loading ? (
            <span className="skc-spinner" />
          ) : (
            `Book · $${total.toFixed(2)}`
          )}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: G.muted,
          fontSize: 12,
          justifyContent: "center",
          marginTop: 14,
        }}
      >
        <LockIcon />
        <span>Your information is secure and encrypted</span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Step 1 — Review & Pay
//
// On mount: calls /api/hotels/checkout-intent, which prebooks
// with LiteAPI AND creates a Stripe PaymentIntent in one call.
// Once we have a clientSecret, renders <Elements> wrapping
// HotelStripePayForm — same pattern as StepReviewPay in
// BookingCheckout.jsx.
// ─────────────────────────────────────────────
function StepReviewPay({ onBack, guest, hotel }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [prebookId, setPrebookId] = useState(null);
  const [total, setTotal] = useState(hotel.basePrice);
  const [initLoading, setInitLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setInitLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/api/hotels/checkout-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: hotel.offerId,
            guestEmail: guest.email,
            hotelName: hotel.name,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok)
          throw new Error(
            data.message ||
              "Couldn't prepare this booking — the rate may have expired. Please go back and try again."
          );
        setClientSecret(data.clientSecret);
        setPrebookId(data.prebookId);
        setTotal(data.totalPrice);
      } catch (err) {
        setError(err.message || "Could not initialize payment.");
      }
      setInitLoading(false);
    })();
  }, [hotel.offerId]); // eslint-disable-line

  const stripeAppearance = {
    theme: "night",
    variables: {
      colorPrimary: "#f97316",
      colorBackground: "#100c22",
      colorText: "#ffffff",
      colorTextSecondary: "rgba(255,255,255,0.5)",
      colorDanger: "#f87171",
      borderRadius: "10px",
      fontFamily: "inherit",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        border: "1px solid rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.06)",
      },
      ".Input:focus": {
        border: "1px solid #f97316",
        boxShadow: "0 0 0 3px rgba(249,115,22,0.35)",
      },
      ".Label": {
        color: "rgba(255,255,255,0.5)",
        fontSize: "12px",
        fontWeight: "600",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      },
      ".Tab": {
        border: "1px solid rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.04)",
      },
      ".Tab:hover": { backgroundColor: "rgba(255,255,255,0.07)" },
      ".Tab--selected": {
        border: "1px solid #f97316",
        backgroundColor: "rgba(249,115,22,0.08)",
      },
    },
  };

  return (
    <div className="skc-fade">
      <div className="skc-step-layout">
        <div className="skc-step-form">
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 24,
            }}
          >
            Review &amp; Pay
          </h2>
          <section style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: G.faint,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              Stay recap
            </div>
            <HotelCard hotel={hotel} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: `1px solid ${G.border}`,
                fontSize: 14,
              }}
            >
              <span style={{ color: G.muted }}>Guest</span>
              <span>
                {guest.firstName} {guest.lastName}
              </span>
            </div>
          </section>

          <PriceSummary base={total} currency={hotel.currency} />

          {initLoading && (
            <div
              style={{ textAlign: "center", padding: "40px 0", color: G.muted }}
            >
              <span
                className="skc-spinner"
                style={{ width: 28, height: 28, borderWidth: 3 }}
              />
              <div style={{ marginTop: 14, fontSize: 13 }}>
                Setting up secure payment...
              </div>
            </div>
          )}

          {!initLoading && error && !clientSecret && (
            <div
              style={{
                background: "rgba(248,113,113,.1)",
                border: "1px solid rgba(248,113,113,.3)",
                borderRadius: 10,
                padding: "12px 16px",
                color: G.danger,
                fontSize: 13,
                marginBottom: 16,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <AlertTriangle
                size={14}
                style={{ marginTop: 1, flexShrink: 0 }}
              />
              <div>
                {error}
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="skc-btn-back"
                    style={{ fontSize: 12, padding: "8px 14px" }}
                    onClick={onBack}
                  >
                    ← Go back
                  </button>
                </div>
              </div>
            </div>
          )}

          {!initLoading && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <HotelStripePayForm
                onBack={onBack}
                guest={guest}
                hotel={hotel}
                prebookId={prebookId}
                total={total}
                loading={payLoading}
                setLoading={setPayLoading}
                error={error}
                setError={setError}
              />
            </Elements>
          )}
        </div>
        <div className="skc-step-sidebar">
          <TripSidebar hotel={hotel} />
        </div>
      </div>
    </div>
  );
}

export default function HotelCheckout({ hotel, onBack }) {
  const liveHotel = buildHotelBooking(hotel);
  const [step, setStep] = useState(0);
  const [guest, setGuest] = useState(null);

  useVhFix();

  if (!liveHotel) return null;

  return (
    <div
      className="skc"
      style={{ position: "relative", minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <style>{css}</style>
      <div className="skc-bg">
        <div className="skc-bg__img" />
        <div className="skc-bg__fade" />
        <div className="skc-bg__vignette" />
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 20px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "22px 0 26px",
            borderBottom: `1px solid ${G.border}`,
            marginBottom: 32,
          }}
        >
          {onBack && (
            <>
              <button
                type="button"
                onClick={onBack}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: "var(--cta, #ff8a2a)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "inherit",
                  padding: 0,
                  minHeight: 44,
                  touchAction: "manipulation",
                }}
              >
                ← Back to results
              </button>
              <div style={{ width: 1, height: 18, background: G.border }} />
            </>
          )}
          <span
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 21,
              color: "#fff",
            }}
          >
            Booking
          </span>
          <span
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 21,
              color: "var(--cta, #ff8a2a)",
            }}
          >
            Checkout
          </span>
        </div>

        <ProgressBar step={step} />

        {step === 0 && <HotelCard hotel={liveHotel} />}
        {step === 0 && (
          <StepGuestDetails
            onNext={(g) => {
              setGuest(g);
              setStep(1);
            }}
            hotel={liveHotel}
          />
        )}
        {step === 1 && (
          <StepReviewPay
            onBack={() => setStep(0)}
            guest={guest}
            hotel={liveHotel}
          />
        )}
      </div>
    </div>
  );
}
