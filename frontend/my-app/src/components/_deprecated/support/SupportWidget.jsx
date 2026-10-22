import React, { useState } from "react";
import {
  FloatButton,
  Drawer,
  Tabs,
  Space,
  Typography,
  Button,
  Divider,
  message,
} from "antd";
import {
  CustomerServiceOutlined,
  RobotOutlined,
  QuestionCircleOutlined,
  SwapOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function SupportWidget({
  onOpenTutorial,
  onOpenCancel,
  onOpenSeatSwitch,
}) {
  const [open, setOpen] = useState(false);

  const quickToast = (msg) => message.success({ content: msg, duration: 1.8 });

  const items = [
    {
      key: "support",
      label: "AI Support",
      children: (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Title level={5}>Quick actions</Title>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Button
              block
              type="primary"
              icon={<RobotOutlined />}
              onClick={() => quickToast("Opening AI chat…")}
            >
              Chat with Questy
            </Button>
            <Button
              block
              icon={<PlayCircleOutlined />}
              onClick={() => (onOpenTutorial ? onOpenTutorial() : quickToast("Opening tutorial…"))}
            >
              Start guided tutorial
            </Button>
            <Button
              block
              icon={<SwapOutlined />}
              onClick={() => (onOpenSeatSwitch ? onOpenSeatSwitch() : quickToast("Seat switch flow…"))}
            >
              Switch seats
            </Button>
            <Button
              block
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => (onOpenCancel ? onOpenCancel() : quickToast("Cancellation flow…"))}
            >
              Cancel booking
            </Button>
          </Space>

          <Divider style={{ margin: "12px 0" }} />

          <Space direction="vertical" size={4}>
            <Text type="secondary">Need more help?</Text>
            <Button block icon={<QuestionCircleOutlined />}>Read FAQs</Button>
            <Button block icon={<CustomerServiceOutlined />}>Contact support</Button>
          </Space>
        </Space>
      ),
    },
    {
      key: "tutorials",
      label: "Tutorials",
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>Walkthroughs for common tasks:</Text>
          <Button block onClick={() => onOpenTutorial && onOpenTutorial()}>
            Booking basics
          </Button>
          <Button block onClick={() => onOpenSeatSwitch && onOpenSeatSwitch()}>
            Picking & switching seats
          </Button>
          <Button block onClick={() => onOpenCancel && onOpenCancel()}>
            Cancellations & refunds
          </Button>
        </Space>
      ),
    },
    {
      key: "manage",
      label: "Manage booking",
      children: (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text>Make quick changes to your trip.</Text>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Button block onClick={() => onOpenSeatSwitch && onOpenSeatSwitch()}>Switch seats</Button>
            <Button block onClick={() => onOpenCancel && onOpenCancel()} danger>
              Cancel booking
            </Button>
          </Space>
        </Space>
      ),
    },
  ];

  return (
    <>
      <FloatButton
        icon={<CustomerServiceOutlined />}
        type="primary"
        tooltip="Need help?"
        onClick={() => setOpen(true)}
      />

      <Drawer
        title="Need help?"
        placement="right"
        width={360}
        open={open}
        onClose={() => setOpen(false)}
      >
        <Tabs defaultActiveKey="support" items={items} />
      </Drawer>
    </>
  );
}