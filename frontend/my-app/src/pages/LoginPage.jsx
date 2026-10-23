import React, { useState, useRef, useMemo, useEffect } from "react";
import { Input, Button, Typography, notification } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";

import BoardingPassToast from "../components/BoardingPassToast";
import AuthLayout from "../layout/AuthLayout";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/useAuthModal";

import galaxyLogin from "../assets/LoginBoardingpass/galaxy-login.png";
import gateBg from "../assets/LoginBoardingpass/gate.png";
import "../styles/login.css";

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || "";

/* Friendly names for the "TO" field instead of raw paths like /passport */
const ROUTE_LABELS = {
  "/passport": "Passport",
  "/dashboard": "Dashboard",
  "/booking": "Book",
  "/skyhub": "SkyHub",
  "/discover": "Discover",
};

function labelForRoute(path) {
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  const first = (path || "").split(/[/?#]/).filter(Boolean)[0];
  if (!first) return "Home";
  return first
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ── SVG icons (no emoji) ── */
const PlaneIcon = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    style={{ transform: "rotate(90deg)" }}
  >
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/* Right-hand stub: real account benefits instead of a fake QR code */
function LoginStub() {
  return (
    <aside
      className="sk-passStub"
      aria-label="What you get with a Skyrio account"
    >
      <div className="sk-stubTop">
        <span className="sk-stubGate">Boarding</span>
      </div>

      <div className="sk-stubPerks">
        <div className="sk-label">WITH YOUR ACCOUNT</div>
        <ul className="sk-perkList">
          <li>
            <span className="sk-perkIcon">
              <CheckIcon />
            </span>
            Book flights, stays and excursions
          </li>
          <li>
            <span className="sk-perkIcon">
              <CheckIcon />
            </span>
            Earn XP toward your Passport rank
          </li>
          <li>
            <span className="sk-perkIcon">
              <CheckIcon />
            </span>
            Plan group trips with Sync Together
          </li>
          <li>
            <span className="sk-perkIcon">
              <CheckIcon />
            </span>
            Share trips on SkyHub
          </li>
        </ul>
      </div>

      <div className="sk-stubBarcode" aria-hidden="true">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} className="sk-bar" />
        ))}
      </div>
    </aside>
  );
}

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
  const [capsLockOn, setCapsLockOn] = useState(false);
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
    // Only allow internal paths ("/x"), never "//evil.com"
    if (typeof rt === "string" && /^\/(?!\/)/.test(rt.trim())) return rt.trim();
    return "/passport";
  }, [location.state]);

  const routeLabel = labelForRoute(redirectTo);

  const passenger = useMemo(() => {
    const raw = (formData.emailOrUsername || "").trim();
    if (!raw) return "Explorer";
    const cleaned = raw.includes("@") ? raw.split("@")[0] : raw;
    return cleaned.length > 18 ? cleaned.slice(0, 18) + "…" : cleaned;
  }, [formData.emailOrUsername]);

  // The shimmer only runs while actually checking in
  useEffect(() => {
    if (!loading) setIsScanning(false);
  }, [loading]);

  const checkCapsLock = (e) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

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
      setLoginError(
        "Can't reach Skyrio right now. Check your connection and try again."
      );
      setLoading(false);
      return;
    }

    try {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          // Same message either way, so the page never reveals which accounts exist.
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

      // One confirmation only (the boarding pass toast)
      notification.open({
        message: null,
        description: (
          <BoardingPassToast
            name={displayName}
            routeFrom="Login"
            routeTo={routeLabel}
          />
        ),
        placement: "topRight",
        duration: 3,
        style: { background: "transparent", boxShadow: "none", padding: 0 },
      });

      authModal?.closeAuthModal?.();
      nav(redirectTo, { replace: true, state: { fromAuth: true } });
    } catch (err) {
      successHandledRef.current = false;
      setLoginError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  const emailHasError = errorFields === "both" || errorFields === "email";
  const passwordHasError = errorFields === "both" || errorFields === "password";

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
                <Title level={1} className="sk-authTitle">
                  Welcome back, {passenger}
                </Title>
                <Text className="sk-authSubtitle">
                  Check in fast. Earn XP. Keep it moving.
                </Text>
              </div>
            </div>

            <form
              className={`sk-passCard sk-passWide ${
                isScanning ? "isScanning" : ""
              }`}
              style={{
                "--sk-pass-bg": `url(${galaxyLogin})`,
                "--sk-gateImg": `url(${gateBg})`,
              }}
              onSubmit={onSubmit}
              noValidate
              aria-label="Log in to Skyrio"
              aria-busy={loading ? "true" : "false"}
            >
              <div className="sk-passGlow" aria-hidden="true" />
              <div className="sk-passScan" aria-hidden="true" />

              <div className="sk-passGrid">
                <div className="sk-passMain">
                  <div className="sk-passHeader">
                    <div className="sk-brandRow">
                      <span className="sk-dot" aria-hidden="true" />
                      <span className="sk-brand">Skyrio</span>
                    </div>
                    <div className="sk-chipRow" aria-hidden="true">
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
                      <div className="sk-statusPill" aria-live="polite">
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
                    <div className="sk-plane">
                      <PlaneIcon />
                    </div>
                    <div className="sk-line" />
                    <div className="sk-lineDot" />
                  </div>

                  <div className="sk-form">
                    <div className="sk-field">
                      <label className="sk-fieldLabel" htmlFor="sk-login-id">
                        EMAIL OR USERNAME
                      </label>
                      <Input
                        id="sk-login-id"
                        name="username"
                        value={formData.emailOrUsername}
                        onChange={(e) => {
                          clearError();
                          setFormData((f) => ({
                            ...f,
                            emailOrUsername: e.target.value,
                          }));
                        }}
                        placeholder="Email or username"
                        prefix={<UserOutlined />}
                        className="sk-input"
                        status={emailHasError ? "error" : undefined}
                        aria-invalid={emailHasError}
                        aria-describedby={
                          loginError ? "sk-login-error" : undefined
                        }
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoFocus
                        size="large"
                      />
                    </div>

                    <div className="sk-field">
                      <div className="sk-fieldLabelRow">
                        <label className="sk-fieldLabel" htmlFor="sk-login-pw">
                          PASSWORD
                        </label>
                        <Link className="sk-linkSmall" to="/reset">
                          Forgot password?
                        </Link>
                      </div>
                      <Input.Password
                        id="sk-login-pw"
                        name="password"
                        value={formData.password}
                        onChange={(e) => {
                          clearError();
                          setFormData((f) => ({
                            ...f,
                            password: e.target.value,
                          }));
                        }}
                        onKeyDown={checkCapsLock}
                        onKeyUp={checkCapsLock}
                        onBlur={() => setCapsLockOn(false)}
                        placeholder="Password"
                        prefix={<LockOutlined />}
                        className="sk-input"
                        status={passwordHasError ? "error" : undefined}
                        aria-invalid={passwordHasError}
                        aria-describedby={
                          loginError ? "sk-login-error" : undefined
                        }
                        autoComplete="current-password"
                        size="large"
                        iconRender={(visible) =>
                          visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                        }
                      />
                      {capsLockOn && (
                        <div className="sk-capsHint" role="status">
                          Caps Lock is on
                        </div>
                      )}
                    </div>

                    {loginError && (
                      <div
                        id="sk-login-error"
                        className="sk-loginError"
                        role="alert"
                        aria-live="assertive"
                      >
                        <ExclamationCircleOutlined className="sk-loginErrorIcon" />
                        <div>{loginError}</div>
                      </div>
                    )}

                    <Button
                      className="sk-ctaBtn"
                      type="primary"
                      htmlType="submit"
                      block
                      size="large"
                      loading={loading}
                    >
                      {loading ? "Checking in…" : "Confirm Boarding"}
                    </Button>

                    <div className="sk-secondary">
                      <Text className="sk-muted sk-signupLine">
                        New to Skyrio?{" "}
                        <Link className="sk-inlineBtnLink" to="/register">
                          Create your account
                        </Link>
                      </Text>
                    </div>
                  </div>

                  <div className="sk-cardFooter">
                    © {new Date().getFullYear()} Skyrio
                  </div>
                </div>

                <LoginStub />
              </div>
            </form>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
