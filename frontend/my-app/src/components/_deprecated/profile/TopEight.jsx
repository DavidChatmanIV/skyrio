import React from "react";
import { Card, Row, Col, Typography } from "antd";

const { Text } = Typography;

export default function TopEight({
  className,
  items = [],
  mode = "Places",
  style,
  ...rest
}) {
  return (
    <Card
      className={`osq-surface ${className || ""}`}
      data-surface={rest["data-surface"] ?? "2"}
      styles={{ body: { padding: 12 } }}
      style={{ borderRadius: 12, ...(style || {}) }}
      {...rest}
    >
      <Row gutter={[12, 12]}>
        {(items.slice(0, 8) || []).map((item) => (
          <Col xs={12} sm={8} md={6} key={item.id ?? item.key ?? item.title}>
            <div className="flex flex-col items-center text-center">
              {item?.img ? (
                <img
                  src={item.img}
                  alt={item.title || mode}
                  style={{
                    width: 84,
                    height: 84,
                    objectFit: "cover",
                    borderRadius: 12,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                  }}
                >
                  {item?.abbr || (item?.title ? item.title[0] : mode[0])}
                </div>
              )}

              <Text style={{ display: "block", marginTop: 8, fontWeight: 600 }}>
                {item?.title || "Untitled"}
              </Text>
              {item?.subtitle && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.subtitle}
                </Text>
              )}
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
