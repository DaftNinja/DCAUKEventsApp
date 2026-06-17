import { useState, useEffect } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportInvestorPPTX } from "@/lib/export";
import type { Report } from "@shared/schema";

// ─── Rating badge colour map ──────────────────────────────────────────────────
const RATING_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  buy:           { bg: "bg-green-950",  text: "text-green-400",  border: "border-green-800" },
  overweight:    { bg: "bg-green-950",  text: "text-green-400",  border: "border-green-800" },
  outperform:    { bg: "bg-green-950",  text: "text-green-400",  border: "border-green-800" },
  neutral:       { bg: "bg-[var(--bg-secondary)]", text: "text-[var(--text-secondary)]", border: "border-[var(--border)]" },
  hold:          { bg: "bg-[var(--bg-secondary)]", text: "text-[var(--text-secondary)]", border: "border-[var(--border)]" },
  "market perform": { bg: "bg-[var(--bg-secondary)]", text: "text-[var(--text-secondary)]", border: "border-[var(--border)]" },
  underweight:   { bg: "bg-red-950",   text: "text-red-400",    border: "border-red-800" },
  sell:          { bg: "bg-red-950",   text: "text-red-400",    border: "border-red-800" },
};

function ratingColour(rating: string) {
  return RATING_COLOURS[rating?.toLowerCase()] ?? RATING_COLOURS["neutral"];
}

// Colour accent per bank for the left border stripe
const BANK_COLOURS: Record<string, string> = {
  "jp morgan":           "#0054a4",
  "jpmorgan":            "#0054a4",
  "barclays":            "#00aeef",
  "morgan stanley":      "#003087",
  "wolfe research":      "#7c3aed",
  "jefferies":           "#e31837",
  "goldman sachs":       "#5b8cff",
  "deutsche bank":       "#0018a8",
  "ubs":                 "#e2001a",
  "citi":                "#003b70",
  "citigroup":           "#003b70",
  "hsbc":                "#db0011",
  "rbc capital":         "#005daa",
  "rbc capital markets": "#005daa",
  "bofa":                "#e21837",
  "bofa securities":     "#e21837",
  "bank of america":     "#e21837",
  "berenberg":           "#004b87",
  "numis":               "#003865",
  "peel hunt":           "#00a36c",
  "panmure gordon":      "#8b0000",
  "credit suisse":       "#001155",
  "raymond james":       "#003087",
};

function bankAccent(bank: string): string {
  const key = bank.toLowerCase();
  for (const [k, v] of Object.entries(BANK_COLOURS)) {
    if (key.includes(k)) return v;
  }
  return "var(--primary)";
}

