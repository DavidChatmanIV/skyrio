import React, { useState } from "react";
import { Typography, Button, Space, message } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

import AuthModal from "@/auth/AuthModal";
import { useAuth } from "@/auth/useAuth";

import "@/styles/login.css";

const { Title, Text } = Typography;

export default function RequireAuthBlock({
  feature = "this feature",
  children,
}) {
  const auth = useAuth();
  const isAuthed = !!auth?.user;

  const [open, setOpen] = useState(false);

  const nav = useNavigate();
  const location = useLocation();

  const path = (location?.pathname || "").toLowerCase();
  const toLabel = path.includes("passport")
    ? "Passport"
    : path.includes("dm")
    ? "Messages"
    : path.includes("questfeed")
    ? "Quest Feed"
    : "Skyrio";

  const fromLabel = "Guest";

  if (isAuthed) return children;

  return (
    <div className="sk-authBlock">
      <div className="glow g1" aria-hidden />
      <div className="glow g2" aria-hidden />
      <div className="glow g3" aria-hidden />

      <div className="sk-authBlockCard">
        <div className="pass" role="region" aria-label="Login required">
          <div className="pass-notch" aria-hidden />

          <div className="pass-header">
            <div className="pass-airline">
              <span className="pass-chip" aria-hidden />
              <span className="pass-airline-name">Skyrio Access</span>
            </div>

            <div className="pass-mini">
              <Text className="pass-mini-label">Gate</Text>
              <div className="pass-mini-pill">SKY</div>
            </div>
          </div>

          <div className="pass-route">
            <div className="route-col">
              <Text className="route-label">From</Text>
              <div className="route-value">{fromLabel}</div>
            </div>

            <div className="route-mid" aria-hidden>
              ✨
            </div>

            <div className="route-col right">
              <Text className="route-label">To</Text>
              <div className="route-value">{toLabel}</div>
            </div>
          </div>

          <div className="pass-divider" aria-hidden />

          <div className="pass-form">
            <Title level={4} style={{ marginTop: 0 }}>
              Log in to access {feature}
            </Title>

            <Text className="auth-subtitle" style={{ display: "block" }}>
              You can browse Skyrio as a guest. Log in to save progress, earn
              XP, and personalize your experience.
            </Text>

            <div style={{ marginTop: 14 }}>
              <Space wrap>
                <Button
                  type="primary"
                  className="pass-cta"
                  onClick={() => setOpen(true)}
                >
                  Log in / Sign up
                </Button>

                <Button
                  className="sk-pillBtn"
                  onClick={() => {
                    message.info("No worries — you can log in anytime.");
                    setOpen(false);
                  }}
                >
                  Not now
                </Button>

                <Button
                  type="link"
                  className="link-btn"
                  onClick={() => nav("/register")}
                >
                  Create account
                </Button>
              </Space>
            </div>
          </div>

          <div className="pass-divider dotted" aria-hidden />

          <div className="pass-barcode" aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      </div>

      <AuthModal open={open} onClose={() => setOpen(false)} intent="continue" />
    </div>
  );
}