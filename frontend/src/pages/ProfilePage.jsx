import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateProfile } from '../api';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const data = await getCurrentUser();
      setUser(data);
      setFormData(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setUser(formData);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (loading) {
    return <div className="profile-page">Loading...</div>;
  }

  if (!user) {
    return <div className="profile-page">No user data</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <button className="back-btn" onClick={() => navigate('/events')}>
          ← Back to Events
        </button>

        <div className="profile-header">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt={user.name} className="profile-avatar" />
          )}
          <div className="profile-info">
            <h1>{user.name}</h1>
            <p className="email">{user.email}</p>
          </div>
        </div>

        {editing ? (
          <div className="profile-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Headline</label>
              <input
                type="text"
                value={formData.headline || ''}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Company</label>
              <input
                type="text"
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button className="btn-save" onClick={handleSave}>Save</button>
              <button className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="profile-details">
            {user.headline && <p><strong>Headline:</strong> {user.headline}</p>}
            {user.company && <p><strong>Company:</strong> {user.company}</p>}
            {user.bio && <p><strong>Bio:</strong> {user.bio}</p>}

            <div className="profile-actions">
              <button className="btn-edit" onClick={() => setEditing(true)}>Edit Profile</button>
              <button className="btn-logout" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
