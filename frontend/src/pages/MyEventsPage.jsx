import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getEvents, unrsvpEvent } from "../api";
import "./MyEventsPage.css";

export default function MyEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [userRsvps, setUserRsvps] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data);

      const rsvpMap = new Map();
      data.forEach((event) => {
        const userRsvp = event.attendees?.find((a) => a.status === "going");
        if (userRsvp) {
          rsvpMap.set(event.id, userRsvp);
        }
      });
      setUserRsvps(rsvpMap);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnrsvp = async (eventId) => {
    try {
      await unrsvpEvent(eventId);
      setUserRsvps((prev) => {
        const next = new Map(prev);
        next.delete(eventId);
        return next;
      });
      fetchEvents();
    } catch (error) {
      console.error("Failed to unregister:", error);
    }
  };

  const getFilteredEvents = () => {
    const now = new Date();
    const registered = Array.from(userRsvps.keys());
    const filtered = events.filter((e) => registered.includes(e.id));

    if (filter === "upcoming") {
      return filtered
        .filter((e) => new Date(e.startDate) >= now)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } else {
      return filtered
        .filter((e) => new Date(e.startDate) < now)
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }
  };

  if (loading) {
    return <div className="my-events-page">Loading your events...</div>;
  }

  const filtered = getFilteredEvents();

  return (
    <div className="my-events-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate("/events")}>
          ← Back to Events
        </button>
        <h1>My Events</h1>
      </div>

      <div className="filter-tabs">
        <button
          className={`tab ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming ({getFilteredEvents().filter(e => new Date(e.startDate) >= new Date()).length})
        </button>
        <button
          className={`tab ${filter === "past" ? "active" : ""}`}
          onClick={() => setFilter("past")}
        >
          Past ({getFilteredEvents().filter(e => new Date(e.startDate) < new Date()).length})
        </button>
      </div>

      <div className="events-list">
        {filtered.length === 0 ? (
          <div className="no-events">
            <p>
              {filter === "upcoming"
                ? "No upcoming events registered"
                : "No past events"}
            </p>
            <button
              className="browse-btn"
              onClick={() => navigate("/events")}
            >
              Browse all events
            </button>
          </div>
        ) : (
          filtered.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              rsvp={userRsvps.get(event.id)}
              onUnrsvp={handleUnrsvp}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EventListItem({ event, rsvp, onUnrsvp }) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const isPast = startDate < new Date();

  return (
    <div className={`event-item ${isPast ? "past" : "upcoming"}`}>
      <div className="event-item-header">
        <div className="event-item-date">
          <div className="date-label">
            {startDate.toLocaleDateString("en-GB", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="time-label">
            {startDate.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        <div className="event-item-info">
          <h3>{event.title}</h3>
          <p className="location">
            📍 {event.isVirtual ? "Virtual Event" : event.location}
          </p>
        </div>

        <div className="event-item-stats">
          <div className="stat">
            <div className="stat-value">{event.attendees?.length || 0}</div>
            <div className="stat-label">Attending</div>
          </div>
          {!isPast && (
            <button
              className="unregister-btn"
              onClick={() => onUnrsvp(event.id)}
              title="Unregister from event"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {event.description && (
        <p className="event-item-description">{event.description}</p>
      )}

      <div className="event-item-footer">
        <span className="organiser">{event.organiser}</span>
      </div>
    </div>
  );
}
