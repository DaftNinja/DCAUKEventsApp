import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";
import EventForm from "./EventForm";

const ADMIN_EMAIL = "andrew@mccreath.vip";

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "", location: "", startDate: "", startTime: "", endDate: "", endTime: "",
    organiser: "", organizerEmail: "", sponsors: "", description: ""
  });

  useEffect(() => {
    loadAdmin();
  }, []);

  const loadAdmin = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      
      const token = localStorage.getItem("token");
      const response = await fetch("/api/events", { headers: { "Authorization": `Bearer ${token}` } });
      setEvents(await response.json());
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCancel = () => {
    setFormData({ title: "", location: "", startDate: "", startTime: "", endDate: "", endTime: "", organiser: "", organizerEmail: "", sponsors: "", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const start = new Date(`${formData.startDate}T${formData.startTime}`);
      const end = new Date(`${formData.endDate}T${formData.endTime}`);
      const eventData = {
        title: formData.title,
        location: formData.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        organiser: formData.organiser,
        organizerEmail: formData.organizerEmail,
        sponsors: formData.sponsors,
        description: formData.description,
      };

      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) throw new Error("Failed to create");
      const newEvent = await response.json();
      setEvents(prev => [...prev, newEvent]);
      handleCancel();
      alert("✓ Event created!");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleEdit = (event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    setFormData({
      title: event.title,
      location: event.location,
      startDate: start.toISOString().split('T')[0],
      startTime: start.toTimeString().slice(0, 5),
      endDate: end.toISOString().split('T')[0],
      endTime: end.toTimeString().slice(0, 5),
      organiser: event.organiser,
      organizerEmail: event.organizerEmail || "",
      sponsors: event.eventUrl || "",
      description: event.description || "",
    });
    setEditingId(event.id);
    setShowForm(true);
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`/api/events/${id}/approve`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed");
      const updated = await response.json();
      setEvents(prev => prev.map(e => e.id === id ? updated : e));
      alert("✓ Approved!");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    try {
      const response = await fetch(`/api/events/${id}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed");
      const updated = await response.json();
      setEvents(prev => prev.map(e => e.id === id ? updated : e));
      alert("✓ Rejected!");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this event?")) return;
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed");
      setEvents(prev => prev.filter(e => e.id !== id));
      alert("✓ Deleted!");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const canEdit = (event) => isAdmin || user?.email === event.organizerEmail;

  if (loading) return <div style={{ color: "white", padding: "50px" }}>Loading...</div>;

  const getBorderColor = (status) => {
    if (status === "approved") return "#10b981";
    if (status === "rejected") return "#ef4444";
    return "#fbbf24";
  };

  const getStatusColor = (status) => {
    if (status === "approved") return { bg: "#d1fae5", text: "#065f46" };
    if (status === "rejected") return { bg: "#fee2e2", text: "#7f1d1d" };
    return { bg: "#fef3c7", text: "#92400e" };
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", minHeight: "100vh", padding: "40px 20px", color: "white" }}>
      <button onClick={() => navigate("/events")} style={{marginBottom: "20px", padding: "10px 20px", background: "white", color: "#667eea", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
        ← Back
      </button>

      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1>Admin Events ({events.length})</h1>
        <p>Logged in as: <strong>{user?.email}</strong></p>

        {isAdmin && (
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); }} style={{marginTop: "20px", padding: "12px 24px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
            {showForm ? "Cancel" : "+ Create Event"}
          </button>
        )}

        {showForm && <EventForm formData={formData} editingEventId={editingId} onInputChange={handleInputChange} onSubmit={handleSubmit} onCancel={handleCancel} />}

        <div style={{ marginTop: "30px" }}>
          {events.length === 0 ? (
            <p style={{ fontSize: "1.1em" }}>No events yet!</p>
          ) : (
            events.map((event) => (
              <div key={event.id} style={{
                background: "white",
                color: "#333",
                padding: "20px",
                marginBottom: "15px",
                borderRadius: "8px",
                border: `3px solid ${getBorderColor(event.status)}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{margin: "0 0 5px 0"}}>{event.title}</h3>
                    <span style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "0.85em",
                      fontWeight: "600",
                      background: getStatusColor(event.status).bg,
                      color: getStatusColor(event.status).text
                    }}>
                      {event.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {canEdit(event) && <button onClick={() => handleEdit(event)} style={{padding: "8px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>✏️ Edit</button>}
                    {isAdmin && <button onClick={() => handleDelete(event.id)} style={{padding: "8px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>🗑️ Delete</button>}
                  </div>
                </div>

                <p><strong>📍 Location:</strong> {event.location}</p>
                <p><strong>📅 Date:</strong> {new Date(event.startDate).toLocaleDateString("en-GB")}</p>
                <p><strong>⏰ Time:</strong> {new Date(event.startDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - {new Date(event.endDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                <p><strong>🎤 Organiser:</strong> {event.organiser}</p>
                <p><strong>📧 Email:</strong> {event.organizerEmail}</p>
                {event.description && <p><strong>📝 Description:</strong> {event.description}</p>}

                {event.status === "pending" && user?.email === event.organizerEmail && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e0e0e0" }}>
                    <button onClick={() => handleApprove(event.id)} style={{padding: "10px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
                      ✅ Approve
                    </button>
                    <button onClick={() => handleReject(event.id)} style={{padding: "10px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
                      ❌ Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
