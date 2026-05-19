import { useNavigate } from "react-router-dom";
import "./HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    window.location.href = "/api/auth/linkedin";
  };

  const handleEventsClick = () => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/events");
    } else {
      handleLoginClick();
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <h1>DCA Community Events</h1>
        <p className="subtitle">
          Discover events, connect with professionals, and stay informed about
          the digital infrastructure industry.
        </p>

        <div className="features">
          <div className="feature-card" onClick={handleEventsClick} style={{ cursor: "pointer" }}>
            <div className="feature-icon">📅</div>
            <h3>Events</h3>
            <p>Find and RSVP to industry events</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Network</h3>
            <p>See who's attending and connect</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔔</div>
            <h3>Reminders</h3>
            <p>Get notified about events you care about</p>
          </div>
        </div>

        <button className="login-btn" onClick={handleLoginClick}>
          Sign in with LinkedIn
        </button>
      </div>
    </div>
  );
}
