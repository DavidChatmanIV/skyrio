import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
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
  Trash2,
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
    return JSON.parse(localStorage.getItem("skyrio_home_airport"));
  } catch {
    return null;
  }
}
function getCurrentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user")).id;
  } catch {
    return null;
  }
}

/* ═══ Airport Search ═══ */
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
        { headers: authHeaders() }
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
  const selectAirport = (ap) => {
    const code = ap.code || ap.iata || ap.iata_code || "";
    setQuery(`${code} — ${ap.name || ap.city || ""}`);
    setShowDrop(false);
    setResults([]);
    onChange(code, ap);
  };
  useEffect(() => {
    const h = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (value && !query) setQuery(value);
  }, [value]);
  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <Input
        className="sk-sync-input"
        value={query}
        onChange={handleChange}
        placeholder={placeholder || "Search airport"}
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
                    {code} — {ap.name || ap.city || ""}
                  </span>
                  <span className="sk-sync-search-item-handle">
                    {ap.city || ""}
                    {ap.country ? `, ${ap.country}` : ""}
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

/* ═══ Atlas Plan Renderer ═══ */
function formatNumbers(t) {
  return t.replace(
    /\$(\d{4,})(\.\d+)?/g,
    (_, i, d) => `$${parseInt(i).toLocaleString("en-US")}${d || ""}`
  );
}
function AtlasPlanRenderer({ plan }) {
  if (!plan) return null;
  const lines = plan.split("\n"),
    sections = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const h3 = line.match(/^###\s+(?:\d+\.\s+)?(.+)/);
    const bold = line.match(/^\*\*([^*]+)\*\*\s*:?\s*$/);
    if (h3 || bold) {
      if (cur) sections.push(cur);
      cur = {
        title: (h3?.[1] || bold?.[1] || "").replace(/[*_]/g, "").trim(),
        lines: [],
      };
    } else if (cur) cur.lines.push(line);
    else if (!sections.length) cur = { title: "", lines: [line] };
  }
  if (cur) sections.push(cur);
  const icon = (t) => {
    const l = t.toLowerCase();
    if (l.includes("flight")) return <Plane size={15} />;
    if (l.includes("hotel") || l.includes("accommodat"))
      return <Hotel size={15} />;
    if (l.includes("itinerary") || l.includes("day"))
      return <Calendar size={15} />;
    if (l.includes("budget") || l.includes("cost"))
      return <DollarSign size={15} />;
    if (l.includes("tip") || l.includes("coord")) return <Users size={15} />;
    return <Info size={15} />;
  };
  const renderLine = (raw, idx) => {
    const line = formatNumbers(raw);
    const bullet = line.match(/^[-•*]\s+(.+)/);
    const num = line.match(/^\d+\.\s+(.+)/);
    const content = bullet?.[1] || num?.[1] || line;
    const parts = content.split(/\*\*(.+?)\*\*/g);
    const fmt = parts.map((p, i) =>
      i % 2 === 1 ? (
        <strong key={i} style={{ color: "#fff" }}>
          {p}
        </strong>
      ) : (
        p
      )
    );
    if (bullet || num)
      return (
        <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <span
            style={{
              color: "#ff8a2a",
              marginTop: 3,
              flexShrink: 0,
              fontSize: 12,
            }}
          >
            {num ? `${raw.match(/^(\d+)\./)?.[1]}.` : "•"}
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {fmt}
          </span>
        </div>
      );
    return (
      <p
        key={idx}
        style={{
          color: "rgba(255,255,255,0.75)",
          fontSize: 14,
          lineHeight: 1.65,
          margin: "0 0 6px",
        }}
      >
        {fmt}
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
      {sections.map((s, i) => (
        <div
          key={i}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {s.title && (
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
                {icon(s.title)}
              </span>
              <span style={{ color: "#ff8a2a", fontWeight: 700, fontSize: 13 }}>
                {s.title}
              </span>
            </div>
          )}
          <div style={{ padding: "14px 16px" }}>
            {s.lines.map((l, li) => renderLine(l, li))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ SECTION WRAPPER — consistent card style ═══ */
const Section = ({ children, mt = 20 }) => (
  <div
    style={{
      marginTop: mt,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "20px 18px",
      backdropFilter: "blur(8px)",
    }}
  >
    {children}
  </div>
);
const SectionTitle = ({ icon, children, right }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 15,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {icon}
      {children}
    </div>
    {right}
  </div>
);

/* ═══ MAIN COMPONENT ═══ */
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
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);
  const [editingMyAirport, setEditingMyAirport] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");
  const [changeSending, setChangeSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [showAddDrop, setShowAddDrop] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const addDebounceRef = useRef(null);
  const addWrapperRef = useRef(null);

  useEffect(() => {
    const h = getHomeAirport();
    if (h?.code) {
      setDepartureAirport(h.code);
      setDepartureDisplay(h.city ? `${h.code} — ${h.city}` : h.code);
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
        if (data.group.dateRangeStart && data.group.dateRangeEnd)
          setDateRange([
            dayjs(data.group.dateRangeStart),
            dayjs(data.group.dateRangeEnd),
          ]);
      } else antdMessage.error(data.error || "Group not found");
    } catch (err) {
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
  const openCRs =
    group?.changeRequests?.filter((cr) => cr.status === "open") || [];
  const approvedCount = group?.members?.filter((m) => m.approved).length || 0;
  const totalMembers = group?.members?.length || 0;
  const allApproved = totalMembers > 0 && approvedCount === totalMembers;
  const myApproval = myMember?.approved || false;

  /* ── Actions ── */
  const shareGroup = async () => {
    const link = `${window.location.origin}/sync-together/join/${group?.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join: ${group?.title}`, url: link });
      } catch (e) {
        if (e.name !== "AbortError") copyLink(link);
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
      } else antdMessage.error(data.error);
    } catch (err) {
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
    const names = group.members
      ?.map((m) => m.user?.name || m.name || m.email)
      .filter(Boolean)
      .join(", ");
    const count = (group.members?.length || 0) + 1;
    const days =
      dateRange[0] && dateRange[1]
        ? dateRange[1].diff(dateRange[0], "day")
        : null;
    const home = departureAirport || "EWR";
    const airports =
      group.members
        ?.map(
          (m) =>
            `  - ${m.user?.name || m.name || m.email}: ${
              m.departureAirport || home
            }`
        )
        .join("\n") || "";
    const cabin =
      {
        economy: "economy",
        premium_economy: "premium economy",
        business: "business",
        first: "first class",
      }[cabinClass] || "economy";
    const time =
      {
        morning: "morning (5am-12pm)",
        afternoon: "afternoon (12pm-5pm)",
        night: "evening/night (5pm-12am)",
        any: "any time",
      }[departureTime] || "any time";
    let crCtx = "";
    if (openCRs.length > 0)
      crCtx =
        "\n\nCHANGE REQUESTS:\n" +
        openCRs
          .map((cr) => `- ${cr.user?.name || "Member"}: "${cr.message}"`)
          .join("\n");
    const prompt = `Plan a group trip to ${destination} with ${count} travelers (me + ${names}).\n\nDETAILS:\n- Organizer: ${home}\n- Destination: ${destination}\n- Cabin: ${cabin}\n- Time: ${time}\n- Airports:\n  - Me: ${home}\n${airports}\n${
      days ? `- ${days} days` : ""
    }${
      dateRange[0]
        ? `\n- ${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format(
            "YYYY-MM-DD"
          )}`
        : ""
    }${
      budget ? `\n- Budget: $${budget}/person` : ""
    }\n- ${count} travelers${crCtx}\n\nSearch different airports if they differ. Use commas in prices. Use ### headers.\n\n1. Real ${cabin} flights — prefer ${time}\n2. Best options with prices\n3. Accommodation\n4. Day-by-day itinerary\n5. Budget breakdown\n6. Weather\n7. Group tips`;
    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: { destination, budget, tripDays: days },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAtlasPlan(data.reply);
        const msgs = [
          { role: "user", content: prompt },
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
    } catch (err) {
      antdMessage.error("Failed to reach Atlas");
    } finally {
      setPlanLoading(false);
    }
  };

  const askFollowUp = async () => {
    if (!followUp.trim()) return;
    setFollowUpLoading(true);
    const msgs = [
      ...atlasMessages,
      {
        role: "user",
        content:
          followUp.trim() + "\n\nFormat prices with commas. Use ### headers.",
      },
    ];
    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: msgs,
          context: { destination, budget },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAtlasPlan(data.reply);
        const all = [...msgs, { role: "assistant", content: data.reply }];
        setAtlasMessages(all);
        setFollowUp("");
        await fetch(`${API_BASE}/sync-together/${id}/plan`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ plan: data.reply, atlasMessages: all }),
        });
        await fetchGroup();
      }
    } catch (err) {
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
          data.allApproved ? "Everyone approved!" : "Approval recorded"
        );
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Approval failed");
    } finally {
      setApproving(false);
    }
  };
  const submitCR = async () => {
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
    } catch (err) {
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
    } catch (err) {
      antdMessage.error("Confirmation failed");
    } finally {
      setConfirming(false);
    }
  };
  const deleteGroup = async () => {
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        antdMessage.success("Trip deleted");
        navigate("/sync-together");
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Failed to delete");
    }
  };
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
    } catch (err) {
      antdMessage.error("Failed to rename");
    }
  };
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
    } catch (err) {
      antdMessage.error("Failed to update airport");
    }
  };

  /* ── Member management ── */
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
    } catch (err) {
      setAddResults([]);
    } finally {
      setAddSearching(false);
    }
  }, []);
  const handleAddInputChange = (e) => {
    setAddInput(e.target.value);
    clearTimeout(addDebounceRef.current);
    addDebounceRef.current = setTimeout(
      () => searchUsersToAdd(e.target.value),
      300
    );
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
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Failed to add");
    }
    setAddInput("");
    setAddResults([]);
    setShowAddDrop(false);
  };
  const addByEmail = () => {
    const v = addInput.trim();
    if (!v) return;
    if (showAddDrop && addResults.length > 0) {
      addMemberToGroup(addResults[0]);
      return;
    }
    addMemberToGroup({ email: v, name: v });
  };
  const removeMember = async (mid, name) => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/member/${mid}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        antdMessage.success(`${name} removed`);
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Failed to remove");
    }
  };
  useEffect(() => {
    const h = (e) => {
      if (addWrapperRef.current && !addWrapperRef.current.contains(e.target))
        setShowAddDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── Weather & Chat ── */
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
    } catch (err) {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };
  useEffect(() => {
    if (group?.destination) fetchWeather(group.destination);
  }, [group?.destination]);
  const sendChat = async () => {
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
        setChatMessages((p) => [...p, data.message]);
        setChatInput("");
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          100
        );
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Failed to send");
    } finally {
      setChatSending(false);
    }
  };

  /* ── Loading / Not Found ── */
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

  const sc = {
    draft: { l: "Draft", c: "rgba(255,255,255,0.45)" },
    inviting: { l: "Invitations Sent", c: "#ff8a2a" },
    planning: { l: "Planning", c: "#ff8a2a" },
    reviewing: { l: "Reviewing Plan", c: "#1890ff" },
    confirmed: { l: "All Approved", c: "#52c41a" },
    booked: { l: "Booked", c: "#52c41a" },
    cancelled: { l: "Cancelled", c: "#ff4d4f" },
  }[group.status] || { l: "Draft", c: "rgba(255,255,255,0.45)" };

  return (
    <section className="sk-sync-section">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/sync-together")}
        style={{ color: "#ff8a2a", marginBottom: 12, padding: 0 }}
      >
        Back to Sync Together
      </Button>

      {/* ═══ PROGRESS STEPPER ═══ */}
      {(() => {
        const steps = [
          { k: "inviting", l: "Invite" },
          { k: "planning", l: "Details" },
          { k: "reviewing", l: "Plan" },
          { k: "confirmed", l: "Review" },
          { k: "booked", l: "Booked" },
        ];
        const order = [
          "draft",
          "inviting",
          "planning",
          "reviewing",
          "confirmed",
          "booked",
          "completed",
        ];
        const ci = order.indexOf(group.status);
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 12,
              padding: "12px 0",
            }}
          >
            {steps.map((s, i) => {
              const si = order.indexOf(s.k);
              const active = ci >= si;
              const curr = group.status === s.k;
              return (
                <div
                  key={s.k}
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
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        margin: "0 auto 4px",
                        background: active
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.06)",
                        border: curr
                          ? "2px solid #ffb347"
                          : "2px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? "#1b1024" : "rgba(255,255,255,0.25)",
                        transition: "all 0.3s",
                      }}
                    >
                      {active ? "✓" : i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: curr
                          ? "#ff8a2a"
                          : active
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(255,255,255,0.2)",
                      }}
                    >
                      {s.l}
                    </div>
                  </div>
                  {i < 4 && (
                    <div
                      style={{
                        height: 2,
                        flex: 1,
                        minWidth: 10,
                        background:
                          ci > si ? "#ff8a2a" : "rgba(255,255,255,0.06)",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ═══ HEADER ═══ */}
      <Section mt={0}>
        <div
          className="sk-sync-header-row"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 6,
              }}
            >
              <Plane size={18} style={{ color: "#ff8a2a", flexShrink: 0 }} />
              {editingTitle ? (
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
                >
                  {group.title || "Untitled Trip"}
                  {!isBooked && isMember && (
                    <EditOutlined
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: "rgba(255,255,255,0.25)",
                      }}
                    />
                  )}
                </span>
              )}
              {group.destination && (
                <span
                  style={{ color: "#ff8a2a", fontSize: 14, fontWeight: 600 }}
                >
                  → {group.destination}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  background: `${sc.c}18`,
                  color: sc.c,
                  padding: "3px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <SyncOutlined style={{ marginRight: 4 }} />
                {sc.l}
              </span>
              {group.planVersion > 0 && (
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                  v{group.planVersion}
                </span>
              )}
              {group.inviteCode && (
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                  Code: {group.inviteCode}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              icon={copied ? <CheckCircleOutlined /> : <Share2 size={14} />}
              onClick={shareGroup}
              className="sk-sync-add-btn"
            >
              {copied ? "Copied!" : "Share"}
            </Button>
            {isOwner && !isBooked && (
              <Button
                icon={<Trash2 size={14} />}
                onClick={() => setShowDeleteConfirm(true)}
                className="sk-sync-add-btn"
                style={{
                  color: "#ff4d4f",
                  borderColor: "rgba(255,77,79,0.25)",
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* ═══ TRAVELERS ═══ */}
      <Section>
        <SectionTitle
          icon={<Users size={16} style={{ color: "#ff8a2a" }} />}
          right={
            hasPlan && (
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                {approvedCount}/{totalMembers} approved
              </span>
            )
          }
        >
          Travelers ({totalMembers + 1})
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {group.owner && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,138,42,0.06)",
                borderRadius: 12,
                border: "1px solid rgba(255,138,42,0.15)",
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
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
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
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 12,
                  border: `1px solid ${
                    m.approved
                      ? "rgba(82,196,26,0.2)"
                      : "rgba(255,255,255,0.06)"
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#fff", fontWeight: 500 }}>
                      {m.user?.name || m.name || m.email}
                    </div>
                    {m.user?.username && (
                      <div
                        style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}
                      >
                        @{m.user.username}
                      </div>
                    )}
                    {m.departureAirport && (
                      <div
                        style={{
                          color: "rgba(255,255,255,0.25)",
                          fontSize: 11,
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Plane size={10} /> {m.departureAirport}
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
                          ? "rgba(82,196,26,0.12)"
                          : "rgba(255,255,255,0.05)",
                        color: m.approved
                          ? "#52c41a"
                          : "rgba(255,255,255,0.35)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.approved ? (
                        <>
                          <CheckOutlined style={{ marginRight: 3 }} />
                          Approved
                        </>
                      ) : (
                        "Pending"
                      )}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.35)",
                        whiteSpace: "nowrap",
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
                        color: "rgba(255,255,255,0.15)",
                        display: "flex",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#ff4d4f")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "rgba(255,255,255,0.15)")
                      }
                    >
                      <CloseCircleOutlined style={{ fontSize: 14 }} />
                    </button>
                  )}
                </div>
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
                          color: "rgba(255,255,255,0.25)",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
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
                            color: "rgba(255,255,255,0.25)",
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
                      onPressEnter={addByEmail}
                      placeholder="Search name, username, or email"
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
                        {addResults.map((u) => (
                          <div
                            key={u._id || u.id}
                            className="sk-sync-search-item"
                            onClick={() => addMemberToGroup(u)}
                          >
                            <Avatar
                              size={32}
                              src={
                                u.avatar && u.avatar !== "/default-avatar.png"
                                  ? u.avatar
                                  : undefined
                              }
                              style={{
                                background: "#ff8a2a",
                                color: "#1b1024",
                                fontWeight: 800,
                              }}
                            >
                              {(u.name || u.username || "?")[0].toUpperCase()}
                            </Avatar>
                            <div className="sk-sync-search-item-info">
                              <span className="sk-sync-search-item-name">
                                {u.name || u.username}
                              </span>
                              <span className="sk-sync-search-item-handle">
                                @{u.username}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showAddDrop &&
                      !addResults.length &&
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
                    onClick={addByEmail}
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
                    color: "rgba(255,255,255,0.3)",
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
      </Section>

      {/* ═══ TRIP DETAILS ═══ */}
      <Section>
        <SectionTitle
          icon={<MapPin size={16} style={{ color: "#ff8a2a" }} />}
          right={
            !editing &&
            !isBooked &&
            isMember && (
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => setEditing(true)}
                style={{ color: "#ff8a2a", fontSize: 13, padding: 0 }}
              >
                Edit
              </Button>
            )
          }
        >
          Trip Details
        </SectionTitle>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <Plane size={12} style={{ marginRight: 4 }} /> Departure Airport
              </label>
              <AirportSearchInput
                value={departureDisplay}
                onChange={(code, ap) => {
                  setDepartureAirport(code);
                  setDepartureDisplay(
                    ap?.city ? `${code} — ${ap.name || ap.city}` : code
                  );
                }}
                placeholder="Search airport"
              />
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.4)",
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
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <Calendar size={12} style={{ marginRight: 4 }} /> Travel Dates
              </label>
              <SkyrioPicker
                value={dateRange[0] ? dateRange : [null, null]}
                onChange={(d) => setDateRange(d || [null, null])}
                placeholder={["Depart", "Return"]}
              />
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <Plane size={12} style={{ marginRight: 4 }} /> Cabin Class
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { v: "economy", l: "Economy" },
                  { v: "premium_economy", l: "Premium Economy" },
                  { v: "business", l: "Business" },
                  { v: "first", l: "First Class" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setCabinClass(o.v)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1px solid ${
                        cabinClass === o.v
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.08)"
                      }`,
                      background:
                        cabinClass === o.v
                          ? "rgba(255,138,42,0.12)"
                          : "transparent",
                      color:
                        cabinClass === o.v
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.5)",
                      fontWeight: cabinClass === o.v ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "block",
                }}
              >
                <Clock size={12} style={{ marginRight: 4 }} /> Departure Time
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { v: "any", l: "Any", i: <Clock size={14} /> },
                  {
                    v: "morning",
                    l: "Morning",
                    s: "5am–12pm",
                    i: <Sunrise size={14} />,
                  },
                  {
                    v: "afternoon",
                    l: "Afternoon",
                    s: "12–5pm",
                    i: <Sun size={14} />,
                  },
                  {
                    v: "night",
                    l: "Night",
                    s: "5pm–12am",
                    i: <Moon size={14} />,
                  },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setDepartureTime(o.v)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: `1px solid ${
                        departureTime === o.v
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.08)"
                      }`,
                      background:
                        departureTime === o.v
                          ? "rgba(255,138,42,0.12)"
                          : "transparent",
                      color:
                        departureTime === o.v
                          ? "#ff8a2a"
                          : "rgba(255,255,255,0.5)",
                      fontWeight: departureTime === o.v ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      {o.i}
                      {o.l}
                    </span>
                    {o.s && (
                      <span style={{ fontSize: 10, opacity: 0.5 }}>{o.s}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                style={{
                  color: "rgba(255,255,255,0.4)",
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
                Save
              </Button>
              <Button
                type="text"
                onClick={() => setEditing(false)}
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {group.destination || group.dateRangeStart || departureAirport ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {departureAirport && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plane size={14} style={{ color: "#ff8a2a" }} />{" "}
                    {departureDisplay || departureAirport}
                  </div>
                )}
                {group.destination && (
                  <div
                    style={{
                      color: "#fff",
                      fontSize: 15,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MapPin size={14} style={{ color: "#ff8a2a" }} />{" "}
                    {group.destination}
                  </div>
                )}
                {group.dateRangeStart && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Calendar size={14} style={{ color: "#ff8a2a" }} />{" "}
                    {dayjs(group.dateRangeStart).format("MMM D")} —{" "}
                    {dayjs(group.dateRangeEnd).format("MMM D, YYYY")}
                  </div>
                )}
                {group.cabinClass && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plane size={14} style={{ color: "#ff8a2a" }} />{" "}
                    {
                      {
                        economy: "Economy",
                        premium_economy: "Premium Economy",
                        business: "Business",
                        first: "First Class",
                      }[group.cabinClass]
                    }
                  </div>
                )}
                {group.departureTime && group.departureTime !== "any" && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Clock size={14} style={{ color: "#ff8a2a" }} />
                    {group.departureTime === "morning" && (
                      <>
                        <Sunrise size={14} /> Morning
                      </>
                    )}
                    {group.departureTime === "afternoon" && (
                      <>
                        <Sun size={14} /> Afternoon
                      </>
                    )}
                    {group.departureTime === "night" && (
                      <>
                        <Moon size={14} /> Night
                      </>
                    )}
                  </div>
                )}
                {group.members?.[0]?.budget && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <DollarSign size={14} style={{ color: "#ff8a2a" }} /> $
                    {Number(group.members[0].budget).toLocaleString("en-US")}
                    /person
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                No details yet — tap Edit to set your trip info.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ═══ TRIP PACKAGE ═══ */}
      <Section>
        <SectionTitle icon={<Package size={16} style={{ color: "#ff8a2a" }} />}>
          Trip Package
        </SectionTitle>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {[
            {
              i: <Plane size={16} />,
              l: "Flights",
              a: true,
              d: "Search & book",
            },
            { i: <Hotel size={16} />, l: "Hotels", d: "Group stays" },
            { i: <Car size={16} />, l: "Car Rentals", d: "Shared transport" },
            { i: <Compass size={16} />, l: "Excursions", d: "Activities" },
          ].map((x) => (
            <div
              key={x.l}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: x.a ? "rgba(255,138,42,0.06)" : "transparent",
                border: `1px solid ${
                  x.a ? "rgba(255,138,42,0.15)" : "rgba(255,255,255,0.05)"
                }`,
                opacity: x.a ? 1 : 0.45,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{ color: x.a ? "#ff8a2a" : "rgba(255,255,255,0.3)" }}
                >
                  {x.i}
                </span>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>
                  {x.l}
                </span>
                {!x.a && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.25)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "1px 6px",
                      borderRadius: 8,
                    }}
                  >
                    Soon
                  </span>
                )}
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                {x.d}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ ATLAS ═══ */}
      <Section>
        <SectionTitle
          icon={<Sparkles size={16} style={{ color: "#ff8a2a" }} />}
          right={
            group.planVersion > 0 && (
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                v{group.planVersion}
              </span>
            )
          }
        >
          Atlas Trip Planner
        </SectionTitle>
        {!hasPlan && (
          <>
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Set your trip details, then let Atlas build the plan.
            </p>
            <Button
              className="sk-sync-cta-btn"
              icon={<Sparkles size={14} />}
              onClick={askAtlasToPlan}
              loading={planLoading}
              disabled={!destination}
            >
              {planLoading ? "Atlas is searching..." : "Ask Atlas to Plan"}
            </Button>
          </>
        )}
        {hasPlan && (
          <>
            <div
              style={{
                padding: 18,
                background: "rgba(255,138,42,0.03)",
                border: "1px solid rgba(255,138,42,0.1)",
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
                      color: "rgba(255,255,255,0.25)",
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
                  placeholder="Ask Atlas to adjust..."
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
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                Regenerate plan
              </Button>
            )}
          </>
        )}
      </Section>

      {/* ═══ REVIEW & APPROVE ═══ */}
      {hasPlan && !isBooked && isMember && (
        <Section>
          <SectionTitle
            icon={<ThumbsUp size={16} style={{ color: "#ff8a2a" }} />}
          >
            Review & Approve
          </SectionTitle>
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                Progress
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
                height: 5,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  width:
                    totalMembers > 0
                      ? `${(approvedCount / totalMembers) * 100}%`
                      : "0%",
                  background: allApproved
                    ? "#52c41a"
                    : "linear-gradient(90deg, #ff8a2a, #ffb347)",
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
          {myMember && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!myApproval ? (
                <>
                  <Button
                    className="sk-sync-cta-btn"
                    icon={<CheckOutlined />}
                    onClick={approvePlan}
                    loading={approving}
                    style={{ flex: 1 }}
                  >
                    Approve
                  </Button>
                  <Button
                    className="sk-sync-add-btn"
                    icon={<MessageSquare size={14} />}
                    onClick={() => document.getElementById("cr-input")?.focus()}
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
                  <CheckCircleOutlined /> Approved
                </div>
              )}
            </div>
          )}
          {myMember && !myApproval && (
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <Input
                id="cr-input"
                className="sk-sync-input"
                value={changeMsg}
                onChange={(e) => setChangeMsg(e.target.value)}
                onPressEnter={submitCR}
                placeholder="What should change?"
                style={{ flex: 1 }}
              />
              <Button
                className="sk-sync-add-btn"
                icon={<SendOutlined />}
                onClick={submitCR}
                loading={changeSending}
              >
                Submit
              </Button>
            </div>
          )}
          {openCRs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                {openCRs.length} open request{openCRs.length !== 1 ? "s" : ""}
              </div>
              {openCRs.map((cr, i) => (
                <div
                  key={cr._id || i}
                  style={{
                    padding: "10px 14px",
                    background: "rgba(255,183,71,0.04)",
                    border: "1px solid rgba(255,183,71,0.1)",
                    borderRadius: 10,
                    marginBottom: 8,
                    display: "flex",
                    gap: 10,
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
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {cr.message}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.2)",
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      {dayjs(cr.createdAt).format("MMM D, h:mm A")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isOwner && allApproved && !openCRs.length && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: "rgba(82,196,26,0.06)",
                border: "1px solid rgba(82,196,26,0.15)",
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
                Everyone approved!
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
        </Section>
      )}

      {isBooked && (
        <Section>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />
            <h3 style={{ color: "#fff", marginTop: 16, fontSize: 20 }}>
              Trip Confirmed!
            </h3>
            <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
              The plan is locked in.
            </p>
          </div>
        </Section>
      )}

      {/* ═══ WEATHER ═══ */}
      {group?.destination && (
        <Section>
          <SectionTitle icon={<Sun size={16} style={{ color: "#ff8a2a" }} />}>
            Weather in {group.destination}
          </SectionTitle>
          {weatherLoading && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
              Loading forecast...
            </p>
          )}
          {weather?.forecast && (
            <div
              style={{
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                margin: "0 -4px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  minWidth: "fit-content",
                  padding: "0 4px 8px",
                }}
              >
                {weather.forecast.slice(0, 10).map((d) => {
                  const rainy = d.rainChance > 50;
                  const dt = new Date(d.date + "T12:00:00");
                  const inR =
                    dateRange[0] &&
                    dateRange[1] &&
                    dt >= dateRange[0].toDate() &&
                    dt <= dateRange[1].toDate();
                  return (
                    <div
                      key={d.date}
                      style={{
                        minWidth: 72,
                        padding: "10px 8px",
                        borderRadius: 12,
                        textAlign: "center",
                        background: inR
                          ? "rgba(255,138,42,0.08)"
                          : "transparent",
                        border: `1px solid ${
                          inR
                            ? "rgba(255,138,42,0.2)"
                            : "rgba(255,255,255,0.04)"
                        }`,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.45)",
                          marginBottom: 4,
                        }}
                      >
                        {dt.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.25)",
                          marginBottom: 6,
                        }}
                      >
                        {dt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div
                        style={{
                          marginBottom: 4,
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        {d.code <= 3 ? (
                          <Sun size={20} style={{ color: "#ffb347" }} />
                        ) : (
                          <CloudRain
                            size={20}
                            style={{ color: d.code <= 55 ? "#5b9cf5" : "#888" }}
                          />
                        )}
                      </div>
                      <div
                        style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}
                      >
                        {d.high}°
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.35)",
                        }}
                      >
                        {d.low}°
                      </div>
                      {d.rainChance > 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: rainy ? "#5b9cf5" : "rgba(255,255,255,0.25)",
                            marginTop: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2,
                          }}
                        >
                          <CloudRain size={9} /> {d.rainChance}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!weatherLoading && !weather && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
              Weather unavailable.
            </p>
          )}
        </Section>
      )}

      {/* ═══ GROUP CHAT ═══ */}
      {isMember && (
        <Section>
          <SectionTitle
            icon={<MessageCircle size={16} style={{ color: "#ff8a2a" }} />}
            right={
              chatMessages.length > 0 && (
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                  {chatMessages.length}
                </span>
              )
            }
          >
            Group Chat
          </SectionTitle>
          <div
            style={{
              maxHeight: 360,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overscrollBehavior: "contain",
            }}
          >
            {!chatMessages.length && (
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                No messages yet. Start the conversation!
              </p>
            )}
            {chatMessages.map((msg, i) => {
              const me =
                currentUserId &&
                String(msg.user?._id || msg.user) === String(currentUserId);
              return (
                <div
                  key={msg._id || i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    flexDirection: me ? "row-reverse" : "row",
                  }}
                >
                  <Avatar
                    size={30}
                    src={
                      msg.user?.avatar &&
                      msg.user.avatar !== "/default-avatar.png"
                        ? msg.user.avatar
                        : undefined
                    }
                    style={{
                      background: me ? "#ff8a2a" : "#2a1f3d",
                      color: me ? "#1b1024" : "#ff8a2a",
                      fontWeight: 800,
                      flexShrink: 0,
                      fontSize: 12,
                    }}
                  >
                    {(msg.user?.name ||
                      msg.user?.username ||
                      "?")[0].toUpperCase()}
                  </Avatar>
                  <div style={{ maxWidth: "75%" }}>
                    <div
                      style={{
                        padding: "9px 13px",
                        borderRadius: 14,
                        background: me
                          ? "rgba(255,138,42,0.12)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${
                          me ? "rgba(255,138,42,0.2)" : "rgba(255,255,255,0.06)"
                        }`,
                        borderTopRightRadius: me ? 4 : 14,
                        borderTopLeftRadius: me ? 14 : 4,
                      }}
                    >
                      {!me && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#ff8a2a",
                            marginBottom: 3,
                          }}
                        >
                          {msg.user?.name || msg.user?.username}
                        </div>
                      )}
                      <div
                        style={{
                          color: "rgba(255,255,255,0.8)",
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
                        color: "rgba(255,255,255,0.18)",
                        marginTop: 3,
                        textAlign: me ? "right" : "left",
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
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChat();
              }}
              placeholder="Type a message..."
              style={{
                flex: 1,
                minWidth: 0,
                width: "200%",
                height: window.innerWidth <= 600 ? 48 : 40,
                padding: "0 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.9)",
                fontSize: 16,
                fontFamily: "inherit",
                outline: "none",
                WebkitAppearance: "none",
              }}
            />
            <Button
              className="group-chat-input-row"
              icon={<SendOutlined />}
              onClick={sendChat}
              loading={chatSending}
              style={{ flexShrink: 0 }}
            >
              Send
            </Button>
          </div>
        </Section>
      )}

      {/* ═══ ACTIVITY FEED ═══ */}
      {group?.activityLog?.length > 0 && (
        <Section>
          <SectionTitle
            icon={<History size={16} style={{ color: "#ff8a2a" }} />}
          >
            Activity
          </SectionTitle>
          <div style={{ position: "relative", paddingLeft: 20 }}>
            <div
              style={{
                position: "absolute",
                left: 7,
                top: 4,
                bottom: 4,
                width: 2,
                background: "rgba(255,138,42,0.1)",
                borderRadius: 1,
              }}
            />
            {[...group.activityLog]
              .reverse()
              .slice(0, 15)
              .map((e, i) => {
                const icons = {
                  created: <Plane size={10} />,
                  member_added: <Users size={10} />,
                  member_removed: <Users size={10} />,
                  plan_generated: <Sparkles size={10} />,
                  plan_updated: <Sparkles size={10} />,
                  approved: <ThumbsUp size={10} />,
                  change_requested: <MessageSquare size={10} />,
                  booked: <CheckCircleOutlined style={{ fontSize: 10 }} />,
                };
                return (
                  <div
                    key={e._id || i}
                    style={{
                      display: "flex",
                      gap: 12,
                      marginBottom: 12,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: "rgba(255,138,42,0.12)",
                        border: "2px solid #1e0b35",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ff8a2a",
                        zIndex: 1,
                        marginLeft: -7,
                      }}
                    >
                      {icons[e.type] || <Clock size={8} />}
                    </div>
                    <div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.65)",
                          fontSize: 13,
                        }}
                      >
                        {e.user?.name && (
                          <strong style={{ color: "#fff" }}>
                            {e.user.name}{" "}
                          </strong>
                        )}
                        {e.message}
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.18)",
                          fontSize: 11,
                          marginTop: 1,
                        }}
                      >
                        {dayjs(e.createdAt).format("MMM D, h:mm A")}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {/* ═══ DELETE MODAL ═══ */}
      {showDeleteConfirm &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 999999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif",
            }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background:
                  "linear-gradient(160deg, #1a0a2e 0%, #2d1057 50%, #1e0b35 100%)",
                borderRadius: 20,
                padding: "32px 28px",
                width: 380,
                maxWidth: "90vw",
                boxShadow:
                  "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,138,42,0.15)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                  background: "rgba(255,77,79,0.1)",
                  border: "1px solid rgba(255,77,79,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={24} style={{ color: "#ff4d4f" }} />
              </div>
              <h3
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 700,
                  margin: "0 0 8px",
                }}
              >
                Delete this trip?
              </h3>
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 14,
                  margin: "0 0 24px",
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                  {group.title || "Untitled Trip"}
                </strong>
                {group.destination && <span> → {group.destination}</span>}
                <br />
                This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteGroup}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 14,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 4px 20px rgba(255,77,79,0.3)",
                  }}
                >
                  Delete Trip
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
