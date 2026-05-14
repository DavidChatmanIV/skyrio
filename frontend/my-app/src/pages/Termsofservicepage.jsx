import { useNavigate } from "react-router-dom";

const LAST_UPDATED = "May 14, 2026";
const CONTACT_EMAIL = "support@skyrioofficial.com";
const COMPANY = "Skyrio";

const css = `
  .sk-legal { min-height: 100vh; background: #07060f; color: #fff; font-family: "DM Sans", sans-serif; }
  .sk-legal__topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);
  }
  .sk-legal__logo {
    font-family: "Syne", sans-serif; font-size: 18px; font-weight: 800;
    background: linear-gradient(135deg, #ff8a2a, #ffb066);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sk-legal__back {
    background: none; border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.6); padding: 8px 16px; border-radius: 999px;
    font-size: 13px; cursor: pointer; font-family: inherit;
    transition: border-color .2s, color .2s;
  }
  .sk-legal__back:hover { border-color: #ff8a2a; color: #ff8a2a; }
  .sk-legal__body { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
  .sk-legal__eyebrow {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #ff8a2a; margin-bottom: 12px;
  }
  .sk-legal__title {
    font-family: "Syne", sans-serif; font-size: 36px; font-weight: 800;
    margin-bottom: 8px; color: #fff;
  }
  .sk-legal__updated {
    font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 48px;
  }
  .sk-legal__section { margin-bottom: 40px; }
  .sk-legal__h2 {
    font-family: "Syne", sans-serif; font-size: 20px; font-weight: 700;
    color: #fff; margin-bottom: 14px;
    padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .sk-legal__p {
    font-size: 15px; line-height: 1.8; color: rgba(255,255,255,0.7);
    margin-bottom: 14px;
  }
  .sk-legal__ul {
    list-style: none; padding: 0; margin: 0 0 14px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .sk-legal__ul li {
    font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.7);
    padding-left: 20px; position: relative;
  }
  .sk-legal__ul li::before {
    content: "✦"; position: absolute; left: 0;
    color: #ff8a2a; font-size: 10px; top: 5px;
  }
  .sk-legal__link { color: #ff8a2a; text-decoration: none; }
  .sk-legal__link:hover { text-decoration: underline; }
  .sk-legal__highlight {
    background: rgba(255,138,42,0.06); border: 1px solid rgba(255,138,42,0.2);
    border-radius: 10px; padding: 14px 18px; margin-bottom: 14px;
    font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.7;
  }
  .sk-legal__contact {
    background: rgba(255,138,42,0.06); border: 1px solid rgba(255,138,42,0.2);
    border-radius: 14px; padding: 20px 24px; margin-top: 48px;
  }
  .sk-legal__contact-title { font-weight: 700; font-size: 16px; margin-bottom: 8px; color: #ff8a2a; }
  @media (max-width: 640px) {
    .sk-legal__topbar { padding: 14px 16px; }
    .sk-legal__body { padding: 32px 16px 60px; }
    .sk-legal__title { font-size: 28px; }
  }
`;

