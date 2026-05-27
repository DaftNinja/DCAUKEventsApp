import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/events")
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // [FIX P1] Use currentUserRsvp injected by the backend instead of checking
  // all attendees. The old code marked ANY event as "registered" if anyone had
  // status === "going", regardless of which user it was.
  async function handleRsvp(eventId, currentRsvp) {
    try {
      if (currentRsvp === "going") {
        // Toggle off — withdraw the RSVP
        await api.delete(`/api/events/${eventId}/rsvp`);
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, currentUserRsvp: null } : e
          )
        );
      } else {
        // [FIX P2] POST to upsert endpoint — handles both new RSVPs and status
        // changes without hitting the duplicate-key constraint.
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

  if (loading) return <div className="loading">Loading events…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="events-page">
      <h1>Upcoming Events</h1>
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul className="events-list">
          {events.map((event) => {
            const isRegistered = event.currentUserRsvp === "going";
            const isInterested = event.currentUserRsvp === "interested";

            return (
              <li key={event.id} className="event-card">
                <Link to={`/events/${event.id}`}>
                  <h2>{event.title}</h2>
                </Link>
                <p className="event-meta">
                  {event.location} &middot;{" "}
                  {new Date(event.startDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="event-description">{event.description}</p>

                <div className="event-actions">
                  <button
                    className={isRegistered ? "btn-registered" : "btn-primary"}
                    onClick={() => handleRsvp(event.id, event.currentUserRsvp)}
                  >
                    {isRegistered ? "✓ Going (click to cancel)" : "Register"}
                  </button>

                  {!isRegistered && (
                    <button
                      className={isInterested ? "btn-interested" : "btn-secondary"}
                      onClick={async () => {
                        const updated = await api
                          .post(`/api/events/${event.id}/rsvp`, {
                            status: "interested",
                          })
                          .catch(console.error);
                        if (updated) {
                          setEvents((prev) =>
                            prev.map((e) =>
                              e.id === event.id
                                ? { ...e, currentUserRsvp: updated.status }
                                : e
                            )
                          );
                        }
                      }}
                    >
                      {isInterested ? "★ Interested" : "☆ Interested"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
