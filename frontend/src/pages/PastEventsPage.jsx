import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Navbar from "../components/Navbar";
import "./EventsPage.css";
import "./PastEventsPage.css";

export default function PastEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/api/events")
      .then(all => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        // Past events, most recent first
        const past = all
          .filter(e => new Date(e.startDate) < now)
          .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        setEvents(past);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="ep-loading"><div className="ep-spinner" /><p>Loading past events…</p></div>
  );
  if (error) return (
    <div className="ep-loading"><p className="ep-error">Error: {error}</p></div>
  );

  return (
    <div className="past-page">
      <Navbar showBack backTo="/events" backLabel="← Back to Upcoming Events" />

      <div className="past-body">
        <div className="past-header">
          <h1>Past Events</h1>
          <span className="past-count">{events.length} event{events.length !== 1 ? "s" : ""}</span>
        </div>

        {events.length === 0 ? (
          <div className="past-empty">
            <p>No past events yet.</p>
            <button className="ep-cal-clear" onClick={() => navigate('/events')}>View upcoming events</button>
          </div>
        ) : (
          <div className="past-list">
            {events.map(event => {
              const isRegistered = event.currentUserRsvp === "going";
              const isInterested = event.currentUserRsvp === "interested";
              const date = new Date(event.startDate);

              return (
                <div
                  key={event.id}
                  className="past-event-row"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  <div className="past-event-date">
                    <span className="past-event-day">
                      {date.toLocaleDateString("en-GB", { day: "numeric" })}
                    </span>
                    <span className="past-event-month">
                      {date.toLocaleDateString("en-GB", { month: "short" })}
                    </span>
                    <span className="past-event-year">
                      {date.getFullYear()}
                    </span>
                  </div>
                  <div className="past-event-info">
                    <h3 className="past-event-title">{event.title}</h3>
                    {event.location && (
                      <p className="past-event-location">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {event.location}
                      </p>
                    )}
                  </div>
                  <div className="past-event-badge">
                    {isRegistered && <span className="ep-status-badge going">✓ Attended</span>}
                    {isInterested && !isRegistered && <span className="ep-status-badge interested">★ Was Interested</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
