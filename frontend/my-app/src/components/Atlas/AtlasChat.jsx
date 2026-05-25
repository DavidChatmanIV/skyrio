/**
 * ─────────────────────────────────────────────────────────────
 * Skyrio's Atlas AI floating chat widget.
 * Sits as a fixed bottom-right bubble on any page.
 * Drops into BookingPage.jsx (or any page) with zero props needed.
 *
 * Usage:
 *   import AtlasChat from "@/components/Atlas/AtlasChat";
 *   <AtlasChat />
 *
 * Optional props:
 *   destination  — pre-seeds the welcome message with a city name
 *   initialOpen  — open the panel on mount (default: false)
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAtlas } from "./useAtlas";

/* ─── Skyrio design tokens ──────────────────────────────────── */
const C = {
  orange: "#ff8a2a",
  orangeGlow: "rgba(255,138,42,0.25)",
  orangeDim: "rgba(255,138,42,0.12)",
  purple: "#7c5cfc",
  purpleGlow: "rgba(124,92,252,0.2)",
  bg: "#09071a",
  bgPanel: "#0e0c22",
  bgMessage: "#13112b",
  bgUser: "linear-gradient(135deg,#ff8a2a,#e0621a)",
  bgAtlas: "#1a1835",
  border: "rgba(255,255,255,0.07)",
  borderOrange: "rgba(255,138,42,0.35)",
  text: "#f0eeff",
  textSub: "rgba(240,238,255,0.5)",
  textMuted: "rgba(240,238,255,0.3)",
  white: "#ffffff",
};

/* ─── Robot SVG icon (replaces all ✦ emoji) ─────────────────── */
function RobotIcon({ size = 20 }) {
  const scale = size / 24;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Body */}
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.5" />
      {/* Head */}
      <rect x="8" y="5.5" width="8" height="5.5" rx="2" opacity=".9" />
      {/* Eyes */}
      <circle cx="10" cy="14" r="1.5" fill="#FFD060" />
      <circle cx="14" cy="14" r="1.5" fill="#FFD060" />
      {/* Mouth */}
      <rect
        x="10"
        y="17"
        width="4"
        height="1.2"
        rx=".6"
        fill="#1a0d04"
        opacity=".55"
      />
      {/* Antenna stem */}
      <line
        x1="12"
        y1="5.5"
        x2="12"
        y2="3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Antenna tip */}
      <circle cx="12" cy="3" r="1.3" />
      {/* Left arm */}
      <line
        x1="5.5"
        y1="13"
        x2="3.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right arm */}
      <line
        x1="18.5"
        y1="13"
        x2="20.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Small robot for message bubbles ───────────────────────── */
function RobotIconSm() {
  return <RobotIcon size={13} />;
}

