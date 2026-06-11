const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    const error: any = new Error(err.error ?? `Request failed: ${res.status}`);
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
