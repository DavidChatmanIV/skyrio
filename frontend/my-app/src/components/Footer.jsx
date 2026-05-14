import { Link } from "react-router-dom";
import "@/styles/Footer.css";

const SUPPORT_EMAIL = "support@skyrioofficial.com";
const YEAR = new Date().getFullYear();

const NAV_COLS = [
  {
    heading: "Product",
    links: [
      { label: "Discover", to: "/" },
      { label: "Book a Flight", to: "/booking" },
      { label: "Hotels", to: "/booking" },
      { label: "SkyHub Community", to: "/skyhub" },
      { label: "Digital Passport", to: "/passport" },
      { label: "Sync Together", to: "/sync-together" },
    ],
  },
  {
    heading: "Passport",
    links: [
      { label: "XP & Levels", to: "/passport" },
      { label: "Badges & Rewards", to: "/passport" },
      { label: "Upgrade Passport", to: "/membership" },
      { label: "Leaderboard", to: "/passport" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help Center", href: `mailto:${SUPPORT_EMAIL}` },
      { label: "Contact Us", href: `mailto:${SUPPORT_EMAIL}` },
      { label: "Report an Issue", href: `mailto:${SUPPORT_EMAIL}` },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="sk-footer">
      <div className="sk-footer__inner">
        {/* ── Brand ── */}
        <div className="sk-footer__brand">
          <div className="sk-footer__logo">✦ Skyrio</div>
          <p className="sk-footer__tagline">Plan smarter. Travel better.</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="sk-footer__email">
            {SUPPORT_EMAIL}
          </a>
          <div className="sk-footer__badge">
            <span className="sk-footer__badge-dot" />
            Soft Launch — July 2026
          </div>
        </div>

        {/* ── Nav columns ── */}
        {NAV_COLS.map((col) => (
          <div key={col.heading} className="sk-footer__col">
            <div className="sk-footer__col-heading">{col.heading}</div>
            <ul className="sk-footer__links">
              {col.links.map((l) =>
                l.href ? (
                  <li key={l.label}>
                    <a href={l.href} className="sk-footer__link">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.label}>
                    <Link to={l.to} className="sk-footer__link">
                      {l.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div className="sk-footer__bottom">
        <div className="sk-footer__bottom-inner">
          <span className="sk-footer__copy">
            © {YEAR} Skyrio. All rights reserved.
          </span>
          <div className="sk-footer__legal">
            <Link to="/privacy" className="sk-footer__legal-link">
              Privacy Policy
            </Link>
            <span className="sk-footer__legal-sep">·</span>
            <Link to="/terms" className="sk-footer__legal-link">
              Terms of Service
            </Link>
            <span className="sk-footer__legal-sep">·</span>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="sk-footer__legal-link"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
