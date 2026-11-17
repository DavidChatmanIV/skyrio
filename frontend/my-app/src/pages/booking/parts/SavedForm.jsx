// Part of the Book page (pages/BookingPage.jsx), moved here as-is.
import { useState, useEffect } from "react";
import { message as antdMessage } from "antd";
import { LoadingOutlined, DeleteOutlined } from "@ant-design/icons";
import { MapPin } from "lucide-react";
import { API, IconWarning, Text } from "./shared";

export function SavedForm() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/api/saved-trips`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok)
          throw new Error(data.message || "Couldn't load saved trips. Try again.");
        setTrips(data.savedTrips);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/saved-trips/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Delete failed");
      setTrips((prev) => prev.filter((t) => (t.id || t._id) !== id));
      antdMessage.success("Trip removed");
    } catch (err) {
      antdMessage.error(err.message || "Couldn't remove trip. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading)
    return (
      <div className="sk-search-bar" style={{ justifyContent: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          <LoadingOutlined style={{ marginRight: 8 }} />
          Loading saved trips…
        </Text>
      </div>
    );
  if (error)
    return (
      <div className="sk-search-bar" style={{ justifyContent: "center" }}>
        <Text style={{ color: "#ff4d4f", fontSize: 14 }}>
          <IconWarning size={14} /> {error}
        </Text>
      </div>
    );
  if (!trips.length)
    return (
      <div className="sk-search-bar" style={{ justifyContent: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
          No saved trips yet. Tap Save on a result.
        </Text>
      </div>
    );

  return (
    <div className="sk-search-bar sk-saved-list">
      {trips.map((trip) => {
        const id = trip.id || trip._id;
        return (
          <div key={id} className="sk-saved-chip">
            <span className="sk-saved-chip-title">{trip.title}</span>
            {trip.destination && (
              <span className="sk-saved-chip-dest">
                <MapPin
                  size={11}
                  style={{ marginRight: 3, verticalAlign: "middle" }}
                />
                {trip.destination}
              </span>
            )}
            {trip.price > 0 && (
              <span className="sk-saved-chip-price">
                ${trip.price.toLocaleString("en-US")}
              </span>
            )}
            <button
              type="button"
              className="sk-saved-chip-delete"
              onClick={() => handleDelete(id)}
              disabled={deletingId === id}
              aria-label="Remove saved trip"
            >
              {deletingId === id ? <LoadingOutlined /> : <DeleteOutlined />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
