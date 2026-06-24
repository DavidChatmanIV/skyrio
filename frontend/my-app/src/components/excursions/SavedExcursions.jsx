import React, { useEffect, useState } from "react";
import { Card, Tag, Row, Col, Empty, Button, Typography } from "antd";
import {
  EnvironmentOutlined,
  HeartFilled,
  DeleteOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";

const { Title, Text } = Typography;

const CARD_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

// Renamed from SavedExcursions.jsx / "Saved Excursions" — the Tabs label
// directly above this card already said "Saved Trips" (LandingPage.jsx),
// so the card disagreeing with its own tab was the first thing to fix.
//
// The bigger fix: this component used to read/write
// localStorage["savedExcursions"] — local to one browser, never synced to
// the account, and disconnected from the REAL saved-trips system that
// already works elsewhere in this app: SaveTripButton
// (components/trips/SaveTripButton.jsx) saves via POST /api/saved-trips,
// and BookingPage.jsx's own "Saved" tab already reads it back correctly
// via GET /api/saved-trips. This now uses that same real endpoint, so a
// trip saved from the booking page actually shows up here.
//
// Only id/_id, title, destination, and price are confirmed real fields
// (per BookingPage.jsx's own usage of this endpoint) — the old version
// also rendered item.image and item.tags, but I have no confirmation those
// fields exist on the real response, so they're left out rather than
// risking broken images. If saved trips do have a cover image or tags on
// the backend, share the exact field names and I'll add them back in.
export default function SavedTrips() {
  const { token } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/saved-trips"), {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!mounted) return;
        if (!data.ok)
          throw new Error(data.message || "Failed to load saved trips");
        setTrips(data.savedTrips || []);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleRemove = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/api/saved-trips/${id}`), {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.message || "Failed to remove trip");
      setTrips((prev) => prev.filter((t) => (t.id || t._id) !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card style={CARD_STYLE} variant="borderless">
      <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
        <HeartFilled style={{ color: "#ff8a2a", marginRight: 8 }} />
        Saved Trips
      </Title>

      {loading ? (
        <Text style={{ color: "rgba(255,255,255,0.5)" }}>
          <LoadingOutlined style={{ marginRight: 8 }} />
          Loading saved trips…
        </Text>
      ) : error ? (
        <Text style={{ color: "#ff4d4f" }}>{error}</Text>
      ) : trips.length === 0 ? (
        <Empty
          description={
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              No trips saved yet — hit Save on any result to add one
            </span>
          }
        />
      ) : (
        <Row gutter={[16, 16]}>
          {trips.map((trip) => {
            const id = trip.id || trip._id;
            return (
              <Col xs={24} sm={12} md={8} key={id}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      color: "#fff",
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    {trip.title}
                  </div>
                  {trip.destination && (
                    <div
                      style={{
                        color: "rgba(255,255,255,0.55)",
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      <EnvironmentOutlined /> {trip.destination}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {trip.price > 0 && (
                      <Tag color="orange">${trip.price.toLocaleString()}</Tag>
                    )}
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      loading={deletingId === id}
                      onClick={() => handleRemove(id)}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Card>
  );
}