/* ─── Styles ─────────────────────────────────────────────────── */
const S = {
  /* Wrapper — handles fixed positioning for FAB stack */
  fabWrapper: {
    position: "fixed",
    bottom: 28,
    right: 28,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 10,
  },

  nudge: {
    position: "relative",
    background: "#0e0c22",
    border: "1px solid rgba(255,138,42,0.38)",
    borderRadius: 14,
    padding: "12px 30px 12px 14px",
    maxWidth: 204,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 24px rgba(255,138,42,0.07)",
    animation: "atlasNudgeIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both",
  },

  nudgeTitle: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#ffb830",
    fontFamily: "'Syne', sans-serif",
    lineHeight: 1.2,
  },

  nudgeBody: {
    display: "block",
    fontSize: 11.5,
    color: "rgba(255,255,255,0.58)",
    lineHeight: 1.45,
    fontFamily: "'DM Sans', sans-serif",
  },

  nudgeClose: {
    position: "absolute",
    top: 8,
    right: 10,
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.25)",
    fontSize: 10,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    fontFamily: "inherit",
  },

  trigger: (open) => ({
    position: "relative" /* wrapper handles fixed positioning */,
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: open
      ? `linear-gradient(135deg, ${C.purple}, #5a3fd4)`
      : `linear-gradient(135deg, ${C.orange}, #e0621a)`,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: open
      ? `0 0 0 4px ${C.purpleGlow}, 0 8px 32px rgba(124,92,252,0.4)`
      : `0 0 0 4px ${C.orangeGlow}, 0 8px 32px rgba(255,138,42,0.35)`,
    transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
    flexShrink: 0,
    color: C.white,
  }),

  fabHint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.25)",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.04em",
    textAlign: "center",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    userSelect: "none",
  },

  panel: (open) => ({
    position: "fixed",
    bottom: 96,
    right: 28,
    zIndex: 9998,
    width: 370,
    maxWidth: "calc(100vw - 40px)",
    height: 520,
    maxHeight: "calc(100vh - 120px)",
    borderRadius: 20,
    background: C.bgPanel,
    border: `1px solid ${C.borderOrange}`,
    boxShadow: `0 0 0 1px rgba(255,138,42,0.08), 0 24px 64px rgba(0,0,0,0.6), 0 0 80px ${C.orangeGlow}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "all" : "none",
    transform: open ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
    transition: "all 0.28s cubic-bezier(0.34,1.2,0.64,1)",
    transformOrigin: "bottom right",
  }),

  header: {
    padding: "14px 16px 12px",
    background: `linear-gradient(135deg, ${C.bg} 0%, #110f28 100%)`,
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },

  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${C.orange}, ${C.purple})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: `0 0 12px ${C.orangeGlow}`,
    color: C.white,
  },

  headerText: { flex: 1 },

  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    letterSpacing: "0.01em",
    fontFamily: "'Syne', sans-serif",
    margin: 0,
    lineHeight: 1.2,
  },

  headerSub: {
    fontSize: 11,
    color: C.textSub,
    fontFamily: "'DM Sans', sans-serif",
    margin: 0,
    marginTop: 1,
  },

  statusDot: (active) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: active ? "#4ade80" : C.textMuted,
    boxShadow: active ? "0 0 6px #4ade80" : "none",
    flexShrink: 0,
  }),

  clearBtn: {
    background: "none",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.textMuted,
    fontSize: 11,
    padding: "3px 8px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.15s",
    flexShrink: 0,
  },

  messagesWrap: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 14px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    scrollbarWidth: "thin",
    scrollbarColor: `${C.border} transparent`,
  },

  welcome: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 10,
    padding: "0 20px",
    textAlign: "center",
  },

  welcomeOrb: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: `radial-gradient(circle at 35% 35%, ${C.orange}, ${C.purple})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 0 24px ${C.orangeGlow}, 0 0 48px ${C.purpleGlow}`,
    marginBottom: 4,
    color: C.white,
  },

  welcomeTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    fontFamily: "'Syne', sans-serif",
    margin: 0,
  },

  welcomeSub: {
    fontSize: 12,
    color: C.textSub,
    fontFamily: "'DM Sans', sans-serif",
    margin: 0,
    lineHeight: 1.5,
  },

  suggestionsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    marginTop: 4,
  },

  suggestionBtn: {
    background: C.orangeDim,
    border: `1px solid ${C.borderOrange}`,
    borderRadius: 10,
    color: C.text,
    fontSize: 12,
    padding: "8px 12px",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.15s",
    lineHeight: 1.4,
  },

  msgRow: (role) => ({
    display: "flex",
    justifyContent: role === "user" ? "flex-end" : "flex-start",
    alignItems: "flex-end",
    gap: 6,
  }),

  msgAvatar: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${C.orange}, ${C.purple})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    alignSelf: "flex-end",
    color: C.white,
  },

  bubble: (role) => ({
    maxWidth: "82%",
    padding: "9px 13px",
    borderRadius: role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    background: role === "user" ? C.bgUser : C.bgAtlas,
    color: C.text,
    fontSize: 13,
    lineHeight: 1.55,
    fontFamily: "'DM Sans', sans-serif",
    border: role === "user" ? "none" : `1px solid ${C.border}`,
    boxShadow:
      role === "user"
        ? `0 2px 12px rgba(255,138,42,0.2)`
        : `0 2px 8px rgba(0,0,0,0.2)`,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  }),

  typingBubble: {
    padding: "10px 14px",
    borderRadius: "16px 16px 16px 4px",
    background: C.bgAtlas,
    border: `1px solid ${C.border}`,
    display: "flex",
    gap: 4,
    alignItems: "center",
  },

  typingDot: (i) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: C.orange,
    animation: `atlasBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
  }),

  errorBanner: {
    margin: "0 14px 8px",
    padding: "8px 12px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#fca5a5",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    flexShrink: 0,
  },

  inputWrap: {
    padding: "10px 12px 12px",
    borderTop: `1px solid ${C.border}`,
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    background: C.bgPanel,
    flexShrink: 0,
  },

  textarea: {
    flex: 1,
    background: C.bgMessage,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    color: C.text,
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    padding: "9px 12px",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
    minHeight: 38,
    maxHeight: 100,
    overflowY: "auto",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  },

  sendBtn: (canSend) => ({
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: canSend
      ? `linear-gradient(135deg, ${C.orange}, #e0621a)`
      : "rgba(255,255,255,0.06)",
    border: "none",
    cursor: canSend ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    transition: "all 0.2s",
    flexShrink: 0,
    boxShadow: canSend ? `0 0 12px ${C.orangeGlow}` : "none",
    transform: canSend ? "scale(1)" : "scale(0.92)",
    color: C.white,
  }),

  footerBrand: {
    textAlign: "center",
    fontSize: 10,
    color: C.textMuted,
    fontFamily: "'DM Sans', sans-serif",
    paddingBottom: 4,
    letterSpacing: "0.04em",
  },
};

