import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getEvents, rsvpEvent, unrsvpEvent } from "../api";
import "./EventsPage.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [userRsvps, setUserRsvps] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data);

      const token = localStorage.getItem("token");
      if (token) {
        const userRsvpSet = new Set();
        data.forEach((event) => {
          if (event.attendees?.some((a) => a.status === "going")) {
            userRsvpSet.add(event.id);
          }
        });
        setUserRsvps(userRsvpSet);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (eventId, status) => {
    try {
      await rsvpEvent(eventId, status);
      setUserRsvps((prev) => {
        const next = new Set(prev);
        if (status === "going") {
          next.add(eventId);
        } else {
          next.delete(eventId);
        }
        return next;
      });
      fetchEvents();
    } catch (error) {
      console.error("RSVP failed:", error);
    }
  };

  const getEventsForMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getFullYear() === year &&
        eventDate.getMonth() === month
      );
    });
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.startDate) >= now)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 5);
  };

  const getPastEvents = () => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.startDate) < now)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
      .slice(0, 5);
  };

  if (loading) {
    return <div className="events-page">Loading events...</div>;
  }

  return (
    <div className="events-page">
      <div className="events-header">
        <h1>DCA Events</h1>
        <button
          className="my-events-btn"
          onClick={() => navigate("/my-events")}
        >
          My Events
        </button>
      </div>

      <div className="events-content">
        {/* Calendar View */}
        <div className="calendar-section">
          <h2>Calendar</h2>
          <div className="calendar">
            <div className="calendar-header">
              <button
                onClick={() =>
                  setSelectedMonth(
                    new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1)
                  )
                }
              >
                ←
              </button>
              <h3>
                {selectedMonth.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <button
                onClick={() =>
                  setSelectedMonth(
                    new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
                  )
                }
              >
                →
              </button>
            </div>

            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="calendar-day-header">
                  {day}
                </div>
              ))}

              {renderCalendarDays(
                selectedMonth,
                getEventsForMonth(),
                userRsvps
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Events List */}
        <div className="upcoming-section">
          <h2>Upcoming Events</h2>
          <div className="events-list">
            {getUpcomingEvents().length === 0 ? (
              <p className="no-events">No upcoming events</p>
            ) : (
              getUpcomingEvents().map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isRegistered={userRsvps.has(event.id)}
                  onRsvp={handleRsvp}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCalendarDays(date, monthEvents, userRsvps) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(
      <div key={`empty-${i}`} className="calendar-day empty"></div>
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayEvents = monthEvents.filter((e) => {
      const eventDate = new Date(e.startDate);
      return eventDate.toDateString() === currentDate.toDateString();
    });

    days.push(
      <div
        key={day}
        className={`calendar-day ${dayEvents.length > 0 ? "has-events" : ""}`}
      >
        <div className="day-number">{day}</div>
        {dayEvents.length > 0 && (
          <div className="day-events">
            {dayEvents.map((e) => (
              <div
                key={e.id}
                className={`event-dot ${userRsvps.has(e.id) ? "registered" : ""}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return days;
}

function EventCard({ event, isRegistered, onRsvp }) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  return (
    <div className="event-card">
      <div className="event-date">
        <div className="event-date-day">{startDate.getDate()}</div>
        <div className="event-date-month">
          {startDate.toLocaleDateString("en-GB", { month: "short" })}
        </div>
      </div>

      <div className="event-details">
        <h3>{event.title}</h3>
        <p className="event-time">
          {startDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          - {endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {event.location && (
          <p className="event-location">
            📍 {event.isVirtual ? "Virtual" : event.location}
          </p>
        )}
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
        <p className="event-organiser">Organiser: {event.organiser}</p>
        <p className="event-attendees">
          {event.attendees?.length || 0} attending
        </p>
      </div>

      <div className="event-actions">
        {isRegistered ? (
          <button
            className="btn btn-secondary"
            onClick={() => onRsvp(event.id, "interested")}
          >
            ✓ Registered
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => onRsvp(event.id, "going")}
          >
            Register Interest
          </button>
        )}
      </div>
    </div>
  );
}
