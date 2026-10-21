// src/pages/SyncBoardingPass.jsx
// ─────────────────────────────────────────────────────────────
// Sync Together's start-a-trip search, styled as a group boarding pass.
//   DESTINATION · DATES · CREW  →  [Sync up]
// Same feel as the Stays search bar, but unique to group trips: a ticket
// with a perforated stub, a passenger list, and quick date picks.
// State lives in SyncTogether.jsx; this component only renders and edits it.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Spin } from "antd";
import { LoadingOutlined, SyncOutlined } from "@ant-design/icons";
import {
  MapPin,
  Calendar,
  Users,
  Plane,
  Search,
  X,
  UserPlus,
} from "lucide-react";
import dayjs from "dayjs";
import "@/styles/SyncBoardingPass.css";
// Same picker as the booking page: full-screen sheet on mobile, modal on desktop.
import SkyrioPicker from "./booking/SkyrioPicker";
const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Quick picks under the pass, like the Stays search.
function quickRanges() {
  const today = dayjs().startOf("day");
  // Upcoming Friday (if today is Fri/Sat/Sun, this weekend's Friday).
  const dow = today.day(); // 0 Sun … 6 Sat
  const thisFri =
    dow === 0
      ? today.subtract(2, "day")
      : dow === 6
      ? today.subtract(1, "day")
      : today.add(5 - dow, "day");
  const fri = thisFri.isBefore(today) ? today : thisFri;
  return [
    { label: "This weekend", range: [fri, thisFri.add(2, "day")] },
    {
      label: "Next weekend",
      range: [thisFri.add(7, "day"), thisFri.add(9, "day")],
    },
    {
      label: "Long weekend",
      range: [thisFri.add(7, "day"), thisFri.add(10, "day")],
    },
    { label: "1 week", range: [today.add(14, "day"), today.add(21, "day")] },
  ];
}

const initial = (s) => (s || "?")[0].toUpperCase();
const personName = (t) => t.name || t.username || t.email;

