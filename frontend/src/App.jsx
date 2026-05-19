import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AuthCallback from "./pages/AuthCallback";
import EventsPage from "./pages/EventsPage";
import MyEventsPage from "./pages/MyEventsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminEventsPage from "./pages/AdminEventsPage";
import AdminUsersPage from "./pages/AdminUsersPage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/events" /> : <HomePage />} />
        <Route path="/auth/success" element={<AuthCallback setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/events" element={isAuthenticated ? <EventsPage /> : <Navigate to="/" />} />
        <Route path="/my-events" element={isAuthenticated ? <MyEventsPage /> : <Navigate to="/" />} />
        <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" />} />
        <Route path="/admin/events" element={isAuthenticated ? <AdminEventsPage /> : <Navigate to="/" />} />
        <Route path="/admin/users" element={isAuthenticated ? <AdminUsersPage /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
