import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";

const ADMIN_EMAIL = "andrew@mccreath.vip";

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      
      if (userData.email === ADMIN_EMAIL) {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/events", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{color: "white", padding: "50px"}}>Loading...</div>;
  if (!isAdmin) return <div style={{color: "white", padding: "50px"}}>Not authorized</div>;

  return (
    <div style={{
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      minHeight: "100vh",
      padding: "40px 20px",
      color: "white"
    }}>
      <button onClick={() => navigate("/events")} style={{marginBottom: "20px", padding: "10px 20px", background: "white", color: "#667eea", border: "none", borderRadius: "6px", cursor: "pointer"}}>
        ← Back
      </button>
      <h1>Admin Events ({events.length})</h1>
      <p>Logged in as: {user?.email}</p>
      
      <div style={{marginTop: "30px"}}>
        {events.map((event) => (
          <div key={event.id} style={{background: "white", color: "#333", padding: "20px", marginBottom: "10px", borderRadius: "8px"}}>
            <h3>{event.title}</h3>
            <p><strong>Status:</strong> {event.status}</p>
            <p><strong>Location:</strong> {event.location}</p>
            <p><strong>Organiser Email:</strong> {event.organizerEmail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
