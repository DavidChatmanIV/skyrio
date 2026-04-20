import React, { useEffect, useState } from "react";
import { Table, Tag, Select, Switch, Input, Space, message, Card } from "antd";
import { useAuth } from "../auth/useAuth"; // assuming you have this

const { Search } = Input;
const ROLE_OPTIONS = ["user", "support", "manager", "admin"];

export default function AdminUsersTable() {
  const { token } = useAuth(); // or however you store JWT
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [search, setSearch] = useState("");

  const fetchUsers = async (page = 1, pageSize = 20, searchTerm = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: pageSize,
        search: searchTerm,
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load users");

      setUsers(data.items);
      setPagination({
        current: data.page,
        pageSize: data.limit,
        total: data.total,
      });
    } catch (err) {
      console.error(err);
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchUsers(1, pagination.pageSize, search);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (paginationConfig) => {
    fetchUsers(paginationConfig.current, paginationConfig.pageSize, search);
  };

  const handleSearch = (value) => {
    setSearch(value);
    fetchUsers(1, pagination.pageSize, value);
  };

  const updateRole = async (userId, role) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update role");
      message.success("Role updated");
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: data.role } : u))
      );
    } catch (err) {
      console.error(err);
      message.error(err.message);
    }
  };

  const updateStatus = async (userId, isActive) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");
      message.success("Status updated");
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, isActive: data.isActive } : u
        )
      );
    } catch (err) {
      console.error(err);
      message.error(err.message);
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (text, record) => text || record.email.split("@")[0],
    },
    {
      title: "Email",
      dataIndex: "email",
    },
    {
      title: "Role",
      dataIndex: "role",
      render: (role, record) => (
        <Select
          value={role}
          style={{ width: 120 }}
          onChange={(value) => updateRole(record._id, value)}
        >
          {ROLE_OPTIONS.map((r) => (
            <Select.Option key={r} value={r}>
              {r.toUpperCase()}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (isActive, record) => (
        <Space>
          <Switch
            checked={isActive}
            onChange={(checked) => updateStatus(record._id, checked)}
          />
          <Tag color={isActive ? "green" : "red"}>
            {isActive ? "Active" : "Disabled"}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <Card
      title="User Management"
      extra={
        <Search
          placeholder="Search by name or email"
          allowClear
          onSearch={handleSearch}
          style={{ width: 260 }}
        />
      }
    >
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />
    </Card>
  );
}
