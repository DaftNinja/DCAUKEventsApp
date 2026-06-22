import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api';
import './GroupsPage.css';

export default function GroupsPage() {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/groups')
      .then(setGroups)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoin(e, slug) {
    e.stopPropagation();
    try {
      await api.post(`/api/groups/${slug}/join`);
      setGroups(prev => prev.map(g => g.slug === slug
        ? { ...g, isMember: true, memberCount: g.memberCount + 1 }
        : g
      ));
    } catch (err) {
      console.error('Failed to join group:', err);
    }
  }

  async function handleLeave(e, slug) {
    e.stopPropagation();
    try {
      await api.delete(`/api/groups/${slug}/join`);
      setGroups(prev => prev.map(g => g.slug === slug
        ? { ...g, isMember: false, memberCount: Math.max(0, g.memberCount - 1) }
        : g
      ));
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  }

  return (
    <div className="groups-page">
      <Navbar />
      <div className="groups-content">
        <div className="groups-header">
          <h1>Community Groups</h1>
          <p>Join groups to connect with members who share your focus area.</p>
        </div>

        {loading && <p className="groups-loading">Loading groups...</p>}
        {error   && <p className="groups-error">Error: {error}</p>}

        {!loading && !error && (
          <div className="groups-grid">
            {groups.map(group => (
              <div
                key={group.id}
                className="group-card"
                onClick={() => navigate(`/groups/${group.slug}`)}
              >
                <div className="group-card-body">
                  <h2 className="group-name">{group.name}</h2>
                  {group.description && (
                    <p className="group-description">{group.description}</p>
                  )}
                  <p className="group-meta">{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</p>
                </div>
                <div className="group-card-footer">
                  {group.isMember ? (
                    <button
                      className="group-btn leave"
                      onClick={(e) => handleLeave(e, group.slug)}
                    >
                      Leave
                    </button>
                  ) : (
                    <button
                      className="group-btn join"
                      onClick={(e) => handleJoin(e, group.slug)}
                    >
                      Join
                    </button>
                  )}
                  <span className="group-view">View →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
