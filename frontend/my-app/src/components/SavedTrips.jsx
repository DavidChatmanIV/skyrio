import React, { useEffect, useState, useCallback } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  Plane,
  MapPin,
  CalendarDays,
  Trash2,
  ArrowRight,
  Heart,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { apiUrl } from "@/lib/api";

/* ── Styles (single drop-in file) ── */
const ST_CSS = `
.svt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.svt-card { display: flex; flex-direction: column; border-radius: 18px; overflow: hidden; background: rgba(16,11,34,0.78); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 14px 40px rgba(0,0,0,0.28); transition: border-color .18s, transform .18s; }
.svt-card:hover { border-color: rgba(255,138,42,0.45); transform: translateY(-2px); }
.svt-media { position: relative; height: 130px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.85); background: linear-gradient(135deg, rgba(255,138,42,.35), rgba(139,108,255,.4)); background-size: cover; background-position: center; }
.svt-price { position: absolute; left: 12px; bottom: 12px; padding: 5px 10px; border-radius: 999px; background: rgba(14,7,22,0.82); color: #ffb347; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
.svt-body { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px 12px; flex: 1; }
.svt-title { font-size: 15px; font-weight: 800; color: #fff; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.svt-meta { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: rgba(255,255,255,0.75); }
.svt-meta span { display: inline-flex; align-items: center; gap: 5px; }
.svt-foot { display: flex; gap: 8px; padding: 10px 16px 14px; border-top: 2px dashed rgba(255,255,255,0.12); }
.svt-go { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border: 0; border-radius: 999px; background: linear-gradient(135deg,#ff8a2a,#ffb347); color: #1a0e06; font: 800 13.5px "DM Sans", sans-serif; cursor: pointer; }
.svt-go:hover { filter: brightness(1.06); }
.svt-del { width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: rgba(255,255,255,0.75); cursor: pointer; }
.svt-del:hover { border-color: rgba(255,107,133,.6); color: #ff8fa3; }
.svt-confirm { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 700; color: #fff; }
.svt-confirm div { display: flex; gap: 6px; }
.svt-confirm button { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #fff; font: 700 12.5px "DM Sans", sans-serif; cursor: pointer; }
.svt-confirm button.is-danger { border: 0; background: #ff6b85; color: #1a0e06; }
.svt-grid :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
.svt-empty { padding: 30px 18px; border-radius: 16px; border: 2px dashed rgba(255,255,255,0.14); text-align: center; color: rgba(255,255,255,0.72); font-size: 13.5px; }
.svt-empty svg { color: #ffb347; margin-bottom: 8px; }
.svt-empty b { display: block; margin-bottom: 4px; font-size: 15px; color: #fff; }
.svt-skel { height: 250px; border-radius: 18px; background: linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04)); background-size: 200% 100%; animation: svtShimmer 1.2s linear infinite; }
@keyframes svtShimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .svt-skel { animation: none; } .svt-card:hover { transform: none; } }
`;

const fmtMoney = (amount, currency) =>
  Number(amount) > 0
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(Number(amount))
    : null;

// Saved dates may be ISO strings or plain "2026-11-20" — show them nicely
const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function SavedTrips() {
  const navigate = useNavigate();
  const { token, isAuthed } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);

  const fetchTrips = useCallback(async () => {
    if (!isAuthed) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/saved-trips"), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't load saved trips");
      setTrips(data.savedTrips || []);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthed, token]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleDelete = async (id) => {
    setConfirmId(null);
    const before = trips;
    setTrips((prev) => prev.filter((t) => t._id !== id));
    try {
      const res = await fetch(apiUrl(`/api/saved-trips/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't remove it");
      message.success("Removed from saved");
    } catch (err) {
      setTrips(before);
      message.error(err.message);
    }
  };

  // Open the booking page with this trip's place and dates filled in
  const continuePlanning = (trip) => {
    const params = new URLSearchParams();
    if (trip.destination) {
      params.set("city", trip.destination);
      params.set("toName", trip.destination);
    }
    if (trip.startDate) params.set("depart", trip.startDate);
    if (trip.endDate) params.set("return", trip.endDate);
    const q = params.toString();
    navigate(q ? `/booking?${q}` : "/booking");
  };

  if (!isAuthed) return null;

  return (
    <div>
      <style>{ST_CSS}</style>
      {loading ? (
        <div className="svt-grid">
          <div className="svt-skel" />
          <div className="svt-skel" />
          <div className="svt-skel" />
        </div>
      ) : trips.length === 0 ? (
        <div className="svt-empty">
          <Heart size={28} aria-hidden="true" />
          <b>Nothing saved yet</b>
          Tap the heart on a flight or hotel to keep it here for later.
        </div>
      ) : (
        <div className="svt-grid">
          {trips.map((trip) => {
            const price = fmtMoney(trip.price, trip.currency);
            const start = fmtDate(trip.startDate);
            const end = fmtDate(trip.endDate);
            const confirming = confirmId === trip._id;
            return (
              <article key={trip._id} className="svt-card">
                <div
                  className="svt-media"
                  style={
                    trip.image
                      ? { backgroundImage: `url(${trip.image})` }
                      : undefined
                  }
                >
                  {!trip.image && <Plane size={30} aria-hidden="true" />}
                  {price && <span className="svt-price">{price}</span>}
                </div>
                <div className="svt-body">
                  <div className="svt-title" title={trip.title}>
                    {trip.title || "Saved trip"}
                  </div>
                  <div className="svt-meta">
                    {trip.destination && (
                      <span>
                        <MapPin size={13} aria-hidden="true" />
                        {trip.destination}
                      </span>
                    )}
                    {start && (
                      <span>
                        <CalendarDays size={13} aria-hidden="true" />
                        {start}
                        {end ? ` → ${end}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="svt-foot">
                  {confirming ? (
                    <div className="svt-confirm" role="alertdialog">
                      Remove this?
                      <div>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => handleDelete(trip._id)}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="svt-go"
                        onClick={() => continuePlanning(trip)}
                      >
                        Continue planning{" "}
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="svt-del"
                        onClick={() => setConfirmId(trip._id)}
                        aria-label={`Remove ${trip.title || "saved trip"}`}
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
