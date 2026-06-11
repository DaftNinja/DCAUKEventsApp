import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-haiku-4-5-20251001";
const MODEL_FAST     = "claude-haiku-4-5-20251001";

// ─── Financial Modeling Prep (FMP) ───────────────────────────────────────────
// Single integration covering financials and ESG scores. One key, one dependency.

const FMP_KEY  = process.env.FMP_API_KEY ?? "";
const FMP_BASE = "https://financialmodelingprep.com/api";

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
    const res = await fetch(`${FMP_BASE}${path}&apikey=${FMP_KEY}`);
    if (!res.ok) {
      console.warn(`FMP ${path} → ${res.status}`);
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
  try {
    const res = await fetch(
      `${FMP_BASE}/v3/search?query=${encodeURIComponent(companyName)}&limit=5&apikey=${FMP_KEY}`
    );
    if (!res.ok) return null;

    const results = await res.json() as { symbol: string; name: string; exchangeShortName?: string }[];
    if (!results?.length) return null;

    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const query     = normalise(companyName);
    const US_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "NYSE ARCA"]);

    // Only accept matches where the name meaningfully matches AND it's on a US exchange.
    // Deliberately drop the results[0] fallback — it caused wrong-company matches
    // (e.g. "Fidelity National Financial" for "Fidelity Investments").
    const match =
      results.find(r => normalise(r.name) === query && US_EXCHANGES.has(r.exchangeShortName ?? "")) ??
      results.find(r => normalise(r.name).includes(query) && US_EXCHANGES.has(r.exchangeShortName ?? ""));

    if (!match) {
      console.log(`📈 FMP: no confident ticker match for "${companyName}" — will try Wikipedia fallback`);
      return null;
    }

    console.log(`📈 FMP resolved "${companyName}" → ${match.symbol}`);
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
  type ProfileData2 = {
    sector?: string; industry?: string;
  };
  type ProfileData = {
    mktCap?: number; price?: number; pe?: number; eps?: number;
  };
  type RatingData = {
    ratingDetailsDCFRecommendation?: string;
    ratingDetailsROERecommendation?: string;
    rating?: string;
  };
  type PriceTargetData = { priceTarget?: number };

  const [incomeRaw, cashFlowRaw, profileRaw, ratingRaw, targetRaw] = await Promise.all([
    fmpGet<IncomeReport[]>(`/v3/income-statement/${ticker}?limit=5`),
    fmpGet<CashFlowReport[]>(`/v3/cash-flow-statement/${ticker}?limit=1`),
    fmpGet<ProfileData[]>(`/v3/profile/${ticker}?`),
    fmpGet<RatingData[]>(`/v3/rating/${ticker}?`),
    fmpGet<PriceTargetData[]>(`/v4/price-target-consensus?symbol=${ticker}&`),
  ]);

  const reports  = incomeRaw    ?? [];
  const cashFlow = cashFlowRaw?.[0] ?? {};
  const profile  = profileRaw?.[0]  ?? {};
  const rating   = ratingRaw?.[0]   ?? {};
  const target   = targetRaw?.[0]   ?? {};

  // Detect financial sector — EBITDA is not meaningful for banks/insurance
  const sector = (profile as any).sector ?? "";
  const isFinancial = /bank|financ|insurance|capital|invest/i.test(sector);

  if (!reports.length && !profile.mktCap) {
    console.warn(`FMP: no financial data for ${ticker}`);
    return null;
  }

  // Revenue history — chronological order
  const revenueHistory = reports.slice(0, 4).map((r, i) => {
    const year    = r.calendarYear ?? r.date?.slice(0, 4) ?? "N/A";
    const rev     = r.revenue ?? 0;
    const prevRev = reports[i + 1]?.revenue ?? 0;
    const growth  = prevRev
      ? `${rev > prevRev ? "+" : ""}${(((rev - prevRev) / prevRev) * 100).toFixed(1)}%`
      : "N/A";
    return { year, revenue: fmt(rev), growth };
  }).reverse();

  // YoY growth
  const latestRev = reports[0]?.revenue ?? 0;
  const priorRev  = reports[1]?.revenue ?? 0;
  const yoyGrowth = priorRev
    ? `${latestRev > priorRev ? "+" : ""}${(((latestRev - priorRev) / priorRev) * 100).toFixed(1)}% YoY`
    : "N/A";

  const fiscalYear = `FY${reports[0]?.calendarYear ?? reports[0]?.date?.slice(0, 4) ?? new Date().getFullYear()}`;

  // Analyst rating from FMP rating endpoint
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
      // Banks and financial institutions don't use EBITDA — return "N/A (financial sector)"
      if (isFinancial) return "N/A (financial sector)";
      // Try direct FMP field first
      const direct = reports[0]?.ebitda;
      if (direct != null && direct !== 0) return fmt(direct);
      // Fallback: operatingIncome + D&A from cash flow statement
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
    analystTarget:   target.priceTarget != null ? `$${target.priceTarget.toFixed(2)}` : "N/A",
    analystRating,
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

  const data = await fmpGet<ESGRecord[]>(`/v4/esg-environmental-social-governance-data?symbol=${ticker}&`);
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

  // Fetch financials and ESG in parallel — same ticker, independent endpoints
  const [financials, esg] = await Promise.all([
    fetchFMPFinancials(ticker),
    fetchFMPESG(ticker),
  ]);

  return { financials, esg };
}