/* ─── Keyframes injected once ────────────────────────────────── */
const KEYFRAMES = `
  @keyframes atlasBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-5px); opacity: 1; }
  }
  @keyframes atlasFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes atlasNudgeIn {
    from { opacity: 0; transform: translateY(10px) scale(0.91); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  .atlas-msg-enter { animation: atlasFadeIn 0.2s ease forwards; }
  .atlas-suggestion-btn:hover {
    background: rgba(255,138,42,0.22) !important;
    border-color: rgba(255,138,42,0.65) !important;
  }
  .atlas-clear-btn:hover {
    background: rgba(255,255,255,0.05) !important;
    color: rgba(240,238,255,0.7) !important;
  }
  .atlas-textarea:focus {
    border-color: rgba(255,138,42,0.5) !important;
  }
  .atlas-nudge::after {
    content: "";
    position: absolute;
    bottom: -7px;
    right: 22px;
    width: 13px;
    height: 13px;
    background: #0e0c22;
    border-right: 1px solid rgba(255,138,42,0.38);
    border-bottom: 1px solid rgba(255,138,42,0.38);
    transform: rotate(45deg);
  }
  .atlas-messages-wrap::-webkit-scrollbar { width: 4px; }
  .atlas-messages-wrap::-webkit-scrollbar-track { background: transparent; }
  .atlas-messages-wrap::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
  }
  @media (max-width: 480px) {
    .atlas-fab-wrapper {
      bottom: 20px !important;
      right: 16px !important;
    }
    .atlas-panel {
      width: calc(100vw - 24px) !important;
      right: 12px !important;
      bottom: 84px !important;
      height: calc(100vh - 110px) !important;
      max-height: calc(100vh - 110px) !important;
      border-radius: 16px !important;
    }
  }
`;

function injectStyles() {
  if (document.getElementById("atlas-chat-styles")) return;
  const style = document.createElement("style");
  style.id = "atlas-chat-styles";
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

/* ─── Suggestion chips ───────────────────────────────────────── */
function getSuggestions(destination) {
  const dest = destination || "my destination";
  return [
    `✈️ Find me flights to ${dest}`,
    `🏨 Best hotels in ${dest} under $200/night`,
    `📅 Plan a 7-day itinerary for ${dest}`,
    `💰 What's a realistic budget for ${dest}?`,
  ];
}

/* ─── Typing indicator ───────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={S.msgRow("assistant")}>
      <div style={S.msgAvatar}>
        <RobotIconSm />
      </div>
      <div style={S.typingBubble}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={S.typingDot(i)} />
        ))}
      </div>
    </div>
  );
}

/* ─── Single message bubble ──────────────────────────────────── */
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div style={S.msgRow(message.role)} className="atlas-msg-enter">
      {!isUser && (
        <div style={S.msgAvatar}>
          <RobotIconSm />
        </div>
      )}
      <div style={S.bubble(message.role)}>{message.content}</div>
    </div>
  );
}

