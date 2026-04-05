import { useState } from "react";
import {
  Modal,
  Steps,
  Input,
  Button,
  Avatar,
  Tag,
  Typography,
  Space,
  Divider,
  Form,
  Alert,
  Spin,
  Badge,
} from "antd";
import {
  LinkOutlined,
  TeamOutlined,
  GlobalOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleFilled,
  SendOutlined,
  UserAddOutlined,
  FireOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  CrownOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// ─── Mock trip data (replace with real API call) ─────────────────────────────
const MOCK_TRIP = {
  id: "trip_skyrio_001",
  name: "Bali Squad Retreat 🌴",
  destination: "Bali, Indonesia",
  dates: "Aug 12 – Aug 22, 2025",
  host: {
    name: "Mia Chen",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia",
  },
  members: [
    {
      name: "Mia Chen",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia",
    },
    {
      name: "Jordan K.",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
    },
    {
      name: "Alex P.",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    },
  ],
  maxMembers: 8,
  xp: 1240,
  joinType: "request", // "open" | "request" | "invite"
  coverGradient: "linear-gradient(135deg, #0f7173 0%, #272932 100%)",
  tags: ["Beach", "Adventure", "Culture"],
};

// ─── Join type config ─────────────────────────────────────────────────────────
const JOIN_METHODS = {
  invite: {
    icon: <LockOutlined />,
    label: "Invite Code",
    color: "#6c63ff",
    description: "Enter the invite code shared by a Circle member.",
  },
  request: {
    icon: <TeamOutlined />,
    label: "Request to Join",
    color: "#f7a440",
    description: "Send a request — the host will approve or decline.",
  },
  open: {
    icon: <UnlockOutlined />,
    label: "Open Join",
    color: "#52c41a",
    description: "This trip is open. Jump straight in!",
  },
};

// ─── Step 0: Trip Preview Card ────────────────────────────────────────────────
function TripPreviewCard({ trip }) {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #1f2937",
        marginBottom: 20,
      }}
    >
      {/* Cover */}
      <div
        style={{
          background: trip.coverGradient,
          height: 90,
          display: "flex",
          alignItems: "flex-end",
          padding: "12px 16px",
          position: "relative",
        }}
      >
        <div>
          <Title
            level={4}
            style={{ color: "#fff", margin: 0, lineHeight: 1.2 }}
          >
            {trip.name}
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
            <EnvironmentOutlined style={{ marginRight: 4 }} />
            {trip.destination}
          </Text>
        </div>
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(6px)",
            borderRadius: 8,
            padding: "4px 10px",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11 }}>
            <FireOutlined style={{ color: "#f7a440", marginRight: 4 }} />
            {trip.xp.toLocaleString()} XP
          </Text>
        </div>
      </div>

      {/* Meta row */}
      <div
        style={{
          background: "#111827",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <Space size={4} wrap>
          {trip.tags.map((t) => (
            <Tag
              key={t}
              style={{
                background: "#1f2937",
                border: "none",
                color: "#9ca3af",
                borderRadius: 20,
                fontSize: 11,
              }}
            >
              {t}
            </Tag>
          ))}
        </Space>
        <Text style={{ color: "#6b7280", fontSize: 12 }}>
          <CalendarOutlined style={{ marginRight: 4 }} />
          {trip.dates}
        </Text>
      </div>

      {/* Members row */}
      <div
        style={{
          background: "#0d1117",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <Avatar.Group maxCount={4} size="small">
            {trip.members.map((m) => (
              <Avatar key={m.name} src={m.avatar} size="small" />
            ))}
          </Avatar.Group>
          <Text style={{ color: "#6b7280", fontSize: 12 }}>
            {trip.members.length}/{trip.maxMembers} members
          </Text>
        </Space>
        <Space size={4}>
          <CrownOutlined style={{ color: "#f7a440", fontSize: 12 }} />
          <Text style={{ color: "#9ca3af", fontSize: 12 }}>
            {trip.host.name}
          </Text>
        </Space>
      </div>
    </div>
  );
}

// ─── Step 1: Choose Join Method ───────────────────────────────────────────────
function ChooseMethodStep({ trip, selected, onSelect }) {
  const available =
    trip.joinType === "open"
      ? ["open", "invite"]
      : trip.joinType === "request"
      ? ["request", "invite"]
      : ["invite"];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={10}>
      <Text style={{ color: "#9ca3af", fontSize: 13 }}>
        How would you like to join this Circle?
      </Text>
      {available.map((method) => {
        const cfg = JOIN_METHODS[method];
        const isSelected = selected === method;
        return (
          <div
            key={method}
            onClick={() => onSelect(method)}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: `1.5px solid ${isSelected ? cfg.color : "#1f2937"}`,
              background: isSelected ? `${cfg.color}14` : "#0d1117",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              transition: "all 0.2s",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isSelected ? cfg.color : "#1f2937",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSelected ? "#fff" : "#6b7280",
                fontSize: 16,
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              {cfg.icon}
            </div>
            <div style={{ flex: 1 }}>
              <Text
                strong
                style={{
                  color: isSelected ? "#fff" : "#d1d5db",
                  display: "block",
                }}
              >
                {cfg.label}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12 }}>
                {cfg.description}
              </Text>
            </div>
            {isSelected && (
              <CheckCircleFilled
                style={{ color: cfg.color, fontSize: 18, flexShrink: 0 }}
              />
            )}
          </div>
        );
      })}
    </Space>
  );
}