// ─── Wikipedia Fallback ───────────────────────────────────────────────────────
// Used when FMP returns no data (private companies, non-US listed, etc.)
// Calls the Wikipedia REST API — no API key required.

/**
 * Parse a value out of a Wikipedia infobox plain-text block.
 * The infobox is embedded in the extract as key: value lines, e.g.:
 *   "revenue = US$27.6 billion (2023)"
 * Returns the raw matched string or null.
 */
function parseInfoboxField(text: string, ...keys: string[]): string | null {
  for (const key of keys) {
    // Match "key = value" or "key: value" patterns (case-insensitive)
    const re = new RegExp(`(?:^|\\n)\\s*${key}\\s*[=:]\\s*([^\\n]+)`, "i");
    const m  = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Strip Wikipedia citation noise and template markup from a value string.
 * e.g. "US$27.6 billion (2023)[4]" → "US$27.6 billion (2023)"
 */
function cleanWikiValue(val: string | null): string | null {
  if (!val) return null;
  return val
    .replace(/\[\d+\]/g, "")          // remove [4] citation refs
    .replace(/\{\{[^}]*\}\}/g, "")    // remove {{template}} markup
    .replace(/\s+/g, " ")
    .trim() || null;
}

export async function lookupWikipedia(companyName: string): Promise<WikipediaData | null> {
  try {
    // 1. Search Wikipedia for the company
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=3&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { headers: { "User-Agent": "1GLInsightsBot/1.0" } });
    if (!searchRes.ok) return null;

    const searchJson = await searchRes.json() as {
      query?: { search?: { title: string; snippet: string }[] };
    };
    const hits = searchJson.query?.search ?? [];
    if (!hits.length) return null;

    // Pick the best match: exact name match first, then first result
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const query = normalise(companyName);
    const bestHit =
      hits.find(h => normalise(h.title) === query) ??
      hits.find(h => normalise(h.title).includes(query)) ??
      hits[0];

    console.log(`📖 Wikipedia: searching "${companyName}" → matched "${bestHit.title}"`);

    // 2. Fetch the full page summary + infobox via the REST summary endpoint
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

    // 3. Also fetch the infobox data via the parse API (returns wikitext with structured fields)
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${pageTitle}&format=json&origin=*`;
    const parseRes = await fetch(parseUrl, { headers: { "User-Agent": "1GLInsightsBot/1.0" } });
    let wikitext = "";
    if (parseRes.ok) {
      const parseJson = await parseRes.json() as { query?: { pages?: Record<string, { revisions?: { slots?: { main?: { "*"?: string } } }[] }> } };
      const pages = parseJson.query?.pages ?? {};
      const page  = Object.values(pages)[0];
      wikitext    = page?.revisions?.[0]?.slots?.main?.["*"] ?? "";
    }

    // 4. Parse infobox fields from wikitext (more reliable than extract for structured data)
    const textToParse = wikitext || extract;

    const founded     = cleanWikiValue(parseInfoboxField(textToParse, "founded", "foundation", "established", "formation"));
    const headquarters = cleanWikiValue(parseInfoboxField(textToParse, "headquarters", "hq_location", "location_city", "location"));
    const employees   = cleanWikiValue(parseInfoboxField(textToParse, "num_employees", "employees", "workforce"));
    const revenue     = cleanWikiValue(parseInfoboxField(textToParse, "revenue", "total_revenue", "income"));
    const netIncome   = cleanWikiValue(parseInfoboxField(textToParse, "net_income", "profit", "net_profit"));
    const aum         = cleanWikiValue(parseInfoboxField(textToParse, "aum", "assets_under_management", "assets under management", "AUM"));
    const totalAssets = cleanWikiValue(parseInfoboxField(textToParse, "total_assets", "assets"));
    const website     = cleanWikiValue(parseInfoboxField(textToParse, "website", "url", "homepage"));
    const parentOrg   = cleanWikiValue(parseInfoboxField(textToParse, "parent", "parent_organization", "owner"));

    console.log(`📖 Wikipedia data for "${companyName}": revenue=${revenue}, employees=${employees}, aum=${aum}`);

    return {
      title:        bestHit.title,
      extract:      extract.slice(0, 1500), // cap to avoid token bloat
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

// ─── CEO lookup via web search (minimal token footprint) ──────────────────────

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
  } catch {
    console.error("JSON parse failed. Raw:", cleaned.slice(0, 500));
    throw new Error("Failed to parse API response. Please try again.");
  }
}

// ─── Report Part A: overview + financials + strategy + market ─────────────────

async function generatePartA(
  companyName: string,
  fmpFinancials?: FMPFinancials | null,
  currentCEO?: string,
  wikiData?: WikipediaData | null,
): Promise<unknown> {
  const ceo = currentCEO ?? await lookupCEO(companyName);

  // ── Financial data block ──────────────────────────────────────────────────
  // Priority: FMP (real-time, structured) > Wikipedia (encyclopaedic, text-parsed) > LLM estimates
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
- Revenue History (chronological):
${fin.revenueHistory.map(r => `  ${r.year}: ${r.revenue} (${r.growth})`).join("\n")}

Use ALL of the above values verbatim in the financials object. Do not substitute your own estimates for any field that has been provided.`;
  } else if (wikiData) {
    // Build a structured injection from whatever Wikipedia returned
    const wikiLines: string[] = [];
    if (wikiData.revenue)     wikiLines.push(`- Revenue:              ${wikiData.revenue}`);
    if (wikiData.netIncome)   wikiLines.push(`- Net Income:           ${wikiData.netIncome}`);
    if (wikiData.aum)         wikiLines.push(`- AUM:                  ${wikiData.aum}`);
    if (wikiData.totalAssets) wikiLines.push(`- Total Assets:         ${wikiData.totalAssets}`);
    if (wikiData.employees)   wikiLines.push(`- Employees:            ${wikiData.employees}`);
    if (wikiData.founded)     wikiLines.push(`- Founded:              ${wikiData.founded}`);
    if (wikiData.headquarters)wikiLines.push(`- Headquarters:         ${wikiData.headquarters}`);
    if (wikiData.website)     wikiLines.push(`- Website:              ${wikiData.website}`);

    finBlock = `SUPPLEMENTAL DATA (Wikipedia — private/unlisted company; use as directional reference):
${wikiLines.join("\n")}

COMPANY CONTEXT (Wikipedia extract — use to enrich overview, strategy, and market sections):
${wikiData.extract}

Note: This company is private/unlisted. No stock price, market cap, P/E ratio, or analyst ratings are available.
Use the Wikipedia figures above for revenue, employees, and other available fields.
For unavailable fields (stock price, market cap, EPS, analyst target), return null.`;
  } else {
    finBlock = `No verified financial data available (private or unlisted company). Use best estimates from training data where confident; return null for any value you cannot verify.`;
  }

  // ── Context supplement from Wikipedia (for all companies) ────────────────
  // Even for public companies, Wikipedia may add useful context (founded, HQ, etc.)
  const wikiContextBlock = (!fin && wikiData)
    ? "" // already embedded in finBlock above
    : (wikiData
      ? `\nSUPPLEMENTAL CONTEXT (Wikipedia):
- Founded: ${wikiData.founded ?? "N/A"}
- Headquarters: ${wikiData.headquarters ?? "N/A"}
- Employees: ${wikiData.employees ?? "N/A"}
- Website: ${wikiData.website ?? "N/A"}`
      : "");

  const prompt = `Generate strategic intelligence PART A for: ${companyName}

EXECUTIVE INSTRUCTIONS
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
    "vision": "Company's stated vision or purpose (e.g. from annual report, website, investor docs) — never empty string, use null only if genuinely undiscoverable",
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

  return callClaude(prompt, 6000);
}

// ─── Report Part B: tech + ESG + SWOT + growth + risk + digital ──────────────

async function generatePartB(companyName: string, esgData?: FMPESGData | null): Promise<unknown> {
  // Build verified ESG injection block from FMP data
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
    : `No verified ESG data available. Use best estimates from training data; return null for any value you cannot verify.`;

  const prompt = `Generate strategic intelligence PART B for: ${companyName}

${esgBlock}

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

  return callClaude(prompt, 5500);
}

