import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Skeleton, Tag, Typography, Button } from "antd";
import {
  CalendarOutlined,
  NumberOutlined,
  TeamOutlined,
  UserOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/useAuth";
import { apiUrl } from "@/lib/api";

const { Text, Title } = Typography;

const CARD_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

const ROW_STYLE = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  padding: "14px 16px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  cursor: "pointer",
  transition: "border-color 0.2s, background 0.2s",
};

const TYPE_ICON = {
  Flight: "✈️",
  Hotel: "🏨",
  Package: "🧳",
  Place: "📍",
  Cruise: "🚢",
  Car: "🚗",
};

// Dates are stored as midnight UTC (e.g. 2026-11-20T00:00:00Z). Formatting in
// UTC keeps New York users from seeing the day before their real departure.
function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtMoney(amount, currency = "USD") {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

function titleFor(b) {
  if (b.tripDetails) return b.tripDetails;
  if (b.hotelName) return b.hotelName;
  return `${b.type || "Trip"} booking`;
}

function statusTag(status) {
  if (status === "cancel_pending")
    return <Tag color="orange">Cancellation pending</Tag>;
  if (status === "confirmed") return <Tag color="green">Confirmed</Tag>;
  return <Tag>{status}</Tag>;
}

const UpcomingBookings = () => {
  const nav = useNavigate();
  const { token, isAuthed } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (signal) => {
      if (!isAuthed) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl("/api/bookings/upcoming"), {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || `Request failed (${res.status})`);
        setBookings(Array.isArray(data.bookings) ? data.bookings : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("[UpcomingBookings]", err);
        setError("We couldn't load your trips right now.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [isAuthed, token]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <Card style={CARD_STYLE} variant="borderless">
      <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
        🛫 Your Upcoming Trips
      </Title>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        // Never fall through to the empty state on an error — that hid this bug before.
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text
            style={{
              color: "rgba(255,120,120,0.85)",
              display: "block",
              marginBottom: 12,
            }}
          >
            {error}
          </Text>
          <Button onClick={() => load()}>Try again</Button>
        </div>
      ) : bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              display: "block",
              marginBottom: 12,
            }}
          >
            You don't have any upcoming trips yet.
          </Text>
          <Button
            type="primary"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Plan a trip
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((b) => {
            const start = fmtDate(b.startDate);
            const end = fmtDate(b.endDate);
            const paid = fmtMoney(b.total, b.totalCurrency || "USD");
            const code = b.confirmation;
            const isGroup = b.kind === "group" || !!b.syncGroup;

            return (
              <div
                key={b._id}
                role="button"
                tabIndex={0}
                style={ROW_STYLE}
                onClick={() => nav("/saved-trips")}
                onKeyDown={(e) => e.key === "Enter" && nav("/saved-trips")}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,138,42,0.4)";
                  e.currentTarget.style.background = "rgba(255,138,42,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
              >
                <div style={{ fontSize: 22, lineHeight: 1, paddingTop: 2 }}>
                  {TYPE_ICON[b.type] || "🧭"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}
                    >
                      {titleFor(b)}
                    </span>
                  </div>

                  {start && (
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <CalendarOutlined style={{ marginRight: 6 }} />
                      {start}
                      {end && end !== start ? ` → ${end}` : ""}
                    </div>
                  )}

                  {code && (
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <NumberOutlined style={{ marginRight: 6 }} />
                      Confirmation:{" "}
                      <span style={{ color: "#fff", fontWeight: 600 }}>
                        {code}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {statusTag(b.status)}
                    <Tag
                      icon={isGroup ? <TeamOutlined /> : <UserOutlined />}
                      color={isGroup ? "purple" : "default"}
                    >
                      {isGroup ? "Group trip" : "Solo"}
                    </Tag>
                    {b.sharedRoom && <Tag color="purple">Shared room</Tag>}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {paid && (
                    <div
                      style={{
                        color: "#ff8a2a",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {paid}
                    </div>
                  )}
                  <div
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 12,
                      marginTop: 6,
                    }}
                  >
                    Manage <ArrowRightOutlined />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default UpcomingBookings;
