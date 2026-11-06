import React from "react";
import { Link } from "react-router-dom";
import { TRUST } from "@/config/trustConfig";
import { UserIcon, PlaneIcon, LockIcon, ShieldIcon } from "./TrustIcons";
import "@/styles/trust-pages.css";

// To add a founder photo: put it in src/assets/about/ and swap the
// placeholder div below for:
//   import founderPhoto from "@/assets/about/david.jpg";
//   <img className="sk-trust__avatar" src={founderPhoto} alt={TRUST.founder} />

export default function AboutPage() {
  return (
    <div className="sk-trust">
      <header className="sk-trust__hero">
        <span className="sk-trust__badge">
          <PlaneIcon /> About Skyrio
        </span>
        <h1>Travel booking that feels like it's on your side.</h1>
        <p className="sk-trust__lead">
          Skyrio brings flights, stays, excursions and group trips together in
          one place, with Atlas AI to help you plan and book.
        </p>
      </header>

      <section className="sk-trust__card sk-trust__card--wide sk-trust__founder">
        <div className="sk-trust__avatar sk-trust__avatar--placeholder">
          <UserIcon />
        </div>
        <div>
          <h2>{TRUST.founder}</h2>
          <p className="sk-trust__role">
            {TRUST.founderTitle}, {TRUST.company}
          </p>
          <p>
            I built Skyrio because booking a trip, especially with friends or
            family, shouldn't take ten tabs and a spreadsheet. I'm a software
            developer from New Jersey, and I personally read feedback and
            handle support cases that need a person.
          </p>
          <p>
            If something isn't right, I want to hear about it:{" "}
            <a href={`mailto:${TRUST.supportEmail}`}>{TRUST.supportEmail}</a>
          </p>
        </div>
      </section>

      <section className="sk-trust__grid sk-trust__grid--three">
        <div className="sk-trust__card">
          <h2>
            <LockIcon /> Secure payments
          </h2>
          <p>
            Payments are processed by Stripe. Skyrio never sees or stores your
            full card number.
          </p>
        </div>
        <div className="sk-trust__card">
          <h2>
            <PlaneIcon /> Real confirmations
          </h2>
          <p>
            Every booking comes with an airline or hotel confirmation code you
            can check with them directly.
          </p>
        </div>
        <div className="sk-trust__card">
          <h2>
            <ShieldIcon /> Backed by a guarantee
          </h2>
          <p>
            If something goes wrong on our end, you get your money back.{" "}
            <Link to="/guarantee">See what's covered</Link>.
          </p>
        </div>
      </section>

      <section className="sk-trust__cta">
        <p className="sk-trust__fine">
          {TRUST.company} · {TRUST.location}
        </p>
      </section>
    </div>
  );
}
