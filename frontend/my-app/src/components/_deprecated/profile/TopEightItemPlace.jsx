import React from "react";
import { Typography, Tag } from "antd";

const { Text } = Typography;

/** Visa-stamp style place card (square thumbnail + caption) */
export default function TopEightItemPlace({ item }) {
  // item: { id, name, img, status }
  return (
    <div
      className="osq-top8-stamp"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px dashed rgba(255,255,255,0.18)",
        borderRadius: 14,
        padding: 10,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          height: 108,
          backgroundImage: `url(${item.img})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
        }}
      />
      <div
        style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}
      >
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
          Place
        </Tag>
      </div>
      {item.status && (
        <Text style={{ color: "rgba(255,255,255,0.80)", fontSize: 12 }}>
          {item.status}
        </Text>
      )}
    </div>
  );
}
