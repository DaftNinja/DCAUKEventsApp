import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { StellanorMark } from "@/components/StellanorLogo";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/reports", label: "Reports" },
  { href: "/demo", label: "Demo", highlight: true },
  { href: "/mission", label: "Mission" },
  { href: "/presentation", label: "Investor Deck" },
  { href: "/batch", label: "Batch Upload" },
];

// Sun / Moon toggle button — used in both desktop and mobile
function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDay = theme === "day";
  return (
    <button
      onClick={toggle}
      aria-label={isDay ? "Switch to dark mode" : "Switch to day mode"}
      title={isDay ? "Switch to dark mode" : "Switch to day mode"}
      className={`flex items-center justify-center h-8 w-8 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary-dim)] transition-colors ${className}`}
    >
      {isDay ? (
        // Moon — switch to dark
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — switch to day
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
}

// ─── Credit badge with popover ───────────────────────────────────────────────
function CreditBadge({ credits }: { credits: number }) {
  const [open, setOpen] = useState(false);
  const low = credits <= 1;
  const out = credits === 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
        className={`text-[10px] font-medium flex items-center gap-1 transition-colors ${
          out ? "text-red-400" : low ? "text-amber-400" : "text-[var(--text-muted)] hover:text-[var(--primary)]"
        }`}
      >
        {out ? "No credits" : `${credits} credit${credits === 1 ? "" : "s"}`}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-5 z-50 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl p-4"
          onMouseDown={e => e.preventDefault()} // prevent blur on click inside
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">Report Credits</span>
            <span className={`text-lg font-extrabold font-mono ${
              out ? "text-red-400" : low ? "text-amber-400" : "text-[var(--primary)]"
            }`}>
              {credits === 999999 ? "∞" : credits}
            </span>
          </div>

          {/* Progress bar */}
          {credits !== 999999 && (
            <div className="mb-3">
              <div className="h-1.5 rounded-full bg-[var(--bg-secondary)]">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    out ? "bg-red-500" : low ? "bg-amber-400" : "bg-[var(--primary)]"
                  }`}
                  style={{ width: `${Math.min(100, (credits / 5) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[var(--text-muted)]">0</span>
                <span className="text-[10px] text-[var(--text-muted)]">5 starting credits</span>
              </div>
            </div>
          )}

          {/* Explanation */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            Each new report generation uses 1 credit.
            Cached reports and refreshes are always free.
          </p>

          {/* Status message */}
          {out ? (
            <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-400">
              You've used all your credits. Contact us to get more.
            </div>
          ) : low ? (
            <div className="rounded-lg bg-amber-950 border border-amber-800 px-3 py-2 text-xs text-amber-400">
              Running low — 1 credit remaining.
            </div>
          ) : null}

          {/* CTA */}
          <a
            href="mailto:contact@stellanordc.com?subject=Report Credits Request"
            className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-lg border border-[var(--primary-dim)] bg-[var(--primary-light)] px-3 py-2 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
          >
            Request more credits
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const isDay = theme === "day";

  useEffect(() => { setMenuOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    setLocation("/");
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] backdrop-blur-md" style={{ backgroundColor: "var(--bg-nav)" }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <StellanorMark height={32} />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Stellanor</span>
            <span className="hidden text-xs text-[var(--text-muted)] sm:block">Insight Generator</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, highlight }) => {
              const active = href === "/" ? location === "/" : location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : highlight
                      ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                  style={highlight && !active ? { color: "var(--primary-btn-text)" } : undefined}
                >
                  {highlight && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <polygon points="2,1 9,5 2,9" />
                    </svg>
                  )}
                  {label}
                </Link>
              );
            })}
            {user?.isAdmin && (
              <>
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    location.startsWith("/admin") && !location.startsWith("/audit")
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Users
                </Link>
                <Link
                  href="/audit-log"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    location.startsWith("/audit-log")
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Audit Log
                </Link>
              </>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[var(--primary-dim)] bg-[var(--primary-light)] px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              <span className="text-xs font-medium text-[var(--primary)]">AI Live</span>
            </div>

            {/* Desktop theme toggle */}
            <ThemeToggle className="hidden md:flex" />

            {!loading && (
              <div className="hidden sm:flex items-center gap-2">
                {user ? (
                  <>
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-xs font-medium text-[var(--text-primary)]">{user.firstName} {user.lastName}</span>
                      {user.isAdmin ? (
                        <span className="text-[10px] text-[var(--text-muted)]">Admin</span>
                      ) : (
                        <CreditBadge credits={user.reportCredits} />
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors"
                    style={{ color: "var(--primary-btn-text)" }}
                  >
                    Sign in
                  </Link>
                )}
              </div>
            )}

            {/* Hamburger */}
            <button
              className="md:hidden flex flex-col justify-center items-center h-9 w-9 rounded-md hover:bg-[var(--bg-secondary)] transition-colors gap-1.5"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span className={`block h-0.5 w-5 bg-[var(--text-primary)] transition-all duration-200 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
              <span className={`block h-0.5 w-5 bg-[var(--text-primary)] transition-all duration-200 ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-5 bg-[var(--text-primary)] transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {menuOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMenuOpen(false)} />}

      {/* Mobile menu */}
      <div
        className={`fixed top-14 left-0 right-0 z-40 md:hidden border-b border-[var(--border)] shadow-lg transition-all duration-200 ${menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
        style={{ backgroundColor: "var(--bg-mobile-menu)" }}
      >
        <div className="px-4 py-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, highlight }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : highlight
                    ? "bg-[var(--primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                }`}
                style={highlight && !active ? { color: "var(--primary-btn-text)" } : undefined}
              >
                {highlight && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <polygon points="2,1 9,5 2,9" />
                  </svg>
                )}
                {label}
              </Link>
            );
          })}
          {user?.isAdmin && (
            <Link
              href="/audit-log"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            >
              Audit Log
            </Link>
          )}

          <div className="border-t border-[var(--border)] mt-2 pt-3">
            {!loading && (user ? (
              <>
                <div className="px-4 pb-3">
                  <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{user.firstName} {user.lastName}</div>
                  {user.isAdmin ? (
                    <span className="text-xs text-[var(--text-muted)]">Admin</span>
                  ) : (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 mt-2">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">Report Credits</span>
                        <span className={`text-base font-extrabold font-mono ${
                          user.reportCredits === 0 ? "text-red-400" : user.reportCredits <= 1 ? "text-amber-400" : "text-[var(--primary)]"
                        }`}>
                          {user.reportCredits === 999999 ? "∞" : user.reportCredits}
                        </span>
                      </div>
                      {/* Progress bar */}
                      {user.reportCredits !== 999999 && (
                        <div className="mb-2">
                          <div className="h-1.5 rounded-full bg-[var(--bg-card)]">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                user.reportCredits === 0 ? "bg-red-500" : user.reportCredits <= 1 ? "bg-amber-400" : "bg-[var(--primary)]"
                              }`}
                              style={{ width: `${Math.min(100, (user.reportCredits / 5) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Explanation */}
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
                        Each new report uses 1 credit. Cached reports are free.
                      </p>
                      {/* Status */}
                      {user.reportCredits === 0 ? (
                        <div className="rounded-md bg-red-950 border border-red-800 px-2.5 py-1.5 text-xs text-red-400 mb-2">
                          No credits remaining.
                        </div>
                      ) : user.reportCredits <= 1 ? (
                        <div className="rounded-md bg-amber-950 border border-amber-800 px-2.5 py-1.5 text-xs text-amber-400 mb-2">
                          Running low — 1 credit remaining.
                        </div>
                      ) : null}
                      {/* CTA */}
                      <a
                        href="mailto:contact@stellanordc.com?subject=Report Credits Request"
                        className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-[var(--primary-dim)] bg-[var(--primary-light)] px-3 py-2 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
                      >
                        Request more credits
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-light)]"
              >
                Sign in
              </Link>
            ))}
          </div>

          {/* Mobile theme toggle row */}
          <div className="border-t border-[var(--border)] pt-3 pb-1 px-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              <span className="text-xs font-medium text-[var(--primary)]">AI Live</span>
            </div>
            <button
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors border border-[var(--border)]"
            >
              {isDay ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  Dark mode
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  Day mode
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface LayoutProps { children: React.ReactNode; className?: string; }

export function Layout({ children, className = "" }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      <main className={`mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 ${className}`}>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ label, title, subtitle, children }: {
  label?: string; title: string; subtitle?: string; children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-10 animate-fade-up">
      {label && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--primary-dim)] bg-[var(--primary-light)] px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
          <span className="text-xs font-medium text-[var(--primary)] uppercase tracking-widest">{label}</span>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}
