import React, { useState } from "react";
import { Card, List, Typography, Tag } from "antd";
import { CalendarOutlined, EnvironmentOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

const CARD_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

const UpcomingBookings = () => {
  // No real booking data exists yet to fetch — the previous version showed
  // two hardcoded entries (a Tokyo hotel, an NYC flight) that had nothing
  // to do with whoever was actually logged in. An honest empty state is
  // correct until this is wired to a real endpoint.
  //
  // Next step (post-launch, once BookingPage.jsx actually persists a
  // booking somewhere): swap this for a real fetch, e.g.
  //   useEffect(() => {
  //     fetch(apiUrl("/api/bookings/upcoming"), { credentials: "include", ... })
  //       .then(r => r.json()).then(data => setBookings(data.bookings));
  //   }, []);
  // The render logic below already expects exactly that shape
  // ({ id, date, destination, type, status }), so no JSX changes needed
  // when that's ready — just replace this useState([]) with a real fetch.
  const [bookings] = useState([]);

  return (
    <Card style={CARD_STYLE} variant="borderless">
      <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
        🛫 Your Upcoming Bookings
      </Title>

      {bookings.length === 0 ? (
        <Text style={{ color: "rgba(255,255,255,0.5)" }}>
          You don't have any upcoming trips yet.
        </Text>
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={bookings}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>
                    <CalendarOutlined /> {item.date}
                  </span>
                }
                description={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: "rgba(255,255,255,0.6)" }}>
                      <EnvironmentOutlined style={{ marginRight: 8 }} />
                      {item.destination}
                    </div>
                    <Tag color={item.status === "Confirmed" ? "green" : "blue"}>
                      {item.type} - {item.status}
                    </Tag>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

export default UpcomingBookings;
