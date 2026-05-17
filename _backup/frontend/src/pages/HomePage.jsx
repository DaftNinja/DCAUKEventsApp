import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already logged in, redirect to events
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/events');
    }
  }, [navigate]);

  const handleLinkedInSignIn = () => {
    window.location.href = '/api/auth/linkedin';
  };

  return (
    <div className="home-page">
      <div className="container">
        <div className="content">
          <h1>DCA Community Events</h1>
          <p>Discover events, connect with professionals, and stay informed about the digital infrastructure industry.</p>
          
          <div className="features">
            <div className="feature">
              <h3>📅 Events</h3>
              <p>Find and RSVP to industry events</p>
            </div>
            <div className="feature">
              <h3>👥 Network</h3>
              <p>See who's attending and connect</p>
            </div>
            <div className="feature">
              <h3>🔔 Reminders</h3>
              <p>Get notified about events you care about</p>
            </div>
          </div>

          <button className="signin-btn" onClick={handleLinkedInSignIn}>
            Sign in with LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
}
