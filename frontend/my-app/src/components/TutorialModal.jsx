import React, { useMemo } from "react";
import { Modal, Button, Space, Typography } from "antd";

const { Text } = Typography;

export default function TutorialModal({ open, onClose }) {
  const close = () => {
    localStorage.setItem("skyrio_tutorial_seen", "true");
    onClose?.();
  };

  const footer = useMemo(
    () => (
      <Button type="primary" onClick={close} className="btn-orange">
        Let&apos;s Go ✈️
      </Button>
    ),
    []
  );

  return (
    <Modal
      title="👋 Welcome to Skyrio"
      open={!!open}
      onCancel={close}
      footer={footer}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Text style={{ color: "rgba(255,255,255,.85)" }}>
          Quick 30-second tour — Skyrio helps you plan faster, save money, and
          get rewarded.
        </Text>

        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Get started in seconds — no stress.</li>
          <li>Earn XP as you plan and book trips.</li>
          <li>Use AI for quick trip ideas.</li>
          <li>Turn on price tracking alerts when you&apos;re ready.</li>
        </ul>

        <Text style={{ color: "rgba(255,255,255,.7)" }}>
          You can reopen this anytime from &quot;Take a 30-sec tour&quot;.
        </Text>
      </Space>
    </Modal>
  );
}