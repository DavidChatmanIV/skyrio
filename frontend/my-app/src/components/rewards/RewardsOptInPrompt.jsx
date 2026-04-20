import React, { useEffect, useState } from "react";
import { Modal, Typography, Switch, Space, Button } from "antd";

const { Title, Text } = Typography;

export default function RewardsOptInPrompt({ open, onClose, onConfirm }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (open) setEnabled(true);
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      title={
        <Title level={4} style={{ margin: 0, color: "#fff" }}>
          Turn on rewards?
        </Title>
      }
      styles={{
        content: {
          background: "rgba(18, 10, 36, 0.97)",
          border: "1px solid rgba(255, 138, 42, 0.2)",
          borderRadius: 16,
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        },
        mask: {
          backdropFilter: "blur(8px)",
        },
      }}
    >
      <Text
        style={{
          display: "block",
          marginBottom: 16,
          color: "rgba(255,255,255,0.75)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        Earn XP for bookings, saves, and challenges. Totally optional — you can
        book normally either way.
      </Text>

      <Space style={{ marginBottom: 20 }}>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
          Rewards:
        </Text>
        <Switch
          checked={enabled}
          onChange={setEnabled}
          style={{
            backgroundColor: enabled ? "#ff8a2a" : "rgba(255,255,255,0.2)",
          }}
        />
      </Space>

      <Space style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            color: "rgba(255,255,255,0.7)",
            fontWeight: 600,
            height: 38,
            padding: "0 20px",
          }}
        >
          Not now
        </Button>
        <Button
          onClick={() => onConfirm(enabled)}
          style={{
            background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
            border: "none",
            borderRadius: 999,
            color: "#1a0d04",
            fontWeight: 700,
            height: 38,
            padding: "0 20px",
          }}
        >
          Save
        </Button>
      </Space>
    </Modal>
  );
}