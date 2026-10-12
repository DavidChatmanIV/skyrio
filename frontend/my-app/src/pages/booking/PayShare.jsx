// src/pages/PayShare.jsx
// Old route: /pay-share/:splitPaymentId/:shareId
//
// The old "pay your share" links worked without logging in. Sync Together
// now has everyone book and pay for their own part from the trip page
// (logged in), so this page just points people there.

import React from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

export default function PayShare() {
  return (
    <div
      style={{
        maxWidth: 440,
        margin: "60px auto",
        padding: 28,
        borderRadius: 18,
        background: "rgba(16,12,34,0.85)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "#fff",
        textAlign: "center",
      }}
    >
      <Users size={30} color="#ff8a2a" />
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "12px 0 8px" }}>This link has moved</h1>
      <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
        Group trips now work differently: everyone books and pays for their own flight and room from the trip page. Nothing was
        charged from this link.
      </p>
      <Link
        to="/sync-together"
        style={{
          display: "inline-block",
          marginTop: 18,
          padding: "10px 22px",
          borderRadius: 12,
          background: "#ff8a2a",
          color: "#1b1024",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Open my group trips
      </Link>
    </div>
  );
}
