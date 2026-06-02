import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUser(); }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/users/me');
      setUser(data);
      setFormData(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      navigate('/');
    } finally {
      setLoading(false);
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

  return (
    <div className="pp-page">
      <Navbar />

      <div className="pp-body">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
