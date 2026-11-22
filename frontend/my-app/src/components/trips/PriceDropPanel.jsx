// "Your stay got cheaper" on Manage booking: the same room costs less now
// and the stay can still be cancelled for free. Three steps, each confirmed
// by the traveler:
//   1. See the lower price (checked live with the hotel).
//   2. Book it (normal hotel checkout, price rechecked before paying).
//   3. The server cancels the old booking right after the new one is booked
//      and paid, only if the hotel's policy says it's still free. It happens
//      on the server, so closing the page can't leave two bookings; if the
//      hotel doesn't answer, Skyrio retries every hour and emails when done.
import { useState } from "react";
import { TrendingDown, Loader2, Check, AlertTriangle, Bell, BellOff } from "lucide-react";
import { lazyPart, LoadingLine } from "@/utils/lazyPart";

const HotelCheckout = lazyPart(() => import("@/pages/booking/HotelCheckout"), LoadingLine);
const BookingCheckout = lazyPart(() => import("@/pages/booking/BookingCheckout"), LoadingLine);
const API = import.meta.env.VITE_API_URL || "";
const usd = (n, cur = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Number(n) || 0);
  } catch {
    return `$${Math.round(Number(n) || 0)}`;
  }
};
const shortDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const CSS = `
.pdp-drop { margin-top: 14px; padding: 16px 18px; border-radius: 18px; color: #fff;
  background: linear-gradient(160deg, rgba(110,231,168,.14), rgba(124,92,252,.14));
  border: 1px solid rgba(110,231,168,.4); }
.pdp-drop h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; }
.pdp-drop h3 svg { color: #6ee7a8; }
.pdp-drop p { margin: 6px 0 0; font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,.78); }
.pdp-drop .pdp-big { color: #6ee7a8; }
.pdp-rows { margin: 10px 0 0; display: grid; gap: 6px; font-size: 13.5px; }
.pdp-rows div { display: flex; justify-content: space-between; gap: 10px; }
.pdp-rows s { color: rgba(255,255,255,.55); }
.pdp-btn { margin-top: 12px; width: 100%; min-height: 46px; border: 0; border-radius: 999px; cursor: pointer;
  font: inherit; font-weight: 800; font-size: 15px; color: #0f2a1e;
  background: linear-gradient(90deg, #6ee7a8, #a7f3d0); display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.pdp-btn:disabled { opacity: .6; cursor: wait; }
.pdp-btn:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.pdp-eyebrow { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 3px 10px;
  border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
  color: #ffd1a1; background: rgba(255,138,42,.16); border: 1px solid rgba(255,138,42,.35); }
.pdp-watch { margin-top: 14px; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px;
  font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,.8);
  background: rgba(124,92,252,.10); border: 1px solid rgba(167,139,250,.28); }
.pdp-watch b { color: #fff; }
.pdp-watch svg { flex-shrink: 0; margin-top: 2px; color: #ffb347; }
.pdp-watch.is-off svg { color: rgba(255,255,255,.5); }
.pdp-msg { margin-top: 10px; display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; }
.pdp-overlay { position: fixed; inset: 0; z-index: 1200; overflow-y: auto; padding: 76px 0 40px;
  background: linear-gradient(180deg, #1a1233, #2b1642); }
.pdp-close { position: fixed; top: 16px; right: 16px; z-index: 1201; min-height: 40px; padding: 0 16px;
  border-radius: 999px; border: 1px solid rgba(255,255,255,.25); background: rgba(20,12,36,.85); color: #fff;
  font: inherit; font-weight: 700; cursor: pointer; }
.pdp-close:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
`;

// Price Watch on a booking with no lower price right now: on (and exactly
// when we'd tell them) or off (and why).
export function PriceWatchLine({ status }) {
  if (!status?.text) return null;
  const Icon = status.on ? Bell : BellOff;
  return (
    <div className={`pdp-watch${status.on ? "" : " is-off"}`} role="note">
      <style>{CSS}</style>
      <Icon size={16} aria-hidden="true" />
      <span>
        <b>Price Watch {status.on ? "on" : "off"}.</b> {status.text}
      </span>
    </div>
  );
}

export default function PriceDropPanel(props) {
  return props.booking?.type === "Flight" ? <FlightPriceDrop {...props} /> : <StayPriceDrop {...props} />;
}

