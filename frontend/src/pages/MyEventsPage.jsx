import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function MyEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/events")
      .then((all) => {
        // [FIX P1] Filter using currentUserRsvp from the backend — not by
        // checking if any attendee has status "going" (the old logic showed
        // ALL events as soon as one other person registered).
        setEvents(all.filter((e) => e.currentUserRsvp !== null));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="my-events-page">
      <h1>My Events</h1>
      {events.length === 0 ? (
        <p>
          You haven&apos;t registered for any events yet.{" "}
          <Link to="/events">Browse events →</Link>
        </p>
      ) : (
        <ul className="events-list">
          {events.map((event) => (
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
              <span
                className={`rsvp-badge rsvp-${event.currentUserRsvp}`}
              >
                {event.currentUserRsvp === "going"
                  ? "✓ Going"
                  : event.currentUserRsvp === "interested"
                  ? "☆ Interested"
                  : event.currentUserRsvp}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
