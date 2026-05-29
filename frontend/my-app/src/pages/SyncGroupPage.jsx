import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Avatar,
  Spin,
  Input,
  DatePicker,
  InputNumber,
  message as antdMessage,
} from "antd";
import {
  ArrowLeftOutlined,
  SyncOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Users,
  Plane,
  Share2,
  MapPin,
  Calendar,
  DollarSign,
  Sparkles,
  Hotel,
  Car,
  Compass,
  Package,
} from "lucide-react";
import dayjs from "dayjs";
import "@/styles/SyncTogether.css";

const API_BASE = "/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getHomeAirport() {
  try {
    const data = localStorage.getItem("skyrio_home_airport");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export default function SyncGroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Planning form
  const [editing, setEditing] = useState(false);
  const [destination, setDestination] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [dateRange, setDateRange] = useState([null, null]);
  const [budget, setBudget] = useState(null);
  const [saving, setSaving] = useState(false);

  // Atlas
  const [atlasPlan, setAtlasPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [atlasMessages, setAtlasMessages] = useState([]);

  /* ── Load home airport from localStorage ── */
  useEffect(() => {
    const home = getHomeAirport();
    if (home?.code) setDepartureAirport(home.code);
  }, []);

  /* ── Fetch group ── */
  useEffect(() => {
    async function fetchGroup() {
      try {
        const res = await fetch(`${API_BASE}/sync-together/${id}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.ok) {
          setGroup(data.group);
          setDestination(data.group.destination || "");
          setBudget(data.group.members?.[0]?.budget || null);
          if (data.group.dateRangeStart && data.group.dateRangeEnd) {
            setDateRange([
              dayjs(data.group.dateRangeStart),
              dayjs(data.group.dateRangeEnd),
            ]);
          }
        } else {
          antdMessage.error(data.error || "Group not found");
        }
      } catch (err) {
        console.error("Failed to load group:", err);
        antdMessage.error("Failed to load group");
      } finally {
        setLoading(false);
      }
    }
    fetchGroup();
  }, [id]);

  /* ── Share ── */
  const shareGroup = async () => {
    const link = `${window.location.origin}/sync-together/join/${group?.inviteCode}`;
    const shareData = {
      title: `Join my trip: ${group?.title || "Untitled Trip"}`,
      text: "You're invited to plan a group trip on Skyrio!",
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== "AbortError") copyLink(link);
      }
    } else {
      copyLink(link);
    }
  };

  const copyLink = (link) => {
    const url =
      link ||
      `${window.location.origin}/sync-together/join/${group?.inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      antdMessage.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Save trip details ── */
  const saveDetails = async () => {
    setSaving(true);
    try {
      const body = { destination };
      if (dateRange[0] && dateRange[1]) {
        body.dateRangeStart = dateRange[0].toISOString();
        body.dateRangeEnd = dateRange[1].toISOString();
      }
      if (budget) body.budget = budget;

      const res = await fetch(`${API_BASE}/sync-together/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        setEditing(false);
        antdMessage.success("Trip details saved");
      } else {
        antdMessage.error(data.error || "Save failed");
      }
    } catch (err) {
      antdMessage.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ── Ask Atlas to plan ── */
  const askAtlasToPlan = async () => {
    if (!destination) {
      antdMessage.warning("Set a destination first");
      return;
    }

    setPlanLoading(true);
    setAtlasPlan("");

    const memberNames = group.members
      ?.map((m) => m.user?.name || m.name || m.email)
      .filter(Boolean)
      .join(", ");

    const travelerCount = (group.members?.length || 0) + 1; // +1 for organizer
    const tripDays =
      dateRange[0] && dateRange[1]
        ? dateRange[1].diff(dateRange[0], "day")
        : null;

    const homeAirport = departureAirport || "EWR";

    const prompt = `I'm planning a group trip to ${destination} with ${travelerCount} travelers (me + ${memberNames}).

IMPORTANT DETAILS:
- Departure airport: ${homeAirport}
- Destination: ${destination}
${tripDays ? `- Trip length: ${tripDays} days` : ""}
${
  dateRange[0]
    ? `- Travel dates: ${dateRange[0].format(
        "YYYY-MM-DD"
      )} to ${dateRange[1].format("YYYY-MM-DD")}`
    : ""
}
${budget ? `- Budget per person: $${budget}` : ""}
- Number of travelers: ${travelerCount}

Please use your tools to:
1. Search for real flights from ${homeAirport} to ${destination}${
      dateRange[0] ? ` departing ${dateRange[0].format("YYYY-MM-DD")}` : ""
    }${
      dateRange[1] ? ` returning ${dateRange[1].format("YYYY-MM-DD")}` : ""
    } for ${travelerCount} adults
2. Recommend the best flight options for the group with actual prices
3. Suggest accommodation options (hotels or rentals) for the group
4. Create a day-by-day itinerary with activities and excursions
5. Provide a budget breakdown per person
6. Share group coordination tips

Format the plan clearly with sections. Use real data from your flight search.`;

    const newMessages = [...atlasMessages, { role: "user", content: prompt }];

    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: newMessages,
          context: {
            destination,
            budget,
            tripDays,
          },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setAtlasPlan(data.reply);
        setAtlasMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        antdMessage.error(data.error || "Atlas couldn't generate a plan");
      }
    } catch (err) {
      console.error("Atlas error:", err);
      antdMessage.error("Failed to reach Atlas");
    } finally {
      setPlanLoading(false);
    }
  };

  /* ── Follow-up with Atlas ── */
  const [followUp, setFollowUp] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const askFollowUp = async () => {
    if (!followUp.trim()) return;
    setFollowUpLoading(true);

    const newMessages = [
      ...atlasMessages,
      { role: "user", content: followUp.trim() },
    ];

    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: newMessages,
          context: { destination, budget },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAtlasPlan(data.reply);
        setAtlasMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
        setFollowUp("");
      }
    } catch (err) {
      antdMessage.error("Failed to reach Atlas");
    } finally {
      setFollowUpLoading(false);
    }
  };

  /* ── Loading / not found ── */
  if (loading) {
    return (
      <section className="sk-sync-section">
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <Spin size="large" />
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 16 }}>
            Loading your group...
          </p>
        </div>
      </section>
    );
  }

  if (!group) {
    return (
      <section className="sk-sync-section">
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <h2 style={{ color: "#fff" }}>Group not found</h2>
          <Button
            className="sk-sync-cta-btn"
            onClick={() => navigate("/sync-together")}
            style={{ marginTop: 24 }}
          >
            Start a new group
          </Button>
        </div>
      </section>
    );
  }

  const statusLabel = {
    draft: "Draft",
    inviting: "Invitations Sent",
    planning: "Planning",
    booked: "Booked",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const hasTripDetails = group.destination || group.dateRangeStart;

  return (
    <section className="sk-sync-section">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/sync-together")}
        style={{ color: "#ff8a2a", marginBottom: 16, padding: 0 }}
      >
        Back to Sync Together
      </Button>

      {/* ── Group header ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div className="sk-sync-group-title" style={{ marginBottom: 4 }}>
              <Plane
                size={16}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              {group.title || "Untitled Trip"}
              {group.destination && (
                <span style={{ color: "#ff8a2a", marginLeft: 8 }}>
                  → {group.destination}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
              }}
            >
              <span
                style={{
                  background: "rgba(255,138,42,0.15)",
                  color: "#ff8a2a",
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <SyncOutlined style={{ marginRight: 4 }} />
                {statusLabel[group.status] || group.status}
              </span>
              {group.inviteCode && (
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  Code: {group.inviteCode}
                </span>
              )}
            </div>
          </div>
          <Button
            icon={copied ? <CheckCircleOutlined /> : <Share2 size={14} />}
            onClick={shareGroup}
            className="sk-sync-add-btn"
          >
            {copied ? "Copied!" : "Share with group"}
          </Button>
        </div>
      </div>

      {/* ── Travelers ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
        <div className="sk-sync-group-title">
          <Users
            size={16}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Travelers ({(group.members?.length || 0) + 1})
        </div>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {group.owner && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,138,42,0.08)",
                borderRadius: 10,
                border: "1px solid rgba(255,138,42,0.2)",
              }}
            >
              <Avatar
                size={36}
                src={
                  group.owner.avatar !== "/default-avatar.png"
                    ? group.owner.avatar
                    : undefined
                }
                style={{
                  background: "#ff8a2a",
                  color: "#1b1024",
                  fontWeight: 800,
                }}
              >
                {(group.owner.name ||
                  group.owner.username ||
                  "?")[0].toUpperCase()}
              </Avatar>
              <div>
                <div style={{ color: "#fff", fontWeight: 600 }}>
                  {group.owner.name || group.owner.username}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  Organizer
                </div>
              </div>
            </div>
          )}
          {group.members?.map((m, i) => (
            <div
              key={m._id || i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Avatar
                size={36}
                src={
                  m.user?.avatar !== "/default-avatar.png"
                    ? m.user?.avatar
                    : undefined
                }
                style={{
                  background: "#2a1f3d",
                  color: "#ff8a2a",
                  fontWeight: 800,
                }}
              >
                {(m.name || m.email || m.user?.name || "?")[0].toUpperCase()}
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 500 }}>
                  {m.user?.name || m.name || m.email}
                </div>
                {m.user?.username && (
                  <div
                    style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}
                  >
                    @{m.user.username}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background:
                    m.status === "accepted"
                      ? "rgba(82,196,26,0.15)"
                      : m.status === "declined"
                      ? "rgba(255,77,79,0.15)"
                      : "rgba(255,255,255,0.08)",
                  color:
                    m.status === "accepted"
                      ? "#52c41a"
                      : m.status === "declined"
                      ? "#ff4d4f"
                      : "rgba(255,255,255,0.45)",
                }}
              >
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trip Details ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="sk-sync-group-title">
            <MapPin
              size={16}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Trip Details
          </div>
          {!editing && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setEditing(true)}
              style={{ color: "#ff8a2a", fontSize: 13 }}
            >
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <Plane size={12} style={{ marginRight: 4 }} /> Departure Airport
              </label>
              <Input
                className="sk-sync-input"
                value={departureAirport}
                onChange={(e) =>
                  setDepartureAirport(e.target.value.toUpperCase())
                }
                placeholder="e.g. EWR, JFK, LAX"
                maxLength={4}
              />
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <MapPin size={12} style={{ marginRight: 4 }} /> Destination
              </label>
              <Input
                className="sk-sync-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City or airport code"
              />
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <Calendar size={12} style={{ marginRight: 4 }} /> Travel Dates
              </label>
              <DatePicker.RangePicker
                value={dateRange[0] ? dateRange : undefined}
                onChange={(dates) => setDateRange(dates || [null, null])}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,138,42,0.25)",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <DollarSign size={12} style={{ marginRight: 4 }} /> Budget per
                person
              </label>
              <InputNumber
                value={budget}
                onChange={setBudget}
                placeholder="e.g. 1500"
                prefix="$"
                min={0}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,138,42,0.25)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                className="sk-sync-cta-btn"
                icon={<SaveOutlined />}
                onClick={saveDetails}
                loading={saving}
              >
                Save Details
              </Button>
              <Button
                type="text"
                onClick={() => setEditing(false)}
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {hasTripDetails || departureAirport ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {departureAirport && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                    <Plane
                      size={14}
                      style={{ marginRight: 6, color: "#ff8a2a" }}
                    />
                    Departing from {departureAirport}
                  </div>
                )}
                {group.destination && (
                  <div style={{ color: "#fff", fontSize: 15 }}>
                    <MapPin
                      size={14}
                      style={{ marginRight: 6, color: "#ff8a2a" }}
                    />
                    {group.destination}
                  </div>
                )}
                {group.dateRangeStart && group.dateRangeEnd && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                    <Calendar
                      size={14}
                      style={{ marginRight: 6, color: "#ff8a2a" }}
                    />
                    {dayjs(group.dateRangeStart).format("MMM D")} —{" "}
                    {dayjs(group.dateRangeEnd).format("MMM D, YYYY")}
                  </div>
                )}
                {group.members?.[0]?.budget && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                    <DollarSign
                      size={14}
                      style={{ marginRight: 6, color: "#ff8a2a" }}
                    />
                    ${group.members[0].budget} per person
                  </div>
                )}
              </div>
            ) : (
              <p className="sk-sync-group-hint">
                No details yet — click Edit to set your trip info.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── What's Included (future APIs) ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
        <div className="sk-sync-group-title">
          <Package
            size={16}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Trip Package
        </div>
        <p className="sk-sync-group-hint" style={{ marginTop: 4 }}>
          Atlas will find the best options for your group. More services coming
          soon.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginTop: 14,
          }}
        >
          {[
            {
              icon: <Plane size={18} />,
              label: "Flights",
              status: "active",
              desc: "Search & book group flights",
            },
            {
              icon: <Hotel size={18} />,
              label: "Hotels",
              status: "coming",
              desc: "Group stays & rentals",
            },
            {
              icon: <Car size={18} />,
              label: "Car Rentals",
              status: "coming",
              desc: "Shared transport",
            },
            {
              icon: <Compass size={18} />,
              label: "Excursions",
              status: "coming",
              desc: "Activities & tours",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background:
                  item.status === "active"
                    ? "rgba(255,138,42,0.08)"
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${
                  item.status === "active"
                    ? "rgba(255,138,42,0.25)"
                    : "rgba(255,255,255,0.06)"
                }`,
                opacity: item.status === "coming" ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    color:
                      item.status === "active"
                        ? "#ff8a2a"
                        : "rgba(255,255,255,0.3)",
                  }}
                >
                  {item.icon}
                </span>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  {item.label}
                </span>
                {item.status === "coming" && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      background: "rgba(255,255,255,0.06)",
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    Soon
                  </span>
                )}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Atlas Trip Planner ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
        <div className="sk-sync-group-title">
          <Sparkles
            size={16}
            style={{
              marginRight: 8,
              verticalAlign: "middle",
              color: "#ff8a2a",
            }}
          />
          Atlas Trip Planner
        </div>
        <p className="sk-sync-group-hint" style={{ marginTop: 4 }}>
          Set your trip details above, then let Atlas search for real flights
          and build your group plan.
        </p>

        <Button
          className="sk-sync-cta-btn"
          icon={<Sparkles size={14} />}
          onClick={askAtlasToPlan}
          loading={planLoading}
          disabled={!destination}
          style={{ marginTop: 16 }}
        >
          {planLoading ? "Atlas is searching flights..." : "Ask Atlas to Plan"}
        </Button>

        {atlasPlan && (
          <>
            <div
              style={{
                marginTop: 20,
                padding: 20,
                background: "rgba(255,138,42,0.06)",
                border: "1px solid rgba(255,138,42,0.2)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Sparkles size={16} style={{ color: "#ff8a2a" }} />
                <span
                  style={{ color: "#ff8a2a", fontWeight: 700, fontSize: 14 }}
                >
                  Atlas's Plan
                </span>
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {atlasPlan}
              </div>
            </div>

            {/* Follow-up */}
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <Input
                className="sk-sync-input"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onPressEnter={askFollowUp}
                placeholder="Ask Atlas to adjust the plan..."
                style={{ flex: 1 }}
              />
              <Button
                className="sk-sync-add-btn"
                icon={<SendOutlined />}
                onClick={askFollowUp}
                loading={followUpLoading}
              >
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
