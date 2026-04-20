import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Result, Button, Spin } from "antd";
import { useAuth } from "../auth/useAuth";

/**
 * RequireRole
 * - allowedRoles: array of roles allowed (e.g. ["admin", "manager"])
 * - redirectTo: where the "Back" button sends blocked users (default: "/dashboard")
 */
export default function RequireRole({
  allowedRoles = [],
  redirectTo = "/dashboard",
  children,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still fetching user (checking token, etc.)
  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" tip="Checking your access..." />
      </div>
    );
  }

  // Not logged in → push to login, remember where they came from
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname || "/admin" }}
      />
    );
  }

  const userRole = user.role || "user";

  // If no roles passed, treat as open route
  if (!allowedRoles.length) {
    return <>{children}</>;
  }

  const isAllowed = allowedRoles.includes(userRole);

  if (!isAllowed) {
    // Logged in but not allowed → show 403 with a button
    return (
      <Result
        status="403"
        title="Access denied"
        subTitle="You don't have permission to view this page."
        extra={
          <Button type="primary" href={redirectTo}>
            Back to dashboard
          </Button>
        }
      />
    );
  }

  // Allowed → render the child content
  return <>{children}</>;
}