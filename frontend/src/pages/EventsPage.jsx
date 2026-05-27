import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, logout } from "../api";
import "./EventsPage.css";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
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
          prev.map((e) => e.id === eventId ? { ...e, currentUserRsvp: null } : e)
        );
      } else {
        const updated = await api.post(`/api/events/${eventId}/rsvp`, { status: "going" });
        setEvents((prev) =>
          prev.map((e) => e.id === eventId ? { ...e, currentUserRsvp: updated.status } : e)
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
          prev.map((e) => e.id === eventId ? { ...e, currentUserRsvp: null } : e)
        );
      } else {
        const updated = await api.post(`/api/events/${eventId}/rsvp`, { status: "interested" });
        setEvents((prev) =>
          prev.map((e) => e.id === eventId ? { ...e, currentUserRsvp: updated.status } : e)
        );
      }
    } catch (err) {
      console.error("Interested failed:", err);
      alert("Failed to update. Please try again.");
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;

  const eventDayMap = {};
  events.forEach((e) => {
    const d = new Date(e.startDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventDayMap[day]) eventDayMap[day] = [];
      eventDayMap[day].push(e);
    }
  });

  const displayedEvents = selectedDay
    ? (eventDayMap[selectedDay] || [])
    : events;

  const today = new Date();

  if (loading) return (
    <div className="ep-loading">
      <div className="ep-spinner" />
      <p>Loading events…</p>
    </div>
  );

  if (error) return (
    <div className="ep-loading">
      <p className="ep-error">Error: {error}</p>
    </div>
  );

  return (
    <div className="ep-page">
      <nav className="ep-nav">
        <div className="ep-nav-inner">
          <button className="ep-logo-btn" onClick={() => navigate("/")}>
            DCA<span>UK</span>
          </button>
          <div className="ep-nav-right">
            <button className="ep-nav-btn" onClick={() => navigate("/profile")}>
              My Profile
            </button>
            <button className="ep-nav-btn ep-nav-logout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="ep-body">
        <section className="ep-calendar-section">
          <div className="ep-calendar-header">
            <h2 className="ep-calendar-title">{monthName}</h2>
            <div className="ep-calendar-controls">
              {selectedDay && (
                <button className="ep-cal-clear" onClick={() => setSelectedDay(null)}>
                  Show all
                </button>
              )}
              <button className="ep-cal-nav" onClick={() => { setCalendarDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}>‹</button>
              <button className="ep-cal-nav" onClick={() => { setCalendarDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}>›</button>
            </div>
          </div>

          <div className="ep-calendar-grid">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="ep-cal-dow">{d}</div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="ep-cal-day ep-cal-empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const hasEvents = !!eventDayMap[day];
              const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
              const isSelected = selectedDay === day;
              const hasGoing = hasEvents && eventDayMap[day].some(e => e.currentUserRsvp === "going");
              return (
                <div
                  key={day}
                  className={`ep-cal-day${hasEvents ? " has-events" : ""}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                  onClick={() => hasEvents && setSelectedDay(isSelected ? null : day)}
                >
                  <span className="ep-cal-num">{day}</span>
                  {hasEvents && <span className={`ep-cal-dot${hasGoing ? " dot-going" : ""}`} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="ep-events-section">
          <div className="ep-events-header">
            <h2 className="ep-events-title">
              {selectedDay
                ? `Events on ${selectedDay} ${calendarDate.toLocaleDateString("en-GB", { month: "long" })}`
                : "All Upcoming Events"}
            </h2>
            <span className="ep-events-count">
              {displayedEvents.length} event{displayedEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {displayedEvents.length === 0 ? (
            <div className="ep-no-events">
              <p>No events {selectedDay ? "on this day" : "yet"}.</p>
              {selectedDay && (
                <button className="ep-cal-clear" onClick={() => setSelectedDay(null)}>
                  Show all events
                </button>
              )}
            </div>
          ) : (
            <div className="ep-events-grid">
              {displayedEvents.map((event) => {
                const isRegistered = event.currentUserRsvp === "going";
                const isInterested = event.currentUserRsvp === "interested";
                const date = new Date(event.startDate);
                const day = date.toLocaleDateString("en-GB", { day: "numeric" });
                const mon = date.toLocaleDateString("en-GB", { month: "short" });

                return (
                  <div
                    key={event.id}
                    className={`ep-event-card${isRegistered ? " ep-card-going" : ""}`}
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    <div className="ep-card-top">
                      <div className="ep-card-date">
                        <span className="ep-card-day">{day}</span>
                        <span className="ep-card-month">{mon}</span>
                      </div>
                      {isRegistered && <span className="ep-status-badge going">✓ Going</span>}
                      {isInterested && !isRegistered && <span className="ep-status-badge interested">★ Interested</span>}
                    </div>

                    <h3 className="ep-card-title">{event.title}</h3>

                    {event.location && (
                      <p className="ep-card-location">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {event.location}
                      </p>
                    )}

                    {event.description && (
                      <p className="ep-card-desc">{event.description}</p>
                    )}

                    <div className="ep-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`ep-btn${isRegistered ? " ep-btn-going" : " ep-btn-primary"}`}
                        onClick={() => handleRsvp(event.id, event.currentUserRsvp)}
                      >
                        {isRegistered ? "✓ Going" : "Register"}
                      </button>
                      {!isRegistered && (
                        <button
                          className={`ep-btn${isInterested ? " ep-btn-interested" : " ep-btn-ghost"}`}
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
        </section>
      </div>
    </div>
  );
}
