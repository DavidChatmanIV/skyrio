import React, { useMemo, useState } from "react";
import { Card, Input, Typography, Space, Avatar, Button, Tag } from "antd";
import { UserAddOutlined } from "@ant-design/icons";

import LeftRail from "./LeftRail";
import RightRail from "./RightRail";

const { Title, Text } = Typography;

export default function FriendsPage() {
  const [q, setQ] = useState("");

  // ✅ Keep it simple + light (prevents page hang)
  const friends = useMemo(
    () => [
      { id: 1, name: "Ariana", handle: "@ariana", city: "NYC" },
      { id: 2, name: "Marcus", handle: "@marcus", city: "Newark" },
      { id: 3, name: "Jules", handle: "@jules", city: "Miami" },
      { id: 4, name: "Kai", handle: "@kai", city: "LA" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return friends;
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(s) || f.handle.toLowerCase().includes(s)
    );
  }, [q, friends]);

  return (
    <div className="sh-grid">
      {/* ✅ LEFT */}
      <div className="sh-left">
        <LeftRail />
      </div>

      {/* ✅ CENTER */}
      <div className="sh-mid">
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Friends
            </Title>
            <Text type="secondary">
              See friends’ travel moments and connect.
            </Text>
          </div>

          <Input
            placeholder="Search friends..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            allowClear
          />

          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {filtered.slice(0, 30).map((f) => (
              <Card key={f.id} className="sh-card" style={{ width: "100%" }}>
                <Space
                  align="center"
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Space>
                    <Avatar>{f.name.slice(0, 1)}</Avatar>
                    <div>
                      <div style={{ fontWeight: 700 }}>{f.name}</div>
                      <Text type="secondary">
                        {f.handle} · {f.city}
                      </Text>
                      <div style={{ marginTop: 6 }}>
                        <Tag color="purple">Traveler</Tag>
                      </div>
                    </div>
                  </Space>

                  <Button icon={<UserAddOutlined />}>Add</Button>
                </Space>
              </Card>
            ))}
          </Space>
        </Space>
      </div>

      {/* ✅ RIGHT */}
      <div className="sh-right">
        <RightRail />
      </div>
    </div>
  );
}