export default function SyncBoardingPass({
  destination,
  setDestination,
  dateRange,
  setDateRange,
  travelers,
  onAddTraveler,
  onRemoveTraveler,
  onSubmit,
  creating,
  myName,
}) {
  const [open, setOpen] = useState(null); // "where" | "who" | null
  const [needCrew, setNeedCrew] = useState(false); // tapped Sync up with no crew
  const passRef = useRef(null);

  // ── Destination suggestions (cities from the airport list) ──
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const placeTimer = useRef(null);
  const searchPlaces = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setPlaceResults([]);
      return;
    }
    setPlaceLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/airports?q=${encodeURIComponent(q.trim())}`,
        {
          headers: authHeaders(),
        }
      );
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : data?.airports || data?.data || data?.results || [];
      // One row per city — "Miami, United States (MIA)".
      const seen = new Set();
      const cities = [];
      for (const ap of list) {
        const city = ap.city || ap.name;
        if (!city) continue;
        const key = `${city}|${ap.country || ""}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cities.push({
          city,
          country: ap.country || "",
          code: ap.code || ap.iata || ap.iata_code || "",
        });
        if (cities.length >= 6) break;
      }
      setPlaceResults(cities);
    } catch {
      setPlaceResults([]);
    } finally {
      setPlaceLoading(false);
    }
  }, []);
  const onDestinationChange = (e) => {
    const v = e.target.value;
    setDestination(v);
    setOpen("where");
    clearTimeout(placeTimer.current);
    placeTimer.current = setTimeout(() => searchPlaces(v), 250);
  };
  const pickPlace = (p) => {
    setDestination(p.city);
    setPlaceResults([]);
    setOpen(null);
  };

  // ── Crew search ──
  const [who, setWho] = useState("");
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const peopleTimer = useRef(null);
  const searchPeople = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setPeople([]);
      return;
    }
    setPeopleLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/search?q=${encodeURIComponent(q.trim())}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      setPeople(data.ok ? data.users || [] : []);
    } catch {
      setPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  }, []);
  const onWhoChange = (e) => {
    setWho(e.target.value);
    clearTimeout(peopleTimer.current);
    peopleTimer.current = setTimeout(() => searchPeople(e.target.value), 300);
  };
  const whoInputRef = useRef(null);
  const [justAdded, setJustAdded] = useState(""); // name shown in "✓ Added" line
  const addedTimer = useRef(null);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  // On phones, drop the keyboard after adding someone so the Done button
  // and passenger list are visible instead of hidden behind the keyboard.
  const afterAdd = (name) => {
    setNeedCrew(false);
    setWho("");
    setPeople([]);
    setJustAdded(name || "");
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(""), 2500);
    if (window.matchMedia?.("(max-width: 768px)").matches) {
      whoInputRef.current?.blur();
    }
  };
  const addPerson = (user) => {
    onAddTraveler(user);
    afterAdd(user.name || user.username || user.email);
  };
  const addTyped = () => {
    const v = who.trim();
    if (!v) return;
    if (people.length) return addPerson(people[0]);
    onAddTraveler({ email: v, name: v });
    afterAdd(v);
  };
  const closeCrew = () => {
    whoInputRef.current?.blur();
    setOpen(null);
  };

  // Close panels on outside tap / click / Escape.
  // touchstart is needed too: iOS Safari doesn't fire mousedown when you
  // tap a non-clickable area, which is why tapping outside didn't close it.
  useEffect(() => {
    const onDown = (e) => {
      if (passRef.current && !passRef.current.contains(e.target)) setOpen(null);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const crewLabel = travelers.length
    ? `You + ${travelers.length}`
    : "Add your crew";
  const nights =
    dateRange?.[0] && dateRange?.[1]
      ? dateRange[1].diff(dateRange[0], "day")
      : null;
  // Never a dead button: with no crew yet, it opens the Crew panel instead.
  const submit = () => {
    if (creating) return;
    if (!travelers.length) {
      setNeedCrew(true);
      setOpen("who");
      return;
    }
    onSubmit();
  };
  const activeQuick = (r) =>
    dateRange?.[0]?.isSame(r[0], "day") && dateRange?.[1]?.isSame(r[1], "day");

  return (
    <div className="skbp-wrap" ref={passRef}>
      <div className="skbp-pass" role="group" aria-label="Start a group trip">
        {/* Ticket header */}
        <div className="skbp-head">
          <span className="skbp-brand">
            <Plane size={13} /> SKYRIO · SYNC TOGETHER
          </span>
          <span className="skbp-class">GROUP PASS</span>
        </div>

        <div className="skbp-body">
          {/* DESTINATION */}
          <div className={`skbp-field ${open === "where" ? "is-open" : ""}`}>
            <label className="skbp-label" htmlFor="skbp-dest">
              <MapPin size={11} /> Destination
            </label>
            <input
              id="skbp-dest"
              className="skbp-input"
              value={destination}
              onChange={onDestinationChange}
              onFocus={() => setOpen("where")}
              placeholder="Where's the crew headed?"
              autoComplete="off"
            />
            {open === "where" && (placeLoading || placeResults.length > 0) && (
              <div className="skbp-pop" role="listbox">
                {placeLoading && !placeResults.length ? (
                  <div className="skbp-pop-empty">
                    <Spin
                      indicator={
                        <LoadingOutlined
                          style={{ fontSize: 14, color: "#ff8a2a" }}
                        />
                      }
                    />
                  </div>
                ) : (
                  placeResults.map((p) => (
                    <button
                      type="button"
                      key={`${p.city}-${p.country}-${p.code}`}
                      className="skbp-pop-item"
                      onClick={() => pickPlace(p)}
                    >
                      <span className="skbp-pop-icon">
                        <MapPin size={15} />
                      </span>
                      <span className="skbp-pop-text">
                        <strong>{p.city}</strong>
                        <small>{p.country}</small>
                      </span>
                      {p.code && <span className="skbp-code">{p.code}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="skbp-divider" aria-hidden />

          {/* DATES */}
          <div className="skbp-field">
            <span className="skbp-label">
              <Calendar size={11} /> Dates
              {nights != null && nights > 0 && (
                <em className="skbp-hint">
                  {nights} night{nights !== 1 ? "s" : ""}
                </em>
              )}
            </span>
            <div onClickCapture={() => setOpen(null)}>
              <SkyrioPicker
                className="skbp-range"
                value={dateRange ?? [null, null]}
                onChange={(v) => setDateRange(v?.[0] ? v : null)}
                disabledDate={(d) => d && d.isBefore(dayjs().startOf("day"))}
                placeholder={["Depart", "Return"]}
                showIcon={false}
                triggerStyle={{
                  background: "transparent",
                  border: "none",
                  borderRadius: 0,
                  backdropFilter: "none",
                  height: "auto",
                  padding: 0,
                  fontSize: 15,
                }}
              />
            </div>
          </div>

          <div className="skbp-divider" aria-hidden />

          {/* CREW */}
          <div
            className={`skbp-field skbp-field-who ${
              open === "who" ? "is-open" : ""
            } ${needCrew && !travelers.length ? "needs-crew" : ""}`}
          >
            <span className="skbp-label">
              <Users size={11} /> Crew
            </span>
            <button
              type="button"
              className="skbp-crew-btn"
              onClick={() => setOpen(open === "who" ? null : "who")}
              aria-expanded={open === "who"}
            >
              <span className="skbp-avatars">
                <Avatar size={24} className="skbp-av skbp-av-me">
                  {initial(myName)}
                </Avatar>
                {travelers.slice(0, 3).map((t, i) => (
                  <Avatar
                    key={t.id || t.email || i}
                    size={24}
                    className="skbp-av"
                    src={
                      t.avatar && t.avatar !== "/default-avatar.png"
                        ? t.avatar
                        : undefined
                    }
                  >
                    {initial(personName(t))}
                  </Avatar>
                ))}
              </span>
              <span
                className={
                  travelers.length
                    ? "skbp-crew-text"
                    : "skbp-crew-text is-empty"
                }
              >
                {crewLabel}
              </span>
            </button>

            {open === "who" && (
              <div className="skbp-pop skbp-pop-who">
                {/* Title + close, so it's obvious how to get out */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    Add your crew
                  </span>
                  <button
                    type="button"
                    onClick={closeCrew}
                    aria-label="Close"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.75)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      touchAction: "manipulation",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {needCrew && !travelers.length && (
                  <div className="skbp-nudge" role="status">
                    Add at least one friend to start the trip.
                  </div>
                )}
                <div className="skbp-who-search">
                  <Search size={15} color="#ff8a2a" />
                  <input
                    ref={whoInputRef}
                    autoFocus
                    enterKeyHint="done"
                    value={who}
                    onChange={onWhoChange}
                    onKeyDown={(e) => e.key === "Enter" && addTyped()}
                    placeholder="Name, username, or email"
                    autoComplete="off"
                  />
                  {peopleLoading && (
                    <Spin
                      indicator={
                        <LoadingOutlined
                          style={{ fontSize: 13, color: "#ff8a2a" }}
                        />
                      }
                    />
                  )}
                </div>

                {people.map((u) => (
                  <button
                    type="button"
                    key={u._id || u.id}
                    className="skbp-pop-item"
                    onClick={() => addPerson(u)}
                  >
                    <Avatar
                      size={30}
                      className="skbp-av"
                      src={
                        u.avatar && u.avatar !== "/default-avatar.png"
                          ? u.avatar
                          : undefined
                      }
                    >
                      {initial(u.name || u.username)}
                    </Avatar>
                    <span className="skbp-pop-text">
                      <strong>{u.name || u.username}</strong>
                      {u.username && <small>@{u.username}</small>}
                    </span>
                    <UserPlus size={15} color="#ff8a2a" />
                  </button>
                ))}
                {!people.length && !peopleLoading && who.trim().length >= 2 && (
                  <button
                    type="button"
                    className="skbp-pop-item"
                    onClick={addTyped}
                  >
                    <span className="skbp-pop-icon">
                      <UserPlus size={15} />
                    </span>
                    <span className="skbp-pop-text">
                      <strong>Invite “{who.trim()}”</strong>
                      <small>We'll email them a link to join</small>
                    </span>
                  </button>
                )}

                {/* Passenger list */}
                <div className="skbp-manifest">
                  <div className="skbp-manifest-title">Passengers</div>
                  <div className="skbp-passenger">
                    <span className="skbp-seat">01</span>
                    <span>{myName || "You"}</span>
                    <span className="skbp-tag">Organizer</span>
                  </div>
                  {travelers.map((t, i) => (
                    <div className="skbp-passenger" key={t.id || t.email || i}>
                      <span className="skbp-seat">
                        {String(i + 2).padStart(2, "0")}
                      </span>
                      <span className="skbp-passenger-name">
                        {personName(t)}
                        {t.username && <small> @{t.username}</small>}
                      </span>
                      <button
                        type="button"
                        className="skbp-remove"
                        onClick={() => onRemoveTraveler(t)}
                        aria-label={`Remove ${personName(t)}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {!travelers.length && !needCrew && (
                    <div className="skbp-manifest-empty">
                      Add at least one friend to sync up.
                    </div>
                  )}
                </div>

                {/* Confirmation that the tap worked */}
                {justAdded && (
                  <div
                    role="status"
                    style={{
                      marginTop: 10,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#52c41a",
                    }}
                  >
                    ✓ {justAdded} added. Add more, or tap Done.
                  </div>
                )}

                {/* Clear way out of the panel */}
                <button
                  type="button"
                  onClick={closeCrew}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: travelers.length
                      ? "none"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: travelers.length
                      ? "linear-gradient(135deg, #FF8A2A 0%, #FF6000 100%)"
                      : "rgba(255,255,255,0.06)",
                    color: travelers.length ? "#fff" : "rgba(255,255,255,0.7)",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    touchAction: "manipulation",
                    boxShadow: travelers.length
                      ? "0 4px 18px rgba(255,138,42,0.35)"
                      : "none",
                  }}
                >
                  {travelers.length
                    ? `Done · ${travelers.length} friend${
                        travelers.length !== 1 ? "s" : ""
                      } added`
                    : "Close"}
                </button>
              </div>
            )}
          </div>

          {/* Stub — perforation + CTA */}
          <div className="skbp-stub">
            <button
              type="button"
              className="skbp-go"
              onClick={submit}
              disabled={creating}
              aria-label="Start planning together"
            >
              <SyncOutlined spin={creating} />
              <span>{creating ? "Syncing…" : "Sync up"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick date picks */}
      <div className="skbp-quick">
        {quickRanges().map((q) => (
          <button
            type="button"
            key={q.label}
            className={`skbp-chip ${activeQuick(q.range) ? "is-active" : ""}`}
            onClick={() => setDateRange(q.range)}
          >
            {q.label}
          </button>
        ))}
      </div>
      <p className="skbp-sub">
        {travelers.length
          ? `${
              travelers.length + 1
            } travelers on this pass — everyone gets a link to join the plan.`
          : "One plan. Every traveler covered. Add your crew to get started."}
      </p>
    </div>
  );
}
