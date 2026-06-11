import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { exportToPDF, exportToPPTX, exportToHTML } from "@/lib/export";
import { formatDate, getRiskBadge, getMaturityColor, getConfidenceColor } from "@/lib/utils";
import { MetricCard } from "@/components/MetricCard";
import { SWOTGrid } from "@/components/SWOTGrid";
import { RiskMatrix } from "@/components/RiskMatrix";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { MarketRadar } from "@/components/charts/MarketRadar";
import { ReportSkeleton } from "@/components/Skeleton";
import type { Report, ReportData, SalesEnablement } from "@shared/schema";

const TABS = [
  { id: "summary",    label: "Summary",          shortLabel: "Summary" },
  { id: "financials", label: "Financials",        shortLabel: "Finance" },
  { id: "strategy",   label: "Strategy",          shortLabel: "Strategy" },
  { id: "market",     label: "Market",            shortLabel: "Market" },
  { id: "tech",       label: "Tech Spend",        shortLabel: "Tech" },
  { id: "esg",        label: "ESG",               shortLabel: "ESG" },
  { id: "swot",       label: "SWOT",              shortLabel: "SWOT" },
  { id: "growth",     label: "Growth",            shortLabel: "Growth" },
  { id: "risk",       label: "Risk",              shortLabel: "Risk" },
  { id: "digital",    label: "Digital",           shortLabel: "Digital" },
  { id: "sales",      label: "Sales Enablement",  shortLabel: "Sales" },
];

