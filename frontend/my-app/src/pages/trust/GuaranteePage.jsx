import React from "react";
import { Link } from "react-router-dom";
import { TRUST } from "@/config/trustConfig";
import { ShieldIcon, CheckIcon, InfoIcon, ClockIcon } from "./TrustIcons";
import "@/styles/trust-pages.css";

const COVERED = [
  "You were charged but the booking didn't go through.",
  "You were charged twice for the same booking.",
  "Your booking has wrong details because of a mistake on Skyrio's side.",
  "Skyrio's site or Atlas made an error that kept your booking from being confirmed.",
];

const NOT_COVERED = [
  "Hotel refund and cancellation rules. Each hotel sets its own, and you'll see them before you pay.",
  "Airline rules for changes, cancellations, bags and carry-ons. Each airline sets these.",
  "Schedule changes or cancellations made by the airline or hotel. We'll help you contact them and follow their process.",
  "Details entered wrong by the traveler (like a misspelled name), unless our site caused it.",
  "No-shows or trips you choose not to take.",
];

export default function GuaranteePage() {
  return (
    <div className="sk-trust">
      <header className="sk-trust__hero">
        <span className="sk-trust__badge">
          <ShieldIcon /> Skyrio Booking Guarantee
        </span>
        <h1>If something goes wrong on our end, you get your money back</h1>
        <p className="sk-trust__lead">
          Booking a trip with a new site is a big deal. Here's exactly what we
          cover, what we don't, and how fast refunds happen.
        </p>
      </header>

      <section className="sk-trust__grid">
        <div className="sk-trust__card">
          <h2>
            <CheckIcon /> What we cover
          </h2>
          <ul className="sk-trust__list sk-trust__list--yes">
            {COVERED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="sk-trust__note">
            In these cases, Skyrio refunds you in full.
          </p>
        </div>

        <div className="sk-trust__card">
          <h2>
            <InfoIcon /> What's set by the airline or hotel
          </h2>
          <ul className="sk-trust__list sk-trust__list--info">
            {NOT_COVERED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="sk-trust__note">
            Skyrio doesn't control these rules, but we'll always help you work
            through them.
          </p>
        </div>
      </section>

      <section className="sk-trust__card sk-trust__card--wide">
        <h2>
          <ClockIcon /> How refunds work
        </h2>
        <ol className="sk-trust__steps">
          <li>
            <strong>Tell us</strong> Use Help in the corner of any page, or
            email{" "}
            <a href={`mailto:${TRUST.supportEmail}`}>{TRUST.supportEmail}</a>{" "}
            with your confirmation code.
          </li>
          <li>
            <strong>A real person reviews it</strong> You'll hear back{" "}
            {TRUST.responseTime}.
          </li>
          <li>
            <strong>We start your refund</strong> Once it's approved, we start
            it within {TRUST.refundStartDays} business days, back to the card
            you paid with.
          </li>
          <li>
            <strong>Your bank posts it</strong> Card refunds usually take{" "}
            {TRUST.cardRefundDays} to show up. That timing is set by your bank,
            not Skyrio.
          </li>
        </ol>
      </section>

      <section className="sk-trust__cta">
        <p>Need help with a booking right now?</p>
        <div className="sk-trust__actions">
          <Link to="/find-booking" className="sk-trust__btn">
            Find my booking
          </Link>
          <Link to="/support" className="sk-trust__btn sk-trust__btn--ghost">
            Contact support
          </Link>
        </div>
        <p className="sk-trust__fine">
          Last updated {TRUST.guaranteeUpdated}. This guarantee works alongside
          our <Link to="/terms">Terms of Service</Link>.
        </p>
      </section>
    </div>
  );
}
