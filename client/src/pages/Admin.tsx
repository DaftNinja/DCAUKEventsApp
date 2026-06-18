import { useState, useEffect } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { formatDate } from "@/lib/utils";

interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  isActive: boolean;
  reportCredits: number;
  createdAt: string | null;
  lastLoginAt: string | null;
}

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "credits"; user: AdminUser }
  | { type: "delete"; user: AdminUser };

export function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) navigate("/");
  }, [user, authLoading, navigate]);

  const loadUsers = async () => {
    try {
      const { users: u } = await api.auth.admin.listUsers();
      setUsers(u);
    } catch (err: any) {
      setError(err.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    !search || [u.email, u.firstName, u.lastName, u.company ?? ""].some(f =>
      f.toLowerCase().includes(search.toLowerCase())
    )
  );

  // ── Create user ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", company: "", reportCredits: 5 });
  const [formError, setFormError] = useState("");

  const handleCreate = async () => {
    setFormError("");
    setSaving(true);
    try {
      await api.auth.admin.createUser({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        company: form.company.trim() || undefined,
        reportCredits: form.reportCredits,
      });
      setModal({ type: "none" });
      setForm({ email: "", firstName: "", lastName: "", company: "", reportCredits: 5 });
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message ?? "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  // ── Update credits ───────────────────────────────────────────────────────────
  const [newCredits, setNewCredits] = useState(0);

  const handleUpdateCredits = async (userId: number) => {
    setSaving(true);
    try {
      await api.auth.admin.updateUser(userId, { reportCredits: newCredits });
      setModal({ type: "none" });
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? "Failed to update credits");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────────────
  const handleToggleActive = async (u: AdminUser) => {
    try {
      await api.auth.admin.updateUser(u.id, { isActive: !u.isActive });
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? "Failed to update user");
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (userId: number) => {
    setSaving(true);
    try {
      await api.auth.admin.deleteUser(userId);
      setModal({ type: "none" });
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user?.isAdmin) return null;

  return (
    <Layout>
      <PageHeader
        label="Admin"
        title="User Management"
        subtitle={`${users.length} registered user${users.length === 1 ? "" : "s"}`}
      >
        <button onClick={() => setModal({ type: "create" })} className="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add User
        </button>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)]"
        />
      </div>

      {/* User table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  {["User", "Company", "Credits", "Status", "Last Login", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(u => (
                  <tr key={u.id} className={`transition-colors hover:bg-[var(--bg-secondary)] ${!u.isActive ? "opacity-50" : ""}`}>
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                    </td>
                    {/* Company */}
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {u.company ?? <span className="text-[var(--text-muted)] italic">—</span>}
                    </td>
                    {/* Credits */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setNewCredits(u.reportCredits); setModal({ type: "credits", user: u }); }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] transition-colors"
                      >
                        {u.reportCredits === 999999 ? "∞" : u.reportCredits}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`badge border text-xs font-medium ${u.isActive ? "bg-green-950 text-green-400 border-green-800" : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)]"}`}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                    {/* Last Login */}
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {u.lastLoginAt ? formatDate(new Date(u.lastLoginAt)) : "Never"}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setModal({ type: "delete", user: u })}
                        className="rounded-md px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-red-950 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Create user */}
      {modal.type === "create" && (
        <Modal title="Add User" onClose={() => { setModal({ type: "none" }); setFormError(""); }}>
          <div className="space-y-3">
            {formError && <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-400">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className={INPUT} placeholder="Jane" />
              </Field>
              <Field label="Last name">
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className={INPUT} placeholder="Smith" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INPUT} placeholder="jane@company.com" />
            </Field>
            <Field label="Company (optional)">
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={INPUT} placeholder="Acme Ltd" />
            </Field>
            <Field label="Starting credits">
              <input type="number" min={0} max={999999} value={form.reportCredits} onChange={e => setForm(f => ({ ...f, reportCredits: parseInt(e.target.value) || 0 }))} className={INPUT} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => { setModal({ type: "none" }); setFormError(""); }} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.email || !form.firstName || !form.lastName} className="btn-primary">
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit credits */}
      {modal.type === "credits" && (
        <Modal title={`Credits — ${modal.user.firstName} ${modal.user.lastName}`} onClose={() => setModal({ type: "none" })}>
          <p className="text-sm text-[var(--text-secondary)] mb-4">{modal.user.email}</p>
          <Field label="Report credits">
            <input
              type="number"
              min={0}
              max={999999}
              value={newCredits}
              onChange={e => setNewCredits(parseInt(e.target.value) || 0)}
              className={INPUT}
              autoFocus
            />
          </Field>
          <p className="text-xs text-[var(--text-muted)] mt-1">Set to 999999 for unlimited access.</p>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setModal({ type: "none" })} className="btn-secondary">Cancel</button>
            <button onClick={() => handleUpdateCredits(modal.user.id)} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {modal.type === "delete" && (
        <Modal title="Delete User" onClose={() => setModal({ type: "none" })}>
          <p className="text-sm text-[var(--text-secondary)] mb-1">
            Are you sure you want to delete <span className="font-medium text-[var(--text-primary)]">{modal.user.firstName} {modal.user.lastName}</span>?
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-5">{modal.user.email} · This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal({ type: "none" })} className="btn-secondary">Cancel</button>
            <button
              onClick={() => handleDelete(modal.user.id)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-dim)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
