import React, { useMemo } from "react";
import { Card, Typography, Input, Button } from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../auth/useAuth"; 

const { Title, Text } = Typography;

export default function RewardsExchangeCard() {
  const auth = useAuth();

  const displayName = useMemo(() => {
    const u = auth?.user;
    if (!u) return "";
    return u.username || u.name || (u.email ? u.email.split("@")[0] : "");
  }, [auth?.user]);

  const isAuthed = !!auth?.user;

  // ✅ Recommended behavior: if not logged in, do NOT show this block at all
  // (this removes "Guest" forever)
  if (!isAuthed) return null;

  return (
    <Card bordered={false} className="sk-card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
          SkyHub
          </Title>

          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            Welcome, {displayName || "Explorer"}
          </Text>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="pp-xpChip" style={{ display: "inline-flex" }}>
            <ThunderboltOutlined /> XP Today: 0
          </div>

          <Button
            icon={<PlusOutlined />}
            type="primary"
            style={{
              borderRadius: 999,
              fontWeight: 900,
              background: "linear-gradient(135deg,#ff8a2a,#ffb066)",
              border: "1px solid rgba(255,138,42,.55)",
              color: "rgba(20,12,8,.92)",
            }}
            onClick={() => {
              // soft launch placeholder
              // replace later with SkyHub composer modal
            }}
          >
            Post
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search SkyHub..."
          className="pp-searchPill"
        />
      </div>
    </Card>
  );
}
