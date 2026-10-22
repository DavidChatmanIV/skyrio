import React, { useState, useEffect, useMemo } from "react";
import { Avatar, message as antdMessage } from "antd";
import {
  Users,
  CalendarDays,
  Sparkles,
  Ticket,
  Lock,
  ThumbsUp,
  Wallet,
  Star,
  ChevronRight,
  MapPin,
  Calendar,
  Trash2,
  Plane,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "@/styles/SyncTogether.css";
import SyncBoardingPass from "./SyncBoardingPass";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
// The backend already enforces owner-only deletion (403 otherwise); this
// just hides the delete button from everyone else.
function getCurrentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user")).id;
  } catch {
    return null;
  }
}

// "Dallas/Fort Worth International Airport" → "Dallas/Fort Worth"
function placeName(s) {
  return String(s || "")
    .replace(/\s+(International\s+)?Airport\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function tripTitle(trip) {
  if (trip?.title) return placeName(trip.title);
  return trip?.destination
    ? `${placeName(trip.destination)} trip`
    : "Untitled trip";
}

/* ── Copy — only what Sync Together does today ─────────────────────── */
// Same four stages as the progress bar on a trip page.
const HOW_IT_WORKS = [
  {
    Icon: Users,
    title: "Invite",
    desc: "Add friends by name or email. They tap “I'm in.”",
  },
  {
    Icon: CalendarDays,
    title: "Details",
    desc: "Pick the place and dates. Everyone sets a private budget.",
  },
  {
    Icon: Sparkles,
    title: "Plan & vote",
    desc: "Atlas suggests a plan. The group votes on flights and hotels.",
  },
  {
    Icon: Ticket,
    title: "Book",
    desc: "Each person books and pays for their own part.",
  },
];

const FEATURES = [
  {
    Icon: Lock,
    title: "Budgets stay private",
    body: "Everyone sets their own budget and only they can see it. Atlas plans around what the whole group is comfortable spending.",
  },
  {
    Icon: ThumbsUp,
    title: "Suggest and vote",
    body: "Anyone can suggest a flight or hotel to the group. Vote on the shortlist so nobody has to decide alone.",
  },
  {
    Icon: Sparkles,
    title: "A plan for the whole group",
    body: "Atlas pulls together flights, places to stay, a day-by-day itinerary and the weather for your dates.",
  },
  {
    Icon: Wallet,
    title: "Everyone pays their own way",
    body: "Each traveler books and pays for their own flight and room, including shared rooms. Nobody has to front the whole trip.",
  },
];

const TRUST = [
  { Icon: Wallet, text: "You only pay for your part" },
  { Icon: Lock, text: "Your budget is private" },
  { Icon: Star, text: "Booking earns Passport XP" },
];

const STATUS = {
  draft: { label: "Draft", tone: "muted" },
  inviting: { label: "Inviting", tone: "orange" },
  planning: { label: "Planning", tone: "orange" },
  reviewing: { label: "Voting", tone: "purple" },
  confirmed: { label: "Ready to book", tone: "green" },
  payment_pending: { label: "Booking", tone: "orange" },
  booked: { label: "Booked", tone: "green" },
  completed: { label: "Completed", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "red" },
};
const ACTIVE = new Set([
  "draft",
  "inviting",
  "planning",
  "reviewing",
  "confirmed",
  "payment_pending",
]);
const PREVIEW_COUNT = 3;

export default function SyncTogether() {
  const navigate = useNavigate();
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const myName = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user"));
      return u?.name || u?.username || "";
    } catch {
      return "";
    }
  }, []);

  // Trip details collected before invites go out, so the invite says
  // where the trip is instead of "Untitled Trip".
  const [destination, setDestination] = useState("");
  const [dateRange, setDateRange] = useState(null); // [dayjs, dayjs] | null

  const [travelers, setTravelers] = useState([]);
  const [creating, setCreating] = useState(false);

  const [myTrips, setMyTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState(false);
  const [tripCount, setTripCount] = useState(0);

  const [filter, setFilter] = useState("active");
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/sync-together/my-trips`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setMyTrips(data.groups || []);
        else setTripsError(true);
      })
      .catch(() => setTripsError(true))
      .finally(() => setTripsLoading(false));

    fetch(`${API_BASE}/sync-together/count`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTripCount(data.count || 0);
      })
      .catch(() => {});
  }, []);

  const addTraveler = (user) => {
    const id = user._id || user.id || null;
    const email = user.email || null;
    const dup = travelers.some(
      (t) => (id && t.id === id) || (!id && email && t.email === email)
    );
    if (dup) {
      antdMessage.warning("They're already on the pass");
      return;
    }
    setTravelers((prev) => [
      ...prev,
      {
        id,
        username: user.username || null,
        name: user.name || user.username || email,
        email,
        avatar: user.avatar || null,
      },
    ]);
  };

  const removeTraveler = (traveler) =>
    setTravelers((prev) =>
      prev.filter(
        (t) =>
          (t.id && t.id !== traveler.id) ||
          (!t.id && t.email !== traveler.email)
      )
    );

  const handleStartPlanning = async () => {
    if (travelers.length === 0) {
      antdMessage.warning("Add at least one traveler to get started");
      return;
    }
    setCreating(true);
    try {
      const members = travelers.map((t) => ({
        userId: t.id || undefined,
        email: t.email || undefined,
        name: t.name || undefined,
      }));
      const dest = destination.trim();
      const body = {
        members,
        // "Dallas/Fort Worth trip", not "Dallas/Fort Worth International Airport Trip"
        title: dest ? `${placeName(dest)} trip` : undefined,
        destination: dest || undefined,
        dateRangeStart: dateRange?.[0] ? dateRange[0].toISOString() : undefined,
        dateRangeEnd: dateRange?.[1] ? dateRange[1].toISOString() : undefined,
      };
      const res = await fetch(`${API_BASE}/sync-together`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        antdMessage.success("Trip created — invites are on the way");
        navigate(`/sync-together/${data.group.id}`);
      } else {
        antdMessage.error(data.error || "Something went wrong");
      }
    } catch {
      antdMessage.error("Couldn't create the trip. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const deleteTrip = async (tripId) => {
    setConfirmDeleteId(null);
    const before = myTrips;
    setMyTrips((prev) => prev.filter((t) => t._id !== tripId));
    try {
      const res = await fetch(`${API_BASE}/sync-together/${tripId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Couldn't delete the trip");
      antdMessage.success("Trip deleted");
    } catch (err) {
      setMyTrips(before);
      antdMessage.error(err.message || "Couldn't delete the trip");
    }
  };

  /* ── Trip list filter ── */
  const counts = useMemo(() => {
    const c = { active: 0, booked: 0, all: myTrips.length };
    myTrips.forEach((t) => {
      if (ACTIVE.has(t.status)) c.active += 1;
      else if (t.status === "booked" || t.status === "completed") c.booked += 1;
    });
    return c;
  }, [myTrips]);
  const filters = [
    { key: "active", label: "In progress" },
    { key: "booked", label: "Booked" },
    { key: "all", label: "All" },
  ].filter((f) => f.key === "all" || counts[f.key] > 0);
  const activeFilter = filters.some((f) => f.key === filter)
    ? filter
    : filters[0]?.key || "all";
  const shownTrips = myTrips.filter((t) =>
    activeFilter === "active"
      ? ACTIVE.has(t.status)
      : activeFilter === "booked"
      ? t.status === "booked" || t.status === "completed"
      : true
  );
  const visibleTrips = showAll
    ? shownTrips
    : shownTrips.slice(0, PREVIEW_COUNT);
  const hiddenCount = shownTrips.length - visibleTrips.length;

  return (
    <section className="sk-sync-section sk-sync-landing">
      {/* ── Hero ── */}
      <header className="sk-sync-header">
        <div className="sk-sync-badge">
          <Users size={13} aria-hidden="true" />
          Sync Together · Group trips
        </div>
        <h1 className="sk-sync-title">
          Tell us who&apos;s coming.
          <br />
          <span className="sk-sync-highlight">Plan it together.</span>
        </h1>
        <p className="sk-sync-sub">
          Invite your crew, vote on flights and hotels, and keep the whole plan
          in one place. Each person books and pays for their own part, so nobody
          has to front the whole trip.
        </p>
        <ul className="sk-sync-trust">
          {TRUST.map(({ Icon, text }) => (
            <li key={text}>
              <Icon size={14} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </header>

      {/* ── How it works (same stages as a trip's progress bar) ── */}
      <ol className="sk-sync-flow" aria-label="How Sync Together works">
        {HOW_IT_WORKS.map(({ Icon, title, desc }, i) => (
          <li key={title} className="sk-sync-flowStep">
            <span className="sk-sync-flowIcon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="sk-sync-flowNum">Step {i + 1}</span>
            <span className="sk-sync-flowTitle">{title}</span>
            <span className="sk-sync-flowDesc">{desc}</span>
          </li>
        ))}
      </ol>

      {/* Boarding pass first, then your trips */}
      {/* ── Start a trip: group boarding pass ── */}
      <div id="sk-sync-start">
        <SyncBoardingPass
          destination={destination}
          setDestination={setDestination}
          dateRange={dateRange}
          setDateRange={setDateRange}
          travelers={travelers}
          onAddTraveler={addTraveler}
          onRemoveTraveler={removeTraveler}
          onSubmit={handleStartPlanning}
          creating={creating}
          myName={myName}
        />
      </div>

      {/* ── My group trips ── */}
      <div className="sk-sync-trips">
        <div className="sk-sync-tripsHead">
          <h2 className="sk-sync-tripsTitle">
            <Plane size={18} aria-hidden="true" />
            Your group trips
          </h2>
          {filters.length > 1 && (
            <div
              className="sk-sync-filter"
              role="tablist"
              aria-label="Filter trips"
            >
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === f.key}
                  className={`sk-sync-filterBtn${
                    activeFilter === f.key ? " is-on" : ""
                  }`}
                  onClick={() => {
                    setFilter(f.key);
                    setShowAll(false);
                  }}
                >
                  {f.label} <span>{counts[f.key]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {tripsLoading ? (
          <div className="sk-sync-tripsList">
            <div className="sk-sync-skel" />
            <div className="sk-sync-skel" />
          </div>
        ) : tripsError ? (
          <div className="sk-sync-empty">
            <div className="sk-sync-emptyTitle">
              We couldn&apos;t load your trips
            </div>
            <div className="sk-sync-emptySub">
              Check your connection and refresh the page.
            </div>
          </div>
        ) : myTrips.length === 0 ? (
          <div className="sk-sync-empty">
            <Users size={28} aria-hidden="true" />
            <div className="sk-sync-emptyTitle">No group trips yet</div>
            <div className="sk-sync-emptySub">
              Fill in the boarding pass above to start your first one.
            </div>
          </div>
        ) : (
          <>
            <ul className="sk-sync-tripsList">
              {visibleTrips.map((trip) => {
                const st = STATUS[trip.status] || {
                  label: trip.status,
                  tone: "muted",
                };
                const memberCount = (trip.members?.length || 0) + 1;
                const isOwner =
                  currentUserId &&
                  String(trip.owner?._id || trip.owner) ===
                    String(currentUserId);
                const title = tripTitle(trip);
                const place = placeName(trip.destination);
                const showPlace =
                  place && !title.toLowerCase().includes(place.toLowerCase());
                const confirming = confirmDeleteId === trip._id;
                return (
                  <li key={trip._id} className="sk-sync-trip">
                    <button
                      type="button"
                      className="sk-sync-tripMain"
                      onClick={() => navigate(`/sync-together/${trip._id}`)}
                      aria-label={`Open ${title}`}
                    >
                      <span className="sk-sync-tripTop">
                        <span className="sk-sync-tripName">{title}</span>
                        <span className={`sk-sync-pill is-${st.tone}`}>
                          {st.label}
                        </span>
                      </span>
                      <span className="sk-sync-tripMeta">
                        {showPlace && (
                          <span>
                            <MapPin size={13} aria-hidden="true" />
                            {place}
                          </span>
                        )}
                        {trip.dateRangeStart && trip.dateRangeEnd && (
                          <span>
                            <Calendar size={13} aria-hidden="true" />
                            {dayjs(trip.dateRangeStart).format("MMM D")} –{" "}
                            {dayjs(trip.dateRangeEnd).format("MMM D")}
                          </span>
                        )}
                        <span>
                          <Users size={13} aria-hidden="true" />
                          {memberCount} traveler{memberCount !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <span className="sk-sync-avatars" aria-hidden="true">
                        {trip.owner && (
                          <Avatar
                            size={26}
                            src={
                              trip.owner.avatar !== "/default-avatar.png"
                                ? trip.owner.avatar
                                : undefined
                            }
                            className="sk-sync-av is-owner"
                          >
                            {(trip.owner.name ||
                              trip.owner.username ||
                              "?")[0].toUpperCase()}
                          </Avatar>
                        )}
                        {trip.members?.slice(0, 4).map((m, idx) => (
                          <Avatar
                            key={m._id || idx}
                            size={26}
                            src={
                              m.user?.avatar !== "/default-avatar.png"
                                ? m.user?.avatar
                                : undefined
                            }
                            className="sk-sync-av"
                          >
                            {(m.name ||
                              m.user?.name ||
                              m.email ||
                              "?")[0].toUpperCase()}
                          </Avatar>
                        ))}
                        {(trip.members?.length || 0) > 4 && (
                          <span className="sk-sync-av is-more">
                            +{trip.members.length - 4}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="sk-sync-tripStub">
                      {confirming ? (
                        <div className="sk-sync-confirm" role="alertdialog">
                          <span>Delete this trip?</span>
                          <button
                            type="button"
                            className="sk-sync-confirmBtn is-danger"
                            onClick={() => deleteTrip(trip._id)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="sk-sync-confirmBtn"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="sk-sync-open" aria-hidden="true">
                            Open <ChevronRight size={15} />
                          </span>
                          {isOwner && (
                            <button
                              type="button"
                              className="sk-sync-del"
                              onClick={() => setConfirmDeleteId(trip._id)}
                              aria-label={`Delete ${title}`}
                              title="Delete trip"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {shownTrips.length > PREVIEW_COUNT && (
              <button
                type="button"
                className="sk-sync-more"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
              >
                {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
                <ChevronDown
                  size={15}
                  style={showAll ? { transform: "rotate(180deg)" } : undefined}
                />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── What you get ── */}
      <div>
        <h2 className="sk-sync-sectionLabel">Why plan with Sync Together</h2>
        <div className="sk-sync-grid">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="sk-sync-card">
              <div className="sk-sync-card-icon">
                <Icon size={21} aria-hidden="true" />
              </div>
              <div className="sk-sync-card-title">{title}</div>
              <div className="sk-sync-card-body">{body}</div>
            </div>
          ))}
        </div>
        {tripCount > 0 && (
          <p className="sk-sync-count">
            {tripCount.toLocaleString()} group trip{tripCount !== 1 ? "s" : ""}{" "}
            planned on Skyrio so far
          </p>
        )}
      </div>
    </section>
  );
}