export function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [exporting, setExporting] = useState<"pdf" | "pptx" | "html" | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [sellerProduct, setSellerProduct] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.reports.get(slug);
        setReport(data);
      } catch {
        navigate("/reports");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { report: fresh } = await api.reports.generate(report!.companyName, true);
      setReport(fresh);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (format: "pdf" | "pptx" | "html") => {
    if (!report?.reportData) return;
    setExporting(format);
    try {
      const data = report.reportData as ReportData;
      if (format === "pdf") await exportToPDF(report.companyName, data);
      else if (format === "pptx") await exportToPPTX(data);
      else exportToHTML(data);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  const handleGenerateSales = async () => {
    if (!sellerProduct.trim()) return;
    setSalesLoading(true);
    try {
      const { report: updated } = await api.reports.salesEnablement(slug, sellerProduct);
      setReport(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSalesLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="mb-8">
          <div className="shimmer h-8 w-48 rounded mb-2" />
          <div className="shimmer h-5 w-32 rounded" />
        </div>
        <ReportSkeleton />
      </Layout>
    );
  }

  if (!report || !report.reportData) return null;
  const data = report.reportData as ReportData;
  const sales = report.salesEnablementData as SalesEnablement | null;

  return (
    <Layout>
      <div id="report-content">
        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="badge badge-blue">{data.industry}</span>
            <span className="text-xs text-[var(--text-muted)]">
              Generated {formatDate(report.generatedAt)}
            </span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl md:text-4xl">
                {report.companyName}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {data.executiveSummary.headquarters} · CEO: {data.executiveSummary.ceo}
              </p>
            </div>

            {/* Actions — wrap on mobile */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary">
                {refreshing ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                )}
                <span className="hidden xs:inline">Refresh</span>
              </button>
              {(["pdf", "pptx", "html"] as const).map((fmt) => (
                <button key={fmt} onClick={() => handleExport(fmt)} disabled={!!exporting} className="btn-secondary">
                  {exporting === fmt ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  )}
                  .{fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 -mx-4 sm:mx-0">
          <div
            className="flex gap-0 border-b border-[var(--border)] overflow-x-auto px-4 sm:px-0"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  activeTab === tab.id
                    ? "border-b-2 border-[var(--primary)] text-[var(--primary)] -mb-px"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                } ${tab.id === "sales" ? "border-l border-[var(--border)] ml-1 pl-4 sm:ml-2 sm:pl-6" : ""}`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === "sales" && sales && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-violet-400 inline-block" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="animate-fade-up">
          {activeTab === "summary" && <SummaryTab data={data} />}
          {activeTab === "financials" && <FinancialsTab data={data} />}
          {activeTab === "strategy" && <StrategyTab data={data} />}
          {activeTab === "market" && <MarketTab data={data} />}
          {activeTab === "tech" && <TechTab data={data} />}
          {activeTab === "esg" && <ESGTab data={data} />}
          {activeTab === "swot" && <SWOTGrid swot={data.swot} />}
          {activeTab === "growth" && <GrowthTab data={data} />}
          {activeTab === "risk" && <RiskMatrix riskAssessment={data.riskAssessment} />}
          {activeTab === "digital" && <DigitalTab data={data} />}
          {activeTab === "sales" && (
            <SalesTab
              data={data}
              sales={sales}
              sellerProduct={sellerProduct}
              setSellerProduct={setSellerProduct}
              onGenerate={handleGenerateSales}
              loading={salesLoading}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function SummaryTab({ data }: { data: ReportData }) {
  const es = data.executiveSummary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="CEO" value={es.ceo} delay={0} />
        <MetricCard label="Founded" value={es.founded} delay={80} />
        <MetricCard label="Employees" value={es.employees} delay={160} />
        <MetricCard label="HQ" value={es.headquarters} delay={240} />
      </div>

      <div className="card">
        <div className="section-title">Company Overview</div>
        <p className="text-[var(--text-secondary)] leading-relaxed">{es.companyOverview}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title">Key Highlights</div>
          <ul className="space-y-2">
            {es.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--primary)] mt-0.5">◆</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="section-title">Senior Leadership</div>
          <ul className="space-y-2">
            {es.keyExecutives.map((exec, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-primary)] font-medium">{exec.name}</span>
                <span className="text-[var(--text-muted)] text-xs">{exec.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {es.stockExchange && es.stockExchange !== "N/A" && (
          <div className="badge badge-blue">{es.stockExchange}</div>
        )}
        {es.analystRating && (
          <div className="badge badge-blue">Analyst: {es.analystRating}</div>
        )}
      </div>
    </div>
  );
}

function FinancialsTab({ data }: { data: ReportData }) {
  const fin = data.financials;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Revenue" value={fin.revenue} sub={fin.revenueGrowth} trend="up" delay={0} />
        <MetricCard label="Net Income" value={fin.netIncome} delay={80} />
        <MetricCard label="EBITDA" value={fin.ebitda} delay={160} />
        <MetricCard label="Market Cap" value={fin.marketCap} delay={240} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="section-title">Revenue History</div>
          <RevenueChart data={fin.revenueHistory} />
        </div>
        <div className="card">
          <div className="section-title">Key Metrics</div>
          <div className="space-y-3">
            {fin.keyMetrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--text-secondary)]">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)] font-mono">{m.value}</span>
                  <span className={`text-xs ${m.trend === "up" ? "text-[var(--primary)]" : m.trend === "down" ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                    {m.trend === "up" ? "↑" : m.trend === "down" ? "↓" : "→"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Outlook</div>
        <p className="text-[var(--text-secondary)] leading-relaxed">{fin.outlook}</p>
      </div>
    </div>
  );
}

function StrategyTab({ data }: { data: ReportData }) {
  const s = data.strategy;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title">Vision</div>
          <p className="text-[var(--text-secondary)] leading-relaxed italic">"{s.vision}"</p>
        </div>
        <div className="card">
          <div className="section-title">Mission</div>
          <p className="text-[var(--text-secondary)] leading-relaxed italic">"{s.mission}"</p>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Core Strategic Initiatives</div>
        <div className="space-y-4">
          {s.coreInitiatives.map((init, i) => (
            <div key={i} className="flex gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-[var(--primary)] font-display">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{init.title}</h4>
                  <span className="badge badge-blue shrink-0">{init.timeline}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{init.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title">M&A Strategy</div>
          <p className="text-sm text-[var(--text-secondary)]">{s.mAndA}</p>
        </div>
        <div className="card">
          <div className="section-title">Capital Allocation</div>
          <p className="text-sm text-[var(--text-secondary)]">{s.capitalAllocation}</p>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Geographic Focus</div>
        <div className="flex flex-wrap gap-2">
          {s.geographicFocus.map((region, i) => (
            <span key={i} className="badge badge-blue">{region}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketTab({ data }: { data: ReportData }) {
  const m = data.marketAnalysis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Total Addressable Market" value={m.totalAddressableMarket} delay={0} />
        <MetricCard label="Market Share" value={m.marketShare} delay={80} />
        <MetricCard label="Market Position" value={m.marketPosition} delay={160} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card hidden lg:block">
          <div className="section-title">Competitor Landscape</div>
          <MarketRadar competitors={m.competitors} companyName={data.companyName} />
        </div>
        <div className="card">
          <div className="section-title">Top Competitors</div>
          <div className="space-y-3">
            {m.competitors.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{c.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{c.strength}</div>
                </div>
                <span className={`badge ${getRiskBadge(c.threat)} shrink-0`}>{c.threat} threat</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title">Customer Segments</div>
          <div className="flex flex-wrap gap-2">
            {m.customerSegments.map((seg, i) => (
              <span key={i} className="badge badge-blue">{seg}</span>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-title">Geographic Revenue Mix</div>
          <div className="space-y-2">
            {m.geographicPresence.map((g, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 text-xs text-[var(--text-muted)]">{g.region}</div>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-secondary)]">
                  <div
                    className="h-2 rounded-full bg-[var(--primary)] transition-all"
                    style={{ width: g.percentage }}
                  />
                </div>
                <div className="w-10 text-xs font-mono text-[var(--text-primary)] text-right">{g.percentage}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Market Trends</div>
        <ul className="space-y-2">
          {m.marketTrends.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <span className="text-[var(--primary)] mt-0.5 shrink-0">→</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TechTab({ data }: { data: ReportData }) {
  const t = data.techSpend;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Annual IT Budget" value={t.annualITBudget} delay={0} />
        <MetricCard label="IT Budget as % Revenue" value={t.itBudgetAsPercentRevenue} delay={80} />
      </div>
      <div className="card">
        <div className="section-title">Cloud Platforms</div>
        <div className="flex flex-wrap gap-2">
          {t.cloudPlatforms.map((p, i) => (
            <span key={i} className="badge badge-blue">{p}</span>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="section-title">Key Technology Vendors</div>
        {/* Table for sm+, stacked cards for mobile */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Vendor</th>
                <th className="text-left py-2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Category</th>
                <th className="text-left py-2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Relationship</th>
              </tr>
            </thead>
            <tbody>
              {t.keyVendors.map((v, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 font-medium text-[var(--text-primary)]">{v.vendor}</td>
                  <td className="py-2.5 text-[var(--text-muted)]">{v.category}</td>
                  <td className="py-2.5 text-[var(--text-secondary)]">{v.relationship}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile stacked list */}
        <div className="sm:hidden space-y-3">
          {t.keyVendors.map((v, i) => (
            <div key={i} className="rounded-lg bg-[var(--bg-secondary)] p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">{v.vendor}</span>
                <span className="badge badge-blue">{v.category}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{v.relationship}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title">Data Infrastructure</div>
          <p className="text-sm text-[var(--text-secondary)]">{t.dataInfrastructure}</p>
        </div>
        <div className="card">
          <div className="section-title">Security Posture</div>
          <p className="text-sm text-[var(--text-secondary)]">{t.securityPosture}</p>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Emerging Technology Investments</div>
        <div className="flex flex-wrap gap-2">
          {t.emergingTech.map((tech, i) => (
            <span key={i} className="badge badge-violet">{tech}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ESGTab({ data }: { data: ReportData }) {
  const e = data.esg;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="ESG Rating" value={e.overallRating} delay={0} />
        <MetricCard label="Net Zero Target" value={e.netZeroTarget} delay={80} />
        <MetricCard label="Governance" value={e.governanceRating} delay={160} />
        <MetricCard label="Board Diversity" value={e.boardDiversity} delay={240} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title text-[var(--primary)]">Environmental Initiatives</div>
          <ul className="space-y-2">
            {e.environmentalInitiatives.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--primary)] shrink-0">🌱</span>{item}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="section-title text-blue-400">Social Initiatives</div>
          <ul className="space-y-2">
            {e.socialInitiatives.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-blue-400 shrink-0">🤝</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card">
        <div className="section-title">ESG Risk Factors</div>
        <div className="flex flex-wrap gap-2">
          {e.esgRisks.map((risk, i) => (
            <span key={i} className="badge badge-amber">{risk}</span>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="section-title">ESG Summary</div>
        <p className="text-[var(--text-secondary)] leading-relaxed">{e.summary}</p>
      </div>
    </div>
  );
}

function GrowthTab({ data }: { data: ReportData }) {
  const g = data.growthOpportunities;
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <div className="section-title mb-0">Total Opportunity Value</div>
          <span className="text-2xl font-extrabold text-[var(--primary)] font-display">{g.totalOpportunityValue}</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{g.summary}</p>
      </div>
      <div className="space-y-4">
        {g.opportunities.map((opp, i) => (
          <div key={i} className="card-hover animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h4 className="font-display text-base font-bold text-[var(--text-primary)]">{opp.title}</h4>
              <div className="flex gap-2 shrink-0">
                <span className="badge badge-blue font-mono">{opp.potentialValue}</span>
                <span className={`badge ${opp.confidence === "high" ? "badge-blue" : opp.confidence === "medium" ? "badge-amber" : "badge-red"}`}>
                  {opp.confidence}
                </span>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-3">{opp.description}</p>
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-xs text-[var(--text-muted)]">{opp.timeframe}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DigitalTab({ data }: { data: ReportData }) {
  const dx = data.digitalTransformation;
  const statusColor: Record<string, string> = {
    live: "badge-blue",
    in_progress: "badge-amber",
    planned: "badge-blue",
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="metric-label">Maturity Level</div>
          <div className={`metric-value ${getMaturityColor(dx.maturityLevel)}`}>
            {dx.maturityLevel.charAt(0).toUpperCase() + dx.maturityLevel.slice(1)}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Maturity Score</div>
          <div className="metric-value">{dx.maturityScore}<span className="text-lg text-[var(--text-muted)]">/10</span></div>
          <div className="mt-2 h-2 rounded-full bg-[var(--bg-secondary)]">
            <div
              className={`h-2 rounded-full transition-all ${getMaturityColor(dx.maturityLevel).replace("text-", "bg-")}`}
              style={{ width: `${(dx.maturityScore / 10) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Key Initiatives</div>
        <div className="space-y-3">
          {dx.keyInitiatives.map((init, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
              <span className={`badge ${statusColor[init.status] ?? "badge-blue"} shrink-0 mt-0.5`}>
                {init.status.replace("_", " ")}
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{init.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{init.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="section-title">AI Adoption</div>
          <p className="text-sm text-[var(--text-secondary)]">{dx.aiAdoption}</p>
        </div>
        <div className="card">
          <div className="section-title">Data Strategy</div>
          <p className="text-sm text-[var(--text-secondary)]">{dx.dataStrategy}</p>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Transformation Challenges</div>
        <ul className="space-y-2">
          {dx.challenges.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <span className="text-amber-400 shrink-0">⚠</span>{c}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <div className="section-title">Summary</div>
        <p className="text-[var(--text-secondary)] leading-relaxed">{dx.summary}</p>
      </div>
    </div>
  );
}

function SalesTab({
  data, sales, sellerProduct, setSellerProduct, onGenerate, loading,
}: {
  data: ReportData;
  sales: SalesEnablement | null;
  sellerProduct: string;
  setSellerProduct: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Generator input */}
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          <span className="text-sm font-semibold text-violet-700 uppercase tracking-wide">
            Sales Intelligence Generator
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Describe your product or service and get a tailored sales brief for {data.companyName}.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={sellerProduct}
            onChange={(e) => setSellerProduct(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onGenerate()}
            placeholder="e.g. Data governance platform for enterprise compliance…"
            className="flex-1 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            onClick={onGenerate}
            disabled={loading || !sellerProduct.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-95 disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : "Generate"}
          </button>
        </div>
      </div>

      {/* Sales content */}
      {sales && (
        <div className="space-y-5">
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-5">
            <div className="section-title text-violet-400">Sales Summary</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{sales.salesSummary}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)]">Total Opportunity Value:</span>
              <span className="font-display text-lg font-bold text-violet-400">{sales.totalValueOpportunity}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card">
              <div className="section-title">Conversation Starters</div>
              <ul className="space-y-2">
                {sales.conversationStarters.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-violet-400 shrink-0 font-bold">{i + 1}.</span>{s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="section-title">Current Challenges</div>
              <ul className="space-y-2">
                {sales.currentChallenges.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-amber-400 shrink-0">⚡</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Pain Points & Solutions</div>
            <div className="space-y-3">
              {sales.painPoints.map((pp, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2 p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-1">Pain Point</div>
                    <p className="text-sm text-[var(--text-primary)]">{pp.pain}</p>
                  </div>
                  <div>
                    <div className="text-xs text-violet-400 mb-1">Your Solution</div>
                    <p className="text-sm text-[var(--text-secondary)]">{pp.solution}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Use Cases & ROI</div>
            <div className="space-y-3">
              {sales.useCases.map((uc, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">{uc.title}</h4>
                      <span className="badge badge-blue font-mono">{uc.roi}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{uc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card">
              <div className="section-title">Potential Savings Breakdown</div>
              <div className="space-y-2">
                {sales.potentialSavings.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[var(--border)] last:border-0">
                    <span className="text-[var(--text-secondary)]">{s.area}</span>
                    <span className="font-mono text-[var(--primary)] font-medium">{s.estimate}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="section-title">Competitive Positioning</div>
              <p className="text-sm text-[var(--text-secondary)]">{sales.competitivePositioning}</p>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Recommended Next Steps</div>
            <div className="space-y-3">
              {sales.nextSteps.map((ns, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 border border-violet-200 text-xs font-bold text-violet-700 font-display">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{ns.step}</span>
                      <span className="badge badge-violet">{ns.timeline}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{ns.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
