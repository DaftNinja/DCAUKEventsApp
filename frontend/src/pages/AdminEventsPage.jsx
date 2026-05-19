import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";

const ADMIN_EMAIL = "andrew@mccreath.vip";

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    location: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    organiser: "",
    organizerEmail: "",
    sponsors: "",
    description: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      
      const token = localStorage.getItem("token");
      const res = await fetch("/api/events", { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const start = new Date(`${form.startDate}T${form.startTime}`);
      const end = new Date(`${form.endDate}T${form.endTime}`);

      const eventData = {
        title: form.title,
        location: form.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        organiser: form.organiser,
        organizerEmail: form.organizerEmail,
        sponsors: form.sponsors,
        description: form.description
      };

      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(eventData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      const newEvent = await res.json();
      setEvents(prev => [...prev, newEvent]);
      setForm({
        title: "", location: "", startDate: "", startTime: "", endDate: "", 
        endTime: "", organiser: "", organizerEmail: "", sponsors: "", description: ""
      });
      setShowForm(false);
      alert("✓ Event created!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this event?")) return;
    try {
      await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setEvents(prev => prev.filter(e => e.id !== id));
      alert("✓ Deleted!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`/api/events/${id}/approve`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const updated = await res.json();
      setEvents(prev => prev.map(e => e.id === id ? updated : e));
      alert("✓ Approved!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/events/${id}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ reason })
      });
      const updated = await res.json();
      setEvents(prev => prev.map(e => e.id === id ? updated : e));
      alert("✓ Rejected!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) {
    return <div style={{padding: "50px", color: "white"}}>Loading...</div>;
  }

  return (
    <div style={{background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", minHeight: "100vh", padding: "40px 20px", color: "white"}}>
      <button onClick={() => navigate("/events")} style={{marginBottom: "20px", padding: "10px 20px", background: "white", color: "#667eea", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>Back</button>
      
      <div style={{maxWidth: "1200px", margin: "0 auto"}}>
        <h1>Admin Events ({events.length})</h1>
        <p>{user?.email}</p>

        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} style={{marginTop: "20px", padding: "12px 24px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
            {showForm ? "Cancel" : "+ Create Event"}
          </button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} style={{background: "white", color: "#333", padding: "30px", borderRadius: "12px", marginTop: "20px", marginBottom: "30px"}}>
            <h3 style={{marginTop: 0}}>Create New Event</h3>

            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px"}}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Title *</label>
                <input type="text" name="title" value={form.title} onChange={handleChange} required placeholder="Event title" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Location *</label>
                <input type="text" name="location" value={form.location} onChange={handleChange} required placeholder="e.g., London, UK" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px"}}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Start Date *</label>
                <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Start Time *</label>
                <input type="time" name="startTime" value={form.startTime} onChange={handleChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px"}}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>End Date *</label>
                <input type="date" name="endDate" value={form.endDate} onChange={handleChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>End Time *</label>
                <input type="time" name="endTime" value={form.endTime} onChange={handleChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px"}}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Organiser Name *</label>
                <input type="text" name="organiser" value={form.organiser} onChange={handleChange} required placeholder="e.g., DCA EMEA" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Organiser Email *</label>
                <input type="email" name="organizerEmail" value={form.organizerEmail} onChange={handleChange} required placeholder="organizer@example.com" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Sponsors</label>
              <input type="text" name="sponsors" value={form.sponsors} onChange={handleChange} placeholder="e.g., Company A, Company B" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
            </div>

            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Event description (optional)" rows="4" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box", fontFamily: "inherit"}} />
            </div>

            <div style={{display: "flex", gap: "10px"}}>
              <button type="submit" style={{padding: "12px 24px", background: "#667eea", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>Create Event</button>
              <button type="button" onClick={() => setShowForm(false)} style={{padding: "12px 24px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>Cancel</button>
            </div>
          </form>
        )}

        <div style={{marginTop: "30px"}}>
          {events.map(e => (
            <EventCard key={e.id} event={e} user={user} isAdmin={isAdmin} onDelete={handleDelete} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, user, isAdmin, onDelete, onApprove, onReject }) {
  const getBorderColor = () => {
    if (event.status === "approved") return "#10b981";
    if (event.status === "rejected") return "#ef4444";
    return "#fbbf24";
  };

  const getStatusColor = () => {
    if (event.status === "approved") return { bg: "#d1fae5", text: "#065f46" };
    if (event.status === "rejected") return { bg: "#fee2e2", text: "#7f1d1d" };
    return { bg: "#fef3c7", text: "#92400e" };
  };

  const showApprovalButtons = event.status === "pending" && user?.email === event.organizerEmail;

  return (
    <div style={{background: "white", color: "#333", padding: "20px", marginBottom: "15px", borderRadius: "8px", border: `3px solid ${getBorderColor()}`}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px"}}>
        <div>
          <h3 style={{margin: "0 0 8px 0"}}>{event.title}</h3>
          <span style={{display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85em", fontWeight: "600", background: getStatusColor().bg, color: getStatusColor().text}}>
            {event.status.toUpperCase()}
          </span>
        </div>
        {isAdmin && (
          <button onClick={() => onDelete(event.id)} style={{padding: "8px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>🗑️ Delete</button>
        )}
      </div>

      <p><strong>📍 Location:</strong> {event.location}</p>
      <p><strong>📅 Date:</strong> {new Date(event.startDate).toLocaleDateString("en-GB")}</p>
      <p><strong>⏰ Time:</strong> {new Date(event.startDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - {new Date(event.endDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
      <p><strong>🎤 Organiser:</strong> {event.organiser}</p>
      <p><strong>📧 Email:</strong> {event.organizerEmail}</p>
      {event.description && <p><strong>📝 Description:</strong> {event.description}</p>}
      <p><strong>👥 Attendees:</strong> {event.attendees?.length || 0}</p>

      {showApprovalButtons && (
        <div style={{display: "flex", gap: "10px", marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e0e0e0"}}>
          <button onClick={() => onApprove(event.id)} style={{padding: "10px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>✅ Approve</button>
          <button onClick={() => onReject(event.id)} style={{padding: "10px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>❌ Reject</button>
        </div>
      )}
    </div>
  );
}
