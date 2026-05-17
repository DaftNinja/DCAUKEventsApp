import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import './EventDetailPage.css';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    fetchEvent();
  }, [id, navigate]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/events/${id}`);
      setEvent(response.data);

      // Check if user has already RSVP'd
      const userRsvp = response.data.attendees?.find(
        (a) => a.id === localStorage.getItem('userId')
      );
      if (userRsvp) {
        setRsvpStatus(userRsvp.rsvpStatus);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (status) => {
    try {
      setSubmitting(true);
      if (rsvpStatus) {
        // Update existing RSVP
        await api.post(`/events/${id}/rsvp`, { status });
      } else {
        // Create new RSVP
        await api.post(`/events/${id}/rsvp`, { status });
      }
      setRsvpStatus(status);
      fetchEvent(); // Refresh to get updated attendee list
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRsvp = async () => {
    try {
      setSubmitting(true);
      await api.delete(`/events/${id}/rsvp`);
      setRsvpStatus(null);
      fetchEvent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="event-detail"><p>Loading event...</p></div>;
  if (error) return <div className="event-detail"><p>Error: {error}</p></div>;
  if (!event) return <div className="event-detail"><p>Event not found</p></div>;

  const goingCount = event.attendees?.filter((a) => a.rsvpStatus === 'going').length || 0;
  const interestedCount = event.attendees?.filter((a) => a.rsvpStatus === 'interested').length || 0;

  return (
    <div className="event-detail">
      <nav className="navbar">
        <Link to="/events" className="back-link">← Back to Events</Link>
      </nav>

      <div className="container">
        <div className="event-header">
          <h1>{event.title}</h1>
          <p className="organiser">{event.organiser}</p>
        </div>

        <div className="event-content">
          <div className="main-info">
            <div className="info-section">
              <h3>📅 Date & Time</h3>
              <p>
                {new Date(event.startDate).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p>
                {new Date(event.startDate).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`}
              </p>
            </div>

            <div className="info-section">
              <h3>📍 Location</h3>
              <p>{event.isVirtual ? 'Virtual Event' : event.location || 'TBA'}</p>
            </div>

            {event.description && (
              <div className="info-section">
                <h3>📋 Description</h3>
                <p>{event.description}</p>
              </div>
            )}

            {event.eventUrl && (
              <div className="info-section">
                <a href={event.eventUrl} target="_blank" rel="noopener noreferrer" className="event-url">
                  View on event website →
                </a>
              </div>
            )}
          </div>

          <div className="sidebar">
            <div className="rsvp-section">
              <h3>Will you attend?</h3>
              <div className="rsvp-buttons">
                <button
                  className={`rsvp-btn going ${rsvpStatus === 'going' ? 'active' : ''}`}
                  onClick={() => handleRsvp('going')}
                  disabled={submitting}
                >
                  ✓ Going
                </button>
                <button
                  className={`rsvp-btn interested ${rsvpStatus === 'interested' ? 'active' : ''}`}
                  onClick={() => handleRsvp('interested')}
                  disabled={submitting}
                >
                  ★ Interested
                </button>
              </div>
              {rsvpStatus && (
                <button
                  className="rsvp-btn remove"
                  onClick={handleRemoveRsvp}
                  disabled={submitting}
                >
                  Remove RSVP
                </button>
              )}
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat-label">Going</span>
                <span className="stat-value">{goingCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Interested</span>
                <span className="stat-value">{interestedCount}</span>
              </div>
            </div>
          </div>
        </div>

        {event.attendees && event.attendees.length > 0 && (
          <div className="attendees-section">
            <h2>Attendees ({event.attendees.length})</h2>
            <div className="attendees-grid">
              {event.attendees.map((attendee) => (
                <div key={attendee.id} className="attendee-card">
                  {attendee.avatarUrl && (
                    <img src={attendee.avatarUrl} alt={attendee.name} className="avatar" />
                  )}
                  <h4>{attendee.name}</h4>
                  {attendee.headline && <p className="headline">{attendee.headline}</p>}
                  {attendee.company && <p className="company">{attendee.company}</p>}
                  <span className="rsvp-badge">{attendee.rsvpStatus === 'going' ? '✓ Going' : '★ Interested'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