export default function TermsOfServicePage() {
  const navigate = useNavigate();
  return (
    <div className="sk-legal">
      <style>{css}</style>
      <div className="sk-legal__topbar">
        <div className="sk-legal__logo">Skyrio</div>
        <button className="sk-legal__back" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
      <div className="sk-legal__body">
        <div className="sk-legal__eyebrow">Legal</div>
        <h1 className="sk-legal__title">Terms of Service</h1>
        <p className="sk-legal__updated">Last updated: {LAST_UPDATED}</p>

        <div className="sk-legal__highlight">
          Please read these Terms carefully before using Skyrio. By creating an
          account or making a booking, you agree to be bound by these Terms.
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">1. Acceptance of Terms</h2>
          <p className="sk-legal__p">
            These Terms of Service ("Terms") govern your use of the {COMPANY}{" "}
            platform and services (the "Service"), operated by {COMPANY} ("we,"
            "us," or "our"). By accessing or using the Service, you confirm that
            you are at least 18 years old, have read and understood these Terms,
            and agree to be bound by them.
          </p>
          <p className="sk-legal__p">
            If you do not agree to these Terms, you may not use the Service.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">2. The Service</h2>
          <p className="sk-legal__p">
            {COMPANY} is a travel planning and booking platform that helps users
            search for flights, accommodations, and travel experiences. We also
            operate SkyHub, a community platform for travelers, and the Passport
            program, a loyalty and rewards system.
          </p>
          <p className="sk-legal__p">
            {COMPANY} acts as an intermediary between you and travel providers.
            When you complete a booking, you are entering into a contract
            directly with the relevant airline, hotel, or travel provider — not
            with {COMPANY}. We are responsible for the booking process on our
            platform but are not liable for the actions or failures of
            third-party travel providers.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">3. Account Registration</h2>
          <p className="sk-legal__p">
            To use certain features of the Service, you must create an account.
            You agree to:
          </p>
          <ul className="sk-legal__ul">
            <li>
              Provide accurate, current, and complete information during
              registration
            </li>
            <li>Maintain the security of your password and account</li>
            <li>
              Notify us immediately of any unauthorized use of your account
            </li>
            <li>
              Take responsibility for all activity that occurs under your
              account
            </li>
          </ul>
          <p className="sk-legal__p">
            We reserve the right to suspend or terminate accounts that violate
            these Terms or that we believe are being used fraudulently.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">4. Bookings and Payments</h2>
          <p className="sk-legal__p">
            When you make a booking through {COMPANY}, you authorize us to
            charge the payment method you provide. All payments are processed
            securely through Stripe. By completing a booking, you agree to:
          </p>
          <ul className="sk-legal__ul">
            <li>Pay all fees and charges associated with your booking</li>
            <li>
              Ensure that all passenger information you provide is accurate and
              matches government-issued ID
            </li>
            <li>
              Review the fare rules and cancellation policies of your specific
              booking before confirming
            </li>
          </ul>
          <p className="sk-legal__p">
            <strong>Cancellations and refunds</strong> are subject to the
            individual fare rules of your booking. {COMPANY} offers free
            cancellation within 24 hours of booking for eligible fares. After 24
            hours, cancellation terms are determined by the airline or travel
            provider.
          </p>
          <p className="sk-legal__p">
            Prices are displayed in USD and are subject to change until your
            booking is confirmed. {COMPANY} is not responsible for pricing
            errors caused by third-party data providers.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">5. XP, Passport, and Rewards</h2>
          <p className="sk-legal__p">
            The Skyrio Passport program awards XP points for activity on the
            platform. XP and rewards are provided at our sole discretion and
            have no cash value unless explicitly redeemed for a discount on a
            qualifying booking. We reserve the right to modify, suspend, or
            discontinue the rewards program at any time with reasonable notice.
          </p>
          <ul className="sk-legal__ul">
            <li>XP points expire after 12 months of account inactivity</li>
            <li>
              XP earned through fraudulent activity will be forfeited and may
              result in account termination
            </li>
            <li>
              Rewards and discounts cannot be combined unless explicitly stated
            </li>
          </ul>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">6. SkyHub Community</h2>
          <p className="sk-legal__p">
            SkyHub is a community platform for travelers. By posting content on
            SkyHub, you grant {COMPANY} a non-exclusive, royalty-free license to
            display and use that content within the Service. You agree not to
            post content that:
          </p>
          <ul className="sk-legal__ul">
            <li>Is false, misleading, or fraudulent</li>
            <li>Infringes on the intellectual property rights of others</li>
            <li>Contains hate speech, harassment, or threats</li>
            <li>Promotes illegal activity</li>
            <li>
              Is spam, advertising, or solicitation without our permission
            </li>
          </ul>
          <p className="sk-legal__p">
            We reserve the right to remove any content and suspend any user who
            violates these guidelines.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">7. Intellectual Property</h2>
          <p className="sk-legal__p">
            The {COMPANY} name, logo, platform design, Atlas AI, and all related
            software are the intellectual property of {COMPANY} and are
            protected by applicable copyright and trademark laws. You may not
            copy, modify, distribute, or create derivative works based on our
            platform without our prior written consent.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">8. Disclaimer of Warranties</h2>
          <p className="sk-legal__p">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT
            THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF
            VIRUSES. TRAVEL INFORMATION, FLIGHT AVAILABILITY, AND PRICING ARE
            PROVIDED BY THIRD PARTIES AND MAY CHANGE WITHOUT NOTICE.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">9. Limitation of Liability</h2>
          <p className="sk-legal__p">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY.toUpperCase()}{" "}
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE
            SERVICE, INCLUDING BUT NOT LIMITED TO MISSED FLIGHTS, TRAVEL
            DISRUPTIONS, OR ACTIONS OF THIRD-PARTY TRAVEL PROVIDERS.
          </p>
          <p className="sk-legal__p">
            Our total liability to you for any claim arising from your use of
            the Service shall not exceed the amount you paid to {COMPANY} in the
            12 months preceding the claim.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">10. Governing Law</h2>
          <p className="sk-legal__p">
            These Terms shall be governed by and construed in accordance with
            the laws of the State of New Jersey, United States, without regard
            to its conflict of law provisions. Any disputes arising from these
            Terms or your use of the Service shall be resolved in the courts of
            New Jersey.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">11. Changes to Terms</h2>
          <p className="sk-legal__p">
            We reserve the right to modify these Terms at any time. We will
            provide at least 14 days' notice before significant changes take
            effect by emailing registered users or posting a notice on the
            platform. Your continued use of the Service after changes take
            effect constitutes acceptance of the new Terms.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">12. Termination</h2>
          <p className="sk-legal__p">
            We may suspend or terminate your access to the Service at any time,
            with or without cause, with or without notice. Upon termination,
            your right to use the Service ceases immediately. Sections that by
            their nature should survive termination (including payment
            obligations, IP rights, disclaimers, and limitations of liability)
            will survive.
          </p>
        </div>

        <div className="sk-legal__contact">
          <div className="sk-legal__contact-title">
            Questions About These Terms?
          </div>
          <p className="sk-legal__p" style={{ marginBottom: 0 }}>
            Contact us at{" "}
            <a className="sk-legal__link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . We're happy to clarify anything.
          </p>
        </div>
      </div>
    </div>
  );
}
