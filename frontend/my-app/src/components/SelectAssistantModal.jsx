import React from "react";
import { Modal, Button, Typography, Space, Tag } from "antd";
import { RocketOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

export default function SelectAssistantModal({ visible, onSelect, onCancel }) {
  return (
    <Modal
      title="🧭 Atlas is ready"
      open={visible}
      onCancel={onCancel}
      footer={null}
      centered
      destroyOnClose
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Title level={4} style={{ margin: 0 }}>
          <RocketOutlined /> Atlas
        </Title>

        <Tag color="volcano">Skyrio AI</Tag>

        <Paragraph style={{ marginBottom: 0, opacity: 0.85 }}>
          Atlas powers trip planning, budgets, and smart suggestions across
          Skyrio.
        </Paragraph>

        <Button type="primary" block onClick={() => onSelect?.("Atlas")}>
          Start with Atlas
        </Button>
      </Space>
    </Modal>
  );
}