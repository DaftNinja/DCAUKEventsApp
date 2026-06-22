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

  const [adminTab, setAdminTab] = useState('users');

  const [allAdminEvents, setAllAdminEvents] = useState([]);
  const [pendingEvents, setPendingEvents]   = useState([]);
  const [eventsLoading, setEventsLoading]   = useState(false);
  const [eventsError, setEventsError]       = useState(null);

  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const [selectedUser, setSelectedUser] = useState(null);
  const [editing, setEditing]           = useState(false);
  const [editForm, setEditForm]         = useState({});
  const [saving, setSaving]             = useState(false);
  const [panelError, setPanelError]     = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm]           = useState(EMPTY_FORM);
  const [addError, setAddError]         = useState(null);
  const [adding, setAdding]             = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);

  const [newsItems, setNewsItems]       = useState([]);
  const [newsLoading, setNewsLoading]   = useState(false);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [newsForm, setNewsForm]         = useState({ title: '', url: '', summary: '', source: '' });
  const [newsError, setNewsError]       = useState(null);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { if (adminTab === 'news') loadNews(); }, [adminTab]);
  useEffect(() => { if (adminTab === 'events') loadPendingEvents(); }, [adminTab]);

  async function loadPendingEvents() {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const all = await api.get('/api/events');
      setAllAdminEvents(all);
      setPendingEvents(all.filter(e => e.status === 'pending'));
    } catch (e) {
      setEventsError('Failed to load pending events');
    } finally {
      setEventsLoading(false);
    }
  }

  async function handleApprove(eventId) {
    try {
      const updated = await api.post(`/api/events/${eventId}/approve`);
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
      setAllAdminEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'approved' } : e));
    } catch (e) {
      console.error('Failed to approve event:', e);
    }
  }

  async function handleReject(eventId) {
    if (!confirm('Reject this event submission?')) return;
    try {
      await api.post(`/api/events/${eventId}/reject`);
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
      setAllAdminEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'rejected' } : e));
    } catch (e) {
      console.error('Failed to reject event:', e);
    }
  }

  async function handleToggleFeature(eventId) {
    try {
      const updated = await api.post(`/api/events/${eventId}/feature`);
      setAllAdminEvents(prev => prev.map(e => e.id === eventId ? { ...e, featured: updated.featured } : e));
    } catch (e) {
      console.error('Failed to toggle featured:', e);
    }
  }

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

  async function loadNews() {
    setNewsLoading(true);
    try {
      const data = await api.get('/api/news');
      setNewsItems(data.filter(i => i.type === 'manual'));
    } catch (e) {
      console.error('Failed to load news:', e);
    } finally {
      setNewsLoading(false);
    }
  }

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

  async function handlePostNews(e) {
    e.preventDefault();
    setNewsError(null);
    try {
      const item = await api.post('/api/news', {
        ...newsForm,
        publishedAt: new Date().toISOString(),
      });
      setNewsItems(prev => [item, ...prev]);
      setNewsForm({ title: '', url: '', summary: '', source: '' });
      setShowNewsForm(false);
    } catch (err) {
      setNewsError(err.message);
    }
  }

  async function handleDeleteNews(id) {
    try {
      await api.delete(`/api/news/${id}`);
      setNewsItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
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
            <h1>Admin</h1>
            <p className="admin-subtitle">Manage users, roles and news content</p>
          </div>
          <div className="admin-header-actions">
            {adminTab === 'users' && (
              <button className="admin-add-btn" onClick={() => setShowAddModal(true)}>+ Add user</button>
            )}
            {adminTab === 'news' && (
              <button className="admin-add-btn" onClick={() => setShowNewsForm(f => !f)}>
                {showNewsForm ? 'Cancel' : '+ Post news item'}
              </button>
            )}
            <a href="/admin/events" className="admin-link-btn">Event approvals →</a>
          </div>
        </div>

        <div className="admin-top-tabs">
          <button className={`admin-top-tab ${adminTab === 'users' ? 'active' : ''}`} onClick={() => setAdminTab('users')}>Users</button>
          <button className={`admin-top-tab ${adminTab === 'events' ? 'active' : ''}`} onClick={() => setAdminTab('events')}>
            Events {pendingEvents.length > 0 && adminTab !== 'events' ? <span className="admin-tab-badge">{pendingEvents.length}</span> : null}
          </button>
          <button className={`admin-top-tab ${adminTab === 'news' ? 'active' : ''}`} onClick={() => setAdminTab('news')}>News</button>
        </div>

        {adminTab === 'users' && (
          <>
            <div className="admin-tabs">
              {['all', 'admin', 'organiser', 'member'].map(role => (
                <button key={role} className={`admin-tab ${filterRole === role ? 'active' : ''}`} onClick={() => setFilterRole(role)}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                  <span className="admin-tab-count">{counts[role]}</span>
                </button>
              ))}
            </div>

            <input className="admin-search" type="text" placeholder="Search by name, email, or company..."
              value={search} onChange={e => setSearch(e.target.value)} />

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Member</th><th>Email</th><th>Company</th><th>Joined</th><th>Status</th><th>Role</th>
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
                            : <div className="admin-avatar-initials">{user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}</div>
                          }
                          <div>
                            <div className="admin-user-name">{user.name || '—'}</div>
                            {user.headline && <div className="admin-user-headline">{user.headline}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="admin-email">{user.email}</td>
                      <td className="admin-company">{user.company || '—'}</td>
                      <td className="admin-date">{new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td><span className="admin-status-badge" style={{ background: STATUS_LABELS[user.status]?.bg, color: STATUS_LABELS[user.status]?.color }}>{STATUS_LABELS[user.status]?.label || user.status}</span></td>
                      <td><span className="admin-role-badge" style={{ background: ROLE_LABELS[user.role]?.bg, color: ROLE_LABELS[user.role]?.color }}>{ROLE_LABELS[user.role]?.label || user.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {adminTab === 'events' && (
          <div className="admin-events-panel">
            <div className="admin-events-header">
              <h2>Pending Event Submissions</h2>
              <p>Review and approve or reject events submitted by members and organisers.</p>
            </div>
            {eventsLoading && <p className="admin-events-loading">Loading...</p>}
            {eventsError  && <p className="admin-events-error">{eventsError}</p>}
            {!eventsLoading && !eventsError && pendingEvents.length === 0 && (
              <div className="admin-events-empty">
                <p>No pending submissions — you're all caught up!</p>
              </div>
            )}
            {pendingEvents.map(event => (
              <div key={event.id} className="admin-event-card">
                <div className="admin-event-info">
                  <h3 className="admin-event-title">{event.title}</h3>
                  <div className="admin-event-meta">
                    <span>📅 {new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {event.location && <span>📍 {event.location}</span>}
                    {event.organiser && <span>🏢 {event.organiser}</span>}
                    {event.organizerEmail && <span>✉️ {event.organizerEmail}</span>}
                  </div>
                  {event.description && <p className="admin-event-desc">{event.description}</p>}
                  {event.eventUrl && (
                    <a href={event.eventUrl} target="_blank" rel="noopener noreferrer" className="admin-event-url">
                      View on event website →
                    </a>
                  )}
                </div>
                <div className="admin-event-actions">
                  <button className="admin-event-approve" onClick={() => handleApprove(event.id)}>✓ Approve</button>
                  <button className="admin-event-reject" onClick={() => handleReject(event.id)}>✗ Reject</button>
                </div>
              </div>
            ))}

            {/* Featured / approved events list */}
            {allAdminEvents.filter(e => e.status === 'approved').length > 0 && (
              <>
                <div className="admin-events-header" style={{marginTop:'2rem'}}>
                  <h2>Approved Events — Feature Toggle</h2>
                  <p>Pin events to the top of the events list.</p>
                </div>
                {allAdminEvents
                  .filter(e => e.status === 'approved')
                  .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
                  .map(event => (
                    <div key={event.id} className={`admin-event-card ${event.featured ? 'featured' : ''}`}>
                      <div className="admin-event-info">
                        {event.featured && <span className="admin-featured-badge">★ Featured</span>}
                        <h3 className="admin-event-title">{event.title}</h3>
                        <div className="admin-event-meta">
                          <span>📅 {new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {event.location && <span>📍 {event.location}</span>}
                        </div>
                      </div>
                      <div className="admin-event-actions">
                        <button
                          className={`admin-event-feature ${event.featured ? 'on' : 'off'}`}
                          onClick={() => handleToggleFeature(event.id)}
                        >
                          {event.featured ? '★ Unpin' : '☆ Pin'}
                        </button>
                      </div>
                    </div>
                  ))
                }
              </>
            )}
          </div>
        )}

        {adminTab === 'news' && (
          <div className="admin-news-panel">
            {showNewsForm && (
              <form className="admin-news-form" onSubmit={handlePostNews}>
                <div className="admin-panel-section-title">Post a news item</div>
                {newsError && <div className="admin-panel-error">{newsError}</div>}
                <div className="admin-field">
                  <label>Headline *</label>
                  <input type="text" required value={newsForm.title} placeholder="Article headline"
                    onChange={e => setNewsForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="admin-field">
                  <label>URL *</label>
                  <input type="url" required value={newsForm.url} placeholder="https://..."
                    onChange={e => setNewsForm(f => ({ ...f, url: e.target.value }))} />
                </div>
                <div className="admin-field">
                  <label>Source *</label>
                  <input type="text" required value={newsForm.source} placeholder="e.g. DCD, LinkedIn, TheVentGuide"
                    onChange={e => setNewsForm(f => ({ ...f, source: e.target.value }))} />
                </div>
                <div className="admin-field">
                  <label>Summary</label>
                  <textarea rows={2} value={newsForm.summary} placeholder="Optional short description..."
                    onChange={e => setNewsForm(f => ({ ...f, summary: e.target.value }))} />
                </div>
                <div className="admin-panel-actions" style={{ flexDirection: 'row', paddingTop: 0 }}>
                  <button type="submit" className="admin-btn-primary">Post item</button>
                  <button type="button" className="admin-btn-ghost" onClick={() => { setShowNewsForm(false); setNewsError(null); }}>Cancel</button>
                </div>
              </form>
            )}

            <div className="admin-news-section-title">
              Manually posted items
              <span className="admin-tab-count" style={{ marginLeft: '0.5rem' }}>{newsItems.length}</span>
            </div>

            {newsLoading ? (
              <p className="admin-loading">Loading...</p>
            ) : newsItems.length === 0 ? (
              <p className="admin-empty" style={{ padding: '2rem', textAlign: 'center' }}>No manually posted items yet.</p>
            ) : (
              <div className="admin-news-list">
                {newsItems.map(item => (
                  <div key={item.id} className="admin-news-row">
                    <div className="admin-news-info">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="admin-news-title">{item.title}</a>
                      <span className="admin-news-source">{item.source} · {new Date(item.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <button className="admin-btn-danger" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}
                      onClick={() => handleDeleteNews(item.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-news-section-title" style={{ marginTop: '2rem' }}>RSS feed sources</div>
            <div className="admin-news-list">
              {['Data Centre Dynamics','Data Centre Magazine','BizClik Media — Data Centre','ITPro — Data Centre','ComputerWeekly — Data Centre','The Register — Data Centre','DatacenterKnowledge','Uptime Institute Journal','DCNN Magazine','The Stack','Silicon Republic','Hosting Journalist','Telecoms.com'].map(source => (
                <div key={source} className="admin-news-row">
                  <div className="admin-news-info">
                    <span className="admin-news-title" style={{ color: '#475569' }}>{source}</span>
                    <span className="admin-news-source">Automatic · refreshes hourly</span>
                  </div>
                  <span className="admin-status-badge" style={{ background: '#d1fae5', color: '#065f46', flexShrink: 0 }}>Active</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <>
          <div className="admin-overlay" onClick={closePanel} />
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div className="admin-panel-avatar">
                {selectedUser.avatarUrl
                  ? <img src={selectedUser.avatarUrl} alt={selectedUser.name} />
                  : <div className="admin-panel-initials">{selectedUser.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}</div>
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
                {[['Name','name','text','Full name'],['Email','email','email','email@example.com'],['Company','company','text','Company name'],['Headline','headline','text','Role / title']].map(([label, field, type, placeholder]) => (
                  <div className="admin-field" key={field}>
                    <label>{label}</label>
                    <input type={type} value={editForm[field]} placeholder={placeholder}
                      onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} />
                  </div>
                ))}
                <div className="admin-field">
                  <label>Bio</label>
                  <textarea value={editForm.bio} rows={3} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} />
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
                  <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                  <button className="admin-btn-ghost" onClick={() => { setEditing(false); setPanelError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="admin-panel-details">
                {[['Company',selectedUser.company],['Headline',selectedUser.headline],['Bio',selectedUser.bio],['Joined',new Date(selectedUser.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})]].filter(([,v])=>v).map(([label,value])=>(
                  <div className="admin-panel-row" key={label}>
                    <span className="admin-panel-label">{label}</span>
                    <span className="admin-panel-value">{value}</span>
                  </div>
                ))}
                <div className="admin-panel-row">
                  <span className="admin-panel-label">Role</span>
                  <span className="admin-role-badge" style={{ background: ROLE_LABELS[selectedUser.role]?.bg, color: ROLE_LABELS[selectedUser.role]?.color }}>{ROLE_LABELS[selectedUser.role]?.label}</span>
                </div>
                <div className="admin-panel-row">
                  <span className="admin-panel-label">Status</span>
                  <span className="admin-status-badge" style={{ background: STATUS_LABELS[selectedUser.status]?.bg, color: STATUS_LABELS[selectedUser.status]?.color }}>{STATUS_LABELS[selectedUser.status]?.label}</span>
                </div>
                <div className="admin-panel-actions">
                  <button className="admin-btn-primary" onClick={() => setEditing(true)}>Edit details</button>
                  <button className="admin-btn-warning" onClick={handleToggleSuspend} disabled={saving}>
                    {selectedUser.status === 'active' ? 'Suspend account' : 'Reinstate account'}
                  </button>
                  <button className="admin-btn-danger" onClick={() => setConfirmDelete(selectedUser)}>Delete account</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h2>Delete account?</h2>
            <p>This will permanently delete <strong>{confirmDelete.name}</strong>'s account and all their RSVPs. This cannot be undone.</p>
            <div className="admin-modal-actions">
              <button className="admin-btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Yes, delete</button>
              <button className="admin-btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h2>Add user manually</h2>
            <p className="admin-modal-note">This creates an account without LinkedIn. The user can sign in with LinkedIn later and their account will be linked if the email matches.</p>
            {addError && <div className="admin-panel-error">{addError}</div>}
            <form onSubmit={handleAddUser}>
              {[['Name *','name','text',true],['Email *','email','email',true],['Company','company','text',false],['Headline','headline','text',false]].map(([label,field,type,required])=>(
                <div className="admin-field" key={field}>
                  <label>{label}</label>
                  <input type={type} required={required} value={addForm[field]}
                    onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))} />
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
                <button type="submit" className="admin-btn-primary" disabled={adding}>{adding ? 'Adding…' : 'Add user'}</button>
                <button type="button" className="admin-btn-ghost" onClick={() => { setShowAddModal(false); setAddError(null); setAddForm(EMPTY_FORM); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
