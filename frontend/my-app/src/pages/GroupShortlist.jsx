// src/pages/GroupShortlist.jsx
// ─────────────────────────────────────────────────────────────
// Sync Together — the group shortlist.
//   1. Anyone searches from the trip and taps "Suggest to group".
//   2. Everyone votes here (suggesting counts as your vote).
//   3. The organizer picks the winner. A picked hotel becomes the group's
//      hotel; a picked flight is marked as the group's flight.
//   4. Tapping a suggestion (or "Book this") goes STRAIGHT to that exact
//      item: the link carries ?pick=<id>, and BookingPage re-finds the same
//      flight / room in fresh results and opens checkout. If it's no longer
//      available, the person lands on the same route/dates/hotel instead.
//      Activities open the provider page directly when we have its link.
//   The list refreshes every 15 seconds while the page is open, so new
//   suggestions and votes show up without reloading.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Spin, message as antdMessage } from "antd";
import {
  Plane,
  BedDouble,
  Ticket,
  ThumbsUp,
  Trophy,
  Trash2,
  Search,
} from "lucide-react";
import dayjs from "dayjs";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/sync-together${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false)
    throw new Error(data.error || data.message || "Something went wrong.");
  return data;
}

const money = (n, cur = "USD") =>
  Number.isFinite(Number(n))
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur || "USD",
        maximumFractionDigits: 0,
      }).format(Number(n))
    : null;
const t = (v) => (v ? dayjs(v).format("ddd MMM D, h:mm A") : "");
const ymd = (v) => (v ? dayjs(v).format("YYYY-MM-DD") : null);

const card = {
  marginTop: 20,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: "20px 18px",
  backdropFilter: "blur(8px)",
};
const muted = { color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 };
// Inner buttons shouldn't also trigger the card's "open this" click.
const stop = (fn) => (e) => {
  e.stopPropagation();
  fn();
};

