import { useState, useEffect } from "react";
import { MessageSquare, X, Star } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

// ─────────────────────────────────────────────
// FeedbackWidget
// A floating feedback pill, mirroring the "Need help?"
// button's style on the opposite corner. Mount once at
// the app layout level so it persists across every page.
// ─────────────────────────────────────────────
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[FeedbackWidget] mounted successfully");
  }, []);

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
    setTimeout(() => {
      setSubmitted(false);
      setError("");
    }, 250);
  };

  return (
    <div id="skyrio-feedback-widget-root">
      {/* ── Floating trigger pill — bottom-right, mirrors
           "Need help?" on the bottom-left ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            left: 24,
            bottom: 86,
            background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
            color: "#1a0e06",
            border: "none",
            borderRadius: 999,
            padding: "12px 20px",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(255,138,42,0.4)",
            zIndex: 9998,
            letterSpacing: "0.01em",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 12px 32px rgba(255,138,42,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(255,138,42,0.4)";
          }}
        >
          <MessageSquare size={16} />
          Feedback
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            left: 24,
            bottom: 90,
            width: 340,
            maxWidth: "calc(100vw - 48px)",
            background: "rgba(12, 9, 28, 0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
            padding: 20,
            zIndex: 9998,
            fontFamily: "inherit",
            color: "#fff",
            boxSizing: "border-box",
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
                  style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}
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
    </div>
  );
}
