// src/components/events/EventsResults.jsx
// "Happening while you're there" — drop onto destination, excursion or trip pages.
//
// <EventsResults city="Miami" state="FL" startDate="2026-12-12" endDate="2026-12-16" onPlanTrip={handlePlanTrip} />
// or pass lat/lng (from the hotel or destination) instead of city for better results.

import { useEffect, useState } from "react";
import EventCard from "./EventCard";
import "@/styles/events.css";

const API = import.meta.env.VITE_API_URL || "";

const TABS = [
  { id: "all", label: "All" },
  { id: "sports", label: "Sports" },
  { id: "music", label: "Concerts" },
  { id: "shows", label: "Shows" },
];

export default function EventsResults({
  city,
  state,
  lat,
  lng,
  startDate,
  endDate,
  keyword,
  initialCategory = "all",
  title = "Happening while you're there",
  onPlanTrip,
  // Sync Together: renders "Suggest to group" on each card (group trips only).
  renderSuggest = null,
}) {
  const [category, setCategory] = useState(initialCategory);
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const hasLocation = Boolean(city || (lat != null && lng != null));

  // Reset when the search changes
  useEffect(() => {
    setPage(0);
    setEvents([]);
  }, [city, state, lat, lng, startDate, endDate, keyword, category]);

  useEffect(() => {
    if (!hasLocation) return;
    const ctrl = new AbortController();

    const params = new URLSearchParams({ category, page: String(page) });
    if (lat != null && lng != null) {
      params.set("lat", lat);
      params.set("lng", lng);
    } else {
      params.set("city", city);
      if (state) params.set("state", state);
    }
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (keyword) params.set("keyword", keyword);

    setStatus("loading");
    setError("");

    fetch(`${API}/api/events?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't load events");
        return data;
      })
      .then((data) => {
        setEvents((prev) => (page === 0 ? data.events : [...prev, ...data.events]));
        setTotalPages(data.page?.totalPages || 0);
        setStatus("done");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setStatus("error");
      });

    return () => ctrl.abort();
  }, [hasLocation, city, state, lat, lng, startDate, endDate, keyword, category, page, retry]);

  if (!hasLocation) return null;

  const loadingFirstPage = status === "loading" && page === 0;
  const canLoadMore = status === "done" && page + 1 < totalPages;

  return (
    <section className="sk-events">
      <header className="sk-events-head">
        {/* No title (Events tab) → the chips sit on the left. */}
        {title && <h2 className="sk-events-title">{title}</h2>}
        <div className="sk-events-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={category === t.id}
              className={`sk-events-tab${category === t.id ? " is-active" : ""}`}
              onClick={() => setCategory(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="sk-events-notice" role="note">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <strong>Tickets are sold by Ticketmaster.</strong>
          <span>Event info comes from Ticketmaster. "Buy on Ticketmaster" takes you to their site to pay.</span>
        </div>
      </div>

      {loadingFirstPage && (
        <div className="sk-events-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="sk-event-card sk-event-skeleton" />
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="sk-events-empty">{error} <button type="button" className="sk-events-link" onClick={() => setRetry((r) => r + 1)}>Try again</button></p>
      )}

      {status === "done" && events.length === 0 && (
        <p className="sk-events-empty">No events found for these dates. Try different dates or another tab.</p>
      )}

      {events.length > 0 && (
        <div className="sk-events-grid">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              onPlanTrip={onPlanTrip}
              extra={renderSuggest ? renderSuggest(e) : null}
            />
          ))}
        </div>
      )}

      {canLoadMore && (
        <button type="button" className="sk-event-btn sk-event-btn--ghost sk-events-more" onClick={() => setPage((p) => p + 1)}>
          Show more
        </button>
      )}
      {status === "loading" && page > 0 && <p className="sk-events-empty">Loading…</p>}

    </section>
  );
}
