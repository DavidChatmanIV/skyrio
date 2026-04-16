import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { Input, Button, message, Typography, notification } from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";

import BoardingPassToast from "../components/BoardingPassToast";
import PassStub from "../components/PassStub";
import AuthLayout from "../layout/AuthLayout";
import { useAuth } from "../auth/useAuth";

import galaxyLogin from "../assets/LoginBoardingpass/galaxy-login.png";
import gateBg from "../assets/LoginBoardingpass/gate.png";
import "../styles/login.css";
import "../styles/RegisterPage.css";

const { Title, Text } = Typography;

const UN_IDLE = "idle";
const UN_CHECKING = "checking";
const UN_TAKEN = "taken";
const UN_AVAILABLE = "available";
const UN_ERROR = "error";

export default function RegisterPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const successHandledRef = useRef(false);

  /* ── Username availability ── */
  const [unStatus, setUnStatus] = useState(UN_IDLE);
  const [unMessage, setUnMessage] = useState("");
  const debounceRef = useRef(null);

  const checkUsername = useCallback(
    async (raw) => {
      const username = raw.trim();
      if (!username) {
        setUnStatus(UN_IDLE);
        setUnMessage("");
        return;
      }
      if (username.length < 3) {
        setUnStatus(UN_ERROR);
        setUnMessage("Min 3 characters");
        return;
      }
      if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
        setUnStatus(UN_ERROR);
        setUnMessage("Letters, numbers, _ and . only");
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      setUnStatus(UN_CHECKING);
      setUnMessage("Checking…");

      debounceRef.current = setTimeout(async () => {
        try {
          const result = await auth.available?.({ username });
          if (!result || result.ok === false) {
            setUnStatus(UN_ERROR);
            setUnMessage(result?.error || "Could not check");
            return;
          }
          const isAvailable = result?.username?.available ?? false;
          if (isAvailable) {
            setUnStatus(UN_AVAILABLE);
            setUnMessage(`@${username} is available ✓`);
          } else {
            setUnStatus(UN_TAKEN);
            setUnMessage(`@${username} is already taken`);
          }
        } catch {
          setUnStatus(UN_ERROR);
          setUnMessage("Could not check — try again");
        }
      }, 500);
    },
    [auth]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const passenger = useMemo(() => {
    const raw = (formData.name || formData.username || "").trim();
    if (!raw) return "New Traveller";
    return raw.length > 18 ? raw.slice(0, 18) + "…" : raw;
  }, [formData.name, formData.username]);

  const handleRegister = async () => {
    if (loading || successHandledRef.current) return;
    const { name, username, email, password, confirmPassword } = formData;

    if (!name.trim() || !email.trim() || !password) {
      message.warning("Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      message.error("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      message.error("Password must be at least 8 characters.");
      return;
    }
    if (username && unStatus === UN_TAKEN) {
      message.error("That username is already taken.");
      return;
    }
    if (username && unStatus === UN_CHECKING) {
      message.warning("Still checking username — please wait.");
      return;
    }

    setLoading(true);
    setIsScanning(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, username, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Registration failed");

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
            routeFrom="Register"
            routeTo="Passport"
          />
        ),
        placement: "topRight",
        duration: 3,
        style: { background: "transparent", boxShadow: "none", padding: 0 },
      });

      message.success(`Boarding pass issued, ${displayName} ✈️`);
      nav("/passport", { replace: true, state: { fromAuth: true } });
    } catch (err) {
      successHandledRef.current = false;
      message.error(err?.message || "Registration failed");
      setIsScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleRegister();
  };
  const updateField = (key) => (e) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
  const scanOn = () => setIsScanning(true);
  const scanOff = () => !loading && setIsScanning(false);

  const unIcon = useMemo(() => {
    if (unStatus === UN_CHECKING)
      return <LoadingOutlined style={{ color: "rgba(255,255,255,0.55)" }} />;
    if (unStatus === UN_AVAILABLE)
      return <CheckCircleFilled style={{ color: "#22c55e" }} />;
    if (unStatus === UN_TAKEN)
      return <CloseCircleFilled style={{ color: "#ff5c7a" }} />;
    if (unStatus === UN_ERROR)
      return <CloseCircleFilled style={{ color: "#ff8a2a" }} />;
    return null;
  }, [unStatus]);

  const unColor = useMemo(() => {
    if (unStatus === UN_AVAILABLE) return "#22c55e";
    if (unStatus === UN_TAKEN) return "#ff5c7a";
    if (unStatus === UN_ERROR) return "#ff8a2a";
    return "rgba(255,255,255,0.55)";
  }, [unStatus]);

  return (
    <AuthLayout>
      <div className="auth-scene register">
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
                  Issue your boarding pass
                </Title>
                <Text className="sk-authSubtitle">
                  Join Skyrio. Earn XP. See the world.
                </Text>
              </div>
            </div>

            <div
              className={`sk-passCard sk-passWide sk-passRegister ${
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
                {/* ── MAIN ── */}
                <div className="sk-passMain">
                  <div className="sk-passHeader">
                    <div className="sk-brandRow">
                      <span className="sk-dot" />
                      <span className="sk-brand">Skyrio</span>
                    </div>
                    <div className="sk-chipRow">
                      <span className="sk-chip">NEW</span>
                      <span className="sk-chip">Gate A3</span>
                    </div>
                  </div>

                  <div className="sk-passTitle">
                    <div className="sk-kicker">
                      BOARDING PASS — REGISTRATION
                    </div>
                  </div>

                  <div className="sk-idGrid">
                    <div className="sk-idBlock">
                      <div className="sk-label">PASSENGER</div>
                      <div className="sk-value">{passenger}</div>
                    </div>
                    <div className="sk-idBlock sk-right">
                      <div className="sk-label">STATUS</div>
                      <div className="sk-statusPill">
                        {loading ? "Issuing…" : "New"}
                      </div>
                    </div>
                    <div className="sk-idBlock">
                      <div className="sk-label">FROM</div>
                      <div className="sk-smallValue">Register</div>
                    </div>
                    <div className="sk-idBlock sk-right">
                      <div className="sk-label">TO</div>
                      <div className="sk-smallValue">Passport</div>
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
                    {/* Row 1: Name + Username */}
                    <div className="sk-fieldRow">
                      <div className="sk-field">
                        <div className="sk-fieldLabel">FULL NAME *</div>
                        <Input
                          value={formData.name}
                          onChange={updateField("name")}
                          placeholder="Your name"
                          prefix={<UserOutlined />}
                          className="sk-input sk-input-reg"
                          autoComplete="name"
                          onFocus={scanOn}
                          onBlur={scanOff}
                        />
                      </div>
                      <div className="sk-field">
                        <div className="sk-fieldLabel">
                          USERNAME
                          {unStatus !== UN_IDLE && (
                            <span
                              className="sk-un-status"
                              style={{ color: unColor }}
                            >
                              {unMessage}
                            </span>
                          )}
                        </div>
                        <Input
                          value={formData.username}
                          onChange={(e) => {
                            const val = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_.]/g, "");
                            updateField("username")({ target: { value: val } });
                            checkUsername(val);
                          }}
                          placeholder="skyexplorer99"
                          prefix={<span className="sk-atSign">@</span>}
                          suffix={unIcon}
                          className={`sk-input sk-input-reg ${
                            unStatus === UN_TAKEN
                              ? "sk-input-error"
                              : unStatus === UN_AVAILABLE
                              ? "sk-input-success"
                              : ""
                          }`}
                          autoComplete="username"
                          onFocus={scanOn}
                          onBlur={scanOff}
                          maxLength={30}
                        />
                      </div>
                    </div>

                    {/* Row 2: Email */}
                    <div className="sk-field">
                      <div className="sk-fieldLabel">EMAIL *</div>
                      <Input
                        value={formData.email}
                        onChange={updateField("email")}
                        placeholder="you@example.com"
                        prefix={<MailOutlined />}
                        className="sk-input sk-input-reg"
                        autoComplete="email"
                        onFocus={scanOn}
                        onBlur={scanOff}
                      />
                    </div>

                    {/* Row 3: Password + Confirm */}
                    <div className="sk-fieldRow">
                      <div className="sk-field">
                        <div className="sk-fieldLabel">PASSWORD *</div>
                        <Input.Password
                          value={formData.password}
                          onChange={updateField("password")}
                          placeholder="Min. 8 characters"
                          prefix={<LockOutlined />}
                          className="sk-input sk-input-reg"
                          autoComplete="new-password"
                          onFocus={scanOn}
                          onBlur={scanOff}
                          iconRender={(v) =>
                            v ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                          }
                        />
                      </div>
                      <div className="sk-field">
                        <div className="sk-fieldLabel">
                          CONFIRM PASSWORD *
                          {formData.confirmPassword && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                fontWeight: 800,
                                color:
                                  formData.password === formData.confirmPassword
                                    ? "#22c55e"
                                    : "#ff5c7a",
                              }}
                            >
                              {formData.password === formData.confirmPassword
                                ? "✓ Match"
                                : "✗ No match"}
                            </span>
                          )}
                        </div>
                        <Input.Password
                          value={formData.confirmPassword}
                          onChange={updateField("confirmPassword")}
                          placeholder="Repeat password"
                          prefix={<LockOutlined />}
                          className="sk-input sk-input-reg"
                          autoComplete="new-password"
                          onFocus={scanOn}
                          onBlur={scanOff}
                          iconRender={(v) =>
                            v ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                          }
                        />
                      </div>
                    </div>

                    <Button
                      className="sk-ctaBtn sk-ctaBtn-reg"
                      type="primary"
                      block
                      loading={loading}
                      onClick={handleRegister}
                      disabled={
                        unStatus === UN_TAKEN || unStatus === UN_CHECKING
                      }
                    >
                      Issue Boarding Pass
                    </Button>

                    <div className="sk-secondary">
                      <Text className="sk-muted">
                        Already have a pass?{" "}
                        <Link className="sk-inlineBtnLink" to="/login">
                          Sign in
                        </Link>
                      </Text>
                      <Text className="sk-muted sk-micro">
                        By registering you agree to Skyrio's Terms of Service.
                      </Text>
                    </div>
                  </div>

                  <div className="sk-cardFooter">
                    © {new Date().getFullYear()} Skyrio
                  </div>
                </div>

                {/* ✅ Real QR stub */}
                <PassStub />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}