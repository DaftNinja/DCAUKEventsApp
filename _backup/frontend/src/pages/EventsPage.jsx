import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import './EventsPage.css';

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if logged in
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    fetchEvents();
  }, [navigate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/');
  };

  if (loading) return <div className="events-page"><p>Loading events...</p></div>;
  if (error) return <div className="events-page"><p>Error: {error}</p></div>;

  return (
    <div className="events-page">
      <nav className="navbar">
        <h2>DCA Community Events</h2>
        <div className="nav-links">
          <Link to="/profile">Profile</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="container">
        <h1>Upcoming Events</h1>
        <p className="event-count">{events.length} events</p>

        <div className="events-list">
          {events.length === 0 ? (
            <p>No events found</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-info">
                  <h3>{event.title}</h3>
                  <p className="event-organiser">{event.organiser}</p>
                  <p className="event-date">
                    📅 {new Date(event.startDate).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p className="event-location">
                    📍 {event.isVirtual ? 'Virtual' : event.location || 'TBA'}
                  </p>
                  {event.description && (
                    <p className="event-description">{event.description.substring(0, 100)}...</p>
                  )}
                </div>
                <Link to={`/events/${event.id}`} className="event-link">
                  View Details →
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
