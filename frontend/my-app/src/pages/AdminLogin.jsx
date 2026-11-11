import React, { useState } from "react";
import { Form, Input, Button, Typography, message, Card } from "antd";
import { LockOutlined, UserOutlined, SafetyOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import { saveAdminToken, clearAdminToken } from "@/lib/adminAuth";
import { ADMIN } from "@/lib/adminTheme";

const { Title, Text } = Typography;

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const returnTo = location.state?.returnTo || "/admin";

  const handleLogin = async ({ email, password }) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Login failed");
      }

      message.success("Admin verified");
      localStorage.setItem("admin", "true");

      // ── Store email so dashboard can send it as fallback auth header ──
      localStorage.setItem("admin_email", email.toLowerCase());

      // Signed admin token, sent as X-Admin-Token on every admin call.
      // Needed when the browser blocks the cross-site admin cookie.
      clearAdminToken();
      const token = data.token || data.admin?.token;
      if (token) saveAdminToken(token);
      else
        console.warn(
          "[admin] Login response had no token. Is the new admin.routes.js deployed on Render?"
        );

      navigate(returnTo);
    } catch (err) {
      message.error(err?.message || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: ADMIN.pageBg, backgroundColor: ADMIN.pageBase, padding: 16 }}
    >
      <Card
        bordered={false}
        style={{
          width: 380,
          maxWidth: "100%",
          background: ADMIN.card,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 44px rgba(12,4,28,0.38)",
        }}
        className="osq-surface"
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <SafetyOutlined style={{ fontSize: 32, color: "#a78bfa" }} />
          <Title level={3} style={{ marginTop: 12 }}>
            Skyrio Admin Login
          </Title>
          <Text type="secondary">Restricted access — administrators only</Text>
        </div>
        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item
            name="email"
            label="Admin Email"
            rules={[
              { required: true, message: "Enter admin email" },
              { type: "email", message: "Invalid email format" },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="skyrio_admin@gmail.com"
              autoComplete="email"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Enter password" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginTop: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Verify Admin
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
