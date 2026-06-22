import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './MemberProfilePage.css';

export default function MemberProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/users/${id}`)
      .then(setMember)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  if (loading) return (
    <div className="mp-page">
      <Navbar showBack backTo="/members" backLabel="Back to Members" />
      <div className="mp-loading"><div className="mp-spinner" /><p>Loading profile...</p></div>
    </div>
  );

  if (error || !member) return (
    <div className="mp-page">
      <Navbar showBack backTo="/members" backLabel="Back to Members" />
      <div className="mp-error"><p>Member not found.</p></div>
    </div>
  );

  const joinedDate = new Date(member.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="mp-page">
      <Navbar showBack backTo="/members" backLabel="Back to Members" />
      <div className="mp-body">

        <div className="mp-hero">
          <div className="mp-avatar-wrap">
            {member.avatarUrl
              ? <img src={member.avatarUrl} alt={member.name} className="mp-avatar" />
              : <div className="mp-avatar-initials">{getInitials(member.name)}</div>
            }
          </div>
          <div className="mp-hero-info">
            <h1 className="mp-name">{member.name}</h1>
            {member.headline && <p className="mp-headline">{member.headline}</p>}
            {member.company  && <p className="mp-company">{member.company}</p>}
            <p className="mp-joined">Member since {joinedDate}</p>
          </div>
        </div>

        {member.bio && (
          <div className="mp-card">
            <h2 className="mp-card-title">About</h2>
            <p className="mp-bio">{member.bio}</p>
          </div>
        )}

        {member.upcomingEvents?.length > 0 && (
          <div className="mp-card">
            <h2 className="mp-card-title">Attending upcoming events</h2>
            <div className="mp-events-list">
              {member.upcomingEvents.map(event => {
                const date = new Date(event.startDate);
                return (
                  <div key={event.eventId} className="mp-event-row" onClick={() => navigate(`/events/${event.eventId}`)}>
                    <div className="mp-event-date">
                      <span className="mp-event-day">{date.toLocaleDateString('en-GB', { day: 'numeric' })}</span>
                      <span className="mp-event-mon">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </div>
                    <div className="mp-event-info">
                      <p className="mp-event-title">{event.title}</p>
                      {event.location && <p className="mp-event-location">{event.location}</p>}
                    </div>
                    <span className="mp-event-arrow">&#8594;</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
