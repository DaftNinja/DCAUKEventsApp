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

const STATUS_LABELS = {
  active:    { label: 'Active',    color: '#065f46', bg: '#d1fae5' },
  suspended: { label: 'Suspended', color: '#92400e', bg: '#fef3c7' },
};

const EMPTY_FORM = { name: '', email: '', company: '', headline: '', role: 'member' };

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Detail panel state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [panelError, setPanelError] = useState(null);

  // Add user modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await api.get('/api/admin/users');
      setUsers(data);
    } catch (e) {
      if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
        navigate('/events');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Panel ──────────────────────────────────────────────────────────────────

  function openPanel(user) {
    setSelectedUser(user);
    setEditForm({
      name:     user.name     || '',
      email:    user.email    || '',
      company:  user.company  || '',
      headline: user.headline || '',
      bio:      user.bio      || '',
      role:     user.role,
      status:   user.status,
    });
    setEditing(false);
    setPanelError(null);
  }

  function closePanel() {
    setSelectedUser(null);
    setEditing(false);
    setPanelError(null);
  }

  async function handleSave() {
    setSaving(true);
    setPanelError(null);
    try {
      const updated = await api.put(`/api/admin/users/${selectedUser.id}`, editForm);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updated } : u));
      setSelectedUser(prev => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      setPanelError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSuspend() {
    const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
    setSaving(true);
    setPanelError(null);
    try {
      const updated = await api.put(`/api/admin/users/${selectedUser.id}`, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: updated.status } : u));
      setSelectedUser(prev => ({ ...prev, status: updated.status }));
    } catch (err) {
      setPanelError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId) {
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      closePanel();
      setConfirmDelete(null);
    } catch (err) {
      setPanelError(err.message);
      setConfirmDelete(null);
    }
  }

  // ── Add user ───────────────────────────────────────────────────────────────

  async function handleAddUser(e) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const newUser = await api.post('/api/admin/users', addForm);
      setUsers(prev => [...prev, { ...newUser, avatarUrl: null }]);
      setShowAddModal(false);
      setAddForm(EMPTY_FORM);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

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
            <p className="admin-subtitle">Manage roles, details and access for all community members</p>
          </div>
          <div className="admin-header-actions">
            <button className="admin-add-btn" onClick={() => setShowAddModal(true)}>+ Add user</button>
            <a href="/admin/events" className="admin-link-btn">Event approvals →</a>
          </div>
        </div>

        {/* Tabs */}
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

        <input
          className="admin-search"
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Table */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Company</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="admin-empty">No members match your search.</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="admin-row" onClick={() => openPanel(user)}>
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
                    {new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <span className="admin-status-badge" style={{ background: STATUS_LABELS[user.status]?.bg, color: STATUS_LABELS[user.status]?.color }}>
                      {STATUS_LABELS[user.status]?.label || user.status}
                    </span>
                  </td>
                  <td>
                    <span className="admin-role-badge" style={{ background: ROLE_LABELS[user.role]?.bg, color: ROLE_LABELS[user.role]?.color }}>
                      {ROLE_LABELS[user.role]?.label || user.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── User detail panel ─────────────────────────────────────────────── */}
      {selectedUser && (
        <>
          <div className="admin-overlay" onClick={closePanel} />
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div className="admin-panel-avatar">
                {selectedUser.avatarUrl
                  ? <img src={selectedUser.avatarUrl} alt={selectedUser.name} />
                  : <div className="admin-panel-initials">
                      {selectedUser.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                    </div>
                }
              </div>
              <div>
                <div className="admin-panel-name">{selectedUser.name}</div>
                <div className="admin-panel-email">{selectedUser.email}</div>
              </div>
              <button className="admin-panel-close" onClick={closePanel}>✕</button>
            </div>

            {panelError && <div className="admin-panel-error">{panelError}</div>}

            {editing ? (
              <div className="admin-panel-form">
                <div className="admin-panel-section-title">Edit details</div>

                {[
                  ['Name',     'name',     'text',  'Full name'],
                  ['Email',    'email',    'email', 'email@example.com'],
                  ['Company',  'company',  'text',  'Company name'],
                  ['Headline', 'headline', 'text',  'Role / title'],
                ].map(([label, field, type, placeholder]) => (
                  <div className="admin-field" key={field}>
                    <label>{label}</label>
                    <input
                      type={type}
                      value={editForm[field]}
                      placeholder={placeholder}
                      onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    />
                  </div>
                ))}

                <div className="admin-field">
                  <label>Bio</label>
                  <textarea
                    value={editForm.bio}
                    rows={3}
                    onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                  />
                </div>

                <div className="admin-field-row">
                  <div className="admin-field">
                    <label>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="member">Member</option>
                      <option value="organiser">Organiser</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Status</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="admin-panel-actions">
                  <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button className="admin-btn-ghost" onClick={() => { setEditing(false); setPanelError(null); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-panel-details">
                {[
                  ['Company',  selectedUser.company],
                  ['Headline', selectedUser.headline],
                  ['Bio',      selectedUser.bio],
                  ['Joined',   new Date(selectedUser.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div className="admin-panel-row" key={label}>
                    <span className="admin-panel-label">{label}</span>
                    <span className="admin-panel-value">{value}</span>
                  </div>
                ))}

                <div className="admin-panel-row">
                  <span className="admin-panel-label">Role</span>
                  <span className="admin-role-badge" style={{ background: ROLE_LABELS[selectedUser.role]?.bg, color: ROLE_LABELS[selectedUser.role]?.color }}>
                    {ROLE_LABELS[selectedUser.role]?.label}
                  </span>
                </div>
                <div className="admin-panel-row">
                  <span className="admin-panel-label">Status</span>
                  <span className="admin-status-badge" style={{ background: STATUS_LABELS[selectedUser.status]?.bg, color: STATUS_LABELS[selectedUser.status]?.color }}>
                    {STATUS_LABELS[selectedUser.status]?.label}
                  </span>
                </div>

                <div className="admin-panel-actions">
                  <button className="admin-btn-primary" onClick={() => setEditing(true)}>Edit details</button>
                  <button
                    className={`admin-btn-warning`}
                    onClick={handleToggleSuspend}
                    disabled={saving}
                  >
                    {selectedUser.status === 'active' ? 'Suspend account' : 'Reinstate account'}
                  </button>
                  <button
                    className="admin-btn-danger"
                    onClick={() => setConfirmDelete(selectedUser)}
                  >
                    Delete account
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h2>Delete account?</h2>
            <p>This will permanently delete <strong>{confirmDelete.name}</strong>'s account and all their RSVPs. This cannot be undone.</p>
            <div className="admin-modal-actions">
              <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>
                Yes, delete
              </button>
              <button className="admin-btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add user modal ────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h2>Add user manually</h2>
            <p className="admin-modal-note">This creates an account without LinkedIn. The user can sign in with LinkedIn later and their account will be linked if the email matches.</p>
            {addError && <div className="admin-panel-error">{addError}</div>}
            <form onSubmit={handleAddUser}>
              {[
                ['Name *',     'name',     'text',  true],
                ['Email *',    'email',    'email', true],
                ['Company',    'company',  'text',  false],
                ['Headline',   'headline', 'text',  false],
              ].map(([label, field, type, required]) => (
                <div className="admin-field" key={field}>
                  <label>{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={addForm[field]}
                    onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="admin-field">
                <label>Role</label>
                <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="member">Member</option>
                  <option value="organiser">Organiser</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="admin-modal-actions">
                <button type="submit" className="admin-btn-primary" disabled={adding}>
                  {adding ? 'Adding…' : 'Add user'}
                </button>
                <button type="button" className="admin-btn-ghost" onClick={() => { setShowAddModal(false); setAddError(null); setAddForm(EMPTY_FORM); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
