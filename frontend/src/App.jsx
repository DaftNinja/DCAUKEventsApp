import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import PastEventsPage from "./pages/PastEventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import SubmitEventPage from "./pages/SubmitEventPage";
import NewsPage from "./pages/NewsPage";
import MyEventsPage from "./pages/MyEventsPage";
import AdminEventsPage from "./pages/AdminEventsPage";
import AdminPage from "./pages/AdminPage";
import AuthCallback from "./pages/AuthCallback";
import ProfilePage from "./pages/ProfilePage";
import MembersPage from "./pages/MembersPage";
import GroupsPage from "./pages/GroupsPage";
import GroupPage from "./pages/GroupPage";
import "./App.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("token");
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem("token"));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Silent token refresh on app load — if token exists and is valid, swap it for a fresh one
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/auth/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) {
          localStorage.setItem("token", data.token);
        }
      })
      .catch(() => {
        // Refresh failed silently — user will get a 401 on next API call
      });
  }, []);

  const auth = (el) => isAuthenticated ? el : <Navigate to="/" replace />;

  return (
    <Router>
      <Routes>
        <Route path="/"                element={<HomePage />} />
        <Route path="/auth/success"    element={<AuthCallback setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/events"          element={auth(<EventsPage />)} />
        <Route path="/events/past"     element={auth(<PastEventsPage />)} />
        <Route path="/events/submit"   element={auth(<SubmitEventPage />)} />
        <Route path="/events/:id"      element={<EventDetailPage />} />
        <Route path="/news"            element={auth(<NewsPage />)} />
        <Route path="/my-events"       element={auth(<MyEventsPage />)} />
        <Route path="/admin/events"    element={auth(<AdminEventsPage />)} />
        <Route path="/admin"           element={auth(<AdminPage />)} />
        <Route path="/profile"         element={auth(<ProfilePage />)} />
        <Route path="/members"         element={auth(<MembersPage />)} />
        <Route path="/groups"           element={auth(<GroupsPage />)} />
        <Route path="/groups/:slug"     element={auth(<GroupPage />)} />
      </Routes>
    </Router>
  );
}
