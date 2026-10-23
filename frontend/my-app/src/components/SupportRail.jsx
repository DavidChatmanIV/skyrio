import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  LifeBuoy,
  X,
  Star,
  Compass,
  Check,
  Send,
} from "lucide-react";

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
  // One launcher (desktop + mobile) that fans out Tour, Feedback and Help
  const [menuOpen, setMenuOpen] = useState(false);
  // Tuck the launcher away while the site footer is on screen,
  // so it never covers the footer logo / support email.
  const [footerInView, setFooterInView] = useState(false);

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

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) return setFooterInView(false);
      const top = footer.getBoundingClientRect().top;
      setFooterInView(top < window.innerHeight - 40);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Escape closes the menu
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function openPanel(panel) {
    setMenuOpen(false);
    setActivePanel(panel);
  }

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
      setFbError(err.message || "Something went wrong. Please try again.");
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
    ) {
      setHelpError("Please fill in your name, email and what's going on.");
      return;
    }

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
      setHelpError(err.message || "Something went wrong. Please try again.");
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
        @keyframes railFan { from { opacity:0; transform:translateY(10px) scale(0.9); } to { opacity:1; transform:translateY(0) scale(1); } }

        /* Same on desktop and mobile: one launcher that fans out the actions */
        .sr-rail-wrapper {
          position: fixed;
          left: 20px;
          bottom: 24px;
          z-index: 2147483630;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: transform 0.25s ease, opacity 0.25s ease;
        }

        .sr-action {
          height: 44px;
          padding: 0;
          border: none;
          border-radius: 999px;
          display: none;
          align-items: center;
          align-self: flex-start;
          cursor: pointer;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .sr-rail-wrapper.is-open .sr-action {
          display: inline-flex;
          animation: railFan 0.2s cubic-bezier(0.22,1,0.36,1) both;
        }
        .sr-rail-wrapper.is-open .sr-action--feedback { animation-delay: 0.04s; }
        .sr-rail-wrapper.is-open .sr-action--tour { animation-delay: 0.08s; }
        .sr-action:active { transform: scale(0.96); }
        .sr-action:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

        .sr-action--feedback {
          background: linear-gradient(135deg, #ff8a2a, #ffb347);
          box-shadow: 0 8px 22px rgba(255,138,42,0.38);
          color: #1a0e06;
        }
        .sr-action--help {
          background: linear-gradient(135deg, #ff8a2a, #7c5cfc);
          box-shadow: 0 8px 22px rgba(124,92,252,0.42);
          color: #fff;
        }
        .sr-action--tour {
          background: rgba(16,11,34,0.92);
          border: 1px solid rgba(255,179,71,0.55);
          box-shadow: 0 8px 22px rgba(0,0,0,0.35);
          color: #ffb347;
        }
        .sr-action__icon {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sr-action__label {
          white-space: nowrap;
          font-size: 14px;
          font-weight: 700;
          padding-right: 16px;
        }

        .sr-launcher {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          color: #fff;
          background: linear-gradient(135deg, #ff8a2a, #7c5cfc);
          box-shadow: 0 8px 22px rgba(124,92,252,0.42);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .sr-launcher:active { transform: scale(0.94); }
        .sr-launcher:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

        .sr-rail-wrapper.is-tucked {
          transform: translateX(-150%);
          opacity: 0;
          pointer-events: none;
        }

        /* Desktop: a little hover lift, nothing else changes */
        @media (hover: hover) {
          .sr-launcher:hover {
            transform: scale(1.06);
            box-shadow: 0 12px 30px rgba(124,92,252,0.55);
          }
          .sr-action:hover { transform: translateX(3px); }
          .sr-action--tour:hover { color: #fff; }
        }

        @media (max-width: 768px) {
          .sr-rail-wrapper { bottom: 16px; left: 12px; }
          .sr-launcher { width: 46px; height: 46px; }
        }
        @media (max-width: 480px) {
          .sr-panel { width: calc(100vw - 24px) !important; left: 12px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sr-action, .sr-launcher, .sr-rail-wrapper { transition: none; }
          .sr-rail-wrapper.is-open .sr-action { animation: none; }
        }
      `}</style>

      {/* ── Tap/click outside to close the menu ── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 2147483629 }}
        />
      )}

      {/* ── Rail: one launcher that fans out the three actions ── */}
      <div
        className={`sr-rail-wrapper${menuOpen ? " is-open" : ""}${
          footerInView && !menuOpen ? " is-tucked" : ""
        }`}
      >
        {/* Replays the Skyrio tour (SkyrioDTour listens for this event) */}
        <button
          type="button"
          className="sr-action sr-action--tour"
          onClick={() => {
            setMenuOpen(false);
            window.dispatchEvent(new Event("skyrio:tour"));
          }}
        >
          <span className="sr-action__icon" aria-hidden="true">
            <Compass size={19} />
          </span>
          <span className="sr-action__label">Take the tour</span>
        </button>

        <button
          type="button"
          className="sr-action sr-action--feedback"
          onClick={() => openPanel("feedback")}
        >
          <span className="sr-action__icon" aria-hidden="true">
            <MessageSquare size={19} />
          </span>
          <span className="sr-action__label">Feedback</span>
        </button>

        <button
          type="button"
          className="sr-action sr-action--help"
          onClick={() => openPanel("help")}
        >
          <span className="sr-action__icon" aria-hidden="true">
            <LifeBuoy size={19} />
          </span>
          <span className="sr-action__label">Get help</span>
        </button>

        <button
          type="button"
          className="sr-launcher"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close help menu" : "Help and feedback"}
          title={menuOpen ? "Close" : "Help and feedback"}
        >
          {menuOpen ? <X size={20} /> : <LifeBuoy size={20} />}
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
          role="dialog"
          aria-label="Send feedback"
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
              Got it. Thanks for helping us improve Skyrio. We read every
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
                    aria-pressed={fbRating === n}
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
                aria-label="Your feedback"
                rows={4}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.13)",
                  borderRadius: 12,
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 16,
                  padding: 12,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 10,
                }}
              />

              {fbError && (
                <div
                  role="alert"
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

      {/* ── Need Help panel (slide-up sheet) ── */}
      {activePanel === "help" && (
        <div
          role="dialog"
          aria-label="Contact support"
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
              type="button"
              onClick={closePanel}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                color: "rgba(240,237,255,0.5)",
                cursor: "pointer",
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <X size={20} />
            </button>
          </div>

          {helpSent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  margin: "0 auto 16px",
                  animation: "railPop 0.3s ease",
                }}
              >
                <Check size={26} strokeWidth={2.5} />
              </div>
              <p
                style={{
                  color: "#f0edff",
                  fontWeight: 700,
                  fontSize: 17,
                  margin: "0 0 8px",
                }}
              >
                Got it. We'll be in touch.
              </p>
              <p
                style={{
                  color: "rgba(240,237,255,0.55)",
                  fontSize: 14,
                  margin: "0 0 24px",
                }}
              >
                A real person will reply to {helpForm.email || "your email"}.
              </p>
              <button type="button" onClick={closePanel} style={btnSecondary}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div style={field}>
                <label style={labelStyle} htmlFor="sr-help-name">
                  Your name
                </label>
                <input
                  id="sr-help-name"
                  style={inputStyle}
                  value={helpForm.name}
                  onChange={(e) => setHelp("name", e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>
              <div style={field}>
                <label style={labelStyle} htmlFor="sr-help-email">
                  Email address
                </label>
                <input
                  id="sr-help-email"
                  style={inputStyle}
                  type="email"
                  value={helpForm.email}
                  onChange={(e) => setHelp("email", e.target.value)}
                  placeholder="jane@example.com"
                  autoComplete="email"
                />
              </div>
              <div style={field}>
                <label style={labelStyle} htmlFor="sr-help-category">
                  Category
                </label>
                <select
                  id="sr-help-category"
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
                <label style={labelStyle} htmlFor="sr-help-message">
                  What's going on?
                </label>
                <textarea
                  id="sr-help-message"
                  style={{ ...inputStyle, height: 90, resize: "none" }}
                  value={helpForm.message}
                  onChange={(e) => setHelp("message", e.target.value)}
                  placeholder="Describe the issue: what happened and what you expected"
                />
              </div>

              {helpError && (
                <div
                  role="alert"
                  style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}
                >
                  {helpError}
                </div>
              )}

              <button
                type="button"
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {helpSubmitting ? (
                  "Sending..."
                ) : (
                  <>
                    <Send size={16} aria-hidden="true" />
                    Send to support
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
