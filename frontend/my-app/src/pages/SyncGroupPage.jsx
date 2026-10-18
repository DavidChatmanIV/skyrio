import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Button, Avatar, Spin, Input, message as antdMessage } from "antd";
import SkyrioPicker from "./booking/SkyrioPicker";
import GroupTripPanel from "./GroupTripPanel";
import GroupShortlist from "./GroupShortlist";
import AttachBookingCard from "./AttachBookingCard";
import TripDetailsPass from "@/components/syncTogether/TripDetailsPass";
import TripBudgetBar from "@/components/syncTogether/TripBudgetBar";
import { tripBudgetFrom, tripSearchParams } from "@/utils/tripBudget";
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
// NEW: trip-composition classification for family/friends/multi-family-aware planning
import { buildCompositionInstructions } from "@/utils/tripComposition";

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
      // Defensive unwrap — handles either a raw array response or the
      // { ok, airports: [...] } shape the rest of this API uses. Without
      // this, a wrapped response silently produces zero results with no
      // error (Array.isArray(data) is false), which is why the dropdown
      // never appeared even though the request succeeded.
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.airports)
        ? data.airports
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
        ? data.results
        : [];
      if (!Array.isArray(data) && list.length === 0) {
        console.warn(
          "[airport search] unexpected response shape from /api/airports:",
          data
        );
      }
      setResults(list.slice(0, 8));
      setShowDrop(true);
    } catch (err) {
      console.error("[airport search] request failed:", err);
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
// Atlas only suggests — it can't book anything. Older plans (and the odd
// new one) sometimes claimed "Confirmed" or invented a confirmation
// number, which reads like a real booking. Strip those out on display.
const FAKE_CONFIRMATION =
  /confirmation\s*(#|no\.?|number|code)\s*[:\-]?\s*\**[A-Z0-9][A-Z0-9-]{3,}/i;
const BOOKED_CLAIM = /\b(confirmed|booked|locked in|reserved)\b/i;
function sanitizePlan(text) {
  return String(text || "")
    .split("\n")
    .filter((line) => !FAKE_CONFIRMATION.test(line))
    .map((line) => {
      const t = line.trim();
      const isHeading =
        /^#{1,4}\s/.test(t) || /^\*\*[^*]+\*\*\s*:?\s*$/.test(t);
      if (isHeading && BOOKED_CLAIM.test(t)) {
        // "### ✅ Accommodation Confirmed" → "### Suggested accommodation"
        const words = t
          .replace(/^#{1,4}\s*|\*\*/g, "")
          .replace(/[✅✔️☑️]/gu, "")
          .replace(/\b(confirmed|booked|locked in|reserved)\b/gi, "")
          .replace(/[:\-–—]+\s*$/, "")
          .trim();
        return `### Suggested ${words.toLowerCase() || "option"}`;
      }
      // Sentences claiming the trip is booked become suggestions.
      return line
        .replace(
          /(flights?|hotels?|rooms?|stay|accommodation|everything|it|they)( and [a-z ]+?)? (are|is) (now )?(locked in|booked|confirmed)/gi,
          "$1$2 $3 ready to book"
        )
        .replace(/\byou'?re (all )?booked\b/gi, "you're ready to book");
    })
    .join("\n");
}

function AtlasPlanRenderer({ plan, onSearch }) {
  if (!plan) return null;
  const lines = sanitizePlan(plan).split("\n"),
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
  const sectionSearch = (t) => {
    const l = String(t || "").toLowerCase();
    if (l.includes("flight"))
      return { tab: "Flights", label: "Search these flights" };
    if (l.includes("hotel") || l.includes("accommodat") || l.includes("stay"))
      return { tab: "Stays", label: "Search stays" };
    if (
      l.includes("activit") ||
      l.includes("excursion") ||
      l.includes("things to do")
    )
      return { tab: "Excursions", label: "Find things to do" };
    return null;
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
            {onSearch && sectionSearch(s.title) && (
              <button
                type="button"
                onClick={() => onSearch(sectionSearch(s.title).tab)}
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,138,42,0.1)",
                  border: "1px solid rgba(255,138,42,0.35)",
                  color: "#ff8a2a",
                  borderRadius: 10,
                  padding: "7px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <SearchOutlined /> {sectionSearch(s.title).label}
              </button>
            )}
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
  // Your own budget per person — private, only you see it.
  // (Input now lives in TripDetailsPass; this mirrors the saved value.)
  const [budget, setBudget] = useState(null);
  const [savingBudget, setSavingBudget] = useState(false);
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
  const chatBoxRef = useRef(null);
  const [editingMyAirport, setEditingMyAirport] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");
  const [changeSending, setChangeSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [showAddDrop, setShowAddDrop] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const addDebounceRef = useRef(null);
  const addWrapperRef = useRef(null);
  // NEW: who has actually booked (from bookings linked to this trip).
  // Drives the stepper and status badge instead of group.status alone.
  const [bookingProgress, setBookingProgress] = useState(null);
  // YOUR part of the trip (what you've booked + your private budget).
  // Drives the "Your trip" tracker: Flight · Stay · Things to do.
  const [myParts, setMyParts] = useState(null);
  const fetchMyParts = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/parts`, {
        headers: authHeaders(),
      });
      const d = await res.json();
      if (d.ok) setMyParts(d);
    } catch {
      /* tracker just stays hidden */
    }
  };
  const myTrip = useMemo(() => tripBudgetFrom(myParts), [myParts]);

  useEffect(() => {
    const h = getHomeAirport();
    if (h?.code) {
      setDepartureAirport(h.code);
      setDepartureDisplay(h.city ? `${h.code} — ${h.city}` : h.code);
    }
  }, []);

  const fetchProgress = async () => {
    fetchMyParts(); // keep "Your trip" in step with the group's progress
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/progress`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) setBookingProgress(data.progress);
    } catch {
      /* stepper falls back to the trip status */
    }
  };

  const fetchGroup = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        fetchProgress();
        setDestination(data.group.destination || "");
        if (data.group.departureAirport) {
          setDepartureAirport(data.group.departureAirport);
          if (!departureDisplay)
            setDepartureDisplay(data.group.departureAirport);
        }
        setCabinClass(data.group.cabinClass || "economy");
        setDepartureTime(data.group.departureTime || "any");
        setChatMessages(data.group.chatMessages || []);
        setBudget(data.group.myBudget ?? null);
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
  // What the whole group is comfortable spending (lowest budget, rounded,
  // no names). Atlas plans to this so nobody gets priced out.
  const groupBudget = group?.budgetSummary?.comfortable || null;
  const hasPlan = !!group?.plan;
  const isBooked = group?.status === "booked";
  const isPaymentPending = group?.status === "payment_pending";
  const anyoneBooked = !!bookingProgress?.anyBooked;
  const openCRs =
    group?.changeRequests?.filter((cr) => cr.status === "open") || [];
  // People who said they can't make it don't count toward approvals.
  const goingMembers =
    group?.members?.filter((m) => m.status !== "declined") || [];
  const approvedCount = goingMembers.filter((m) => m.approved).length;
  const totalMembers = goingMembers.length;
  const myRsvp = myMember?.status || null;
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const answerRsvp = async (going) => {
    setRsvpSaving(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/rsvp`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ going }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        fetchProgress();
        antdMessage.success(
          going ? "You're in!" : "Got it — we let the organizer know."
        );
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Couldn't save your answer");
    } finally {
      setRsvpSaving(false);
    }
  };
  const allApproved = totalMembers > 0 && approvedCount === totalMembers;
  const myApproval = myMember?.approved || false;
  // The booking panel (Your part · Shared rooms · The group).
  const showTripPanel =
    isMember &&
    myRsvp !== "declined" &&
    (anyoneBooked ||
      allApproved ||
      isBooked ||
      group?.status === "confirmed" ||
      group?.bookingOpenedAt);

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

  // What Atlas must always know: it suggests, people book. Plus who has
  // actually booked what, so it never guesses.
  const ATLAS_RULES =
    '\n\nRULES:\n- You are SUGGESTING options. Nothing is booked until each traveler books it themselves in Skyrio (each person books their own flight and room).\n- Never say anything is booked, confirmed, reserved or locked in, and never invent confirmation numbers.\n- Show prices as estimates ("about $X").\n- Only describe real bookings from the BOOKED SO FAR list.';
  const fetchBookingContext = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/parts`, {
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!d.ok) return "";
      const lines = (d.travelers || []).map((t) => {
        const f =
          t.flight && t.flight.status !== "cancelled"
            ? `flight booked (${t.flight.tripDetails})`
            : "no flight yet";
        const st =
          t.stay?.kind === "shared"
            ? `shared room ${
                t.stay.roomStatus === "booked" ? "booked" : "pending holds"
              }`
            : t.stay && t.stay.status !== "cancelled"
            ? `room booked (${t.stay.tripDetails})`
            : "no room yet";
        return `- ${t.name}: ${f}; ${st}`;
      });
      return lines.length
        ? `\n\nBOOKED SO FAR (real Skyrio bookings):\n${lines.join("\n")}`
        : "";
    } catch {
      return "";
    }
  };

  // ── UPDATED: now injects trip-composition guidance into the prompt ──
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

    // NEW: trip-composition guidance (family / friends / multi-family / etc)
    const compositionNote = buildCompositionInstructions(group);
    const bookingCtx = await fetchBookingContext();

    const prompt = `Plan a group trip to ${destination} with ${count} travelers (me + ${names}).\n\nTRAVELER COMPOSITION:\n${compositionNote}\n\nDETAILS:\n- Organizer: ${home}\n- Destination: ${destination}\n- Cabin: ${cabin}\n- Time: ${time}\n- Airports:\n  - Me: ${home}\n${airports}\n${
      days ? `- ${days} days` : ""
    }${
      dateRange[0]
        ? `\n- ${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format(
            "YYYY-MM-DD"
          )}`
        : ""
    }${
      groupBudget
        ? `\n- Budget: keep it to about $${groupBudget.toLocaleString(
            "en-US"
          )} per person or less (the most everyone in the group is comfortable with)`
        : ""
    }\n- ${count} travelers${crCtx}${bookingCtx}\n\nSearch different airports if they differ. Use commas in prices. Use ### headers.\n\n1. Real ${cabin} flights — prefer ${time}\n2. Best options with prices\n3. Accommodation\n4. Day-by-day itinerary\n5. Budget breakdown\n6. Weather\n7. Group tips${ATLAS_RULES}`;
    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: { destination, budget: groupBudget, tripDays: days },
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

  const askFollowUp = async (preset) => {
    const ask = (typeof preset === "string" ? preset : followUp).trim();
    if (!ask) return;
    setFollowUpLoading(true);
    const bookingCtx = await fetchBookingContext();
    const msgs = [
      ...atlasMessages,
      {
        role: "user",
        content:
          ask +
          "\n\nFormat prices with commas. Use ### headers." +
          bookingCtx +
          ATLAS_RULES,
      },
    ];
    try {
      const res = await fetch(`${API_BASE}/atlas/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          messages: msgs,
          context: { destination, budget: groupBudget },
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

  // ── REWIRED (again): the previous version tried to start payment
  // collection the moment everyone approved — but that requires
  // group.bookingId to already exist, and nothing had ever created a
  // Booking yet (no flight/hotel had been picked). That's why nothing
  // visibly happened: the call either no-op'd or failed quietly.
  //
  // Correct flow, matching how solo booking already works: once
  // approved, the owner is taken into the SAME flight/hotel search +
  // BookingCheckout flow a solo traveler uses — just with groupId
  // attached. Payment split only starts AFTER that checkout succeeds
  // (handled inside BookingCheckout.jsx's onGroupBookingComplete),
  // never before. This function no longer calls Stripe at all — it
  // just navigates.
  //
  // NOTE: adjust the destination route below to match whatever path
  // your solo "Book" flow actually uses to reach flight search — this
  // assumes something like /book, since that's the top-nav link.
  const goToGroupBooking = () => {
    const params = new URLSearchParams({
      groupId: group._id,
      groupMemberCount: String(totalMembers + 1),
    });
    if (group.destination) params.set("destination", group.destination);
    if (group.departureAirport)
      params.set("departureAirport", group.departureAirport);
    if (group.cabinClass) params.set("cabinClass", group.cabinClass);
    navigate(`/booking?${params.toString()}`);
  };

  // Manual search: opens Book with the trip's destination, dates and your
  // airport already filled in.
  const searchLink = (tab) => {
    const params = new URLSearchParams({ groupId: group._id, tab, auto: "1" });
    if (tab === "Flights" && group.cabinClass)
      params.set("cabin", group.cabinClass);
    if (tab === "Stays" && group.groupHotel?.hotelId)
      params.set("hotelId", group.groupHotel.hotelId);
    const myAirport =
      (isOwner ? group.departureAirport : myMember?.departureAirport) ||
      group.departureAirport;
    if (tab === "Flights" && myAirport) params.set("from", myAirport);
    if (group.destination) params.set("to", group.destination);
    if (group.dateRangeStart)
      params.set("depart", dayjs(group.dateRangeStart).format("YYYY-MM-DD"));
    if (group.dateRangeEnd)
      params.set("return", dayjs(group.dateRangeEnd).format("YYYY-MM-DD"));
    return `/booking?${params.toString()}`;
  };
  const openSearch = (tab) => navigate(searchLink(tab));

  const [planMode, setPlanMode] = useState(null); // null | "self"
  const [startingBooking, setStartingBooking] = useState(false);
  const startBooking = async () => {
    setStartingBooking(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/start-booking`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup(data.group);
        antdMessage.success(
          "Booking is open — everyone can book their own part."
        );
      } else antdMessage.error(data.error);
    } catch {
      antdMessage.error("Couldn't start booking");
    } finally {
      setStartingBooking(false);
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
        fetchProgress();
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
  const [resendingId, setResendingId] = useState(null);
  const resendInvite = async (mid, name) => {
    setResendingId(mid);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/resend-invite`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ memberId: mid }),
      });
      const data = await res.json();
      if (data.ok) {
        antdMessage.success(
          `Invite sent again to ${
            name || data.sentTo
          }. Ask them to check Spam or Promotions too.`
        );
        fetchGroup();
      } else antdMessage.error(data.error || "Couldn't resend the invite");
    } catch {
      antdMessage.error("Couldn't resend the invite");
    } finally {
      setResendingId(null);
    }
  };
  const removeMember = async (mid, name) => {
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/member/${mid}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok && data.left) {
        antdMessage.success("You left the trip");
        navigate("/sync-together");
      } else if (data.ok) {
        setGroup(data.group);
        fetchProgress();
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
        setChatMessages((p) =>
          p.some((m) => String(m._id) === String(data.message?._id))
            ? p
            : [...p, data.message]
        );
        setChatInput("");
        setTimeout(() => scrollChatToEnd(true), 100);
      } else antdMessage.error(data.error);
    } catch (err) {
      antdMessage.error("Failed to send");
    } finally {
      setChatSending(false);
    }
  };

  const saveMyBudget = async (value) => {
    setSavingBudget(true);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${id}/my-budget`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ budget: value || null }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Couldn't save your budget");
      setBudget(data.myBudget);
      setMyParts((p) => (p ? { ...p, myBudget: data.myBudget } : p));
      setGroup((g) =>
        g
          ? { ...g, myBudget: data.myBudget, budgetSummary: data.budgetSummary }
          : g
      );
      antdMessage.success(
        data.myBudget
          ? "Budget saved — only you can see it."
          : "Budget cleared."
      );
    } catch (err) {
      antdMessage.error(err.message || "Couldn't save your budget");
    } finally {
      setSavingBudget(false);
    }
  };

  /* ── Live group chat ──
     Checks for new messages every few seconds while this tab is open and
     visible, and right away when you come back to it. Only messages newer
     than the last one you have are sent, so each check is tiny. */
  const scrollChatToEnd = (force = false) => {
    const box = chatBoxRef.current;
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (force || nearBottom)
      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  };
  const lastChatAtRef = useRef(null);
  useEffect(() => {
    const last = chatMessages[chatMessages.length - 1];
    lastChatAtRef.current = last?.createdAt || lastChatAtRef.current;
  }, [chatMessages]);
  useEffect(() => {
    if (!isMember || !id) return;
    let alive = true;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const after = lastChatAtRef.current;
        const res = await fetch(
          `${API_BASE}/sync-together/${id}/chat${
            after ? `?after=${encodeURIComponent(after)}` : ""
          }`,
          { headers: authHeaders() }
        );
        const data = await res.json();
        if (!alive || !data.ok || !data.messages?.length) return;
        setChatMessages((prev) => {
          const seen = new Set(prev.map((m) => String(m._id)));
          const fresh = data.messages.filter((m) => !seen.has(String(m._id)));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        setTimeout(() => scrollChatToEnd(false), 60);
      } catch {
        /* try again next tick */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(check, 4000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isMember]);

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

  let sc = {
    draft: { l: "Draft", c: "rgba(255,255,255,0.45)" },
    inviting: { l: "Invitations Sent", c: "#ff8a2a" },
    planning: { l: "Planning", c: "#ff8a2a" },
    reviewing: { l: "Reviewing Plan", c: "#1890ff" },
    confirmed: { l: "All Approved", c: "#52c41a" },
    payment_pending: { l: "Collecting Payment", c: "#ff8a2a" },
    booked: { l: "Booked", c: "#52c41a" },
    cancelled: { l: "Cancelled", c: "#ff4d4f" },
  }[group.status] || { l: "Draft", c: "rgba(255,255,255,0.45)" };
  // NEW: real bookings override the planning status in the badge.
  if (bookingProgress?.allBooked) sc = { l: "Everyone's booked", c: "#52c41a" };
  else if (bookingProgress?.anyBooked)
    sc = {
      l: `${bookingProgress.bookedCount} of ${bookingProgress.travelers} booked`,
      c: "#ff8a2a",
    };

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

      {/* ═══ PROGRESS STEPPER ═══
          Planning steps follow group.status. Once anyone has a booking
          linked to this trip, the Booked step is current and shows how
          many travelers have booked; it completes when everyone has a
          flight and a room. */}
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
          "payment_pending",
          "booked",
          "completed",
        ];
        const prog = bookingProgress;
        const allBooked =
          !!prog?.allBooked || ["booked", "completed"].includes(group.status);
        // Once anyone has booked, the trip is in the Booked step.
        const effective = allBooked
          ? "completed"
          : prog?.anyBooked
          ? "booked"
          : group.status;
        const ci = order.indexOf(effective);
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
              const curr = !allBooked && effective === s.k;
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
                      aria-current={curr ? "step" : undefined}
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
                      {active && !curr ? "✓" : i + 1}
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
                      {s.k === "booked" && prog?.anyBooked && !allBooked
                        ? `Booked ${prog.bookedCount}/${prog.travelers}`
                        : s.l}
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

      {/* ═══ RSVP — are you coming? ═══ */}
      {myMember && (myRsvp === "pending" || myRsvp === "declined") && (
        <Section mt={12}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                {myRsvp === "pending"
                  ? `${
                      group.owner?.name || "The organizer"
                    } invited you. Are you coming?`
                  : "You said you can't make it."}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {myRsvp === "pending"
                  ? "Your answer tells the group who to plan and book for."
                  : "Plans change — you can still join if there's room."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                className="sk-sync-cta-btn"
                loading={rsvpSaving}
                onClick={() => answerRsvp(true)}
              >
                I'm in
              </Button>
              {myRsvp === "pending" && (
                <Button disabled={rsvpSaving} onClick={() => answerRsvp(false)}>
                  Can't make it
                </Button>
              )}
            </div>
          </div>
        </Section>
      )}

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
                    if (!isBooked && isOwner) {
                      setTitleInput(group.title || "");
                      setEditingTitle(true);
                    }
                  }}
                  style={{
                    cursor: !isBooked && isOwner ? "pointer" : "default",
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
            {isOwner && !isBooked && !anyoneBooked && (
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
                  {!isBooked &&
                    (isOwner ||
                      (m.user &&
                        String(m.user._id || m.user) ===
                          String(currentUserId))) && (
                      <button
                        title={isOwner ? "Remove from trip" : "Leave this trip"}
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
                          (e.currentTarget.style.color =
                            "rgba(255,255,255,0.15)")
                        }
                      >
                        <CloseCircleOutlined style={{ fontSize: 14 }} />
                      </button>
                    )}
                </div>
                {isOwner &&
                  !isBooked &&
                  (m.status || "pending") === "pending" && (
                    <div
                      style={{
                        marginLeft: 48,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        disabled={resendingId === m._id}
                        onClick={() =>
                          resendInvite(m._id, m.user?.name || m.name || m.email)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ff8a2a",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: resendingId === m._id ? "default" : "pointer",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontFamily: "inherit",
                        }}
                      >
                        <SendOutlined style={{ fontSize: 11 }} />
                        {resendingId === m._id ? "Sending…" : "Resend invite"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          copyLink(
                            `${window.location.origin}/sync-together/join/${group.inviteCode}`
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(255,255,255,0.45)",
                          fontSize: 12,
                          cursor: "pointer",
                          padding: 0,
                          fontFamily: "inherit",
                        }}
                      >
                        Copy invite link
                      </button>
                    </div>
                  )}
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

      {/* ═══ TRIP DETAILS — boarding pass (view) / form (edit) ═══ */}
      {editing ? (
        <Section>
          <SectionTitle
            icon={<MapPin size={16} style={{ color: "#ff8a2a" }} />}
          >
            Edit Trip Details
          </SectionTitle>
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
        </Section>
      ) : (
        <TripDetailsPass
          departureAirport={departureAirport}
          departureDisplay={departureDisplay}
          destination={group.destination}
          startDate={group.dateRangeStart}
          endDate={group.dateRangeEnd}
          cabinClass={group.cabinClass}
          departureTime={group.departureTime}
          travelerCount={totalMembers + 1}
          groupBudget={groupBudget}
          budgetSummary={group.budgetSummary}
          myBudget={group.myBudget ?? null}
          onSaveBudget={saveMyBudget}
          savingBudget={savingBudget}
          showBudget={isMember}
          canEdit={!isBooked && isOwner}
          onEdit={() => setEditing(true)}
          isOwner={isOwner}
        />
      )}

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
            { i: <Hotel size={16} />, l: "Hotels", a: true, d: "Group stays" },
            { i: <Car size={16} />, l: "Car Rentals", d: "Shared transport" },
            {
              i: <Compass size={16} />,
              l: "Excursions",
              a: true,
              d: "Activities",
            },
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
                color: "rgba(255,255,255,0.45)",
                fontSize: 14,
                marginBottom: 14,
              }}
            >
              {destination
                ? "Let Atlas suggest flights, stays and a day-by-day plan — or search everything yourself."
                : "Set a destination and dates above first, then choose how you want to plan."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button
                className="sk-sync-cta-btn"
                icon={<Sparkles size={14} />}
                onClick={askAtlasToPlan}
                loading={planLoading}
                disabled={!destination}
              >
                {planLoading ? "Atlas is searching..." : "Ask Atlas to plan"}
              </Button>
              <Button
                className="sk-sync-add-btn"
                icon={<SearchOutlined />}
                disabled={!destination}
                onClick={() => setPlanMode(planMode === "self" ? null : "self")}
              >
                I'll plan it myself
              </Button>
            </div>
            {planMode === "self" && destination && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  Search {destination} yourself
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 13,
                    margin: "2px 0 12px",
                  }}
                >
                  Results open with your trip's destination and dates. Tap
                  “Suggest to group” on anything you like — it lands in the
                  shortlist below for everyone to vote on.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    icon={<Plane size={14} />}
                    onClick={() => openSearch("Flights")}
                  >
                    Flights
                  </Button>
                  <Button
                    icon={<Hotel size={14} />}
                    onClick={() => openSearch("Stays")}
                  >
                    Stays
                  </Button>
                  <Button
                    icon={<Compass size={14} />}
                    onClick={() => openSearch("Excursions")}
                  >
                    Things to do
                  </Button>
                </div>
                {isOwner && !group.bookingOpenedAt && (
                  <div
                    style={{
                      marginTop: 14,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      paddingTop: 12,
                    }}
                  >
                    <div
                      style={{
                        color: "rgba(255,255,255,0.55)",
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Already know the plan? Skip Atlas and approvals and let
                      everyone book their own part now.
                    </div>
                    <Button
                      className="sk-sync-cta-btn"
                      loading={startingBooking}
                      onClick={startBooking}
                    >
                      Start booking now
                    </Button>
                  </div>
                )}
              </div>
            )}
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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  marginBottom: 14,
                  borderRadius: 10,
                  background: "rgba(24,144,255,0.08)",
                  border: "1px solid rgba(24,144,255,0.2)",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <Info
                  size={15}
                  style={{ flexShrink: 0, marginTop: 2, color: "#69b1ff" }}
                />
                <span>
                  These are Atlas's suggestions — nothing is booked until each
                  person books their own part. Prices can change; you'll see the
                  real price before you pay.
                </span>
              </div>
              <AtlasPlanRenderer plan={atlasPlan} onSearch={openSearch} />
            </div>
            {!isBooked && isMember && (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {[
                  "Find cheaper options",
                  "Nonstop flights only",
                  "Make a day-by-day itinerary",
                  "Add group activities",
                  "Stay closer to the center",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={followUpLoading}
                    onClick={() => askFollowUp(q)}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.8)",
                      borderRadius: 999,
                      padding: "6px 12px",
                      fontSize: 12.5,
                      cursor: followUpLoading ? "wait" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {!isBooked && isMember && (
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <Input
                  className="sk-sync-input"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onPressEnter={() => askFollowUp()}
                  placeholder="Ask Atlas to adjust..."
                  style={{ flex: 1 }}
                />
                <Button
                  className="sk-sync-add-btn"
                  icon={<SendOutlined />}
                  onClick={() => askFollowUp()}
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

      {/* ═══ YOUR TRIP — Flight · Stay · Things to do + your budget ═══ */}
      {isMember && myRsvp !== "declined" && group.destination && myParts && (
        <div style={{ marginTop: 20 }}>
          {/* Whole-group progress, counted in people (the card below
              counts YOUR steps: flight + stay). */}
          {(() => {
            const everyone = totalMembers + 1; // organizer + members (not declined)
            const booked = Math.min(
              Number(bookingProgress?.bookedCount) || 0,
              everyone
            );
            const notJoined = goingMembers.filter(
              (m) => (m.status || "pending") === "pending"
            ).length;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 10,
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 14,
                }}
              >
                <Users size={15} style={{ color: "#ff8a2a" }} />
                <span>
                  <strong style={{ color: "#fff" }}>
                    Group: {booked} of {everyone}
                  </strong>{" "}
                  travelers booked
                </span>
                {notJoined > 0 && (
                  <span
                    style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}
                  >
                    · {notJoined} {notJoined === 1 ? "hasn't" : "haven't"}{" "}
                    accepted the invite yet
                  </span>
                )}
              </div>
            );
          })()}
          <TripBudgetBar
            groupId={group._id}
            tb={myTrip}
            kind={null}
            destination={group.destination}
            activityIdeas={
              (myParts.shortlist || []).filter(
                (i) => i.kind === "activity" && i.status !== "removed"
              ).length
            }
            onFind={(k) => {
              const p = tripSearchParams(group._id, myParts, k, {
                from:
                  (isOwner
                    ? group.departureAirport
                    : myMember?.departureAirport) ||
                  group.departureAirport ||
                  undefined,
                cabin: group.cabinClass,
              });
              navigate(`/booking?${new URLSearchParams(p).toString()}`);
            }}
            onSaved={(data) => {
              setBudget(data.myBudget);
              setMyParts((p) => (p ? { ...p, myBudget: data.myBudget } : p));
              setGroup((g) =>
                g
                  ? {
                      ...g,
                      myBudget: data.myBudget,
                      budgetSummary: data.budgetSummary,
                    }
                  : g
              );
            }}
          />
        </div>
      )}

      {/* ═══ GROUP SHORTLIST — suggest → vote → pick ═══ */}
      {isMember && myRsvp !== "declined" && group.destination && (
        <GroupShortlist
          groupId={group._id}
          cabinClass={group.cabinClass}
          myAirport={
            (isOwner ? group.departureAirport : myMember?.departureAirport) ||
            group.departureAirport ||
            undefined
          }
        />
      )}

      {/* ═══ REVIEW & APPROVE ═══ */}
      {hasPlan && !isBooked && !isPaymentPending && isMember && (
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
          {allApproved && !openCRs.length && (
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
                  marginBottom: 0,
                }}
              >
                <CheckCircleOutlined style={{ marginRight: 6 }} />
                Everyone approved!
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Now everyone books their own flight and room below.
              </p>
            </div>
          )}
        </Section>
      )}

      {/* ═══ BOOKING — plan together, pay separately ═══
          Each traveler books their own seat and room (or holds their share
          of a shared room) and cancels their own part from My Trips.
          Also shows as soon as anyone has a booking on this trip, even if
          the plan/approval steps were skipped. */}
      {showTripPanel && (
        <GroupTripPanel
          groupId={group._id}
          myAirport={
            (isOwner ? group.departureAirport : myMember?.departureAirport) ||
            group.departureAirport ||
            undefined
          }
          onChanged={fetchGroup}
        />
      )}

      {/* ═══ ALREADY BOOKED? — link one you made outside the trip ═══
          Once the trip panel is showing, this lives inside "Your part"
          there instead, so it only appears here before booking opens. */}
      {isMember && myRsvp !== "declined" && !showTripPanel && (
        <AttachBookingCard groupId={group._id} onChanged={fetchGroup} />
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
            ref={chatBoxRef}
            aria-live="polite"
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
            {(() => {
              // Names people go by on this trip, longest first, so a message
              // that already starts with the person's name isn't shown twice
              // ("David Chatman David Chatman booked their room").
              const tripNames = [
                group.owner?.name,
                group.owner?.username,
                ...(group.members || []).flatMap((m) => [
                  m.user?.name,
                  m.user?.username,
                  m.name,
                  m.email,
                ]),
              ]
                .filter(Boolean)
                .map((n) => String(n).trim())
                .filter((n) => n.length > 1)
                .sort((a, b) => b.length - a.length);
              return (activityLog) =>
                activityLog.map((e) => {
                  let msg = String(e.message || "");
                  const lower = msg.toLowerCase();
                  const dup = tripNames.find((n) =>
                    lower.startsWith(n.toLowerCase() + " ")
                  );
                  if (dup && e.user) msg = msg.slice(dup.length + 1);
                  return { ...e, _msg: msg };
                });
            })()([...group.activityLog])
              .reverse()
              .slice(0, 15)
              .map((e, i) => {
                // Things Skyrio did on its own (a room booked once everyone
                // held, an option that sold out) show under "Skyrio".
                const SYSTEM_TYPES = [
                  "shared_room_booked",
                  "shared_room_released",
                  "shortlist_unavailable",
                ];
                const actor = SYSTEM_TYPES.includes(e.type)
                  ? "Skyrio"
                  : e.user?.name ||
                    e.user?.username ||
                    (e.user ? "" : "Skyrio");
                const icons = {
                  shared_room_created: <Hotel size={10} />,
                  shared_room_held: <Hotel size={10} />,
                  shared_room_booked: (
                    <CheckCircleOutlined style={{ fontSize: 10 }} />
                  ),
                  shared_room_released: <Hotel size={10} />,
                  shared_room_cancelled: <Hotel size={10} />,
                  shortlist_unavailable: <Info size={10} />,
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
                        {actor && (
                          <strong style={{ color: "#fff" }}>{actor} </strong>
                        )}
                        {actor === "Skyrio" || !actor
                          ? e._msg.charAt(0).toUpperCase() + e._msg.slice(1)
                          : e._msg.charAt(0).toLowerCase() === e._msg.charAt(0)
                          ? e._msg
                          : e._msg.charAt(0).toLowerCase() + e._msg.slice(1)}
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
