import React, { useState, useRef, useMemo, useEffect } from "react";
import { Input, Button, message, Typography, notification } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";

import BoardingPassToast from "../components/BoardingPassToast";
import PassStub from "../components/PassStub";
import AuthLayout from "../layout/AuthLayout";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/useAuthModal";

import galaxyLogin from "../assets/LoginBoardingpass/galaxy-login.png";
import gateBg from "../assets/LoginBoardingpass/gate.png";
import "../styles/login.css";

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || "";

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
  // Shown in a visible box above the button (not just a toast)
  const [loginError, setLoginError] = useState("");
  // Which inputs get the red outline: "both" | "email" | "password" | ""
  const [errorFields, setErrorFields] = useState("");
  const successHandledRef = useRef(false);

  const clearError = () => {
    if (loginError) setLoginError("");
    if (errorFields) setErrorFields("");
  };

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
    if (loading || successHandledRef.current) return;
    const emailOrUsername = (formData.emailOrUsername || "").trim();
    const password = formData.password || "";
    if (!emailOrUsername || !password) {
      setLoginError("Enter your email or username and your password.");
      setErrorFields(
        !emailOrUsername && !password
          ? "both"
          : !emailOrUsername
          ? "email"
          : "password"
      );
      return;
    }

    setLoginError("");
    setErrorFields("");
    setLoading(true);
    setIsScanning(true);

    let res;
    try {
      res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: emailOrUsername,
          emailOrUsername,
          password,
        }),
      });
    } catch {
      // Network down / server unreachable
      setLoginError(
        "Can't reach Skyrio right now. Check your connection and try again."
      );
      setIsScanning(false);
      setLoading(false);
      return;
    }

    try {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          // Wrong password or unknown account — same message either way,
          // so the page never reveals which emails have accounts.
          setLoginError("Wrong email/username or password. Please try again.");
          setErrorFields("both");
          setFormData((f) => ({ ...f, password: "" }));
        } else if (res.status === 429) {
          setLoginError(
            "Too many login attempts. Wait a few minutes and try again."
          );
        } else {
          setLoginError(
            data?.message || data?.error || "Login failed. Please try again."
          );
        }
        successHandledRef.current = false;
        setIsScanning(false);
        return;
      }

      if (auth?.setSession)
        auth.setSession({ token: data?.token, user: data?.user });
      else {
        if (data?.token) localStorage.setItem("token", data.token);
        if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
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
      setLoginError(err?.message || "Login failed. Please try again.");
      setIsScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const onGuest = () => {
    if (loading) return;
    if (auth?.continueAsGuest) auth.continueAsGuest();
    else if (auth?.guestLogin) auth.guestLogin();
    notification.open({
      message: null,
      description: (
        <BoardingPassToast name="Guest" routeFrom="Login" routeTo="/booking" />
      ),
      placement: "topRight",
      duration: 2.5,
      style: { background: "transparent", boxShadow: "none", padding: 0 },
    });
    nav("/booking", { state: { fromAuth: true } });
  };

  const goToSignup = () => nav("/register");
  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };
  const routeLabel = redirectTo === "/dashboard" ? "Dashboard" : redirectTo;

  return (
    <AuthLayout>
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

              <div className="sk-passGrid">
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
                    <div className="sk-kicker">SKYRIO ACCESS</div>
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
                        onChange={(e) => {
                          clearError();
                          setFormData({
                            ...formData,
                            emailOrUsername: e.target.value,
                          });
                        }}
                        placeholder="Email or username"
                        prefix={<UserOutlined />}
                        className="sk-input"
                        status={
                          errorFields === "both" || errorFields === "email"
                            ? "error"
                            : undefined
                        }
                        aria-invalid={
                          errorFields === "both" || errorFields === "email"
                        }
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
                        onChange={(e) => {
                          clearError();
                          setFormData({
                            ...formData,
                            password: e.target.value,
                          });
                        }}
                        placeholder="Password"
                        prefix={<LockOutlined />}
                        className="sk-input"
                        status={
                          errorFields === "both" || errorFields === "password"
                            ? "error"
                            : undefined
                        }
                        aria-invalid={
                          errorFields === "both" || errorFields === "password"
                        }
                        autoComplete="current-password"
                        size="large"
                        onFocus={() => setIsScanning(true)}
                        onBlur={() => !loading && setIsScanning(false)}
                        iconRender={(visible) =>
                          visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                        }
                      />
                    </div>

                    {loginError && (
                      <div
                        className="sk-loginError"
                        role="alert"
                        aria-live="assertive"
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          margin: "4px 0 14px",
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: "rgba(255, 77, 79, 0.14)",
                          border: "1px solid rgba(255, 99, 99, 0.55)",
                          borderLeft: "4px solid #ff5a4f",
                          color: "#ffd9d6",
                          fontSize: 14,
                          fontWeight: 600,
                          lineHeight: 1.4,
                          backdropFilter: "blur(8px)",
                          animation: "skLoginShake 0.35s ease",
                        }}
                      >
                        <ExclamationCircleOutlined
                          style={{
                            color: "#ff6b61",
                            fontSize: 18,
                            marginTop: 1,
                          }}
                        />
                        <div>
                          <div>{loginError}</div>
                          {errorFields === "both" && (
                            <Link
                              to="/reset"
                              style={{
                                display: "inline-block",
                                marginTop: 4,
                                color: "#ff9a3c",
                                fontWeight: 600,
                                fontSize: 13,
                              }}
                            >
                              Forgot your password?
                            </Link>
                          )}
                        </div>
                        <style>{`@keyframes skLoginShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}@media (prefers-reduced-motion: reduce){.sk-loginError{animation:none!important}}`}</style>
                      </div>
                    )}

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
                          onClick={goToSignup}
                          className="sk-inlineBtnLink"
                        >
                          Create your Skyrio access
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
                        Some features require Skyrio access.
                      </Text>
                      <div className="sk-linksRow">
                        <Link className="sk-linkSmall" to="/reset">
                          Forgot password?
                        </Link>
                        <span className="sk-sep">•</span>
                        <Link className="sk-linkSmall sk-strong" to="/register">
                          Create Skyrio access
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="sk-cardFooter">
                    © {new Date().getFullYear()} Skyrio
                  </div>
                </div>

                <PassStub />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
