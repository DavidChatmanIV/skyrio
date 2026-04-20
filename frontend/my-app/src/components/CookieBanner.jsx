import React, { useState, useEffect } from "react";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookieConsent");
    if (!accepted) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "true");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "false");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 999999,
        maxWidth: 480,
        margin: "0 auto",
        background: "rgba(18, 10, 36, 0.97)",
        border: "1px solid rgba(255, 138, 42, 0.25)",
        borderRadius: 16,
        padding: "16px 20px",
        backdropFilter: "blur(20px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.5,
        }}
      >
        🍪 We use cookies to enhance your experience — saving trips, showing XP,
        and keeping you logged in.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={handleDecline}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 600,
            fontSize: 13,
            padding: "7px 16px",
            cursor: "pointer",
          }}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          style={{
            background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
            border: "none",
            borderRadius: 999,
            color: "#1a0d04",
            fontWeight: 700,
            fontSize: 13,
            padding: "7px 16px",
            cursor: "pointer",
          }}
        >
          Got it ✓
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;