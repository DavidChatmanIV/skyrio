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
  Dropdown,
  Empty,
  List,
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
import { motion } from "framer-motion";
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

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [activeKey, setActiveKey] = useState("all");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/notifications?limit=20"), {
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

  const markAllAsRead = async () => {
    try {
      setBusy(true);
      await fetch(apiUrl("/api/notifications/read-all"), {
        method: "PATCH",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      await fetchNotifications();
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
    if (visible) {
      fetchNotifications();
      const t = setTimeout(() => panelRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [visible, fetchNotifications]);

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
      const hasId = Boolean(notifId);

      if (hasId && !item.read) {
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

      if (item.link) {
        navigate(item.link);
      } else if (item.targetType === "booking" && item.targetId) {
        navigate(`/dashboard/bookings/${item.targetId}`);
      } else if (item.targetType === "dm" && item.targetId) {
        navigate(`/dm/${item.targetId}`);
      } else if (item.targetType === "trip" && item.targetId) {
        navigate(`/saved-trips`);
      }
    } catch (e) {
      console.warn("onNotificationClick error:", e);
    }
  };

  const dropdownPanel = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      ref={panelRef}
      tabIndex={-1}
      style={{
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
                      style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}
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
    </motion.div>
  );

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      open={visible}
      onOpenChange={setVisible}
      popupRender={() => dropdownPanel}
    >
      <Badge count={unreadCount} size="small">
        <button
          type="button"
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
    </Dropdown>
  );
}
