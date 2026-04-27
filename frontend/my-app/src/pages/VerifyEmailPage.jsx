import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!token) return setStatus("error");

    fetch(`${API}/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => setStatus(data.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#09071a",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "40px 32px",
          maxWidth: 420,
          width: "90%",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✈️</div>
            <p style={{ color: "#fff", fontSize: 16 }}>Verifying your email…</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "#ff8a2a", marginBottom: 8 }}>
              Email verified!
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>
              Your Skyrio account is now fully active.
            </p>
            <Link
              to="/login"
              style={{
                background: "linear-gradient(135deg,#ff8a2a,#ffb066)",
                color: "#1a0800",
                padding: "12px 28px",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Go to Login
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: "#ff4d6d", marginBottom: 8 }}>
              Link invalid or expired
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>
              Request a new verification email from your profile settings.
            </p>
            <Link to="/" style={{ color: "#ff8a2a", fontSize: 14 }}>
              Back to Skyrio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
