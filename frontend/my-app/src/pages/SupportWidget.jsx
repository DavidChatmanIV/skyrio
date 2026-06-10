/**
 * SupportWidget.jsx
 * Floating "Need help?" button — hides when date picker is open.
 * Positioned bottom-left to avoid overlap with Atlas FAB (bottom-right).
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "skyrio_support_tickets";

function loadTickets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

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

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "technical",
    message: "",
  });

  // ── Hide widget when any Ant Design date picker is open ──
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

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    const ticket = {
      ...form,
      id: uid(),
      status: "open",
      createdAt: new Date().toISOString(),
      reply: "",
      notes: "",
    };
    saveTickets([ticket, ...loadTickets()]);
    setSent(true);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setForm({ name: "", email: "", category: "technical", message: "" });
    }, 400);
  }

  return createPortal(
    <>
      <style>{`
        @keyframes swFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes swSlideUp { from { transform:translateX(-50%) translateY(100%) } to { transform:translateX(-50%) translateY(0) } }
      `}</style>

      {/* ── Floating trigger — bottom LEFT, away from Atlas FAB ── */}
      {!pickerActive && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            bottom: 28,
            left: 20,
            zIndex: 2147483630,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: 50,
            border: "none",
            background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(124,92,252,0.45)",
            WebkitTransform: "translateZ(0)",
            transform: "translateZ(0)",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          💬 Need help?
        </button>
      )}

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483641,
            background: "rgba(0,0,0,0.75)",
            animation: "swFadeIn .25s ease",
            WebkitTransform: "translateZ(0)",
            transform: "translateZ(0)",
          }}
        />
      )}

      {/* ── Slide-up panel ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2147483642,
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
            animation: "swSlideUp .35s cubic-bezier(.22,1,.36,1)",
            WebkitTransform: "translateX(-50%) translateZ(0)",
            willChange: "transform",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
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
              onClick={handleClose}
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

          {sent ? (
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
              <button onClick={handleClose} style={btnSecondary}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div style={field}>
                <label style={labelStyle}>Your name</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div style={field}>
                <label style={labelStyle}>Email address</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div style={field}>
                <label style={labelStyle}>Category</label>
                <select
                  style={inputStyle}
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
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
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="Describe the issue — what happened and what you expected…"
                />
              </div>
              <button
                onClick={handleSubmit}
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
                  cursor: "pointer",
                  marginTop: 4,
                  minHeight: 48,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Send to support →
              </button>
            </>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
