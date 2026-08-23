import React from "react";
import { Navigate } from "react-router-dom";

// Lightweight JWT expiry check — no library needed, just decode the
// payload segment and compare its `exp` claim (seconds) to now.
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return false; // no expiry claim — treat as valid
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // malformed/unreadable token — treat as invalid
  }
}

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const isAuthenticated = !!token && !isTokenExpired(token);

  // Token exists but is expired or malformed — clear the stale session
  // so the next load doesn't repeat this check against dead data.
  if (token && !isAuthenticated) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
