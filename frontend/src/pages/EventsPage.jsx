import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./EventsPage.css";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/api/events")
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRsvp(eventId, currentRsvp) {
    try {
      if (currentRsvp === "going") {
        await api.delete(`/api/events/${eventId}/rsvp`);
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, currentUserRsvp: null } : e
          )
        );
      } else {
        const updated = await api.post(`/api/events/${eventId}/rsvp`, {
          status: "going",
        });
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, currentUserRsvp: updated.status } : e
          )
        );
      }
    } catch (err) {
      console.error("RSVP failed:", err);
      alert("Failed to update RSVP. Please try again.");
    }
  }

  async function handleInterested(eventId, currentRsvp) {
    try {
      if (currentRsvp === "interested") {
        await api.delete(`/api/events/${eventId}/rsvp`);
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, currentUserRsvp: null } : e
          )
        );
      } else {
        const updated = await api.post(`/api/events/${eventId}/rsvp`, {
          status: "interested",
        });
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, currentUserRsvp: updated.status } : e
          )
        );
      }
    } catch (err) {
      console.error("Interested failed:", err);
      alert("Failed to update. Please try again.");
    }
  }

  if (loading) return <div className="loading">Loading events…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="events-page">
      <div className="events-header">
        <h1>Upcoming Events</h1>
        <div className="header-buttons">
          <button className="my-events-btn" onClick={() => navigate("/profile")}>
            My Profile
          </button>
        </div>
      </div>

      <div className="events-content">
        <div className="upcoming-section">
          <h2>All Events</h2>
          {events.length === 0 ? (
            <p className="no-events">No events yet.</p>
          ) : (
            <div className="events-list">
              {events.map((event) => {
                const isRegistered = event.currentUserRsvp === "going";
                const isInterested = event.currentUserRsvp === "interested";
                const date = new Date(event.startDate);
                const day = date.toLocaleDateString("en-GB", { day: "numeric" });
                const month = date.toLocaleDateString("en-GB", { month: "short" });

                return (
                  <div
                    key={event.id}
                    className="event-card"
                    onClick={() => navigate(`/events/${event.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="event-date">
                      <span className="event-date-day">{day}</span>
                      <span className="event-date-month">{month}</span>
                    </div>

                    <div className="event-details">
                      <h3>{event.title}</h3>
                      {event.location && (
                        <p className="event-location">📍 {event.location}</p>
                      )}
                      {event.organiser && (
                        <p className="event-organiser">🏢 {event.organiser}</p>
                      )}
                      {event.description && (
                        <p className="event-description">{event.description}</p>
                      )}
                    </div>

                    <div
                      className="event-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`btn ${isRegistered ? "btn-secondary" : "btn-primary"}`}
                        onClick={() => handleRsvp(event.id, event.currentUserRsvp)}
                      >
                        {isRegistered ? "✓ Going" : "Register"}
                      </button>
                      {!isRegistered && (
                        <button
                          className={`btn ${isInterested ? "btn-secondary" : "btn-primary"}`}
                          style={isInterested ? {} : { background: "#e0e7ff", color: "#667eea" }}
                          onClick={() => handleInterested(event.id, event.currentUserRsvp)}
                        >
                          {isInterested ? "★ Interested" : "☆ Interested"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
