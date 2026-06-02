import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Avatar,
  Spin,
  Input,
  InputNumber,
  message as antdMessage,
} from "antd";
import SkyrioPicker from "./booking/SkyrioPicker";
import {
  ArrowLeftOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  EditOutlined,
  SaveOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  SearchOutlined,
  LoadingOutlined,
  UserAddOutlined,
  CloseCircleOutlined,
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
  MessageSquare,
  ThumbsUp,
  Info,
  Sun,
  CloudRain,
  Clock,
  MessageCircle,
  Sunrise,
  Moon,
  History,
} from "lucide-react";
import dayjs from "dayjs";
import "@/styles/SyncTogether.css";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

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

function getCurrentUserId() {
  try {
    const data = localStorage.getItem("user");
    return data ? JSON.parse(data).id : null;
  } catch {
    return null;
  }
}

// ─── Airport Search Input ─────────────────────────────────────────────────────
function AirportSearchInput({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const searchAirports = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setShowDrop(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/airports?q=${encodeURIComponent(q.trim())}`,
        {
          headers: authHeaders(),
        }
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data.slice(0, 8) : []);
      setShowDrop(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAirports(val), 250);
  };

  const selectAirport = (airport) => {
    const code = airport.code || airport.iata || airport.iata_code || "";
    const city = airport.city || airport.municipality || "";
    const display = `${code} — ${airport.name || city}`;
    setQuery(display);
    setShowDrop(false);
    setResults([]);
    onChange(code, airport);
  };

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync external value
  useEffect(() => {
    if (value && !query) setQuery(value);
  }, [value]);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <Input
        className="sk-sync-input"
        value={query}
        onChange={handleChange}
        placeholder={placeholder || "Search airport (e.g. EWR, Newark)"}
        prefix={<SearchOutlined style={{ color: "#ff8a2a" }} />}
        suffix={
          searching ? (
            <Spin
              indicator={
                <LoadingOutlined style={{ fontSize: 14, color: "#ff8a2a" }} />
              }
            />
          ) : null
        }
      />
      {showDrop && results.length > 0 && (
        <div className="sk-sync-search-dropdown">
          {results.map((ap, i) => {
            const code = ap.code || ap.iata || ap.iata_code || "";
            const city = ap.city || ap.municipality || "";
            const country = ap.country || ap.country_name || "";
            return (
              <div
                key={`${code}-${i}`}
                className="sk-sync-search-item"
                onClick={() => selectAirport(ap)}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(255,138,42,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Plane size={16} style={{ color: "#ff8a2a" }} />
                </div>
                <div className="sk-sync-search-item-info">
                  <span className="sk-sync-search-item-name">
                    {code} — {ap.name || city}
                  </span>
                  <span className="sk-sync-search-item-handle">
                    {city}
                    {country ? `, ${country}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Atlas Plan Renderer ──────────────────────────────────────────────────────
function formatNumbers(text) {
  return text.replace(/\$(\d{4,})(\.\d+)?/g, (_, int, dec) => {
    const formatted = parseInt(int).toLocaleString("en-US");
    return `$${formatted}${dec || ""}`;
  });
}

function AtlasPlanRenderer({ plan }) {
  if (!plan) return null;

  const lines = plan.split("\n");
  const sections = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const h3Match = line.match(/^###\s+(?:\d+\.\s+)?(.+)/);
    const boldHeader = line.match(/^\*\*([^*]+)\*\*\s*:?\s*$/);

    if (h3Match || boldHeader) {
      if (current) sections.push(current);
      current = {
        title: (h3Match?.[1] || boldHeader?.[1] || "")
          .replace(/[*_]/g, "")
          .trim(),
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    } else {
      if (!sections.length) current = { title: "", lines: [line] };
    }
  }
  if (current) sections.push(current);

  const sectionIcon = (title) => {
    const t = title.toLowerCase();
    if (t.includes("flight")) return <Plane size={15} />;
    if (t.includes("hotel") || t.includes("accommodat") || t.includes("stay"))
      return <Hotel size={15} />;
    if (t.includes("itinerary") || t.includes("day"))
      return <Calendar size={15} />;
    if (t.includes("budget") || t.includes("cost") || t.includes("price"))
      return <DollarSign size={15} />;
    if (t.includes("tip") || t.includes("coord") || t.includes("group"))
      return <Users size={15} />;
    if (t.includes("excursion") || t.includes("activit") || t.includes("tour"))
      return <Compass size={15} />;
    return <Info size={15} />;
  };

  const renderLine = (rawLine, idx) => {
    const line = formatNumbers(rawLine);
    const bulletMatch = line.match(/^[-•*]\s+(.+)/);
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    const content = bulletMatch?.[1] || numberedMatch?.[1] || line;

    const parts = content.split(/\*\*(.+?)\*\*/g);
    const formatted = parts.map((p, i) =>
      i % 2 === 1 ? (
        <strong key={i} style={{ color: "#fff", fontWeight: 700 }}>
          {p}
        </strong>
      ) : (
        p
      )
    );

    if (bulletMatch || numberedMatch) {
      return (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              color: "#ff8a2a",
              marginTop: 3,
              flexShrink: 0,
              fontSize: 12,
            }}
          >
            {numberedMatch ? `${rawLine.match(/^(\d+)\./)?.[1]}.` : "•"}
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {formatted}
          </span>
        </div>
      );
    }

    return (
      <p
        key={idx}
        style={{
          color: "rgba(255,255,255,0.75)",
          fontSize: 14,
          lineHeight: 1.65,
          margin: "0 0 6px 0",
        }}
      >
        {formatted}
      </p>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginTop: 4,
      }}
    >
      {sections.map((section, si) => (
        <div
          key={si}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {section.title && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                background: "rgba(255,138,42,0.07)",
                borderBottom: "1px solid rgba(255,138,42,0.12)",
              }}
            >
              <span style={{ color: "#ff8a2a", flexShrink: 0 }}>
                {sectionIcon(section.title)}
              </span>
              <span style={{ color: "#ff8a2a", fontWeight: 700, fontSize: 13 }}>
                {section.title}
              </span>
            </div>
          )}
          <div style={{ padding: "14px 16px" }}>
            {section.lines.map((line, li) => renderLine(line, li))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SyncGroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [editing, setEditing] = useState(false);
  const [destination, setDestination] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [departureDisplay, setDepartureDisplay] = useState("");
  const [cabinClass, setCabinClass] = useState("economy");
  const [departureTime, setDepartureTime] = useState("any");
  const [dateRange, setDateRange] = useState([null, null]);
  const [budget, setBudget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [atlasPlan, setAtlasPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [atlasMessages, setAtlasMessages] = useState([]);
  const [followUp, setFollowUp] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Weather
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);

  // Member airport
  const [editingMyAirport, setEditingMyAirport] = useState(false);

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  const [changeMsg, setChangeMsg] = useState("");
  const [changeSending, setChangeSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Add/remove members
  const [addInput, setAddInput] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [showAddDrop, setShowAddDrop] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const addDebounceRef = useRef(null);
  const addWrapperRef = useRef(null);

  useEffect(() => {
    const home = getHomeAirport();
    if (home?.code) {
      setDepartureAirport(home.code);
      setDepartureDisplay(
        home.city ? `${home.code} — ${home.city}` : home.code
      );
    }
  }, []);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        setDestination(data.group.destination || "");
        if (data.group.departureAirport) {
          setDepartureAirport(data.group.departureAirport);
          if (!departureDisplay)
            setDepartureDisplay(data.group.departureAirport);
        }
        setCabinClass(data.group.cabinClass || "economy");
        setDepartureTime(data.group.departureTime || "any");
        setChatMessages(data.group.chatMessages || []);
        setBudget(data.group.members?.[0]?.budget || null);
        if (data.group.plan) {
          setAtlasPlan(data.group.plan);
          setAtlasMessages(data.group.atlasMessages || []);
        }
        if (data.group.dateRangeStart && data.group.dateRangeEnd) {
          setDateRange([
            dayjs(data.group.dateRangeStart),
            dayjs(data.group.dateRangeEnd),
          ]);
        }
      } else antdMessage.error(data.error || "Group not found");
    } catch {
      antdMessage.error("Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const isOwner =
    currentUserId &&
    group &&
    String(group.owner?._id || group.owner) === String(currentUserId);
  const myMember = group?.members?.find(
    (m) => m.user && String(m.user._id || m.user) === String(currentUserId)
  );
  const isMember = isOwner || !!myMember;
  const hasPlan = !!group?.plan;
  const isBooked = group?.status === "booked";
  const openChangeRequests =
    group?.changeRequests?.filter((cr) => cr.status === "open") || [];
  const approvedCount = group?.members?.filter((m) => m.approved).length || 0;
  const totalMembers = group?.members?.length || 0;
  const allApproved = totalMembers > 0 && approvedCount === totalMembers;
  const myApproval = myMember?.approved || false;

  const shareGroup = async () => {
    const link = `${window.location.origin}/sync-together/join/${group?.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join: ${group?.title}`, url: link });
      } catch (err) {
        if (err.name !== "AbortError") copyLink(link);
      }
    } else copyLink(link);
  };
  const copyLink = (link) => {
    navigator.clipboard.writeText(
      link ||
        `${window.location.origin}/sync-together/join/${group?.inviteCode}`
    );
    setCopied(true);
    antdMessage.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const saveDetails = async () => {
    setSaving(true);
    try {
      const body = { destination, departureAirport, cabinClass, departureTime };
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
      } else antdMessage.error(data.error || "Save failed");
    } catch {
      antdMessage.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

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
    const travelerCount = (group.members?.length || 0) + 1;
    const tripDays =
      dateRange[0] && dateRange[1]
        ? dateRange[1].diff(dateRange[0], "day")
        : null;
    const homeAirport = departureAirport || "EWR";

    const memberAirports =
      group.members
        ?.map((m) => {
          const name = m.user?.name || m.name || m.email;
          const airport = m.departureAirport || homeAirport;
          return `  - ${name}: ${airport}`;
        })
        .join("\n") || "";

    const cabinLabel =
      {
        economy: "economy",
        premium_economy: "premium economy",
        business: "business",
        first: "first class",
      }[cabinClass] || "economy";
    const timeLabel =
      {
        morning: "morning (5am-12pm)",
        afternoon: "afternoon (12pm-5pm)",
        night: "evening/night (5pm-12am)",
        any: "any time",
      }[departureTime] || "any time";

    let changeContext = "";
    if (openChangeRequests.length > 0) {
      changeContext =
        "\n\nGROUP CHANGE REQUESTS TO ADDRESS:\n" +
        openChangeRequests
          .map((cr) => `- ${cr.user?.name || "A member"}: "${cr.message}"`)
          .join("\n");
    }

    const prompt = `I'm planning a group trip to ${destination} with ${travelerCount} travelers (me + ${memberNames}).

DETAILS:
- Organizer departure: ${homeAirport}
- Destination: ${destination}
- Cabin class: ${cabinLabel}
- Preferred departure time: ${timeLabel}
- Departure airports:
  - Me (organizer): ${homeAirport}
${memberAirports}
${tripDays ? `- Trip length: ${tripDays} days` : ""}
${
  dateRange[0]
    ? `- Dates: ${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format(
        "YYYY-MM-DD"
      )}`
    : ""
}
${budget ? `- Budget per person: $${budget}` : ""}
- Travelers: ${travelerCount}
${changeContext}

IMPORTANT: Some travelers may depart from different airports — search flights per airport if they differ. Format prices with commas (e.g. $1,234.56). Use ### for sections.

Please:
1. Search for real ${cabinLabel} flights to ${destination}${
      dateRange[0] ? ` departing ${dateRange[0].format("YYYY-MM-DD")}` : ""
    }${
      dateRange[1] ? ` returning ${dateRange[1].format("YYYY-MM-DD")}` : ""
    } — prefer ${timeLabel} departures. Note flight options per departure airport if they differ.
2. Recommend the best options with actual prices
3. Suggest accommodation for the group
4. Create a day-by-day itinerary
5. Budget breakdown per person
6. Weather expectations for ${destination}
7. Group coordination tips

Format clearly with ### sections.`;

    const newMessages = [{ role: "user", content: prompt }];
    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: newMessages,
          context: { destination, budget, tripDays },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAtlasPlan(data.reply);
        const msgs = [
          ...newMessages,
          { role: "assistant", content: data.reply },
        ];
        setAtlasMessages(msgs);
        await fetch(`${API_BASE}/sync-together/${id}/plan`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ plan: data.reply, atlasMessages: msgs }),
        });
        await fetchGroup();
      } else antdMessage.error("Atlas couldn't generate a plan");
    } catch {
      antdMessage.error("Failed to reach Atlas");
    } finally {
      setPlanLoading(false);
    }
  };

  const askFollowUp = async () => {
    if (!followUp.trim()) return;
    setFollowUpLoading(true);
    const newMessages = [
      ...atlasMessages,
      {
        role: "user",
        content:
          followUp.trim() +
          "\n\nIMPORTANT: Format prices with commas (e.g. $1,234.56). Use ### for section headers.",
      },
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
        const msgs = [
          ...newMessages,
          { role: "assistant", content: data.reply },
        ];
        setAtlasMessages(msgs);
        setFollowUp("");
        await fetch(`${API_BASE}/sync-together/${id}/plan`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ plan: data.reply, atlasMessages: msgs }),
        });
        await fetchGroup();
      }
    } catch {
      antdMessage.error("Failed to reach Atlas");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const approvePlan = async () => {
    setApproving(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/approve`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        antdMessage.success(
          data.allApproved ? "Everyone approved!" : "Your approval recorded"
        );
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const submitChangeRequest = async () => {
    if (!changeMsg.trim()) return;
    setChangeSending(true);
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/${id}/change-request`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ message: changeMsg.trim() }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        setChangeMsg("");
        antdMessage.success("Change request submitted");
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Failed to submit");
    } finally {
      setChangeSending(false);
    }
  };

  const confirmTrip = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/confirm`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        antdMessage.success("Trip confirmed!");
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Confirmation failed");
    } finally {
      setConfirming(false);
    }
  };

  /* ── Search users to add ── */
  const searchUsersToAdd = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setAddResults([]);
      setShowAddDrop(false);
      return;
    }
    setAddSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/search?q=${encodeURIComponent(q.trim())}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (data.ok) {
        setAddResults(data.users || []);
        setShowAddDrop(true);
      }
    } catch {
      setAddResults([]);
    } finally {
      setAddSearching(false);
    }
  }, []);

  const handleAddInputChange = (e) => {
    const val = e.target.value;
    setAddInput(val);
    clearTimeout(addDebounceRef.current);
    addDebounceRef.current = setTimeout(() => searchUsersToAdd(val), 300);
  };

  const addMemberToGroup = async (user) => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/member`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: user._id || user.id || null,
          email: user.email || null,
          name: user.name || user.username || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        antdMessage.success(
          `${user.name || user.username || user.email} added`
        );
      } else antdMessage.error(data.error || "Failed to add");
    } catch {
      antdMessage.error("Failed to add member");
    }
    setAddInput("");
    setAddResults([]);
    setShowAddDrop(false);
  };

  const addByEmailDirect = () => {
    const val = addInput.trim();
    if (!val) return;
    if (showAddDrop && addResults.length > 0) {
      addMemberToGroup(addResults[0]);
      return;
    }
    addMemberToGroup({ email: val, name: val });
  };

  const removeMember = async (memberId, memberName) => {
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/${id}/member/${memberId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        antdMessage.success(`${memberName} removed`);
      } else antdMessage.error(data.error || "Failed to remove");
    } catch {
      antdMessage.error("Failed to remove member");
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (addWrapperRef.current && !addWrapperRef.current.contains(e.target))
        setShowAddDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Rename trip ── */
  const renameTrip = async () => {
    if (!titleInput.trim()) {
      setEditingTitle(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ title: titleInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        setEditingTitle(false);
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Failed to rename");
    }
  };

  /* ── Update my departure airport ── */
  const updateMyAirport = async (code) => {
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/${id}/member-airport`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ departureAirport: code }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        setEditingMyAirport(false);
        antdMessage.success(`Airport set to ${code}`);
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Failed to update airport");
    }
  };

  /* ── Fetch weather for destination ── */
  const fetchWeather = async (city) => {
    if (!city) return;
    setWeatherLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/weather?city=${encodeURIComponent(city)}&days=14`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (data.success) setWeather(data);
      else setWeather(null);
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Fetch weather when destination or dates change
  useEffect(() => {
    if (group?.destination) fetchWeather(group.destination);
  }, [group?.destination]);

  /* ── Send chat message ── */
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    setChatSending(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: chatInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setChatMessages((prev) => [...prev, data.message]);
        setChatInput("");
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          100
        );
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Failed to send");
    } finally {
      setChatSending(false);
    }
  };

  if (loading)
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

  if (!group)
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

  const statusConfig = {
    draft: { label: "Draft", color: "rgba(255,255,255,0.45)" },
    inviting: { label: "Invitations Sent", color: "#ff8a2a" },
    planning: { label: "Planning", color: "#ff8a2a" },
    reviewing: { label: "Reviewing Plan", color: "#1890ff" },
    confirmed: { label: "All Approved", color: "#52c41a" },
    booked: { label: "Booked", color: "#52c41a" },
    completed: { label: "Completed", color: "rgba(255,255,255,0.45)" },
    cancelled: { label: "Cancelled", color: "#ff4d4f" },
  };
  const sc = statusConfig[group.status] || statusConfig.draft;
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

      {/* ── Progress Stepper ── */}
      {(() => {
        const steps = [
          { key: "inviting", label: "Invite" },
          { key: "planning", label: "Details" },
          { key: "reviewing", label: "Plan" },
          { key: "confirmed", label: "Review" },
          { key: "booked", label: "Booked" },
        ];
        const statusOrder = [
          "draft",
          "inviting",
          "planning",
          "reviewing",
          "confirmed",
          "booked",
          "completed",
        ];
        const currentIdx = statusOrder.indexOf(group.status);
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              marginBottom: 8,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {steps.map((step, i) => {
              const stepIdx = statusOrder.indexOf(step.key);
              const isActive = currentIdx >= stepIdx;
              const isCurrent = group.status === step.key;
              return (
                <div
                  key={step.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        margin: "0 auto 4px",
                        background: isActive
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.08)",
                        border: isCurrent
                          ? "2px solid #ffb347"
                          : "2px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: isActive ? "#1b1024" : "rgba(255,255,255,0.3)",
                        transition: "all 0.3s",
                      }}
                    >
                      {isActive ? "✓" : i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: isCurrent
                          ? "#ff8a2a"
                          : isActive
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(255,255,255,0.25)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.label}
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      style={{
                        height: 2,
                        flex: 1,
                        minWidth: 12,
                        background:
                          currentIdx > stepIdx
                            ? "#ff8a2a"
                            : "rgba(255,255,255,0.08)",
                        borderRadius: 1,
                        transition: "background 0.3s",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Header ── */}
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
              <Plane size={16} style={{ marginRight: 8 }} />
              {editingTitle ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Input
                    className="sk-sync-input"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onPressEnter={renameTrip}
                    onBlur={renameTrip}
                    autoFocus
                    style={{
                      width: 200,
                      height: 32,
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  />
                </span>
              ) : (
                <span
                  onClick={() => {
                    if (!isBooked && isMember) {
                      setTitleInput(group.title || "");
                      setEditingTitle(true);
                    }
                  }}
                  style={{
                    cursor: !isBooked && isMember ? "pointer" : "default",
                  }}
                  title={!isBooked && isMember ? "Click to rename" : ""}
                >
                  {group.title || "Untitled Trip"}
                  {!isBooked && isMember && (
                    <EditOutlined
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    />
                  )}
                </span>
              )}
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
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  background: `${sc.color}20`,
                  color: sc.color,
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <SyncOutlined style={{ marginRight: 4 }} />
                {sc.label}
              </span>
              {group.planVersion > 0 && (
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  v{group.planVersion}
                </span>
              )}
              {group.inviteCode && (
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
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
            {copied ? "Copied!" : "Share"}
          </Button>
        </div>
      </div>

      {/* ── Travelers ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
        <div className="sk-sync-group-title">
          <Users size={16} style={{ marginRight: 8 }} />
          Travelers ({totalMembers + 1})
          {hasPlan && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              {approvedCount}/{totalMembers} approved
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
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
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 600 }}>
                  {group.owner.name || group.owner.username}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  Organizer
                </div>
              </div>
            </div>
          )}
          {group.members?.map((m, i) => {
            const isMyRow =
              currentUserId &&
              String(m.user?._id || m.user) === String(currentUserId);
            return (
              <div
                key={m._id || i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 10,
                  border: `1px solid ${
                    m.approved
                      ? "rgba(82,196,26,0.25)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                    {(m.name ||
                      m.email ||
                      m.user?.name ||
                      "?")[0].toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 500 }}>
                      {m.user?.name || m.name || m.email}
                    </div>
                    {m.user?.username && (
                      <div
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 12,
                        }}
                      >
                        @{m.user.username}
                      </div>
                    )}
                    {m.departureAirport && (
                      <div
                        style={{
                          color: "rgba(255,255,255,0.3)",
                          fontSize: 11,
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Plane size={10} /> Flying from {m.departureAirport}
                      </div>
                    )}
                  </div>
                  {hasPlan ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: m.approved
                          ? "rgba(82,196,26,0.15)"
                          : "rgba(255,255,255,0.08)",
                        color: m.approved
                          ? "#52c41a"
                          : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {m.approved ? (
                        <>
                          <CheckOutlined style={{ marginRight: 3 }} />
                          Approved
                        </>
                      ) : (
                        "Pending review"
                      )}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {m.status}
                    </span>
                  )}
                  {!isBooked && isMember && (
                    <button
                      onClick={() =>
                        removeMember(m._id, m.user?.name || m.name || m.email)
                      }
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        color: "rgba(255,255,255,0.2)",
                        transition: "color 0.15s",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#ff4d4f")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "rgba(255,255,255,0.2)")
                      }
                      title="Remove from trip"
                    >
                      <CloseCircleOutlined style={{ fontSize: 16 }} />
                    </button>
                  )}
                </div>
                {/* Let user set their own airport */}
                {isMyRow && !isBooked && (
                  <div style={{ marginLeft: 48 }}>
                    {!editingMyAirport && !m.departureAirport && (
                      <button
                        onClick={() => setEditingMyAirport(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ff8a2a",
                          fontSize: 12,
                          cursor: "pointer",
                          padding: 0,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Plane size={12} /> Set your departure airport
                      </button>
                    )}
                    {!editingMyAirport && m.departureAirport && (
                      <button
                        onClick={() => setEditingMyAirport(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(255,255,255,0.3)",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Change airport
                      </button>
                    )}
                    {editingMyAirport && (
                      <div style={{ maxWidth: 300 }}>
                        <AirportSearchInput
                          value={m.departureAirport || ""}
                          onChange={(code) => updateMyAirport(code)}
                          placeholder="Search your airport"
                        />
                        <button
                          onClick={() => setEditingMyAirport(false)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "rgba(255,255,255,0.3)",
                            fontSize: 11,
                            cursor: "pointer",
                            marginTop: 4,
                            padding: 0,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add member */}
        {!isBooked && isMember && (
          <div style={{ marginTop: 12 }}>
            {!showAddForm ? (
              <Button
                type="text"
                icon={<UserAddOutlined />}
                onClick={() => setShowAddForm(true)}
                style={{ color: "#ff8a2a", fontSize: 13, padding: 0 }}
              >
                Add traveler
              </Button>
            ) : (
              <div ref={addWrapperRef} style={{ position: "relative" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="sk-sync-search-wrapper">
                    <Input
                      className="sk-sync-input"
                      value={addInput}
                      onChange={handleAddInputChange}
                      onPressEnter={addByEmailDirect}
                      placeholder="Search by name, username, or email"
                      prefix={<SearchOutlined style={{ color: "#ff8a2a" }} />}
                      suffix={
                        addSearching ? (
                          <Spin
                            indicator={
                              <LoadingOutlined
                                style={{ fontSize: 14, color: "#ff8a2a" }}
                              />
                            }
                          />
                        ) : null
                      }
                      autoFocus
                    />
                    {showAddDrop && addResults.length > 0 && (
                      <div className="sk-sync-search-dropdown">
                        {addResults.map((user) => (
                          <div
                            key={user._id || user.id}
                            className="sk-sync-search-item"
                            onClick={() => addMemberToGroup(user)}
                          >
                            <Avatar
                              size={32}
                              src={
                                user.avatar &&
                                user.avatar !== "/default-avatar.png"
                                  ? user.avatar
                                  : undefined
                              }
                              style={{
                                background: "#ff8a2a",
                                color: "#1b1024",
                                fontSize: 13,
                                fontWeight: 800,
                              }}
                            >
                              {(user.name ||
                                user.username ||
                                "?")[0].toUpperCase()}
                            </Avatar>
                            <div className="sk-sync-search-item-info">
                              <span className="sk-sync-search-item-name">
                                {user.name || user.username}
                              </span>
                              <span className="sk-sync-search-item-handle">
                                @{user.username}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showAddDrop &&
                      addResults.length === 0 &&
                      !addSearching &&
                      addInput.trim().length >= 2 && (
                        <div className="sk-sync-search-dropdown">
                          <div className="sk-sync-search-empty">
                            No users found — press Enter to invite by email
                          </div>
                        </div>
                      )}
                  </div>
                  <Button
                    className="sk-sync-add-btn"
                    icon={<UserAddOutlined />}
                    onClick={addByEmailDirect}
                  >
                    Add
                  </Button>
                </div>
                <Button
                  type="text"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddInput("");
                    setAddResults([]);
                    setShowAddDrop(false);
                  }}
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    marginTop: 6,
                    padding: 0,
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
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
            <MapPin size={16} style={{ marginRight: 8 }} />
            Trip Details
          </div>
          {!editing && !isBooked && isMember && (
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
              <AirportSearchInput
                value={departureDisplay}
                onChange={(code, airport) => {
                  setDepartureAirport(code);
                  const city = airport?.city || airport?.municipality || "";
                  setDepartureDisplay(
                    city ? `${code} — ${airport.name || city}` : code
                  );
                }}
                placeholder="Search airport (e.g. EWR, Newark, JFK)"
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
              <SkyrioPicker
                value={dateRange[0] ? dateRange : [null, null]}
                onChange={(dates) => setDateRange(dates || [null, null])}
                placeholder={["Depart", "Return"]}
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
                <Plane size={12} style={{ marginRight: 4 }} /> Cabin Class
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "economy", label: "Economy" },
                  { value: "premium_economy", label: "Premium Economy" },
                  { value: "business", label: "Business" },
                  { value: "first", label: "First Class" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCabinClass(opt.value)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1px solid ${
                        cabinClass === opt.value
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.12)"
                      }`,
                      background:
                        cabinClass === opt.value
                          ? "rgba(255,138,42,0.15)"
                          : "rgba(255,255,255,0.04)",
                      color:
                        cabinClass === opt.value
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.6)",
                      fontWeight: cabinClass === opt.value ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
                <Clock size={12} style={{ marginRight: 4 }} /> Preferred
                Departure Time
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  {
                    value: "any",
                    label: "Any Time",
                    icon: <Clock size={16} />,
                  },
                  {
                    value: "morning",
                    label: "Morning",
                    sub: "5am–12pm",
                    icon: <Sunrise size={16} />,
                  },
                  {
                    value: "afternoon",
                    label: "Afternoon",
                    sub: "12–5pm",
                    icon: <Sun size={16} />,
                  },
                  {
                    value: "night",
                    label: "Night",
                    sub: "5pm–12am",
                    icon: <Moon size={16} />,
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDepartureTime(opt.value)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1px solid ${
                        departureTime === opt.value
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.12)"
                      }`,
                      background:
                        departureTime === opt.value
                          ? "rgba(255,138,42,0.15)"
                          : "rgba(255,255,255,0.04)",
                      color:
                        departureTime === opt.value
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.6)",
                      fontWeight: departureTime === opt.value ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      fontFamily: "'DM Sans', sans-serif",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {opt.icon}
                      {opt.label}
                    </span>
                    {opt.sub && (
                      <span style={{ fontSize: 10, opacity: 0.6 }}>
                        {opt.sub}
                      </span>
                    )}
                  </button>
                ))}
              </div>
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
                style={{ width: "100%" }}
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
                    Departing from {departureDisplay || departureAirport}
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
                {group.cabinClass && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                    <Plane
                      size={14}
                      style={{ marginRight: 6, color: "#ff8a2a" }}
                    />
                    {{
                      economy: "Economy",
                      premium_economy: "Premium Economy",
                      business: "Business",
                      first: "First Class",
                    }[group.cabinClass] || group.cabinClass}
                  </div>
                )}
                {group.departureTime && group.departureTime !== "any" && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Clock size={14} style={{ color: "#ff8a2a" }} />
                    {group.departureTime === "morning" && (
                      <>
                        <Sunrise size={14} style={{ color: "#ff8a2a" }} />{" "}
                        Morning (5am–12pm)
                      </>
                    )}
                    {group.departureTime === "afternoon" && (
                      <>
                        <Sun size={14} style={{ color: "#ff8a2a" }} /> Afternoon
                        (12–5pm)
                      </>
                    )}
                    {group.departureTime === "night" && (
                      <>
                        <Moon size={14} style={{ color: "#ff8a2a" }} /> Night
                        (5pm–12am)
                      </>
                    )}
                  </div>
                )}
                {group.members?.[0]?.budget && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                    <DollarSign
                      size={14}
                      style={{ marginRight: 6, color: "#ff8a2a" }}
                    />
                    ${Number(group.members[0].budget).toLocaleString("en-US")}{" "}
                    per person
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

      {/* ── Trip Package ── */}
      <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
        <div className="sk-sync-group-title">
          <Package size={16} style={{ marginRight: 8 }} />
          Trip Package
        </div>
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
          <Sparkles size={16} style={{ marginRight: 8, color: "#ff8a2a" }} />
          Atlas Trip Planner
          {group.planVersion > 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              v{group.planVersion}
            </span>
          )}
        </div>

        {!hasPlan && (
          <>
            <p className="sk-sync-group-hint" style={{ marginTop: 4 }}>
              Set your trip details, then let Atlas build the plan.
            </p>
            <Button
              className="sk-sync-cta-btn"
              icon={<Sparkles size={14} />}
              onClick={askAtlasToPlan}
              loading={planLoading}
              disabled={!destination}
              style={{ marginTop: 16 }}
            >
              {planLoading ? "Atlas is searching..." : "Ask Atlas to Plan"}
            </Button>
          </>
        )}

        {hasPlan && (
          <>
            <div
              style={{
                marginTop: 16,
                padding: 20,
                background: "rgba(255,138,42,0.04)",
                border: "1px solid rgba(255,138,42,0.15)",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <Sparkles size={16} style={{ color: "#ff8a2a" }} />
                <span
                  style={{ color: "#ff8a2a", fontWeight: 700, fontSize: 14 }}
                >
                  Atlas's Plan
                </span>
                {group.planGeneratedAt && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {dayjs(group.planGeneratedAt).format("MMM D, h:mm A")}
                  </span>
                )}
              </div>
              <AtlasPlanRenderer plan={atlasPlan} />
            </div>

            {!isBooked && isMember && (
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
            )}
            {!isBooked && isMember && (
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={askAtlasToPlan}
                loading={planLoading}
                style={{
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                Regenerate entire plan
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Review & Approve ── */}
      {hasPlan && !isBooked && isMember && (
        <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
          <div className="sk-sync-group-title">
            <ThumbsUp size={16} style={{ marginRight: 8 }} />
            Review & Approve
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                Approval progress
              </span>
              <span
                style={{
                  color: allApproved ? "#52c41a" : "#ff8a2a",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {approvedCount}/{totalMembers}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  transition: "width 0.3s",
                  width:
                    totalMembers > 0
                      ? `${(approvedCount / totalMembers) * 100}%`
                      : "0%",
                  background: allApproved
                    ? "#52c41a"
                    : "linear-gradient(90deg, #ff8a2a, #ffb347)",
                }}
              />
            </div>
          </div>

          {myMember && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              {!myApproval ? (
                <>
                  <Button
                    className="sk-sync-cta-btn"
                    icon={<CheckOutlined />}
                    onClick={approvePlan}
                    loading={approving}
                    style={{ flex: 1 }}
                  >
                    Approve Plan
                  </Button>
                  <Button
                    className="sk-sync-add-btn"
                    icon={<MessageSquare size={14} />}
                    onClick={() =>
                      document.getElementById("change-input")?.focus()
                    }
                    style={{ flex: 1 }}
                  >
                    Request Change
                  </Button>
                </>
              ) : (
                <div
                  style={{
                    color: "#52c41a",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircleOutlined /> You've approved this plan
                </div>
              )}
            </div>
          )}

          {myMember && !myApproval && (
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <Input
                id="change-input"
                className="sk-sync-input"
                value={changeMsg}
                onChange={(e) => setChangeMsg(e.target.value)}
                onPressEnter={submitChangeRequest}
                placeholder="What would you like changed?"
                style={{ flex: 1 }}
              />
              <Button
                className="sk-sync-add-btn"
                icon={<SendOutlined />}
                onClick={submitChangeRequest}
                loading={changeSending}
              >
                Submit
              </Button>
            </div>
          )}

          {openChangeRequests.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                {openChangeRequests.length} open change request
                {openChangeRequests.length !== 1 ? "s" : ""}
              </div>
              {openChangeRequests.map((cr, i) => (
                <div
                  key={cr._id || i}
                  style={{
                    padding: "10px 14px",
                    background: "rgba(255,183,71,0.06)",
                    border: "1px solid rgba(255,183,71,0.15)",
                    borderRadius: 10,
                    marginBottom: 8,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <Avatar
                    size={28}
                    style={{
                      background: "#2a1f3d",
                      color: "#ff8a2a",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {(cr.user?.name || "?")[0].toUpperCase()}
                  </Avatar>
                  <div>
                    <div
                      style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}
                    >
                      {cr.user?.name || "Member"}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {cr.message}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.25)",
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      {dayjs(cr.createdAt).format("MMM D, h:mm A")}
                    </div>
                  </div>
                </div>
              ))}
              <p className="sk-sync-group-hint" style={{ marginTop: 8 }}>
                Use the Atlas follow-up to address these, then ask members to
                re-approve.
              </p>
            </div>
          )}

          {isOwner && allApproved && openChangeRequests.length === 0 && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: "rgba(82,196,26,0.08)",
                border: "1px solid rgba(82,196,26,0.2)",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: "#52c41a",
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                <CheckCircleOutlined style={{ marginRight: 6 }} />
                Everyone has approved!
              </p>
              <Button
                className="sk-sync-cta-btn"
                icon={<LockOutlined />}
                onClick={confirmTrip}
                loading={confirming}
              >
                Confirm & Lock Trip
              </Button>
            </div>
          )}
        </div>
      )}

      {isBooked && (
        <div
          className="sk-sync-group-builder"
          style={{ marginTop: 20, textAlign: "center", padding: "32px 24px" }}
        >
          <CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />
          <h3 style={{ color: "#fff", marginTop: 16, fontSize: 20 }}>
            Trip Confirmed!
          </h3>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
            The plan is locked in. Everyone's on the same page.
          </p>
        </div>
      )}

      {/* ── Weather Forecast ── */}
      {group?.destination && (
        <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
          <div className="sk-sync-group-title">
            <Sun size={16} style={{ marginRight: 8, color: "#ff8a2a" }} />
            Weather in {group.destination}
          </div>
          {weatherLoading && (
            <p className="sk-sync-group-hint" style={{ marginTop: 8 }}>
              Loading forecast...
            </p>
          )}
          {weather && weather.forecast && (
            <div
              style={{
                marginTop: 14,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  minWidth: "fit-content",
                  paddingBottom: 8,
                }}
              >
                {weather.forecast.slice(0, 10).map((day, i) => {
                  const isRainy = day.rainChance > 50;
                  const dateObj = new Date(day.date + "T12:00:00");
                  const dayName = dateObj.toLocaleDateString("en-US", {
                    weekday: "short",
                  });
                  const monthDay = dateObj.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });

                  // Highlight days within travel range
                  const inRange =
                    dateRange[0] &&
                    dateRange[1] &&
                    dateObj >= dateRange[0].toDate() &&
                    dateObj <= dateRange[1].toDate();

                  return (
                    <div
                      key={day.date}
                      style={{
                        minWidth: 80,
                        padding: "12px 10px",
                        borderRadius: 14,
                        textAlign: "center",
                        background: inRange
                          ? "rgba(255,138,42,0.1)"
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${
                          inRange
                            ? "rgba(255,138,42,0.25)"
                            : "rgba(255,255,255,0.06)"
                        }`,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: 6,
                        }}
                      >
                        {dayName}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.3)",
                          marginBottom: 8,
                        }}
                      >
                        {monthDay}
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          marginBottom: 6,
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        {day.code <= 3 ? (
                          <Sun size={22} style={{ color: "#ffb347" }} />
                        ) : day.code <= 55 ? (
                          <CloudRain size={22} style={{ color: "#5b9cf5" }} />
                        ) : (
                          <CloudRain size={22} style={{ color: "#aaa" }} />
                        )}
                      </div>
                      <div
                        style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}
                      >
                        {day.high}°
                      </div>
                      <div
                        style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}
                      >
                        {day.low}°
                      </div>
                      {day.rainChance > 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: isRainy
                              ? "#5b9cf5"
                              : "rgba(255,255,255,0.3)",
                            marginTop: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2,
                          }}
                        >
                          <CloudRain size={10} /> {day.rainChance}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!weatherLoading && !weather && (
            <p className="sk-sync-group-hint" style={{ marginTop: 8 }}>
              Weather data unavailable for this destination.
            </p>
          )}
        </div>
      )}

      {/* ── Group Chat ── */}
      {isMember && (
        <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
          <div className="sk-sync-group-title">
            <MessageCircle size={16} style={{ marginRight: 8 }} />
            Group Chat
            {chatMessages.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {chatMessages.length} message
                {chatMessages.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Messages */}
          <div
            style={{
              marginTop: 12,
              maxHeight: 400,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overscrollBehavior: "contain",
            }}
          >
            {chatMessages.length === 0 && (
              <p className="sk-sync-group-hint">
                No messages yet. Start the conversation!
              </p>
            )}
            {chatMessages.map((msg, i) => {
              const isMe =
                currentUserId &&
                String(msg.user?._id || msg.user) === String(currentUserId);
              return (
                <div
                  key={msg._id || i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    flexDirection: isMe ? "row-reverse" : "row",
                  }}
                >
                  <Avatar
                    size={32}
                    src={
                      msg.user?.avatar &&
                      msg.user.avatar !== "/default-avatar.png"
                        ? msg.user.avatar
                        : undefined
                    }
                    style={{
                      background: isMe ? "#ff8a2a" : "#2a1f3d",
                      color: isMe ? "#1b1024" : "#ff8a2a",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {(msg.user?.name ||
                      msg.user?.username ||
                      "?")[0].toUpperCase()}
                  </Avatar>
                  <div style={{ maxWidth: "75%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 14,
                        background: isMe
                          ? "rgba(255,138,42,0.15)"
                          : "rgba(255,255,255,0.06)",
                        border: `1px solid ${
                          isMe
                            ? "rgba(255,138,42,0.25)"
                            : "rgba(255,255,255,0.08)"
                        }`,
                        borderTopRightRadius: isMe ? 4 : 14,
                        borderTopLeftRadius: isMe ? 14 : 4,
                      }}
                    >
                      {!isMe && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#ff8a2a",
                            marginBottom: 4,
                          }}
                        >
                          {msg.user?.name || msg.user?.username}
                        </div>
                      )}
                      <div
                        style={{
                          color: "rgba(255,255,255,0.85)",
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        {msg.message}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.2)",
                        marginTop: 4,
                        textAlign: isMe ? "right" : "left",
                      }}
                    >
                      {msg.createdAt
                        ? dayjs(msg.createdAt).format("h:mm A")
                        : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input
                className="sk-sync-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={sendChatMessage}
                placeholder="Type a message..."
                style={{ width: "100%" }}
              />
            </div>
            <Button
              className="sk-sync-add-btn"
              icon={<SendOutlined />}
              onClick={sendChatMessage}
              loading={chatSending}
              style={{ flexShrink: 0 }}
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {/* ── Activity Feed ── */}
      {group?.activityLog?.length > 0 && (
        <div className="sk-sync-group-builder" style={{ marginTop: 20 }}>
          <div className="sk-sync-group-title">
            <History size={16} style={{ marginRight: 8 }} />
            Activity
          </div>
          <div style={{ marginTop: 12, position: "relative", paddingLeft: 20 }}>
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: 7,
                top: 4,
                bottom: 4,
                width: 2,
                background: "rgba(255,138,42,0.15)",
                borderRadius: 1,
              }}
            />
            {[...group.activityLog]
              .reverse()
              .slice(0, 15)
              .map((entry, i) => {
                const iconMap = {
                  created: <Plane size={12} />,
                  member_added: <Users size={12} />,
                  member_removed: <Users size={12} />,
                  plan_generated: <Sparkles size={12} />,
                  plan_updated: <Sparkles size={12} />,
                  approved: <ThumbsUp size={12} />,
                  change_requested: <MessageSquare size={12} />,
                  booked: <CheckCircleOutlined style={{ fontSize: 12 }} />,
                };
                return (
                  <div
                    key={entry._id || i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      marginBottom: 14,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: "rgba(255,138,42,0.15)",
                        border: "2px solid #1e0b35",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ff8a2a",
                        position: "relative",
                        zIndex: 1,
                        marginLeft: -7,
                      }}
                    >
                      {iconMap[entry.type] || <Clock size={10} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          fontSize: 13,
                        }}
                      >
                        {entry.user?.name && (
                          <strong style={{ color: "#fff" }}>
                            {entry.user.name}{" "}
                          </strong>
                        )}
                        {entry.message}
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.2)",
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {dayjs(entry.createdAt).format("MMM D, h:mm A")}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}
