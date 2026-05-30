/**
 * SupportWidget.jsx
 * ─────────────────
 * Floating "Need help?" button that appears on every page.
 * When clicked → opens a slide-up form so customers can submit
 * an issue if Atlas (AI) couldn't solve it.
 *
 * INSTALL — in Layout.jsx:
 *   import SupportWidget from "../pages/SupportWidget";
 *   // bottom of your Layout return:
 *   <SupportWidget />
 */

import { useState } from "react";

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

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "technical",
    message: "",
  });

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

    const existing = loadTickets();
    saveTickets([ticket, ...existing]);
    setSent(true);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setForm({ name: "", email: "", category: "technical", message: "" });
    }, 400);
  }

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 8000,
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
          transition: "transform .2s, box-shadow .2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 12px 32px rgba(124,92,252,0.55)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(124,92,252,0.45)";
        }}
      >
        💬 Need help?
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 8001,
            background: "rgba(9,7,26,0.65)",
            backdropFilter: "blur(4px)",
            animation: "swFadeIn .25s ease",
          }}
        />
      )}

      {/* ── Slide-up panel ── */}
      <div
        style={{
          position: "fixed",
          bottom: open ? 0 : "-100%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 8002,
          width: "min(480px, 100vw)",
          background: "#120f2a",
          border: "1px solid rgba(255,255,255,0.10)",
          borderBottom: "none",
          borderRadius: "20px 20px 0 0",
          padding: "28px 28px 36px",
          transition: "bottom .35s cubic-bezier(.22,1,.36,1)",
          fontFamily: "'DM Sans', sans-serif",
        }}
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
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {sent ? (
          /* ── Success state ── */
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
          /* ── Form ── */
          <>
            <div style={field}>
              <label style={label}>Your name</label>
              <input
                style={input}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Jane Smith"
              />
            </div>

            <div style={field}>
              <label style={label}>Email address</label>
              <input
                style={input}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <div style={field}>
              <label style={label}>Category</label>
              <select
                style={input}
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
              <label style={label}>What's going on?</label>
              <textarea
                style={{ ...input, height: 90, resize: "none" }}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Describe the issue — what happened and what you expected…"
              />
            </div>

            <button
              onClick={handleSubmit}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #ff8a2a, #7c5cfc)",
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Send to support →
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes swFadeIn { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </>
  );
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const field = { marginBottom: 14 };

const label = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(240,237,255,0.55)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
};

const input = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
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
