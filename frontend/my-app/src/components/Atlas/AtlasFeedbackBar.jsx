// src/components/atlas/AtlasFeedbackBar.jsx
// Put under each Atlas reply:
//   <AtlasFeedbackBar conversationId={convoId} messageId={msg.id} atlasReply={msg.text} toolsUsed={msg.toolsUsed} />
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
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ transform: "rotate(180deg)" }}>
    <path
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      d="M7 11v9H4v-9zm0 0 4-8a2 2 0 0 1 2.5 2.4L13 10h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"
    />
  </svg>
);

export default function AtlasFeedbackBar({ conversationId, messageId, atlasReply, toolsUsed = [] }) {
  const [rating, setRating] = useState(null);
  const [showReasons, setShowReasons] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState("");

  async function send(r, extra = {}) {
    try {
      const { ok, data } = await atlasApi("/api/atlas/feedback", {
        method: "POST",
        body: { conversationId, messageId: String(messageId), rating: r, atlasReply, toolsUsed, ...extra },
      });
      if (!ok) throw new Error();
      setThanks(data.xpEarned ? `Thanks! +${data.xpEarned} XP` : "Thanks for the feedback");
    } catch {
      setThanks("Couldn't send. Try again.");
    }
  }

  function up() {
    setRating("up");
    setShowReasons(false);
    send("up");
  }

  function down() {
    setRating("down");
    setShowReasons(true);
    setThanks("");
  }

  function submitDown() {
    setShowReasons(false);
    send("down", { reasons, comment });
  }

  const toggle = (r) => setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  return (
    <div className="afb">
      <div className="afb-row">
        <button className={`afb-btn ${rating === "up" ? "on" : ""}`} onClick={up} aria-label="Helpful">
          <ThumbUp filled={rating === "up"} />
        </button>
        <button className={`afb-btn ${rating === "down" ? "on" : ""}`} onClick={down} aria-label="Not helpful">
          <ThumbDown filled={rating === "down"} />
        </button>
        {thanks && <span className="afb-thanks">{thanks}</span>}
      </div>

      {showReasons && (
        <div className="afb-panel">
          <p className="afb-q">What went wrong? Atlas will use this to do better.</p>
          <div className="afb-chips">
            {REASONS.map(([id, label]) => (
              <button key={id} className={`afb-chip ${reasons.includes(id) ? "on" : ""}`} onClick={() => toggle(id)}>
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="afb-comment"
            rows={2}
            maxLength={500}
            placeholder="Anything else? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="abc-actions">
            <button className="abc-btn abc-primary" onClick={submitDown}>
              Send
            </button>
            <button className="abc-btn abc-ghost" onClick={() => { setShowReasons(false); send("down"); }}>
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
