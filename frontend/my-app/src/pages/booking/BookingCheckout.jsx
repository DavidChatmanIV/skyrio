import { useState, useRef } from "react";
import dayjs from "dayjs";

// ─── Design tokens ─────────────────────────────────────────────────────────────
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
  /* Uses global font + CSS variables from your app — no extra imports */
  .skc * { box-sizing: border-box; margin: 0; padding: 0; }
  .skc { font-family: inherit; color: #fff; min-height: 100vh; position: relative; }

  .skc-input {
    width: 100%; padding: 13px 16px; border-radius: 12px;
    background: ${G.bgInput}; border: 1px solid ${G.border};
    color: #fff; font-size: 15px; font-family: inherit;
    transition: border-color .2s, box-shadow .2s; outline: none;
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
    font-family: inherit; cursor: pointer;
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
  }
  .skc-btn-back:hover { border-color: ${G.faint}; color: #fff; }

  .skc-opt {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-radius: 12px; border: 1px solid ${G.border};
    background: ${G.bgCard}; cursor: pointer; text-align: left; color: #fff;
    transition: border-color .2s, background .2s; margin-bottom: 8px;
    font-family: inherit;
  }
  .skc-opt:hover { border-color: rgba(255,138,42,.4); background: ${G.bgCardHover}; }
  .skc-opt.sel { border-color: var(--cta, ${G.orange}); background: rgba(255,138,42,.08); }
  .skc-opt:last-child { margin-bottom: 0; }

  .skc-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${G.faint}; flex-shrink: 0; transition: border-color .2s; display: flex; align-items: center; justify-content: center; }
  .sel .skc-radio { border-color: var(--cta, ${G.orange}); }
  .sel .skc-radio::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--cta, ${G.orange}); display: block; }

  .skc-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: skc-spin .7s linear infinite; display: inline-block; }
  @keyframes skc-spin { to { transform: rotate(360deg); } }

  .skc-fade { animation: skc-fadeUp .35s ease both; }
  @keyframes skc-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  .skc-pop { animation: skc-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes skc-pop { from { opacity:0; transform:scale(.88); } to { opacity:1; transform:scale(1); } }

  select.skc-input option { background: #100c22; color: white; }

  /* ── Background layers — scoped to component, not fixed ── */
  .skc-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .skc-bg__img {
    position: absolute; inset: 0;
    background-image: url('/src/assets/BookingCheckout/skyrio-checkout-bg.png');
    background-size: cover; background-position: center 30%;
    opacity: 0.35;
  }
  /* Smooth top blend into navbar */
  .skc-bg__fade {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      #0b0b18 0%,
      rgba(11,11,24,0.40) 20%,
      rgba(11,11,24,0.10) 45%,
      rgba(11,11,24,0.50) 75%,
      #0b0b18 100%
    );
  }
  /* Side vignette so image doesn't bleed to edges */
  .skc-bg__vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 85% 100% at 50% 40%, transparent 30%, #0b0b18 100%);
  }
