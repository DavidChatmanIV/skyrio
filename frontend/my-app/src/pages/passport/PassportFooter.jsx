import React, { useMemo, useState } from "react";
import { Card, Typography, Button, Input, Tag } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

// IMPORTANT: PassportFooter is inside /pages/passport, so hook path is:
import { useAuth } from "../../hooks/useAuth";

const { Title, Text } = Typography;

export default function PassportFooter() {
  const nav = useNavigate();
  const auth = useAuth();

  const [search, setSearch] = useState("");

  const isAuthed = !!auth?.user;

  const displayName = useMemo(() => {
    const u = auth?.user;
    if (!u) return "";
    return u.username || u.name || (u.email ? u.email.split("@")[0] : "");
  }, [auth?.user]);

  const xpToday = 0; // soft-launch placeholder

  // ✅ Your requirement: no "Guest" + only show once logged in
  if (!isAuthed) return null;

  const goSkyHub = () => nav("/skyhub");
  const goComposer = () => nav("/skyhub?compose=1");

  return (
    <>
      {/* ✅ SkyHub preview card (passport-grade glass) */}
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
              Skyrio • SkyHub
            </Title>

            <Text
              type="secondary"
              style={{ display: "block", marginTop: 4 }}
            >
              Welcome, {displayName || "Explorer"}
            </Text>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Tag
              icon={<ThunderboltOutlined />}
              style={{
                margin: 0,
                borderRadius: 999,
                padding: "4px 10px",
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(0,0,0,.16)",
                color: "rgba(244,246,251,.88)",
              }}
            >
              XP Today: {xpToday}
            </Tag>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{
                borderRadius: 999,
                fontWeight: 900,
                background: "linear-gradient(135deg,#ff8a2a,#ffb066)",
                border: "1px solid rgba(255,138,42,.55)",
                color: "rgba(20,12,8,.92)",
              }}
              onClick={goComposer}
            >
              Post
            </Button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginTop: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search SkyHub..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className="pp-searchPill"
            onPressEnter={() => {
              const q = encodeURIComponent(search || "");
              nav(`/skyhub${q ? `?search=${q}` : ""}`);
            }}
          />
        </div>

        {/* Small helper row */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "rgba(244,246,251,.55)", fontSize: 12 }}>
            Share travel moments, tag places, earn XP.
          </Text>

          <Button
            type="text"
            onClick={goSkyHub}
            style={{
              padding: 0,
              color: "rgba(255,176,102,.92)",
              fontWeight: 900,
            }}
          >
            Open SkyHub →
          </Button>
        </div>
      </Card>
    </>
  );
}
