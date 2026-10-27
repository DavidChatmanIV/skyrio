import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  LifeBuoy,
  X,
  Star,
  Compass,
  Check,
  Send,
  Award,
  Sparkles,
  Lock,
  Globe,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

/* XP shown to users. Keep in sync with XP in server/routes/feedback.routes.js */
const XP = { FEEDBACK_QUICK: 10, FEEDBACK_DETAILED: 25, TESTIMONIAL: 50 };
const MIN_CHARS = 20;

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
const btnPrimary = (busy) => ({
  width: "100%",
  padding: "11px 0",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
  color: "#1a0e06",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: busy ? "not-allowed" : "pointer",
  opacity: busy ? 0.6 : 1,
  fontFamily: "inherit",
  transition: "opacity 0.15s",
  minHeight: 44,
});
const panelStyle = {
  position: "fixed",
  left: 20,
  bottom: 24,
  width: 340,
  maxWidth: "calc(100vw - 40px)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
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
};
const hintText = {
  fontSize: 12.5,
  color: "rgba(255,255,255,0.55)",
  marginBottom: 12,
  lineHeight: 1.4,
};
const textareaStyle = {
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
  marginBottom: 6,
};

const isSignedIn = () => !!localStorage.getItem("token");

async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    method,
    // Sends the login cookie too, in case auth is cookie-based.
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const detail = data.message || data.error;
    console.warn(`[SupportRail] ${method} ${path} → ${res.status}`, data);
    if (res.status === 401)
      throw new Error("Your session expired. Sign in again and retry.");
    if (res.status === 429)
      throw new Error("Too many requests. Wait a minute and try again.");
    throw new Error(
      detail
        ? `${detail} (${res.status})`
        : `Something went wrong (${res.status}). Please try again.`
    );
  }
  return data;
}

/* ─── Small pieces ──────────────────────────────────────────── */

function StarPicker({ value, onChange, size = 20, label = "Rate" }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      style={{ display: "flex", gap: 4, marginBottom: 12 }}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: n <= shown ? "#ff8a2a" : "rgba(255,255,255,0.2)",
            transition: "color 0.15s",
          }}
          aria-label={`${label} ${n} out of 5`}
          aria-pressed={value === n}
        >
          <Star size={size} fill={n <= shown ? "#ff8a2a" : "none"} />
        </button>
      ))}
    </div>
  );
}

function XpChip({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 800,
        color: "#ffb347",
        background: "rgba(255,179,71,0.12)",
        border: "1px solid rgba(255,179,71,0.35)",
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <Sparkles size={11} aria-hidden="true" />
      {children}
    </span>
  );
}

function PanelHeader({ title, onClose, chip }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 8,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {title}
        {chip}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
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
  );
}

function Done({ xp, note, children, onClose }) {
  return (
    <div
      style={{
        fontSize: 13.5,
        color: "rgba(255,255,255,0.7)",
        lineHeight: 1.5,
      }}
    >
      {xp > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            marginBottom: 12,
            borderRadius: 12,
            background: "rgba(255,179,71,0.1)",
            border: "1px solid rgba(255,179,71,0.3)",
            color: "#ffb347",
            fontWeight: 800,
            animation: "railPop 0.3s ease",
          }}
        >
          <Sparkles size={18} aria-hidden="true" />+{xp} XP earned
        </div>
      )}
      {children}
      {note && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            marginTop: 8,
          }}
        >
          {note}
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        style={{ ...btnPrimary(false), display: "block", marginTop: 14 }}
      >
        Close
      </button>
    </div>
  );
}

