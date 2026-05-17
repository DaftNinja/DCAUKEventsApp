import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    fetchUser();
  }, [navigate]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/me');
      setUser(response.data);
      setFormData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await api.put('/users/me', {
        bio: formData.bio,
        headline: formData.headline,
        company: formData.company,
      });
      setUser(response.data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/');
  };

  if (loading) return <div className="profile-page"><p>Loading profile...</p></div>;
  if (error) return <div className="profile-page"><p>Error: {error}</p></div>;
  if (!user) return <div className="profile-page"><p>Profile not found</p></div>;

  return (
    <div className="profile-page">
      <nav className="navbar">
        <Link to="/events" className="back-link">← Back to Events</Link>
      </nav>

      <div className="container">
        <div className="profile-header">
          {user.avatarUrl && <img src={user.avatarUrl} alt={user.name} className="avatar" />}
          <div>
            <h1>{user.name}</h1>
            {user.headline && <p className="headline">{user.headline}</p>}
            {user.company && <p className="company">{user.company}</p>}
          </div>
        </div>

        {!editing ? (
          <div className="profile-info">
            {user.bio && (
              <div className="bio-section">
                <h3>Bio</h3>
                <p>{user.bio}</p>
              </div>
            )}

            <div className="profile-meta">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Member since:</strong> {new Date(user.createdAt).toLocaleDateString('en-GB')}</p>
            </div>

            <div className="actions">
              <button className="edit-btn" onClick={() => setEditing(true)}>
                Edit Profile
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        ) : (
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="headline">Job Title</label>
              <input
                type="text"
                id="headline"
                name="headline"
                value={formData.headline || ''}
                onChange={handleInputChange}
                placeholder="Your job title"
              />
            </div>

            <div className="form-group">
              <label htmlFor="company">Company</label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company || ''}
                onChange={handleInputChange}
                placeholder="Your company"
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio || ''}
                onChange={handleInputChange}
                placeholder="Tell us about yourself"
                rows="5"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setEditing(false);
                  setFormData(user);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
