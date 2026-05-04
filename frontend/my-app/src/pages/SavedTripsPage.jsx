import React from "react";
import { Typography, Button, Space } from "antd";
import { useNavigate } from "react-router-dom";
import SavedTrips from "../components/SavedTrips";

const { Title, Text } = Typography;

export default function SavedTripsPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 20px 48px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <Space
        style={{
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 8,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: "#fff" }}>
            Saved Trips
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Your shortlist — compare options, book when ready.
          </Text>
        </div>
        <Button
          onClick={() => navigate("/booking")}
          style={{
            background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
            border: "none",
            color: "#fff",
            fontWeight: 600,
            borderRadius: 10,
          }}
        >
          Find more trips
        </Button>
      </Space>

      <SavedTrips />
    </div>
  );
}
