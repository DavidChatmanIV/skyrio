// Under every Pay button: who handles the card, and where to get help.
// Short and true: Stripe processes the card; Skyrio never sees the full
// number; the guarantee and support pages are one tap away.
import { Link } from "react-router-dom";

const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const CSS = `
.sk-paysafe { margin-top: 12px; display: grid; gap: 4px; justify-items: center; text-align: center;
  font-size: 12px; line-height: 1.4; color: rgba(255,255,255,.62); }
.sk-paysafe__main { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,.8); font-weight: 600; }
.sk-paysafe__main svg { color: #ffb347; flex-shrink: 0; }
.sk-paysafe a, .sk-paysafe a:visited { color: #ffb347 !important; text-decoration: underline; text-underline-offset: 2px; }
`;

export default function PaySafeNote({ style }) {
  return (
    <div className="sk-paysafe" style={style}>
      <style>{CSS}</style>
      <span className="sk-paysafe__main">
        <LockIcon /> Secure payment by Stripe
      </span>
      <span>Skyrio never sees or stores your full card number.</span>
      <span>
        <Link to="/guarantee" target="_blank" rel="noopener">Our guarantee</Link>
        {" · "}
        <Link to="/support" target="_blank" rel="noopener">Get help</Link>
      </span>
    </div>
  );
}
