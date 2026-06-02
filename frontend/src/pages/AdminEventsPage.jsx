import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";
import Navbar from "../components/Navbar";

const ADMIN_EMAIL = "andrew@mccreath.vip";

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "", location: "", startDate: "", startTime: "", endDate: "",
    endTime: "", organiser: "", organizerEmail: "", sponsors: "", description: ""
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/events", { headers: { "Authorization": `Bearer ${token}` } });
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setForm({ title: "", location: "", startDate: "", startTime: "", endDate: "", endTime: "", organiser: "", organizerEmail: "", sponsors: "", description: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const start = new Date(`${form.startDate}T${form.startTime}`);
      const end = new Date(`${form.endDate}T${form.endTime}`);
      const eventData = {
        title: form.title, location: form.location,
        startDate: start.toISOString(), endDate: end.toISOString(),
        organiser: form.organiser, organizerEmail: form.organizerEmail,
        sponsors: form.sponsors, description: form.description
      };

      if (editingId) {
        const res = await fetch(`/api/events/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
          body: JSON.stringify(eventData)
        });
        if (!res.ok) throw new Error("Failed to update");
        const updated = await res.json();
        setEvents(prev => prev.map(e => e.id === editingId ? updated : e));
        resetForm(); setShowForm(false);
        alert("✓ Event updated!");
        return;
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(eventData)
      });
      if (!res.ok) throw new Error("Failed");
      const newEvent = await res.json();
      setEvents(prev => [...prev, newEvent]);
      resetForm(); setShowForm(false);
      alert("✓ Event created!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (e) => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    setForm({
      title: e.title, location: e.location,
      startDate: start.toISOString().split('T')[0],
      startTime: start.toTimeString().slice(0, 5),
      endDate: end.toISOString().split('T')[0],
      endTime: end.toTimeString().slice(0, 5),
      organiser: e.organiser, organizerEmail: e.organizerEmail || "",
      sponsors: e.eventUrl || "", description: e.description || ""
    });
    setEditingId(e.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete?")) return;
    try {
      await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const canEdit = (e) => isAdmin || user?.email === e.organizerEmail;

  if (loading) return (
    <div>
      <Navbar />
      <div style={{ padding: "50px", textAlign: "center", color: "#64748b" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>Admin — Events ({events.length})</h1>
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{user?.email}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              style={{ padding: "0.5rem 1rem", background: "#06b6d4", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}
            >
              {showForm ? "Cancel" : "+ Create Event"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: "white", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "#1e293b" }}>{editingId ? "Edit Event" : "Create Event"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[["title","Title",true],["location","Location",true]].map(([name, ph, req]) => (
                <input key={name} type="text" name={name} value={form[name]} onChange={handleChange} placeholder={ph} required={req} style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
              ))}
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange} required style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
              <input type="date" name="endDate" value={form.endDate} onChange={handleChange} required style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
              <input type="time" name="endTime" value={form.endTime} onChange={handleChange} required style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
              <input type="text" name="organiser" value={form.organiser} onChange={handleChange} placeholder="Organiser Name" required style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
              <input type="email" name="organizerEmail" value={form.organizerEmail} onChange={handleChange} placeholder="Organiser Email" required style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem" }} />
            </div>
            <input type="text" name="sponsors" value={form.sponsors} onChange={handleChange} placeholder="Event URL / Sponsors" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", marginTop: "0.75rem", boxSizing: "border-box" }} />
            <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" rows="3" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", marginTop: "0.75rem", boxSizing: "border-box", fontFamily: "inherit" }} />
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={{ padding: "0.5rem 1rem", background: "#06b6d4", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>{editingId ? "Update" : "Create"}</button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} style={{ padding: "0.5rem 1rem", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {events.map(e => (
            <div key={e.id} style={{ background: "white", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.375rem 0", color: "#1e293b" }}>{e.title}</h3>
                  <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", background: e.status === "approved" ? "#d1fae5" : e.status === "rejected" ? "#fee2e2" : "#fef3c7", color: e.status === "approved" ? "#065f46" : e.status === "rejected" ? "#7f1d1d" : "#92400e" }}>{e.status}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {canEdit(e) && <button onClick={() => handleEdit(e)} style={{ padding: "0.375rem 0.75rem", background: "#3b82f6", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>Edit</button>}
                  {isAdmin && <button onClick={() => handleDelete(e.id)} style={{ padding: "0.375rem 0.75rem", background: "#ef4444", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>Delete</button>}
                </div>
              </div>
              <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#475569" }}><strong>Location:</strong> {e.location}</p>
              <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#475569" }}><strong>Date:</strong> {new Date(e.startDate).toLocaleDateString("en-GB")} {new Date(e.startDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#475569" }}><strong>Organiser:</strong> {e.organiser} · {e.organizerEmail}</p>
              {e.description && <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>{e.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
