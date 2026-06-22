// [FIX P1] Vite apps must use import.meta.env.VITE_* — not process.env.REACT_APP_*.
// In dev, VITE_API_URL is left empty so Vite's proxy in vite.config.js handles /api.
// In production (Railway), set VITE_API_URL to your Railway public URL.
const BASE_URL = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};

// Returns the currently authenticated user from localStorage.
// Used by AdminEventsPage, ProfilePage, and others.
export function getCurrentUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Update the current user's profile via the API and refresh localStorage.
export async function updateProfile(data) {
  const updated = await request("/api/users/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  // Keep localStorage in sync so getCurrentUser() stays accurate
  localStorage.setItem("user", JSON.stringify(updated));
  return updated;
}

// Log out: invalidate token server-side then clear local auth state.
export async function logout() {
  const token = localStorage.getItem("token");
  if (token) {
    // Fire and forget — don't block UI on server response
    fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {}); // silently ignore network errors
  }
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}
