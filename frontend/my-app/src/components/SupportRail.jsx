import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, LifeBuoy, X, Star } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

/* ─── Shared field styles (support form) ────────────────────── */
const field = { marginBottom: 14 };
const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(240,237,255,0.55)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
};
const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.07)",
  color: "#f0edff",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};
const btnSecondary = {
  padding: "10px 28px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "none",
  color: "rgba(240,237,255,0.6)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  cursor: "pointer",
};

export default function SupportRail() {
  // "closed" | "feedback" | "help"
  const [activePanel, setActivePanel] = useState("closed");
  const [pickerActive, setPickerActive] = useState(false);

  // ── Feedback state ──
  const [fbMessage, setFbMessage] = useState("");
  const [fbRating, setFbRating] = useState(0);
  const [fbHoverRating, setFbHoverRating] = useState(0);
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbSubmitted, setFbSubmitted] = useState(false);
  const [fbError, setFbError] = useState("");

  // ── Support ticket state ──
  const [helpSent, setHelpSent] = useState(false);
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpError, setHelpError] = useState("");
  const [helpForm, setHelpForm] = useState({
    name: "",
    email: "",
    category: "technical",
    message: "",
  });

  // ── Hide rail entirely when a date picker is open ──
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hasOpenPicker = !!document.querySelector(
        ".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)"
      );
      setPickerActive(hasOpenPicker);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function closePanel() {
    setActivePanel("closed");
    setTimeout(() => {
      setFbSubmitted(false);
      setFbError("");
      setHelpSent(false);
      setHelpError("");
      setHelpForm({ name: "", email: "", category: "technical", message: "" });
    }, 300);
  }

  async function handleFeedbackSubmit() {
    if (!fbMessage.trim()) {
      setFbError("Please enter some feedback before submitting.");
      return;
    }
    setFbSubmitting(true);
    setFbError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: fbMessage.trim(),
          rating: fbRating || undefined,
          page: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.message || "Failed to send feedback");
      setFbSubmitted(true);
      setFbMessage("");
      setFbRating(0);
    } catch (err) {
      setFbError(err.message || "Something went wrong — please try again.");
    } finally {
      setFbSubmitting(false);
    }
  }

  function setHelp(k, v) {
    setHelpForm((f) => ({ ...f, [k]: v }));
  }

  async function handleHelpSubmit() {
    if (
      !helpForm.name.trim() ||
      !helpForm.email.trim() ||
      !helpForm.message.trim()
    )
      return;

    setHelpSubmitting(true);
    setHelpError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: helpForm.name.trim(),
          email: helpForm.email.trim(),
          category: helpForm.category,
          message: helpForm.message.trim(),
          page: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.message || "Failed to send ticket");
      setHelpSent(true);
    } catch (err) {
      setHelpError(err.message || "Something went wrong — please try again.");
    } finally {
      setHelpSubmitting(false);
    }
  }

  if (pickerActive) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes railFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes railSlideUp { from { transform:translateX(-50%) translateY(100%) } to { transform:translateX(-50%) translateY(0) } }
        @keyframes railPanelIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes railPop { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }

        .sr-icon-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          flex-shrink: 0;
        }
        .sr-icon-btn:hover { transform: translateY(-2px); }
        .sr-icon-btn:active { transform: translateY(0) scale(0.96); }

        @media (max-width: 480px) {
          .sr-rail-wrapper { bottom: 16px !important; left: 12px !important; }
          .sr-panel { width: calc(100vw - 24px) !important; left: 12px !important; }
        }
      `}</style>

      {/* ── Collapsed icon rail — bottom-left, two 48px circles ── */}
      <div
        className="sr-rail-wrapper"
        style={{
          position: "fixed",
          left: 20,
          bottom: 24,
          zIndex: 2147483630,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <button
          type="button"
          className="sr-icon-btn"
          onClick={() => setActivePanel("feedback")}
          aria-label="Send feedback"
          title="Feedback"
          style={{
            background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
            boxShadow: "0 8px 24px rgba(255,138,42,0.4)",
          }}
        >
          <MessageSquare size={19} color="#1a0e06" />
        </button>

        <button
          type="button"
          className="sr-icon-btn"
          onClick={() => setActivePanel("help")}
          aria-label="Need help?"
          title="Need help?"
          style={{
            background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
            boxShadow: "0 8px 24px rgba(124,92,252,0.45)",
          }}
        >
          <LifeBuoy size={19} color="#fff" />
        </button>
      </div>

      {/* ── Backdrop (both panels share it) ── */}
      {activePanel !== "closed" && (
        <div
          onClick={closePanel}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483640,
            background: "rgba(0,0,0,0.6)",
            animation: "railFadeIn 0.2s ease",
          }}
        />
      )}

      {/* ── Feedback panel ── */}
      {activePanel === "feedback" && (
        <div
          className="sr-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: 20,
            bottom: 24,
            width: 340,
            maxWidth: "calc(100vw - 40px)",
            background: "rgba(12, 9, 28, 0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
            padding: 20,
            zIndex: 2147483641,
            fontFamily: "'DM Sans', sans-serif",
            color: "#fff",
            boxSizing: "border-box",
            animation: "railPanelIn 0.22s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {fbSubmitted ? "Thank you!" : "Send feedback"}
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close feedback panel"
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                minWidth: 32,
                minHeight: 32,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {fbSubmitted ? (
            <div
              style={{
                fontSize: 13.5,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.5,
              }}
            >
              Got it — thanks for helping us improve Skyrio. We read every
              submission.
              <button
                type="button"
                onClick={closePanel}
                style={{
                  display: "block",
                  marginTop: 14,
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
                  color: "#1a0e06",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 12,
                  lineHeight: 1.4,
                }}
              >
                What's working, what's not, what would you change? We read
                everything.
              </div>

              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFbRating(n)}
                    onMouseEnter={() => setFbHoverRating(n)}
                    onMouseLeave={() => setFbHoverRating(0)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      color:
                        n <= (fbHoverRating || fbRating)
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.2)",
                      transition: "color 0.15s",
                    }}
                    aria-label={`Rate ${n} out of 5`}
                  >
                    <Star
                      size={20}
                      fill={
                        n <= (fbHoverRating || fbRating) ? "#ff8a2a" : "none"
                      }
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={fbMessage}
                onChange={(e) => setFbMessage(e.target.value)}
                placeholder="Tell us what you think..."
                rows={4}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.13)",
                  borderRadius: 12,
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  padding: 12,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 10,
                }}
              />

              {fbError && (
                <div
                  style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}
                >
                  {fbError}
                </div>
              )}

              <button
                type="button"
                onClick={handleFeedbackSubmit}
                disabled={fbSubmitting}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
                  color: "#1a0e06",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: fbSubmitting ? "not-allowed" : "pointer",
                  opacity: fbSubmitting ? 0.6 : 1,
                  fontFamily: "inherit",
                  transition: "opacity 0.15s",
                  minHeight: 44,
                }}
              >
                {fbSubmitting ? "Sending..." : "Send feedback"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Need Help panel (slide-up sheet, kept from SupportWidget) ── */}
      {activePanel === "help" && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2147483641,
            width: "min(480px, 100vw)",
            background: "#120f2a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderBottom: "none",
            borderRadius: "20px 20px 0 0",
            padding: "28px 28px 36px",
            fontFamily: "'DM Sans', sans-serif",
            maxHeight: "90vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            animation: "railSlideUp .35s cubic-bezier(.22,1,.36,1)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  color: "#ff8a2a",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Still stuck?
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#f0edff",
                }}
              >
                Talk to a real person
              </h2>
            </div>
            <button
              onClick={closePanel}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                color: "rgba(240,237,255,0.4)",
                fontSize: 22,
                cursor: "pointer",
                lineHeight: 1,
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              ×
            </button>
          </div>

          {helpSent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  margin: "0 auto 16px",
                  animation: "railPop 0.3s ease",
                }}
              >
                ✓
              </div>
              <p
                style={{
                  color: "#f0edff",
                  fontWeight: 700,
                  fontSize: 17,
                  margin: "0 0 8px",
                }}
              >
                Got it — we'll be in touch.
              </p>
              <p
                style={{
                  color: "rgba(240,237,255,0.5)",
                  fontSize: 14,
                  margin: "0 0 24px",
                }}
              >
                A real human will reply within 24 hours.
              </p>
              <button onClick={closePanel} style={btnSecondary}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div style={field}>
                <label style={labelStyle}>Your name</label>
                <input
                  style={inputStyle}
                  value={helpForm.name}
                  onChange={(e) => setHelp("name", e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div style={field}>
                <label style={labelStyle}>Email address</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={helpForm.email}
                  onChange={(e) => setHelp("email", e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div style={field}>
                <label style={labelStyle}>Category</label>
                <select
                  style={inputStyle}
                  value={helpForm.category}
                  onChange={(e) => setHelp("category", e.target.value)}
                >
                  <option value="billing">Billing & Payments</option>
                  <option value="technical">Technical Issue</option>
                  <option value="account">Account / Login</option>
                  <option value="booking">Booking Problem</option>
                  <option value="feature">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={field}>
                <label style={labelStyle}>What's going on?</label>
                <textarea
                  style={{ ...inputStyle, height: 90, resize: "none" }}
                  value={helpForm.message}
                  onChange={(e) => setHelp("message", e.target.value)}
                  placeholder="Describe the issue — what happened and what you expected…"
                />
              </div>

              {helpError && (
                <div
                  style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}
                >
                  {helpError}
                </div>
              )}

              <button
                onClick={handleHelpSubmit}
                disabled={helpSubmitting}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: helpSubmitting ? "not-allowed" : "pointer",
                  opacity: helpSubmitting ? 0.6 : 1,
                  marginTop: 4,
                  minHeight: 48,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {helpSubmitting ? "Sending..." : "Send to support →"}
              </button>
            </>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
