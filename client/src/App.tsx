import { Switch, Route } from "wouter";
import { Home } from "@/pages/Home";
import { Reports } from "@/pages/Reports";
import { Dashboard } from "@/pages/Dashboard";
import { Mission } from "@/pages/Mission";
import { Presentation } from "@/pages/Presentation";
import { Batch } from "@/pages/Batch";
import { Demo } from "@/pages/Demo";
import { AuditLog } from "@/pages/AuditLog";
import { Login } from "@/pages/Login";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] text-center px-6">
      <div className="font-mono text-8xl font-bold text-blue-200 mb-4">404</div>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">Page not found</h1>
      <p className="text-[var(--text-secondary)] mb-8">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn-primary">Go home</a>
    </div>
  );
}

// Wrap page components in a ProtectedRoute for gated routes.
const gated = (Component: React.ComponentType, opts?: { admin?: boolean }) =>
  () => (
    <ProtectedRoute adminOnly={opts?.admin}>
      <Component />
    </ProtectedRoute>
  );

export default function App() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/demo" component={Demo} />
      <Route path="/login" component={Login} />

      {/* Gated */}
      <Route path="/reports" component={gated(Reports)} />
      <Route path="/reports/:slug" component={gated(Dashboard)} />
      <Route path="/mission" component={gated(Mission)} />
      <Route path="/presentation" component={gated(Presentation)} />
      <Route path="/batch" component={gated(Batch)} />
      <Route path="/audit-log" component={gated(AuditLog, { admin: true })} />

      <Route component={NotFound} />
    </Switch>
  );
}
