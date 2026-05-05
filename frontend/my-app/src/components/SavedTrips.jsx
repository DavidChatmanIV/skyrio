import React, { useEffect, useState, useCallback } from "react";
import { Empty, Skeleton, message } from "antd";
import { useAuth } from "../auth/useAuth";
import { apiUrl } from "@/lib/api";

export default function SavedTrips() {
  const { token, isAuthed } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    if (!isAuthed) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/saved-trips"), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch trips");
      setTrips(data.savedTrips || []);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthed, token]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/saved-trips/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete");
      setTrips((prev) => prev.filter((t) => t._id !== id));
      message.success("Trip removed");
    } catch (err) {
      message.error(err.message);
    }
  };

  if (!isAuthed) return null;

  return (
    <section style={{ padding: "24px 16px 40px" }}>
      {loading ? (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 280,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            No saved trips yet
          </div>
          <div style={{ fontSize: 13 }}>
            Save a flight or hotel to see it here
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {trips.map((trip) => (
            <div
              key={trip._id}
              style={{
                width: 280,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                overflow: "hidden",
                position: "relative",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-2px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              {/* Image or placeholder */}
              <div
                style={{
                  height: 120,
                  background: trip.image
                    ? `url(${trip.image}) center/cover`
                    : "linear-gradient(135deg, #3a2a72, #7c5cfc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                {!trip.image && "✈️"}
              </div>

              <div style={{ padding: "14px 16px 16px" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#fff",
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {trip.title}
                </div>

                {trip.destination && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 6,
                    }}
                  >
                    📍 {trip.destination}
                  </div>
                )}

                {trip.price > 0 && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#ff8a2a",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    ${parseFloat(trip.price).toFixed(0)}{" "}
                    {trip.currency || "USD"}
                  </div>
                )}

                {trip.startDate && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
                      marginBottom: 10,
                    }}
                  >
                    {trip.startDate}
                    {trip.endDate ? ` → ${trip.endDate}` : ""}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => (window.location.href = "/booking")}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
                      border: "none",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Continue planning
                  </button>
                  <button
                    onClick={() => handleDelete(trip._id)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      background: "rgba(255,77,109,0.15)",
                      border: "1px solid rgba(255,77,109,0.3)",
                      color: "#ff4d6d",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