export function Presentation() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [presentation, setPresentation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    api.reports.list().then(setReports).finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex(i => i !== null && i < presentation.slides.length - 1 ? i + 1 : i);
      if (e.key === "ArrowLeft")  setLightboxIndex(i => i !== null && i > 0 ? i - 1 : i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, presentation]);

  // Allowlist approach — mirrors server-side isPubliclyListed()
  // A company is public ONLY if its stockExchange contains a recognised exchange name or ticker prefix.
  const selectedReport = reports.find(r => r.companySlug === selectedSlug);
  const stockExchange: string = (selectedReport?.reportData as any)?.executiveSummary?.stockExchange ?? "";

  function isPubliclyListed(s: string): boolean {
    if (!s || !s.trim()) return false;
    const u = s.trim().toUpperCase();
    return [
      /\bNYSE\b/, /\bNASDAQ\b/, /\bAMEX\b/, /\bOTCBB\b/, /\bOTC\b/,
      /\bLSE\b/, /\bLONDON\s*STOCK\s*EXCHANGE\b/, /\bAIM\b/,
      /\bEURONEXT\b/, /\bXETRA\b/, /\bFSE\b/, /\bFRANKFURT\b/,
      /\bSIX\b/, /\bSWX\b/, /\bOMX\b/, /\bBME\b/, /\bBORSA\s*ITALIANA\b/, /\bENXT\b/,
      /\bTSE\b/, /\bTOKYO\b/, /\bTYO\b/, /\bHKEX\b/, /\bHKG\b/,
      /\bASX\b/, /\bSGX\b/, /\bBSE\b/, /\bNSE\b/,
      /\bTSX\b/, /\bTSX-V\b/, /\bJSE\b/, /\bB3\b/,
      /[A-Z]{2,6}:\s*[A-Z]{1,6}/,
    ].some(p => p.test(u));
  }

  const isPrivate = !!selectedSlug && !isPubliclyListed(stockExchange);

  const handleGenerate = async () => {
    if (!selectedSlug || isPrivate) return;
    setLoading(true);
    setPresentation(null);
    try {
      const { presentation: p } = await api.reports.investorPresentation(selectedSlug);
      setPresentation(p);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!presentation) return;
    setExporting(true);
    try {
      const selectedReport = reports.find(r => r.companySlug === selectedSlug);
      await exportInvestorPPTX(presentation, selectedReport?.companyName ?? presentation.title);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const currentSlide = lightboxIndex !== null ? presentation?.slides?.[lightboxIndex] : null;
  const totalSlides  = presentation?.slides?.length ?? 0;
  const citations: any[] = presentation?.analystCitations ?? [];
  const consensus: any   = presentation?.analystConsensus ?? null;

  return (
    <Layout>
      <PageHeader
        label="Investor Deck"
        title="Investor Presentation Generator"
        subtitle="Generate a structured investor deck for any company in your portfolio."
      />

      {/* Company selector */}
      <div className="card mb-8 animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Select Company
            </label>
            {fetching ? (
              <div className="shimmer h-10 rounded-lg" />
            ) : (
              <select
                value={selectedSlug}
                onChange={(e) => { setSelectedSlug(e.target.value); setPresentation(null); }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              >
                <option value="">— Select a company report —</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.companySlug}>
                    {r.companyName} · {r.industry ?? "Unknown"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selectedSlug || loading || isPrivate}
            className="btn-primary shrink-0 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : <>Generate Deck</>}
          </button>
        </div>

        {/* Private company warning */}
        {isPrivate && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-800 bg-amber-950 px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-400">Privately held company</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Investor presentations are only available for publicly listed companies.
                {stockExchange && stockExchange.trim() && (
                  <span className="ml-1">This company is listed as <span className="font-medium">{stockExchange}</span>.</span>
                )}
              </p>
            </div>
          </div>
        )}

        {reports.length === 0 && !fetching && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            No reports yet. <a href="/" className="text-[var(--primary)] hover:underline">Generate a company report first.</a>
          </p>
        )}
      </div>

      {presentation && (
        <div className="animate-fade-up space-y-8">

          {/* ── Header row ── */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{presentation.title}</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {presentation.date} · {totalSlides} slides · <span>click any slide to expand</span>
              </p>
            </div>
            <button onClick={handleExport} disabled={exporting} className="btn-secondary shrink-0">
              {exporting ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              )}
              Download .PPTX
            </button>
          </div>

          {/* ── Analyst citations panel ── */}
          {citations.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              {/* Panel header + consensus summary */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Analyst Coverage</span>
                  <span className="badge badge-gray">{citations.length} banks</span>
                  {citations.some((c: any) => c.stale) && (
                    <span className="text-xs text-amber-500 flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      some ratings may be outdated
                    </span>
                  )}
                </div>
                {consensus && (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)] text-xs">Consensus</span>
                      <span className={`badge border text-xs font-bold ${ratingColour(consensus.overallRating).bg} ${ratingColour(consensus.overallRating).text} ${ratingColour(consensus.overallRating).border}`}>
                        {consensus.overallRating}
                      </span>
                    </div>
                    {consensus.averagePriceTarget && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--text-muted)] text-xs">Avg. Target</span>
                        <span className="font-bold text-[var(--primary)]">{consensus.averagePriceTarget}</span>
                      </div>
                    )}
                    {consensus.numAnalysts && (
                      <span className="text-xs text-[var(--text-muted)] hidden md:block">{consensus.numAnalysts}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Citation rows */}
              <div className="divide-y divide-[var(--border)]">
                {citations.map((c: any, i: number) => {
                  const rc = ratingColour(c.rating);
                  const accent = bankAccent(c.bank);
                  return (
                    <div key={i} className="flex items-start gap-4 px-5 py-3.5" style={{ borderLeft: `3px solid ${accent}` }}>
                      <div className="w-36 shrink-0">
                        <div className="text-xs font-semibold text-[var(--text-primary)]">{c.bank}</div>
                        {c.analyst && <div className="text-xs text-[var(--text-muted)] mt-0.5">{c.analyst}</div>}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-[var(--text-muted)]">{c.date}</span>
                          {c.stale && (
                            <span className="text-[10px] font-medium text-amber-500 border border-amber-700 bg-amber-950 rounded px-1 py-px leading-none">
                              stale
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-28 shrink-0 pt-0.5">
                        <span className={`badge border text-xs font-bold ${rc.bg} ${rc.text} ${rc.border}`}>
                          {c.rating}
                        </span>
                        {c.priceTarget && (
                          <span className="text-xs font-bold text-[var(--text-primary)]">{c.priceTarget}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed flex-1 pt-0.5">{c.note}</p>
                    </div>
                  );
                })}
              </div>

              {/* Bull / bear footer */}
              {consensus && (consensus.bullCase || consensus.bearCase) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)] border-t border-[var(--border)]">
                  {consensus.bullCase && (
                    <div className="px-5 py-3 flex items-start gap-2">
                      <span className="text-green-400 text-lg leading-none mt-0.5">↑</span>
                      <div>
                        <div className="text-xs font-semibold text-green-400 mb-0.5">Bull Case</div>
                        <p className="text-xs text-[var(--text-secondary)]">{consensus.bullCase}</p>
                      </div>
                    </div>
                  )}
                  {consensus.bearCase && (
                    <div className="px-5 py-3 flex items-start gap-2">
                      <span className="text-red-400 text-lg leading-none mt-0.5">↓</span>
                      <div>
                        <div className="text-xs font-semibold text-red-400 mb-0.5">Bear Case</div>
                        <p className="text-xs text-[var(--text-secondary)]">{consensus.bearCase}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Slide grid ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {presentation.slides?.map((slide: any, i: number) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className="card-hover animate-fade-up text-left w-full group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded border border-[var(--primary-dim)] bg-[var(--primary-light)] font-mono text-xs font-bold text-[var(--primary)]">
                    {slide.slideNumber}
                  </div>
                  <div className="flex items-center gap-2">
                    {slide.metric && (
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)]">{slide.metric.label}</div>
                        <div className="font-display text-base font-bold text-[var(--primary)]">{slide.metric.value}</div>
                      </div>
                    )}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </div>
                </div>
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)] mb-1">{slide.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{slide.headline}</p>
                {slide.bullets?.length > 0 && (
                  <ul className="space-y-1">
                    {slide.bullets.slice(0, 4).map((b: string, j: number) => (
                      <li key={j} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                        <span className="text-[var(--primary)] shrink-0">·</span>{b}
                      </li>
                    ))}
                    {slide.bullets.length > 4 && (
                      <li className="text-xs text-[var(--text-muted)] pl-3.5 italic">
                        +{slide.bullets.length - 4} more…
                      </li>
                    )}
                  </ul>
                )}
              </button>
            ))}
          </div>

          {presentation.disclaimer && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{presentation.disclaimer}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && currentSlide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded border border-[var(--primary-dim)] bg-[var(--primary-light)] font-mono text-xs font-bold text-[var(--primary)]">
                  {currentSlide.slideNumber}
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{currentSlide.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{lightboxIndex + 1} / {totalSlides}</span>
                <button
                  onClick={() => setLightboxIndex(null)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {currentSlide.headline && (
                <p className="text-base font-medium text-[var(--primary)] leading-snug">{currentSlide.headline}</p>
              )}
              {currentSlide.metric?.value && (
                <div className="inline-flex flex-col rounded-lg border border-[var(--primary-dim)] bg-[var(--primary-light)] px-4 py-2">
                  <span className="text-xs text-[var(--text-muted)]">{currentSlide.metric.label}</span>
                  <span className="text-2xl font-extrabold text-[var(--primary)] font-display">{currentSlide.metric.value}</span>
                </div>
              )}
              {currentSlide.bullets?.length > 0 && (
                <ul className="space-y-2.5">
                  {currentSlide.bullets.map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                      <span className="text-[var(--primary)] shrink-0 mt-0.5">◆</span>{b}
                    </li>
                  ))}
                </ul>
              )}

              {/* Analyst consensus slide — inline citations */}
              {currentSlide.type === "analyst_consensus" && citations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Analyst Ratings</div>
                  {citations.map((c: any, i: number) => {
                    const rc = ratingColour(c.rating);
                    const accent = bankAccent(c.bank);
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] px-3 py-2" style={{ borderLeft: `3px solid ${accent}` }}>
                        <span className="text-xs font-semibold text-[var(--text-primary)] w-28 shrink-0">{c.bank}</span>
                        <span className={`badge border text-xs font-bold shrink-0 ${rc.bg} ${rc.text} ${rc.border}`}>{c.rating}</span>
                        {c.priceTarget && <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">{c.priceTarget}</span>}
                        <span className="text-xs text-[var(--text-muted)] truncate">{c.note}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={() => setLightboxIndex(i => i !== null && i > 0 ? i - 1 : i)}
                disabled={lightboxIndex === 0}
                className="btn-secondary disabled:opacity-30"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Previous
              </button>
              <span className="text-xs text-[var(--text-muted)] hidden sm:block">Use ← → arrow keys to navigate</span>
              <button
                onClick={() => setLightboxIndex(i => i !== null && i < totalSlides - 1 ? i + 1 : i)}
                disabled={lightboxIndex === totalSlides - 1}
                className="btn-secondary disabled:opacity-30"
              >
                Next
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