/* Switch between "Feedback" and "Review" inside one panel */
function ModeToggle({ mode, onChange }) {
  const opts = [
    ["feedback", "Feedback", MessageSquare],
    ["review", "Review", Award],
  ];
  return (
    <>
      <div
        role="tablist"
        aria-label="What would you like to send?"
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          marginBottom: 14,
          borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {opts.map(([value, label, Icon]) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(value)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                minHeight: 36,
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                background: active
                  ? "linear-gradient(135deg, #ff8a2a, #ffb347)"
                  : "transparent",
                color: active ? "#1a0e06" : "rgba(255,255,255,0.6)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          margin: "-6px 2px 14px",
          lineHeight: 1.4,
        }}
      >
        {mode === "feedback" ? (
          <Lock
            size={13}
            aria-hidden="true"
            style={{ flexShrink: 0, color: "#ffb347" }}
          />
        ) : (
          <Globe
            size={13}
            aria-hidden="true"
            style={{ flexShrink: 0, color: "#ffb347" }}
          />
        )}
        {mode === "feedback"
          ? "Private. Only the Skyrio team sees this. Report bugs or share ideas."
          : "Public. Shown to other travelers once approved. Tell them how it went."}
      </div>
    </>
  );
}

const FEEDBACK_TYPES = [
  ["general", "General"],
  ["idea", "Idea"],
  ["bug", "Bug"],
];

/* ═══════════════════════════════════════════════════════════════ */