`;

// ─── Mock / data helpers ───────────────────────────────────────────────────────
const MOCK_FLIGHT = {
  outbound: {
    from: "EWR",
    to: "CHS",
    date: "Fri, Jun 5",
    time: "11:36 AM",
    duration: "2h 8m",
    airline: "Spirit Airlines",
  },
  return: {
    from: "CHS",
    to: "EWR",
    date: "Sun, Jun 7",
    time: "2:39 PM",
    duration: "2h 5m",
    airline: "Spirit Airlines",
  },
  basePrice: 268.38,
  stops: 0,
  ownerCode: "",
};

function fmt(start, end) {
  if (!start || !end) return "TBD";
  const m = dayjs(end).diff(dayjs(start), "minute");
  if (!Number.isFinite(m) || m <= 0) return "TBD";
  const h = Math.floor(m / 60),
    mm = m % 60;
  return h && mm ? `${h}h ${mm}m` : h ? `${h}h` : `${mm}m`;
}

function buildFlight(flight) {
  if (!flight) return MOCK_FLIGHT;
  const airline = flight.owner || flight.airline || "Unknown";
  const from = flight.origin || flight.from || "N/A";
  const to = flight.destination || flight.to || "N/A";
  const dep = flight.departingAt || flight.departureTime || null;
  const arr = flight.arrivingAt || flight.arrivalTime || null;
  const rawPrice = parseFloat(flight.totalAmount ?? flight.price);
  return {
    id: flight.id || "",
    raw: flight,
    outbound: {
      from,
      to,
      date: dep ? dayjs(dep).format("ddd, MMM D") : "TBD",
      time: dep ? dayjs(dep).format("h:mm A") : "TBD",
      duration: fmt(dep, arr),
      airline,
    },
    return: {
      from: to,
      to: from,
      date: flight.returningAt
        ? dayjs(flight.returningAt).format("ddd, MMM D")
        : "Return TBD",
      time: flight.returningAt
        ? dayjs(flight.returningAt).format("h:mm A")
        : "--",
      duration: flight.returnArrivingAt
        ? fmt(flight.returningAt, flight.returnArrivingAt)
        : "--",
      airline,
    },
    basePrice: Number.isFinite(rawPrice) ? rawPrice : MOCK_FLIGHT.basePrice,
    currency: flight.totalCurrency || "USD",
    stops: flight.stops ?? 0,
    ownerCode: flight.ownerCode || "",
  };
}

// ─── Options ───────────────────────────────────────────────────────────────────
const SEAT_OPTIONS = [
  {
    id: "none",
    label: "Skip — assign at check-in",
    price: 0,
    desc: "Random seat assigned free",
    icon: "🎲",
  },
  {
    id: "standard",
    label: "Preferred Standard",
    price: 48,
    desc: "Rows 3–5 · Sit up front",
    icon: "💺",
  },
  {
    id: "premium",
    label: "Premium Extra Legroom",
    price: 69,
    desc: "Rows 4–6 · Extra legroom",
    icon: "⭐",
  },
  {
    id: "big",
    label: "Big Front Seat",
    price: 89,
    desc: "Row 1–2 · 11 in. more leg",
    icon: "👑",
  },
];
const BAG_OPTIONS = [
  {
    id: "none",
    label: "Personal item only",
    price: 0,
    desc: "Small backpack — included",
    icon: "🎒",
  },
  {
    id: "carryon",
    label: "Add carry-on bag",
    price: 69,
    desc: "1 carry-on · limit per traveler",
    icon: "💼",
  },
  {
    id: "checked",
    label: "Add checked bag",
    price: 79,
    desc: "Up to 50 lbs / 62 linear in.",
    icon: "🧳",
  },
  {
    id: "both",
    label: "Carry-on + Checked bag",
    price: 138,
    desc: "Full luggage bundle",
    icon: "📦",
  },
];

// ─── Shared atoms ──────────────────────────────────────────────────────────────
function PlaneIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}
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
function ShieldIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ProgressBar({ step }) {
  const steps = ["Passengers", "Seats & Bags", "Review & Pay"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            display: "flex",
            alignItems: "center",
            flex: i < steps.length - 1 ? 1 : "none",
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
                fontSize: 13,
                fontWeight: 700,
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
              }}
            >
              {i < step ? "✓" : i + 1}
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

function FlightLeg({ leg, stops, ownerCode, isReturn }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(124,58,237,.18)",
            border: "1px solid rgba(124,58,237,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: G.purpleLight,
            flexShrink: 0,
          }}
        >
          <PlaneIcon />
        </div>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            <span>{leg.from}</span>
            <span style={{ color: G.muted, fontSize: 11 }}>→</span>
            <span>{leg.to}</span>
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            {isReturn
              ? leg.date
              : `${leg.date} · ${leg.time} · ${leg.duration}`}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: G.faint }}>
          {leg.airline}
          {ownerCode ? ` · ${ownerCode}` : ""}
        </div>
        {!isReturn && typeof stops === "number" && (
          <div style={{ fontSize: 11, color: G.muted }}>
            {stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}
          </div>
        )}
        {isReturn && (
          <div style={{ fontSize: 11, color: G.muted }}>Return TBD</div>
        )}
      </div>
    </div>
  );
}

function FlightCard({ flight }) {
  if (!flight?.outbound) return null;
  return (
    <div
      style={{
        background: G.bgCard,
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        padding: "16px 20px",
        marginBottom: 24,
      }}
    >
      <FlightLeg
        leg={flight.outbound}
        stops={flight.stops}
        ownerCode={flight.ownerCode}
        isReturn={false}
      />
      <div style={{ height: 1, background: G.border, margin: "14px 0" }} />
      <FlightLeg leg={flight.return} isReturn={true} />
    </div>
  );
}

function OptionSelector({ options, selected, onSelect, name }) {
  return (
    <div role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`skc-opt${selected === opt.id ? " sel" : ""}`}
          onClick={() => onSelect(opt.id)}
          role="radio"
          aria-checked={selected === opt.id}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skc-radio" />
            <span style={{ fontSize: 17 }}>{opt.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
                {opt.desc}
              </div>
            </div>
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: opt.price === 0 ? G.success : G.orange,
              flexShrink: 0,
            }}
          >
            {opt.price === 0 ? "Free" : `+$${opt.price}`}
          </div>
        </button>
      ))}
    </div>
  );
}

function PriceSummary({ base, seat, bag, insurance }) {
  const sp = SEAT_OPTIONS.find((o) => o.id === seat)?.price ?? 0;
  const bp = BAG_OPTIONS.find((o) => o.id === bag)?.price ?? 0;
  const ip = insurance ? 28.25 : 0;
  const total = base + sp + bp + ip;
  const lines = [
    { label: "Base fare", amt: base },
    sp > 0 && { label: "Seat upgrade", amt: sp },
    bp > 0 && { label: "Baggage", amt: bp },
    ip > 0 && { label: "Travel protection", amt: ip },
  ].filter(Boolean);
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
      {lines.map((l) => (
        <div
          key={l.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            color: G.faint,
            marginBottom: 8,
          }}
        >
          <span>{l.label}</span>
          <span>${l.amt.toFixed(2)}</span>
        </div>
      ))}
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
          ${total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function TripSidebar({ flight, seat, bag, insurance, basePrice }) {
  const sp = SEAT_OPTIONS.find((o) => o.id === seat)?.price ?? 0;
  const bp = BAG_OPTIONS.find((o) => o.id === bag)?.price ?? 0;
  const ip = insurance ? 28.25 : 0;
  const total = basePrice + sp + bp + ip;
  return (
    <div
      style={{
        background: "rgba(255,255,255,.03)",
        border: `1px solid ${G.border}`,
        borderRadius: 18,
        padding: 22,
        position: "sticky",
        top: 24,
      }}
    >
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
        Your trip
      </div>
      {flight?.outbound && (
        <>
          <div
            style={{
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            {flight.outbound.from} → {flight.outbound.to}
          </div>
          <div style={{ fontSize: 12, color: G.muted }}>
            {flight.outbound.date} · {flight.outbound.time}
          </div>
          <div style={{ fontSize: 12, color: G.muted }}>
            {flight.outbound.duration} ·{" "}
            {flight.stops === 0 ? "Nonstop" : `${flight.stops} stops`}
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginBottom: 12 }}>
            {flight.outbound.airline}
          </div>
        </>
      )}
      {flight?.return && (
        <div
          style={{
            borderTop: `1px solid ${G.border}`,
            paddingTop: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            {flight.return.from} → {flight.return.to}
          </div>
          <div style={{ fontSize: 12, color: G.muted }}>Return TBD</div>
        </div>
      )}
      <div
        style={{
          borderTop: `1px solid ${G.border}`,
          paddingTop: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, color: G.faint, marginBottom: 4 }}>
          Passengers
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
          ${total.toFixed(2)}
        </span>
      </div>
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
          <ShieldIcon />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.success }}>
            Book with confidence
          </div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
            Free cancellation within 24 hours of booking.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Passengers ────────────────────────────────────────────────────────
function StepPassengers({ onNext, flight, basePrice }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
    ktn: "",
  });
  const [touched, setTouched] = useState({});
  const [showKtn, setShowKtn] = useState(false);

  // Refs to read DOM values — handles browser autofill that skips onChange
  const firstRef = useRef();
  const lastRef = useRef();
  const dobRef = useRef();
  const emailRef = useRef();
  const phoneRef = useRef();

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const dobOk = (v) => {
    if (!v) return false;
    const d = dayjs(v);
    return d.isValid() && d.isBefore(dayjs().subtract(1, "day"));
  };
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const errs = {
    firstName: touched.firstName && !form.firstName ? "Required" : null,
    lastName: touched.lastName && !form.lastName ? "Required" : null,
    dob: touched.dob && !dobOk(form.dob) ? "Enter a valid past date" : null,
    email: touched.email && !emailOk(form.email) ? "Enter a valid email" : null,
  };

  const handleContinue = () => {
    // Read live DOM values to catch autofill
    const live = {
      firstName: firstRef.current?.value || form.firstName,
      lastName: lastRef.current?.value || form.lastName,
      dob: dobRef.current?.value || form.dob,
      email: emailRef.current?.value || form.email,
      phone: phoneRef.current?.value || form.phone,
      ktn: form.ktn,
    };
    // Sync state so errors show if invalid
    setForm(live);
    setTouched({ firstName: true, lastName: true, dob: true, email: true });
    if (
      !live.firstName ||
      !live.lastName ||
      !dobOk(live.dob) ||
      !emailOk(live.email)
    )
      return;
    onNext(live);
  };

  return (
    <div className="skc-fade">
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            Passenger details
          </h2>
          <p style={{ color: G.muted, fontSize: 14, marginBottom: 24 }}>
            Must match your government-issued ID exactly.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
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
              Date of birth{" "}
              <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
              <input
                ref={dobRef}
                className="skc-input"
                type="date"
                value={form.dob}
                onChange={set("dob")}
                onBlur={blur("dob")}
                max={dayjs().subtract(1, "day").format("YYYY-MM-DD")}
              />
              {errs.dob && (
                <span
                  style={{
                    color: G.danger,
                    fontSize: 12,
                    marginTop: 2,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  {errs.dob}
                </span>
              )}
            </label>
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
              onClick={() => setShowKtn((v) => !v)}
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
              }}
            >
              <span>
                🎖️ Add known traveler number{" "}
                <span style={{ opacity: 0.6 }}>(optional)</span>
              </span>
              <span
                style={{
                  transition: ".2s",
                  display: "inline-block",
                  transform: showKtn ? "rotate(180deg)" : "none",
                }}
              >
                ▾
              </span>
            </button>
            {showKtn && (
              <input
                className="skc-input"
                value={form.ktn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ktn: e.target.value }))
                }
                placeholder="Known traveler number"
              />
            )}
          </div>

          <button
            type="button"
            className="skc-btn-primary"
            style={{ marginTop: 28 }}
            onClick={handleContinue}
          >
            Continue to Seats &amp; Bags →
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
        <div style={{ width: 252, flexShrink: 0 }}>
          <TripSidebar
            flight={flight}
            seat="none"
            bag="none"
            insurance={false}
            basePrice={basePrice}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Seats & Bags ──────────────────────────────────────────────────────
function StepSeatsBags({ onNext, onBack, basePrice, flight }) {
  const [seat, setSeat] = useState("none");
  const [bag, setBag] = useState("none");
  const [insurance, setInsurance] = useState(false);

  return (
    <div className="skc-fade">
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 24,
            }}
          >
            Seats &amp; Bags
          </h2>
          {[
            {
              icon: "💺",
              title: "Seat preference",
              hint: "Applies to both flights",
              opts: SEAT_OPTIONS,
              val: seat,
              set: setSeat,
              name: "Seat",
            },
            {
              icon: "🧳",
              title: "Baggage",
              hint: "Prices lower now than at airport · applies to both flights",
              opts: BAG_OPTIONS,
              val: bag,
              set: setBag,
              name: "Baggage",
            },
          ].map(({ icon, title, hint, opts, val, set, name }) => (
            <section key={name} style={{ marginBottom: 28 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div
                    style={{
                      fontFamily: "inherit",
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ fontSize: 12, color: G.muted }}>{hint}</div>
                </div>
              </div>
              <OptionSelector
                options={opts}
                selected={val}
                onSelect={set}
                name={name}
              />
            </section>
          ))}
          <section style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 20 }}>🛡️</span>
              <div>
                <div
                  style={{
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  Travel protection
                </div>
                <div style={{ fontSize: 12, color: G.muted }}>
                  Optional · $28.25 one-time
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`skc-opt${insurance ? " sel" : ""}`}
              onClick={() => setInsurance((v) => !v)}
              role="checkbox"
              aria-checked={insurance}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `2px solid ${insurance ? G.orange : G.faint}`,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: insurance ? G.orange : "transparent",
                    fontSize: 11,
                    color: "white",
                    transition: ".2s",
                  }}
                >
                  {insurance ? "✓" : ""}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    Add travel protection — $28.25
                  </div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
                    Trip cancellation · Medical · Delay · Baggage loss
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--cta, #ff8a2a)",
                  flexShrink: 0,
                }}
              >
                +$28.25
              </div>
            </button>
          </section>
          <PriceSummary
            base={basePrice}
            seat={seat}
            bag={bag}
            insurance={insurance}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="skc-btn-back" onClick={onBack}>
              ← Back
            </button>
            <button
              type="button"
              className="skc-btn-primary"
              style={{ flex: 1 }}
              onClick={() => onNext({ seat, bag, insurance })}
            >
              Review &amp; Pay →
            </button>
          </div>
        </div>
        <div style={{ width: 252, flexShrink: 0 }}>
          <TripSidebar
            flight={flight}
            seat={seat}
            bag={bag}
            insurance={insurance}
            basePrice={basePrice}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Review & Pay ──────────────────────────────────────────────────────
function StepReviewPay({ onBack, passenger, extras, basePrice, flight }) {
  const [card, setCard] = useState({
    name: "",
    number: "",
    expMonth: "",
    expYear: "",
    cvv: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const sp = SEAT_OPTIONS.find((o) => o.id === extras.seat)?.price ?? 0;
  const bp = BAG_OPTIONS.find((o) => o.id === extras.bag)?.price ?? 0;
  const ip = extras.insurance ? 28.25 : 0;
  const total = basePrice + sp + bp + ip;

  const setC = (k) => (e) => setCard((c) => ({ ...c, [k]: e.target.value }));
  const fmtCard = (v) =>
    v
      .replace(/\D/g, "")
      .replace(/(.{4})/g, "$1 ")
      .trim()
      .slice(0, 19);

  const canBook =
    card.name &&
    card.number.replace(/\s/g, "").length === 16 &&
    card.expMonth &&
    card.expYear &&
    card.cvv.length >= 3 &&
    agreed;

  const handleBook = async () => {
    if (!canBook) return;
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const API = import.meta.env?.VITE_API_URL || "";
      const bRes = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          flight: {
            origin: flight.outbound.from,
            destination: flight.outbound.to,
            departingAt: flight.outbound.date,
            airline: flight.outbound.airline,
          },
          travelers: [
            {
              firstName: passenger.firstName,
              lastName: passenger.lastName,
              email: passenger.email,
            },
          ],
          dates: {
            depart: flight.outbound.date,
            return: flight.return?.date || null,
          },
        }),
      });
      const bData = await bRes.json();
      const bookingId = bData?._id || bData?.id || "";
      const iRes = await fetch(`${API}/api/stripe/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ amount: total, currency: "usd", bookingId }),
      });
      const iData = await iRes.json();
      if (!iData.ok) throw new Error(iData.message || "Payment setup failed");
      sessionStorage.setItem(
        "skyrio_pending_booking",
        JSON.stringify({
          bookingId,
          total,
          flight,
          passenger,
          paymentIntentId: iData.paymentIntentId,
        })
      );
      setLoading(false);
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        className="skc-pop"
        style={{ textAlign: "center", padding: "60px 20px" }}
      >
        <div style={{ fontSize: 80, marginBottom: 20 }}>✈️</div>
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
          <strong style={{ color: "#fff" }}>{passenger.email}</strong>
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
          <div style={{ marginBottom: 8 }}>
            {flight.outbound.from} → {flight.outbound.to} ·{" "}
            {flight.outbound.date}
          </div>
          {flight.return.date !== "Return TBD" && (
            <div style={{ marginBottom: 8 }}>
              {flight.return.from} → {flight.return.to} · {flight.return.date}
            </div>
          )}
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

  const recapRows = [
    {
      label: "Passenger",
      value: `${passenger.firstName} ${passenger.lastName}`,
    },
    extras.seat !== "none" && {
      label: "Seat",
      value: SEAT_OPTIONS.find((o) => o.id === extras.seat)?.label,
    },
    extras.bag !== "none" && {
      label: "Baggage",
      value: BAG_OPTIONS.find((o) => o.id === extras.bag)?.label,
    },
    extras.insurance && { label: "Protection", value: "Travel Guard" },
  ].filter(Boolean);

  return (
    <div className="skc-fade">
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
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
              Trip recap
            </div>
            <FlightCard flight={flight} />
            {recapRows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 0",
                  borderBottom: `1px solid ${G.border}`,
                  fontSize: 14,
                }}
              >
                <span style={{ color: G.muted }}>{r.label}</span>
                <span>{r.value}</span>
              </div>
            ))}
          </section>
          <PriceSummary
            base={basePrice}
            seat={extras.seat}
            bag={extras.bag}
            insurance={extras.insurance}
          />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label className="skc-label">
                Name on card{" "}
                <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
                <input
                  className="skc-input"
                  value={card.name}
                  onChange={setC("name")}
                  placeholder="David Chatman"
                  autoComplete="cc-name"
                />
              </label>
              <label className="skc-label">
                Card number{" "}
                <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
                <input
                  className="skc-input"
                  value={card.number}
                  onChange={(e) =>
                    setCard((c) => ({ ...c, number: fmtCard(e.target.value) }))
                  }
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={19}
                />
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <label className="skc-label">
                  Month <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
                  <select
                    className="skc-input"
                    value={card.expMonth}
                    onChange={setC("expMonth")}
                    autoComplete="cc-exp-month"
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) =>
                      String(i + 1).padStart(2, "0")
                    ).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="skc-label">
                  Year <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
                  <select
                    className="skc-input"
                    value={card.expYear}
                    onChange={setC("expYear")}
                    autoComplete="cc-exp-year"
                  >
                    <option value="">YYYY</option>
                    {Array.from({ length: 10 }, (_, i) => String(2025 + i)).map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="skc-label">
                  CVV <span style={{ color: "var(--cta, #ff8a2a)" }}>*</span>
                  <input
                    className="skc-input"
                    value={card.cvv}
                    onChange={setC("cvv")}
                    placeholder="•••"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="cc-csc"
                  />
                </label>
              </div>
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
              }}
            >
              ⚠️ {error}
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
                fontSize: 11,
                color: "white",
                flexShrink: 0,
                transition: ".2s",
              }}
            >
              {agreed ? "✓" : ""}
            </div>
            <span>
              I agree to the{" "}
              <a
                href="#"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
              >
                fare rules
              </a>{" "}
              and{" "}
              <a
                href="#"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "var(--cta, #ff8a2a)", textDecoration: "none" }}
              >
                privacy policy
              </a>
              .
            </span>
          </button>
          <div style={{ display: "flex", gap: 12 }}>
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
                opacity: canBook ? 1 : 0.4,
                cursor: canBook ? "pointer" : "not-allowed",
              }}
              onClick={handleBook}
              disabled={!canBook || loading}
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
        </div>
        <div style={{ width: 252, flexShrink: 0 }}>
          <TripSidebar
            flight={flight}
            seat={extras.seat}
            bag={extras.bag}
            insurance={extras.insurance}
            basePrice={basePrice}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function BookingCheckout({ flight, onBack }) {
  const liveFlight = buildFlight(flight);
  const [step, setStep] = useState(0);
  const [passenger, setPassenger] = useState(null);
  const [extras, setExtras] = useState(null);

  return (
    <div className="skc" style={{ position: "relative", minHeight: "100vh" }}>
      <style>{css}</style>

      {/* Background — scoped layers, blends with navbar */}
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
          padding: "0 24px 72px",
        }}
      >
        {/* Header */}
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

        {step === 0 && <FlightCard flight={liveFlight} />}

        {step === 0 && (
          <StepPassengers
            onNext={(p) => {
              setPassenger(p);
              setStep(1);
            }}
            flight={liveFlight}
            basePrice={liveFlight.basePrice}
          />
        )}
        {step === 1 && (
          <StepSeatsBags
            onBack={() => setStep(0)}
            onNext={(e) => {
              setExtras(e);
              setStep(2);
            }}
            basePrice={liveFlight.basePrice}
            flight={liveFlight}
          />
        )}
        {step === 2 && (
          <StepReviewPay
            onBack={() => setStep(1)}
            passenger={passenger}
            extras={extras}
            basePrice={liveFlight.basePrice}
            flight={liveFlight}
          />
        )}
      </div>
    </div>
  );
}
