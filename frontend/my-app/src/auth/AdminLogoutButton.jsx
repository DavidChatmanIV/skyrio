import React, { useState } from "react";
import { Button, message } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

export default function AdminLogoutButton({
  size = "middle",
  type = "default",
  children = "Logout",
}) {
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const onLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/logout"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error("Logout failed");

      message.success("Logged out");
      nav("/admin/login");
    } catch (e) {
      message.error(e?.message || "Logout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      icon={<LogoutOutlined />}
      onClick={onLogout}
      loading={loading}
      size={size}
      type={type}
    >
      {children}
    </Button>
  );
}
