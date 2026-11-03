import { Link } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import "@/styles/Footer.css";

const SUPPORT_EMAIL = "skyrioofficial@gmail.com";
const YEAR = new Date().getFullYear();

// "My trips" needs an account; guests manage a booking with the link in
// their confirmation email, or look it up on Find my booking.
function navCols(isAuthed) {
  return [
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
      ],
    },
    {
      // Bookings first: where to view, change or cancel a flight or hotel.
      // (Kept in this column so the footer layout keeps its 4 columns.)
      heading: "Support",
      links: [
        isAuthed
          ? { label: "My trips", to: "/saved-trips" }
          : { label: "Find my booking", to: "/find-booking" },
        {
          label: "Cancel a booking",
          to: isAuthed ? "/saved-trips" : "/find-booking",
        },
        { label: "Help Center", href: `mailto:${SUPPORT_EMAIL}` },
        { label: "Contact Us", href: `mailto:${SUPPORT_EMAIL}` },
        { label: "Report an Issue", href: `mailto:${SUPPORT_EMAIL}` },
      ],
    },
    // Legal column — required for GDPR/CCPA compliance
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", to: "/privacy" },
        { label: "Terms of Service", to: "/terms" },
        { label: "Cookie Policy", to: "/cookies" },
      ],
    },
  ];
}

export default function Footer() {
  const { isAuthed } = useAuth();
  const cols = navCols(isAuthed);

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
        </div>

        {/* ── Nav columns ── */}
        {cols.map((col) => (
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
            <Link
              to={isAuthed ? "/saved-trips" : "/find-booking"}
              className="sk-footer__legal-link"
            >
              Manage a booking
            </Link>
            <span className="sk-footer__legal-sep">·</span>
            <Link to="/privacy" className="sk-footer__legal-link">
              Privacy Policy
            </Link>
            <span className="sk-footer__legal-sep">·</span>
            <Link to="/terms" className="sk-footer__legal-link">
              Terms of Service
            </Link>
            <span className="sk-footer__legal-sep">·</span>
            <Link to="/cookies" className="sk-footer__legal-link">
              Cookie Policy
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