// "Your flight got cheaper": the same flights cost less, and the airline
// would refund the current ticket in full right now.
//   1. See the lower fare (searched live, refund checked live).
//   2. Book it (normal flight checkout; payment is refused if the fare is
//      no longer lower than what was paid).
//   3. The server cancels the old ticket right after the new one is booked,
//      only if the full refund still applies. Retries hourly; emails if the
//      old ticket had to be kept.
function FlightPriceDrop({ booking, authHeaders, onChanged }) {
  const [stage, setStage] = useState("intro"); // intro | loading | review | checkout | stale | error
  const [live, setLive] = useState(null);
  const [msg, setMsg] = useState("");
  const cur = booking.totalCurrency || "USD";

  const check = async () => {
    setStage("loading");
    try {
      const res = await fetch(`${API}/api/bookings/${booking._id}/price-drop`, { headers: authHeaders || {} });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      if (!data.ok || !data.flight) {
        setMsg(data.message || "The lower fare isn't available anymore.");
        setStage("stale");
        return;
      }
      setLive(data);
      setStage("review");
    } catch (e) {
      setMsg(e.message || "Couldn't check the fare. Try again.");
      setStage("error");
    }
  };

  if (stage === "checkout" && live) {
    return (
      <div className="pdp-overlay">
        <style>{CSS}</style>
        <button
          type="button"
          className="pdp-close"
          onClick={() => {
            setStage("intro");
            onChanged?.();
          }}
        >
          Close
        </button>
        <BookingCheckout
          flight={live.flight}
          onBack={() => setStage("review")}
          replaces={{
            bookingId: booking._id,
            token: authHeaders?.["x-manage-token"] || null,
            // Must stay below what they paid, or payment is refused.
            maxTotal: Number(booking.totalAmount) || null,
          }}
        />
      </div>
    );
  }

  return (
    <section className="pdp-drop" aria-label="Your flight got cheaper">
      <style>{CSS}</style>
      <span className="pdp-eyebrow">
        <Bell size={12} aria-hidden="true" /> Price Watch
      </span>
      <h3>
        <TrendingDown size={18} aria-hidden="true" /> Your flight got cheaper
      </h3>

      {(stage === "intro" || stage === "loading") && (
        <>
          <p>
            The same flights are <b className="pdp-big">{usd(booking.priceDrop.savings, cur)} less</b> than you paid,
            and the airline would refund your ticket in full right now.
          </p>
          <button type="button" className="pdp-btn" onClick={check} disabled={stage === "loading"}>
            {stage === "loading" ? <Loader2 size={16} className="pr-spin" /> : null}
            {stage === "loading" ? "Checking with the airline…" : "See the lower fare"}
          </button>
        </>
      )}

      {stage === "review" && live && (
        <>
          <div className="pdp-rows">
            <div>
              <span>Same flights</span>
              <span>
                <s>{usd(live.paid, cur)}</s> {usd(live.now, cur)}
              </span>
            </div>
            <div>
              <b>You save</b>
              <b className="pdp-big">{usd(live.savings, cur)}</b>
            </div>
          </div>
          <p>1. Book the same flights at the new fare. 2. Skyrio cancels your old ticket for a full refund.</p>
          <p>
            Your card holds both amounts until the old refund arrives, usually 5–10 business days. Seats aren't carried
            over. You'll enter traveler details again.
          </p>
          <p>
            Fares change fast. Both the fare and the refund are checked again right before you pay. If either changed,
            nothing is charged.
          </p>
          <button type="button" className="pdp-btn" onClick={() => setStage("checkout")}>
            Book the lower fare
          </button>
        </>
      )}

      {(stage === "stale" || stage === "error") && (
        <div className="pdp-msg" role="status">
          <AlertTriangle size={16} aria-hidden="true" style={{ color: "#ffb347", flexShrink: 0 }} />
          <span>{msg}</span>
        </div>
      )}
      {stage === "error" && (
        <button type="button" className="pdp-btn" onClick={check}>
          Try again
        </button>
      )}
    </section>
  );
}

