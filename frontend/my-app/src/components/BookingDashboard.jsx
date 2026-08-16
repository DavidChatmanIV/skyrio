import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { apiUrl } from "@/lib/api";

const BookingDashboard = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    type: "",
    tripDetails: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin-login");
      return;
    }

    fetch(apiUrl("/api/bookings"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized or fetch failed");
        return res.json();
      })
      .then((data) => {
        setBookings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading bookings:", err);
        navigate("/admin-login");
      });
  }, [navigate]);

  const filtered = bookings.filter((booking) => {
    const q = search.toLowerCase();
    return (
      booking.name.toLowerCase().includes(q) ||
      booking.email.toLowerCase().includes(q) ||
      booking.type.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this booking?"))
      return;
    try {
      const res = await fetch(apiUrl(`/api/book/${id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete booking");
      setBookings((prev) => prev.filter((b) => b._id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete. Please try again.");
    }
  };

  const handleEdit = (booking) => {
    setEditingId(booking._id);
    setEditData({
      name: booking.name,
      email: booking.email,
      type: booking.type,
      tripDetails: booking.tripDetails,
    });
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(apiUrl(`/api/book/${editingId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(editData),
      });
      if (!res.ok) throw new Error("Failed to save edit");
      const updated = await res.json();
      setBookings((prev) =>
        prev.map((b) => (b._id === editingId ? updated : b))
      );
      setEditingId(null);
    } catch (err) {
      console.error("Edit save error:", err);
      alert("Update failed. Try again.");
    }
  };

  const handleCancelEdit = () => setEditingId(null);

  const handleExportCSV = () => {
    const csv = Papa.unparse(
      bookings.map(({ name, email, type, tripDetails, date }) => ({
        Name: name,
        Email: email,
        Type: type,
        "Trip Details": tripDetails,
        Date: new Date(date).toLocaleString(),
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bookings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">📋 Booking Dashboard</h2>

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded shadow"
        >
          ⬇️ Export to CSV
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("adminToken");
            navigate("/admin-login");
          }}
          className="px-4 py-2 bg-red-500 text-white rounded shadow"
        >
          🔒 Logout
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name, email, or type..."
        className="mb-4 p-2 border border-gray-300 rounded w-full"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setCurrentPage(1);
        }}
      />

      {loading ? (
        <p className="text-gray-500">Loading bookings...</p>
      ) : filtered.length === 0 ? (
        <p className="text-red-500">No matching bookings found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3 border">Name</th>
                <th className="p-3 border">Email</th>
                <th className="p-3 border">Type</th>
                <th className="p-3 border">Trip Details</th>
                <th className="p-3 border">Date</th>
                <th className="p-3 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  {editingId === b._id ? (
                    <>
                      <td className="p-3 border">
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className="border p-1 rounded w-full"
                        />
                      </td>
                      <td className="p-3 border">
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) =>
                            setEditData({ ...editData, email: e.target.value })
                          }
                          className="border p-1 rounded w-full"
                        />
                      </td>
                      <td className="p-3 border">
                        <input
                          type="text"
                          value={editData.type}
                          onChange={(e) =>
                            setEditData({ ...editData, type: e.target.value })
                          }
                          className="border p-1 rounded w-full"
                        />
                      </td>
                      <td className="p-3 border">
                        <input
                          type="text"
                          value={editData.tripDetails}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              tripDetails: e.target.value,
                            })
                          }
                          className="border p-1 rounded w-full"
                        />
                      </td>
                      <td className="p-3 border">
                        {new Date(b.date).toLocaleString()}
                      </td>
                      <td className="p-3 border space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-2 py-1 bg-green-600 text-white rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 bg-gray-500 text-white rounded"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border">{b.name}</td>
                      <td className="p-3 border">{b.email}</td>
                      <td className="p-3 border">{b.type}</td>
                      <td className="p-3 border">{b.tripDetails}</td>
                      <td className="p-3 border">
                        {new Date(b.date).toLocaleString()}
                      </td>
                      <td className="p-3 border space-x-2">
                        <button
                          onClick={() => handleEdit(b)}
                          className="px-2 py-1 bg-yellow-400 text-white rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(b._id)}
                          className="px-2 py-1 bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              ⬅️ Previous
            </button>
            <div className="space-x-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 rounded ${
                    currentPage === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next ➡️
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDashboard;
