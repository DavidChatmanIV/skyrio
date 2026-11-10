import React, { useMemo, useState } from "react";
import { Card, Dropdown, Input, Button, Space, Tag } from "antd";
import {
  SearchOutlined,
  SlidersOutlined,
  DownOutlined,
} from "@ant-design/icons";

/**
 * SmartSearch
 * - Replaces Card bodyStyle/headStyle with styles={{ body, header }}
 * - Replaces Dropdown dropdownRender with popupRender
 * - Keeps AntD v5 menu API
 */
export default function SmartSearch({
  onSearch = () => {},
  defaultQuery = "",
  className = "",
}) {
  const [query, setQuery] = useState(defaultQuery);

  const items = useMemo(
    () => [
      { key: "anywhere", label: "Anywhere" },
      { key: "nearby", label: "Nearby (≤ 50mi)" },
      { key: "international", label: "International" },
      { type: "divider" },
      { key: "family", label: "Family friendly" },
      { key: "adventure", label: "Adventure" },
      { key: "budget", label: "Budget picks" },
    ],
    []
  );

  const handleMenuClick = ({ key }) => {
    // Example: tack on a tag-like keyword to the query
    setQuery((q) => (q ? `${q} ${key}` : key));
  };

  return (
    <Card
      className={className}
      title="Smart Search"
      styles={{
        header: {
          borderBottom: "1px solid var(--border-soft, rgba(255,255,255,.12))",
        },
        body: { padding: 16, background: "transparent" },
      }}
      extra={
        <Space size={8}>
          <Tag bordered={false}>Fast</Tag>
          <Tag bordered={false}>Accurate</Tag>
        </Space>
      }
    >
      <Space.Compact style={{ width: "100%" }}>
        <Input
          allowClear
          size="large"
          placeholder="Try &quot;Lisbon weekend under $600&quot;"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          prefix={<SearchOutlined />}
        />
        <Dropdown
          trigger={["click"]}
          menu={{ items, onClick: handleMenuClick }}
          popupRender={(menu) => (
            <div style={{ padding: 8 }}>
              {menu}
              <div style={{ marginTop: 8 }}>
                <Input size="small" placeholder="Quick filter…" />
              </div>
            </div>
          )}
        >
          <Button size="large" icon={<SlidersOutlined />} type="default">
            Filters <DownOutlined style={{ marginLeft: 6 }} />
          </Button>
        </Dropdown>
        <Button
          size="large"
          type="primary"
          onClick={() => onSearch(query.trim())}
          icon={<SearchOutlined />}
        >
          Search
        </Button>
      </Space.Compact>
    </Card>
  );
}
