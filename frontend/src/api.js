const API_URL = `https://${process.env.REACT_APP_API_URL || window.location.hostname}/api`;

async function request(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const getEvents = () => request("GET", "/events");

export const getEventDetail = (id) => request("GET", `/events/${id}`);

export const rsvpEvent = (eventId, status = "going") =>
  request("POST", `/events/${eventId}/rsvp`, { status });

export const unrsvpEvent = (eventId) =>
  request("DELETE", `/events/${eventId}/rsvp`);

export const getCurrentUser = () => request("GET", "/users/me");

export const updateProfile = (data) =>
  request("PUT", "/users/me", data);
