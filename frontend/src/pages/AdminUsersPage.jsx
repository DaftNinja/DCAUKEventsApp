import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", role: "user" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error:", err);
      navigate("/events");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = selectedUser
        ? `/api/admin/users/${selectedUser.id}`
        : "/api/admin/users";
      const method = selectedUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed");
      const updatedUser = await res.json();

      if (selectedUser) {
        setUsers((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? updatedUser : u))
        );
      } else {
        setUsers((prev) => [...prev, updatedUser]);
      }

      setShowForm(false);
      setSelectedUser(null);
      setForm({ email: "", name: "", role: "user" });
      alert("✓ User " + (selectedUser ? "updated" : "created") + "!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (u) => {
    setSelectedUser(u);
    setForm({ email: u.email, name: u.name, role: u.role });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete user?")) return;
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
      });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading)
    return (
      <div style={{ padding: "50px", color: "white", textAlign: "center" }}>
        Loading...
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px", color: "white" }}>
      <button
        onClick={() => navigate("/events")}
        style={{
          marginBottom: "20px",
          padding: "10px 20px",
          background: "white",
          color: "#667eea",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Back
      </button>

      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1>User Management</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setSelectedUser(null);
            setForm({ email: "", name: "", role: "user" });
          }}
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          {showForm ? "Cancel" : "+ Add User"}
        </button>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              background: "white",
              color: "#333",
              padding: "20px",
              borderRadius: "12px",
              marginTop: "20px",
              marginBottom: "20px",
            }}
          >
            <h3>{selectedUser ? "Edit User" : "Add User"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                required
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Name"
                required
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                marginTop: "10px",
              }}
            >
              <option value="user">User (view events, RSVP)</option>
              <option value="organizer">Organizer (create/manage events)</option>
              <option value="admin">Admin (manage users & events)</option>
            </select>

            <div style={{ marginTop: "10px" }}>
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginRight: "10px",
                }}
              >
                {selectedUser ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSelectedUser(null);
                }}
                style={{
                  padding: "10px 20px",
                  background: "#ccc",
                  color: "#333",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: "20px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: "12px", textAlign: "left", color: "#333" }}>
                  Email
                </th>
                <th style={{ padding: "12px", textAlign: "left", color: "#333" }}>
                  Name
                </th>
                <th style={{ padding: "12px", textAlign: "left", color: "#333" }}>
                  Role
                </th>
                <th style={{ padding: "12px", textAlign: "left", color: "#333" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px", color: "#333" }}>{u.email}</td>
                  <td style={{ padding: "12px", color: "#333" }}>{u.name}</td>
                  <td style={{ padding: "12px", color: "#333" }}>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "12px",
                        background:
                          u.role === "admin"
                            ? "#fee2e2"
                            : u.role === "organizer"
                              ? "#dbeafe"
                              : "#f3e8ff",
                        color:
                          u.role === "admin"
                            ? "#7f1d1d"
                            : u.role === "organizer"
                              ? "#1e40af"
                              : "#6b21a8",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <button
                      onClick={() => handleEdit(u)}
                      style={{
                        padding: "6px 12px",
                        background: "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "8px",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{
                        padding: "6px 12px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
