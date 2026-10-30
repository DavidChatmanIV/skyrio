import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import Compass from "@/components/Atlas/Compass";
import AtlasBookingCard from "@/components/Atlas/AtlasBookingCard";
import AtlasProfileCard from "@/components/Atlas/AtlasProfileCard";
import AtlasCheckoutCard from "@/components/Atlas/AtlasCheckoutCard";
import { getGuestKey } from "@/lib/guestKey";
import AtlasFeedbackBar from "@/components/Atlas/AtlasFeedbackBar";
import {
  X,
  RotateCcw,
  ArrowUp,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Ticket,
  Loader2,
  CheckCircle2,
  LifeBuoy,
} from "lucide-react";
import "@/styles/AtlasPanel.css";

const API = import.meta.env.VITE_API_URL || "";

// Chat is kept for this browser tab, so moving between pages (or a
// refresh) doesn't wipe the conversation.
const CHAT_KEY = "skyrio_atlas_chat";
const loadChat = () => {
  try {
    const list = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "[]");
    return Array.isArray(list)
      ? list
          .filter((m) => m && typeof m.content === "string" && m.content)
          .map((m) => ({ ...m, streaming: false }))
          .slice(-30)
      : [];
  } catch {
    return [];
  }
};
// One id per chat, so feedback XP pays once per conversation.
const CONVO_KEY = "skyrio_atlas_convo";
const newConvoId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const loadConvoId = () => {
  try {
    const id = sessionStorage.getItem(CONVO_KEY);
    if (id) return id;
    const fresh = newConvoId();
    sessionStorage.setItem(CONVO_KEY, fresh);
    return fresh;
  } catch {
    return newConvoId();
  }
};
const isSignedIn = () => {
  try {
    return Boolean(localStorage.getItem("token"));
  } catch {
    return false;
  }
};

// Cards Atlas can bring up in chat
const KNOWN_ACTION = (a) =>
  (a?.type === "cancel" && a.bookingId) ||
  (a?.type === "booking" && a.proposalId) ||
  a?.type === "profile_setup" ||
  (a?.type === "checkout_link" && typeof a.url === "string" && /^https?:\/\//.test(a.url));

const saveChat = (list) => {
  try {
    sessionStorage.setItem(
      CHAT_KEY,
      JSON.stringify(list.filter((m) => !m.streaming).slice(-30))
    );
  } catch {
    /* storage full or blocked — chat still works */
  }
};

// The trip details Atlas may see. Sent as plain data; the server turns
// them into Atlas's instructions (see services/atlasPrompt.js).
function contextForServer(ctx) {
  const c = ctx || {};
  return {
    destination: c.destination || null,
    budget: c.budget || null,
    tripDays: c.tripDays || null,
    bookingTotal: c.bookingTotal || null,
    spent: c.spent || null,
    tripType: c.tripType || null,
    // Set by SyncGroupPage so Atlas can book this traveler's share
    syncTripId: c.syncTripId || null,
    flights: Array.isArray(c.flights)
      ? c.flights.slice(0, 50).map((f) => ({
          owner: f?.owner,
          totalAmount: f?.totalAmount,
          stops: f?.stops,
        }))
      : [],
  };
}

// Tiny, safe formatter for Atlas replies: paragraphs, "- " / "1." lists
// and **bold**. Builds React elements — never injects HTML.
function inline(text, keyBase) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}
function RichText({ text }) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n");
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  lines.forEach((raw) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flush();
        list = { type, items: [] };
      }
      list.items.push((bullet || numbered)[1]);
      return;
    }
    flush();
    if (line) blocks.push({ type: "p", text: line.replace(/^#+\s*/, "") });
  });
  flush();
  return blocks.map((b, i) => {
    if (b.type === "p") return <p key={i}>{inline(b.text, i)}</p>;
    const Tag = b.type;
    return (
      <Tag key={i}>
        {b.items.map((item, j) => (
          <li key={j}>{inline(item, `${i}-${j}`)}</li>
        ))}
      </Tag>
    );
  });
}

