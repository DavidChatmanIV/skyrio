import React from "react";
import { Alert, List, Typography } from "antd";
import {
  ThunderboltOutlined,
  CloudOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const CARD_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 20,
};

// Relabeled from "Travel Alerts & Tips" to "General Travel Tips" — these
// are static, generic tips, not alerts about *your* specific trip. There's
// no per-user destination data to generate a real personalized alert from
// yet (that's downstream of the real-bookings fix), so calling generic
// content "alerts" implied something it wasn't actually doing.
//
// Next step (post-launch, once real bookings exist): generate this list
// from the user's actual upcoming destinations via the existing
// /api/weather route, plus Atlas AI for non-weather advisories — replacing
// this static TIPS array with a real fetch.
const TIPS = [
  {
    id: 1,
    type: "Weather",
    message: "Heavy rain expected in Bangkok. Pack light rain gear.",
    icon: <CloudOutlined />,
  },
  {
    id: 2,
    type: "Security",
    message:
      "Be cautious near popular areas in Barcelona due to recent pickpocketing.",
    icon: <WarningOutlined />,
  },
  {
    id: 3,
    type: "Smart Tip",
    message:
      "Traveling to Japan? JR Rail Pass is now only available online before arrival.",
    icon: <ThunderboltOutlined />,
  },
];

const TravelAlerts = () => {
  return (
    <div style={CARD_STYLE}>
      <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
        💡 General Travel Tips
      </Title>

      {TIPS.length === 0 ? (
        <Text style={{ color: "rgba(255,255,255,0.5)" }}>
          No tips right now — check back later!
        </Text>
      ) : (
        <List
          itemLayout="vertical"
          dataSource={TIPS}
          renderItem={(tip) => (
            <List.Item
              key={tip.id}
              style={{ border: "none", padding: "0 0 12px" }}
            >
              <Alert
                message={tip.message}
                type={
                  tip.type === "Weather"
                    ? "info"
                    : tip.type === "Security"
                    ? "warning"
                    : "success"
                }
                icon={tip.icon}
                showIcon
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default TravelAlerts;
