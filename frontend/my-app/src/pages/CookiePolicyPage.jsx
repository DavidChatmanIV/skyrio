import { useNavigate } from "react-router-dom";

const LAST_UPDATED = "May 14, 2026";
const CONTACT_EMAIL = "support@skyrioofficial.com";
const COMPANY = "Skyrio";

// Reuses the same .sk-legal CSS as PrivacyPolicyPage and TermsOfServicePage
const css = `
  .sk-legal { min-height: 100vh; background: #07060f; color: #fff; font-family: "DM Sans", sans-serif; }
  .sk-legal__topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
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
    min-height: 44px; touch-action: manipulation;
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
  .sk-legal__table {
    width: 100%; border-collapse: collapse; margin-bottom: 20px;
    font-size: 14px;
  }
  .sk-legal__table th {
    text-align: left; padding: 10px 14px;
    background: rgba(255,138,42,0.08); color: #ff8a2a;
    font-weight: 700; font-size: 12px; letter-spacing: 0.06em;
    text-transform: uppercase; border-bottom: 1px solid rgba(255,138,42,0.2);
  }
  .sk-legal__table td {
    padding: 12px 14px; color: rgba(255,255,255,0.65);
    border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: top;
    line-height: 1.6;
  }
  .sk-legal__table tr:last-child td { border-bottom: none; }
  .sk-legal__table tr:hover td { background: rgba(255,255,255,0.02); }
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
    .sk-legal__table { font-size: 13px; }
    .sk-legal__table th, .sk-legal__table td { padding: 8px 10px; }
  }
`;

export default function CookiePolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="sk-legal">
      <style>{css}</style>

      {/* ── Top bar ── */}
      <div className="sk-legal__topbar">
        <div className="sk-legal__logo">Skyrio</div>
        <button className="sk-legal__back" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      {/* ── Body ── */}
      <div className="sk-legal__body">
        <div className="sk-legal__eyebrow">Legal</div>
        <h1 className="sk-legal__title">Cookie Policy</h1>
        <p className="sk-legal__updated">Last updated: {LAST_UPDATED}</p>

        <div className="sk-legal__highlight">
          This Cookie Policy explains how {COMPANY} uses cookies and similar
          tracking technologies when you visit our platform. By continuing to
          use Skyrio, you consent to our use of cookies as described below.
        </div>

        {/* 1 */}
        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">1. What Are Cookies?</h2>
          <p className="sk-legal__p">
            Cookies are small text files that are stored on your device
            (computer, tablet, or mobile) when you visit a website. They are
            widely used to make websites work more efficiently, remember your
            preferences, and provide information to website owners.
          </p>
          <p className="sk-legal__p">
            In addition to cookies, we may use similar technologies such as
            local storage, session storage, and device identifiers that function
            in a similar way.
          </p>
        </div>

        {/* 2 */}
        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">2. Types of Cookies We Use</h2>
          <p className="sk-legal__p">
            We use the following categories of cookies on Skyrio:
          </p>

          {/* Cookie table */}
          <table className="sk-legal__table">
            <thead>
              <tr>
                <th>Cookie Type</th>
                <th>Purpose</th>
                <th>Duration</th>
                <th>Can Opt Out?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Essential</strong>
                </td>
                <td>
                  Keep you logged in, maintain your session, and protect against
                  cross-site request forgery (CSRF). Required for the platform
                  to function.
                </td>
                <td>Session / 7 days</td>
                <td>No — required for login</td>
              </tr>
              <tr>
                <td>
                  <strong>Preference</strong>
                </td>
                <td>
                  Remember your settings and preferences such as departure
                  airport, cabin class, and theme preferences.
                </td>
                <td>Up to 12 months</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>
                  <strong>Analytics</strong>
                </td>
                <td>
                  Help us understand how users navigate Skyrio, which features
                  are used most, and where users encounter issues. Data is
                  aggregated and anonymous.
                </td>
                <td>Up to 13 months</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>
                  <strong>Local Storage</strong>
                </td>
                <td>
                  Store non-sensitive user preferences locally in your browser,
                  such as your saved departure airport, music player state, and
                  checklist progress.
                </td>
                <td>Until manually cleared</td>
                <td>Yes — clear browser data</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3 */}
        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">3. Third-Party Cookies</h2>
          <p className="sk-legal__p">
            Some of our service providers may set cookies on your device when
            you use Skyrio. These include:
          </p>
          <ul className="sk-legal__ul">
            <li>
              <strong>Stripe</strong> — our payment processor sets cookies
              required to securely process payments. See{" "}
              <a
                className="sk-legal__link"
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Stripe's Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Vercel</strong> — our frontend hosting provider may set
              analytics and performance cookies. See{" "}
              <a
                className="sk-legal__link"
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel's Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>YouTube</strong> — if you add a YouTube link to your
              Passport profile music, YouTube may set cookies when the embedded
              player loads. See{" "}
              <a
                className="sk-legal__link"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google's Privacy Policy
              </a>
              .
            </li>
          </ul>
          <p className="sk-legal__p">
            We do not use advertising or tracking cookies, and we do not share
            your data with advertising networks.
          </p>
        </div>

        {/* 4 */}
        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">4. How to Manage Cookies</h2>
          <p className="sk-legal__p">
            You can control and manage cookies in several ways:
          </p>
          <ul className="sk-legal__ul">
            <li>
              <strong>Browser settings</strong> — most browsers allow you to
              view, delete, and block cookies. See your browser's help
              documentation for instructions.
            </li>
            <li>
              <strong>Clear local storage</strong> — you can clear Skyrio's
              locally stored preferences by clearing your browser's site data
              for skyrio.app.
            </li>
            <li>
              <strong>Opt-out of analytics</strong> — contact us at{" "}
              <a className="sk-legal__link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              to request that we exclude you from analytics tracking.
            </li>
          </ul>
          <p className="sk-legal__p">
            Please note that disabling essential cookies will prevent you from
            logging in and using core features of Skyrio.
          </p>
        </div>

        {/* 5 */}
        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">5. Cookie Consent</h2>
          <p className="sk-legal__p">
            When you first visit Skyrio, we display a cookie consent banner that
            allows you to accept or decline non-essential cookies. You can
            change your preference at any time by clearing your cookies and
            revisiting the site.
          </p>
          <p className="sk-legal__p">
            For users in the European Economic Area (EEA) and United Kingdom, we
            only set non-essential cookies after you have given explicit
            consent, in compliance with the General Data Protection Regulation
            (GDPR) and the UK GDPR.
          </p>
        </div>

        {/* 6 */}
        <div className="sk-legal__section">
          <h2 className="sk-legal__h2">6. Changes to This Policy</h2>
          <p className="sk-legal__p">
            We may update this Cookie Policy from time to time to reflect
            changes in our practices or for other operational, legal, or
            regulatory reasons. We will notify you of any significant changes by
            posting a notice on our platform. The "Last updated" date at the top
            of this page reflects the most recent revision.
          </p>
        </div>

        {/* Contact */}
        <div className="sk-legal__contact">
          <div className="sk-legal__contact-title">
            Questions About Cookies?
          </div>
          <p className="sk-legal__p" style={{ marginBottom: 0 }}>
            If you have questions about our use of cookies or this Cookie
            Policy, please contact us at{" "}
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
