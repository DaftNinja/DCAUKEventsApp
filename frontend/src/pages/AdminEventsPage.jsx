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
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      
      const token = localStorage.getItem("token");
      const res = await fetch("/api/events", { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{padding: "50px", color: "white"}}>Loading...</div>;
  }

  return (
    <div style={{background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", minHeight: "100vh", padding: "40px 20px", color: "white"}}>
      <button onClick={() => navigate("/events")} style={{marginBottom: "20px", padding: "10px 20px", background: "white", color: "#667eea", border: "none", borderRadius: "6px", cursor: "pointer"}}>Back</button>
      <h1>Admin Events ({events.length})</h1>
      <p>{user?.email}</p>
      <div style={{marginTop: "20px"}}>
        {events.map(e => (
          <div key={e.id} style={{background: "white", color: "#333", padding: "15px", marginBottom: "10px", borderRadius: "8px"}}>
            <h3 style={{margin: 0}}>{e.title}</h3>
            <p><strong>Status:</strong> {e.status}</p>
            <p><strong>Location:</strong> {e.location}</p>
            <p><strong>Organiser:</strong> {e.organizerEmail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