export default function SupportRail() {
  // "closed" | "feedback" | "review" | "help"
  const [activePanel, setActivePanel] = useState("closed");
  const [pickerActive, setPickerActive] = useState(false);
  // One launcher (desktop + mobile) that fans out Tour, Review, Feedback and Help
  const [menuOpen, setMenuOpen] = useState(false);
  // Tuck the launcher away while the site footer is on screen,
  // so it never covers the footer logo / support email.
  const [footerInView, setFooterInView] = useState(false);

  // ── Feedback state ──
  const [fbType, setFbType] = useState("general");
  const [fbMessage, setFbMessage] = useState("");
  const [fbRating, setFbRating] = useState(0);
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbResult, setFbResult] = useState(null); // { xpAwarded, xpNote }
  const [fbError, setFbError] = useState("");

  // ── Review (testimonial) state ──
  const emptyReview = {
    rating: 0,
    text: "",
    displayName: "",
    city: "",
    consent: true,
    bookingId: null,
    destination: null,
  };
  const [review, setReview] = useState(emptyReview);
  const [rvSubmitting, setRvSubmitting] = useState(false);
  const [rvResult, setRvResult] = useState(null);
  const [rvError, setRvError] = useState("");

  // ── Post-trip nudge ──
  const [prompt, setPrompt] = useState(null); // { bookingId, destination, xp }
  const promptChecked = useRef(false);

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

  // Ask the server once per session whether there's a finished trip to
  // review. The server handles timing (24h–14d after the trip), one review
  // per trip, and the 30-day snooze after "Not now".
  useEffect(() => {
    if (promptChecked.current) return;
    promptChecked.current = true;

    // TEST MODE: add ?testReview to any URL (e.g. myskyrio.com/?testReview)
    // to force the pop-up, skipping every timing and once-per-session rule.
    if (new URLSearchParams(window.location.search).has("testReview")) {
      const t = setTimeout(
        () =>
          setPrompt({ bookingId: null, destination: null, xp: XP.TESTIMONIAL }),
        800
      );
      return () => clearTimeout(t);
    }

    if (!isSignedIn()) {
      console.info("[review prompt] skipped: not signed in");
      return;
    }
    if (sessionStorage.getItem("skyrio_review_prompt_seen")) {
      console.info("[review prompt] skipped: already shown this session");
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { prompt: p, reason } = await api("/api/testimonials/prompt");
        if (!p) {
          console.info(
            `[review prompt] skipped: ${reason || "no trip to ask about"}`
          );
          return;
        }
        setPrompt(p);
        sessionStorage.setItem("skyrio_review_prompt_seen", "1");
        api(`/api/testimonials/prompt/${p.bookingId}/seen`, {
          method: "POST",
          body: {},
        }).catch(() => {});
      } catch (err) {
        // Never bother the user over a failed nudge check.
        console.info("[review prompt] check failed:", err.message);
      }
    }, 4000); // let the page settle first
    return () => clearTimeout(t);
  }, []);

  // Anywhere in the app can open the review panel, e.g. a "Review this trip"
  // button on a past booking:
  //   window.dispatchEvent(new CustomEvent("skyrio:review",
  //     { detail: { bookingId, destination } }))
  useEffect(() => {
    const onReview = (e) => openReview(e.detail || {});
    const onFeedback = () => openPanel("feedback");
    window.addEventListener("skyrio:review", onReview);
    window.addEventListener("skyrio:feedback", onFeedback);
    return () => {
      window.removeEventListener("skyrio:review", onReview);
      window.removeEventListener("skyrio:feedback", onFeedback);
    };
  }, []);

  function openPanel(panel) {
    setMenuOpen(false);
    setActivePanel(panel);
  }

  function openReview({ bookingId = null, destination = null } = {}) {
    setReview((r) => ({ ...r, bookingId, destination }));
    setPrompt(null);
    openPanel("review");
  }

  function dismissPrompt() {
    if (prompt?.bookingId) {
      api(`/api/testimonials/prompt/${prompt.bookingId}/dismiss`, {
        method: "POST",
        body: {},
      }).catch(() => {});
    }
    setPrompt(null);
  }

  function closePanel() {
    setActivePanel("closed");
    setTimeout(() => {
      setFbResult(null);
      setFbError("");
      setRvResult(null);
      setRvError("");
      setReview(emptyReview);
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
      const data = await api("/api/feedback", {
        method: "POST",
        body: {
          type: fbType,
          message: fbMessage.trim(),
          rating: fbRating || undefined,
          page: window.location.pathname,
        },
      });
      setFbResult({ xpAwarded: data.xpAwarded || 0, xpNote: data.xpNote });
      if (data.xpAwarded)
        window.dispatchEvent(
          new CustomEvent("skyrio:xp", { detail: { amount: data.xpAwarded } })
        );
      setFbMessage("");
      setFbRating(0);
      setFbType("general");
    } catch (err) {
      setFbError(err.message);
    } finally {
      setFbSubmitting(false);
    }
  }

  async function handleReviewSubmit() {
    if (!review.rating) return setRvError("Pick a star rating.");
    if (review.text.trim().length < MIN_CHARS)
      return setRvError(`Write at least ${MIN_CHARS} characters.`);
    setRvSubmitting(true);
    setRvError("");
    try {
      const data = await api("/api/testimonials", {
        method: "POST",
        body: {
          rating: review.rating,
          text: review.text.trim(),
          displayName: review.displayName.trim(),
          city: review.city.trim(),
          consent: review.consent,
          bookingId: review.bookingId || undefined,
        },
      });
      setRvResult({ xpAwarded: data.xpAwarded || 0 });
      if (data.xpAwarded)
        window.dispatchEvent(
          new CustomEvent("skyrio:xp", { detail: { amount: data.xpAwarded } })
        );
    } catch (err) {
      setRvError(err.message);
    } finally {
      setRvSubmitting(false);
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
      await api("/api/support", {
        method: "POST",
        body: {
          name: helpForm.name.trim(),
          email: helpForm.email.trim(),
          category: helpForm.category,
          message: helpForm.message.trim(),
          page: window.location.pathname,
        },
      });
      setHelpSent(true);
    } catch (err) {
      setHelpError(err.message);
    } finally {
      setHelpSubmitting(false);
    }
  }

  if (pickerActive) return null;

  const signedIn = isSignedIn();
  const fbChars = fbMessage.trim().length;
  const rvChars = review.text.trim().length;

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
        .sr-action--review {
          background: rgba(16,11,34,0.92);
          border: 1px solid rgba(255,138,42,0.6);
          box-shadow: 0 8px 22px rgba(0,0,0,0.35);
          color: #ff8a2a;
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
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sr-action__xp {
          font-size: 10.5px;
          font-weight: 800;
          opacity: 0.8;
        }

        .sr-launcher {
          position: relative;
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

        /* Post-trip review nudge */
        .sr-nudge {
          position: fixed;
          left: 20px;
          bottom: 84px;
          z-index: 2147483631;
          width: 300px;
          max-width: calc(100vw - 40px);
          background: rgba(12, 9, 28, 0.97);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,138,42,0.4);
          border-radius: 16px;
          box-shadow: 0 18px 48px rgba(0,0,0,0.5);
          padding: 14px 16px;
          font-family: 'DM Sans', sans-serif;
          color: #fff;
          animation: railPanelIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
        }
        .sr-nudge__btns { display: flex; gap: 8px; margin-top: 12px; }
        .sr-nudge__btn {
          flex: 1;
          min-height: 38px;
          border-radius: 10px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .sr-chip {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.65);
          border-radius: 999px;
          padding: 5px 12px;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .sr-chip[aria-pressed="true"] {
          border-color: #ff8a2a;
          background: rgba(255,138,42,0.14);
          color: #ff8a2a;
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
          .sr-nudge { left: 12px; bottom: 74px; }
        }
        @media (max-width: 480px) {
          .sr-panel { width: calc(100vw - 24px) !important; left: 12px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sr-action, .sr-launcher, .sr-rail-wrapper { transition: none; }
          .sr-rail-wrapper.is-open .sr-action, .sr-nudge { animation: none; }
        }
      `}</style>

      {/* ── Tap/click outside to close the menu ── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 2147483629 }}
        />
      )}

      {/* ── Post-trip review nudge (once per session, server decides when) ── */}
      {prompt && activePanel === "closed" && !menuOpen && !footerInView && (
        <div className="sr-nudge" role="dialog" aria-label="Review your trip">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                {prompt.destination
                  ? `How was ${prompt.destination}?`
                  : "How was your trip?"}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.4,
                }}
              >
                Tell other travelers how it went. Good or bad, you earn the same{" "}
                <span style={{ color: "#ffb347", fontWeight: 700 }}>
                  +{prompt.xp || XP.TESTIMONIAL} XP
                </span>
                .
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrompt}
              aria-label="Dismiss"
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.45)",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="sr-nudge__btns">
            <button
              type="button"
              className="sr-nudge__btn"
              onClick={dismissPrompt}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Not now
            </button>
            <button
              type="button"
              className="sr-nudge__btn"
              onClick={() => openReview(prompt)}
              style={{
                border: "none",
                background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
                color: "#1a0e06",
              }}
            >
              Leave a review
            </button>
          </div>
        </div>
      )}

      {/* ── Rail: one launcher that fans out the actions ── */}
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
          <span className="sr-action__label">
            Feedback & reviews
            {signedIn && <span className="sr-action__xp">+XP</span>}
          </span>
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

      {/* ── Backdrop (all panels share it) ── */}
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
          style={panelStyle}
        >
          <PanelHeader
            title={fbResult ? "Thank you!" : "Send feedback"}
            onClose={closePanel}
            chip={
              !fbResult &&
              signedIn && (
                <XpChip>
                  +{XP.FEEDBACK_QUICK}–{XP.FEEDBACK_DETAILED} XP
                </XpChip>
              )
            }
          />

          {!fbResult && (
            <ModeToggle
              mode="feedback"
              onChange={(m) => m === "review" && openReview()}
            />
          )}

          {fbResult ? (
            <Done
              xp={fbResult.xpAwarded}
              note={fbResult.xpNote}
              onClose={closePanel}
            >
              Got it. Thanks for helping us improve Skyrio. We read every
              submission, and if we build what you suggested you'll get a bonus.
            </Done>
          ) : (
            <>
              <div
                role="group"
                aria-label="Feedback type"
                style={{ display: "flex", gap: 6, marginBottom: 12 }}
              >
                {FEEDBACK_TYPES.map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className="sr-chip"
                    aria-pressed={fbType === v}
                    onClick={() => setFbType(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <StarPicker value={fbRating} onChange={setFbRating} />

              <textarea
                value={fbMessage}
                onChange={(e) => setFbMessage(e.target.value)}
                placeholder={
                  fbType === "bug"
                    ? "What happened, and what did you expect?"
                    : "Tell us what you think..."
                }
                aria-label="Your feedback"
                rows={4}
                maxLength={4000}
                style={textareaStyle}
              />
              <div
                style={{
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 10,
                }}
              >
                {!signedIn
                  ? "Sign in to earn XP for feedback."
                  : fbChars < MIN_CHARS
                  ? `${MIN_CHARS - fbChars} more characters to earn XP`
                  : "XP is the same whatever you rate us."}
              </div>

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
                style={btnPrimary(fbSubmitting)}
              >
                {fbSubmitting ? "Sending..." : "Send feedback"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Review (testimonial) panel ── */}
      {activePanel === "review" && (
        <div
          className="sr-panel"
          role="dialog"
          aria-label="Leave a review"
          onClick={(e) => e.stopPropagation()}
          style={panelStyle}
        >
          <PanelHeader
            title={
              rvResult
                ? "Thanks for the review!"
                : review.destination
                ? `Review ${review.destination}`
                : "Leave a review"
            }
            onClose={closePanel}
            chip={
              !rvResult && signedIn && <XpChip>+{XP.TESTIMONIAL} XP</XpChip>
            }
          />

          {!rvResult && !review.bookingId && (
            <ModeToggle
              mode="review"
              onChange={(m) => m === "feedback" && setActivePanel("feedback")}
            />
          )}

          {!signedIn ? (
            <div
              style={{
                fontSize: 13.5,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.5,
              }}
            >
              Sign in to leave a review. Reviews are tied to your account so
              other travelers know they're real.
              <a
                href="/login"
                style={{
                  ...btnPrimary(false),
                  display: "block",
                  marginTop: 14,
                  textAlign: "center",
                  textDecoration: "none",
                  lineHeight: "22px",
                  boxSizing: "border-box",
                }}
              >
                Sign in
              </a>
            </div>
          ) : rvResult ? (
            <Done xp={rvResult.xpAwarded} onClose={closePanel}>
              Your review goes live once we've checked it for spam and personal
              info. We never hide a review for being negative.
            </Done>
          ) : (
            <>
              <StarPicker
                value={review.rating}
                onChange={(n) => setReview((r) => ({ ...r, rating: n }))}
                size={24}
              />

              <textarea
                value={review.text}
                onChange={(e) =>
                  setReview((r) => ({ ...r, text: e.target.value }))
                }
                placeholder="What stood out about booking with Skyrio?"
                aria-label="Your review"
                rows={4}
                maxLength={1000}
                style={textareaStyle}
              />
              <div
                style={{
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 12,
                }}
              >
                {rvChars < MIN_CHARS
                  ? `${
                      MIN_CHARS - rvChars
                    } more characters · Same XP whatever you rate us`
                  : `${rvChars}/1000 · Same XP whatever you rate us`}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  style={{ ...inputStyle, fontSize: 16 }}
                  value={review.displayName}
                  onChange={(e) =>
                    setReview((r) => ({ ...r, displayName: e.target.value }))
                  }
                  placeholder="Name (optional)"
                  aria-label="Display name (optional)"
                  maxLength={40}
                />
                <input
                  style={{ ...inputStyle, fontSize: 16 }}
                  value={review.city}
                  onChange={(e) =>
                    setReview((r) => ({ ...r, city: e.target.value }))
                  }
                  placeholder="City (optional)"
                  aria-label="City (optional)"
                  maxLength={60}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.65)",
                  marginBottom: 12,
                  cursor: "pointer",
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  checked={review.consent}
                  onChange={(e) =>
                    setReview((r) => ({ ...r, consent: e.target.checked }))
                  }
                  style={{ marginTop: 2, accentColor: "#ff8a2a" }}
                />
                OK to show this review on Skyrio
              </label>

              {rvError && (
                <div
                  role="alert"
                  style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}
                >
                  {rvError}
                </div>
              )}

              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={rvSubmitting}
                style={btnPrimary(rvSubmitting)}
              >
                {rvSubmitting ? "Sending..." : "Post review"}
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
