import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import MeetMe from '../components/MeetMe';
import EventForum from '../components/EventForum';
import './EventDetailPage.css';

function formatIcsDate(dateStr) {
  return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildGoogleUrl(event) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const start = formatIcsDate(event.startDate);
  const end = formatIcsDate(event.endDate || event.startDate);
  const params = new URLSearchParams({
    text: event.title,
    dates: `${start}/${end}`,
    details: [event.description, event.eventUrl].filter(Boolean).join('\n\n'),
    location: event.location || '',
  });
  return `${base}&${params.toString()}`;
}

function downloadIcs(event) {
  const start = formatIcsDate(event.startDate);
  const end = formatIcsDate(event.endDate || event.startDate);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DCAUK//Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@dcaevents`,
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location || ''}`,
    `URL:${event.eventUrl || ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [openToMeeting, setOpenToMeeting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calOpen, setCalOpen]     = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied]       = useState(false);
  const calRef   = useRef(null);
  const shareRef = useRef(null);

  const isLoggedIn = !!localStorage.getItem('token');
  const userRole   = localStorage.getItem('role');

  useEffect(() => {
    init();
  }, [id]);

  useEffect(() => {
    function handleClick(e) {
      if (calRef.current   && !calRef.current.contains(e.target))   setCalOpen(false);
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function copyLink() {
    const url = `${window.location.origin}/events/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareLinkedIn() {
    const url = encodeURIComponent(`${window.location.origin}/events/${id}`);
    const title = encodeURIComponent(event?.title || '');
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    setShareOpen(false);
  }

  function shareX() {
    const url = encodeURIComponent(`${window.location.origin}/events/${id}`);
    const text = encodeURIComponent(`Check out this event: ${event?.title || ''}`);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    setShareOpen(false);
  }

  const init = async () => {
    try {
      setLoading(true);
      const eventData = await api.get(`/api/events/${id}`);
      setEvent(eventData);
      if (isLoggedIn) {
        try {
          const userData = await api.get('/api/users/me');
          const myRsvp = eventData.attendees?.find(r => r.userId === userData.id);
          setRsvpStatus(myRsvp?.status || null);
          setOpenToMeeting(myRsvp?.openToMeeting || false);
        } catch {
          // user fetch failed, continue as logged-out
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
      await api.post(`/api/events/${id}/rsvp`, { status });
      setRsvpStatus(status);

      // If Going, apply default Meet-Me preference from profile
      if (status === 'going') {
        const userData = await api.get('/api/users/me');
        if (userData.defaultOpenToMeeting) {
          const updated = await api.put(`/api/events/${id}/rsvp/meeting`, { openToMeeting: true });
          setOpenToMeeting(updated.openToMeeting);
        }
      } else {
        setOpenToMeeting(false);
      }

      const updated = await api.get(`/api/events/${id}`);
      setEvent(updated);
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
      setOpenToMeeting(false);
      const updated = await api.get(`/api/events/${id}`);
      setEvent(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMeetMeToggle = async (newValue) => {
    const updated = await api.put(`/api/events/${id}/rsvp/meeting`, { openToMeeting: newValue });
    setOpenToMeeting(updated.openToMeeting);
  };

  if (loading) return <div className="event-detail"><p>Loading event...</p></div>;
  if (error)   return <div className="event-detail"><p>Error: {error}</p></div>;
  if (!event)  return <div className="event-detail"><p>Event not found</p></div>;

  const goingCount      = event.attendees?.filter(r => r.status === 'going').length ?? 0;
  const interestedCount = event.attendees?.filter(r => r.status === 'interested').length ?? 0;

  return (
    <div className="event-detail">
      <Navbar showBack backTo="/events" backLabel="← Back to Events" />

      <div className="container">
        <div className="event-header">
          <h1>{event.title}</h1>
          {event.organiser && <p className="organiser">{event.organiser}</p>}
        </div>

        <div className="event-content">
          <div className="main-info">
            <div className="info-section">
              <h3>📅 Date & Time</h3>
              <p>{new Date(event.startDate).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}</p>
              {event.endDate && new Date(event.endDate).toDateString() !== new Date(event.startDate).toDateString() && (
                <p>Until {new Date(event.endDate).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}</p>
              )}
            </div>
            {(event.location || event.isVirtual) && (
              <div className="info-section">
                <h3>📍 Location</h3>
                <p>{event.isVirtual ? 'Virtual Event' : event.location}</p>
              </div>
            )}
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

            {/* Meet-Me section */}
            <MeetMe
              eventId={id}
              rsvpStatus={rsvpStatus}
              openToMeeting={openToMeeting}
              onToggle={handleMeetMeToggle}
            />

            {isLoggedIn && (
              <EventForum
                eventId={id}
                rsvpStatus={rsvpStatus}
              />
            )}
          </div>

          <div className="sidebar">
            {isLoggedIn ? (
              <div className="rsvp-section">
                <h3>Will you attend?</h3>
                <div className="rsvp-buttons">
                  <button
                    className={`rsvp-btn going ${rsvpStatus === 'going' ? 'active' : ''}`}
                    onClick={() => handleRsvp('going')}
                    disabled={submitting}
                  >✓ Going</button>
                  <button
                    className={`rsvp-btn interested ${rsvpStatus === 'interested' ? 'active' : ''}`}
                    onClick={() => handleRsvp('interested')}
                    disabled={submitting}
                  >★ Interested</button>
                </div>
                {rsvpStatus && (
                  <button className="rsvp-btn remove" onClick={handleRemoveRsvp} disabled={submitting}>
                    Remove RSVP
                  </button>
                )}
              </div>
            ) : (
              <div className="rsvp-section rsvp-login-prompt">
                <h3>Will you attend?</h3>
                <p>Sign in to RSVP, connect with attendees and join the discussion.</p>
                <a href="/api/auth/linkedin" className="rsvp-btn going" style={{display:'block',textAlign:'center',textDecoration:'none'}}>
                  Sign in with LinkedIn
                </a>
              </div>
            )}

            {/* Export attendees — admin only */}
            {isLoggedIn && userRole === 'admin' && (
              <a
                href={`/api/events/${id}/attendees/export`}
                className="rsvp-btn export-btn"
                style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:'0.75rem'}}
                download
              >
                Export Attendees (CSV)
              </a>
            )}

            <div className="cal-wrap" ref={calRef}>
              <button className="cal-btn" onClick={() => setCalOpen(o => !o)}>
                📅 Add to Calendar
                <span className="cal-chevron">{calOpen ? '▲' : '▼'}</span>
              </button>
              {calOpen && (
                <div className="cal-dropdown">
                  <a className="cal-option" href={buildGoogleUrl(event)} target="_blank" rel="noopener noreferrer" onClick={() => setCalOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Google Calendar
                  </a>
                  <button className="cal-option" onClick={() => { downloadIcs(event); setCalOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Apple / Outlook (.ics)
                  </button>
                </div>
              )}
            </div>

            {/* Share button */}
            <div className="cal-wrap" ref={shareRef}>
              <button className="cal-btn" onClick={() => setShareOpen(o => !o)}>
                🔗 Share event
                <span className="cal-chevron">{shareOpen ? '▲' : '▼'}</span>
              </button>
              {shareOpen && (
                <div className="cal-dropdown">
                  <button className="cal-option" onClick={() => { copyLink(); setShareOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {copied ? '✓ Copied!' : 'Copy link'}
                  </button>
                  <button className="cal-option" onClick={shareLinkedIn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    Share on LinkedIn
                  </button>
                  <button className="cal-option" onClick={shareX}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Share on X
                  </button>
                </div>
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
