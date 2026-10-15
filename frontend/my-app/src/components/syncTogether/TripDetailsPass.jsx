// Boarding-pass Trip Details for SyncGroupPage (view mode).
// The edit form stays in SyncGroupPage; this only renders + saves the private budget.
import { useEffect, useState } from "react";
import { Sunrise, Sun, Moon } from "lucide-react";
import "@/styles/trip-details-pass.css";

const CABIN = {
  economy: "Economy",
  premium_economy: "Prem. Economy",
  business: "Business",
  first: "First",
};
const TIME = {
  morning: { l: "Morning", i: <Sunrise size={14} /> },
  afternoon: { l: "Afternoon", i: <Sun size={14} /> },
  night: { l: "Night", i: <Moon size={14} /> },
};

const fmtDate = (d, withYear) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "numeric" } : {}),
      })
    : "—";
const withCommas = (v) =>
  v === null || v === undefined || v === ""
    ? ""
    : String(v)
        .replace(/[^\d]/g, "")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function TripDetailsPass({
  departureAirport, // "JFK"
  departureDisplay, // "JFK — John F. Kennedy Intl" (optional)
  destination, // "Miami" or "MIA"
  startDate,
  endDate,
  cabinClass,
  departureTime, // any | morning | afternoon | night
  travelerCount,
  groupBudget, // comfortable amount everyone can do (number | null)
  budgetSummary, // { comfortable, set, travelers }
  myBudget, // this user's saved number
  onSaveBudget, // (number | null) => Promise
  savingBudget,
  showBudget = true,
  canEdit,
  onEdit,
  isOwner,
}) {
  const [draft, setDraft] = useState(withCommas(myBudget));
  useEffect(() => setDraft(withCommas(myBudget)), [myBudget]);

  const hasDetails = destination || startDate || departureAirport;
  const destIsCode = /^[A-Z]{3}$/.test(destination || "");
  const originCity =
    (departureDisplay || "").split("—")[1]?.trim() || "Departing";
  const nights =
    startDate && endDate
      ? Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
      : null;
  const draftNum = Number(String(draft).replace(/[^\d]/g, "")) || null;
  const unchanged = (draftNum || null) === (myBudget || null);
  const time = TIME[departureTime];

  return (
    <section className="tdp" aria-label="Trip details">
      <div className="tdp-main">
        <header className="tdp-head">
          <span className="tdp-label">Trip Details · Boarding Pass</span>
          {canEdit && (
            <button type="button" className="tdp-edit" onClick={onEdit}>
              Edit
            </button>
          )}
        </header>

        {!hasDetails ? (
          <p className="tdp-empty">
            {isOwner
              ? "No details yet. Tap Edit to set where and when."
              : "The organizer hasn't set the trip details yet. Share ideas in the group chat."}
          </p>
        ) : (
          <>
            <div className="tdp-route">
              <div className="tdp-city">
                <span className="tdp-code">{departureAirport || "—"}</span>
                <span className="tdp-name">{originCity}</span>
              </div>
              <div className="tdp-path" aria-hidden="true">
                <span className="tdp-dash" />
                <svg viewBox="0 0 24 24" className="tdp-plane">
                  <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
                </svg>
                <span className="tdp-dash" />
              </div>
              <div className="tdp-city tdp-city--to">
                <span
                  className={`tdp-code ${destIsCode ? "" : "tdp-code--name"}`}
                >
                  {destination || "—"}
                </span>
                <span className="tdp-name">Destination</span>
              </div>
            </div>

            <dl className="tdp-grid">
              <div>
                <dt>Depart</dt>
                <dd>{fmtDate(startDate)}</dd>
              </div>
              <div>
                <dt>Return</dt>
                <dd>{fmtDate(endDate, true)}</dd>
              </div>
              {nights !== null && (
                <div>
                  <dt>Nights</dt>
                  <dd>{nights}</dd>
                </div>
              )}
              <div>
                <dt>Class</dt>
                <dd>{CABIN[cabinClass] || "Economy"}</dd>
              </div>
              {time && (
                <div>
                  <dt>Time</dt>
                  <dd className="tdp-icon-val">
                    {time.i} {time.l}
                  </dd>
                </div>
              )}
              {travelerCount ? (
                <div>
                  <dt>Travelers</dt>
                  <dd>{travelerCount}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </div>

      {showBudget && (
        <form
          className="tdp-stub"
          onSubmit={(e) => {
            e.preventDefault();
            if (!unchanged) onSaveBudget(draftNum);
          }}
        >
          <span className="tdp-label">Your budget · private</span>
          <div className="tdp-budget">
            <span className="tdp-currency">$</span>
            <input
              id="sync-my-budget"
              inputMode="numeric"
              placeholder="1,500"
              value={draft}
              onChange={(e) => setDraft(withCommas(e.target.value))}
              aria-label="Your budget per person"
            />
            <span className="tdp-per">/person</span>
          </div>
          <div className="tdp-actions">
            <button
              type="submit"
              className="tdp-save"
              disabled={savingBudget || unchanged}
            >
              {savingBudget ? "Saving…" : "Save"}
            </button>
            {myBudget ? (
              <button
                type="button"
                className="tdp-clear"
                disabled={savingBudget}
                onClick={() => onSaveBudget(null)}
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="tdp-note">
            {groupBudget
              ? `Group comfort level: about $${Number(
                  groupBudget
                ).toLocaleString("en-US")}/person (${
                  budgetSummary?.set ?? 0
                } of ${
                  budgetSummary?.travelers ?? travelerCount
                } set one). Nobody sees anyone else's number.`
              : "Only you see this. Atlas plans to what everyone's comfortable with."}
          </p>
        </form>
      )}
    </section>
  );
}
