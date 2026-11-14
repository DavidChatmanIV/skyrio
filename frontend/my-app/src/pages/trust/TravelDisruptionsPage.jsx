import React from "react";
import { Link } from "react-router-dom";
import { TRUST } from "@/config/trustConfig";
import { InfoIcon, ClockIcon, PlaneIcon, ShieldIcon } from "./TrustIcons";
import useSiteStatus from "@/lib/useSiteStatus";
import "@/styles/trust-pages.css";

// What to do when travel is disrupted. Short, plain, and only what's true:
// airlines, hotels and governments make these calls; Skyrio helps.
// US refund rules: 14 CFR 260 / 399.80 (flights to, from or within the US).

const SITUATIONS = [
  {
    title: "The airline cancelled your flight",
    body: "Don't want the new flight they offer? You're owed a full refund, taxes and fees included. You don't have to take a voucher.",
  },
  {
    title: "The airline changed your flight",
    body: "Moved 3+ hours (6+ international), a different airport, an extra stop or a lower cabin? You can say no and get a full refund.",
  },
  {
    title: "Ground stop or airport closure",
    body: "Flights are held, not cancelled by default. Your airline's app has your flight's live status.",
  },
  {
    title: "Weather, strikes or outages",
    body: "Airlines often waive change fees. Check your airline's travel alerts before you change anything.",
  },
  {
    title: "Your hotel",
    body: "Your room follows the hotel's policy, even if your flight is cancelled. Free-cancellation rooms can be cancelled in Trips before the deadline.",
  },
  {
    title: "Your car rental",
    body: "It follows the rental company's policy. Paying at pickup? Call the counter if your pickup time changes.",
  },
  {
    title: "A problem on Skyrio's side",
    body: "Charged but not booked, or charged twice? It's covered by our",
    link: { to: "/guarantee", label: "Booking Guarantee" },
    after: ".",
  },
  {
    title: "Safety first",
    body: "In an emergency, call 911 or the local number. Abroad? Check",
    href: { url: "https://travel.state.gov", label: "travel.state.gov" },
    after: " for advisories and embassy contacts.",
  },
];

export default function TravelDisruptionsPage() {
  const status = useSiteStatus();

  return (
    <div className="sk-trust">
      <header className="sk-trust__hero">
        <span className="sk-trust__badge">
          <PlaneIcon /> Travel disruptions
        </span>
        <h1>When travel gets disrupted</h1>
        <p className="sk-trust__lead">
          Airlines, hotels and governments make these calls, not Skyrio. Here's
          what you're owed and how we help.
        </p>
      </header>

      {status?.active && (
        <section className="sk-trust__card sk-trust__card--wide" role="status">
          <h2>
            <InfoIcon /> Right now: {status.title}
          </h2>
          <p className="sk-trust__note" style={{ marginTop: 0 }}>
            {status.message}
            {status.areas ? ` Areas: ${status.areas}.` : ""}
          </p>
        </section>
      )}

      <section className="sk-trust__grid">
        {SITUATIONS.map((s) => (
          <div className="sk-trust__card" key={s.title}>
            <h2 style={{ fontSize: 17 }}>{s.title}</h2>
            <p className="sk-trust__note" style={{ marginTop: 6 }}>
              {s.body}
              {s.link && (
                <>
                  {" "}
                  <Link to={s.link.to}>{s.link.label}</Link>
                </>
              )}
              {s.href && (
                <>
                  {" "}
                  <a href={s.href.url} target="_blank" rel="noreferrer">
                    {s.href.label}
                  </a>
                </>
              )}
              {s.after}
            </p>
          </div>
        ))}
      </section>

      <section className="sk-trust__card sk-trust__card--wide">
        <h2>
          <ClockIcon /> How we help
        </h2>
        <ol className="sk-trust__steps">
          <li>
            <strong>Check with the airline or hotel</strong> They have the live
            status and make the call on delays and cancellations.
          </li>
          <li>
            <strong>Tell us</strong> Use Help on any page, or email{" "}
            <a href={`mailto:${TRUST.supportEmail}`}>{TRUST.supportEmail}</a>{" "}
            with your confirmation code. A person replies {TRUST.responseTime}.
          </li>
          <li>
            <strong>We handle the refund</strong> When you're owed one, we start
            it within {TRUST.refundStartDays} business days. Card refunds take{" "}
            {TRUST.cardRefundDays} to show, set by your bank.
          </li>
        </ol>
        <p className="sk-trust__note">
          <ShieldIcon /> Refund rules above are the US Department of
          Transportation's, for flights to, from or within the US. Other
          countries have their own rules.
        </p>
      </section>

      <section className="sk-trust__cta">
        <p>Need help with a trip right now?</p>
        <div className="sk-trust__actions">
          <Link to="/find-booking" className="sk-trust__btn">
            Find my booking
          </Link>
          <Link to="/support" className="sk-trust__btn sk-trust__btn--ghost">
            Contact support
          </Link>
        </div>
        <p className="sk-trust__fine">
          This page works alongside our{" "}
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </section>
    </div>
  );
}
