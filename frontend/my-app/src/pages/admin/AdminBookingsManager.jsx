import React, { useEffect, useState } from "react";
import { Table, Button, Space, Tag, Popconfirm, message, Result } from "antd";
import { DownloadOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAuth } from "../../auth/useAuth"; // adjust path if needed

export default function AdminBookingsManager() {
  const { user, loading: authLoading } = useAuth();

  // 🔐 Simple frontend role check
  const isAdmin = user?.role === "admin" || user?.isAdmin === true;

  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [sorter, setSorter] = useState({
    field: "createdAt",
    order: "descend",
  });

  // ---------- Fetch bookings ----------
  const fetchBookings = async (
    page = 1,
    pageSize = 20,
    sorterState = sorter
  ) => {
    try {
      setLoading(true);

      const sortBy = sorterState.field || "createdAt";
      const sortDir = sorterState.order === "ascend" ? "asc" : "desc";

      const res = await fetch(
        `/api/bookings?page=${page}&limit=${pageSize}&sortBy=${sortBy}&sortDir=${sortDir}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch bookings");
      }

      const json = await res.json();

      setData(json.items || []);
      setPagination((prev) => ({
        ...prev,
        current: json.page,
        pageSize: json.limit,
        total: json.total,
      }));
    } catch (err) {
      console.error("Failed to load bookings:", err);
      message.error("Could not load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBookings(1, pagination.pageSize, sorter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleTableChange = (newPagination, _filters, newSorter) => {
    const updatedSorter = {
      field: newSorter.field || "createdAt",
      order: newSorter.order || "descend",
    };
    setSorter(updatedSorter);
    fetchBookings(newPagination.current, newPagination.pageSize, updatedSorter);
  };

  // ---------- Delete booking (Admin) ----------
  const handleDelete = async (id) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to delete booking");
      }

      message.success("Booking deleted");
      // reload current page
      fetchBookings(pagination.current, pagination.pageSize, sorter);
    } catch (err) {
      console.error("Delete booking failed:", err);
      message.error(err.message || "Could not delete booking");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Export to CSV ----------
  const handleExportCsv = () => {
    if (!data || data.length === 0) {
      message.info("No bookings to export yet.");
      return;
    }

    const headers = [
      "Booking ID",
      "User Email",
      "Hotel",
      "Flight",
      "Package",
      "Place",
      "Dates",
      "Travelers",
      "Created At",
    ];

    const rows = data.map((b) => [
      b._id,
      b.user?.email || "",
      b.hotel?.name || b.hotel?.title || "",
      b.flight?.code || b.flight?.name || "",
      b.package?.name || b.package?.title || "",
      b.place?.name || b.place?.city || "",
      Array.isArray(b.dates) ? b.dates.join(" - ") : b.dates || "",
      b.travelers ?? "",
      b.createdAt ? new Date(b.createdAt).toISOString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const val = cell ?? "";
            if (typeof val === "string" && val.includes(",")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-export-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ---------- Table columns ----------
  const columns = [
    {
      title: "Booking ID",
      dataIndex: "_id",
      key: "_id",
      width: 220,
    },
    {
      title: "User",
      dataIndex: ["user", "email"],
      key: "user",
    },
    {
      title: "Hotel",
      key: "hotel",
      render: (_, record) => record.hotel?.name || record.hotel?.title || "—",
    },
    {
      title: "Flight",
      key: "flight",
      render: (_, record) => record.flight?.code || record.flight?.name || "—",
    },
    {
      title: "Package",
      key: "package",
      render: (_, record) =>
        record.package?.name || record.package?.title || "—",
    },
    {
      title: "Place",
      key: "place",
      render: (_, record) =>
        record.place?.name ||
        record.place?.city ||
        record.place?.country ||
        "—",
    },
    {
      title: "Travelers",
      dataIndex: "travelers",
      key: "travelers",
      width: 90,
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: true,
      render: (value) => (value ? new Date(value).toLocaleString() : ""),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="Delete this booking?"
          okText="Yes"
          cancelText="No"
          onConfirm={() => handleDelete(record._id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ---------- Admin-only protection UI ----------
  if (authLoading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="Admin Only"
        subTitle="You need an admin account to view bookings manager."
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space
        style={{
          marginBottom: 16,
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <Space>
          <h2 style={{ margin: 0 }}>Admin Booking Manager</h2>
          <Tag color="magenta">Admin</Tag>
        </Space>

        <Button
          icon={<DownloadOutlined />}
          onClick={handleExportCsv}
          disabled={loading || !data.length}
        >
          Export CSV
        </Button>
      </Space>

      <Table
        rowKey="_id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
      />
    </div>
  );
}