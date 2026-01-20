import React, { useState, useRef, useMemo, useEffect } from "react";
import { Input, Button, message, Typography, notification } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";

import BoardingPassToast from "../components/BoardingPassToast";
import AuthLayout from "../layout/AuthLayout";
import { useAuthModal } from "../auth/AuthModalController";
import { useAuth } from "../auth/useAuth";

import galaxyLogin from "../assets/LoginBoardingpass/galaxy-login.png";
import gateBg from "../assets/LoginBoardingpass/gate.png";
import "../styles/login.css";

const { Title, Text } = Typography;

export default function LoginPage() {
  const auth = useAuth();
  const authModal = useAuthModal();

  const nav = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const successHandledRef = useRef(false);

  const redirectTo = useMemo(() => {
    const rt = location.state?.redirectTo || location.state?.from;
    if (typeof rt === "string" && rt.trim().startsWith("/")) return rt;
    return "/passport";
  }, [location.state]);

  const passenger = useMemo(() => {
    const raw = (formData.emailOrUsername || "").trim();
    if (!raw) return "Explorer";
    const cleaned = raw.includes("@") ? raw.split("@")[0] : raw;
    return cleaned.length > 18 ? cleaned.slice(0, 18) + "…" : cleaned;
  }, [formData.emailOrUsername]);

  useEffect(() => {
    if (!loading) setIsScanning(false);
  }, [loading]);

  const handleLogin = async () => {
    if (loading) return;
    if (successHandledRef.current) return;

    const emailOrUsername = (formData.emailOrUsername || "").trim();
    const password = formData.password || "";

    if (!emailOrUsername || !password) {
      message.warning("Enter your email/username and password.");
      return;
    }

    setLoading(true);
    setIsScanning(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: emailOrUsername,
          emailOrUsername,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Login failed");

      if (auth?.login) {
        auth.login(data.token, data.user);
      } else {
        localStorage.setItem("token", data.token);
        if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      }

      const displayName =
        data.user?.name ||
        data.user?.username ||
        (data.user?.email ? data.user.email.split("@")[0] : passenger);

      successHandledRef.current = true;

      notification.open({
        message: null,
        description: (
          <BoardingPassToast
            name={displayName}
            routeFrom="Login"
            routeTo={redirectTo === "/dashboard" ? "Dashboard" : redirectTo}
          />
        ),
        placement: "topRight",
        duration: 3,
        style: { background: "transparent", boxShadow: "none", padding: 0 },
      });

      message.success(`Welcome aboard, ${displayName} ✈️`);

      authModal?.closeAuthModal?.();
      nav(redirectTo, { replace: true, state: { fromAuth: true } });
    } catch (err) {
      successHandledRef.current = false;
      message.error(err?.message || "Login failed");
      setIsScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const onGuest = () => {
    if (loading) return;

    auth?.guestLogin?.();

    notification.open({
      message: null,
      description: (
        <BoardingPassToast name="Guest" routeFrom="Login" routeTo="/passport" />
      ),
      placement: "topRight",
      duration: 2.5,
      style: { background: "transparent", boxShadow: "none", padding: 0 },
    });

    nav("/passport", { state: { fromAuth: true } });
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const routeLabel = redirectTo === "/dashboard" ? "Dashboard" : redirectTo;

  return (
    <AuthLayout>
      {/* ✅ auth-scene login is future-proof for mirrored logout */}
      <div className="auth-scene login">
        <div className="sk-loginPage">
          <div
            className="sk-loginBg"
            style={{ backgroundImage: `url(${gateBg})` }}
            aria-hidden="true"
          />

          <div className="sk-loginWrap">
            <div className="sk-loginInner">
              <div className="sk-authHero">
                <Title level={2} className="sk-authTitle">
                  Welcome back, {passenger}
                </Title>
                <Text className="sk-authSubtitle">
                  Check in fast. Earn XP. Keep it moving.
                </Text>
              </div>
            </div>

            {/* ✅ WIDE BOARDING PASS (mock-style) */}
            <div
              className={`sk-passCard sk-passWide ${
                isScanning ? "isScanning" : ""
              }`}
              style={{
                "--sk-pass-bg": `url(${galaxyLogin})`,
                "--sk-gateImg": `url(${gateBg})`,
              }}
              onKeyDown={onKeyDown}
              role="form"
              aria-busy={loading ? "true" : "false"}
            >
              <div className="sk-passGlow" />
              <div className="sk-passScan" aria-hidden="true" />

              {/* ✅ Main + Stub */}
              <div className="sk-passGrid">
                {/* MAIN */}
                <div className="sk-passMain">
                  <div className="sk-passHeader">
                    <div className="sk-brandRow">
                      <span className="sk-dot" />
                      <span className="sk-brand">Skyrio</span>
                    </div>

                    <div className="sk-chipRow">
                      <span className="sk-chip">SKY</span>
                      <span className="sk-chip">Gate A3</span>
                    </div>
                  </div>

                  <div className="sk-passTitle">
                    <div className="sk-kicker">BOARDING PASS</div>
                  </div>

                  <div className="sk-idGrid">
                    <div className="sk-idBlock">
                      <div className="sk-label">PASSENGER</div>
                      <div className="sk-value">{passenger}</div>
                    </div>

                    <div className="sk-idBlock sk-right">
                      <div className="sk-label">STATUS</div>
                      <div className="sk-statusPill">
                        {loading ? "Checking in…" : "Ready"}
                      </div>
                    </div>

                    <div className="sk-idBlock">
                      <div className="sk-label">FROM</div>
                      <div className="sk-smallValue">Login</div>
                    </div>

                    <div className="sk-idBlock sk-right">
                      <div className="sk-label">TO</div>
                      <div className="sk-smallValue">{routeLabel}</div>
                    </div>
                  </div>

                  <div className="sk-flightLine" aria-hidden="true">
                    <div className="sk-lineDot" />
                    <div className="sk-line" />
                    <div className="sk-plane">✈︎</div>
                    <div className="sk-line" />
                    <div className="sk-lineDot" />
                  </div>

                  <div className="sk-form">
                    <div className="sk-field">
                      <div className="sk-fieldLabel">EMAIL OR USERNAME</div>
                      <Input
                        value={formData.emailOrUsername}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emailOrUsername: e.target.value,
                          })
                        }
                        placeholder="Email or username"
                        prefix={<UserOutlined />}
                        className="sk-input"
                        autoComplete="username"
                        size="large"
                        onFocus={() => setIsScanning(true)}
                        onBlur={() => !loading && setIsScanning(false)}
                      />
                    </div>

                    <div className="sk-field">
                      <div className="sk-fieldLabel">PASSWORD</div>
                      <Input.Password
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Password"
                        prefix={<LockOutlined />}
                        className="sk-input"
                        autoComplete="current-password"
                        size="large"
                        onFocus={() => setIsScanning(true)}
                        onBlur={() => !loading && setIsScanning(false)}
                        iconRender={(visible) =>
                          visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                        }
                      />
                    </div>

                    <Button
                      className="sk-ctaBtn"
                      type="primary"
                      block
                      size="large"
                      loading={loading}
                      onClick={handleLogin}
                    >
                      Confirm Boarding
                    </Button>

                    <div className="sk-secondary">
                      <Text className="sk-muted">
                        New to Skyrio?{" "}
                        <button
                          type="button"
                          onClick={() =>
                            authModal?.setAuthModalMode?.("signup")
                          }
                          className="sk-inlineBtnLink"
                        >
                          Create your boarding pass
                        </button>
                      </Text>

                      <Button
                        className="sk-ghostBtn"
                        block
                        onClick={onGuest}
                        disabled={loading}
                      >
                        Preview as Guest
                      </Button>

                      <Text className="sk-muted sk-micro">
                        Some features require an account.
                      </Text>

                      <div className="sk-linksRow">
                        <Link className="sk-linkSmall" to="/reset">
                          Forgot password?
                        </Link>
                        <span className="sk-sep">•</span>
                        <Link className="sk-linkSmall sk-strong" to="/register">
                          Create a boarding pass
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="sk-cardFooter">
                    © {new Date().getFullYear()} Skyrio
                  </div>
                </div>

                {/* STUB */}
                <div className="sk-passStub" aria-hidden="true">
                  <div className="sk-stubTop">
                    <div className="sk-stubGate">SKYGATE A3</div>
                  </div>

                  <div className="sk-qrBox">
                    <div className="sk-qr" />
                    <div className="sk-qrHint">SCAN TO BOARD</div>
                  </div>

                  <div className="sk-stubBarcode">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <span key={i} className="sk-bar" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}