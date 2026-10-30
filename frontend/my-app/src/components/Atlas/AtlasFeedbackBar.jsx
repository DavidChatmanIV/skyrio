// src/components/Atlas/AtlasFeedbackBar.jsx
// Put under each Atlas reply:
//   <AtlasFeedbackBar conversationId={convoId} messageId={msg.id} atlasReply={msg.content} toolsUsed={msg.toolsUsed} />
//
// Posts to POST /api/atlas/feedback (routes/atlas/atlas.routes.js).
// A thumb only stays highlighted once the server has saved it — if the
// save fails, it goes back to how it was and the error is shown.
import { useState } from "react";
import { atlasApi } from "./atlasApi";
import "@/styles/atlas-booking-card.css";

const REASONS = [
  ["wrong_info", "Wrong info"],
  ["didnt_understand", "Didn't understand me"],
  ["bad_suggestions", "Bad suggestions"],
  ["too_long", "Too long"],
  ["too_many_questions", "Too many questions"],
  ["too_slow", "Too slow"],
  ["other", "Other"],
];

const ThumbUp = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      d="M7 11v9H4v-9zm0 0 4-8a2 2 0 0 1 2.5 2.4L13 10h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"
    />
  </svg>
);
const ThumbDown = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
    style={{ transform: "rotate(180deg)" }}
  >
    <path
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      d="M7 11v9H4v-9zm0 0 4-8a2 2 0 0 1 2.5 2.4L13 10h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"
    />
  </svg>
);

export default function AtlasFeedbackBar({
  conversationId,
  messageId,
  atlasReply,
  toolsUsed = [],
}) {
  // `rating` is only what the server actually saved.
  const [rating, setRating] = useState(null);
  const [showReasons, setShowReasons] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState("");
  const [sending, setSending] = useState(false);

  async function send(r, extra = {}) {
    if (sending) return;
    const before = rating;
    setRating(r);
    setSending(true);
    setThanks("");
    try {
      const { ok, data } = await atlasApi("/api/atlas/feedback", {
        method: "POST",
        body: {
          conversationId,
          messageId: String(messageId),
          rating: r,
          atlasReply,
          toolsUsed,
          ...extra,
        },
      });
      if (!ok) throw new Error(data?.error || "");
      setThanks(
        data?.xpEarned
          ? `Thanks! +${data.xpEarned} XP`
          : "Thanks for the feedback"
      );
    } catch (err) {
      setRating(before); // don't show a vote that didn't save
      setThanks(err?.message || "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  const up = () => {
    setShowReasons(false);
    send("up");
  };
  const down = () => {
    setShowReasons(true);
    setThanks("");
  };
  const submitDown = () => {
    setShowReasons(false);
    send("down", { reasons, comment });
  };
  const skipDown = () => {
    setShowReasons(false);
    send("down");
  };
  const toggle = (r) =>
    setReasons((cur) =>
      cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
    );

  const downOn = rating === "down" || showReasons;

  return (
    <div className="afb">
      <div className="afb-row">
        <button
          type="button"
          className={`afb-btn ${rating === "up" ? "on" : ""}`}
          onClick={up}
          disabled={sending}
          aria-label="Helpful"
          aria-pressed={rating === "up"}
        >
          <ThumbUp filled={rating === "up"} />
        </button>
        <button
          type="button"
          className={`afb-btn ${downOn ? "on" : ""}`}
          onClick={down}
          disabled={sending}
          aria-label="Not helpful"
          aria-pressed={rating === "down"}
        >
          <ThumbDown filled={downOn} />
        </button>
        {thanks && (
          <span className="afb-thanks" role="status">
            {thanks}
          </span>
        )}
      </div>

      {showReasons && (
        <div className="afb-panel">
          <p className="afb-q">
            What went wrong? Atlas will use this to do better.
          </p>
          <div className="afb-chips">
            {REASONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`afb-chip ${reasons.includes(id) ? "on" : ""}`}
                onClick={() => toggle(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="afb-comment"
            rows={2}
            maxLength={500}
            placeholder="Anything else? (optional — a sentence or two can earn XP)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="abc-actions">
            <button
              type="button"
              className="abc-btn abc-primary"
              onClick={submitDown}
              disabled={sending}
            >
              Send
            </button>
            <button
              type="button"
              className="abc-btn abc-ghost"
              onClick={skipDown}
              disabled={sending}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
