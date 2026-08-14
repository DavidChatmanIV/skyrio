import { useState } from "react";
import { MessageSquare, X, Star } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

// ─────────────────────────────────────────────
// FeedbackWidget
// A floating feedback button + panel, styled to match
// Skyrio's dark-glass / orange-accent design system.
// Drop this once near the root of your app layout (e.g.
// in App.jsx or a shared Layout component) so it's
// available on every page — similar to Expedia's
// persistent "Feedback" tab.
// ─────────────────────────────────────────────
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please enter some feedback before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: message.trim(),
          rating: rating || undefined,
          page: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.message || "Failed to send feedback");
      setSubmitted(true);
      setMessage("");
      setRating(0);
    } catch (err) {
      setError(err.message || "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset "submitted" state after the close animation so it's
    // fresh next time the user opens it
    setTimeout(() => {
      setSubmitted(false);
      setError("");
    }, 250);
  };

  return (
    <>
      {/* ── Floating trigger tab (Expedia-style vertical tab) ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 0,
            top: "50%",
            transform: "translateY(-50%) rotate(-90deg) translateX(50%)",
            transformOrigin: "right center",
            background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
            color: "#1a0e06",
            border: "none",
            borderRadius: "10px 10px 0 0",
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: 13,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(255,138,42,0.35)",
            zIndex: 999,
            letterSpacing: "0.02em",
          }}
        >
          <MessageSquare size={14} />
          Feedback
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: 340,
            maxWidth: "calc(100vw - 40px)",
            background: "rgba(12, 9, 28, 0.96)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            padding: 20,
            zIndex: 1000,
            fontFamily: "inherit",
            color: "#fff",
            animation:
              "feedback-slide-in 0.22s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <style>{`
            @keyframes feedback-slide-in {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {submitted ? "Thank you!" : "Send feedback"}
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
              aria-label="Close feedback panel"
            >
              <X size={18} />
            </button>
          </div>

          {submitted ? (
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
                onClick={handleClose}
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

              {/* ── Star rating ── */}
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      color:
                        n <= (hoverRating || rating)
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.2)",
                      transition: "color 0.15s",
                    }}
                    aria-label={`Rate ${n} out of 5`}
                  >
                    <Star
                      size={20}
                      fill={n <= (hoverRating || rating) ? "#ff8a2a" : "none"}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
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

              {error && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#f87171",
                    marginBottom: 10,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
                  color: "#1a0e06",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: "inherit",
                  transition: "opacity 0.15s",
                }}
              >
                {submitting ? "Sending..." : "Send feedback"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
