import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Typography, Input, Button, Space, message } from "antd";
import { MailOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { apiUrl } from "@/lib/api";

import "../styles/auth-boarding.css";

const { Title, Text } = Typography;

export default function ResetPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const v = email.trim();
    if (!v || !v.includes("@")) {
      message.warning("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/reset/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v }),
      });
      await res.json().catch(() => ({}));
      setSent(true);
    } catch {
      message.error("Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sk-login sk-authWrap">
      <div className="sk-authHero">
        <Title className="sk-authTitle">Reset your boarding pass</Title>
        <Text className="sk-authSub">
          We'll send a reset link to your email.
        </Text>
      </div>

      <Card className="sk-boardingPass sk-surface" bordered={false}>
        {!sent ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div className="sk-field">
              <Text className="sk-label">Email</Text>
              <Input
                size="large"
                prefix={<MailOutlined />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                onPressEnter={onSubmit}
                className="sk-input"
                disabled={loading}
              />
            </div>

            <Button
              type="primary"
              className={[
                "sk-primaryBtn",
                loading ? "sk-loadingShimmer" : "",
              ].join(" ")}
              loading={loading}
              onClick={onSubmit}
              block
            >
              📩 Send reset link
            </Button>

            <Text className="sk-micro">
              If an account exists for that email, we'll send a link within a
              minute.
            </Text>

            <Button
              type="text"
              className="sk-link"
              onClick={() => nav("/login")}
              icon={<ArrowLeftOutlined />}
            >
              Back to sign in
            </Button>
          </Space>
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Title level={4} style={{ margin: 0 }}>
              Check your inbox
            </Title>
            <Text type="secondary">
              If an account exists for that email, you'll get a reset link in a
              minute.
            </Text>
            <Button
              type="primary"
              className="sk-primaryBtn"
              onClick={() => nav("/login")}
              block
            >
              Back to Sign In
            </Button>
          </Space>
        )}

        <div className="sk-barcodeRow" aria-hidden="true">
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={i} className="sk-bar" />
          ))}
        </div>
      </Card>

      <div className="sk-authFooter">
        <Text type="secondary">© {new Date().getFullYear()} Skyrio</Text>
      </div>
    </div>
  );
}
