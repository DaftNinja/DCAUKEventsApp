import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import MyEventsPage from "./pages/MyEventsPage";
import AdminEventsPage from "./pages/AdminEventsPage";
import AuthCallback from "./pages/AuthCallback";
import ProfilePage from "./pages/ProfilePage";
import "./App.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("token");
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem("token");
      setIsAuthenticated(!!token);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/success" element={<AuthCallback setIsAuthenticated={setIsAuthenticated} />} />
        <Route
          path="/events"
          element={isAuthenticated ? <EventsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/events/:id"
          element={isAuthenticated ? <EventDetailPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/my-events"
          element={isAuthenticated ? <MyEventsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/events"
          element={isAuthenticated ? <AdminEventsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}