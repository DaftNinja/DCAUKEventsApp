import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
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
      const data = await api.get(`/api/events/${id}`);
      setEvent(data);

      // Determine current user's RSVP from the rsvps array
      const token = localStorage.getItem('token');
      if (token && data.rsvps) {
        // We don't store userId locally so we rely on currentUserRsvp if present,
        // otherwise we'll get it after the first RSVP action
        if (data.currentUserRsvp !== undefined) {
          setRsvpStatus(data.currentUserRsvp);
        }
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
      const updated = await api.post(`/api/events/${id}/rsvp`, { status });
      setRsvpStatus(updated.status);
      await fetchEvent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRsvp = async () => {
    try {
      setSubmitting(true);
      await api.delete(`/api/events/${id}/rsvp`);
      setRsvpStatus(null);
      await fetchEvent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="event-detail"><p>Loading event...</p></div>;
  if (error) return <div className="event-detail"><p>Error: {error}</p></div>;
  if (!event) return <div className="event-detail"><p>Event not found</p></div>;

  const goingCount = event.rsvps?.filter((r) => r.status === 'going').length || 0;
  const interestedCount = event.rsvps?.filter((r) => r.status === 'interested').length || 0;

  return (
    <div className="event-detail">
      <nav className="navbar">
        <button className="back-link" onClick={() => navigate('/events')}>← Back to Events</button>
      </nav>

      <div className="container">
        <div className="event-header">
          <h1>{event.title}</h1>
          {event.organiser && <p className="organiser">{event.organiser}</p>}
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
                  year: 'numeric',
                })}
              </p>
              {event.endDate && (
                <p>
                  Until{' '}
                  {new Date(event.endDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
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
                <a
                  href={event.eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-url"
                >
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
      </div>
    </div>
  );
}
