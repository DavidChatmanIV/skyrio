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

export default function PrivacyPolicyPage() {
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
        <h1 className="sk-legal__title">Privacy Policy</h1>
        <p className="sk-legal__updated">Last updated: {LAST_UPDATED}</p>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">1. Introduction</h2>
          <p className="sk-legal__p">
            Welcome to {COMPANY} ("we," "our," or "us"). We are committed to
            protecting your personal information and your right to privacy. This
            Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our platform at skyrio.app (the
            "Service").
          </p>
          <p className="sk-legal__p">
            Please read this policy carefully. If you disagree with its terms,
            please discontinue use of the Service.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">2. Information We Collect</h2>
          <p className="sk-legal__p">
            We collect information you provide directly to us, including:
          </p>
          <ul className="sk-legal__ul">
            <li>
              Account information: name, email address, username, and password
            </li>
            <li>
              Profile information: profile photo, bio, home city, and travel
              preferences
            </li>
            <li>
              Booking information: passenger names, dates of birth, and travel
              dates
            </li>
            <li>
              Payment information: processed securely through Stripe — we never
              store card details
            </li>
            <li>
              Communications: messages you send us through support or feedback
              forms
            </li>
            <li>Community content: posts, comments, and reactions on SkyHub</li>
          </ul>
          <p className="sk-legal__p">
            We also automatically collect certain information when you use the
            Service:
          </p>
          <ul className="sk-legal__ul">
            <li>
              Usage data: pages visited, features used, searches performed, and
              time spent
            </li>
            <li>
              Device information: IP address, browser type, operating system,
              and device identifiers
            </li>
            <li>
              Cookies and similar tracking technologies to improve your
              experience
            </li>
          </ul>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">3. How We Use Your Information</h2>
          <p className="sk-legal__p">We use the information we collect to:</p>
          <ul className="sk-legal__ul">
            <li>
              Create and manage your account, and authenticate you securely
            </li>
            <li>
              Process bookings and payments through our payment processor
              (Stripe)
            </li>
            <li>Award XP, badges, and rewards through the Passport program</li>
            <li>
              Send transactional emails: booking confirmations, email
              verification, and password resets
            </li>
            <li>
              Provide personalized travel recommendations via our Atlas AI
              assistant
            </li>
            <li>Improve the Service through analytics and usage data</li>
            <li>Respond to your questions and support requests</li>
            <li>
              Comply with legal obligations and enforce our Terms of Service
            </li>
          </ul>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">4. How We Share Your Information</h2>
          <p className="sk-legal__p">
            We do not sell your personal data. We may share your information
            with:
          </p>
          <ul className="sk-legal__ul">
            <li>
              <strong>Service providers:</strong> Stripe (payments), MongoDB
              Atlas (database), Render (hosting), Vercel (frontend hosting), and
              email delivery services — all bound by data processing agreements
            </li>
            <li>
              <strong>Travel partners:</strong> When you complete a booking,
              necessary traveler information is shared with the airline or
              travel provider to fulfill your reservation
            </li>
            <li>
              <strong>Legal authorities:</strong> When required by law, court
              order, or to protect the safety of our users or the public
            </li>
            <li>
              <strong>Business transfers:</strong> In the event of a merger,
              acquisition, or sale of assets, your information may be
              transferred as part of that transaction
            </li>
          </ul>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">5. Data Retention</h2>
          <p className="sk-legal__p">
            We retain your personal information for as long as your account is
            active or as needed to provide services. If you delete your account,
            we will delete or anonymize your personal data within 30 days,
            except where we are required to retain it for legal or compliance
            purposes (such as financial transaction records).
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">6. Cookies</h2>
          <p className="sk-legal__p">
            We use cookies and similar technologies to keep you logged in,
            remember your preferences, and understand how you use the Service.
            We use:
          </p>
          <ul className="sk-legal__ul">
            <li>
              <strong>Essential cookies:</strong> Required for authentication
              and security (e.g., your login session)
            </li>
            <li>
              <strong>Analytics cookies:</strong> Help us understand usage
              patterns to improve the platform
            </li>
          </ul>
          <p className="sk-legal__p">
            You can disable cookies in your browser settings, but this may
            affect some features of the Service.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">7. Your Rights</h2>
          <p className="sk-legal__p">
            Depending on your location, you may have the right to:
          </p>
          <ul className="sk-legal__ul">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data ("right to be forgotten")</li>
            <li>Object to or restrict certain processing of your data</li>
            <li>
              Data portability — receive your data in a machine-readable format
            </li>
            <li>
              Withdraw consent at any time where processing is based on consent
            </li>
          </ul>
          <p className="sk-legal__p">
            To exercise any of these rights, contact us at{" "}
            <a className="sk-legal__link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">8. Children's Privacy</h2>
          <p className="sk-legal__p">
            The Service is not directed to children under the age of 13. We do
            not knowingly collect personal information from children under 13.
            If you believe a child has provided us personal information, please
            contact us and we will delete it promptly.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">9. Security</h2>
          <p className="sk-legal__p">
            We implement industry-standard security measures to protect your
            personal information, including encryption in transit (HTTPS/TLS),
            hashed passwords (bcrypt), and httpOnly authentication cookies.
            However, no method of transmission over the internet is 100% secure,
            and we cannot guarantee absolute security.
          </p>
        </div>

        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">10. Changes to This Policy</h2>
          <p className="sk-legal__p">
            We may update this Privacy Policy from time to time. We will notify
            you of any significant changes by email or by posting a prominent
            notice on the Service. The "Last updated" date at the top of this
            page reflects the most recent revision.
          </p>
        </div>

        <div className="sk-legal__contact">
          <div className="sk-legal__contact-title">Contact Us</div>
          <p className="sk-legal__p" style={{ marginBottom: 0 }}>
            If you have questions or concerns about this Privacy Policy, please
            contact us at{" "}
            <a className="sk-legal__link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
