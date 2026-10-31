// src/components/Atlas/AtlasCheckoutCard.jsx
// "Review & pay" card Atlas shows after open_checkout. Works for guests and
// signed-in users. Opens the normal checkout page in a new tab with the picked
// flight/hotel ready; travelers and payment are entered there.
// Rendered by AtlasPanel.jsx for an action of type "checkout_link".
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/styles/atlas-checkout.css";

function money(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const PlaneIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
  </svg>
);
const BedIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M3 7v11h2v-2h14v2h2v-6a4 4 0 0 0-4-4h-6v5H5V7zm4 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);

function checkoutHref(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (!u.pathname.startsWith("/checkout/atlas/")) return null;
    return window.location.origin + u.pathname;
  } catch {
    return null;
  }
}

const secondsUntil = (iso) => Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000));

export default function AtlasCheckoutCard({ action }) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(action.expiresAt));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const t = setInterval(() => setSecondsLeft(secondsUntil(action.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [action.expiresAt, secondsLeft === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const href = checkoutHref(action.url);
  const expired = secondsLeft === 0 || !href;
  const isFlight = action.kind === "flight";
  const mm = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const who = `${action.travelers} ${
    isFlight ? (action.travelers === 1 ? "traveler" : "travelers") : action.travelers === 1 ? "guest" : "guests"
  }`;

  return (
    <div className={`atlas-checkout-card${expired ? " atlas-checkout-card--expired" : ""}`}>
      <div className="atlas-checkout-card__head">
        <span className="atlas-checkout-card__icon">{isFlight ? <PlaneIcon /> : <BedIcon />}</span>
        <div>
          <div className="atlas-checkout-card__title">{action.title}</div>
          {(action.lines || []).map((l) => (
            <div key={l} className="atlas-checkout-card__sub">
              {l}
            </div>
          ))}
        </div>
      </div>

      <div className="atlas-checkout-card__row">
        <span>{who}</span>
        {Number.isFinite(Number(action.price)) && <strong>{money(Number(action.price), action.currency)}</strong>}
      </div>

      {expired ? (
        <div className="atlas-checkout-card__note">This price expired. Ask Atlas to search again.</div>
      ) : (
        <>
          <a className="atlas-checkout-card__cta" href={href}
            onClick={(e) => {
              e.preventDefault();
              navigate(new URL(href).pathname);
            }}
          >
            Review &amp; pay
          </a>
          <div className="atlas-checkout-card__note">
            Price held for <strong>{mm}</strong> and re-checked at checkout. You'll add
            traveler details there. Nothing is charged until you pay.
          </div>
        </>
      )}
    </div>
  );
}
