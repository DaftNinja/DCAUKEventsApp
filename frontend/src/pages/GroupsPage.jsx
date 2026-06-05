import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './GroupsPage.css';

export default function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    api.get('/api/groups')
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(group) {
    setJoining(group.id);
    try {
      if (group.isMember) {
        await api.delete(`/api/groups/${group.slug}/join`);
        setGroups(prev => prev.map(g => g.id === group.id
          ? { ...g, isMember: false, memberCount: g.memberCount - 1 }
          : g));
      } else {
        await api.post(`/api/groups/${group.slug}/join`);
        setGroups(prev => prev.map(g => g.id === group.id
          ? { ...g, isMember: true, memberCount: g.memberCount + 1 }
          : g));
      }
    } catch (err) {
      console.error('Failed to toggle membership:', err);
    } finally {
      setJoining(null);
    }
  }

  const myGroups = groups.filter(g => g.isMember);
  const otherGroups = groups.filter(g => !g.isMember);

  if (loading) return <div className="gp-page"><Navbar /><p className="gp-loading">Loading groups...</p></div>;

  return (
    <div className="gp-page">
      <Navbar />
      <div className="gp-body">
        <div className="gp-header">
          <h1>Groups</h1>
          <p className="gp-subtitle">Join groups to connect with peers who share your interests</p>
        </div>

        {myGroups.length > 0 && (
          <section className="gp-section">
            <h2 className="gp-section-title">Your groups</h2>
            <div className="gp-grid">
              {myGroups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onToggle={handleToggle}
                  onView={() => navigate(`/groups/${group.slug}`)}
                  joining={joining === group.id}
                />
              ))}
            </div>
          </section>
        )}

        <section className="gp-section">
          <h2 className="gp-section-title">{myGroups.length > 0 ? 'Discover more' : 'All groups'}</h2>
          {otherGroups.length === 0 ? (
            <p className="gp-empty">You've joined all available groups!</p>
          ) : (
            <div className="gp-grid">
              {otherGroups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onToggle={handleToggle}
                  onView={() => navigate(`/groups/${group.slug}`)}
                  joining={joining === group.id}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function GroupCard({ group, onToggle, onView, joining }) {
  return (
    <div className="gp-card">
      {group.imageUrl && (
        <div className="gp-card-img">
          <img src={group.imageUrl} alt={group.name} />
        </div>
      )}
      <div className="gp-card-body">
        <h3 className="gp-card-name">{group.name}</h3>
        {group.description && <p className="gp-card-desc">{group.description}</p>}
        <div className="gp-card-footer">
          <span className="gp-member-count">
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </span>
          <div className="gp-card-actions">
            {group.isMember && (
              <button className="gp-btn-view" onClick={onView}>View</button>
            )}
            <button
              className={`gp-btn-join ${group.isMember ? 'joined' : ''}`}
              onClick={() => onToggle(group)}
              disabled={joining}
            >
              {joining ? '...' : group.isMember ? '✓ Joined' : 'Join'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
