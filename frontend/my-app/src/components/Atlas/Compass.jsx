// Atlas "Compass" tab: quick highlights for any city — no booking needed.
// From a guide you can jump straight into a search, or keep chatting with
// Atlas about that place.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Lightbulb,
  MapPin,
  MessageSquare,
  Plane,
  RotateCcw,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useDestinationGuide } from "./useDestinationGuide";
import { useAtlasContext } from "./AtlasContext";

// A few ideas to tap — just shortcuts, nothing is promised about them.
const IDEAS = ["Lisbon", "Tokyo", "Mexico City", "Reykjavik", "Cape Town"];

const CSS = `
.cp-ideas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.cp-idea { min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.82); cursor: pointer;
  font: 600 12.5px "DM Sans", sans-serif; display: inline-flex; align-items: center; gap: 5px; }
.cp-idea:hover:not(:disabled) { border-color: rgba(255,138,42,0.55); color: #fff; }
.cp-idea svg { color: #ffb347; }
.cp-head-icon { display: inline-flex; align-items: center; gap: 6px; }
.cp-head-icon svg { color: #ffb347; flex-shrink: 0; }
.cp-label { display: flex; align-items: center; gap: 6px; }
.cp-label svg { flex-shrink: 0; }
.cp-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.cp-act { min-height: 38px; padding: 0 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid rgba(255,255,255,0.18); background: transparent; color: #fff; cursor: pointer;
  font: 700 12.5px "DM Sans", sans-serif; }
.cp-act:hover { border-color: rgba(255,138,42,0.6); }
.cp-act.is-primary { border: 0; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1b1024; }
.cp-ai { margin-top: 12px; font-size: 11px; color: rgba(255,255,255,0.5); font-family: "DM Sans", sans-serif; }
.ap-guide-error { display: flex; align-items: flex-start; gap: 8px; }
.ap-guide-error svg { flex-shrink: 0; margin-top: 2px; }
.ap-guide-wrap :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
`;

export default function Compass() {
  const navigate = useNavigate();
  const { sendAtlasMessage } = useAtlasContext();
  const [input, setInput] = useState("");
  const { guide, isLoading, error, fetchGuide, clearGuide } =
    useDestinationGuide();

  const lookUp = (place) => {
    const q = String(place || "").trim();
    if (!q) return;
    setInput(q);
    fetchGuide(q);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    lookUp(input);
  };

  const handleNewSearch = () => {
    setInput("");
    clearGuide();
  };

  const searchTrips = () => {
    const place = guide?.destination || input;
    const q = new URLSearchParams({ to: place, toName: place });
    navigate(`/booking?${q}`);
  };

  // Switches Atlas to Chat and asks about this place.
  const askAtlas = () => {
    const place = guide?.destination || input;
    sendAtlasMessage(
      `I'm thinking about a trip to ${place}. What should I know before I book?`
    );
  };

  return (
    <div>
      <style>{CSS}</style>

      {!guide && (
        <>
          <form className="ap-guide-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="ap-guide-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Lisbon, Kyoto, Tulum…"
              aria-label="City or place"
              maxLength={80}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="ap-guide-submit"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? "Looking…" : "Get guide"}
            </button>
          </form>
          <p className="ap-guide-hint">
            Best time to go, what to do, a local tip and what to eat.
          </p>
          {!isLoading && (
            <div className="cp-ideas" aria-label="Ideas">
              {IDEAS.map((place) => (
                <button
                  key={place}
                  type="button"
                  className="cp-idea"
                  onClick={() => lookUp(place)}
                >
                  <MapPin size={12} aria-hidden="true" />
                  {place}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="ap-guide-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="ap-guide-skeleton" aria-label="Loading guide">
          <div className="ap-guide-skeleton__line" style={{ width: "70%" }} />
          <div className="ap-guide-skeleton__line" style={{ width: "100%" }} />
          <div className="ap-guide-skeleton__line" style={{ width: "85%" }} />
        </div>
      )}

      {guide && !isLoading && (
        <div className="ap-guide-card">
          <div className="ap-guide-card__head">
            <div className="ap-guide-card__title cp-head-icon">
              <MapPin size={16} aria-hidden="true" />
              {guide.destination}
            </div>
            <button
              type="button"
              className="ap-guide-card__reset cp-head-icon"
              onClick={handleNewSearch}
            >
              <RotateCcw size={12} aria-hidden="true" /> New search
            </button>
          </div>

          {guide.summary && (
            <p className="ap-guide-card__summary">{guide.summary}</p>
          )}

          {guide.bestTime && (
            <div className="ap-guide-section">
              <div className="ap-guide-section__label cp-label">
                <CalendarDays size={12} aria-hidden="true" /> Best time to go
              </div>
              <div className="ap-guide-section__body">{guide.bestTime}</div>
            </div>
          )}

          {Array.isArray(guide.activities) && guide.activities.length > 0 && (
            <div className="ap-guide-section">
              <div className="ap-guide-section__label cp-label">
                <Sparkles size={12} aria-hidden="true" /> Must-do
              </div>
              <div className="ap-guide-section__list">
                {guide.activities.map((activity, i) => (
                  <div key={i} className="ap-guide-section__list-item">
                    <span aria-hidden="true">—</span>
                    {activity}
                  </div>
                ))}
              </div>
            </div>
          )}

          {guide.localTip && (
            <div className="ap-guide-section">
              <div className="ap-guide-section__label cp-label">
                <Lightbulb size={12} aria-hidden="true" /> Local tip
              </div>
              <div className="ap-guide-section__body">{guide.localTip}</div>
            </div>
          )}

          {guide.foodPick && (
            <div className="ap-guide-section">
              <div className="ap-guide-section__label cp-label">
                <Utensils size={12} aria-hidden="true" /> Eat this
              </div>
              <div className="ap-guide-section__body">{guide.foodPick}</div>
            </div>
          )}

          <div className="cp-acts">
            <button
              type="button"
              className="cp-act is-primary"
              onClick={searchTrips}
            >
              <Plane size={14} aria-hidden="true" /> Search flights there
            </button>
            <button type="button" className="cp-act" onClick={askAtlas}>
              <MessageSquare size={14} aria-hidden="true" /> Ask Atlas about it
            </button>
          </div>
          <p className="cp-ai">
            Written by Atlas AI. Check opening times, prices and entry rules
            before you go.
          </p>
        </div>
      )}
    </div>
  );
}
