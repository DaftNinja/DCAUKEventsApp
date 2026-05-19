import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";
import "./AdminEventsPage.css";

const ADMIN_EMAIL = "andrew@mccreath.vip";

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);

      if (userData.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        const token = localStorage.getItem("token");
        const response = await fetch("/api/events", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        setEvents(data);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  if (loading) return <div className="admin-page"><p style={{color: "white", padding: "50px"}}>Loading...</p></div>;
  if (!isAdmin) return <div className="admin-page"><p style={{color: "white", padding: "50px"}}>Not authorized</p></div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="back-btn" onClick={() => navigate("/events")}>← Back</button>
        <h1>Admin Events</h1>
        <p className="admin-info">{user?.email}</p>
      </div>

      <div className="admin-container">
        <div className="events-summary">
          <h2>Events ({events.length})</h2>
          <button className="btn-create" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Create Event"}
          </button>
        </div>

        {showForm && (
          <div className="event-form">
            <h3>Create Event (Form Coming Soon)</h3>
          </div>
        )}

        <div className="events-grid">
          {events.map((event) => (
            <div key={event.id} className="event-admin-card">
              <h4>{event.title}</h4>
              <p>{event.location}</p>
              <p>{new Date(event.startDate).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
