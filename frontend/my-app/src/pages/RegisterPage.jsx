import React, { useMemo, useRef, useState, useEffect } from "react";
import { Input, Button, Typography, message, notification, Tag } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "../layout/AuthLayout";
import BoardingPassToast from "../components/BoardingPassToast";

import { useAuthModal } from "../auth/useAuth";

import galaxyLogin from "../assets/LoginBoardingpass/galaxy-login.png";
import "../styles/LoginBoardingPass.css";

const { Title, Text } = Typography;

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const authModal = useAuthModal();

  const successHandledRef = useRef(false);

  const redirectTo = useMemo(() => {
    const from = location.state?.from;
    if (typeof from === "string" && from.trim().startsWith("/")) return from;
    return "/dashboard";
  }, [location.state]);

  // ✅ Option A: routeLabel is now used in the UI (prettified)
  const routeLabel = useMemo(() => {
    if (redirectTo === "/dashboard") return "Dashboard";
    const raw = String(redirectTo || "");
    const cleaned = raw.replace(/^\//, "").replace(/-/g, " ");
    if (!cleaned) return "your account";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }, [redirectTo]);

  // ✅ Fix: actually use setFormData (controlled inputs)
  const updateField = (key) => (e) => {
    const value = e?.target?.value ?? e;
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const passenger = useMemo(() => {
    const raw =
      (formData.username || "").trim() ||
      (formData.name || "").trim() ||
      (formData.email || "").trim();

    if (!raw) return "Explorer";
    const cleaned = raw.includes("@") ? raw.split("@")[0] : raw;
    return cleaned.length > 18 ? cleaned.slice(0, 18) + "…" : cleaned;
  }, [formData.username, formData.name, formData.email]);

  useEffect(() => {
    if (!loading) setIsScanning(false);
  }, [loading]);

  const handleRegister = async () => {
    if (loading) return;
    if (successHandledRef.current) return;

    const name = (formData.name || "").trim();
    const username = (formData.username || "").trim();
    const email = (formData.email || "").trim();
    const password = formData.password || "";
    const confirmPassword = formData.confirmPassword || "";

    if (!email || !password) {
      message.warning("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      message.warning("Use at least 8 characters for your password.");
      return;
    }
    if (confirmPassword && confirmPassword !== password) {
      message.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    setIsScanning(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name || undefined,
          username: username || undefined,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      const displayName =
        data.user?.name || data.user?.username || passenger || "Explorer";

      successHandledRef.current = true;

      notification.open({
        message: null,
        description: (
          <BoardingPassToast
            name={displayName}
            routeFrom="Register"
            routeTo={routeLabel}
          />
        ),
        placement: "topRight",
        duration: 3,
        style: { background: "transparent", boxShadow: "none", padding: 0 },
      });

      message.success(`Account created. Welcome aboard, ${displayName} ✈️`);

      authModal?.closeAuthModal?.();
      nav(redirectTo, { replace: true });
    } catch (err) {
      successHandledRef.current = false;
      message.error(err.message || "Registration failed");
      setIsScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleRegister();
  };

  return (
    <AuthLayout>
      <div className="sk-authWrap">
        <div className="sk-authHero">
          <Title level={1} className="sk-authTitle">
            Create your passport
          </Title>

          <Text className="sk-authSubtitle">
            Start earning XP and unlock your first stamp.
          </Text>

          {/* ✅ Option A: show where we’ll send them after signup */}
          <div className="sk-authHintRow">
            <Text className="sk-authHintText">
              After signup, we’ll take you to{" "}
              <span className="sk-authPill">{routeLabel}</span>.
            </Text>
          </div>
        </div>

        <div
          className={`sk-pass ${isScanning ? "isScanning" : ""}`}
          style={{ "--sk-pass-bg": `url(${galaxyLogin})` }}
          onKeyDown={onKeyDown}
          role="form"
          aria-busy={loading ? "true" : "false"}
        >
          {/* =======================
              REGISTER FORM FIELDS
              ======================= */}
          <div className="sk-passBody">
            <div className="sk-passRow">
              <Text className="sk-passLabel">Full Name</Text>
              <Input
                prefix={<UserOutlined />}
                placeholder="Your name"
                value={formData.name}
                onChange={updateField("name")}
                disabled={loading}
              />
            </div>

            <div className="sk-passRow">
              <Text className="sk-passLabel">Username</Text>
              <Input
                prefix={<UserOutlined />}
                placeholder="Choose a username"
                value={formData.username}
                onChange={updateField("username")}
                disabled={loading}
              />
            </div>

            <div className="sk-passRow">
              <Text className="sk-passLabel">Email</Text>
              <Input
                prefix={<MailOutlined />}
                placeholder="you@example.com"
                value={formData.email}
                onChange={updateField("email")}
                disabled={loading}
              />
            </div>

            <div className="sk-passRow">
              <Text className="sk-passLabel">Password</Text>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={updateField("password")}
                disabled={loading}
              />
            </div>

            <div className="sk-passRow">
              <Text className="sk-passLabel">Confirm Password</Text>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={updateField("confirmPassword")}
                disabled={loading}
              />
            </div>

            {/* Optional helper tags (keeps your Tag import useful) */}
            <div className="sk-passTags">
              <Tag color="orange">Secure account</Tag>
              <Tag color="purple">Passport unlock</Tag>
              <Tag color="cyan">Earn XP</Tag>
            </div>

            <div className="sk-passActions">
              <Button
                type="primary"
                className="sk-passBtn"
                loading={loading}
                onClick={handleRegister}
              >
                Create Account
              </Button>

              <Button
                type="default"
                className="sk-passBtnGhost"
                disabled={loading}
                onClick={() => nav("/login", { state: { from: redirectTo } })}
              >
                I already have an account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}