import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Row,
  Col,
  Typography,
  Space,
  Button,
  Input,
  Segmented,
  Tag,
  Badge,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  MessageOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function SkyStreamHeader({
  brand = "Skyrio",
  activeTab = "forYou",
  onTabChange,
  tabOptions = [],
  search = "",
  onSearchChange,
  xpToday = 0,
  onCompose,
  unreadDm = 0, // unread DM count
}) {
  const navigate = useNavigate();

  const options = useMemo(() => {
    // Supports either [{ key, label }] or Segmented-ready [{ value, label }]
    if (!tabOptions?.length) return [];
    if (tabOptions[0]?.value) return tabOptions;
    return tabOptions.map((t) => ({ value: t.key, label: t.label }));
  }, [tabOptions]);

  return (
    <div className="sk-header glass">
      <Row gutter={[12, 12]} align="middle">
        {/* Left: Title */}
        <Col xs={24} md={14}>
          <Title level={2} style={{ margin: 0 }}>
            SkyStream
          </Title>
          <Text className="sk-muted">Live travel moments across {brand}</Text>
        </Col>

        {/* Right: XP + DM + Post */} 
        <Col
          xs={24}
          md={10}
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <Space wrap align="center">
            <Tag icon={<ThunderboltOutlined />}>XP Today: {xpToday}</Tag>

            {/* DM Button */}
            <div className="sk-dmWrap">
              <Badge
                count={unreadDm}
                size="small"
                offset={[-4, 4]}
                className="sk-dm-badge"
              >
                <Button
                  type="text"
                  aria-label="Direct Messages"
                  className={`sk-dm-btn ${unreadDm > 0 ? "hasUnread" : ""}`}
                  icon={<MessageOutlined />}
                  onClick={() => navigate("/dm")}
                />
              </Badge>
            </div>

            <Button
              type="primary"
              className="btn-orange"
              icon={<PlusOutlined />}
              onClick={onCompose}
            >
              Post
            </Button>
          </Space>
        </Col>

        {/* Tabs */}
        <Col xs={24} md={14}>
          <Segmented
            options={options}
            value={activeTab}
            onChange={(v) => onTabChange?.(v)}
            block
          />
        </Col>

        {/* Search (single input only) */}
        <Col xs={24} md={10}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search SkyStream…"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </Col>
      </Row>
    </div>
  );
}