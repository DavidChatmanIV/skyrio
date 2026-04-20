import React, { useEffect, useState } from "react";
import { Table, Tag, Card, Typography, message, Spin } from "antd";
import { useAuth } from "../../auth/useAuth";

const { Title, Text } = Typography;

export default function AdminUsersPage() {
  const { user, token } = useAuth(); // assuming your hook exposes token
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load users.");
        }

        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error(err);
        message.error(err.message || "Could not fetch users.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => text || record.username || "(no name)",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email) => <Text copyable>{email || "—"}</Text>,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role) => {
        let color = "default";
        if (role === "admin") color = "red";
        if (role === "manager") color = "gold";
        if (role === "support") color = "blue";
        return <Tag color={color}>{role || "user"}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive) =>
        isActive === false ? (
          <Tag color="default">Inactive</Tag>
        ) : (
          <Tag color="green">Active</Tag>
        ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "Unknown",
    },
    {
      title: "Actions",
      key: "actions",
      render: () => (
        <Text type="secondary" italic>
          Role editor coming soon…
        </Text>
      ),
    },
  ];

  return (
    <Card
      style={{ margin: 24 }}
      title={
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Title level={4} style={{ margin: 0 }}>
            👑 Admin · User Management
          </Title>
          <Text type="secondary">
            Logged in as:{" "}
            <Text strong>{user?.email || user?.username || "Admin"}</Text>
          </Text>
        </div>
      }
    >
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "40px 0",
          }}
        >
          <Spin tip="Loading users..." />
        </div>
      ) : (
        <Table
          rowKey={(row) => row._id}
          dataSource={users}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      )}
    </Card>
  );
}