function buildStarterPrompts(ctx) {
  const { destination, budget, tripDays, bookingTotal, flights, tripType } =
    ctx || {};
  const hasDest = destination && destination.trim().length > 0;
  const hasBudget = budget && Number(budget) > 0;
  const hasFlights = Array.isArray(flights) && flights.length > 0;
  const hasBooking = bookingTotal && Number(bookingTotal) > 0;

  const prompts = [];

  if (hasDest && tripType === "family")
    prompts.push(`What's a kid-friendly itinerary for ${destination}?`);
  if (hasDest && tripType === "romantic")
    prompts.push(`What are the most romantic spots in ${destination}?`);
  if (hasDest && tripType === "solo")
    prompts.push(`Is ${destination} safe and easy for solo travelers?`);
  if (hasDest && tripType === "group")
    prompts.push(`What activities work well for a group in ${destination}?`);

  if (hasDest && hasBudget)
    prompts.push(
      `How should I split my $${Number(
        budget
      ).toLocaleString()} budget for ${destination}?`
    );
  if (hasFlights) prompts.push("Which flight option gives the best value?");
  if (hasDest) {
    prompts.push(`What's the best time of year to visit ${destination}?`);
    prompts.push(`What are the must-do experiences in ${destination}?`);
  }
  if (hasBooking && hasBudget) {
    const left = Number(budget) - Number(bookingTotal);
    prompts.push(`I have $${left.toLocaleString()} left — where should it go?`);
  }
  if (tripDays && hasDest)
    prompts.push(`Build me a ${tripDays}-day itinerary for ${destination}.`);

  const fallbacks = [
    "I need to cancel one of my bookings.",
    "Find me a warm destination under $1,500 in the next 6 weeks.",
    "What's the cheapest day to fly to Europe right now?",
    "Help me plan a 5-day trip under $800.",
    "What are the best value long-haul routes from the US?",
    "How far in advance should I book for the best price?",
    "Plan a group trip that works for everyone's budget.",
  ];

  const merged = [...prompts];
  for (const f of fallbacks) {
    if (merged.length >= 4) break;
    if (!merged.includes(f)) merged.push(f);
  }
  return merged.slice(0, 4);
}

// Same robot as the FAB and the landing page, so Atlas looks the same
// everywhere.
function RobotIcon({ size = 20 }) {
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
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.5" />
      <rect x="8" y="5.5" width="8" height="5.5" rx="2" opacity=".9" />
      <circle cx="10" cy="14" r="1.5" fill="#FFD060" />
      <circle cx="14" cy="14" r="1.5" fill="#FFD060" />
      <line
        x1="12"
        y1="5.5"
        x2="12"
        y2="3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3" r="1.3" />
      <line
        x1="5.5"
        y1="13"
        x2="3.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
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

function ChatIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function CompassIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z" />
    </svg>
  );
}

const MODES = {
  chat: {
    label: "Chat",
    Icon: ChatIcon,
    status: "Trip help & bookings",
    hint: "Ask about your trip, book flights and hotels, or get help with a booking.",
  },
  compass: {
    label: "Compass",
    Icon: CompassIcon,
    status: "City highlights",
    hint: "Type a city to get the best time to go and top things to do. Nothing to book.",
  },
};

// ─────────────────────────────────────────────────────────────
// Cancel card — Atlas brings it up; the TRAVELER confirms.
// Uses the same routes as My Trips: cancel-quote → cancel, or a
// cancellation request to Skyrio support when automatic terms aren't
// available (a person finishes those).
// ─────────────────────────────────────────────────────────────
const fmtMoney = (n, cur = "USD") => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
    }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
};
const authJson = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