/* ─── Nudge tooltip ──────────────────────────────────────────── */
function AtlasNudge({ visible, onDismiss }) {
  if (!visible) return null;
  return (
    <div style={S.nudge} className="atlas-nudge" role="tooltip">
      <button style={S.nudgeClose} onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
      <strong style={S.nudgeTitle}>👋 I'm Atlas</strong>
      <span style={S.nudgeBody}>
        Type your trip idea and I'll handle flights, hotels &amp; budget
        instantly.
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function AtlasChat({ destination, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const [showNudge, setShowNudge] = useState(true);
  const { messages, isLoading, error, sendMessage, clearChat } = useAtlas();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Inject keyframe styles once on mount
  useEffect(() => {
    injectStyles();
  }, []);

  // Auto-dismiss nudge after 6 seconds
  useEffect(() => {
    if (!showNudge) return;
    const t = setTimeout(() => setShowNudge(false), 6000);
    return () => clearTimeout(t);
  }, [showNudge]);

  // Hide nudge when panel opens; re-show on close
  useEffect(() => {
    if (open) {
      setShowNudge(false);
    }
  }, [open]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, open]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 280);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestion = useCallback(
    (text) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleFabClick = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const canSend = input.trim().length > 0 && !isLoading;
  const suggestions = getSuggestions(destination);

  return (
    <>
      {/* ── Chat Panel ── */}
      <div style={S.panel(open)} className="atlas-panel">
        {/* Header */}
        <div style={S.header}>
          <div style={S.avatarWrap}>
            <RobotIcon size={20} />
          </div>
          <div style={S.headerText}>
            <p style={S.headerTitle}>Atlas AI</p>
            <p style={S.headerSub}>Skyrio Travel Assistant</p>
          </div>
          <div style={S.statusDot(!isLoading)} />
          {messages.length > 0 && (
            <button
              style={S.clearBtn}
              className="atlas-clear-btn"
              onClick={clearChat}
              title="Clear chat"
            >
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={S.messagesWrap} className="atlas-messages-wrap">
          {messages.length === 0 ? (
            <div style={S.welcome}>
              <div style={S.welcomeOrb}>
                <RobotIcon size={26} />
              </div>
              <p style={S.welcomeTitle}>
                {destination
                  ? `Planning your ${destination} trip?`
                  : "Where are we going?"}
              </p>
              <p style={S.welcomeSub}>
                Ask me anything — flights, hotels, budgets, itineraries. I'll
                find the best options for you.
              </p>
              <div style={S.suggestionsWrap}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    style={S.suggestionBtn}
                    className="atlas-suggestion-btn"
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error banner */}
        {error && <div style={S.errorBanner}>⚠️ {error}</div>}

        {/* Input row */}
        <div style={S.inputWrap}>
          <textarea
            ref={textareaRef}
            style={S.textarea}
            className="atlas-textarea"
            rows={1}
            placeholder="Ask Atlas anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            style={S.sendBtn(canSend)}
            onClick={handleSend}
            disabled={!canSend}
            title="Send"
          >
            {isLoading ? "⏳" : "↑"}
          </button>
        </div>

        <div style={S.footerBrand}>Powered by Skyrio Atlas AI</div>
      </div>

      {/* ── FAB wrapper: nudge + button + hint label ── */}
      <div style={S.fabWrapper} className="atlas-fab-wrapper">
        {/* Nudge tooltip — auto-dismisses after 6s */}
        <AtlasNudge
          visible={showNudge && !open}
          onDismiss={() => setShowNudge(false)}
        />

        {/* Trigger button */}
        <button
          style={S.trigger(open)}
          className="atlas-trigger"
          onClick={handleFabClick}
          title={open ? "Close Atlas" : "Open Atlas AI"}
          aria-label={open ? "Close Atlas AI chat" : "Open Atlas AI chat"}
        >
          {open ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M2 2l12 12M14 2L2 14"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          ) : (
            <RobotIcon size={22} />
          )}
        </button>

        {/* Hint label under FAB when closed */}
        {!open && <span style={S.fabHint}>Open Atlas AI</span>}
      </div>
    </>
  );
}
