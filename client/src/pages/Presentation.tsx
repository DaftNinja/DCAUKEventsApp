import { useState, useEffect } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportInvestorPPTX } from "@/lib/export";
import type { Report } from "@shared/schema";

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

  // Close lightbox on Escape, navigate with arrow keys
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

  const handleGenerate = async () => {
    if (!selectedSlug) return;
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

  return (
    <Layout>
      <PageHeader
        label="Investor Deck"
        title="Investor Presentation Generator"
        subtitle="Generate a structured investor deck for any company in your portfolio."
      />

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
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500/50"
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
            disabled={!selectedSlug || loading}
            className="btn-primary shrink-0"
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
              <>Generate Deck</>
            )}
          </button>
        </div>
        {reports.length === 0 && !fetching && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            No reports yet. <a href="/" className="text-[var(--primary)] hover:underline">Generate a company report first.</a>
          </p>
        )}
      </div>

      {presentation && (
        <div className="animate-fade-up space-y-4">
          {/* Header row with title + download button */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{presentation.title}</h2>
              <p className="text-sm text-[var(--text-muted)]">{presentation.date} · {totalSlides} slides · <span className="text-[var(--text-muted)]">click any slide to expand</span></p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary shrink-0"
            >
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

          {/* Slide grid — each card is clickable */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {presentation.slides?.map((slide: any, i: number) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className="card-hover animate-fade-up text-left w-full group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded border border-blue-200 bg-blue-50 font-mono text-xs font-bold text-[var(--primary)]">
                    {slide.slideNumber}
                  </div>
                  <div className="flex items-center gap-2">
                    {slide.metric && (
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)]">{slide.metric.label}</div>
                        <div className="font-display text-base font-bold text-[var(--primary)]">{slide.metric.value}</div>
                      </div>
                    )}
                    {/* Expand hint */}
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

      {/* ─── Slide Lightbox Modal ───────────────────────────────── */}
      {lightboxIndex !== null && currentSlide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded border border-blue-200 bg-blue-50 font-mono text-xs font-bold text-[var(--primary)]">
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

            {/* Slide content */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {currentSlide.headline && (
                <p className="text-base font-medium text-[var(--primary)] leading-snug">{currentSlide.headline}</p>
              )}
              {currentSlide.metric?.value && (
                <div className="inline-flex flex-col rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
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
            </div>

            {/* Navigation footer */}
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
