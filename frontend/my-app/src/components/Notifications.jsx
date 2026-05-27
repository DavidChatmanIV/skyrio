import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Badge,
  Button,
  Empty,
  List,
  Modal,
  Tabs,
  Tooltip,
  Typography,
  Spin,
  Avatar,
} from "antd";
import {
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  GiftOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiUrl } from "@/lib/api";

const { Text } = Typography;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const iconMap = {
  xp: <GiftOutlined style={{ color: "#22c55e" }} />,
  trip: <CheckCircleOutlined style={{ color: "#3b82f6" }} />,
  message: <MessageOutlined style={{ color: "#a855f7" }} />,
  saved_trip: <CheckCircleOutlined style={{ color: "#ff8a2a" }} />,
};

const timeAgo = (date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const byTab = (items, key) => {
  if (key === "mentions") return items.filter((i) => i.type === "mention");
  if (key === "system") return items.filter((i) => i.type === "system");
  return items;
};

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [activeKey, setActiveKey] = useState("all");
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(isMobile);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setMobile(isMobile());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/notifications?limit=50"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(
        Array.isArray(data?.notifications) ? data.notifications : []
      );
    } catch (err) {
      console.error("❌ load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── KEY FIX: optimistic update — drain badge immediately before waiting
  //    for the server so the count always clears the moment panel opens,
  //    even on slow connections or if the PATCH returns an error.
  const silentMarkAllRead = useCallback(async () => {
    // 1. Update local state first (badge drains instantly)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // 2. Tell the server in the background
    try {
      await fetch(apiUrl("/api/notifications/read-all"), {
        method: "PATCH",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
    } catch {
      // Silent — local state is already drained, server will sync on next load
    }
  }, []);

  const markAllAsRead = async () => {
    try {
      setBusy(true);
      await fetch(apiUrl("/api/notifications/read-all"), {
        method: "PATCH",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Marked all as read");
    } catch (err) {
      console.error("❌ mark all as read:", err);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    try {
      setBusy(true);
      await fetch(apiUrl("/api/notifications/clear"), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      setNotifications([]);
      toast("Notifications cleared", { icon: "🧹" });
    } catch (err) {
      console.error("❌ clear notifications:", err);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    // Fetch first, then drain badge optimistically
    fetchNotifications().then(() => silentMarkAllRead());
    if (!mobile) {
      const t = setTimeout(() => panelRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ Intentionally omitting fetchNotifications/silentMarkAllRead from deps
  //   to avoid re-fetching on every render when those callbacks change identity.

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filtered = useMemo(
    () => byTab(notifications, activeKey),
    [notifications, activeKey]
  );

  const handleItemClick = async (item) => {
    try {
      const notifId = item._id || item.id;
      if (notifId && !item.read) {
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notifId || n.id === notifId ? { ...n, read: true } : n
          )
        );
        fetch(
          apiUrl(`/api/notifications/${encodeURIComponent(notifId)}/read`),
          {
            method: "PATCH",
            headers: { ...getAuthHeaders() },
            credentials: "include",
          }
        ).catch(() => {});
      }
      setVisible(false);
      if (item.link) navigate(item.link);
      else if (item.targetType === "booking" && item.targetId)
        navigate(`/dashboard/bookings/${item.targetId}`);
      else if (item.targetType === "dm" && item.targetId)
        navigate(`/dm/${item.targetId}`);
      else if (item.targetType === "trip" && item.targetId)
        navigate(`/saved-trips`);
    } catch (e) {
      console.warn("onNotificationClick error:", e);
    }
  };

  const panelContent = (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          size="small"
          items={[
            {
              key: "all",
              label: `All${unreadCount ? ` (${unreadCount})` : ""}`,
            },
            { key: "mentions", label: "Mentions" },
            { key: "system", label: "System" },
          ]}
          style={{ color: "#fff" }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <Tooltip title="Mark all as read">
            <Button
              icon={<CheckCircleOutlined />}
              type="text"
              size="small"
              onClick={markAllAsRead}
              disabled={busy || unreadCount === 0}
              style={{ color: "rgba(255,255,255,0.5)" }}
            />
          </Tooltip>
          <Tooltip title="Clear all">
            <Button
              icon={<DeleteOutlined />}
              type="text"
              size="small"
              danger
              onClick={clearAll}
              disabled={busy || notifications.length === 0}
            />
          </Tooltip>
        </div>
      </div>

      {loading || busy ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "24px 0",
          }}
        >
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          description={
            <span style={{ color: "rgba(255,255,255,0.4)" }}>
              You're all caught up!
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={filtered}
          renderItem={(item) => (
            <List.Item
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                marginBottom: 4,
                cursor: "pointer",
                background: !item.read
                  ? "rgba(124,92,252,0.12)"
                  : "transparent",
                border: !item.read
                  ? "1px solid rgba(124,92,252,0.2)"
                  : "1px solid transparent",
              }}
              onClick={() => handleItemClick(item)}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={iconMap[item.type] || <MessageOutlined />}
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  />
                }
                title={
                  <Text strong style={{ color: "#fff", fontSize: 13 }}>
                    {item.title || "Notification"}
                  </Text>
                }
                description={
                  <>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.55)",
                        fontSize: 12,
                        display: "block",
                      }}
                    >
                      {item.message}
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 11,
                      }}
                    >
                      {item.createdAt ? `${timeAgo(item.createdAt)} ago` : ""}
                    </Text>
                  </>
                }
              />
              {!item.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#7c5cfc",
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                />
              )}
            </List.Item>
          )}
        />
      )}
    </>
  );

  const bellButton = (
    <Badge count={unreadCount} size="small">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: 18,
          lineHeight: 1,
          color: "rgba(255,255,255,0.7)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <BellOutlined />
      </button>
    </Badge>
  );

  // ── Mobile: full-screen Modal ──
  if (mobile) {
    return (
      <>
        {bellButton}
        <Modal
          open={visible}
          onCancel={() => setVisible(false)}
          footer={null}
          title={
            <span style={{ color: "#fff" }}>
              Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </span>
          }
          styles={{
            content: {
              background: "#1a1535",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 18,
              padding: 16,
            },
            header: {
              background: "transparent",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              paddingBottom: 8,
            },
            mask: { background: "rgba(0,0,0,0.6)" },
          }}
          style={{ top: 40 }}
          width="calc(100vw - 32px)"
        >
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {panelContent}
          </div>
        </Modal>
      </>
    );
  }

  // ── Desktop: floating panel ──
  return (
    <div style={{ position: "relative" }}>
      {bellButton}
      <AnimatePresence>
        {visible && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 9998 }}
              onClick={() => setVisible(false)}
            />
            <motion.div
              key="notif-panel"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              ref={panelRef}
              tabIndex={-1}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 9999,
                background: "#1a1535",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                width: 360,
                maxHeight: "70vh",
                overflowY: "auto",
                padding: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
