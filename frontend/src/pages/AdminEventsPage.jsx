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
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    organiser: "",
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

      if (userData.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        const token = localStorage.getItem("token");
        const response = await fetch("/api/events", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        setEvents(data);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
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
      setFormData({
        title: "",
        location: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        organiser: "",
        sponsors: "",
        description: "",
      });
      setShowForm(false);
      alert("✓ Event created successfully!");
    } catch (error) {
      console.error("Failed to create event:", error);
      alert("Failed to create event: " + error.message);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete event");
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      alert("✓ Event deleted successfully!");
    } catch (error) {
      console.error("Failed to delete event:", error);
      alert("Failed to delete event: " + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
        padding: "40px 20px",
        color: "white"
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
        padding: "40px 20px",
        color: "white",
        textAlign: "center"
      }}>
        <h2>Not Authorized</h2>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="back-btn" onClick={() => navigate("/events")}>← Back</button>
        <h1>Admin: Manage Events</h1>
        <p className="admin-info">{user?.email}</p>
      </div>

      <div className="admin-container">
        <div className="events-summary">
          <h2>Events ({events.length})</h2>
          <button className="btn-create" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Create Event"}
          </button>
        </div>

        {showForm && (
          <form className="event-form" onSubmit={handleSubmit}>
            <h3>Create New Event</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required placeholder="Event title" />
              </div>
              <div className="form-group">
                <label>Location *</label>
                <input type="text" name="location" value={formData.location} onChange={handleInputChange} required placeholder="e.g., London, UK" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>End Date *</label>
                <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>End Time *</label>
                <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Organiser *</label>
                <input type="text" name="organiser" value={formData.organiser} onChange={handleInputChange} required placeholder="e.g., DCA EMEA" />
              </div>
              <div className="form-group">
                <label>Sponsors</label>
                <input type="text" name="sponsors" value={formData.sponsors} onChange={handleInputChange} placeholder="e.g., Company A, Company B" />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Event description (optional)" rows="4" />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit">Create Event</button>
              <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="events-grid">
          {events.length === 0 ? (
            <p className="no-events">No events yet. Create one to get started!</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="event-admin-card">
                <div className="event-header">
                  <h4>{event.title}</h4>
                  <button className="btn-delete" onClick={() => handleDeleteEvent(event.id)}>🗑️</button>
                </div>
                <p><strong>📍 Location:</strong> {event.location}</p>
                <p><strong>📅 Date:</strong> {new Date(event.startDate).toLocaleDateString("en-GB")}</p>
                <p><strong>⏰ Time:</strong> {new Date(event.startDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - {new Date(event.endDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                <p><strong>🎤 Organiser:</strong> {event.organiser}</p>
                {event.eventUrl && <p><strong>💼 Sponsors:</strong> {event.eventUrl}</p>}
                {event.description && <p><strong>📝 Description:</strong> {event.description}</p>}
                <p className="attendees"><strong>👥 Attendees:</strong> {event.attendees?.length || 0}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
