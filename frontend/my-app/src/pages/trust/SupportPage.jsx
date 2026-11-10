import React from "react";
import { Link } from "react-router-dom";
import { TRUST } from "@/config/trustConfig";
import {
  ChatIcon,
  MailIcon,
  TicketIcon,
  ShieldIcon,
  ClockIcon,
} from "./TrustIcons";
import "@/styles/trust-pages.css";

const FAQ = [
  {
    q: "Where's my confirmation?",
    a: "It's emailed to you right after booking, with an airline or hotel confirmation code you can check with them directly. Lost it? Use Find my booking.",
  },
  {
    q: "How do I cancel or change a booking?",
    a: "Open the \"Manage or cancel\" link in your confirmation email, or use Find my booking. What you can change depends on the airline's or hotel's rules, which are shown before you pay.",
  },
  {
    q: "Who sets the refund and bag rules?",
    a: "The airline or hotel does. Skyrio doesn't control them, but we'll help you work through them.",
  },
  {
    q: "Is my payment secure?",
    a: "Yes. Payments are processed by Stripe. Skyrio never sees or stores your full card number.",
  },
];

export default function SupportPage() {
  return (
    <div className="sk-trust">
      <header className="sk-trust__hero">
        <span className="sk-trust__badge">
          <ChatIcon /> Customer support
        </span>
        <h1>Real help from a real person</h1>
        <p className="sk-trust__lead">
          Atlas can handle a lot right away. Anything it can't solve comes
          straight to our team, and you'll hear back {TRUST.responseTime}.
        </p>
      </header>

      <section className="sk-trust__grid sk-trust__grid--three">
        <div className="sk-trust__card">
          <h2>
            <ChatIcon /> Ask Atlas
          </h2>
          <p>
            Tap Help in the corner of any page. Atlas can look up bookings and
            answer questions, and it sends anything it can't solve to our team.
          </p>
        </div>

        <div className="sk-trust__card">
          <h2>
            <MailIcon /> Email us
          </h2>
          <p>
            <a href={`mailto:${TRUST.supportEmail}`}>{TRUST.supportEmail}</a>
          </p>
          <p className="sk-trust__note">
            Include your confirmation code so we can help faster.
          </p>
        </div>

        <div className="sk-trust__card">
          <h2>
            <TicketIcon /> Your booking
          </h2>
          <p>Find, manage or cancel a booking, with or without an account.</p>
          <Link to="/find-booking" className="sk-trust__btn sk-trust__btn--sm">
            Find my booking
          </Link>
        </div>
      </section>

      <section className="sk-trust__card sk-trust__card--wide">
        <h2>
          <ClockIcon /> Common questions
        </h2>
        <div className="sk-trust__faq">
          {FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="sk-trust__cta">
        <p>
          <ShieldIcon /> Every booking is backed by the Skyrio Booking
          Guarantee.
        </p>
        <div className="sk-trust__actions">
          <Link to="/guarantee" className="sk-trust__btn">
            See the guarantee
          </Link>
        </div>
      </section>
    </div>
  );
}
