import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import './MembersPage.css';

export default function MembersPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return; }

    api.get('/api/users')
      .then(setMembers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.company?.toLowerCase().includes(q) ||
      m.headline?.toLowerCase().includes(q)
    );
  });

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  if (loading) return <div className="members-page"><p className="members-loading">Loading members...</p></div>;
  if (error)   return <div className="members-page"><p className="members-error">Error: {error}</p></div>;

  return (
    <div className="members-page">
    <nav className="ep-nav">
  <div className="ep-nav-inner">
    <button className="ep-logo-btn" onClick={() => navigate('/')}>
      DCA<span>UK</span>
    </button>
    <div className="ep-nav-right">
      <button className="ep-nav-btn" onClick={() => navigate('/events')}>
        Events
      </button>
      <button className="ep-nav-btn" onClick={() => navigate('/profile')}>
        My Profile
      </button>
    </div>
  </div>
</nav>
      <div className="members-container">
        <div className="members-header">
          <div>
            <h1>Community Members</h1>
            <p className="members-subtitle">{members.length} digital infrastructure professional{members.length !== 1 ? 's' : ''}</p>
          </div>
          <input
            className="members-search"
            type="text"
            placeholder="Search by name, company, or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="members-empty">No members match your search.</p>
        ) : (
          <div className="members-grid">
            {filtered.map(member => (
              <div key={member.id} className="member-card">
                <div className="member-avatar">
                  {member.avatarUrl
                    ? <img src={member.avatarUrl} alt={member.name} />
                    : <span className="member-initials">{getInitials(member.name)}</span>
                  }
                </div>
                <div className="member-info">
                  <h3 className="member-name">{member.name || 'Community Member'}</h3>
                  {member.headline && <p className="member-headline">{member.headline}</p>}
                  {member.company  && <p className="member-company">{member.company}</p>}
                  {member.bio      && <p className="member-bio">{member.bio}</p>}
                </div>
                {member.eventsAttending > 0 && (
                  <div className="member-events">
                    <Link to="/events">
                      ✓ Going to {member.eventsAttending} event{member.eventsAttending !== 1 ? 's' : ''}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
