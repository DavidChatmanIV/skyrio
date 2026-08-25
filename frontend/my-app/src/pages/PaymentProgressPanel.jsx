import React, { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, message as antdMessage } from "antd";
import { CheckOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Users, DollarSign, PartyPopper } from "lucide-react";
import { io } from "socket.io-client";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;
const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ═══ SECTION WRAPPER — mirrors SyncGroupPage.jsx exactly ═══ */
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

/* ═══ MAIN COMPONENT ═══
   Drop this into SyncGroupPage.jsx for the trip owner (or everyone,
   if you want the whole group watching payment come in) once
   group.status === "payment_pending":

     {group.status === "payment_pending" && (
       <PaymentProgressPanel
         bookingId={group.bookingId}
         groupId={group._id}
         members={group.members}
         owner={group.owner}
         onAllPaid={fetchGroup}
       />
     )}

   NOTE: assumes a socket.io server already listening for a
   "join-group" event and emitting "payment:update" to room
   `group:${groupId}` — see the webhook wiring from earlier.
   If your existing price-watch feature exposes a shared socket
   instance/context instead of a raw io() call, swap the connection
   block below for that instead of opening a second connection.
*/
export default function PaymentProgressPanel({
  bookingId,
  groupId,
  members = [],
  owner,
  onAllPaid,
}) {
  const [shares, setShares] = useState(() =>
    members.map((m) => ({
      memberId: String(m._id),
      name: m.user?.name || m.name || m.email || "Traveler",
      avatar: m.user?.avatar,
      status: m.paymentStatus || "unpaid",
    }))
  );
  const socketRef = useRef(null);
  const hasFiredAllPaid = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`${API_BASE}/stripe/split-status/${bookingId}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.splitPayments)) {
        setShares((prev) =>
          prev.map((s) => {
            const match = data.splitPayments.find(
              (p) => p.memberId === s.memberId
            );
            return match ? { ...s, status: match.status } : s;
          })
        );
      }
    } catch {
      // silent — socket is the primary channel, this is just a fallback
    }
  }, [bookingId]);

  // Socket.IO — live updates, same room pattern as the webhook emits to
  useEffect(() => {
    if (!groupId) return;

    const socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-group", groupId);
    });

    socket.on("payment:update", (payload) => {
      if (String(payload.bookingId) !== String(bookingId)) return;
      setShares((prev) =>
        prev.map((s) => {
          const match = payload.splitPayments.find(
            (p) => p.memberId === s.memberId
          );
          return match ? { ...s, status: match.status } : s;
        })
      );
      if (payload.allPaid && !hasFiredAllPaid.current) {
        hasFiredAllPaid.current = true;
        antdMessage.success("Everyone paid — trip booked!");
        onAllPaid?.();
      }
    });

    // Polling fallback in case the socket connection drops — cheap
    // insurance so the panel doesn't go stale silently.
    const pollInterval = setInterval(fetchStatus, 15000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [groupId, bookingId, fetchStatus, onAllPaid]);

  const paidCount = shares.filter((s) => s.status === "paid").length;
  const allPaid = shares.length > 0 && paidCount === shares.length;

  return (
    <Section>
      <SectionTitle
        icon={<Users size={16} style={{ color: "#ff8a2a" }} />}
        right={
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: allPaid ? "#52c41a" : "#ff8a2a",
            }}
          >
            {paidCount}/{shares.length} paid
          </span>
        }
      >
        Payment Progress
      </SectionTitle>

      <div
        style={{
          height: 5,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 3,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            width: shares.length
              ? `${(paidCount / shares.length) * 100}%`
              : "0%",
            background: allPaid
              ? "#52c41a"
              : "linear-gradient(90deg, #ff8a2a, #ffb347)",
            transition: "width 0.3s",
          }}
        />
      </div>

      {owner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            marginBottom: 8,
            background: "rgba(255,138,42,0.05)",
            borderRadius: 10,
          }}
        >
          <Avatar
            size={28}
            src={
              owner.avatar !== "/default-avatar.png" ? owner.avatar : undefined
            }
            style={{ background: "#ff8a2a", color: "#1b1024", fontWeight: 800 }}
          >
            {(owner.name || owner.username || "?")[0].toUpperCase()}
          </Avatar>
          <span style={{ color: "#fff", fontSize: 13, flex: 1 }}>
            {owner.name || owner.username}{" "}
            <span style={{ color: "rgba(255,255,255,0.3)" }}>(organizer)</span>
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shares.map((s) => (
          <div
            key={s.memberId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${
                s.status === "paid"
                  ? "rgba(82,196,26,0.2)"
                  : "rgba(255,255,255,0.06)"
              }`,
              borderRadius: 10,
            }}
          >
            <Avatar
              size={28}
              src={s.avatar !== "/default-avatar.png" ? s.avatar : undefined}
              style={{
                background: "#2a1f3d",
                color: "#ff8a2a",
                fontWeight: 800,
              }}
            >
              {s.name[0].toUpperCase()}
            </Avatar>
            <span style={{ color: "#fff", fontSize: 13, flex: 1 }}>
              {s.name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 12,
                background:
                  s.status === "paid"
                    ? "rgba(82,196,26,0.12)"
                    : "rgba(255,255,255,0.05)",
                color:
                  s.status === "paid" ? "#52c41a" : "rgba(255,255,255,0.35)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {s.status === "paid" ? (
                <>
                  <CheckOutlined style={{ fontSize: 10 }} /> Paid
                </>
              ) : (
                <>
                  <ClockCircleOutlined style={{ fontSize: 10 }} /> Unpaid
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {allPaid && (
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
          <PartyPopper size={28} style={{ color: "#52c41a" }} />
          <p style={{ color: "#52c41a", fontWeight: 700, marginTop: 8 }}>
            Everyone's paid — trip is booked!
          </p>
        </div>
      )}
    </Section>
  );
}
