import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";
import "./EventsPage.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      
      // Fetch user role
      const token = localStorage.getItem("token");
      const roleRes = await fetch("/api/users/me", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const userData2 = await roleRes.json();
      setUserRole(userData2.role);

      const res = await fetch("/api/events", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      setEvents(data.filter(e => e.status === "approved"));
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (eventId, status) => {
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        alert(`✓ RSVP recorded as ${status}`);
        loadData();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div className="events-page"><p>Loading...</p></div>;

  return (
    <div className="events-page">
      <div className="events-container">
        <div className="events-header">
          <h1>Upcoming Events</h1>
          <div className="header-actions">
            <button onClick={() => navigate("/my-events")} className="nav-btn">My Events</button>
            <button onClick={() => navigate("/profile")} className="nav-btn">Profile</button>
            {userRole === "organizer" && (
              <button onClick={() => navigate("/admin/events")} className="nav-btn">My Events (Organizer)</button>
            )}
            {userRole === "admin" && (
              <>
                <button onClick={() => navigate("/admin/events")} className="admin-btn">Manage Events</button>
                <button onClick={() => navigate("/admin/users")} className="admin-btn">Manage Users</button>
              </>
            )}
          </div>
        </div>

        <div className="events-grid">
          {events.map((event) => (
            <div
              key={event.id}
              className="event-card"
              onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
            >
              <h3>{event.title}</h3>
              <p className="event-location">📍 {event.location}</p>
              <p className="event-date">
                📅 {new Date(event.startDate).toLocaleDateString("en-GB")}
              </p>
              <p className="event-organiser">👤 {event.organiser}</p>
              <p className="event-attendees">{event.attendees?.length || 0} attending</p>

              {expandedId === event.id && (
                <div className="event-details">
                  <p className="event-description">{event.description}</p>
                  <div className="event-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRsvp(event.id, "going");
                      }}
                      className="rsvp-btn going"
                    >
                      Going
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRsvp(event.id, "interested");
                      }}
                      className="rsvp-btn interested"
                    >
                      Interested
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
