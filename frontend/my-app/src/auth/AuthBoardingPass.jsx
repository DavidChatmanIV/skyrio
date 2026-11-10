import React, { useMemo, useState } from "react";
import { Typography, Form, Input, Button, Space, Tag } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";
import "./AuthBoardingPass.css";

const { Title, Text } = Typography;

/**
 * mode: "login" | "signup"
 * onSubmit: async (values) => void
 * onSwitchMode: () => void
 * brand: string (default "Skyrio")
 */
export default function AuthBoardingPass({
  mode = "login",
  onSubmit,
  onSwitchMode,
  brand = "Skyrio",
}) {
  const [form] = Form.useForm();
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const values = Form.useWatch([], form);
  const passenger = useMemo(() => {
    const v = values || {};
    const raw =
      (isSignup ? v.username : v.identifier) || v.email || v.username || "";
    const cleaned = String(raw).trim();
    if (!cleaned) return "Explorer";
    // keep it short + premium
    return cleaned.length > 18 ? cleaned.slice(0, 18) + "…" : cleaned;
  }, [values, isSignup]);

  const CTA_TEXT = isSignup ? "Issue Boarding Pass" : "Confirm Boarding";

  const subtitle = isSignup
    ? "Start earning XP, saving trips, and planning smarter."
    : "Check in fast. Earn XP. Keep it moving.";

  async function handleFinish(vals) {
    try {
      setBusy(true);
      setScan(true);
      // let the scan play a beat
      setTimeout(() => setScan(false), 1100);

      await onSubmit?.(vals);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sk-authWrap">
      {/* Top headline (kept minimal; the pass is the hero) */}
      <div className="sk-authHero">
        <Title level={1} className="sk-authTitle">
          {isSignup ? "Create your Skyrio account" : "Welcome back, Explorer"}
        </Title>
        <Text className="sk-authSubtitle">{subtitle}</Text>
      </div>

      <div className={`sk-pass ${scan ? "isScanning" : ""}`}>
        {/* scan overlay */}
        <div className="sk-passScan" aria-hidden="true" />

        {/* ticket header */}
        <div className="sk-passHeader">
          <div className="sk-passBrand">
            <div className="sk-dot" />
            <Text className="sk-passBrandText">{brand}</Text>
          </div>

          <Tag className="sk-passChip">
            SKY <span className="sk-chipSep">•</span> Gate A3
          </Tag>
        </div>

        <div className="sk-passBig">
          <Text className="sk-passLabel">BOARDING PASS</Text>
        </div>

        {/* Passenger section (auto-updates) */}
        <div className="sk-passRow">
          <div className="sk-passCol">
            <Text className="sk-passMiniLabel">Passenger</Text>
            <Text className="sk-passPassenger">{passenger}</Text>
          </div>
          <div className="sk-passCol sk-passColRight">
            <Text className="sk-passMiniLabel">Status</Text>
            <Text className="sk-passValue">Ready</Text>
          </div>
        </div>

        {/* From / To section */}
        <div className="sk-passRoute">
          <div className="sk-routeCol">
            <Text className="sk-passMiniLabel">From</Text>
            <Text className="sk-passValue">{brand}</Text>
          </div>

          <div className="sk-routeLine" aria-hidden="true">
            <span className="sk-plane">✈</span>
            <span className="sk-routeDash" />
          </div>

          <div className="sk-routeCol sk-routeColRight">
            <Text className="sk-passMiniLabel">To</Text>
            <Text className="sk-passValue">Dashboard</Text>
          </div>
        </div>

        {/* perforation */}
        <div className="sk-passPerforation" aria-hidden="true">
          <span className="sk-notch left" />
          <span className="sk-notch right" />
          <span className="sk-perfLine" />
        </div>

        {/* form area */}
        <Form
          form={form}
          layout="vertical"
          className="sk-passForm"
          onFinish={handleFinish}
          requiredMark={false}
        >
          {isSignup ? (
            <>
              <Form.Item
                label={<span className="sk-formLabel">Username</span>}
                name="username"
                rules={[
                  { required: true, message: "Please choose a username" },
                  { min: 3, message: "Username must be at least 3 characters" },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Username"
                  autoComplete="username"
                  onFocus={() => setScan(true)}
                  onBlur={() => setScan(false)}
                />
              </Form.Item>

              <Form.Item
                label={
                  <span className="sk-formLabel">Full name (optional)</span>
                }
                name="fullName"
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Full name (optional)"
                  autoComplete="name"
                />
              </Form.Item>

              <Form.Item
                label={<span className="sk-formLabel">Email</span>}
                name="email"
                rules={[
                  { required: true, message: "Please enter your email" },
                  { type: "email", message: "Enter a valid email" },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Email"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                label={<span className="sk-formLabel">Password</span>}
                name="password"
                rules={[
                  { required: true, message: "Please create a password" },
                  { min: 8, message: "Use at least 8 characters" },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                label={<span className="sk-formLabel">Confirm password</span>}
                name="confirmPassword"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Please confirm your password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value)
                        return Promise.resolve();
                      return Promise.reject(
                        new Error("Passwords do not match")
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                label={<span className="sk-formLabel">Email or username</span>}
                name="identifier"
                rules={[
                  { required: true, message: "Enter your email or username" },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Email or username"
                  autoComplete="username"
                  onFocus={() => setScan(true)}
                  onBlur={() => setScan(false)}
                />
              </Form.Item>

              <Form.Item
                label={<span className="sk-formLabel">Password</span>}
                name="password"
                rules={[{ required: true, message: "Enter your password" }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Password"
                  autoComplete="current-password"
                />
              </Form.Item>
            </>
          )}

          <Button
            htmlType="submit"
            className="sk-passCTA"
            loading={busy}
            disabled={busy}
            block
          >
            {CTA_TEXT}
          </Button>

          <div className="sk-authFooter">
            <Space size={6} wrap>
              <Text className="sk-footerText">
                {isSignup ? "Already traveling?" : "New here?"}
              </Text>
              <button
                type="button"
                className="sk-footerLink"
                onClick={onSwitchMode}
              >
                {isSignup ? "Log in" : "Create a boarding pass"}
              </button>
            </Space>
          </div>

          <div className="sk-authFineprint">
            <Text className="sk-fineText">
              By continuing, you agree to Skyrio&apos;s Terms and Privacy.
            </Text>
          </div>
        </Form>
      </div>

      <div className="sk-authCopyright">
        <Text className="sk-fineText">© 2026 Skyrio</Text>
      </div>
    </div>
  );
}