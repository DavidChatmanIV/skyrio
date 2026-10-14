// "Booked something already?" — lets a traveler add a flight or room they
// booked outside the trip flow, and take one back off. Only the viewer's
// own bookings are listed, only the viewer sees them, and nothing is
// added unless they tap "Add to this trip".
import { useEffect, useState, useCallback } from "react";
import { Button, message as antdMessage } from "antd";
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

function fmtDates(start, end) {
  if (!start) return "";
  const s = dayjs(start);
  const e = end ? dayjs(end) : null;
  return e && e.isValid() && !e.isSame(s, "day")
    ? `${s.format("ddd, MMM D")} → ${e.format("ddd, MMM D, YYYY")}`
    : s.format("ddd, MMM D, YYYY");
}

function BookingRow({ b, action }) {
  const Icon = b.type === "Flight" ? Plane : Hotel;
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
          b.datesMatch ? "rgba(255,138,42,0.3)" : "rgba(255,255,255,0.07)"
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
          {b.tripDetails}
        </div>
        <div
          style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}
        >
          {[
            fmtDates(b.start, b.end),
            b.airline,
            b.confirmation && `Conf. ${b.confirmation}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {b.datesMatch && (
          <div
            style={{
              color: "#ff8a2a",
              fontSize: 11,
              fontWeight: 600,
              marginTop: 3,
            }}
          >
            Matches this trip's dates
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export default function AttachBookingCard({ groupId, onChanged }) {
  const [available, setAvailable] = useState([]);
  const [onThisTrip, setOnThisTrip] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/sync-together/${groupId}/attachable-bookings`,
        {
          headers: authHeaders(),
        }
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

  if (!available.length && !onThisTrip.length) return null;

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
        Your bookings for this trip
      </div>

      {onThisTrip.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 12,
          }}
        >
          {onThisTrip.map((b) => (
            <BookingRow
              key={b.id}
              b={b}
              action={
                b.removable ? (
                  <Button
                    size="small"
                    type="text"
                    loading={busyId === b.id}
                    onClick={() =>
                      act(
                        "detach-booking",
                        b.id,
                        "Taken off the trip. Your booking is unchanged."
                      )
                    }
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Remove from trip
                  </Button>
                ) : (
                  <span
                    style={{ color: "#52c41a", fontSize: 12, fontWeight: 600 }}
                  >
                    On this trip
                  </span>
                )
              }
            />
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            style={{
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
            }}
          >
            Booked something already? Add it ({available.length})
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {open && (
            <>
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12.5,
                  margin: "6px 0 10px",
                  lineHeight: 1.5,
                }}
              >
                Only you can see this list. Nothing is shared with the group
                unless you tap “Add to this trip”.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {available.map((b) => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    action={
                      <Button
                        size="small"
                        className="sk-sync-add-btn"
                        loading={busyId === b.id}
                        onClick={() =>
                          act("attach-booking", b.id, "Added to the trip")
                        }
                      >
                        Add to this trip
                      </Button>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
