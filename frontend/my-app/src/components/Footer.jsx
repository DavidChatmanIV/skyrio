import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
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
        { label: "Badges & Rewards", to: "/passport/rewards" },
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
        { label: "Booking Guarantee", to: "/guarantee" },
        { label: "Help Center", href: `mailto:${SUPPORT_EMAIL}` },
        { label: "Contact Us", href: `mailto:${SUPPORT_EMAIL}` },
        { label: "Report an Issue", href: `mailto:${SUPPORT_EMAIL}` },
      ],
    },
    // Privacy, Terms and Cookies live once, in the bottom bar (they were
    // also a 4th "Legal" column, so each showed up twice).
  ];
}

export default function Footer() {
  const { isAuthed } = useAuth();
  const cols = navCols(isAuthed);

  return (
    <footer className="sk-footer">
      {/* ── Who sets the rules ──
          First thing in the footer, in a box, so people actually see it.
          Same message as the notes in checkout and the confirmation emails. */}
      <div style={{ padding: "32px 16px 0" }}>
        <div
          role="note"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            maxWidth: 900,
            margin: "0 auto",
            padding: "16px 18px",
            borderRadius: 16,
            background:
              "linear-gradient(160deg, rgba(74,40,112,0.6), rgba(34,18,62,0.7))",
            border: "1px solid rgba(255,179,71,0.45)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
            fontSize: 14,
            lineHeight: 1.6,
            textAlign: "left",
            color: "rgba(255,255,255,0.88)",
          }}
        >
          <ShieldCheck
            size={20}
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: 2, color: "#ffb347" }}
          />
          <span>
            <b style={{ color: "#fff" }}>
              Airlines and hotels set their own rules.
            </b>{" "}
            Fares, carry-on and checked bags, seats, changes, refunds and
            cancellations are set by each airline and hotel, not Skyrio. If
            something goes wrong on Skyrio&rsquo;s end, our{" "}
            <Link to="/guarantee" style={{ color: "#ffb347", fontWeight: 700 }}>
              Booking Guarantee
            </Link>{" "}
            covers you.
          </span>
        </div>
      </div>

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
      {/* Extra room at the bottom so the floating Atlas / Help buttons
          don't sit on top of these links. */}
      <div className="sk-footer__bottom" style={{ paddingBottom: 88 }}>
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
