import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './ProfilePage.css';

function PreferencesPanel() {
  const [prefs, setPrefs]         = useState(null);
  const [keywords, setKeywords]   = useState('');
  const [locations, setLocations] = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [copied, setCopied]       = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);

  useEffect(() => {
    api.get('/api/preferences').then(p => {
      setPrefs(p);
      setKeywords(p.keywords  || '');
      setLocations(p.locations || '');
    }).catch(console.error);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put('/api/preferences', { keywords, locations });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save preferences:', e);
    } finally {
      setSaving(false);
    }
  }

  function copyFeedUrl() {
    const url = `${window.location.origin}/api/calendar/subscribe/${prefs.calToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openInCalendar() {
    const url = `webcal://${window.location.host}/api/calendar/subscribe/${prefs.calToken}`;
    window.location.href = url;
  }

  async function handleUnsubscribe() {
    if (!confirm('This will delete your preferences and invalidate your calendar feed URL. Are you sure?')) return;
    try {
      await api.delete('/api/preferences');
      setPrefs(null);
      setKeywords('');
      setLocations('');
      setUnsubscribed(true);
    } catch (e) {
      console.error('Failed to unsubscribe:', e);
    }
  }

  if (unsubscribed) return (
    <div className="pp-prefs-unsubscribed">
      <p>✓ You've been unsubscribed. Your calendar feed is no longer active.</p>
      <button className="pp-prefs-cal-btn primary" onClick={() => { setUnsubscribed(false); api.get('/api/preferences').then(p => { setPrefs(p); setKeywords(p.keywords || ''); setLocations(p.locations || ''); }); }}>
        Set up a new subscription
      </button>
    </div>
  );

  if (!prefs) return <p className="pp-prefs-loading">Loading...</p>;

  return (
    <div className="pp-prefs">
      <div className="pp-prefs-fields">
        <div className="pp-prefs-field">
          <label className="pp-prefs-label">Keywords</label>
          <input
            className="pp-prefs-input"
            type="text"
            placeholder="e.g. sustainability, AI, networking"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
          />
          <p className="pp-prefs-hint">Comma-separated. Matched against event title, description and organiser.</p>
        </div>
        <div className="pp-prefs-field">
          <label className="pp-prefs-label">Locations</label>
          <input
            className="pp-prefs-input"
            type="text"
            placeholder="e.g. London, Amsterdam, Virtual"
            value={locations}
            onChange={e => setLocations(e.target.value)}
          />
          <p className="pp-prefs-hint">Comma-separated. Leave both fields empty to receive all events.</p>
        </div>
        <button
          className="pp-btn-primary pp-prefs-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '\u2713 Saved' : saving ? 'Saving...' : 'Save preferences'}
        </button>
      </div>

      <div className="pp-prefs-cal">
        <h3 className="pp-prefs-cal-title">📅 Calendar subscription</h3>
        <p className="pp-prefs-cal-desc">
          Add this feed to Google Calendar, Apple Calendar, or Outlook.
          It updates automatically as new matching events are approved.
        </p>
        <div className="pp-prefs-cal-actions">
          <button className="pp-prefs-cal-btn primary" onClick={openInCalendar}>
            Subscribe in Calendar app
          </button>
          <button className="pp-prefs-cal-btn ghost" onClick={copyFeedUrl}>
            {copied ? '\u2713 Copied!' : 'Copy feed URL'}
          </button>
        </div>
        <p className="pp-prefs-cal-hint">
          For Google Calendar: open Google Calendar → Other calendars → From URL → paste the feed URL.
        </p>
        <button className="pp-prefs-unsub-btn" onClick={handleUnsubscribe}>
          Unsubscribe &amp; delete preferences
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [organiserRequested, setOrganiserRequested] = useState(false);
  const [organiserLoading, setOrganiserLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userData, allEvents, allGroups] = await Promise.all([
        api.get('/api/users/me'),
        api.get('/api/events'),
        api.get('/api/groups'),
      ]);
      setUser(userData);
      setFormData(userData);

      // Split into upcoming and past, keeping only RSVPd events
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const rsvpd = allEvents.filter(e => e.currentUserRsvp !== null);
      const upcoming = rsvpd
        .filter(e => new Date(e.startDate) >= now)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      const past = rsvpd
        .filter(e => new Date(e.startDate) < now)
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      setMyEvents({ upcoming, past });

      // Groups the user has joined
      setMyGroups(allGroups.filter(g => g.isMember));

      // Events submitted by this user (by organizerId)
      const userId = localStorage.getItem('userId');
      setMySubmissions(allEvents.filter(e => e.organizerId === userId));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOrganiser = async () => {
    setOrganiserLoading(true);
    try {
      await api.post('/api/users/request-organiser');
      setOrganiserRequested(true);
    } catch (err) {
      console.error('Failed to send organiser request:', err);
    } finally {
      setOrganiserLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.put('/api/users/me', {
        name: formData.name,
        headline: formData.headline,
        company: formData.company,
        bio: formData.bio,
      });
      setUser(updated);
      setFormData(updated);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="pp-loading"><div className="pp-spinner" /><p>Loading profile…</p></div>;
  if (!user) return null;

  const { upcoming = [], past = [] } = myEvents;

  function EventRow({ event }) {
    const isGoing = event.currentUserRsvp === 'going';
    const date = new Date(event.startDate);
    return (
      <div className="pp-event-row" onClick={() => navigate(`/events/${event.id}`)}>
        <div className="pp-event-date">
          <span className="pp-event-day">{date.toLocaleDateString('en-GB', { day: 'numeric' })}</span>
          <span className="pp-event-mon">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
        </div>
        <div className="pp-event-info">
          <p className="pp-event-title">{event.title}</p>
          {event.location && <p className="pp-event-location">{event.location}</p>}
        </div>
        <span className={`pp-rsvp-badge ${isGoing ? 'going' : 'interested'}`}>
          {isGoing ? '✓ Going' : '★ Interested'}
        </span>
      </div>
    );
  }

  return (
    <div className="pp-page">
      <Navbar />

      <div className="pp-body">
        {/* Hero */}
        <div className="pp-hero">
          <div className="pp-avatar-wrap">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="pp-avatar" />
              : <div className="pp-avatar-initials">{user.name?.charAt(0) || '?'}</div>
            }
          </div>
          <div className="pp-hero-info">
            <h1 className="pp-name">{user.name}</h1>
            {user.headline && <p className="pp-headline">{user.headline}</p>}
            {user.company && <p className="pp-company">{user.company}</p>}
            <p className="pp-email">{user.email}</p>
          </div>
        </div>

        {/* Profile details / edit form */}
        {editing ? (
          <div className="pp-card pp-form-card">
            <h2 className="pp-card-title">Edit Profile</h2>
            <div className="pp-form-grid">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Headline</label>
                <input type="text" placeholder="e.g. Founder at 1GigLabs" value={formData.headline || ''} onChange={e => setFormData({ ...formData, headline: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input type="text" value={formData.company || ''} onChange={e => setFormData({ ...formData, company: e.target.value })} />
              </div>
              <div className="form-group form-group-full">
                <label>Bio</label>
                <textarea rows={4} placeholder="Tell the community about yourself…" value={formData.bio || ''} onChange={e => setFormData({ ...formData, bio: e.target.value })} />
              </div>
            </div>
            <div className="pp-form-actions">
              <button className="pp-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button className="pp-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="pp-card">
            <div className="pp-details">
              {user.bio && (
                <div className="pp-detail-row pp-bio">
                  <span className="pp-detail-label">Bio</span>
                  <p className="pp-detail-value pp-bio-text">{user.bio}</p>
                </div>
              )}
              {user.headline && (
                <div className="pp-detail-row">
                  <span className="pp-detail-label">Headline</span>
                  <span className="pp-detail-value">{user.headline}</span>
                </div>
              )}
              {user.company && (
                <div className="pp-detail-row">
                  <span className="pp-detail-label">Company</span>
                  <span className="pp-detail-value">{user.company}</span>
                </div>
              )}
              <div className="pp-detail-row">
                <span className="pp-detail-label">Email</span>
                <span className="pp-detail-value">{user.email}</span>
              </div>
            </div>
            <div className="pp-actions">
              <button className="pp-btn-primary" onClick={() => setEditing(true)}>Edit Profile</button>
              {user.role === 'member' && (
                <button
                  className="pp-btn-ghost pp-organiser-btn"
                  onClick={handleRequestOrganiser}
                  disabled={organiserRequested || organiserLoading}
                >
                  {organiserRequested ? '\u2713 Request sent' : organiserLoading ? 'Sending...' : 'Request organiser access'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* My Events */}
        <div className="pp-card">
          <h2 className="pp-card-title">My Events</h2>

          {upcoming.length === 0 && past.length === 0 ? (
            <div className="pp-events-empty">
              <p>You haven't registered for any events yet.</p>
              <button className="pp-link-btn" onClick={() => navigate('/events')}>Browse upcoming events →</button>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="pp-events-section">
                  <h3 className="pp-events-sub">Upcoming</h3>
                  {upcoming.map(e => <EventRow key={e.id} event={e} />)}
                </div>
              )}
              {past.length > 0 && (
                <div className="pp-events-section">
                  <h3 className="pp-events-sub">Past</h3>
                  {past.map(e => <EventRow key={e.id} event={e} />)}
                </div>
              )}
            </>
          )}
        </div>

        {/* My Groups */}
        {myGroups.length > 0 && (
          <div className="pp-card">
            <h2 className="pp-card-title">My Groups</h2>
            <div className="pp-groups-list">
              {myGroups.map(g => (
                <div key={g.id} className="pp-group-row" onClick={() => navigate(`/groups/${g.slug}`)}>  
                  <div className="pp-group-info">
                    <span className="pp-group-name">{g.name}</span>
                    <span className="pp-group-count">{g.memberCount} members</span>
                  </div>
                  <span className="pp-group-arrow">→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Submissions */}
        {mySubmissions.length > 0 && (
          <div className="pp-card">
            <h2 className="pp-card-title">My Event Submissions</h2>
            <div className="pp-submissions-list">
              {mySubmissions.map(e => {
                const statusColour = e.status === 'approved' ? 'approved' : e.status === 'rejected' ? 'rejected' : 'pending';
                const statusLabel  = e.status === 'approved' ? '✓ Approved' : e.status === 'rejected' ? '✗ Rejected' : '⏳ Pending review';
                return (
                  <div key={e.id} className="pp-submission-row" onClick={() => e.status === 'approved' && navigate(`/events/${e.id}`)}>  
                    <div className="pp-submission-info">
                      <span className="pp-submission-title">{e.title}</span>
                      <span className="pp-submission-date">{new Date(e.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <span className={`pp-submission-badge ${statusColour}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Event Preferences & Calendar Subscription */}
        <div className="pp-card">
          <h2 className="pp-card-title">Event Preferences &amp; Calendar Feed</h2>
          <p className="pp-prefs-desc">Subscribe to a personalised calendar feed. New events matching your criteria will appear in your calendar automatically, and you'll be notified by email.</p>
          <PreferencesPanel />
        </div>

      </div>
    </div>
  );
}
