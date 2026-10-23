import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import "../styles/require-account.css";

/*
  Wrap any account-only feature:

    <RequireAccount feature="Sync Together" benefit="Plan trips with friends, split costs and book together.">
      <SyncTogetherPage />
    </RequireAccount>

  Logged-in users see the feature. Everyone else sees a clear
  "create a free profile" card that sends them back here after signing up.
*/

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export default function RequireAccount({ feature, benefit, children }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();

  // Wait for the session check so logged-in users never see a flash of the lock card
  if (loading) return null;
  if (isAuthed) return children;

  const backTo = location.pathname + location.search;

  return (
    <section className="sk-gate" aria-labelledby="sk-gate-title">
      <div className="sk-gateIcon">
        <LockIcon />
      </div>
      <h2 id="sk-gate-title" className="sk-gateTitle">
        {feature} needs a Skyrio profile
      </h2>
      {benefit && <p className="sk-gateText">{benefit}</p>}
      <p className="sk-gateText sk-gateFaint">Creating a profile is free.</p>
      <div className="sk-gateActions">
        <Link
          to="/register"
          state={{ redirectTo: backTo }}
          className="sk-gateBtn sk-gatePrimary"
        >
          Create your profile
        </Link>
        <Link
          to="/login"
          state={{ redirectTo: backTo }}
          className="sk-gateBtn sk-gateSecondary"
        >
          I already have an account
        </Link>
      </div>
    </section>
  );
}
