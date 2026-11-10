import React, { useMemo } from "react";
import { Layout, Card, Typography, Button, Space, Divider, Tag } from "antd";
import { ArrowLeftOutlined, SafetyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "../styles/checkout.css";

const { Content } = Layout;
const { Title, Text } = Typography;

export default function CheckoutPage() {
  const navigate = useNavigate();

  const trip = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("sk_checkout");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  return (
    <Layout className="sk-checkoutPage">
      <Content className="sk-checkoutWrap">
        <div className="sk-checkoutHeader">
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/booking?tab=stays")}
              className="sk-backBtn"
            >
              Back
            </Button>
            <Tag icon={<SafetyOutlined />} className="sk-secureTag">
              Secure checkout
            </Tag>
          </Space>
        </div>

        <div className="sk-checkoutGrid">
          <Card className="sk-surface" bordered={false}>
            <Title level={3} style={{ marginTop: 0 }}>
              Checkout
            </Title>
            <Text type="secondary">
              This is your clean checkout foundation. Next we&apos;ll connect real
              totals (stays/flights/fees) and payment.
            </Text>

            <Divider />

            {!trip ? (
              <Text>
                No trip selected yet. Go back and pick a stay/flight, then click
                Checkout again.
              </Text>
            ) : (
              <div>
                <Title level={5} style={{ marginTop: 0 }}>
                  Your selection
                </Title>
                <pre className="sk-pre">{JSON.stringify(trip, null, 2)}</pre>
              </div>
            )}

            <Divider />

            <Space>
              <Button
                onClick={() => navigate("/booking?tab=stays")}
                className="sk-btnGhost"
              >
                Keep browsing
              </Button>
              <Button type="primary" className="sk-cta" disabled>
                Pay (next)
              </Button>
            </Space>
          </Card>

          <Card className="sk-surface sk-summary" bordered={false}>
            <Title level={5} style={{ marginTop: 0 }}>
              Summary
            </Title>
            <div className="sk-summaryRow">
              <Text type="secondary">Subtotal</Text>
              <Text>$—</Text>
            </div>
            <div className="sk-summaryRow">
              <Text type="secondary">Taxes & fees</Text>
              <Text>$—</Text>
            </div>
            <Divider style={{ margin: "12px 0" }} />
            <div className="sk-summaryRow">
              <Text strong>Total</Text>
              <Text strong>$—</Text>
            </div>

            <div className="sk-miniNote">
              <Text type="secondary">
                We&apos;ll break out carry-on / checked bag fees once Amadeus flight
                offers are live.
              </Text>
            </div>
          </Card>
        </div>
      </Content>
    </Layout>
  );
}