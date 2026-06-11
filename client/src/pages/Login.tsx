import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Stage = "form" | "signup" | "sent";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "That link was missing a token. Request a new one below.",
  invalid_link: "That sign-in link is invalid or has expired. Request a new one below.",
  account_disabled: "Your account has been deactivated. Contact contact@1giglabs.com.",
  session_failed: "Something went wrong while signing you in. Please try again.",
  server_error: "The sign-in service hit an error. Please request a new link.",
};

function parseQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");

  const [stage, setStage] = useState<Stage>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // Surface ?error=... query params from the magic-link callback.
  useEffect(() => {
    const q = parseQuery();
    const err = q.get("error");
    if (err && ERROR_MESSAGES[err]) setError(ERROR_MESSAGES[err]);
  }, []);

  // If already signed in, bounce to `next` (or /).
  useEffect(() => {
    if (!loading && user) {
      const next = parseQuery().get("next") ?? "/";
      setLocation(next);
    }
  }, [loading, user, setLocation]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.auth.requestLink({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        company: company.trim() || undefined,
      });
      setStage("sent");
    } catch (err: any) {
      // Server signals "newUser: true" when names are required for a first-time sign-up.
      if (err?.data?.newUser) {
        setStage("signup");
        setError(err.message);
      } else {
        setError(err?.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-sm text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/">
          <a className="mb-8 flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary)] text-white">
              <span className="text-sm font-bold">1GL</span>
            </div>
            <span className="text-base font-semibold text-[var(--text-primary)]">1GigLabs</span>
          </a>
        </Link>

        <div className="rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
          {stage === "sent" ? (
            <SentPanel email={email} onBack={() => { setStage("form"); setError(""); }} />
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {stage === "signup" ? "Create your account" : "Sign in"}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {stage === "signup"
                  ? "Enter your details and we'll email you a sign-in link."
                  : "Enter your business email and we'll send you a one-time sign-in link."}
              </p>

              {error && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="Email" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INPUT_CLS}
                    placeholder="you@company.com"
                  />
                </Field>

                {stage === "signup" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="First name" htmlFor="firstName">
                        <input
                          id="firstName"
                          autoComplete="given-name"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Last name" htmlFor="lastName">
                        <input
                          id="lastName"
                          autoComplete="family-name"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={INPUT_CLS}
                        />
                      </Field>
                    </div>
                    <Field label="Company (optional)" htmlFor="company">
                      <input
                        id="company"
                        autoComplete="organization"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className={INPUT_CLS}
                      />
                    </Field>
                  </>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Sending…" : stage === "signup" ? "Create account & send link" : "Send sign-in link"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
                By signing in you agree to receive a one-time email from <span className="font-mono">contact@1giglabs.com</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-md border border-[var(--border)] bg-white py-2.5 px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function SentPanel({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Check your email</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        If <span className="font-medium text-[var(--text-primary)]">{email}</span> is eligible, we've sent a sign-in link.
        It expires in 15 minutes and can only be used once.
      </p>
      <button onClick={onBack} className="btn-secondary mt-6">Use a different email</button>
    </div>
  );
}
