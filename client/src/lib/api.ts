const BASE = "/api";

// Module-level callback for SSE progress events from report generation
let generateProgressCallback: ((data: { stage: string; message: string }) => void) | null = null;

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
    new Promise<any>((resolve, reject) => {
      // Use fetch with ReadableStream to consume SSE from POST endpoint
      fetch(`${BASE}/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyName, forceRefresh }),
      }).then(async res => {
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
          const e: any = new Error(err.error ?? `Request failed: ${res.status}`);
          e.status = res.status; e.data = err;
          return reject(e);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processLine = (line: string) => {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              // Fire onProgress callback if registered
              if (generateProgressCallback) generateProgressCallback(data);
            } catch { /* ignore parse errors */ }
          }
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          }
        };

        let currentEvent = "";
        const processChunk = (text: string) => {
          buffer += text;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
            else if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === "done") { resolve(data); currentEvent = ""; }
                else if (currentEvent === "error") {
                  const e: any = new Error(data.error ?? "Generation failed");
                  e.status = data.code === "NO_CREDITS" ? 403 : 500;
                  e.data = data;
                  reject(e); currentEvent = "";
                } else if (currentEvent === "progress") {
                  if (generateProgressCallback) generateProgressCallback(data);
                  currentEvent = "";
                }
              } catch { /* ignore */ }
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          processChunk(decoder.decode(value, { stream: true }));
        }
      }).catch(reject);
    }),
  onProgress: (cb: ((data: { stage: string; message: string }) => void) | null) => {
    generateProgressCallback = cb;
  },
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
