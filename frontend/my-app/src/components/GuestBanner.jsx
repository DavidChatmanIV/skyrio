import React, { useState } from "react";
import { Alert, Button, Space } from "antd";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalController";

export default function GuestBanner() {
  const { isGuest, isAuthed } = useAuth();
  const { openAuth } = useAuthModal();
  const [dismissed, setDismissed] = useState(false);

  if (!isGuest || isAuthed || dismissed) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "12px auto 0", padding: "0 16px" }}>
      <Alert
        type="info"
        showIcon
        message="You're browsing as a Guest"
        description={
          <Space wrap>
            <span>
              Log in to unlock Passport, DMs, posting, and saved trips.
            </span>
            <Button
              size="small"
              onClick={() =>
                openAuth({
                  intent: "login",
                  reason: "Log in to keep your progress.",
                })
              }
            >
              Log in
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() =>
                openAuth({
                  intent: "signup",
                  reason: "Create an account to save trips + earn XP.",
                })
              }
            >
              Create account
            </Button>
            <Button size="small" type="text" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </Space>
        }
      />
    </div>
  );
}