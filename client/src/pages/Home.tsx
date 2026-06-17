import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";

const EXAMPLE_COMPANIES = [
  "Apple", "Microsoft", "HSBC", "Barclays",
  "Amazon", "Nvidia", "Deutsche Bank", "Shell",
];

export function Home() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async (company: string = query) => {
    if (!company.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { report } = await api.reports.generate(company.trim());
      navigate(`/reports/${report.companySlug}`);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGenerate();
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-10 sm:py-20 text-center">
        <div className="animate-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--primary-dim)] bg-[var(--primary-light)] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
          <span className="text-xs font-medium text-[var(--primary)] uppercase tracking-widest">
            Stellanor Intelligence Platform
          </span>
        </div>

        <h1 className="animate-fade-up animate-delay-100 mb-4 max-w-3xl text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl px-2">
          Company Intelligence,{" "}
          <span className="text-[var(--primary)]">On Demand</span>
        </h1>

        <p className="animate-fade-up animate-delay-200 mb-8 max-w-xl text-base sm:text-lg text-[var(--text-secondary)] px-4">
          Enter any company name. Get a full strategic analysis — financials, market position,
          tech stack, SWOT, risks, and growth opportunities — in under 60 seconds.
        </p>

        {/* Search */}
        <div className="animate-fade-up animate-delay-300 w-full max-w-2xl px-2">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:shadow-sm">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Apple, HSBC, Barclays…"
                disabled={loading}
                className="w-full rounded-lg sm:rounded-r-none border border-[var(--border)] bg-[var(--bg-secondary)] py-3.5 pl-10 pr-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-dim)] disabled:opacity-60 text-sm shadow-sm sm:shadow-none"
              />
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !query.trim()}
              className="btn-primary rounded-lg sm:rounded-l-none justify-center py-3.5 px-5 shrink-0"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  Generate
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-800 bg-red-950 px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="animate-fade-up mt-6 card max-w-xs w-full text-center shadow-md mx-4">
            <div className="flex justify-center mb-3">
              <div className="relative h-9 w-9">
                <div className="absolute inset-0 rounded-full border-2 border-[var(--primary-dim)]" />
                <div className="absolute inset-0 rounded-full border-t-2 border-[var(--primary)] animate-spin" />
              </div>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Generating report…</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Usually ready in 30 seconds</p>
          </div>
        )}

        {!loading && (
          <div className="animate-fade-up animate-delay-400 mt-5 flex flex-wrap justify-center gap-2 px-4">
            <span className="text-xs text-[var(--text-muted)] self-center">Try:</span>
            {EXAMPLE_COMPANIES.map((company) => (
              <button
                key={company}
                onClick={() => handleGenerate(company)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-secondary)] transition-all hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] shadow-sm"
              >
                {company}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="py-10 sm:py-14 border-t border-[var(--border)]">
        <div className="text-center mb-7">
          <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2">
            10 Intelligence Layers. One Report.
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto text-sm">
            Built for sales teams, account executives, and strategic planners.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FEATURES.map(({ icon, label, desc }, i) => (
            <div
              key={label}
              className="card text-center p-4 animate-fade-up hover:shadow-md transition-shadow"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="mb-2 flex justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-light)] border border-[var(--primary-dim)] text-sm">
                  {icon}
                </div>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)] mb-1">{label}</div>
              <div className="text-xs text-[var(--text-muted)] leading-relaxed hidden sm:block">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Export callout */}
      <section className="py-8 sm:py-10 border-t border-[var(--border)]">
        <div className="rounded-lg border border-[var(--primary-dim)] bg-[var(--primary-light)] px-5 py-7 sm:px-8 sm:py-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-1.5">Export in any format</h3>
            <p className="text-[var(--text-secondary)] text-sm">PDF, PowerPoint, or HTML — ready for client presentations and briefs.</p>
          </div>
          <div className="flex gap-2 sm:gap-3 shrink-0">
            {["PDF", "PPTX", "HTML"].map((fmt) => (
              <div key={fmt} className="flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-sm">
                <span className="text-[var(--primary)] font-mono text-xs sm:text-sm font-semibold">.{fmt.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

const FEATURES = [
  { icon: "📊", label: "Financials", desc: "Revenue, margins, market cap, growth trends" },
  { icon: "🎯", label: "Strategy", desc: "Vision, initiatives, geographic focus, M&A" },
  { icon: "🌍", label: "Market", desc: "TAM, competitors, customer segments" },
  { icon: "💻", label: "Tech Spend", desc: "IT budget, cloud platforms, key vendors" },
  { icon: "🌱", label: "ESG", desc: "Environmental, social & governance ratings" },
  { icon: "⚡", label: "SWOT", desc: "Strengths, weaknesses, opportunities, threats" },
  { icon: "📈", label: "Growth", desc: "Identified opportunities and potential value" },
  { icon: "⚠️", label: "Risks", desc: "Business, regulatory, and market risks" },
  { icon: "🔄", label: "Digital", desc: "DX maturity, AI adoption, data strategy" },
  { icon: "🤝", label: "Sales Brief", desc: "Tailored sales intelligence for your product" },
];
