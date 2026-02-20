import React, { useState } from "react";
import {
  Typography,
  Form,
  Input,
  Button,
  Select,
  Collapse,
  Space,
  Card,
  Alert,
} from "antd";
import { HomeOutlined, RocketOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import "../styles/SmartPlan.css";

const { Title, Text } = Typography;
const { Option } = Select;

/* ------------ Options ------------ */
const FLIGHT_CLASSES = ["Economy", "Premium Economy", "Business", "First"];

const FOOD_PLAN_OPTIONS = [
  { label: "All-inclusive", value: "all-inclusive" },
  { label: "Pay per meal", value: "pay-per-meal" },
  { label: "Room service focused", value: "room-service" },
];

/* ------------ Helpers ------------ */
function buildTripPrompt(values) {
  const v = values || {};

  const lines = [
    `You are Atlas, Skyrio’s AI travel engine.`,
    ``,
    `Create a practical trip plan for:`,
    `Destination: ${v.destination || "N/A"}`,
    `Trip length: ${v.days || "N/A"} days`,
    v.flightClass ? `Flight class: ${v.flightClass}` : null,
    v.budget ? `Budget: ${v.budget}` : null,
    v.foodPlan ? `Food plan: ${v.foodPlan}` : null,
    v.activities ? `Preferred activities: ${v.activities}` : null,
    ``,
    `Output format (keep it structured):`,
    `- Quick summary (2–3 lines)`,
    `- Suggested area(s) to stay`,
    `- Day-by-day itinerary`,
    `- Budget tips`,
    `- 3 booking/search keywords`,
    ``,
    `Tone: confident, optimized, momentum-driven. Use bullet points and clear sections.`,
  ].filter(Boolean);

  return lines.join("\n");
}

export default function TravelAssistant() {
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [aiPlan, setAiPlan] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Atlas-only system prompt
  const systemPrompt =
    "You are Atlas, Skyrio's AI travel engine. Be fast, confident, optimized, and actionable. Use bullet points and clear structure. Keep answers practical and booking-ready.";

  // Presets
  const applyPreset = (key) => {
    const presets = {
      solo: { destination: "Paris", days: 3, flightClass: "Economy" },
      friends: { destination: "Barcelona", days: 5, flightClass: "Economy" },
      luxury: { destination: "Maldives", days: 7, flightClass: "Business" },
    };
    form.setFieldsValue(presets[key] || {});
    setSelectedPreset(key);
  };

  // Call your backend AI
  const callAi = async (messages) => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `AI request failed (${res.status})`);
    }

    const data = await res.json().catch(() => ({}));
    const reply = data.reply || data.message || data.text || "";
    if (!String(reply || "").trim()) {
      throw new Error("No reply returned from /api/ai/chat");
    }
    return reply;
  };

  const onFinish = async (values) => {
    setErr("");
    setAiPlan("");
    setLoading(true);

    try {
      const userPrompt = buildTripPrompt(values);

      const reply = await callAi([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      setAiPlan(reply);
    } catch (e) {
      setErr(e?.message || "Something went wrong generating your plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setErr("");
    setAiPlan("");
    setSelectedPreset(null);
    setLoading(false);
    form.resetFields();
  };

  return (
    <div className="ta-wrap">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {/* Home Button */}
        <Link to="/" className="ta-home">
          <HomeOutlined /> Home
        </Link>

        {/* Heading */}
        <Title level={3} style={{ color: "white", margin: 0 }}>
          ✨ Build Your Perfect Trip with Atlas
        </Title>

        <Text style={{ color: "rgba(255,255,255,0.85)" }}>
          Powered by <b>Atlas</b>.
        </Text>

        {/* Quick start */}
        <div className="ta-prefills ta-quickstart">
          <Text style={{ color: "rgba(255,255,255,0.7)" }}>
            Quick start <i>(optional)</i>
          </Text>

          <Space wrap>
            <Button
              className={selectedPreset === "solo" ? "active" : ""}
              onClick={() => applyPreset("solo")}
            >
              Solo Travel
            </Button>
            <Button
              className={selectedPreset === "friends" ? "active" : ""}
              onClick={() => applyPreset("friends")}
            >
              Friends Trip
            </Button>
            <Button
              className={selectedPreset === "luxury" ? "active" : ""}
              onClick={() => applyPreset("luxury")}
            >
              Luxury Escape
            </Button>
          </Space>

          <Text type="secondary" style={{ color: "rgba(255,255,255,0.6)" }}>
            Or skip this and fill in the fields below.
          </Text>
        </div>

        {/* Error */}
        {!!err && (
          <Alert
            type="error"
            showIcon
            message="Couldn’t generate your trip plan"
            description={err}
          />
        )}

        {/* Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="ta-glass"
        >
          <Form.Item
            label={<span style={{ color: "white" }}>Destination</span>}
            name="destination"
            rules={[{ required: true, message: "Enter a destination" }]}
          >
            <Input placeholder="Where do you want to go? (e.g., Tokyo)" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: "white" }}>Trip Length (days)</span>}
            name="days"
            rules={[{ required: true, message: "Enter trip length" }]}
          >
            <Input placeholder="e.g., 5" type="number" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: "white" }}>Flight Class</span>}
            name="flightClass"
          >
            <Select
              placeholder="Select flight class"
              popupClassName="ta-select-dark"
            >
              {FLIGHT_CLASSES.map((c) => (
                <Option key={c} value={c}>
                  {c}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Collapse ghost>
            <Collapse.Panel
              header={
                <span style={{ color: "rgba(255,255,255,0.85)" }}>
                  More options (budget, vibe, food, activity)
                </span>
              }
              key="more"
            >
              <Form.Item
                label={<span style={{ color: "white" }}>Food Plan</span>}
                name="foodPlan"
              >
                <Select
                  placeholder="Select food plan"
                  options={FOOD_PLAN_OPTIONS}
                  popupClassName="ta-select-dark"
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ color: "white" }}>Budget Range</span>}
                name="budget"
              >
                <Input placeholder="e.g., under $1000" />
              </Form.Item>

              <Form.Item
                label={
                  <span style={{ color: "white" }}>Preferred Activities</span>
                }
                name="activities"
              >
                <Input placeholder="e.g., hiking, museums, nightlife" />
              </Form.Item>
            </Collapse.Panel>
          </Collapse>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<RocketOutlined />}
              >
                {loading ? "Generating..." : "Generate with Atlas"}
              </Button>

              <Button onClick={handleReset}>Reset</Button>
            </Space>
          </Form.Item>
        </Form>

        {/* AI Output */}
        {!!aiPlan && (
          <Card className="ta-glass" style={{ borderRadius: 16 }}>
            <Title level={4} style={{ color: "white", marginTop: 0 }}>
              Your Atlas Trip Plan
            </Title>
            <Text
              style={{
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "pre-wrap",
              }}
            >
              {aiPlan}
            </Text>
          </Card>
        )}
      </Space>
    </div>
  );
}