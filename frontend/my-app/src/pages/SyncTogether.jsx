import React, { useState, useEffect, useMemo } from "react";
import { Avatar, message as antdMessage } from "antd";
import {
  Brain,
  SplitSquareHorizontal,
  Hotel,
  Zap,
  Plane,
  Users,
  MapPin,
  Calendar,
  ArrowRight,
  Trash2,
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
// Same pattern already used in SyncGroupPage.jsx — needed here so the
// delete button can be hidden for non-owners. The backend already
// enforces owner-only deletion (403 otherwise), but showing the trash
// icon to everyone just sets non-owners up for a confusing error.
function getCurrentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user")).id;
  } catch {
    return null;
  }
}

const FEATURES = [
  {
    icon: <Brain size={22} />,
    title: "Smart Date Matching",
    body: "Tell us when everyone's free. Atlas finds the overlap and picks the best window automatically.",
  },
  {
    icon: <SplitSquareHorizontal size={22} />,
    title: "Fair Budget Split",
    body: "Different budgets, same trip. Everyone stays comfortable — no awkward money conversations.",
  },
  {
    icon: <Hotel size={22} />,
    title: "Group Stay Finder",
    body: "Atlas finds hotels and rentals that fit your whole group — price, location, and vibe.",
  },
  {
    icon: <Zap size={22} />,
    title: "XP for Everyone",
    body: "Every traveler earns Passport XP on group trips. Plan together, level up together.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: <Users size={20} />,
    title: "Add Your Crew",
    desc: "Search and add friends by name or email",
  },
  {
    icon: <MapPin size={20} />,
    title: "Set Details",
    desc: "Destination, dates, budget, cabin class",
  },
  {
    icon: <Brain size={20} />,
    title: "Atlas Plans",
    desc: "AI finds flights, hotels, and builds your itinerary",
  },
  {
    icon: <Plane size={20} />,
    title: "Book Together",
    desc: "Everyone reviews, approves, and you're set",
  },
];

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

  // ── Trip details (new) ──────────────────────────────────────
  // Collected BEFORE invites are sent, so the invite email can
  // actually say what kind of trip this is instead of showing
  // "Untitled Trip" with no destination.
  const [destination, setDestination] = useState("");
  const [dateRange, setDateRange] = useState(null); // [dayjs, dayjs] | null

  const [travelers, setTravelers] = useState([]);
  const [creating, setCreating] = useState(false);

  const [myTrips, setMyTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripCount, setTripCount] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/sync-together/my-trips`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setMyTrips(data.groups || []);
      })
      .catch(() => {})
      .finally(() => setTripsLoading(false));

    fetch(`${API_BASE}/sync-together/count`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTripCount(data.count || 0);
      })
      .catch(() => {});
  }, []);

  // From the boarding pass: a Skyrio user from search, or a typed email.
  const addTraveler = (user) => {
    const id = user._id || user.id || null;
    const email = user.email || null;
    const dup = travelers.some(
      (t) => (id && t.id === id) || (!id && email && t.email === email)
    );
    if (dup) {
      antdMessage.warning("Already on the pass");
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
      const body = {
        members,
        title: destination.trim() ? `${destination.trim()} Trip` : undefined,
        destination: destination.trim() || undefined,
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
        antdMessage.success("Group created!");
        navigate(`/sync-together/${data.group.id}`);
      } else {
        antdMessage.error(data.error || "Something went wrong");
      }
    } catch (err) {
      antdMessage.error("Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  const deleteTrip = async (tripId, tripTitle, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete "${tripTitle || "Untitled Trip"}"? This cannot be undone.`
      )
    )
      return;
    try {
      const res = await fetch(`${API_BASE}/sync-together/${tripId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setMyTrips((prev) => prev.filter((t) => t._id !== tripId));
        antdMessage.success("Trip deleted");
      } else {
        antdMessage.error(data.error || "Failed to delete");
      }
    } catch (err) {
      antdMessage.error("Failed to delete trip");
    }
  };

  const statusColors = {
    draft: "rgba(255,255,255,0.45)",
    inviting: "#ff8a2a",
    planning: "#ff8a2a",
    reviewing: "#1890ff",
    confirmed: "#52c41a",
    booked: "#52c41a",
    completed: "rgba(255,255,255,0.45)",
    cancelled: "#ff4d4f",
  };
  const statusLabels = {
    draft: "Draft",
    inviting: "Inviting",
    planning: "Planning",
    reviewing: "Reviewing",
    confirmed: "Confirmed",
    booked: "Booked",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <section className="sk-sync-section">
      {/* ── Header ── */}
      <div className="sk-sync-header">
        <div className="sk-sync-badge">
          <Plane size={12} style={{ marginRight: 6 }} />
          Group Travel
        </div>
        <h2 className="sk-sync-title">
          Tell us who&apos;s coming.
          <br />
          <span className="sk-sync-highlight">We&apos;ll handle the rest.</span>
        </h2>
        <p className="sk-sync-sub">
          Add your travel crew, set everyone&apos;s budget and Atlas builds a
          plan that works for the whole group flights, hotels and splits
          included.
        </p>
        <div className="sk-sync-trust">
          <span className="sk-sync-trust-dot">·</span>
          <span>Free to use</span>
          <span className="sk-sync-trust-dot">·</span>
          <span>Everyone earns XP</span>
        </div>
      </div>

      {/* ── How it works ── */}
      <div
        style={{
          display: "flex",
          gap: 0,
          justifyContent: "center",
          flexWrap: "wrap",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        {HOW_IT_WORKS.map((s, i) => (
          <div key={s.title} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ textAlign: "center", width: 140, padding: "0 8px" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  margin: "0 auto 10px",
                  background: "rgba(255,138,42,0.12)",
                  border: "1px solid rgba(255,138,42,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ff8a2a",
                }}
              >
                {s.icon}
              </div>
              <div
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                {s.desc}
              </div>
            </div>
            {i < 3 && (
              <div
                style={{
                  color: "rgba(255,138,42,0.3)",
                  fontSize: 18,
                  margin: "0 2px",
                  paddingBottom: 30,
                }}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Social proof ── */}
      {tripCount > 0 && (
        <div style={{ textAlign: "center" }}>
          <span
            style={{
              background: "rgba(255,138,42,0.1)",
              border: "1px solid rgba(255,138,42,0.2)",
              borderRadius: 20,
              padding: "6px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#ff8a2a",
            }}
          >
            {tripCount.toLocaleString()} group trip{tripCount !== 1 ? "s" : ""}{" "}
            planned on Skyrio
          </span>
        </div>
      )}

      {/* ── Feature grid ── */}
      <div className="sk-sync-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="sk-sync-card">
            <div className="sk-sync-card-icon">{f.icon}</div>
            <div className="sk-sync-card-title">{f.title}</div>
            <div className="sk-sync-card-body">{f.body}</div>
          </div>
        ))}
      </div>

      {/* ── Start a trip: group boarding pass ──
          Destination and dates are collected up front so the invite
          email says what trip people are joining. */}
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

      {/* ── My Group Trips ── */}
      {!tripsLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Plane size={18} style={{ color: "#ff8a2a" }} />
              My Group Trips
            </h3>
            {myTrips.length > 0 && (
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                {myTrips.length} trip{myTrips.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {myTrips.length === 0 && (
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: "32px 24px",
                textAlign: "center",
              }}
            >
              <Plane
                size={32}
                style={{ color: "rgba(255,138,42,0.3)", marginBottom: 12 }}
              />
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                No group trips yet
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Add your crew below and start your first group adventure
              </div>
            </div>
          )}

          {myTrips.map((trip) => {
            const sc = statusColors[trip.status] || "#ff8a2a";
            const memberCount = (trip.members?.length || 0) + 1;
            return (
              <div
                key={trip._id}
                onClick={() => navigate(`/sync-together/${trip._id}`)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  padding: "18px 20px",
                  cursor: "pointer",
                  transition: "border-color 0.2s, transform 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,138,42,0.3)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}
                    >
                      {trip.title || "Untitled Trip"}
                    </span>
                    {trip.destination && (
                      <span
                        style={{
                          color: "#ff8a2a",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        → {trip.destination}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        background: `${sc}20`,
                        color: sc,
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {statusLabels[trip.status] || trip.status}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Users size={12} /> {memberCount} traveler
                      {memberCount !== 1 ? "s" : ""}
                    </span>
                    {trip.dateRangeStart && trip.dateRangeEnd && (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Calendar size={12} />{" "}
                        {dayjs(trip.dateRangeStart).format("MMM D")} –{" "}
                        {dayjs(trip.dateRangeEnd).format("MMM D")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", marginTop: 10 }}>
                    {trip.owner && (
                      <Avatar
                        size={28}
                        src={
                          trip.owner.avatar !== "/default-avatar.png"
                            ? trip.owner.avatar
                            : undefined
                        }
                        style={{
                          background: "#ff8a2a",
                          color: "#1b1024",
                          fontWeight: 800,
                          border: "2px solid rgba(26,10,46,0.8)",
                        }}
                      >
                        {(trip.owner.name ||
                          trip.owner.username ||
                          "?")[0].toUpperCase()}
                      </Avatar>
                    )}
                    {trip.members?.slice(0, 4).map((m, idx) => (
                      <Avatar
                        key={m._id || idx}
                        size={28}
                        src={
                          m.user?.avatar !== "/default-avatar.png"
                            ? m.user?.avatar
                            : undefined
                        }
                        style={{
                          background: "#2a1f3d",
                          color: "#ff8a2a",
                          fontWeight: 800,
                          marginLeft: -8,
                          border: "2px solid rgba(26,10,46,0.8)",
                        }}
                      >
                        {(m.name ||
                          m.user?.name ||
                          m.email ||
                          "?")[0].toUpperCase()}
                      </Avatar>
                    ))}
                    {(trip.members?.length || 0) > 4 && (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          marginLeft: -8,
                          background: "rgba(255,138,42,0.15)",
                          border: "2px solid rgba(26,10,46,0.8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ff8a2a",
                        }}
                      >
                        +{trip.members.length - 4}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <ArrowRight
                    size={18}
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  />
                  {/* Only the trip's organizer can delete it — the backend
                      already enforces this (403 otherwise), this just
                      keeps the button from appearing for anyone else. */}
                  {currentUserId &&
                    String(trip.owner?._id || trip.owner) ===
                      String(currentUserId) && (
                      <button
                        onClick={(e) => deleteTrip(trip._id, trip.title, e)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 4,
                          color: "rgba(255,255,255,0.15)",
                          transition: "color 0.15s",
                          display: "flex",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#ff4d4f")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            "rgba(255,255,255,0.15)")
                        }
                        title="Delete trip"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
