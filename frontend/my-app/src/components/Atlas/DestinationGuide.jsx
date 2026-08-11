import { useState } from "react";
import { useDestinationGuide } from "./useDestinationGuide";

export default function DestinationGuide() {
  const [input, setInput] = useState("");
  const { guide, isLoading, error, fetchGuide, clearGuide } =
    useDestinationGuide();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    fetchGuide(input);
  };

  const handleNewSearch = () => {
    setInput("");
    clearGuide();
  };

  return (
    <div>
      {!guide && (
        <>
          <form className="ap-guide-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="ap-guide-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Lisbon, Kyoto, Tulum…"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="ap-guide-submit"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? "Asking…" : "Get guide"}
            </button>
          </form>
          <p className="ap-guide-hint">
            Where are you dreaming of going? Atlas will pull together the
            highlights.
          </p>
        </>
      )}

      {error && <div className="ap-guide-error">⚠️ {error}</div>}

      {isLoading && (
        <div className="ap-guide-skeleton">
          <div className="ap-guide-skeleton__line" style={{ width: "70%" }} />
          <div className="ap-guide-skeleton__line" style={{ width: "100%" }} />
          <div className="ap-guide-skeleton__line" style={{ width: "85%" }} />
        </div>
      )}

      {guide && !isLoading && (
        <div className="ap-guide-card">
          <div className="ap-guide-card__head">
            <div className="ap-guide-card__title">{guide.destination}</div>
            <button
              type="button"
              className="ap-guide-card__reset"
              onClick={handleNewSearch}
            >
              New search
            </button>
          </div>

          <p className="ap-guide-card__summary">{guide.summary}</p>

          <div className="ap-guide-section">
            <div className="ap-guide-section__label">Best time to visit</div>
            <div className="ap-guide-section__body">{guide.bestTime}</div>
          </div>

          <div className="ap-guide-section">
            <div className="ap-guide-section__label">Must-do</div>
            <div className="ap-guide-section__list">
              {guide.activities?.map((activity, i) => (
                <div key={i} className="ap-guide-section__list-item">
                  <span>—</span>
                  {activity}
                </div>
              ))}
            </div>
          </div>

          <div className="ap-guide-section">
            <div className="ap-guide-section__label">Local tip</div>
            <div className="ap-guide-section__body">{guide.localTip}</div>
          </div>

          <div className="ap-guide-section">
            <div className="ap-guide-section__label">Eat this</div>
            <div className="ap-guide-section__body">{guide.foodPick}</div>
          </div>
        </div>
      )}
    </div>
  );
}