function StayPriceDrop({ booking, authHeaders, onChanged }) {
  const [stage, setStage] = useState("intro"); // intro | loading | review | checkout | done | stale | error
  const [live, setLive] = useState(null);
  const [msg, setMsg] = useState("");
  const cur = booking.priceDrop?.currency || booking.totalCurrency || "USD";

  const check = async () => {
    setStage("loading");
    try {
      const res = await fetch(`${API}/api/bookings/${booking._id}/price-drop`, { headers: authHeaders || {} });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      if (!data.ok) {
        setMsg(data.message || "The lower price isn't available anymore.");
        setStage("stale");
        return;
      }
      setLive(data);
      setStage("review");
    } catch (e) {
      setMsg(e.message || "Couldn't check the price. Try again.");
      setStage("error");
    }
  };

  // The new stay is booked. The server already handled the old one; say
  // exactly what happened, with the real amounts.
  const afterBooked = (c) => {
    const r = c?.replaced || null;
    const paidOld = Number(booking.totalAmount) || 0;
    const paidNew = Number(c?.totalPaid);
    const saved = Number.isFinite(paidNew) && paidNew > 0 ? paidOld - paidNew : null;
    const savedLine = saved > 0 ? ` You saved ${usd(saved, cur)}.` : "";
    if (r?.status === "cancelled") {
      setMsg(
        `Done. You're booked at the lower price (confirmation email on its way) and your old booking is cancelled.${
          Number(r.refund) > 0
            ? ` ${usd(r.refund, cur)} is on its way back to your card (usually 5–10 business days).`
            : ""
        }${savedLine}`
      );
    } else if (r?.status === "retry") {
      setMsg(
        "Your new stay is booked. We're finishing cancelling your old booking and will email you when it's done."
      );
    } else if (r?.status === "fee") {
      setMsg(
        "Your new stay is booked. The hotel would charge a fee to cancel your old booking now, so we kept it. You now have two bookings. Email us and we'll help."
      );
    } else {
      setMsg("Your new stay is booked. Your old booking is still active. Cancel it from this page if you want to.");
    }
    setStage("done");
    onChanged?.();
  };

  if (stage === "checkout" && live) {
    return (
      <div className="pdp-overlay">
        <HotelCheckout
          rooms={live.rooms.map((r) => r.offer)}
          onBack={() => setStage("review")}
          replaces={{
            bookingId: booking._id,
            token: authHeaders?.["x-manage-token"] || null,
            // Must stay below what they paid, or nothing is booked.
            maxTotal: Number(booking.totalAmount) || null,
          }}
          onBooked={afterBooked}
          onBookingComplete={() => setStage("done")}
        />
      </div>
    );
  }

  return (
    <section className="pdp-drop" aria-label="Your stay got cheaper">
      <style>{CSS}</style>
      <span className="pdp-eyebrow">
        <Bell size={12} aria-hidden="true" /> Price Watch
      </span>
      <h3>
        <TrendingDown size={18} aria-hidden="true" /> Your stay got cheaper
      </h3>

      {(stage === "intro" || stage === "loading") && (
        <>
          <p>
            The same room is <b className="pdp-big">{usd(booking.priceDrop.savings, cur)} less</b> than you paid. Book
            the lower price and Skyrio cancels your old booking for free.
          </p>
          <button type="button" className="pdp-btn" onClick={check} disabled={stage === "loading"}>
            {stage === "loading" ? <Loader2 size={16} className="pr-spin" /> : null} See the lower price
          </button>
        </>
      )}

      {stage === "review" && live && (
        <>
          <div className="pdp-rows">
            {live.rooms.map((r, i) => (
              <div key={i}>
                <span>{r.roomName}</span>
                <span>
                  <s>{usd(r.old, cur)}</s> {usd(r.now, cur)}
                </span>
              </div>
            ))}
            <div>
              <b>You save</b>
              <b className="pdp-big">{usd(live.savings, cur)}</b>
            </div>
          </div>
          <p>
            1. Book the same room at the new price. 2. Skyrio cancels the old booking for free
            {live.freeCancelUntil ? ` (free until ${shortDate(live.freeCancelUntil)})` : ""}.
          </p>
          <p>Your card holds both amounts until the old refund arrives, usually 5–10 business days.</p>
          <button type="button" className="pdp-btn" onClick={() => setStage("checkout")}>
            Book the lower price
          </button>
        </>
      )}

      {(stage === "done" || stage === "stale" || stage === "error") && (
        <div className="pdp-msg" role="status">
          {stage === "done" && /^Done/.test(msg) ? (
            <Check size={16} aria-hidden="true" style={{ color: "#6ee7a8", flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={16} aria-hidden="true" style={{ color: "#ffb347", flexShrink: 0 }} />
          )}
          <span>{msg}</span>
        </div>
      )}
      {stage === "error" && (
        <button type="button" className="pdp-btn" onClick={check}>
          Try again
        </button>
      )}
    </section>
  );
}
