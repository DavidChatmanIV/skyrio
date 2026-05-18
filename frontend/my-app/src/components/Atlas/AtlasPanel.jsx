/**
 * Floating chat panel for Atlas AI.
 * - Reads booking context from AtlasContext (destination, budget, flights, spend)
 * - Starter prompts surface contextually based on what the user is doing
 * - Strong system prompt grounds Atlas in Skyrio's real data
 * - Streams responses from Anthropic via /api/atlas/chat
 * - FAB trigger button (orange ✦)
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import { Sparkles, Bot, X } from "lucide-react";
import "@/styles/AtlasPanel.css";

const API = import.meta.env.VITE_API_URL || "";

// ─────────────────────────────────────────────────────────────
// System prompt — grounds Atlas in real booking context
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx) {
  const { destination, budget, tripDays, bookingTotal, spent, flights } =
    ctx || {};

  const hasDest = destination && destination.trim().length > 0;
  const hasBudget = budget && Number(budget) > 0;
  const hasFlights = Array.isArray(flights) && flights.length > 0;
  const hasSpend = bookingTotal && Number(bookingTotal) > 0;

  const contextLines = [];
  if (hasDest) contextLines.push(`- Destination: ${destination}`);
  if (hasBudget)
    contextLines.push(`- Total budget: $${Number(budget).toLocaleString()}`);
  if (tripDays)
    contextLines.push(
      `- Trip length: ${tripDays} night${tripDays !== 1 ? "s" : ""}`
    );
  if (hasSpend)
    contextLines.push(
      `- Flight booked: $${Number(bookingTotal).toLocaleString()}`
    );
  if (spent && Number(spent) > 0)
    contextLines.push(
      `- Total tracked spend so far: $${Number(spent).toLocaleString()}`
    );
  if (hasBudget && hasSpend) {
    const left = Number(budget) - Number(bookingTotal) - (Number(spent) || 0);
    contextLines.push(`- Remaining budget: $${left.toLocaleString()}`);
  }
  if (hasFlights) {
    const cheapest = [...flights].sort(
      (a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
    )[0];
    contextLines.push(
      `- ${flights.length} flight option${
        flights.length !== 1 ? "s" : ""
      } loaded. Cheapest: ${cheapest.owner} at $${parseFloat(
        cheapest.totalAmount
      ).toFixed(0)} (${
        cheapest.stops === 0 ? "nonstop" : `${cheapest.stops} stop`
      })`
    );
  }

  const contextBlock =
    contextLines.length > 0
      ? `\n\nCURRENT BOOKING CONTEXT:\n${contextLines.join("\n")}`
      : "\n\nNo booking context loaded yet — the user hasn't selected a destination or started a search.";

  return `You are Atlas, Skyrio's AI travel companion. You are sharp, warm, and genuinely helpful — like a well-traveled friend who happens to know everything about flights, hotels, and trip planning.

Your job is to help users plan smarter trips: better routes, better timing, better value. You combine real data awareness with honest, direct advice.

PERSONALITY:
- Confident but never arrogant. You give opinions when asked.
- Concise first. Expand only if the user wants more.
- Never use generic filler phrases like "Great question!" or "Certainly!".
- Use numbers when they matter. Vague advice is useless.
- Occasionally use light humor if the mood fits — but never force it.

CAPABILITIES YOU HAVE IN SKYRIO:
- You can see the user's current destination, budget, trip length, and spend.
- You can reference flight options that are loaded on the page.
- You can suggest better routes, timing, budget splits, and hotel strategies.
- You can help the user decide between flight options based on stops, price, and timing.
- You can flag when they're close to or over budget and suggest adjustments.

WHAT YOU DO NOT DO:
- Never make up flight prices or hotel rates. Reference what's loaded or say you don't have that data.
- Never ask for information Skyrio already has (destination, budget, etc.) — use the context.
- Never give generic travel blog advice. Be specific to this user's situation.
- Never be sycophantic.${contextBlock}

Keep responses under 120 words unless the user asks for a detailed breakdown. Use short paragraphs or bullet points when listing options. Always end with a clear next step or question if more info would help.`;
}

// ─────────────────────────────────────────────────────────────
// Starter prompts — context-aware
// ─────────────────────────────────────────────────────────────
function buildStarterPrompts(ctx) {
  const { destination, budget, tripDays, bookingTotal, flights } = ctx || {};
  const hasDest = destination && destination.trim().length > 0;
  const hasBudget = budget && Number(budget) > 0;
  const hasFlights = Array.isArray(flights) && flights.length > 0;
  const hasBooking = bookingTotal && Number(bookingTotal) > 0;

  // Context-specific prompts first
  const prompts = [];

  if (hasDest && hasBudget) {
    prompts.push(
      `How should I split my $${Number(
        budget
      ).toLocaleString()} budget for ${destination}?`
    );
  }
  if (hasFlights) {
    prompts.push("Which flight option gives the best value?");
  }
  if (hasDest) {
    prompts.push(`What's the best time of year to visit ${destination}?`);
    prompts.push(`What are the must-do experiences in ${destination}?`);
  }
  if (hasBooking && hasBudget) {
    const left = Number(budget) - Number(bookingTotal);
    prompts.push(`I have $${left.toLocaleString()} left — where should it go?`);
  }
  if (tripDays && hasDest) {
    prompts.push(`Build me a ${tripDays}-day itinerary for ${destination}.`);
  }

  // Always-available fallback prompts
  const fallbacks = [
    "Find me a warm destination under $1,500 in the next 6 weeks.",
    "What's the cheapest day to fly to Europe right now?",
    "Help me plan a 5-day trip under $800.",
    "What are the best value long-haul routes from the US?",
    "How far in advance should I book for the best price?",
    "What travel credit cards are worth getting?",
  ];

  // Merge: context-specific first, pad with fallbacks, cap at 4
  const merged = [...prompts];
  for (const f of fallbacks) {
    if (merged.length >= 4) break;
    if (!merged.includes(f)) merged.push(f);
  }

  return merged.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  const isStream = msg.streaming;

  return (
    <div
      className={`ap-bubble ap-bubble--${isUser ? "user" : "atlas"}${
        isStream ? " ap-bubble--streaming" : ""
      }`}
    >
      {!isUser && (
        <div className="ap-bubble__avatar">
          <Bot size={12} />
        </div>
      )}
      <div className="ap-bubble__text">
        {msg.content}
        {isStream && <span className="ap-cursor" />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function AtlasPanel() {
  const { atlasContext, atlasDestination } = useAtlasContext();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(atlasContext),
    [atlasContext]
  );
  const starterPrompts = useMemo(
    () => buildStarterPrompts(atlasContext),
    [atlasContext]
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Cleanup abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(
    async (text) => {
      const userText = (text || input).trim();
      if (!userText || loading) return;

      setInput("");
      setError(null);

      const userMsg = { id: Date.now(), role: "user", content: userText };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      // Build history for API
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Placeholder streaming message
      const streamId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        { id: streamId, role: "atlas", content: "", streaming: true },
      ]);

      abortRef.current = new AbortController();

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/api/atlas/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages: history, systemPrompt }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error ${res.status}`);
        }

        // ── Streaming response ──
        if (res.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
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
                  /* skip malformed */
                }
              }
            }
          }

          // Mark streaming done
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, streaming: false } : m
            )
          );
        } else {
          // ── Non-streaming fallback ──
          const data = await res.json();
          const content =
            data.content?.[0]?.text ||
            data.message ||
            data.reply ||
            "I couldn't generate a response. Please try again.";

          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, content, streaming: false } : m
            )
          );
        }
      } catch (err) {
        if (err.name === "AbortError") return;

        setError(err.message || "Something went wrong. Try again.");
        // Remove the empty streaming bubble on error
        setMessages((prev) => prev.filter((m) => m.id !== streamId));
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, systemPrompt]
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

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setLoading(false);
  }, []);

  const headerLabel = atlasDestination
    ? `Atlas · ${atlasDestination}`
    : "Atlas";

  const showStarters = messages.length === 0 && !loading;

  return (
    <>
      {/* ── FAB trigger ── */}
      <button
        type="button"
        className={`ap-fab${open ? " ap-fab--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Atlas" : "Open Atlas"}
      >
        {open ? (
          <span className="ap-fab__icon">
            <X size={16} />
          </span>
        ) : (
          <>
            <span className="ap-fab__icon">
              <Sparkles size={15} />
            </span>
            <span className="ap-fab__label">Atlas AI</span>
          </>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="ap-panel" role="dialog" aria-label="Atlas AI chat">
          {/* Header */}
          <div className="ap-header">
            <div className="ap-header__left">
              <div className="ap-header__avatar">
                <Bot size={16} />
              </div>
              <div>
                <div className="ap-header__name">{headerLabel}</div>
                <div className="ap-header__status">
                  <span className="ap-status-dot" />
                  {loading ? "Thinking…" : "Ready"}
                </div>
              </div>
            </div>
            <div className="ap-header__actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="ap-icon-btn"
                  onClick={clearChat}
                  title="Clear chat"
                >
                  ↺
                </button>
              )}
              <button
                type="button"
                className="ap-icon-btn"
                onClick={() => setOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ap-messages">
            {showStarters && (
              <div className="ap-starters">
                <div className="ap-starters__label">Ask Atlas anything</div>
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ap-starter-btn"
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg) => (
              <Bubble key={msg.id} msg={msg} />
            ))}

            {error && (
              <div className="ap-error">
                ⚠️ {error}
                <button
                  type="button"
                  className="ap-error__retry"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="ap-input-wrap">
            <textarea
              ref={inputRef}
              className="ap-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Atlas about your trip…"
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
              {loading ? <span className="ap-send__spinner" /> : "↑"}
            </button>
          </div>

          <div className="ap-footer">
            Atlas uses your current booking context · Powered by Skyrio AI
          </div>
        </div>
      )}
    </>
  );
}
