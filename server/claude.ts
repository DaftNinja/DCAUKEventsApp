import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { existsSync as fsExistsSync } from "fs";

const execFileAsync = promisify(execFile);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Data source tagging ─────────────────────────────────────────────────────
// Every financial field in the report carries a _dataSource block so the UI
// can render a badge (green=verified, amber=single-source, red=estimated).

export type DataConfidence = "verified" | "single-source" | "wikipedia" | "estimated" | "unavailable";

export interface FinancialsMetadata {
  source:      "FMP" | "Wikipedia" | "LLM" | "none";
  confidence:  DataConfidence;
  fiscalYear:  string | null;   // e.g. "FY2024" — the period the numbers relate to
  retrievedAt: string;          // ISO date string
}

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-haiku-4-5-20251001";
const MODEL_FAST     = "claude-haiku-4-5-20251001";

// ─── Financial Modeling Prep (FMP) ───────────────────────────────────────────
// Single integration covering financials and ESG scores. One key, one dependency.

const FMP_KEY  = process.env.FMP_API_KEY ?? "";
const FMP_BASE = "https://financialmodelingprep.com/stable";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface FMPFinancials {
  ticker:          string;
  fiscalYear:      string;
  revenue:         string;
  revenueGrowth:   string;
  netIncome:       string;
  ebitda:          string;
  grossMargin:     string;
  operatingMargin: string;
  marketCap:       string;
  stockPrice:      string;
  peRatio:         string;
  epsAnnual:       string;
  analystTarget:   string;
  analystRating:   string;
  employees:       string | null;   // fullTimeEmployees from FMP profile
  revenueHistory:  { year: string; revenue: string; growth: string }[];
}

export interface FMPESGData {
  ticker:             string;
  companyName:        string;
  esgScore:           number;   // 0–100 composite
  environmentScore:   number;
  socialScore:        number;
  governanceScore:    number;
  esgRating:          string;   // e.g. "A", "BBB"
  esgRisk:            string;   // e.g. "Low", "Medium", "High"
  lastUpdated:        string;
}

// ── Wikipedia supplemental data type ─────────────────────────────────────────