// ─── Confidence scoring ───────────────────────────────────────────────────────
// Computed server-side from inspectable data quality signals — not LLM-generated.

function computeConfidence(
  partA: any,
  partB: any,
  fmpFinancials: import("./claude.js").FMPFinancials | null,
  fmpESG: import("./claude.js").FMPESGData | null,
  ceo: string,
  wikiData?: WikipediaData | null,
): { rating: "green" | "amber" | "red"; score: number; signals: { label: string; status: "pass" | "warn" | "fail" }[]; summary: string } {

  const signals: { label: string; status: "pass" | "warn" | "fail" }[] = [];

  // FMP financials — Wikipedia is a valid (amber) fallback
  if (fmpFinancials) {
    signals.push({ label: "Financial data (FMP)", status: "pass" });
    signals.push({ label: "Revenue history", status: (fmpFinancials.revenueHistory?.length ?? 0) >= 3 ? "pass" : "warn" });
    signals.push({ label: "Market cap", status: fmpFinancials.marketCap && fmpFinancials.marketCap !== "N/A" ? "pass" : "warn" });
  } else if (wikiData?.revenue || wikiData?.aum) {
    signals.push({ label: "Financial data (Wikipedia)", status: "warn" });
    signals.push({ label: "Revenue history", status: "warn" });
    signals.push({ label: "Market cap", status: "warn" }); // private — no market cap
  } else {
    signals.push({ label: "Financial data", status: "fail" });
    signals.push({ label: "Revenue history", status: "fail" });
    signals.push({ label: "Market cap", status: "warn" });
  }

  // CEO
  const ceoOk = ceo && ceo !== "See company website for current CEO";
  signals.push({ label: "CEO verified", status: ceoOk ? "pass" : "warn" });

  // ESG
  signals.push({ label: "ESG data (FMP)", status: fmpESG ? "pass" : "warn" });

  // Vision / Mission
  const vision  = partA?.strategy?.vision;
  const mission = partA?.strategy?.mission;
  signals.push({ label: "Vision / Mission", status: (vision && vision !== "" && mission && mission !== "") ? "pass" : "warn" });

  // Website
  signals.push({ label: "Company website", status: partA?.website || partA?.executiveSummary?.website ? "pass" : "warn" });

  // Key executives
  const execCount = partA?.executiveSummary?.keyExecutives?.length ?? 0;
  signals.push({ label: "Key executives", status: execCount >= 3 ? "pass" : execCount > 0 ? "warn" : "fail" });

  // SWOT populated
  const swotOk = (partB?.swot?.strengths?.length ?? 0) >= 2;
  signals.push({ label: "SWOT analysis", status: swotOk ? "pass" : "warn" });

  // Risk assessment
  const risksOk = (partB?.riskAssessment?.risks?.length ?? 0) >= 2;
  signals.push({ label: "Risk assessment", status: risksOk ? "pass" : "warn" });

  // Score: pass=10pts, warn=5pts, fail=0pts
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

  // FMP lookup (financials + ESG), CEO lookup, and Wikipedia lookup all run in parallel.
  // Wikipedia runs unconditionally — we'll only use it if FMP comes back empty,
  // but starting it in parallel costs nothing extra in wall-clock time.
  const [fmpData, currentCEO, wikiData] = await Promise.all([
    lookupFMP(companyName),
    lookupCEO(companyName),
    lookupWikipedia(companyName),
  ]);

  // Decide data source for logging
  const dataSource = fmpData.financials
    ? "FMP"
    : wikiData?.revenue || wikiData?.aum
      ? "Wikipedia fallback"
      : "LLM estimates only";

  console.log(`📊 Data source for "${companyName}": ${dataSource}`);

  // Part A and Part B run sequentially to respect Anthropic token rate limits.
  // Pass wikiData into Part A so it can supplement the financial block.
  const partA = await generatePartA(companyName, fmpData.financials, currentCEO, wikiData);
  const partB = await generatePartB(companyName, fmpData.esg);

  console.log(`✅ Report generated in ${((Date.now() - start) / 1000).toFixed(1)}s (FMP + Wiki + CEO + Haiku x2)`);

  const confidence = computeConfidence(partA, partB, fmpData.financials, fmpData.esg, currentCEO, wikiData);
  return { ...(partA as object), ...(partB as object), confidence };
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

  return callClaude(prompt, 4000);
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
