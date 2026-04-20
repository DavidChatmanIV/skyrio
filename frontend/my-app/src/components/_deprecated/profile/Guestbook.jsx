import React from "react";
import { Alert, Button, Space } from "antd";
import { useAuth } from "../auth/useAuth";

export default function GuestBanner() {
  const auth = useAuth();
  const isAuthed = !!auth?.user;

  if (isAuthed) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "12px auto" }}>
      <Alert
        type="info"
        showIcon
        message="You’re browsing as a guest"
        description={
          <Space wrap>
            <span>
              Log in to unlock your Passport, DMs, rewards, and saved trips.
            </span>
            <Button
              size="small"
              type="primary"
              onClick={() => auth?.openAuthModal?.({ mode: "login" })}
            >
              Log in
            </Button>
            <Button
              size="small"
              onClick={() => auth?.openAuthModal?.({ mode: "signup" })}
            >
              Sign up
            </Button>
          </Space>
        }
      />
    </div>
  );
}