function CancelCard({ action, onResolved }) {
  const [phase, setPhase] = useState(action.done ? "done" : "loading");
  const [quote, setQuote] = useState(null);
  const [problem, setProblem] = useState(null); // plain-language reason
  const [canRequest, setCanRequest] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(action.done || null);

  useEffect(() => {
    if (action.done) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/bookings/${action.bookingId}/cancel-quote`,
          { headers: authJson() }
        );
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setProblem(
            data.message ||
              "We couldn't get the cancellation terms automatically."
          );
          setCanRequest(Boolean(data.canRequest));
          setPhase("problem");
          return;
        }
        if (!data.cancellable) {
          setProblem(data.reason || "This booking can't be cancelled here.");
          setCanRequest(false);
          setPhase("problem");
          return;
        }
        setQuote(data);
        setPhase("quote");
      } catch {
        if (!alive) return;
        setProblem(
          "We couldn't reach Skyrio. Check your connection and try again."
        );
        setCanRequest(true);
        setPhase("problem");
      }
    })();
    return () => {
      alive = false;
    };
  }, [action.bookingId, action.done]);

  const finish = (text, tone = "ok") => {
    const done = { text, tone };
    setResult(done);
    setPhase("done");
    onResolved?.(done);
  };

  const cancelNow = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/api/bookings/${action.bookingId}/cancel`,
        {
          method: "POST",
          headers: authJson(),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        setProblem(
          data.message ||
            "The cancellation didn't go through. Nothing was changed."
        );
        setCanRequest(true);
        setPhase("problem");
        return;
      }
      if (data.pending) {
        finish(
          "Cancellation sent to the airline. They usually confirm shortly — you'll get an email and a notification."
        );
      } else if (data.partial) {
        finish(
          data.message ||
            "Part of this booking was cancelled. Skyrio support will contact you to finish it.",
          "warn"
        );
      } else {
        const refund = fmtMoney(data.customerRefund, data.currency);
        finish(
          Number(data.customerRefund) > 0 && refund
            ? `Cancelled. A refund of ${refund} is on its way to your card (usually 5–10 business days).`
            : "Cancelled. Under the airline's or hotel's policy, no refund applies."
        );
      }
    } catch {
      setProblem(
        "We couldn't reach Skyrio, so nothing was cancelled. Try again."
      );
      setCanRequest(true);
      setPhase("problem");
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/api/bookings/${action.bookingId}/cancel-request`,
        {
          method: "POST",
          headers: authJson(),
          body: JSON.stringify({ reason: "Requested through Atlas chat" }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(
          data.message ||
            "We couldn't send the request. Please use Help to contact support."
        );
        setCanRequest(false);
        return;
      }
      finish(
        data.alreadyRequested
          ? "Skyrio support already has your request. They'll contact you before anything is cancelled."
          : "Request sent to Skyrio support. Nothing is cancelled yet — they'll confirm the terms with you first."
      );
    } catch {
      setProblem(
        "We couldn't send the request. Please use Help to contact support."
      );
    } finally {
      setBusy(false);
    }
  };

  const cur = quote?.currency || "USD";
  return (
    <section
      className="ap-card"
      aria-label={`Cancel ${action.trip || "booking"}`}
    >
      <div className="ap-card__top">
        <Ticket size={16} aria-hidden="true" />
        <div>
          <div className="ap-card__eyebrow">Cancel booking</div>
          <div className="ap-card__trip">{action.trip || "Your booking"}</div>
        </div>
      </div>
      <div className="ap-card__body">
        {phase === "loading" && (
          <span>
            <Loader2 size={13} className="ap-spin ap-inline-icon" /> Checking
            the cancellation terms…
          </span>
        )}

        {phase === "quote" && quote && (
          <>
            <div className="ap-card__rows">
              {fmtMoney(quote.paid, cur) && (
                <div className="ap-card__row">
                  You paid <b>{fmtMoney(quote.paid, cur)}</b>
                </div>
              )}
              {quote.estimatedFee != null && (
                <div className="ap-card__row">
                  Cancellation fee <b>{fmtMoney(quote.estimatedFee, cur)}</b>
                </div>
              )}
              {quote.estimatedRefund != null && (
                <div className="ap-card__row is-refund">
                  Expected refund <b>{fmtMoney(quote.estimatedRefund, cur)}</b>
                </div>
              )}
            </div>
            {quote.note && <div className="ap-card__note">{quote.note}</div>}
            <div className="ap-card__btns">
              {!sure ? (
                <button
                  type="button"
                  className="ap-card__btn is-danger"
                  onClick={() => setSure(true)}
                >
                  Cancel this booking
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="ap-card__btn is-danger"
                    onClick={cancelNow}
                    disabled={busy}
                  >
                    {busy ? <Loader2 size={13} className="ap-spin" /> : null}
                    Yes, cancel it
                  </button>
                  <button
                    type="button"
                    className="ap-card__btn"
                    onClick={() => setSure(false)}
                    disabled={busy}
                  >
                    Keep it
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {phase === "problem" && (
          <>
            <span className="ap-card__warn">{problem}</span>
            {canRequest ? (
              <>
                <span className="ap-card__note">
                  Skyrio support can cancel it for you. They'll confirm the
                  terms with you before anything is cancelled.
                </span>
                <div className="ap-card__btns">
                  <button
                    type="button"
                    className="ap-card__btn is-primary"
                    onClick={sendRequest}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 size={13} className="ap-spin" />
                    ) : (
                      <LifeBuoy size={13} />
                    )}
                    Send to Skyrio support
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}

        {phase === "done" && result && (
          <div className="ap-card__done" role="status">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>{result.text}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function AtlasNudge({ visible, onDismiss }) {
  if (!visible) return null;
  return (
    <div className="ap-nudge" role="tooltip" aria-live="polite">
      <button
        className="ap-nudge__close"
        onClick={onDismiss}
        aria-label="Dismiss Atlas tip"
      >
        <X size={12} />
      </button>
      <strong className="ap-nudge__title">
        <Sparkles size={14} className="ap-inline-icon" /> I'm Atlas
      </strong>
      <span className="ap-nudge__body">
        Ask me about flights, hotels, timing or your budget.
      </span>
    </div>
  );
}

function Bubble({ msg, onActionResolved, conversationId, onProfileDone }) {
  const isUser = msg.role === "user";
  const isStream = msg.streaming;
  const cards = !isUser && Array.isArray(msg.actions) ? msg.actions : [];
  const showFeedback =
    !isUser && !isStream && msg.content && isSignedIn() && !msg.noFeedback;
  return (
    <>
      <div
        className={`ap-bubble ap-bubble--${isUser ? "user" : "atlas"}${
          isStream ? " ap-bubble--streaming" : ""
        }`}
      >
        {!isUser && (
          <div className="ap-bubble__avatar">
            <RobotIcon size={13} />
          </div>
        )}
        <div className="ap-bubble__text">
          {isUser ? (
            msg.content
          ) : isStream && !msg.content ? (
            <span className="ap-typing" aria-label="Atlas is thinking">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <>
              <RichText text={msg.content} />
              {isStream && <span className="ap-cursor" />}
            </>
          )}
        </div>
      </div>
      {cards.map((action, i) => {
        if (action?.type === "cancel")
          return (
            <CancelCard
              key={`${action.bookingId}-${i}`}
              action={action}
              onResolved={(done) => onActionResolved?.(msg.id, i, done)}
            />
          );
        if (action?.type === "booking")
          return (
            <AtlasBookingCard
              key={`${action.proposalId}-${i}`}
              proposalId={action.proposalId}
            />
          );
        if (action?.type === "checkout_link")
          return <AtlasCheckoutCard key={`checkout-${i}`} action={action} />;
        if (action?.type === "profile_setup")
          return action.done ? (
            <div key={`profile-${i}`} className="ap-card__done" role="status">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>Travel profile saved</span>
            </div>
          ) : (
            <AtlasProfileCard
              key={`profile-${i}`}
              focus={action.focus || "full"}
              travelerId={action.travelerId}
              reason={action.reason}
              onDone={(summary) => {
                onActionResolved?.(msg.id, i, { text: summary });
                onProfileDone?.(summary);
              }}
            />
          );
        return null;
      })}
      {showFeedback && (
        <AtlasFeedbackBar
          conversationId={conversationId}
          messageId={msg.id}
          atlasReply={msg.content}
          toolsUsed={msg.toolsUsed || []}
        />
      )}
    </>
  );
}

export default function AtlasPanel() {
  const {
    atlasContext,
    atlasDestination,
    pendingAtlasMessage,
    clearPendingAtlasMessage,
  } = useAtlasContext();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("chat"); // "chat" | "compass"
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(loadChat);
  const [conversationId, setConversationId] = useState(loadConvoId);
  // Last thing the traveler asked — so "Try again" can resend it.
  const lastAskRef = useRef("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNudge, setShowNudge] = useState(true);
  const [pickerActive, setPickerActive] = useState(false);
  // Mobile: step aside while the site footer is on screen
  const [footerInView, setFooterInView] = useState(false);

  // ── Other parts of the site can open Atlas in a mode ──
  // e.g. the landing page's "Open Compass" button:
  //   window.dispatchEvent(new CustomEvent("skyrio:open-atlas",
  //     { detail: { mode: "compass" } }))
  useEffect(() => {
    const onOpen = (e) => {
      if (e.detail) e.detail.handled = true; // tells the sender it worked
      const next = e.detail?.mode;
      setMode(next === "compass" ? "compass" : "chat");
      setOpen(true);
    };
    window.addEventListener("skyrio:open-atlas", onOpen);
    return () => window.removeEventListener("skyrio:open-atlas", onOpen);
  }, []);

  // ── Esc closes the panel ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) return setFooterInView(false);
      setFooterInView(
        footer.getBoundingClientRect().top < window.innerHeight - 40
      );
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

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => saveChat(messages), [messages]);

  // Message box grows with the text (up to ~5 lines).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input, open, mode]);

  const starterPrompts = useMemo(
    () => buildStarterPrompts(atlasContext),
    [atlasContext]
  );

  // ── Watch for messages triggered by TripTypeSelector ──
  useEffect(() => {
    if (!pendingAtlasMessage) return;
    setOpen(true);
    setMode("chat");
    const t = setTimeout(() => {
      sendMessage(pendingAtlasMessage.text);
      clearPendingAtlasMessage();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAtlasMessage]);

  // ── Observe DOM for open date picker ──
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && mode === "chat")
      setTimeout(() => inputRef.current?.focus(), 120);
  }, [open, mode]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!showNudge) return;
    const t = setTimeout(() => setShowNudge(false), 7000);
    return () => clearTimeout(t);
  }, [showNudge]);

  useEffect(() => {
    if (open) setShowNudge(false);
  }, [open]);

  const sendMessage = useCallback(
    async (text, { retry = false } = {}) => {
      const userText = (retry ? lastAskRef.current : text || input).trim();
      if (!userText || loading) return;
      lastAskRef.current = userText;

      if (!retry) setInput("");
      setError(null);

      // A retry re-asks the last question without adding it twice.
      let base = messages;
      if (!retry) {
        const userMsg = { id: Date.now(), role: "user", content: userText };
        base = [...messages, userMsg];
        setMessages(base);
      }
      setLoading(true);

      const history = base.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const streamId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        { id: streamId, role: "atlas", content: "", streaming: true },
      ]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      // Never leave the traveler waiting forever.
      const giveUp = setTimeout(() => controller.abort("timeout"), 60000);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/api/atlas/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // Lets a logged-out visitor's search results work across messages.
            "X-Skyrio-Guest": getGuestKey(),
          },
          // Trip details only — the server writes Atlas's instructions.
          body: JSON.stringify({
            source: "panel",
            messages: history,
            context: contextForServer(atlasContext),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error ||
              errData.message ||
              "Atlas couldn't answer just now. Please try again."
          );
        }

        if (res.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  const delta =
                    parsed?.delta?.text ||
                    parsed?.choices?.[0]?.delta?.content ||
                    "";
                  if (delta) {
                    accumulated += delta;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamId ? { ...m, content: accumulated } : m
                      )
                    );
                  }
                } catch {
                  /* skip */
                }
              }
            }
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, streaming: false } : m
            )
          );
        } else {
          const data = await res.json();
          const content =
            data.reply ||
            data.content?.[0]?.text ||
            data.message ||
            "I couldn't come up with an answer. Please try again.";
          const actions = Array.isArray(data.actions)
            ? data.actions.filter(KNOWN_ACTION)
            : [];
          const toolsUsed = Array.isArray(data.toolsUsed)
            ? data.toolsUsed.slice(0, 10)
            : [];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? {
                    ...m,
                    content,
                    streaming: false,
                    toolsUsed,
                    ...(actions.length ? { actions } : {}),
                  }
                : m
            )
          );
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== streamId));
        // Closed or cleared on purpose — no error to show.
        if (err.name === "AbortError" && controller.signal.reason !== "timeout")
          return;
        setError(
          err.name === "AbortError"
            ? "Atlas took too long to answer."
            : err.message || "Something went wrong."
        );
      } finally {
        clearTimeout(giveUp);
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [input, loading, messages, atlasContext]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Remember a finished card (cancelled / sent to support) so it doesn't
  // offer the buttons again after a refresh.
  const markActionDone = useCallback((msgId, index, done) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && Array.isArray(m.actions)
          ? {
              ...m,
              actions: m.actions.map((a, i) =>
                i === index ? { ...a, done } : a
              ),
            }
          : m
      )
    );
  }, []);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    // A new chat gets a new id (feedback XP is once per conversation)
    const fresh = newConvoId();
    try {
      sessionStorage.setItem(CONVO_KEY, fresh);
    } catch {
      /* storage blocked */
    }
    setConversationId(fresh);
    setError(null);
    setLoading(false);
    lastAskRef.current = "";
  }, []);

  const current = MODES[mode];
  const statusText =
    mode === "chat" && loading
      ? "Thinking…"
      : atlasDestination
      ? `${current.status} · ${atlasDestination}`
      : current.status;
  const showStarters = messages.length === 0 && !loading;

  return (
    <>
      {/* ── Chat / Compass Panel ── */}
      {open && (
        <div
          className="ap-panel"
          role="dialog"
          aria-label="Atlas AI"
          data-mode={mode}
        >
          <div className="ap-header">
            <div className="ap-header__avatar">
              <RobotIcon size={18} />
            </div>
            <div className="ap-header__id">
              <div className="ap-header__name">Atlas</div>
              <div className="ap-header__status">
                <span className={`ap-status-dot${loading ? " is-busy" : ""}`} />
                <span className="ap-header__statusText">{statusText}</span>
              </div>
            </div>
            <div className="ap-header__actions">
              {mode === "chat" && messages.length > 0 && (
                <button
                  type="button"
                  className="ap-icon-btn"
                  onClick={clearChat}
                  title="Start a new chat"
                  aria-label="Start a new chat"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                type="button"
                className="ap-icon-btn"
                onClick={() => setOpen(false)}
                title="Close"
                aria-label="Close Atlas"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Mode switch — pill style, like the main nav ── */}
          <div className="ap-modebar">
            <div className="ap-seg" role="tablist" aria-label="Atlas mode">
              {Object.entries(MODES).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  className={`ap-seg__btn${mode === key ? " is-active" : ""}`}
                  onClick={() => setMode(key)}
                >
                  <m.Icon size={14} />
                  {m.label}
                </button>
              ))}
            </div>
            <p className="ap-mode-hint" key={mode}>
              {current.hint}
            </p>
          </div>

          {mode === "chat" ? (
            <>
              <div className="ap-messages">
                {showStarters && (
                  <div className="ap-starters">
                    <div className="ap-starters__label">Try asking</div>
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="ap-starter-btn"
                        onClick={() => sendMessage(prompt)}
                      >
                        <span>{prompt}</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((msg) => (
                  <Bubble
                    key={msg.id}
                    msg={msg}
                    onActionResolved={markActionDone}
                    conversationId={conversationId}
                    onProfileDone={(summary) =>
                      sendMessage(
                        `I finished my travel profile (${summary}). Let's keep going.`
                      )
                    }
                  />
                ))}
                {error && (
                  <div className="ap-error" role="alert">
                    <AlertTriangle size={14} className="ap-inline-icon" />{" "}
                    <span>{error}</span>
                    {lastAskRef.current ? (
                      <button
                        type="button"
                        className="ap-error__retry"
                        onClick={() => sendMessage("", { retry: true })}
                      >
                        <RefreshCw size={12} aria-hidden="true" /> Try again
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ap-error__retry"
                        onClick={() => setError(null)}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="ap-input-wrap">
                <div className="ap-composer">
                  <textarea
                    ref={inputRef}
                    className="ap-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Atlas about your trip…"
                    aria-label="Message Atlas"
                    maxLength={2000}
                    rows={1}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={`ap-send${
                      input.trim() && !loading ? " ap-send--active" : ""
                    }`}
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    aria-label="Send"
                  >
                    {loading ? (
                      <span className="ap-send__spinner" />
                    ) : (
                      <ArrowUp size={16} />
                    )}
                  </button>
                </div>
                <div className="ap-footer">
                  Atlas can make mistakes. Check the details on the card before you pay.
                </div>
              </div>
            </>
          ) : (
            <div className="ap-guide-wrap">
              <Compass />
            </div>
          )}
        </div>
      )}

      {/* ── FAB — hidden when date picker is open ── */}
      {!pickerActive && (
        <div
          className={`ap-fab-wrapper${
            footerInView && !open ? " is-tucked" : ""
          }`}
        >
          <AtlasNudge
            visible={showNudge && !open}
            onDismiss={() => setShowNudge(false)}
          />
          <button
            type="button"
            className={`ap-fab${open ? " ap-fab--open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close Atlas" : "Open Atlas"}
            aria-expanded={open}
          >
            {open ? (
              <span className="ap-fab__icon">
                <X size={18} />
              </span>
            ) : (
              <>
                <span className="ap-fab__icon">
                  <RobotIcon />
                </span>
                <span className="ap-fab__label">Atlas AI</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
