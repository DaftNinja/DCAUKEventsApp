import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If true, require isAdmin in addition to being authenticated. */
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(location);
      setLocation(`/login?next=${next}`);
    } else if (adminOnly && !user.isAdmin) {
      setLocation("/");
    }
  }, [loading, user, adminOnly, location, setLocation]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-sm text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  if (!user || (adminOnly && !user.isAdmin)) {
    return null;
  }

  return <>{children}</>;
}
