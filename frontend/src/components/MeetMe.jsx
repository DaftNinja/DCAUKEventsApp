import { useEffect, useState } from 'react';
import { api } from '../api';
import './MeetMe.css';

export default function MeetMe({ eventId, rsvpStatus, openToMeeting, onToggle }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    if (rsvpStatus !== 'going') return;
    setLoading(true);
    api.get(`/api/events/${eventId}/meeting`)
      .then(setAttendees)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId, rsvpStatus]);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(!openToMeeting);
      // Refresh attendee list
      const updated = await api.get(`/api/events/${eventId}/meeting`);
      setAttendees(updated);
    } catch (err) {
      console.error('Failed to toggle meet-me:', err);
    } finally {
      setToggling(false);
    }
  }

  if (rsvpStatus !== 'going') return null;

  return (
    <div className="meetme-section">
      <div className="meetme-header">
        <div>
          <h3 className="meetme-title">Meet-Me</h3>
          <p className="meetme-subtitle">Connect with other attendees at this event</p>
        </div>
        <button
          className={`meetme-toggle ${openToMeeting ? 'on' : 'off'}`}
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? '...' : openToMeeting ? '✓ Open to meeting' : 'Enable Meet-Me'}
        </button>
      </div>

      {!openToMeeting && (
        <p className="meetme-hint">
          Enable Meet-Me to appear in this list and see who else is open to connecting at this event.
        </p>
      )}

      {openToMeeting && (
        <>
          {loading ? (
            <p className="meetme-loading">Loading attendees...</p>
          ) : attendees.length === 0 ? (
            <p className="meetme-empty">
              You're the first to enable Meet-Me for this event. Check back closer to the date!
            </p>
          ) : (
            <div className="meetme-grid">
              {attendees.map(person => (
                <div key={person.id} className={`meetme-card ${person.id === currentUserId ? 'me' : ''}`}>
                  <div className="meetme-card-avatar">
                    {person.avatarUrl
                      ? <img src={person.avatarUrl} alt={person.name} />
                      : <div className="meetme-initials">
                          {person.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                        </div>
                    }
                    {person.id === currentUserId && <span className="meetme-you-badge">You</span>}
                  </div>
                  <div className="meetme-card-info">
                    <span className="meetme-name">{person.name}</span>
                    {person.headline && <span className="meetme-headline">{person.headline}</span>}
                    {person.company  && <span className="meetme-company">{person.company}</span>}
                  </div>
                  {person.id !== currentUserId && (
                    <a
                      href={`https://www.linkedin.com/in/${person.linkedinId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="meetme-connect-btn"
                      title="Connect on LinkedIn"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                      </svg>
                      Connect
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
