import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dropdown,
  Empty,
  Space,
  Typography,
  message,
  Divider,
  Tag,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  MessageOutlined,
  CalendarOutlined,
  GiftOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";
import { useAuth } from "../auth/useAuth";
import { apiUrl } from "@/lib/api";

const { Text } = Typography;

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function iconFor(n) {
  const type = (n?.type || "").toLowerCase();
  const event = (n?.event || "").toLowerCase();
  if (event.includes("price") || type.includes("price"))
    return <DollarOutlined />;
  if (type.includes("dm") || event.includes("message"))
    return <MessageOutlined />;
  if (type.includes("booking") || event.includes("booking"))
    return <CalendarOutlined />;
  if (type.includes("xp") || event.includes("reward")) return <GiftOutlined />;
  return <ThunderboltOutlined />;
}

export default function NotificationsBell({ maxItems = 20 }) {
  const nav = useNavigate();
  const auth = useAuth();
  const userId = auth?.user?.id || auth?.user?._id;

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMine = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/notifications/mine"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUnread(Number(data?.unread || 0));
      setItems(Array.isArray(data?.items) ? data.items.slice(0, maxItems) : []);
    } catch {
      if (open) message.error("Couldn't load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    const prevUnread = unread;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const res = await fetch(apiUrl("/api/notifications/read-all"), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      message.success("All caught up ✅");
    } catch {
      setUnread(prevUnread);
      fetchMine();
      message.error("Couldn't mark all as read");
    }
  };

  const markOneRead = async (id) => {
    const target = items.find((x) => x._id === id);
    if (!target || target.isRead) return;
    setItems((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(apiUrl(`/api/notifications/${id}/read`), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
    } catch {
      fetchMine();
      message.error("Couldn't mark as read");
    }
  };

  const removeOne = async (id) => {
    const prev = items;
    setItems((p) => p.filter((n) => n._id !== id));
    try {
      const res = await fetch(apiUrl(`/api/notifications/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      message.success("Removed");
      fetchMine();
    } catch {
      setItems(prev);
      message.error("Couldn't delete");
    }
  };

  useEffect(() => {
    fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    socket.emit("notifications:join", { userId });
    const onNew = (notif) => {
      setItems((prev) => [notif, ...prev].slice(0, maxItems));
      setUnread((u) => u + 1);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [userId, maxItems]);

  useEffect(() => {
    if (open) fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const menuItems = useMemo(() => {
    const header = {
      key: "__header",
      label: (
        <div style={{ padding: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "rgba(255,255,255,.92)", fontWeight: 800 }}>
              Notifications
            </Text>
            <Button
              size="small"
              className="sk-ghostBtn"
              icon={<CheckOutlined />}
              disabled={!unread}
              onClick={(e) => {
                e?.domEvent?.stopPropagation?.();
                markAllRead();
              }}
            >
              Mark all read
            </Button>
          </div>
          <div style={{ marginTop: 6 }}>
            <Text style={{ color: "rgba(255,255,255,.70)", fontSize: 12 }}>
              {unread ? `${unread} unread` : "You're all caught up"}
            </Text>
          </div>
          <Divider
            style={{ margin: "10px 0", borderColor: "rgba(255,255,255,.10)" }}
          />
        </div>
      ),
      disabled: true,
    };

    if (!items.length) {
      return [
        header,
        {
          key: "__empty",
          label: (
            <div style={{ padding: 10 }}>
              <Empty
                description={
                  <Text style={{ color: "rgba(255,255,255,.78)" }}>
                    No notifications yet
                  </Text>
                }
              />
            </div>
          ),
          disabled: true,
        },
      ];
    }

    return [
      header,
      ...items.map((n) => {
        const isUnread = !n.isRead;
        const link = n.link || "/";
        return {
          key: n._id,
          label: (
            <div
              style={{
                padding: 10,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.10)",
                background: isUnread
                  ? "linear-gradient(180deg, rgba(255,138,42,.16), rgba(255,255,255,.04))"
                  : "rgba(255,255,255,.04)",
              }}
              onClick={async () => {
                if (isUnread) await markOneRead(n._id);
                setOpen(false);
                nav(link);
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Space size={8}>
                  <span style={{ color: "rgba(255,255,255,.85)" }}>
                    {iconFor(n)}
                  </span>
                  <Text
                    style={{ color: "rgba(255,255,255,.92)", fontWeight: 800 }}
                  >
                    {n.title || "Notification"}
                  </Text>
                  {isUnread && (
                    <Tag color="orange" style={{ marginInlineStart: 6 }}>
                      NEW
                    </Tag>
                  )}
                </Space>
                <Text style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>
                  {timeAgo(n.createdAt)}
                </Text>
              </div>
              <div style={{ marginTop: 6 }}>
                <Text style={{ color: "rgba(255,255,255,.78)" }}>
                  {n.message || ""}
                </Text>
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Space size={8}>
                  <Text
                    style={{ color: "rgba(255,255,255,.60)", fontSize: 12 }}
                  >
                    {isUnread ? "Unread" : "Read"}
                  </Text>
                </Space>
                <Space size={8}>
                  {isUnread && (
                    <Button
                      size="small"
                      className="sk-ghostBtn"
                      onClick={(e) => {
                        e?.domEvent?.stopPropagation?.();
                        markOneRead(n._id);
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    size="small"
                    className="sk-ghostBtn"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e?.domEvent?.stopPropagation?.();
                      removeOne(n._id);
                    }}
                  />
                </Space>
              </div>
            </div>
          ),
        };
      }),
    ];
  }, [items, unread, nav]);

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        items: menuItems,
        style: {
          width: 390,
          background: "rgba(18, 14, 34, .92)",
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 18,
          padding: 10,
          backdropFilter: "blur(12px)",
        },
      }}
    >
      <Badge count={unread} overflowCount={99} offset={[-2, 2]}>
        <Button
          className="sk-ghostBtn"
          icon={<BellOutlined />}
          loading={loading}
          onClick={() => setOpen((s) => !s)}
        >
          Alerts
        </Button>
      </Badge>
    </Dropdown>
  );
}
