import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import AuthLayout from "../layout/AuthLayout";
import galaxyLogin from "../assets/LoginBoardingpass/galaxy-login.png";
import gateBg from "../assets/LoginBoardingpass/gate.png";
import "../styles/login.css";

const API = import.meta.env.VITE_API_URL || "";

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // ── Request reset state
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // ── Reset password state
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestReset = async () => {
    setError("");
    if (!email.trim()) return setError("Please enter your email.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (!password || password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDone(true);
      setTimeout(() => nav("/login"), 2500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

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
            <div
              className="sk-passCard sk-passWide"
              style={{
                "--sk-pass-bg": `url(${galaxyLogin})`,
                "--sk-gateImg": `url(${gateBg})`,
              }}
            >
              <div className="sk-passGlow" />
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
                    <div className="sk-kicker">BOARDING PASS</div>
                  </div>

                  <div className="sk-idGrid">
                    <div className="sk-idBlock">
                      <div className="sk-label">PASSENGER</div>
                      <div className="sk-value">Traveler</div>
                    </div>
                    <div className="sk-idBlock sk-right">
                      <div className="sk-label">STATUS</div>
                      <div className="sk-statusPill">
                        {done
                          ? "✓ Done"
                          : token
                          ? "Reset"
                          : sent
                          ? "Sent ✓"
                          : "Standby"}
                      </div>
                    </div>
                    <div className="sk-idBlock">
                      <div className="sk-label">FROM</div>
                      <div className="sk-smallValue">Login</div>
                    </div>
                    <div className="sk-idBlock sk-right">
                      <div className="sk-label">TO</div>
                      <div className="sk-smallValue">/reset</div>
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
                    {/* ── Step 1: Request reset ── */}
                    {!token && !sent && (
                      <>
                        <div className="sk-field">
                          <div className="sk-fieldLabel">EMAIL ADDRESS</div>
                          <input
                            className="sk-input"
                            type="email"
                            placeholder="Enter your account email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleRequestReset()
                            }
                          />
                        </div>
                        {error && (
                          <p
                            style={{
                              color: "#ff6b6b",
                              fontSize: 13,
                              margin: "4px 0",
                            }}
                          >
                            {error}
                          </p>
                        )}
                        <button
                          className="sk-ctaBtn"
                          onClick={handleRequestReset}
                          disabled={loading}
                        >
                          {loading ? "Sending…" : "Send Reset Link"}
                        </button>
                      </>
                    )}

                    {/* ── Step 2: Confirmation sent ── */}
                    {!token && sent && (
                      <div style={{ textAlign: "center", padding: "16px 0" }}>
                        <p style={{ color: "#fff", fontSize: 15 }}>
                          ✈️ Reset link sent!
                        </p>
                        <p
                          style={{
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 13,
                          }}
                        >
                          Check your email and click the link to reset your
                          password.
                        </p>
                      </div>
                    )}

                    {/* ── Step 3: New password form ── */}
                    {token && !done && (
                      <>
                        <div className="sk-field">
                          <div className="sk-fieldLabel">NEW PASSWORD</div>
                          <input
                            className="sk-input"
                            type="password"
                            placeholder="New password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                        <div className="sk-field">
                          <div className="sk-fieldLabel">CONFIRM PASSWORD</div>
                          <input
                            className="sk-input"
                            type="password"
                            placeholder="Confirm password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleResetPassword()
                            }
                          />
                        </div>
                        {error && (
                          <p
                            style={{
                              color: "#ff6b6b",
                              fontSize: 13,
                              margin: "4px 0",
                            }}
                          >
                            {error}
                          </p>
                        )}
                        <button
                          className="sk-ctaBtn"
                          onClick={handleResetPassword}
                          disabled={loading}
                        >
                          {loading ? "Resetting…" : "Reset Password"}
                        </button>
                      </>
                    )}

                    {/* ── Step 4: Success ── */}
                    {done && (
                      <div style={{ textAlign: "center", padding: "16px 0" }}>
                        <p style={{ color: "#fff", fontSize: 15 }}>
                          ✅ Password reset!
                        </p>
                        <p
                          style={{
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 13,
                          }}
                        >
                          Redirecting you to login…
                        </p>
                      </div>
                    )}

                    <div className="sk-secondary">
                      <div className="sk-linksRow">
                        <Link className="sk-linkSmall" to="/login">
                          Back to login
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}