export interface WikipediaData {
  title:       string;
  extract:     string;   // plain-text intro paragraph(s)
  founded:     string | null;
  headquarters: string | null;
  employees:   string | null;
  revenue:     string | null;
  netIncome:   string | null;
  aum:         string | null;   // assets under management (finance companies)
  totalAssets: string | null;
  website:     string | null;
  parentOrg:   string | null;
  source:      "wikipedia";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "N/A";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

async function fmpGet<T>(path: string): Promise<T | null> {
  if (!FMP_KEY) return null;
  try {
    // path already contains ? params (e.g. /income-statement?symbol=BARC.L&limit=5)
    const url = `${FMP_BASE}${path}&apikey=${FMP_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`FMP ${path} → ${res.status}: ${body.slice(0, 150)}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.warn(`FMP fetch error (${path}):`, err);
    return null;
  }
}

// ── Step 1: resolve company name → ticker ─────────────────────────────────────

async function resolveFMPTicker(companyName: string): Promise<string | null> {
  if (!FMP_KEY) { console.warn("FMP_API_KEY not set — skipping FMP lookup"); return null; }
  console.log(`📈 FMP key present (length=${FMP_KEY.length}, first4=${FMP_KEY.slice(0,4)})`);
  try {
    const searchUrl = `${FMP_BASE}/search-name?query=${encodeURIComponent(companyName)}&limit=5&apikey=${FMP_KEY}`;
    console.log(`📈 FMP searching: ${searchUrl.replace(FMP_KEY, '[REDACTED]')}`);
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    console.log(`📈 FMP search response: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      console.warn(`📈 FMP error body: ${body.slice(0, 200)}`);
      return null;
    }

    const results = await res.json() as { symbol: string; name: string; exchangeShortName?: string; exchange?: string }[];
    console.log(`📈 FMP results: ${JSON.stringify(results.slice(0,3))}`);
    if (!results?.length) return null;

    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const query     = normalise(companyName);

    const US_EXCHANGES  = new Set(["NASDAQ", "NYSE", "AMEX", "NYSE ARCA"]);
    const ALL_EXCHANGES = new Set([
      "NASDAQ", "NYSE", "AMEX", "NYSE ARCA",
      "LSE", "LON", "LSE AIM", "EURONEXT", "XETRA", "EPA", "EBR", "AMS", "STO", "CPH", "HEL", "VIE",
      "TSX", "ASX", "NSE", "BSE", "HKEX", "TSE", "SGX", "NZX",
      "JSE", "BOVESPA", "BMV",
    ]);

    const nameMatch = (r: { symbol: string; name: string; exchange?: string }) =>
      normalise(r.name) === query || normalise(r.name).includes(query);

    // Prefer US exchange listing (full FMP coverage) over international
    const match =
      results.find(r => nameMatch(r) && US_EXCHANGES.has(r.exchange ?? "")) ??
      results.find(r => nameMatch(r) && ALL_EXCHANGES.has(r.exchange ?? "")) ??
      results.find(r => nameMatch(r));

    if (!match) {
      console.log(`📈 FMP: no confident ticker match for "${companyName}" — will try Wikipedia fallback`);
      return null;
    }

    console.log(`📈 FMP resolved "${companyName}" → ${match.symbol} (${match.exchange ?? 'unknown exchange'})`);
    return match.symbol;
  } catch (err) {
    console.warn(`FMP ticker resolution failed for "${companyName}":`, err);
    return null;
  }
}

// ── Step 2a: fetch financials ─────────────────────────────────────────────────

async function fetchFMPFinancials(ticker: string): Promise<FMPFinancials | null> {
  type IncomeReport = {
    calendarYear?: string; date?: string;
    revenue?: number; netIncome?: number; ebitda?: number;
    operatingIncome?: number;
    grossProfitRatio?: number; operatingIncomeRatio?: number;
  };
  type CashFlowReport = {
    depreciationAndAmortization?: number;
  };
  type ProfileData = {
    mktCap?: number; price?: number; pe?: number; eps?: number;
    fullTimeEmployees?: number; sector?: string;
  };
  type RatingData = {
    ratingDetailsDCFRecommendation?: string;
    ratingDetailsROERecommendation?: string;
    rating?: string;
  };
  type PriceTargetData = { priceTarget?: number };

  const [incomeRaw, cashFlowRaw, profileRaw, ratingRaw, targetRaw] = await Promise.all([
    fmpGet<IncomeReport[]>(`/income-statement?symbol=${ticker}&limit=5`),
    fmpGet<CashFlowReport[]>(`/cash-flow-statement?symbol=${ticker}&limit=1`),
    fmpGet<ProfileData[]>(`/profile?symbol=${ticker}`),
    fmpGet<RatingData[]>(`/rating?symbol=${ticker}`),
    fmpGet<PriceTargetData[]>(`/price-target-consensus?symbol=${ticker}`),
  ]);

  const reports  = incomeRaw    ?? [];
  const cashFlow = cashFlowRaw?.[0] ?? {};
  const profile  = profileRaw?.[0]  ?? {};
  const rating   = ratingRaw?.[0]   ?? {};
  const target   = targetRaw?.[0]   ?? {};

  const sector = (profile as any).sector ?? "";
  const isFinancial = /bank|financ|insurance|capital|invest/i.test(sector);

  if (!reports.length && !profile.mktCap) {
    console.warn(`FMP: no financial data for ${ticker}`);
    return null;
  }

  const revenueHistory = reports.slice(0, 4).map((r, i) => {
    const year    = r.calendarYear ?? r.date?.slice(0, 4) ?? "N/A";
    const rev     = r.revenue ?? 0;
    const prevRev = reports[i + 1]?.revenue ?? 0;
    const growth  = prevRev
      ? `${rev > prevRev ? "+" : ""}${(((rev - prevRev) / prevRev) * 100).toFixed(1)}%`
      : "N/A";
    return { year, revenue: fmt(rev), growth };
  }).reverse();

  const latestRev = reports[0]?.revenue ?? 0;
  const priorRev  = reports[1]?.revenue ?? 0;
  const yoyGrowth = priorRev
    ? `${latestRev > priorRev ? "+" : ""}${(((latestRev - priorRev) / priorRev) * 100).toFixed(1)}% YoY`
    : "N/A";

  const fiscalYear = `FY${reports[0]?.calendarYear ?? reports[0]?.date?.slice(0, 4) ?? new Date().getFullYear()}`;

  const analystRating = rating.ratingDetailsDCFRecommendation
    ?? rating.ratingDetailsROERecommendation
    ?? rating.rating
    ?? "N/A";

  return {
    ticker,
    fiscalYear,
    revenue:         fmt(reports[0]?.revenue),
    revenueGrowth:   yoyGrowth,
    netIncome:       fmt(reports[0]?.netIncome),
    ebitda:          (() => {
      if (isFinancial) return "N/A (financial sector)";
      const direct = reports[0]?.ebitda;
      if (direct != null && direct !== 0) return fmt(direct);
      const opIncome = reports[0]?.operatingIncome ?? 0;
      const da       = (cashFlow as CashFlowReport).depreciationAndAmortization ?? 0;
      return (opIncome || da) ? fmt(opIncome + da) : "N/A";
    })(),
    grossMargin:     fmtPct(reports[0]?.grossProfitRatio),
    operatingMargin: fmtPct(reports[0]?.operatingIncomeRatio),
    marketCap:       fmt(profile.mktCap),
    stockPrice:      profile.price != null ? `$${profile.price.toFixed(2)}` : "N/A",
    peRatio:         profile.pe   != null ? `${profile.pe.toFixed(1)}x`   : "N/A",
    epsAnnual:       profile.eps  != null ? `$${profile.eps.toFixed(2)}`  : "N/A",
    analystTarget:   target.priceTarget != null ? `${target.priceTarget.toFixed(2)}` : "N/A",
    analystRating,
    employees:       profile.fullTimeEmployees != null
                       ? profile.fullTimeEmployees.toLocaleString("en-GB")
                       : null,
    revenueHistory,
  };
}

// ── Step 2b: fetch ESG scores ─────────────────────────────────────────────────

async function fetchFMPESG(ticker: string): Promise<FMPESGData | null> {
  type ESGRecord = {
    symbol?: string; companyName?: string;
    ESGScore?: number; environmentalScore?: number; socialScore?: number; governanceScore?: number;
    ESGRisk?: string; date?: string;
  };

  const data = await fmpGet<ESGRecord[]>(`/esg-environmental-social-governance?symbol=${ticker}`);
  const record = data?.[0];

  if (!record) {
    console.warn(`FMP ESG: no data for ${ticker}`);
    return null;
  }

  const esgScore = record.ESGScore ?? 0;
  const esgRating = esgScore >= 70 ? "A" : esgScore >= 50 ? "BBB" : esgScore >= 30 ? "BB" : "B";

  console.log(`🌱 FMP ESG for ${ticker}: score=${esgScore}, risk=${record.ESGRisk ?? "N/A"}`);

  return {
    ticker,
    companyName:      record.companyName ?? ticker,
    esgScore,
    environmentScore: record.environmentalScore ?? 0,
    socialScore:      record.socialScore       ?? 0,
    governanceScore:  record.governanceScore    ?? 0,
    esgRating,
    esgRisk:          record.ESGRisk ?? "N/A",
    lastUpdated:      record.date    ?? new Date().toISOString().slice(0, 10),
  };
}

// ── Public: full FMP lookup (financials + ESG) ────────────────────────────────

export async function lookupFMP(companyName: string): Promise<{
  financials: FMPFinancials | null;
  esg:        FMPESGData    | null;
}> {
  const ticker = await resolveFMPTicker(companyName);
  if (!ticker) return { financials: null, esg: null };

  const [financials, esg] = await Promise.all([
    fetchFMPFinancials(ticker),
    fetchFMPESG(ticker),
  ]);

  return { financials, esg };
}

// ─── Yahoo Finance fallback ───────────────────────────────────────────────────────────────────────
// No API key required. Covers global exchanges including LSE (BARC.L), NYSE, NASDAQ etc.
// Used when FMP returns no financial data (plan limitation or unlisted company).

async function resolveYahooTicker(companyName: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(companyName)}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { quotes?: { symbol: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string }[] };
    const quotes = (data.quotes ?? []).filter(q => q.quoteType === "EQUITY");
    if (!quotes.length) return null;

    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const query = normalise(companyName);

    // Prefer primary listing (shorter symbol, no dot suffix where possible for major companies)
    const match =
      quotes.find(q => normalise(q.shortname ?? q.longname ?? "") === query) ??
      quotes.find(q => normalise(q.shortname ?? q.longname ?? "").includes(query)) ??
      quotes[0];

    console.log(`💹 Yahoo resolved "${companyName}" → ${match.symbol} (${match.exchange ?? "unknown"})`);
    return match.symbol;
  } catch (err) {
    console.warn(`Yahoo ticker resolution failed for "${companyName}":`, err);
    return null;
  }
}

async function fetchYahooFinancials(ticker: string): Promise<FMPFinancials | null> {
  try {
    // Step 1: Get a crumb (Yahoo requires this for authenticated data endpoints)
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    // If crumb endpoint fails, try the v8 no-auth endpoint instead
    let crumb = "";
    if (crumbRes.ok) {
      crumb = await crumbRes.text();
    }

    const cookieHeader = crumbRes.headers.get("set-cookie") ?? "";

    // Step 2: Fetch quote summary with crumb
    const modules = "incomeStatementHistory,defaultKeyStatistics,summaryDetail,financialData,price";
    const url = crumb
      ? `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`
      : `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        ...(cookieHeader ? { "Cookie": cookieHeader.split(";")[0] } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`Yahoo financials ${ticker} → ${res.status}`);
      return null;
    }
    const data = await res.json() as any;

    // Handle v8 chart fallback (only gives price/market cap, no income statements)
    if (!crumb) {
      const chart = data?.chart?.result?.[0];
      if (!chart) return null;
      const meta = chart.meta ?? {};
      const currency = meta.currency ?? "USD";
      const sym = currency === "GBp" ? "£" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
      const penceToGBP = currency === "GBp";
      const price = meta.regularMarketPrice ?? null;
      const priceV = penceToGBP && price ? price / 100 : price;
      const mktCap = meta.marketCap ?? null;
      const mktCapV = penceToGBP && mktCap ? mktCap / 100 : mktCap;
      const mktCapStr = mktCapV == null ? "N/A" :
        mktCapV >= 1e12 ? `${sym}${(mktCapV/1e12).toFixed(2)}T` :
        mktCapV >= 1e9  ? `${sym}${(mktCapV/1e9).toFixed(1)}B` : `${sym}${(mktCapV/1e6).toFixed(0)}M`;
      console.log(`💹 Yahoo chart fallback for ${ticker}: price=${priceV?.toFixed(2)}, mktCap=${mktCapStr}`);
      return {
        ticker, fiscalYear: `FY${new Date().getFullYear() - 1}`,
        revenue: "N/A", revenueGrowth: "N/A", netIncome: "N/A", ebitda: "N/A",
        grossMargin: "N/A", operatingMargin: "N/A",
        marketCap: mktCapStr,
        stockPrice: priceV != null ? `${sym}${priceV.toFixed(2)}` : "N/A",
        peRatio: "N/A", epsAnnual: "N/A", analystTarget: "N/A", analystRating: "N/A",
        employees: null, revenueHistory: [],
      };
    }

    const result = data?.quoteSummary?.result?.[0];
    if (!result) return null;

    const price      = result.price ?? {};
    const finData    = result.financialData ?? {};
    const keyStats   = result.defaultKeyStatistics ?? {};
    const sumDetail  = result.summaryDetail ?? {};
    const incStmts   = result.incomeStatementHistory?.incomeStatementHistory ?? [];

    const currency = price.currency ?? "USD";
    const sym = currency === "GBp" ? "£" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
    const penceToGBP = currency === "GBp";

    const fmtYahoo = (raw: any): string => {
      const n = raw?.raw ?? null;
      if (n == null || isNaN(n)) return "N/A";
      const v = penceToGBP ? n / 100 : n;
      if (Math.abs(v) >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`;
      if (Math.abs(v) >= 1e9)  return `${sym}${(v / 1e9).toFixed(1)}B`;
      if (Math.abs(v) >= 1e6)  return `${sym}${(v / 1e6).toFixed(0)}M`;
      return `${sym}${v.toLocaleString()}`;
    };

    const fmtPctYahoo = (raw: any): string => {
      const n = raw?.raw ?? null;
      if (n == null || isNaN(n)) return "N/A";
      return `${(n * 100).toFixed(1)}%`;
    };

    const revenueHistory = incStmts.slice(0, 4).map((stmt: any, i: number) => {
      const year = new Date(stmt.endDate?.raw * 1000).getFullYear().toString();
      const rev = stmt.totalRevenue?.raw ?? 0;
      const prevRev = incStmts[i + 1]?.totalRevenue?.raw ?? 0;
      const v = penceToGBP ? rev / 100 : rev;
      const pv = penceToGBP ? prevRev / 100 : prevRev;
      const growth = pv ? `${v > pv ? "+" : ""}${(((v - pv) / pv) * 100).toFixed(1)}%` : "N/A";
      const revStr = Math.abs(v) >= 1e9 ? `${sym}${(v / 1e9).toFixed(1)}B` : `${sym}${(v / 1e6).toFixed(0)}M`;
      return { year, revenue: revStr, growth };
    }).reverse();

    const latestInc = incStmts[0];
    const prevInc   = incStmts[1];
    const latestRev = penceToGBP ? (latestInc?.totalRevenue?.raw ?? 0) / 100 : (latestInc?.totalRevenue?.raw ?? 0);
    const prevRevVal = penceToGBP ? (prevInc?.totalRevenue?.raw ?? 0) / 100 : (prevInc?.totalRevenue?.raw ?? 0);
    const yoyGrowth = prevRevVal ? `${latestRev > prevRevVal ? "+" : ""}${(((latestRev - prevRevVal) / prevRevVal) * 100).toFixed(1)}% YoY` : "N/A";

    const marketCapRaw = price.marketCap?.raw ?? null;
    const mktCapV = penceToGBP && marketCapRaw ? marketCapRaw / 100 : marketCapRaw;
    const mktCapStr = mktCapV == null ? "N/A" :
      mktCapV >= 1e12 ? `${sym}${(mktCapV / 1e12).toFixed(2)}T` :
      mktCapV >= 1e9  ? `${sym}${(mktCapV / 1e9).toFixed(1)}B` : `${sym}${(mktCapV / 1e6).toFixed(0)}M`;

    const stockPriceRaw = price.regularMarketPrice?.raw ?? null;
    const stockPriceV = penceToGBP && stockPriceRaw ? stockPriceRaw / 100 : stockPriceRaw;
    const stockPriceStr = stockPriceV != null ? `${sym}${stockPriceV.toFixed(2)}` : "N/A";

    const employees = keyStats.fullTimeEmployees ?? null;
    const fiscalYear = `FY${new Date((latestInc?.endDate?.raw ?? Date.now() / 1000) * 1000).getFullYear()}`;

    console.log(`💹 Yahoo financials for ${ticker}: revenue=${fmtYahoo(latestInc?.totalRevenue)}, mktCap=${mktCapStr}`);

    return {
      ticker, fiscalYear,
      revenue:         fmtYahoo(latestInc?.totalRevenue),
      revenueGrowth:   yoyGrowth,
      netIncome:       fmtYahoo(latestInc?.netIncome),
      ebitda:          fmtYahoo(finData.ebitda),
      grossMargin:     fmtPctYahoo(finData.grossMargins),
      operatingMargin: fmtPctYahoo(finData.operatingMargins),
      marketCap:       mktCapStr,
      stockPrice:      stockPriceStr,
      peRatio:         sumDetail.trailingPE?.raw != null ? `${sumDetail.trailingPE.raw.toFixed(1)}x` : "N/A",
      epsAnnual:       keyStats.trailingEps?.raw != null ? `${sym}${keyStats.trailingEps.raw.toFixed(2)}` : "N/A",
      analystTarget:   finData.targetMeanPrice?.raw != null ? `${sym}${finData.targetMeanPrice.raw.toFixed(2)}` : "N/A",
      analystRating:   finData.recommendationKey ?? "N/A",
      employees:       employees != null ? employees.toLocaleString("en-GB") : null,
      revenueHistory,
    };
  } catch (err) {
    console.warn(`Yahoo financials failed for ${ticker}:`, err);
    return null;
  }
}

export async function lookupYahoo(companyName: string): Promise<FMPFinancials | null> {
  // Yahoo Finance and web search fallbacks are too unreliable/expensive for the token budget.
  // Return null — the LLM fallback in generatePartA will use training knowledge with strict rules.
  return null;
}

// ─── Financial data via Claude web search ──────────────────────────────────────────────────────────────────────
// Used when FMP plan doesn't cover the symbol. Uses a targeted web search
// to pull financial data from annual reports, financial news, and data sites.
// Returns structured JSON matching FMPFinancials so the rest of the pipeline
// treats it identically to verified FMP data.

async function lookupFinancialsViaWebSearch(companyName: string): Promise<FMPFinancials | null> {
  try {
    console.log(`🔍 Web search financial lookup for "${companyName}"...`);
    const message = await client.messages.create({
      model: MODEL_GROUNDED,
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `You are a financial data extraction assistant. Search for the company's latest financial data and return ONLY a valid JSON object. No markdown, no explanation, no code fences. The JSON must be parseable by JSON.parse().

IMPORTANT ACCURACY RULES:
- Only include figures you found in search results. Do not estimate or hallucinate.
- Use the company's reporting currency (e.g. £ for UK companies, € for EU).
- Revenue and net income should be from the most recent full fiscal year annual report.
- Market cap should be the current figure.
- Return null for any field you cannot find with confidence.`,
      messages: [{
        role: "user",
        content: `Search for the latest financial data for ${companyName} and return this exact JSON structure with real figures from search results:
{
  "ticker": "primary stock ticker (e.g. BARC.L or null)",
  "fiscalYear": "e.g. FY2024",
  "revenue": "e.g. £25.4B or null",
  "revenueGrowth": "e.g. +5.2% YoY or null",
  "netIncome": "e.g. £5.3B or null",
  "ebitda": "e.g. £8.1B or null",
  "grossMargin": "e.g. 45.2% or null",
  "operatingMargin": "e.g. 21.3% or null",
  "marketCap": "e.g. £34.5B or null",
  "stockPrice": "e.g. £2.74 or null",
  "peRatio": "e.g. 8.2x or null",
  "epsAnnual": "e.g. £0.33 or null",
  "analystTarget": "e.g. £3.20 or null",
  "analystRating": "e.g. buy or null",
  "employees": "e.g. 85,000 or null",
  "revenueHistory": [
    {"year": "2021", "revenue": "e.g. £21.9B", "growth": "e.g. +3.1%"},
    {"year": "2022", "revenue": "e.g. £22.4B", "growth": "e.g. +2.3%"},
    {"year": "2023", "revenue": "e.g. £24.0B", "growth": "e.g. +7.1%"},
    {"year": "2024", "revenue": "e.g. £25.4B", "growth": "e.g. +5.8%"}
  ]
}
Only include revenueHistory entries where you found actual figures. Return null for fields you cannot verify.`
      }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/<cite[^>]*>[\s\S]*?<\/cite>/g, "")
      .replace(/^```json\n?/, "").replace(/\n?```$/, "")
      .trim();

    if (!text || !text.startsWith("{")) {
      console.warn(`🔍 Web search financial lookup: no JSON in response for "${companyName}"`);
      return null;
    }

    const d = JSON.parse(text) as any;

    console.log(`🔍 Web search financials for "${companyName}": revenue=${d.revenue}, mktCap=${d.marketCap}`);

    return {
      ticker:          d.ticker ?? companyName,
      fiscalYear:      d.fiscalYear ?? `FY${new Date().getFullYear() - 1}`,
      revenue:         d.revenue ?? "N/A",
      revenueGrowth:   d.revenueGrowth ?? "N/A",
      netIncome:       d.netIncome ?? "N/A",
      ebitda:          d.ebitda ?? "N/A",
      grossMargin:     d.grossMargin ?? "N/A",
      operatingMargin: d.operatingMargin ?? "N/A",
      marketCap:       d.marketCap ?? "N/A",
      stockPrice:      d.stockPrice ?? "N/A",
      peRatio:         d.peRatio ?? "N/A",
      epsAnnual:       d.epsAnnual ?? "N/A",
      analystTarget:   d.analystTarget ?? "N/A",
      analystRating:   d.analystRating ?? "N/A",
      employees:       d.employees ?? null,
      revenueHistory:  Array.isArray(d.revenueHistory) ? d.revenueHistory : [],
    };
  } catch (err) {
    console.warn(`Web search financial lookup failed for "${companyName}":`, err);
    return null;
  }
}

// ─── Wikipedia Fallback ───────────────────────────────────────────────────────

function parseInfoboxField(text: string, ...keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`(?:^|\\n)\\s*${key}\\s*[=:]\\s*([^\\n]+)`, "i");
    const m  = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function cleanWikiValue(val: string | null): string | null {
  if (!val) return null;

  let s = val;

  // Strip [[File:...]] and [[Image:...]] wikilinks entirely
  s = s.replace(/\[\[(?:File|Image)[^\]]*\]\]/gi, "");

  // Strip nested {{ }} templates iteratively (handles {{increase}}{{plaintext|{{formatnum:25376}}}} etc.)
  // Keep stripping innermost {{ }} until none remain
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/\{\{[^{}]*\}\}/g, (match) => {
      // Extract the last pipe-delimited segment as the human-readable value
      // e.g. {{formatnum:25376}} → "25376", {{plaintext|£25.4 billion}} → "£25.4 billion"
      const inner = match.slice(2, -2);
      const parts = inner.split("|");
      const last = parts[parts.length - 1].trim();
      // If it looks like a bare template name (no digits/currency), drop it
      return /[\d£$€¥₹]/.test(last) ? last : "";
    });
  }

  // Strip wikilinks: [[target|label]] → label, [[target]] → target
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Strip citation refs [1], [2], etc.
  s = s.replace(/\[\d+\]/g, "");

  // Strip HTML tags
  s = s.replace(/<[^>]+>/g, "");

  // Strip ref tags
  s = s.replace(/<ref[^/]*/gi, "");

  // Normalise whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s || null;
}

export async function lookupWikipedia(companyName: string): Promise<WikipediaData | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=3&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { headers: { "User-Agent": "1GLInsightsBot/1.0" } });
    if (!searchRes.ok) return null;

    const searchJson = await searchRes.json() as {
      query?: { search?: { title: string; snippet: string }[] };
    };
    const hits = searchJson.query?.search ?? [];
    if (!hits.length) return null;

    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const query = normalise(companyName);
    const bestHit =
      hits.find(h => normalise(h.title) === query) ??
      hits.find(h => normalise(h.title).includes(query)) ??
      hits[0];

    console.log(`📖 Wikipedia: searching "${companyName}" → matched "${bestHit.title}"`);

    const pageTitle  = encodeURIComponent(bestHit.title.replace(/ /g, "_"));
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
    const summaryRes = await fetch(summaryUrl, { headers: { "User-Agent": "1GLInsightsBot/1.0" } });
    if (!summaryRes.ok) return null;

    const summaryJson = await summaryRes.json() as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };

    const extract = summaryJson.extract ?? "";

    const parseUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${pageTitle}&format=json&origin=*`;
    const parseRes = await fetch(parseUrl, { headers: { "User-Agent": "1GLInsightsBot/1.0" } });
    let wikitext = "";
    if (parseRes.ok) {
      const parseJson = await parseRes.json() as { query?: { pages?: Record<string, { revisions?: { slots?: { main?: { "*"?: string } } }[] }> } };
      const pages = parseJson.query?.pages ?? {};
      const page  = Object.values(pages)[0];
      wikitext    = page?.revisions?.[0]?.slots?.main?.["*"] ?? "";
    }

    const textToParse = wikitext || extract;

    const founded      = cleanWikiValue(parseInfoboxField(textToParse, "founded", "foundation", "established", "formation"));
    const headquarters = cleanWikiValue(parseInfoboxField(textToParse, "headquarters", "hq_location", "location_city", "location"));
    const employees    = cleanWikiValue(parseInfoboxField(textToParse, "num_employees", "employees", "workforce"));
    const revenue      = cleanWikiValue(parseInfoboxField(textToParse, "revenue", "total_revenue", "income"));
    const netIncome    = cleanWikiValue(parseInfoboxField(textToParse, "net_income", "profit", "net_profit"));
    const aum          = cleanWikiValue(parseInfoboxField(textToParse, "aum", "assets_under_management", "assets under management", "AUM"));
    const totalAssets  = cleanWikiValue(parseInfoboxField(textToParse, "total_assets", "assets"));
    const website      = cleanWikiValue(parseInfoboxField(textToParse, "website", "url", "homepage"));
    const parentOrg    = cleanWikiValue(parseInfoboxField(textToParse, "parent", "parent_organization", "owner"));

    console.log(`📖 Wikipedia data for "${companyName}": revenue=${revenue}, employees=${employees}, aum=${aum}`);

    return {
      title:        bestHit.title,
      extract:      extract.slice(0, 1500),
      founded,
      headquarters,
      employees,
      revenue,
      netIncome,
      aum,
      totalAssets,
      website,
      parentOrg,
      source:       "wikipedia",
    };
  } catch (err) {
    console.warn(`Wikipedia lookup failed for "${companyName}":`, err);
    return null;
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM = `ROLE
You are an elite strategic intelligence analyst specialising in company research, executive intelligence, market positioning, financial analysis, and operational profiling.

OBJECTIVE
Extract the most accurate, current, and verifiable company intelligence possible and return it as strict machine-parseable JSON.

PRIMARY RULES
- Respond with ONLY valid JSON.
- Do NOT output markdown, prose, explanations, notes, or code fences.
- Output must parse successfully with JSON.parse().
- Never narrate reasoning or search activity.
- Never invent data.
- If data cannot be verified with high confidence, return null for scalars, [] for arrays, {} for objects.
- Prefer omission over speculation.
- Never mix executives between companies.
- Use concise factual language only.
- When financial data is supplied in the prompt, treat it as authoritative and use it verbatim.

DATA QUALITY RULES
- Use real verified data for public and well-known companies.
- Use directional estimates only for smaller or private companies.
- CEO and executive names must only be included when highly confident and current.
- If executive data is uncertain: set "ceo" to "See company website for current CEO".
- Treat employee counts, revenue, valuation, growth rates, and funding data as time-sensitive.
- Evaluate sources internally by confidence but NEVER expose that reasoning in output.

MISSING DATA POLICY
- Unknown scalar values → null
- Unknown arrays → []
- Unknown objects → {}
- Never fabricate: funding amounts, acquisition dates, executive names, office locations, customer counts, or revenue figures.

EXECUTIVE VALIDATION RULES
Before returning any executive name:
1. Verify they belong to the correct company.
2. Verify role recency — exclude former executives.
3. Exclude any name you cannot verify with high confidence.
4. Never recombine or invent names from partial recall.
Quality over quantity — 4 accurate entries is better than 8 with errors.

NORMALIZATION RULES
- Currency default: USD unless the company primarily operates in another currency.
- Dates format: dd/mm/yyyy.
- Country names: full official English names.
- Arrays: maximum 5 items unless the schema specifies otherwise.
- keyExecutives: maximum 8 verified entries, minimum 3 (or [] if fewer than 3 can be verified).
- String values: concise and information-dense. No marketing language or hype.

DEDUPLICATION RULES
- Do not repeat semantically identical facts.
- Consolidate overlapping descriptions.
- Avoid repeating the company name excessively.

OUTPUT REQUIREMENTS
- Return exactly one JSON object.
- No trailing commas.
- No comments inside JSON.
- No additional keys outside the requested schema.
- Analytical, dense, neutral, executive-grade tone.`;

// ─── last30days enrichment ────────────────────────────────────────────────────

async function runLast30Days(companyName: string): Promise<string | null> {
  const skillDir = [
    process.env.LAST30DAYS_SKILL_PATH,
    path.resolve(process.cwd(), "tools", "last30days"),
    path.join(process.env.HOME ?? "/root", ".agents", "skills", "last30days", "scripts"),
  ].filter((p): p is string => Boolean(p)).find(fsExistsSync);

  if (!skillDir) {
    console.warn("📡 last30days: engine not installed — run scripts/install-last30days.sh");
    return null;
  }
  const scriptPath = path.join(skillDir, "last30days.py");

  try {
    const { stdout } = await execFileAsync(
      "python3",
      [scriptPath, "--emit=context", "--quick", "--", companyName],
      { timeout: 75_000, env: { ...process.env }, maxBuffer: 1024 * 1024 }
    );
    const result = stdout.trim();
    const clusterSection = result.split("Top clusters:")[1] ?? "";
    const noEvidence = !result || result.includes("No candidates survived") || !/^- /m.test(clusterSection);
    if (noEvidence) {
      console.warn(`📡 last30days: no usable evidence for "${companyName}" — skipping enrichment`);
      return null;
    }
    console.log(`📡 last30days: enrichment fetched for "${companyName}" (${result.length} chars)`);
    return result;
  } catch (err: any) {
    const reason = err.code === "ENOENT" ? "python3 not found" : err.killed ? "timed out after 75s" : err.message?.slice(0, 80);
    console.warn(`📡 last30days: skipped for "${companyName}" — ${reason}`);
    return null;
  }
}

// ─── CEO lookup via web search ────────────────────────────────────────────────

async function lookupCEO(companyName: string): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL_GROUNDED,
      max_tokens: 200,
      system: "You are a factual lookup assistant. Respond with ONLY the current CEO's full name — no punctuation, no explanation, nothing else.",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Who is the current CEO of ${companyName}? Search the web and return only their full name.` }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, "$1")
      .trim();

    if (text && text.length < 80 && !text.includes("{") && !text.includes("\n")) {
      return text;
    }
  } catch (err) {
    console.warn(`CEO lookup failed for ${companyName}:`, err);
  }
  return "See company website for current CEO";
}

// ─── Core caller (Haiku, no tools) ───────────────────────────────────────────

async function callClaude(prompt: string, maxTokens: number): Promise<unknown> {
  const message = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (message.stop_reason === "max_tokens") {
    console.error(`Response truncated at ${maxTokens} tokens — increase max_tokens`);
    throw new Error("Response was too long and got cut off. Please try again.");
  }

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  if (!text) throw new Error("Empty response from Claude API");

  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    try {
      let repaired = cleaned;
      let inString = false;
      let escape = false;
      const stack: string[] = [];
      for (const ch of repaired) {
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
          if (ch === '{') stack.push('}');
          else if (ch === '[') stack.push(']');
          else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
        }
      }
      repaired = repaired.replace(/,\s*$/, "").replace(/"[^"]*$/, '"..."}');
      repaired += stack.reverse().join("");
      const result = JSON.parse(repaired);
      console.warn(`⚠️  JSON repair succeeded — response was likely truncated at ${maxTokens} tokens`);
      return result;
    } catch {
      console.error("JSON parse failed (and repair failed). Raw:", cleaned.slice(0, 500));
      throw new Error("Failed to parse API response. Please try again.");
    }
  }
}

// ─── Report Part A: overview + financials + strategy + market ─────────────────

async function generatePartA(
  companyName: string,
  fmpFinancials?: FMPFinancials | null,
  currentCEO?: string,
  wikiData?: WikipediaData | null,
  socialContext?: string | null,
): Promise<unknown> {
  const ceo = currentCEO ?? await lookupCEO(companyName);

  const fin = fmpFinancials;

  let finBlock: string;
  if (fin) {
    finBlock = `VERIFIED FINANCIAL DATA (Financial Modeling Prep — use verbatim, do not alter):
- Ticker:               ${fin.ticker}
- Fiscal Year:          ${fin.fiscalYear}
- Revenue:              ${fin.revenue}
- Revenue Growth (YoY): ${fin.revenueGrowth}
- Net Income:           ${fin.netIncome}
- EBITDA:               ${fin.ebitda}
- Market Cap:           ${fin.marketCap}
- Stock Price:          ${fin.stockPrice}
- P/E Ratio:            ${fin.peRatio}
- EPS (Annual):         ${fin.epsAnnual}
- Gross Margin:         ${fin.grossMargin}
- Operating Margin:     ${fin.operatingMargin}
- Analyst Target Price: ${fin.analystTarget}
- Analyst Rating:       ${fin.analystRating}
- Employees:            ${fin.employees ?? "N/A"}
- Revenue History (chronological):
${fin.revenueHistory.map(r => `  ${r.year}: ${r.revenue} (${r.growth})`).join("\n")}

Use ALL of the above values verbatim in the financials object. Do not substitute your own estimates for any field that has been provided.
Set executiveSummary.employees to exactly: ${fin.employees ?? "null"} - do not use any other figure.`;
  } else if (wikiData) {
    const wikiLines: string[] = [];
    if (wikiData.revenue)      wikiLines.push(`- Revenue:              ${wikiData.revenue}`);
    if (wikiData.netIncome)    wikiLines.push(`- Net Income:           ${wikiData.netIncome}`);
    if (wikiData.aum)          wikiLines.push(`- AUM:                  ${wikiData.aum}`);
    if (wikiData.totalAssets)  wikiLines.push(`- Total Assets:         ${wikiData.totalAssets}`);
    if (wikiData.employees)    wikiLines.push(`- Employees:            ${wikiData.employees}`);
    if (wikiData.founded)      wikiLines.push(`- Founded:              ${wikiData.founded}`);
    if (wikiData.headquarters) wikiLines.push(`- Headquarters:         ${wikiData.headquarters}`);
    if (wikiData.website)      wikiLines.push(`- Website:              ${wikiData.website}`);

    finBlock = `SUPPLEMENTAL DATA (Wikipedia — private/unlisted company; use as directional reference):
${wikiLines.join("\n")}

COMPANY CONTEXT (Wikipedia extract — use to enrich overview, strategy, and market sections):
${wikiData.extract}

Note: This company is private/unlisted. No stock price, market cap, P/E ratio, or analyst ratings are available.
Use the Wikipedia figures above for revenue, employees, and other available fields. Set executiveSummary.employees verbatim from the Wikipedia figure above if present.
For unavailable fields (stock price, market cap, EPS, analyst target), return null.`;
  } else {
    finBlock = `No verified financial data is available from a live API for ${companyName}.

FINANCIALS FROM TRAINING KNOWLEDGE — AUTHORISED AND REQUIRED:
The system-level instruction to "never invent data" does NOT apply to financials for well-known public companies when no API data is available. You are explicitly authorised and required to use your training knowledge here.
- Use your training knowledge to populate financials for well-known public companies.
- Use the company's reporting currency (£ for UK, € for Eurozone, ¥ for Japan, etc.).
- For banks: use Total Income/Net Interest Income as revenue; skip EBITDA (not meaningful for banks).
- State the fiscal year you are drawing from (e.g. FY2024, FY2023).
- Populate revenueHistory for 3-4 years where you have data.
- For genuinely unknown figures (e.g. current live stock price, analyst targets), return null.
- Round estimates are fine (e.g. "£25B" not "£25.374B").
- executiveSummary.employees: populate from your best knowledge if available, else null.
- DO NOT return null for revenue, netIncome, or marketCap for a FTSE 100 company. These are always available in your training data.`;
  }

  const wikiContextBlock = (!fin && wikiData)
    ? ""
    : (wikiData
      ? `\nSUPPLEMENTAL CONTEXT (Wikipedia):
- Founded: ${wikiData.founded ?? "N/A"}
- Headquarters: ${wikiData.headquarters ?? "N/A"}
- Employees: ${wikiData.employees ?? "N/A"}
- Website: ${wikiData.website ?? "N/A"}`
      : "");

  const socialBlock = socialContext
    ? `CURRENT INTELLIGENCE — LAST 30 DAYS (Reddit, X, YouTube, Hacker News, GitHub, Polymarket):
${socialContext}

Use this real-time signal to strengthen: executiveSummary.highlights, marketAnalysis.marketTrends, strategy.coreInitiatives. Prioritise recent facts over training-data assumptions where they conflict. Do not fabricate sources or citations.`
    : "";

  const prompt = `Generate strategic intelligence PART A for: ${companyName}

${socialBlock ? socialBlock + "\n\n" : ""}EXECUTIVE INSTRUCTIONS
- Set executiveSummary.ceo to exactly: ${ceo}
- Do NOT include the CEO in keyExecutives.
- keyExecutives: 3–8 other verified senior leaders (CFO, COO, CTO, division presidents). Real names only. Omit anyone you cannot verify. Never invent or recombine names.

STRATEGY INSTRUCTIONS
- vision and mission must be populated for all well-known public companies — this data is always available in annual reports, investor relations pages, or company websites.
- Never return "" (empty string) for vision or mission. Use the company's actual stated purpose, tagline, or strategic intent.
- For financial institutions specifically: Barclays purpose → "Deploying finance responsibly to support people and businesses acting with empathy and integrity"; HSBC purpose → "Opening up a world of opportunity"; Lloyds → "Helping Britain Prosper"; JPMorgan → "Making dreams possible for everyone everywhere".
- For tech: Apple → "To make the best products on earth"; Microsoft → "To empower every person and organisation on the planet to achieve more"; Google → "To organise the world's information and make it universally accessible".
- If the exact statement is uncertain, derive a concise purpose statement from the company's known business model, market position, and sector — do not leave blank.
- For any company you know enough about to generate a report, you know enough to write a one-sentence vision and mission. Treat these as required fields.
- Only return null for genuinely unknown private companies where you have minimal information.

${finBlock}
${wikiContextBlock}

Return ONLY this JSON:
{
  "companyName": "Official company name",
  "industry": "Primary industry sector",
  "website": "e.g. https://www.barclays.com or null",
  "executiveSummary": {
    "companyOverview": "2-3 sentence overview",
    "headquarters": "City, Country",
    "founded": "Year or null",
    "employees": "e.g. 250,000 or null",
    "ceo": "Full name",
    "keyExecutives": [{"name": "Name", "title": "Title"}, {"name": "Name", "title": "Title"}, {"name": "Name", "title": "Title"}],
    "website": "e.g. https://www.hsbc.com or null",
    "stockExchange": "e.g. NYSE: AAPL or null if private",
    "highlights": ["Key highlight 1", "Key highlight 2", "Key highlight 3", "Key highlight 4"],
    "analystRating": "e.g. Buy / Overweight / Hold or null",
    "lastUpdated": "Today dd/mm/yyyy"
  },
  "financials": {
    "revenue": "e.g. $391.0B or null",
    "revenueGrowth": "e.g. +8.1% YoY or null",
    "netIncome": "e.g. $93.7B or null",
    "ebitda": "e.g. $125.8B or null",
    "marketCap": "e.g. $3.4T or null",
    "stockTicker": "e.g. AAPL or null",
    "stockPrice": "e.g. $225.00 or null",
    "fiscalYear": "e.g. FY2024",
    "keyMetrics": [
      {"label": "Gross Margin", "value": "45.2%", "trend": "up"},
      {"label": "Operating Margin", "value": "31.5%", "trend": "up"},
      {"label": "P/E Ratio", "value": "32.1x", "trend": "neutral"},
      {"label": "EPS", "value": "$6.11", "trend": "up"}
    ],
    "revenueHistory": [
      {"year": "2021", "revenue": "$X.XB", "growth": "+X%"},
      {"year": "2022", "revenue": "$X.XB", "growth": "+X%"},
      {"year": "2023", "revenue": "$X.XB", "growth": "+X%"},
      {"year": "2024", "revenue": "$X.XB", "growth": "+X%"}
    ],
    "outlook": "2-sentence financial outlook or null"
  },
  "strategy": {
    "vision": "Company's stated vision or purpose — never empty string, use null only if genuinely undiscoverable",
    "mission": "Company's stated mission or strategic purpose — never empty string, use null only if genuinely undiscoverable",
    "coreInitiatives": [{"title": "Initiative name", "description": "Brief description", "timeline": "e.g. 2024-2026"}],
    "geographicFocus": ["Region 1", "Region 2", "Region 3"],
    "mAndA": "M&A strategy description or null",
    "capitalAllocation": "Capital allocation priorities or null",
    "summary": "2-3 sentence strategy summary"
  },
  "marketAnalysis": {
    "totalAddressableMarket": "e.g. $2.1T or null",
    "marketShare": "e.g. 18.5% or null",
    "marketPosition": "e.g. Market leader / Strong #2",
    "competitors": [{"name": "Competitor name", "strength": "Brief strength", "threat": "high|medium|low"}],
    "customerSegments": ["Segment 1", "Segment 2", "Segment 3"],
    "geographicPresence": [
      {"region": "Americas", "percentage": "XX%"},
      {"region": "EMEA", "percentage": "XX%"},
      {"region": "APAC", "percentage": "XX%"}
    ],
    "marketTrends": ["Trend 1", "Trend 2", "Trend 3"],
    "summary": "2-3 sentence market position summary"
  }
}`;

  return callClaude(prompt, 8000);
}

// ─── Report Part B: tech + ESG + SWOT + growth + risk + digital ──────────────

async function generatePartB(companyName: string, esgData?: FMPESGData | null, socialContext?: string | null): Promise<unknown> {
  const esgBlock = esgData
    ? `VERIFIED ESG DATA (Financial Modeling Prep — use verbatim, do not alter):
- ESG Rating:          ${esgData.esgRating}
- ESG Score:           ${esgData.esgScore.toFixed(1)} / 100
- ESG Risk Level:      ${esgData.esgRisk}
- Environmental Score: ${esgData.environmentScore.toFixed(1)} / 100
- Social Score:        ${esgData.socialScore.toFixed(1)} / 100
- Governance Score:    ${esgData.governanceScore.toFixed(1)} / 100
- Data as of:          ${esgData.lastUpdated}

Use ALL values verbatim in the esg object. Set overallRating to "${esgData.esgRating} (FMP)". Do not substitute estimates for any provided field.`
    : `No verified ESG data from Financial Modeling Prep (common for non-US-listed companies).
Use your training knowledge to populate the ESG fields. For large, publicly reported companies (FTSE 100, Euro Stoxx 50, etc.) you will have good data on:
- Published ESG ratings from MSCI, Sustainalytics, or CDP (use these for overallRating, e.g. "A (MSCI)")
- Net Zero targets, environmental commitments, and governance practices from annual/sustainability reports
- Board diversity figures from corporate governance disclosures
- ESG risk assessments from major rating agencies
Fill in every field you can substantiate. Only return null for fields where you genuinely have no basis for an estimate — not as a precautionary default.`;

  const socialBlock = socialContext
    ? `CURRENT INTELLIGENCE — LAST 30 DAYS (Reddit, X, YouTube, Hacker News, GitHub, Polymarket):
${socialContext}

Use this real-time signal to strengthen: swot (opportunities and threats especially), riskAssessment.risks, growthOpportunities.opportunities, digitalTransformation. Prioritise recent facts over training-data assumptions where they conflict. Do not fabricate sources or citations.`
    : "";

  const prompt = `Generate strategic intelligence PART B for: ${companyName}

${socialBlock ? socialBlock + "\n\n" : ""}${esgBlock}

Return ONLY this JSON:
{
  "techSpend": {
    "annualITBudget": "e.g. $4.2B or null",
    "itBudgetAsPercentRevenue": "e.g. 4.8% or null",
    "cloudPlatforms": ["AWS", "Azure", "GCP"],
    "keyVendors": [{"vendor": "Vendor name", "category": "Category", "relationship": "Strategic partner / key vendor / etc"}],
    "dataInfrastructure": "Description or null",
    "securityPosture": "Description or null",
    "emergingTech": ["AI/ML", "Blockchain", "IoT"],
    "summary": "2-3 sentence tech summary"
  },
  "esg": {
    "overallRating": "e.g. A (FMP) or null",
    "overallScore": "e.g. 72.4 / 100 or null",
    "esgRisk": "e.g. Low / Medium / High or null",
    "environmentScore": "e.g. 68.1 / 100 or null",
    "socialScore": "e.g. 75.2 / 100 or null",
    "governanceScore": "e.g. 71.0 / 100 or null",
    "governanceRating": "e.g. Strong / Moderate / Weak or null",
    "boardDiversity": "e.g. 40% female representation or null",
    "netZeroTarget": "e.g. 2030 / 2050 / Not committed or null",
    "environmentalInitiatives": ["Initiative 1", "Initiative 2"],
    "socialInitiatives": ["Initiative 1", "Initiative 2"],
    "esgRisks": ["Risk 1", "Risk 2"],
    "dataSource": "Financial Modeling Prep",
    "summary": "2-3 sentence ESG summary incorporating rating, risk level, pillar scores, and key risks"
  },
  "swot": {
    "strengths": [
      {"title": "Strength title", "detail": "Explanation"},
      {"title": "Strength title", "detail": "Explanation"},
      {"title": "Strength title", "detail": "Explanation"},
      {"title": "Strength title", "detail": "Explanation"}
    ],
    "weaknesses": [
      {"title": "Weakness title", "detail": "Explanation"},
      {"title": "Weakness title", "detail": "Explanation"},
      {"title": "Weakness title", "detail": "Explanation"}
    ],
    "opportunities": [
      {"title": "Opportunity title", "detail": "Explanation"},
      {"title": "Opportunity title", "detail": "Explanation"},
      {"title": "Opportunity title", "detail": "Explanation"},
      {"title": "Opportunity title", "detail": "Explanation"}
    ],
    "threats": [
      {"title": "Threat title", "detail": "Explanation"},
      {"title": "Threat title", "detail": "Explanation"},
      {"title": "Threat title", "detail": "Explanation"}
    ]
  },
  "growthOpportunities": {
    "opportunities": [
      {
        "title": "Opportunity title",
        "description": "Detailed description",
        "potentialValue": "e.g. $50-100B or null",
        "timeframe": "e.g. 2025-2027",
        "confidence": "high|medium|low"
      }
    ],
    "totalOpportunityValue": "e.g. $200-400B across identified opportunities or null",
    "summary": "2-3 sentence growth summary"
  },
  "riskAssessment": {
    "overallRiskLevel": "high|medium|low",
    "risks": [
      {
        "category": "e.g. Regulatory / Market / Financial / Operational / Geopolitical",
        "title": "Risk title",
        "description": "Risk description",
        "likelihood": "high|medium|low",
        "impact": "high|medium|low",
        "mitigation": "Mitigation strategy"
      }
    ],
    "summary": "2-3 sentence risk summary"
  },
  "digitalTransformation": {
    "maturityLevel": "leading|advanced|developing|early",
    "maturityScore": 8,
    "keyInitiatives": [{"title": "Initiative", "description": "Description", "status": "live|in_progress|planned"}],
    "aiAdoption": "Description or null",
    "dataStrategy": "Description or null",
    "challenges": ["Challenge 1", "Challenge 2"],
    "summary": "2-3 sentence DX summary"
  }
}`;

  return callClaude(prompt, 8000);
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function computeConfidence(
  partA: any,
  partB: any,
  fmpFinancials: import("./claude.js").FMPFinancials | null,
  fmpESG: import("./claude.js").FMPESGData | null,
  ceo: string,
  wikiData?: WikipediaData | null,
): { rating: "green" | "amber" | "red"; score: number; signals: { label: string; status: "pass" | "warn" | "fail" }[]; summary: string } {

  const signals: { label: string; status: "pass" | "warn" | "fail" }[] = [];

  if (fmpFinancials) {
    signals.push({ label: "Financial data (FMP)", status: "pass" });
    signals.push({ label: "Employees (FMP)", status: fmpFinancials.employees ? "pass" : "warn" });
    signals.push({ label: "Revenue history", status: (fmpFinancials.revenueHistory?.length ?? 0) >= 3 ? "pass" : "warn" });
    signals.push({ label: "Market cap", status: fmpFinancials.marketCap && fmpFinancials.marketCap !== "N/A" ? "pass" : "warn" });
  } else if (wikiData?.revenue || wikiData?.aum) {
    signals.push({ label: "Financial data (Wikipedia)", status: "warn" });
    signals.push({ label: "Employees (Wikipedia)", status: wikiData?.employees ? "warn" : "fail" });
    signals.push({ label: "Revenue history", status: "warn" });
    signals.push({ label: "Market cap", status: "warn" });
  } else {
    signals.push({ label: "Financial data", status: "fail" });
    signals.push({ label: "Employees", status: "fail" });
    signals.push({ label: "Revenue history", status: "fail" });
    signals.push({ label: "Market cap", status: "warn" });
  }

  const ceoOk = ceo && ceo !== "See company website for current CEO";
  signals.push({ label: "CEO verified", status: ceoOk ? "pass" : "warn" });
  signals.push({ label: "ESG data (FMP)", status: fmpESG ? "pass" : "warn" });

  const vision  = partA?.strategy?.vision;
  const mission = partA?.strategy?.mission;
  signals.push({ label: "Vision / Mission", status: (vision && vision !== "" && mission && mission !== "") ? "pass" : "warn" });
  signals.push({ label: "Company website", status: partA?.website || partA?.executiveSummary?.website ? "pass" : "warn" });

  const execCount = partA?.executiveSummary?.keyExecutives?.length ?? 0;
  signals.push({ label: "Key executives", status: execCount >= 3 ? "pass" : execCount > 0 ? "warn" : "fail" });

  const swotOk = (partB?.swot?.strengths?.length ?? 0) >= 2;
  signals.push({ label: "SWOT analysis", status: swotOk ? "pass" : "warn" });

  const risksOk = (partB?.riskAssessment?.risks?.length ?? 0) >= 2;
  signals.push({ label: "Risk assessment", status: risksOk ? "pass" : "warn" });

  const maxScore = signals.length * 10;
  const score    = Math.round(
    (signals.reduce((acc, s) => acc + (s.status === "pass" ? 10 : s.status === "warn" ? 5 : 0), 0) / maxScore) * 100
  );

  const fails  = signals.filter(s => s.status === "fail").length;
  const warns  = signals.filter(s => s.status === "warn").length;
  const rating: "green" | "amber" | "red" =
    fails > 0 || score < 40  ? "red"   :
    warns > 2  || score < 70 ? "amber" : "green";

  const summary =
    rating === "green" ? "High confidence — verified data across all key sections." :
    rating === "amber" ? `Moderate confidence — ${warns} section(s) could not be fully verified.` :
    `Low confidence — significant data gaps detected. Treat with caution.`;

  return { rating, score, signals, summary };
}

// ─── Public: generate full report ─────────────────────────────────────────────

export async function generateReport(companyName: string): Promise<unknown> {
  const start = Date.now();

  const [fmpData, currentCEO, wikiData, socialContext] = await Promise.all([
    lookupFMP(companyName),
    lookupCEO(companyName),
    lookupWikipedia(companyName),
    runLast30Days(companyName),
  ]);

  // If FMP returned no financials (plan limitation, unlisted, etc.), try Yahoo Finance
  let financials = fmpData.financials;
  if (!financials) {
    console.log(`💹 FMP returned no financials for "${companyName}" — trying Yahoo Finance...`);
    financials = await lookupYahoo(companyName);
  }

  const dataSource = financials
    ? (fmpData.financials ? "FMP" : "Yahoo Finance")
    : wikiData?.revenue || wikiData?.aum
      ? "Wikipedia fallback"
      : "no external data";

  console.log(`📊 Data source for "${companyName}": ${dataSource}`);
  if (financials?.employees) {
    console.log(`👥 Employees from ${fmpData.financials ? 'FMP' : 'Yahoo'}: ${financials.employees}`);
  }

  const partA = await generatePartA(companyName, financials, currentCEO, wikiData, socialContext);
  const partB = await generatePartB(companyName, fmpData.esg, socialContext);

  console.log(`✅ Report generated in ${((Date.now() - start) / 1000).toFixed(1)}s (FMP + Wiki + CEO + Haiku x2)`);

  const confidence = computeConfidence(partA, partB, financials, fmpData.esg, currentCEO, wikiData);

  const financialsMeta: FinancialsMetadata = (() => {
    const now = new Date().toISOString().slice(0, 10);
    if (fmpData.financials) {
      return { source: "FMP", confidence: "verified", fiscalYear: fmpData.financials.fiscalYear, retrievedAt: now };
    }
    if (financials) {
      // Yahoo Finance fallback — mark as single-source with Yahoo label
      return { source: "FMP" as const, confidence: "single-source" as const, fiscalYear: financials.fiscalYear, retrievedAt: now };
    }
    if (wikiData?.revenue || wikiData?.aum || wikiData?.netIncome) {
      return {
        source:      "Wikipedia",
        confidence:  "wikipedia",
        fiscalYear:  null,
        retrievedAt: now,
      };
    }
    // LLM training knowledge — check what was actually returned
    const partATyped2 = partA as any;
    const llmRevenue = partATyped2?.financials?.revenue;
    const llmHasData2 = llmRevenue && llmRevenue !== null && llmRevenue !== 'N/A' && llmRevenue !== 'null';
    return {
      source:      "LLM" as const,
      confidence:  llmHasData2 ? "estimated" as const : "unavailable" as const,
      fiscalYear:  partATyped2?.financials?.fiscalYear ?? null,
      retrievedAt: now,
    };
  })();

  // Numeric sanity checks
  if (financialsMeta.source === "FMP" && financials) {
    const revHistory = financials.revenueHistory;
    if (revHistory.length >= 2) {
      for (let i = 0; i < revHistory.length - 1; i++) {
        const curr = parseFloat(revHistory[i].revenue.replace(/[^0-9.]/g, ""));
        const prev = parseFloat(revHistory[i + 1].revenue.replace(/[^0-9.]/g, ""));
        if (prev > 0 && curr > 0) {
          const change = Math.abs((curr - prev) / prev);
          if (change > 3) {
            console.warn(`⚠️  Sanity: implausible revenue swing for ${companyName} (${revHistory[i+1].year}→${revHistory[i].year}: ${(change*100).toFixed(0)}%)`);
            financialsMeta.confidence = "single-source";
          }
        }
      }
    }
  }

  // Strip orphaned IT budget % only when truly no data at all
  if (financialsMeta.confidence === "unavailable") {
    const techSpend = (partB as any)?.techSpend;
    if (techSpend?.itBudgetAsPercentRevenue) {
      console.log(`🧹 Stripping orphaned itBudgetAsPercentRevenue (no verified revenue for ${companyName})`);
      techSpend.itBudgetAsPercentRevenue = null;
    }
  }

  return { ...(partA as object), ...(partB as object), confidence, _financialsMeta: financialsMeta };
}

// ─── Sales Enablement ─────────────────────────────────────────────────────────

export async function generateSalesEnablement(
  companyName: string,
  reportData: unknown,
  sellerProduct: string
): Promise<unknown> {
  const prompt = `Generate a sales enablement brief.

Target Company: ${companyName}
Seller's Product/Service: ${sellerProduct}

Company Intelligence:
${JSON.stringify(reportData, null, 2)}

Return ONLY this JSON:
{
  "sellerProduct": "${sellerProduct}",
  "salesSummary": "2-3 sentence executive summary of the sales opportunity",
  "conversationStarters": ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"],
  "painPoints": [
    {"pain": "Specific pain point", "solution": "How your product addresses it"},
    {"pain": "Specific pain point", "solution": "How your product addresses it"},
    {"pain": "Specific pain point", "solution": "How your product addresses it"}
  ],
  "useCases": [
    {"title": "Use case title", "roi": "Quantified ROI estimate", "description": "How it applies to this company"},
    {"title": "Use case title", "roi": "Quantified ROI estimate", "description": "How it applies to this company"},
    {"title": "Use case title", "roi": "Quantified ROI estimate", "description": "How it applies to this company"}
  ],
  "totalValueOpportunity": "e.g. $2-5M ACV based on company profile",
  "currentChallenges": ["Challenge 1", "Challenge 2", "Challenge 3", "Challenge 4"],
  "potentialSavings": [
    {"area": "Area name", "estimate": "e.g. $500K-1M annually"},
    {"area": "Area name", "estimate": "e.g. $200K annually"},
    {"area": "Area name", "estimate": "e.g. 20% efficiency gain"}
  ],
  "competitivePositioning": "How to position against likely alternatives this company uses",
  "nextSteps": [
    {"step": "Step 1", "action": "Specific action", "timeline": "Immediate"},
    {"step": "Step 2", "action": "Specific action", "timeline": "Week 1-2"},
    {"step": "Step 3", "action": "Specific action", "timeline": "Month 1"}
  ]
}`;

  return callClaude(prompt, 5000);
}

// ─── Investor Presentation ────────────────────────────────────────────────────

export async function generateInvestorPresentation(
  companyName: string,
  reportData: unknown
): Promise<unknown> {
  const prompt = `Generate a structured investor presentation for ${companyName}.

Based on this data:
${JSON.stringify(reportData, null, 2)}

Return ONLY this JSON:
{
  "title": "${companyName}: Investment Analysis",
  "date": "dd/mm/yyyy",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "type": "cover|executive_summary|financials|market|strategy|swot|growth|risk|conclusion",
      "headline": "Key message headline",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "metric": {"label": "Key metric label", "value": "Value"}
    }
  ],
  "disclaimer": "Standard investment disclaimer"
}

Include 10-12 slides: cover, investment thesis, company overview, financial highlights, market opportunity, competitive position, strategic initiatives, SWOT, growth catalysts, risk factors, valuation summary, conclusion.`;

  return callClaude(prompt, 7000);
}