// ─── Step 2: Action Step ──────────────────────────────────────────────────────
function ActionStep({ method, loading, onSubmit }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  if (method === "open") {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Alert
          message="This trip is open to join!"
          description="You'll be added instantly as a member and gain access to the Circle."
          type="success"
          showIcon
          style={{
            background: "#052e16",
            border: "1px solid #166534",
            borderRadius: 10,
          }}
        />
        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          onClick={() => onSubmit({ type: "open" })}
          icon={<UserAddOutlined />}
          style={{
            background: "linear-gradient(135deg, #52c41a, #237804)",
            border: "none",
            height: 46,
            borderRadius: 10,
            fontWeight: 600,
          }}
        >
          Join Circle Now
        </Button>
      </Space>
    );
  }

  if (method === "invite") {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Text style={{ color: "#9ca3af", fontSize: 13 }}>
          Paste the invite code you received from a Circle member.
        </Text>
        <Input
          size="large"
          placeholder="e.g. SKY-BALI-4829"
          prefix={<LinkOutlined style={{ color: "#6b7280" }} />}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={16}
          style={{
            background: "#0d1117",
            border: "1.5px solid #1f2937",
            borderRadius: 10,
            color: "#fff",
            letterSpacing: "0.1em",
            fontFamily: "monospace",
            fontSize: 15,
          }}
        />
        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          disabled={code.length < 6}
          onClick={() => onSubmit({ type: "invite", code })}
          icon={<CheckCircleFilled />}
          style={{
            background:
              code.length >= 6
                ? "linear-gradient(135deg, #6c63ff, #4f46e5)"
                : undefined,
            border: "none",
            height: 46,
            borderRadius: 10,
            fontWeight: 600,
          }}
        >
          Verify & Join
        </Button>
      </Space>
    );
  }

  if (method === "request") {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Text style={{ color: "#9ca3af", fontSize: 13 }}>
          The host will review your request. Add a message to introduce
          yourself.
        </Text>
        <Input.TextArea
          rows={3}
          placeholder="Hey! I'm super excited to join — I've been to Bali before and love the vibe 🌴"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          showCount
          style={{
            background: "#0d1117",
            border: "1.5px solid #1f2937",
            borderRadius: 10,
            color: "#fff",
            resize: "none",
          }}
        />
        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          onClick={() => onSubmit({ type: "request", message })}
          icon={<SendOutlined />}
          style={{
            background: "linear-gradient(135deg, #f7a440, #d97706)",
            border: "none",
            height: 46,
            borderRadius: 10,
            fontWeight: 600,
          }}
        >
          Send Join Request
        </Button>
      </Space>
    );
  }

  return null;
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────
function SuccessStep({ method, trip, onClose }) {
  const messages = {
    open: {
      headline: "You're in! 🎉",
      sub: `Welcome to ${trip.name}. Start planning!`,
    },
    invite: {
      headline: "Code verified! ✈️",
      sub: `You've joined ${trip.name}.`,
    },
    request: {
      headline: "Request sent! 📬",
      sub: `${trip.host.name} will review your request. Check your notifications.`,
    },
  };
  const msg = messages[method];

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #0f7173, #272932)",
          margin: "0 auto 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
        }}
      >
        {method === "request" ? "📬" : "🎉"}
      </div>
      <Title level={4} style={{ color: "#fff", marginBottom: 8 }}>
        {msg.headline}
      </Title>
      <Paragraph style={{ color: "#9ca3af", marginBottom: 24 }}>
        {msg.sub}
      </Paragraph>
      <Avatar.Group maxCount={4} style={{ marginBottom: 20 }}>
        {trip.members.map((m) => (
          <Avatar key={m.name} src={m.avatar} />
        ))}
      </Avatar.Group>
      <Button
        type="primary"
        block
        size="large"
        onClick={onClose}
        style={{
          background: "linear-gradient(135deg, #0f7173, #0d9488)",
          border: "none",
          height: 46,
          borderRadius: 10,
          fontWeight: 600,
        }}
      >
        {method === "request" ? "Got It" : "Go to Circle"}
      </Button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function JoinTripModal({ visible, onClose, tripId, tripData }) {
  const trip = tripData || MOCK_TRIP;
  const [current, setCurrent] = useState(0);
  const [method, setMethod] = useState(
    trip.joinType === "open" ? "open" : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      // Replace with real API call:
      // await api.post(`/api/circles/${trip.id}/join`, payload);
      await new Promise((r) => setTimeout(r, 1200)); // simulate network
      if (payload.type === "invite" && payload.code !== "SKY-BALI-4829") {
        throw new Error("Invalid invite code. Please check and try again.");
      }
      setCurrent(2);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrent(0);
    setMethod(trip.joinType === "open" ? "open" : null);
    setError(null);
    onClose();
  };

  const steps = [
    { title: "Preview" },
    { title: "Join Method" },
    { title: "Done" },
  ];

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={460}
      centered
      styles={{
        content: {
          background: "#111827",
          borderRadius: 20,
          border: "1px solid #1f2937",
          padding: "28px 24px",
        },
        mask: { backdropFilter: "blur(4px)" },
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ color: "#fff", margin: 0 }}>
          <UserAddOutlined style={{ marginRight: 8, color: "#0f7173" }} />
          Join Circle
        </Title>
        <Text style={{ color: "#6b7280", fontSize: 13 }}>
          Connect with a group and start planning
        </Text>
      </div>

      {/* Step indicator */}
      {current < 2 && (
        <Steps
          current={current}
          size="small"
          style={{ marginBottom: 24 }}
          items={steps.map((s) => ({ title: s.title }))}
        />
      )}

      {/* Content */}
      {current === 0 && (
        <>
          <TripPreviewCard trip={trip} />
          <Button
            type="primary"
            block
            size="large"
            onClick={() => setCurrent(1)}
            style={{
              background: "linear-gradient(135deg, #0f7173, #0d9488)",
              border: "none",
              height: 46,
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            Continue →
          </Button>
        </>
      )}

      {current === 1 && (
        <Space direction="vertical" style={{ width: "100%" }} size={20}>
          <ChooseMethodStep
            trip={trip}
            selected={method}
            onSelect={setMethod}
          />
          {method && (
            <Divider style={{ borderColor: "#1f2937", margin: "4px 0" }} />
          )}
          {method && (
            <ActionStep
              method={method}
              loading={loading}
              onSubmit={handleSubmit}
            />
          )}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{
                background: "#1f0505",
                border: "1px solid #7f1d1d",
                borderRadius: 10,
              }}
            />
          )}
          <Button
            type="text"
            onClick={() => {
              setCurrent(0);
              setError(null);
            }}
            style={{ color: "#6b7280", width: "100%", height: 36 }}
          >
            ← Back
          </Button>
        </Space>
      )}

      {current === 2 && (
        <SuccessStep method={method} trip={trip} onClose={handleClose} />
      )}
    </Modal>
  );
}