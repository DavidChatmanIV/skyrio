import React from "react";
import { Card, Space, Typography, List, Avatar } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Text } = Typography;

export default function SavedTripsCard({
  trips = [
    { city: "Paris", range: "Jan 15 – Jan 22", cta: "Dates" },
    { city: "Tokyo", range: "Feb 2 – Feb 10", cta: "Who's going" },
  ],
}) {
  return (
    <Card
      variant="borderless"
      className="osq-card"
      styles={{ body: { padding: 16 } }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        <Text type="secondary">Saved Trips</Text>
        <List
          itemLayout="horizontal"
          dataSource={trips}
          split
          renderItem={(t) => (
            <List.Item
              actions={[
                <Link key="cta" to="/booking">
                  {t.cta || "Open"} <ArrowRightOutlined />
                </Link>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar shape="square">{t.city?.[0]}</Avatar>}
                title={<Text strong>{t.city}</Text>}
                description={<Text type="secondary">{t.range}</Text>}
              />
            </List.Item>
          )}
        />
      </Space>
    </Card>
  );
}