function Option({
  it,
  rank,
  isOrganizer,
  onVote,
  onPick,
  onRemove,
  onBook,
  busy,
}) {
  const winner = it.status === "picked" || it.isGroupHotel || it.isGroupFlight;
  const img =
    it.kind === "hotel"
      ? it.hotel?.thumbnail
      : it.kind === "activity"
      ? it.activity?.image
      : it.flight?.logo;
  const title =
    it.kind === "hotel"
      ? it.hotel?.name || "Hotel"
      : it.kind === "activity"
      ? it.activity?.name || "Activity"
      : `${it.flight?.airline || "Flight"} · ${it.flight?.origin} → ${
          it.flight?.destination
        }`;
  const lines =
    it.kind === "activity"
      ? [
          [
            it.activity?.rating
              ? `★ ${Number(it.activity.rating).toFixed(1)}`
              : null,
            it.activity?.reviews
              ? `${Number(it.activity.reviews).toLocaleString("en-US")} reviews`
              : null,
            it.activity?.duration,
          ]
            .filter(Boolean)
            .join(" · "),
          it.activity?.city,
        ]
      : it.kind === "hotel"
      ? [
          [
            it.hotel?.stars ? `${it.hotel.stars}★` : null,
            it.hotel?.rating ? `${it.hotel.rating}/10` : null,
            it.hotel?.address,
          ]
            .filter(Boolean)
            .join(" · "),
          [it.hotel?.roomName, it.hotel?.boardName].filter(Boolean).join(" · "),
          it.hotel?.checkin
            ? `${dayjs(it.hotel.checkin).format("MMM D")} → ${dayjs(
                it.hotel.checkout
              ).format("MMM D")}`
            : null,
        ]
      : [
          `Leaves ${t(it.flight?.departAt)}${
            it.flight?.arriveAt
              ? ` · lands ${dayjs(it.flight.arriveAt).format("h:mm A")}`
              : ""
          }`,
          it.flight?.returnDepartAt
            ? `Returns ${t(it.flight.returnDepartAt)}`
            : "One way",
          it.flight?.stops === 0
            ? "Nonstop"
            : Number.isFinite(it.flight?.stops)
            ? `${it.flight.stops} stop${it.flight.stops === 1 ? "" : "s"}`
            : null,
        ];

  return (
    <div
      role="button"
      tabIndex={0}
      title={`Open ${title}`}
      onClick={() => onBook(it)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBook(it);
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        cursor: "pointer",
        background: winner ? "rgba(82,196,26,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          winner ? "rgba(82,196,26,0.35)" : "rgba(255,255,255,0.07)"
        }`,
        flexWrap: "wrap",
        transition: "border-color .15s, background .15s",
      }}
      onMouseEnter={(e) => {
        if (!winner) e.currentTarget.style.borderColor = "rgba(255,138,42,0.4)";
      }}
      onMouseLeave={(e) => {
        if (!winner)
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          flexShrink: 0,
          background: img
            ? `rgba(255,255,255,0.06) url(${img}) center / ${
                it.kind === "flight" ? "60% no-repeat" : "cover"
              }`
            : "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!img &&
          (it.kind === "hotel" ? (
            <BedDouble size={22} color="#ff8a2a" />
          ) : it.kind === "activity" ? (
            <Ticket size={22} color="#ff8a2a" />
          ) : (
            <Plane size={22} color="#ff8a2a" />
          ))}
      </div>

      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {rank === 1 && it.votes > 0 && !winner && (
            <span style={{ fontSize: 11, fontWeight: 800, color: "#ffb347" }}>
              LEADING
            </span>
          )}
          {winner && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#52c41a",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <Trophy size={12} />{" "}
              {it.kind === "activity" ? "ON THE PLAN" : "GROUP'S PICK"}
            </span>
          )}
        </div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {title}
        </div>
        {lines.filter(Boolean).map((l, i) => (
          <div key={i} style={muted}>
            {l}
          </div>
        ))}
        <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
          Suggested by {it.suggestedByMe ? "you" : it.suggestedBy}
          {it.voters?.length ? ` · 👍 ${it.voters.join(", ")}` : ""}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          marginLeft: "auto",
        }}
      >
        {money(it.price, it.currency) && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#ff8a2a", fontWeight: 800, fontSize: 16 }}>
              {money(it.price, it.currency)}
            </div>
            <div style={{ ...muted, fontSize: 11 }}>
              {it.kind === "hotel"
                ? "per room, when suggested"
                : it.kind === "activity"
                ? "from, per person"
                : "per person, when suggested"}
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={stop(() => onVote(it))}
            disabled={busy}
            aria-pressed={it.votedByMe}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${
                it.votedByMe ? "#ff8a2a" : "rgba(255,255,255,0.18)"
              }`,
              background: it.votedByMe
                ? "rgba(255,138,42,0.18)"
                : "transparent",
              color: it.votedByMe ? "#ff8a2a" : "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <ThumbsUp size={14} /> {it.votes}
          </button>
          <Button
            size="small"
            className="sk-sync-cta-btn"
            onClick={stop(() => onBook(it))}
          >
            Book this
          </Button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {isOrganizer && !winner && (
            <button
              type="button"
              onClick={stop(() => onPick(it))}
              disabled={busy}
              style={{
                background: "none",
                border: 0,
                color: "#52c41a",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              {it.kind === "activity"
                ? "Add to the plan"
                : "Pick for the group"}
            </button>
          )}
          {(it.suggestedByMe || isOrganizer) && (
            <button
              type="button"
              onClick={stop(() => onRemove(it))}
              disabled={busy}
              aria-label="Remove from shortlist"
              style={{
                background: "none",
                border: 0,
                color: "rgba(255,255,255,0.45)",
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupShortlist({ groupId, myAirport, cabinClass }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`/${groupId}/parts`));
    } catch {
      /* the rest of the trip page still works */
    }
  }, [groupId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    // New suggestions and votes from the group show up on their own.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [load]);

  const items = useMemo(() => {
    const list = data?.shortlist || [];
    return tab === "all" ? list : list.filter((i) => i.kind === tab);
  }, [data, tab]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) antdMessage.success(ok);
      await load();
    } catch (e) {
      antdMessage.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const searchLink = (tabName, extra = {}) => {
    const p = new URLSearchParams({ groupId, tab: tabName, auto: "1" });
    if (tabName === "Flights" && myAirport) p.set("from", myAirport);
    if (tabName === "Flights" && cabinClass) p.set("cabin", cabinClass);
    if (data?.destination) p.set("to", data.destination);
    if (data?.dateRangeStart) p.set("depart", ymd(data.dateRangeStart));
    if (data?.dateRangeEnd) p.set("return", ymd(data.dateRangeEnd));
    Object.entries(extra).forEach(([k, v]) =>
      v == null ? p.delete(k) : p.set(k, String(v))
    );
    return `/booking?${p.toString()}`;
  };

  // Goes straight to the exact suggestion. `pick` tells BookingPage which
  // shortlist item to find in the fresh results and open.
  const book = (it) => {
    if (it.kind === "activity") {
      // Excursions are booked on the provider's page (opens in a new tab).
      if (it.activity?.url)
        window.open(it.activity.url, "_blank", "noopener,noreferrer");
      else
        navigate(
          searchLink("Excursions", {
            to: it.activity?.city || data?.destination,
            pick: it.id,
          })
        );
      return;
    }
    if (it.kind === "hotel") {
      navigate(
        searchLink("Stays", {
          hotelId: it.hotel.hotelId,
          depart: it.hotel.checkin || ymd(data?.dateRangeStart),
          return: it.hotel.checkout || ymd(data?.dateRangeEnd),
          adults: it.hotel.adults || 1,
          rooms: 1,
          pick: it.id,
        })
      );
    } else {
      navigate(
        searchLink("Flights", {
          from: it.flight.origin,
          to: it.flight.destination,
          depart: ymd(it.flight.departAt),
          return: it.flight.returnDepartAt
            ? ymd(it.flight.returnDepartAt)
            : null,
          cabin: it.flight.cabin || cabinClass,
          adults: 1,
          pick: it.id,
        })
      );
    }
  };

  if (!data) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  const counts = {
    all: data.shortlist?.length || 0,
    hotel: (data.shortlist || []).filter((i) => i.kind === "hotel").length,
    flight: (data.shortlist || []).filter((i) => i.kind === "flight").length,
    activity: (data.shortlist || []).filter((i) => i.kind === "activity")
      .length,
  };
  const comfy = data.budgetSummary?.comfortable;

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 6,
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
          🗳️ Group shortlist
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button
            size="small"
            icon={<Plane size={13} />}
            onClick={() => navigate(searchLink("Flights"))}
          >
            Find flights
          </Button>
          <Button
            size="small"
            icon={<BedDouble size={13} />}
            onClick={() => navigate(searchLink("Stays", { adults: 1 }))}
          >
            Find stays
          </Button>
          <Button
            size="small"
            icon={<Ticket size={13} />}
            onClick={() => navigate(searchLink("Excursions"))}
          >
            Find activities
          </Button>
        </div>
      </div>
      <p style={{ ...muted, marginTop: 0 }}>
        Search, tap <strong style={{ color: "#fff" }}>Suggest to group</strong>{" "}
        on anything you like, and vote here. Tap any suggestion to open it.
        {data.isOrganizer
          ? " Pick the winner when the group agrees — a picked hotel becomes where everyone stays."
          : " The organizer picks the winner."}
      </p>
      {comfy && (
        <p style={{ ...muted, marginTop: -4, fontSize: 12.5 }}>
          💰 The group is comfortable up to about{" "}
          <strong style={{ color: "#fff" }}>{money(comfy)}</strong> per person
          for the trip.
        </p>
      )}

      {counts.all > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            margin: "10px 0 12px",
            flexWrap: "wrap",
          }}
        >
          {[
            ["all", `All (${counts.all})`],
            ["hotel", `Stays (${counts.hotel})`],
            ["flight", `Flights (${counts.flight})`],
            ["activity", `Activities (${counts.activity})`],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTab(v)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                border: `1px solid ${
                  tab === v ? "#ff8a2a" : "rgba(255,255,255,0.14)"
                }`,
                background: tab === v ? "rgba(255,138,42,0.16)" : "transparent",
                color: tab === v ? "#ff8a2a" : "rgba(255,255,255,0.75)",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.15)",
            textAlign: "center",
            ...muted,
          }}
        >
          <Search size={18} style={{ marginBottom: 6 }} />
          <div style={{ color: "#fff", fontWeight: 600 }}>
            Nothing suggested yet
          </div>
          <div>
            Find a flight, a stay or an activity you like and tap “Suggest to
            group” — it shows up here for everyone to vote on.
          </div>
        </div>
      ) : (
        items.map((it, i) => (
          <Option
            key={it.id}
            it={it}
            rank={i + 1}
            busy={busy}
            isOrganizer={data.isOrganizer}
            onBook={book}
            onVote={(x) =>
              run(() =>
                api(`/${groupId}/shortlist/${x.id}/vote`, { method: "POST" })
              )
            }
            onPick={(x) =>
              run(
                () =>
                  api(`/${groupId}/shortlist/${x.id}/pick`, { method: "POST" }),
                x.kind === "hotel"
                  ? "Picked — it's now where the group stays."
                  : x.kind === "activity"
                  ? "Added to the group's plan."
                  : "Picked as the group's flight."
              )
            }
            onRemove={(x) =>
              run(
                () =>
                  api(`/${groupId}/shortlist/${x.id}`, { method: "DELETE" }),
                "Removed from the shortlist"
              )
            }
          />
        ))
      )}
    </div>
  );
}
