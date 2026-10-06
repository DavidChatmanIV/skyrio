import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Lightweight JWT expiry check — no library needed, just decode the
// payload segment and compare its `exp` claim (seconds) to now.
//
// JWTs use base64URL ("-" and "_", no "=" padding). Plain atob() only
// understands standard base64, so it throws on some valid tokens — which
// the old version treated as "malformed" and logged the user out. Convert
// first, then decode.
function decodeJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) throw new Error("no payload");
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

function isTokenExpired(token) {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload.exp) return false; // no expiry claim — treat as valid
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // malformed/unreadable token — treat as invalid
  }
}

const PrivateRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const isAuthenticated = !!token && !isTokenExpired(token);

  // Token exists but is expired or malformed — clear the stale session
  // so the next load doesn't repeat this check against dead data.
  if (token && !isAuthenticated) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  if (!isAuthenticated) {
    // Remember where they were headed (e.g. /checkout/flight/complete after
    // paying) so the login page can send them back there.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children;
};

export default PrivateRoute;
