import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Tabs,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import { trackSoftEvent } from "@/lib/softAnalytics";

const { Text } = Typography;

const INTENT_COPY = {
  save: {
    title: "Log in to save trips ✨",
    kicker:
      "Save this trip to your Passport so it's waiting when you're ready.",
    perk: "✅ Saves to your account • 🔔 Price alerts later • 🧾 Receipts & history",
  },
  dm: {
    title: "Log in to message ✨",
    kicker:
      "DMs are tied to your identity so conversations stay safe and real.",
    perk: "✅ Message history • 🛡 Safer community • 🔕 Mute / block controls",
  },
  post: {
    title: "Log in to post ✨",
    kicker: "Posting requires an account so your content stays yours.",
    perk: "✅ Verified profile • 💬 Replies • 🚫 Report / moderation tools",
  },
  book: {
    title: "Log in to book ✨",
    kicker: "Bookings link to your Passport so confirmations don't get lost.",
    perk: "✅ Trip timeline • 🧾 Confirmation vault • 🎁 XP rewards",
  },
  continue: {
    title: "Log in to continue ✨",
    kicker: "Create a boarding pass to unlock your full Skyrio experience.",
    perk: "✅ Save + sync • 🧠 Personalized picks • 🧳 Passport perks",
  },
};

export default function AuthModal({
  open,
  onClose,
  intent = "continue",
  redirectTo = "/passport",
}) {
  const nav = useNavigate();
  const { login, signup, continueAsGuest } = useAuth();

  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);

  // ✅ lightweight “copy animation”
  const [animateKey, setAnimateKey] = useState(0);

  const copy = useMemo(() => {
    return INTENT_COPY[intent] || INTENT_COPY.continue;
  }, [intent]);

  useEffect(() => {
    if (open) setAnimateKey((k) => k + 1);
  }, [open, intent]);

  function finishSuccess(method = "login") {
    trackSoftEvent("auth_success", { method, intent, redirectTo });
    onClose?.();
    if (redirectTo) nav(redirectTo, { state: { fromAuth: true } });
  }

  async function onLogin(values) {
    setLoading(true);
    try {
      const ok = await login({
        emailOrUsername: values.emailOrUsername,
        password: values.password,
      });
      if (ok) finishSuccess("login");
    } catch (err) {
      message.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSignup(values) {
    setLoading(true);
    try {
      const ok = await signup(values);
      if (ok) finishSuccess("signup");
    } catch (err) {
      message.error(err?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      title={copy.title}
      destroyOnClose
    >
      {/* ✅ Intent copy “animation” (simple, premium) */}
      <div key={animateKey} className="sk-authCopyBlock">
        <Text className="sk-authKicker">{copy.kicker}</Text>
        <Text type="secondary" className="sk-authPerk">
          {copy.perk}
        </Text>
      </div>

      <Divider style={{ margin: "14px 0" }} />

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "login",
            label: "Log in",
            children: (
              <Form layout="vertical" onFinish={onLogin}>
                <Form.Item
                  name="emailOrUsername"
                  label="Email or username"
                  rules={[
                    {
                      required: true,
                      message: "Email or username is required",
                    },
                  ]}
                >
                  <Input
                    placeholder="you@email.com or @username"
                    autoComplete="username"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Password"
                  rules={[{ required: true, message: "Password is required" }]}
                >
                  <Input.Password
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </Form.Item>

                <Button
                  htmlType="submit"
                  type="primary"
                  block
                  loading={loading}
                >
                  Log in
                </Button>
              </Form>
            ),
          },
          {
            key: "signup",
            label: "Sign up",
            children: (
              <Form layout="vertical" onFinish={onSignup}>
                <Form.Item name="name" label="Name">
                  <Input placeholder="David" autoComplete="name" />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[{ required: true, message: "Email is required" }]}
                >
                  <Input placeholder="you@email.com" autoComplete="email" />
                </Form.Item>

                <Form.Item name="username" label="Username (optional)">
                  <Input placeholder="@explorer" autoComplete="username" />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: "Password is required" },
                    {
                      min: 6,
                      message: "Password must be at least 6 characters",
                    },
                  ]}
                >
                  <Input.Password
                    placeholder="6+ characters"
                    autoComplete="new-password"
                  />
                </Form.Item>

                <Button
                  htmlType="submit"
                  type="primary"
                  block
                  loading={loading}
                >
                  Create account
                </Button>
              </Form>
            ),
          },
        ]}
      />

      <Divider style={{ margin: "14px 0" }} />

      <Space direction="vertical" style={{ width: "100%" }}>
        <Button
          onClick={() => {
            trackSoftEvent("guest_continue", { intent, redirectTo });
            continueAsGuest?.();
            onClose?.();
            if (redirectTo) nav(redirectTo, { state: { fromAuth: true } });
          }}
          block
        >
          Continue as guest
        </Button>

        <Text type="secondary" style={{ fontSize: 12 }}>
          You can upgrade anytime. Guest mode won&apos;t save posts, DMs, or trips.
        </Text>
      </Space>
    </Modal>
  );
}