// "Already booked?" — lets a traveler link a flight or room they booked
// outside the trip flow. Only the viewer's own bookings are listed, only
// the viewer sees them, and nothing is linked unless they tap "Link to trip".
//
// Only bookings that match BOTH the trip's destination and dates are
// suggested. Everything else sits behind a quiet "other bookings" link.
//
// embedded  — rendered inside "Your part" (GroupTripPanel). No card, no
//             title, and no list of linked bookings (Your part already
//             shows them, with Unlink).
// hasFlight / hasRoom — when you already have one on the trip, bookings
//             of that type stop being suggested.
import { useEffect, useState, useCallback } from "react";
import { Button, Modal, message as antdMessage } from "antd";
import { Plane, Hotel, Link2, ChevronDown, ChevronUp } from "lucide-react";
import dayjs from "dayjs";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// "Nov 20–24", "Nov 30 – Dec 4", or "Nov 20" for one day.
export function fmtRange(start, end) {
  const s = start ? dayjs(start) : null;
  if (!s || !s.isValid()) return "";
  const e = end ? dayjs(end) : null;
  if (!e || !e.isValid() || e.isSame(s, "day")) return s.format("MMM D");
  if (e.isSame(s, "month")) return `${s.format("MMM D")}–${e.format("D")}`;
  return `${s.format("MMM D")} – ${e.format("MMM D")}`;
}

// One line people can read at a glance: "EWR → MIA · Nov 20–24 · Nuitée Air".
// Flights use the airline's local times so these dates match Arrivals.
function describe(b) {
  if (b.type === "Flight") {
    const route =
      b.origin && b.destination
        ? `${b.origin} → ${b.destination}`
        : b.tripDetails;
    const dates = fmtRange(
      b.departsAt || b.start,
      b.returnDepartsAt || (b.departsAt ? null : b.end)
    );
    return {
      title: route,
      detail: [dates, b.airline].filter(Boolean).join(" · "),
    };
  }
  return { title: b.tripDetails, detail: fmtRange(b.start, b.end) };
}

function BookingRow({ b, action }) {
  const Icon = b.type === "Flight" ? Plane : Hotel;
  const { title, detail } = describe(b);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${
          b.suggested ? "rgba(255,138,42,0.3)" : "rgba(255,255,255,0.07)"
        }`,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: "rgba(255,138,42,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ff8a2a",
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
          {title}
        </div>
        {detail && (
          <div
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 12.5,
              marginTop: 2,
            }}
          >
            {detail}
          </div>
        )}
        {b.confirmation && (
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 11,
              marginTop: 2,
            }}
          >
            Conf. {b.confirmation}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

const linkBtnStyle = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "#ff8a2a",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "inherit",
};
const hint = {
  color: "rgba(255,255,255,0.45)",
  fontSize: 12.5,
  margin: "6px 0 10px",
  lineHeight: 1.5,
};

export default function AttachBookingCard({
  groupId,
  onChanged,
  embedded = false,
  hasFlight = false,
  hasRoom = false,
}) {
  const [available, setAvailable] = useState([]);
  const [onThisTrip, setOnThisTrip] = useState([]);
  const [showOthers, setShowOthers] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/${groupId}/attachable-bookings`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (data.ok) {
        setAvailable(data.available || []);
        setOnThisTrip(data.onThisTrip || []);
      }
    } catch {
      /* card just stays hidden */
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path, bookingId, okText) => {
    setBusyId(bookingId);
    try {
      const res = await fetch(`${API_BASE}/sync-together/${groupId}/${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      antdMessage.success(okText);
      await load();
      onChanged?.();
    } catch (err) {
      antdMessage.error(err.message || "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const unlink = (b) =>
    Modal.confirm({
      title: `Unlink this ${
        b.type === "Flight" ? "flight" : "room"
      } from the trip?`,
      content:
        "Your booking stays active — nothing is cancelled. It just stops showing for the group.",
      okText: "Unlink",
      onOk: () =>
        act("detach-booking", b.id, "Unlinked. Your booking is still active."),
    });

  // A type you already have on the trip is never "suggested" again.
  const stillNeeded = (b) => (b.type === "Flight" ? !hasFlight : !hasRoom);
  const suggestions = available.filter((b) => b.suggested && stillNeeded(b));
  const others = available.filter((b) => !suggestions.includes(b));
  const linked = embedded ? [] : onThisTrip.filter((b) => b.removable);

  if (!suggestions.length && !others.length && !linked.length) return null;

  const linkButton = (b) => (
    <Button
      size="small"
      className="sk-sync-add-btn"
      loading={busyId === b.id}
      onClick={() => act("attach-booking", b.id, "Linked to the trip")}
    >
      Link to trip
    </Button>
  );

  const body = (
    <>
      {linked.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 12,
          }}
        >
          {linked.map((b) => (
            <BookingRow
              key={b.id}
              b={b}
              action={
                <Button
                  size="small"
                  type="text"
                  loading={busyId === b.id}
                  onClick={() => unlink(b)}
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Unlink
                </Button>
              }
            />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 13.5 }}>
            Already booked this trip?
          </div>
          <p style={hint}>
            {suggestions.length === 1
              ? "This booking matches"
              : "These bookings match"}{" "}
            the trip's destination and dates. Only you can see this.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((b) => (
              <BookingRow key={b.id} b={b} action={linkButton(b)} />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowOthers((o) => !o)}
            aria-expanded={showOthers}
            style={{
              ...linkBtnStyle,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 500,
            }}
          >
            {suggestions.length
              ? `Show my other bookings (${others.length})`
              : "Booked outside this trip? Link it"}
            {showOthers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showOthers && (
            <>
              <p style={hint}>
                Only you can see this list. Nothing is shared with the group
                unless you tap “Link to trip”.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {others.map((b) => (
                  <BookingRow key={b.id} b={b} action={linkButton(b)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  if (embedded) return <div style={{ marginTop: 4 }}>{body}</div>;

  return (
    <div
      style={{
        marginTop: 20,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "20px 18px",
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
        <Link2 size={16} style={{ color: "#ff8a2a" }} />
        Your flight &amp; room
      </div>
      {body}
    </div>
  );
}
