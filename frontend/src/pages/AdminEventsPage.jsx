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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", location: "", startDate: "", startTime: "", endDate: "", 
    endTime: "", organiser: "", organizerEmail: "", sponsors: "", description: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAdmin(userData.email === ADMIN_EMAIL);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/events", { headers: { "Authorization": `Bearer ${token}` } });
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const start = new Date(`${form.startDate}T${form.startTime}`);
      const end = new Date(`${form.endDate}T${form.endTime}`);
      const eventData = {
        title: form.title,
        location: form.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        organiser: form.organiser,
        organizerEmail: form.organizerEmail,
        sponsors: form.sponsors,
        description: form.description
      };
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(eventData)
      });
      if (!res.ok) throw new Error("Failed");
      const newEvent = await res.json();
      setEvents(prev => [...prev, newEvent]);
      setForm({ title: "", location: "", startDate: "", startTime: "", endDate: "", endTime: "", organiser: "", organizerEmail: "", sponsors: "", description: "" });
      setShowForm(false);
      alert("✓ Event created!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete?")) return;
    try {
      await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`/api/events/${id}/approve`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const updated = await res.json();
      setEvents(prev => prev.map(e => e.id === id ? updated : e));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Reason:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/events/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ reason })
      });
      const updated = await res.json();
      setEvents(prev => prev.map(e => e.id === id ? updated : e));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div style={{padding: "50px", color: "white"}}>Loading...</div>;

  return (
    <div style={{background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", minHeight: "100vh", padding: "40px 20px", color: "white"}}>
      <button onClick={() => navigate("/events")} style={{marginBottom: "20px", padding: "10px 20px", background: "white", color: "#667eea", border: "none", borderRadius: "6px", cursor: "pointer"}}>Back</button>
      <div style={{maxWidth: "1200px", margin: "0 auto"}}>
        <h1>Admin Events ({events.length})</h1>
        <p>{user?.email}</p>
        {isAdmin && <button onClick={() => setShowForm(!showForm)} style={{marginTop: "20px", padding: "12px 24px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600"}}>{showForm ? "Cancel" : "+ Create Event"}</button>}

        {showForm && (
          <form onSubmit={handleSubmit} style={{background: "white", color: "#333", padding: "20px", borderRadius: "12px", marginTop: "20px", marginBottom: "20px"}}>
            <h3>Create Event</h3>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
              <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="Title" required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
              <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Location" required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px"}}>
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange} required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px"}}>
              <input type="date" name="endDate" value={form.endDate} onChange={handleChange} required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
              <input type="time" name="endTime" value={form.endTime} onChange={handleChange} required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px"}}>
              <input type="text" name="organiser" value={form.organiser} onChange={handleChange} placeholder="Organiser Name" required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
              <input type="email" name="organizerEmail" value={form.organizerEmail} onChange={handleChange} placeholder="Organiser Email" required style={{padding: "8px", border: "1px solid #ddd", borderRadius: "4px"}} />
            </div>
            <input type="text" name="sponsors" value={form.sponsors} onChange={handleChange} placeholder="Sponsors" style={{width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", marginTop: "10px", boxSizing: "border-box"}} />
            <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" rows="3" style={{width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", marginTop: "10px", boxSizing: "border-box", fontFamily: "inherit"}} />
            <div style={{marginTop: "10px"}}>
              <button type="submit" style={{padding: "10px 20px", background: "#667eea", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "10px"}}>Create</button>
              <button type="button" onClick={() => setShowForm(false)} style={{padding: "10px 20px", background: "#ccc", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer"}}>Cancel</button>
            </div>
          </form>
        )}

        <div style={{marginTop: "20px"}}>
          {events.map(e => (
            <div key={e.id} style={{background: "white", color: "#333", padding: "15px", marginBottom: "10px", borderRadius: "8px"}}>
              <h3 style={{margin: "0 0 5px 0"}}>{e.title}</h3>
              <p style={{margin: "5px 0"}}><strong>Status:</strong> <span style={{padding: "2px 8px", borderRadius: "12px", background: e.status === "approved" ? "#d1fae5" : e.status === "rejected" ? "#fee2e2" : "#fef3c7"}}>{e.status}</span></p>
              <p style={{margin: "5px 0"}}><strong>Location:</strong> {e.location}</p>
              <p style={{margin: "5px 0"}}><strong>Date:</strong> {new Date(e.startDate).toLocaleDateString("en-GB")} {new Date(e.startDate).toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"})}</p>
              <p style={{margin: "5px 0"}}><strong>Organiser:</strong> {e.organiser} ({e.organizerEmail})</p>
              {e.description && <p style={{margin: "5px 0"}}><strong>Description:</strong> {e.description}</p>}
              <div style={{marginTop: "10px"}}>
                {isAdmin && <button onClick={() => handleDelete(e.id)} style={{padding: "6px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "8px"}}>Delete</button>}
                {e.status === "pending" && user?.email === e.organizerEmail && (
                  <>
                    <button onClick={() => handleApprove(e.id)} style={{padding: "6px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "8px"}}>Approve</button>
                    <button onClick={() => handleReject(e.id)} style={{padding: "6px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
