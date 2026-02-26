import React from "react";
import { Typography, Avatar, Tag } from "antd";

const { Text } = Typography;

/** Passport-badge style friend card (avatar + mini status) */
export default function TopEightItemFriend({ item }) {
  // item: { id, name, img, status }
  return (
    <div
      className="osq-top8-stamp"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px dashed rgba(255,255,255,0.18)",
        borderRadius: 14,
        padding: 10,
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 10,
        alignItems: "center",
      }}
    >
      <Avatar
        src={item.img}
        size={56}
        style={{
          border: "2px solid rgba(255,255,255,0.25)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
        }}
      />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text strong style={{ color: "#fff" }}>
            {item.name}
          </Text>
          <Tag
            style={{
              marginInlineStart: 0,
              background: "rgba(255,255,255,0.10)",
              borderColor: "rgba(255,255,255,0.15)",
              color: "#fff",
            }}
            bordered
          >
            Friend
          </Tag>
        </div>
        {item.status && (
          <Text style={{ color: "rgba(255,255,255,0.80)", fontSize: 12 }}>
            {item.status}
          </Text>
        )}
      </div>
    </div>
  );
}
