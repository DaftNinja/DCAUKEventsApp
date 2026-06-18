const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
    const message = typeof err.error === 'string' && err.error
      ? err.error
      : `Request failed: ${res.status}`;
    const error: any = new Error(message);
    error.status = res.status;
    error.data = err;
    throw error;
  }

  return res.json();
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  reportCredits: number;
  isAdmin: boolean;
}

export const api = {
  auth: {
    requestLink: (payload: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
    }) =>
      request<{ message: string }>("/auth/request-link", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    me: () => request<{ user: AuthUser | null }>("/auth/me"),
    logout: () =>
      request<{ message: string }>("/auth/logout", { method: "POST" }),
    auditLog: (page = 1) => request<any>(`/auth/audit-log?page=${page}`),
    admin: {
      listUsers: () => request<{ users: any[] }>("/auth/admin/users"),
      createUser: (payload: { email: string; firstName: string; lastName: string; company?: string; reportCredits: number }) =>
        request<{ user: any }>("/auth/admin/users", { method: "POST", body: JSON.stringify(payload) }),
      updateUser: (id: number, payload: { reportCredits?: number; isActive?: boolean }) =>
        request<{ user: any }>(`/auth/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
      deleteUser: (id: number) =>
        request<{ success: boolean }>(`/auth/admin/users/${id}`, { method: "DELETE" }),
    },
  },
  reports: {
    list: () => request<any[]>("/reports"),
    get: (slug: string) => request<any>(`/reports/${slug}`),
    generate: (companyName: string, forceRefresh = false) =>
      request<any>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({ companyName, forceRefresh }),
      }),
    delete: (id: number) =>
      request<any>(`/reports/${id}`, { method: "DELETE" }),
    salesEnablement: (slug: string, sellerProduct: string) =>
      request<any>(`/reports/${slug}/sales-enablement`, {
        method: "POST",
        body: JSON.stringify({ sellerProduct }),
      }),
    investorPresentation: (slug: string) =>
      request<any>(`/reports/${slug}/investor-presentation`, { method: "POST" }),
    batch: (companies: string[]) =>
      request<any>("/reports/batch", {
        method: "POST",
        body: JSON.stringify({ companies }),
      }),
  },
};
