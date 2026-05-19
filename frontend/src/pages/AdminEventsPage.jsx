import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";
import "./AdminEventsPage.css";

const ADMIN_EMAIL = "andrew@mccreath.vip";

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    organiser: "",
    organizerEmail: "",
    sponsors: "",
    description: "",
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      
      const token = localStorage.getItem("token");
      const response = await fetch("/api/events", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      location: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      organiser: "",
      organizerEmail: "",
      sponsors: "",
      description: "",
    });
    setEditingEventId(null);
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

      const eventData = {
        title: formData.title,
        location: formData.location,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        organiser: formData.organiser,
        organizerEmail: formData.organizerEmail,
        sponsors: formData.sponsors,
        description: formData.description,
        isVirtual: formData.location.toLowerCase() === "virtual",
      };

      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create event");
      }

      const newEvent = await response.json();
      setEvents((prev) => [...prev, newEvent]);
      resetForm();
      setShowCreateForm(false);
      alert("✓ Event created! Organizer notification sent for approval.");
    } catch (error) {
      console.error("Failed to create event:", error);
      alert("Failed: " + error.message);
    }
  };

  const handleEditEvent = (event) => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    setFormData({
      title: event.title,
      location: event.location,
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endDate: endDate.toISOString().split('T')[0],
      endTime: endDate.toTimeString().slice(0, 5),
      organiser: event.organiser,
      organizerEmail: event.organizerEmail || "",
      sponsors: event.eventUrl || "",
      description: event.description || "",
    });
    setEditingEventId(event.id);
    setShowCreateForm(true);
  };

  const handleApproveEvent = async (eventId) => {
    try {
      const response = await fetch(`/api/events/${eventId}/approve`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to approve");
      
      const updated = await response.json();
      setEvents((prev) => prev.map((e) => e.id === eventId ? updated : e));
      alert("✓ Event approved!");
    } catch (error) {
      alert("Failed to approve: " + error.message);
    }
  };

  const handleRejectEvent = async (eventId) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;

    try {
      const response = await fetch(`/api/events/${eventId}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error("Failed to reject");
      
      const updated = await response.json();
      setEvents((prev) => prev.map((e) => e.id === eventId ? updated : e));
      alert("✓ Event rejected!");
    } catch (error) {
      alert("Failed to reject: " + error.message);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Delete this event permanently?")) return;

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete");
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      alert("✓ Event deleted!");
    } catch (error) {
      alert("Failed: " + error.message);
    }
  };

  const canEditEvent = (event) => {
    return isAdmin || user?.email === event.organizerEmail;
  };

  if (loading) {
    return <div style={{ color: "white", padding: "50px" }}>Loading...</div>;
  }

  return (
    <div style={{
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      minHeight: "100vh",
      padding: "40px 20px",
      color: "white"
    }}>
      <button onClick={() => navigate("/events")} style={{marginBottom: "20px", padding: "10px 20px", background: "white", color: "#667eea", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
        ← Back to Events
      </button>

      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1>Admin Events ({events.length})</h1>
        <p>Logged in as: <strong>{user?.email}</strong></p>

        {isAdmin && (
          <button onClick={() => { resetForm(); setShowCreateForm(!showCreateForm); }} style={{marginTop: "20px", padding: "12px 24px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
            {showCreateForm ? "Cancel" : "+ Create Event"}
          </button>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreateEvent} style={{
            background: "white",
            color: "#333",
            padding: "30px",
            borderRadius: "12px",
            marginTop: "20px",
            marginBottom: "30px"
          }}>
            <h3 style={{marginTop: 0}}>{editingEventId ? "Edit Event" : "Create New Event"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required placeholder="Event title" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Location *</label>
                <input type="text" name="location" value={formData.location} onChange={handleInputChange} required placeholder="e.g., London, UK" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Start Date *</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Start Time *</label>
                <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>End Date *</label>
                <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>End Time *</label>
                <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} required style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Organiser Name *</label>
                <input type="text" name="organiser" value={formData.organiser} onChange={handleInputChange} required placeholder="e.g., DCA EMEA" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
              <div>
                <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Organiser Email *</label>
                <input type="email" name="organizerEmail" value={formData.organizerEmail} onChange={handleInputChange} required placeholder="organizer@example.com" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
              </div>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Sponsors</label>
              <input type="text" name="sponsors" value={formData.sponsors} onChange={handleInputChange} placeholder="e.g., Company A, Company B" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box"}} />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{display: "block", fontWeight: "600", marginBottom: "5px"}}>Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Event description (optional)" rows="4" style={{width: "100%", padding: "10px", border: "2px solid #e0e0e0", borderRadius: "6px", boxSizing: "border-box", fontFamily: "inherit"}} />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" style={{padding: "12px 24px", background: "#667eea", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
                {editingEventId ? "Update Event" : "Create Event"}
              </button>
              <button type="button" onClick={() => { resetForm(); setShowCreateForm(false); }} style={{padding: "12px 24px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: "30px" }}>
          {events.length === 0 ? (
            <p style={{fontSize: "1.1em"}}>No events yet. Create one to get started!</p>
          ) : (
            events.map((event) => (
              <div key={event.id} style={{
                background: "white",
                color: "#333",
                padding: "20px",
                marginBottom: "15px",
                borderRadius: "8px",
                border: `3px solid ${event.status === "approved" ? "#10b981" : event.status === "rejected" ? "#ef4444" : "#fbbf24"}`
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
                      background: event.status === "approved" ? "#d1fae5" : event.status === "rejected" ? "#fee2e2" : "#fef3c7",
                      color: event.status === "approved" ? "#065f46" : event.status === "rejected" ? "#7f1d1d" : "#92400e"
                    }}>
                      {event.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {canEditEvent(event) && (
                      <button onClick={() => handleEditEvent(event)} style={{padding: "8px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>
                        ✏️ Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDeleteEvent(event.id)} style={{padding: "8px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>

                <p><strong>📍 Location:</strong> {event.location}</p>
                <p><strong>📅 Date:</strong> {new Date(event.startDate).toLocaleDateString("en-GB")}</p>
                <p><strong>⏰ Time:</strong> {new Date(event.startDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - {new Date(event.endDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                <p><strong>🎤 Organiser:</strong> {event.organiser}</p>
                <p><strong>📧 Organiser Email:</strong> {event.organizerEmail}</p>
                {event.eventUrl && <p><strong>💼 Sponsors:</strong> {event.eventUrl}</p>}
                {event.description && <p><strong>📝 Description:</strong> {event.description}</p>}
                <p><strong>👥 Attendees:</strong> {event.attendees?.length || 0}</p>

                {event.status === "pending" && user?.email === event.organizerEmail && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e0e0e0" }}>
                    <button onClick={() => handleApproveEvent(event.id)} style={{padding: "10px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
                      ✅ Approve
                    </button>
                    <button onClick={() => handleRejectEvent(event.id)} style={{padding: "10px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>
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
