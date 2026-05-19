import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import MyEventsPage from "./pages/MyEventsPage";
import AuthCallback from "./pages/AuthCallback";
import ProfilePage from "./pages/ProfilePage";
import "./App.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem("token");
    console.log("🔍 Checking auth status, token exists:", !!token);
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/success" element={<AuthCallback />} />
        <Route
          path="/events"
          element={isAuthenticated ? <EventsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/my-events"
          element={isAuthenticated ? <MyEventsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}
