import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './AdminPage.css';

const ROLE_LABELS = {
  admin:     { label: 'Admin',     color: '#dc2626', bg: '#fee2e2' },
  organiser: { label: 'Organiser', color: '#7c3aed', bg: '#ede9fe' },
  member:    { label: 'Member',    color: '#475569', bg: '#f1f5f9' },
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [updating, setUpdating] = useState(null); // userId being updated

  useEffect(() => {
    api.get('/api/admin/users')
      .then(setUsers)
      .catch(e => {
        if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
          navigate('/events');
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleRoleChange(userId, newRole) {
    setUpdating(userId);
    try {
      const updated = await api.put(`/api/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updated.role } : u));
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    } finally {
      setUpdating(null);
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.company?.toLowerCase().includes(q)
    );
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const counts = {
    all:       users.length,
    admin:     users.filter(u => u.role === 'admin').length,
    organiser: users.filter(u => u.role === 'organiser').length,
    member:    users.filter(u => u.role === 'member').length,
  };

  if (loading) return <div className="admin-page"><Navbar /><p className="admin-loading">Loading...</p></div>;
  if (error)   return <div className="admin-page"><Navbar /><p className="admin-error">Error: {error}</p></div>;

  return (
    <div className="admin-page">
      <Navbar />
      <div className="admin-body">

        <div className="admin-header">
          <div>
            <h1>User Management</h1>
            <p className="admin-subtitle">Manage roles for all community members</p>
          </div>
          <a href="/admin/events" className="admin-link-btn">Event approvals →</a>
        </div>

        {/* Role filter tabs */}
        <div className="admin-tabs">
          {['all', 'admin', 'organiser', 'member'].map(role => (
            <button
              key={role}
              className={`admin-tab ${filterRole === role ? 'active' : ''}`}
              onClick={() => setFilterRole(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
              <span className="admin-tab-count">{counts[role]}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          className="admin-search"
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* User table */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Company</th>
                <th>Joined</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">No members match your search.</td>
                </tr>
              ) : filtered.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-user-cell">
                      {user.avatarUrl
                        ? <img src={user.avatarUrl} alt={user.name} className="admin-avatar" />
                        : <div className="admin-avatar-initials">
                            {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                          </div>
                      }
                      <div>
                        <div className="admin-user-name">{user.name || '—'}</div>
                        {user.headline && <div className="admin-user-headline">{user.headline}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="admin-email">{user.email}</td>
                  <td className="admin-company">{user.company || '—'}</td>
                  <td className="admin-date">
                    {new Date(user.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td>
                    <select
                      className="admin-role-select"
                      value={user.role}
                      disabled={updating === user.id}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      style={{
                        background: ROLE_LABELS[user.role]?.bg,
                        color: ROLE_LABELS[user.role]?.color,
                      }}
                    >
                      <option value="member">Member</option>
                      <option value="organiser">Organiser</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
