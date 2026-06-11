import { useState, useEffect } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "badge-blue",
  LOGOUT: "badge-gray",
  REGISTER: "badge-green",
  LINK_REQUESTED: "badge-blue",
  LINK_INVALID: "badge-red",
  LINK_BLOCKED_PERSONAL: "badge-amber",
  LINK_DENIED_INACTIVE: "badge-red",
  REPORT_GENERATED: "badge-blue",
  REPORT_CACHE_HIT: "badge-gray",
  REPORT_CREDIT_DENIED: "badge-red",
};

export function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api.auth.auditLog(page)
      .then(({ logs }) => setLogs(logs))
      .catch((err: any) => setError(err.message ?? "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [page]);

  const formatAction = (action: string) =>
    action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Layout>
      <PageHeader
        label="Admin"
        title="Audit Log"
        subtitle="All system activity — report generations, errors, and events."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="shimmer h-12 rounded-lg" />)}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide hidden md:table-cell">Detail</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide hidden lg:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                        No audit log entries yet.
                      </td>
                    </tr>
                  ) : logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap font-mono">
                        {new Date(log.createdAt).toLocaleString("en-GB", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${ACTION_COLORS[log.action] ?? "badge-gray"}`}>
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-primary)] max-w-[180px] truncate">
                        {log.email ?? <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] hidden md:table-cell max-w-[200px] truncate">
                        {log.detail ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] hidden lg:table-cell font-mono">
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[var(--text-muted)]">Page {page} · up to 50 entries</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Previous</button>
              <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}
                className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
