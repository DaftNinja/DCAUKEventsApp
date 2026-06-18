import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-haiku-4-5-20251001"; // CEO web search — fast, single-fact lookup
const MODEL_FAST = "claude-sonnet-4-6";             // Report generation — quality matters
const MODEL_PRESENTATION = "claude-sonnet-4-6";     // Investor deck — reserved for Opus upgrade later

const SYSTEM = `You are an elite strategic intelligence analyst working for the Stellanor Insight Generator platform.
Respond with ONLY valid JSON — no prose, no markdown fences, no explanation.
Do NOT write any introductory sentences or narrate your search process. Output JSON immediately.
Use real accurate data for well-known companies. Estimates for smaller ones.
CRITICAL: For CEO and key executives, only provide names you are highly confident are currently accurate.
If uncertain about the current CEO, set "ceo" to "See company website for current CEO".
Never confuse executives across different companies.
Dates in dd/mm/yyyy format.
Be concise — keep string values short (1-2 sentences max), keep arrays to 3-5 items max except keyExecutives (3-8 entries, verified names only).
FINANCIAL FIELDS: You MUST provide a non-empty value for every financial field.
Never use "—", "N/A", or leave fields blank. Use estimates if exact figures unavailable
and note them as "e.g. ~4.2B (est.)". For revenue history provide EXACTLY 4 years of data.

CURRENCY RULES — CRITICAL:
- ALWAYS use the native currency SYMBOL of the company's headquarters country. NEVER use ISO codes (GBP, USD, EUR, JPY).
- UK / British companies → £ (e.g. £68.5B, £2.4B)
- Eurozone companies (Germany, France, Italy, Spain, Netherlands, etc.) → € (e.g. €142.0B)
- US companies → $ (e.g. $391.0B)
- Japanese companies → ¥ (e.g. ¥10.0T)
- Swiss companies → CHF (e.g. CHF 94.0B)
- Canadian companies → C$ (e.g. C$18.0B)
- Australian companies → A$ (e.g. A$12.0B)
- Do NOT convert to USD. Report in the company's home currency only.
- Examples: Tesco → £, BMW → €, Apple → $, Toyota → ¥, Nestlé → CHF`;

// ─── Stellanor seller context ─────────────────────────────────────────────────
const STELLANOR_SELLER_CONTEXT = `
ABOUT STELLANOR DATACENTERS (the seller):
- Fast-growing next-generation UK datacenter platform. CEO: Steve Scott. Backed by DWS Group.
- Mission: deliver high-quality, reliable and sustainable colocation services through well-invested,
  secure digital infrastructure to enterprise and wholesale customers — supporting digital
  outsourcing and the AI revolution.
- 10 UK datacenters (post-Redcentric acquisition Oct 2025): London East (6 Braham St, E1),
  London North (Goswell Road, EC1V), Reading, Cambridge, Woking, Gatwick, Byfleet, West Yorkshire,
  plus two additional legacy sites.
- Total secured grid capacity: 36MW across the portfolio. ~450 existing clients.
- 100% renewable energy. Target: fully CO₂ neutral by 2030. Tier 3+ standards across most sites.

CORE SERVICES:
1. COLOCATION — rack space, redundant power, cooling, physical security, 24/7 monitoring.
   Fixed monthly fee. Scalable — customers add rack space on demand via myStellanor portal.
   Predictable costs vs CapEx-heavy own-DC model.
2. CONNECTIVITY — cloud & carrier-neutral (no vendor lock-in). Services:
   - IP Transit (local and international Tier 1–3 networks)
   - Dark fibre (unlit, full customer configuration control)
   - Lit fibre / DWDM (active, ready for immediate data transmission)
   - ISP Hosting — 100% flexibility to switch ISP providers
   - Key carriers: Lumen, Colt, BT, Vodafone, Verizon, Interoute, Cogent, euNetworks, AT&T, Fibernet, Kingston
   - Internet Exchange access for high-speed, low-latency connectivity
3. MANAGED MONITORING — myStellanor portal: energy consumption, inlet temperature, humidity,
   remote services, orders, access management, all in one place.
4. MIGRATION SUPPORT — guided migration process, partner network, tailored advice at every step.

KEY DIFFERENTIATORS TO LEAD WITH:
- Tier 3+ reliability: fully redundant UPS / cooling / diesel generators, 99.999% uptime capability
- 100% renewable energy — strong ESG story, CO₂ neutral by 2030 (critical for sustainability-reporting enterprises)
- Cloud & carrier-neutral — no vendor lock-in, full provider freedom, fostering innovation
- Edge/urban locations: proximity to City of London reduces latency vs hyperscale out-of-town campuses
- AI inference and real-time analytics ready — high-density compute hosting
- Personalised, local specialist service vs large impersonal global providers
- Predictable fixed monthly costs — eliminates CapEx, makes DC spend opex
- Scalable without long lead times — add rack space on demand
- Enterprise-grade security: biometric palm scanners, 24/7 remote monitoring, full electronic access control, CCTV
- myStellanor self-service portal for real-time visibility and control

FLAGSHIP FACILITIES:
London East — 6 Braham St, E1 8EP. Est. 1999. 6 floors. 8,046m² total / 2,940m² colo.
  4MVA max power. 2×2MVA diesel generators. 1,875kVA UPS N+1. Dual fibre entry.
London North — Moreland House, 260-265 Goswell Rd, EC1V 7EB. 7 floors. 25,143m² total / 12,212m² colo.
  20MVA max power. 4×4.3MVA generators. 9,500kVA UPS N+1. Three independent fibre entry points.
  Full BMS, Location Operations & Control Center, perimeter under-floor leak detection.

IDEAL CUSTOMER PROFILE:
- Enterprise IT teams and managed cloud/hosting providers needing secure, scalable UK colocation
- Organisations with ageing or oversized on-premises data centers facing refresh, cost, or ESG pressure
- Businesses requiring low-latency City of London connectivity (financial services, media, gaming, healthcare, public sector)
- Companies adopting generative AI or real-time analytics needing high-density compute hosting
- Organisations with ESG / net-zero reporting requirements where 100% renewable energy matters
- Wholesale customers needing large-footprint deployments with carrier diversity
- Businesses wanting to exit capital-intensive data center ownership and move to predictable opex
`.trim();

// ─── Currency helper ──────────────────────────────────────────────────────────
function currencySymbol(hq: string): string {
  const h = hq.toLowerCase();
  if (/uk|united kingdom|england|scotland|wales|britain/.test(h)) return "£";
  if (/germany|france|italy|spain|netherlands|belgium|austria|finland|ireland|portugal|greece|luxembourg/.test(h)) return "€";
  if (/japan/.test(h)) return "¥";
  if (/switzerland/.test(h)) return "CHF ";
  if (/canada/.test(h)) return "C$";
  if (/australia/.test(h)) return "A$";
  if (/sweden|norway|denmark/.test(h)) return "kr";
  if (/china/.test(h)) return "¥";
  if (/india/.test(h)) return "₹";
  if (/brazil/.test(h)) return "R$";
  return "$";
}

// ─── FMP API Helper ───────────────────────────────────────────────────────────
const FMP_BASE = "https://financialmodelingprep.com/api/v3";

interface FMPFinancials {
  marketCap?: string;
  ebitda?: string;
  grossMargin?: string;
  revenueHistory?: Array<{ year: string; revenue: string; growth: string }>;
  stockPrice?: string;
  peRatio?: string;
  eps?: string;
  operatingMargin?: string;
  currency?: string;
}

async function fetchFMPFinancials(ticker: string): Promise<FMPFinancials> {
  const key = process.env.FMP_API_KEY;
  if (!key || !ticker) return {};
  try {
    const [profileRes, incomeRes, ratiosRes] = await Promise.all([
      fetch(`${FMP_BASE}/profile/${ticker}?apikey=${key}`),
      fetch(`${FMP_BASE}/income-statement/${ticker}?limit=4&apikey=${key}`),
      fetch(`${FMP_BASE}/ratios-ttm/${ticker}?apikey=${key}`),
    ]);
    const [profile, income, ratios] = await Promise.all([
      profileRes.json(), incomeRes.json(), ratiosRes.json(),
    ]);
    const p = Array.isArray(profile) ? profile[0] : null;
    const r = Array.isArray(ratios) ? ratios[0] : null;
    const incomeList = Array.isArray(income) ? income : [];
    const fmpCurrency: string = p?.currency ?? "USD";
    const sym = p?.country ? currencySymbol(p.country) : fmpCurrencyToSymbol(fmpCurrency);
    const fmt = (n: number | undefined): string | undefined => {
      if (n == null || isNaN(n)) return undefined;
      if (Math.abs(n) >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
      if (Math.abs(n) >= 1e9)  return `${sym}${(n / 1e9).toFixed(2)}B`;
      if (Math.abs(n) >= 1e6)  return `${sym}${(n / 1e6).toFixed(2)}M`;
      return `${sym}${n.toFixed(2)}`;
    };
    const fmtPct = (n: number | undefined) => n == null || isNaN(n) ? undefined : `${(n * 100).toFixed(1)}%`;
    const revenueHistory = incomeList.slice(0, 4).reverse().map((y: any, idx: number, arr: any[]) => {
      const rev = y.revenue as number;
      const prevRev = idx > 0 ? (arr[idx - 1].revenue as number) : null;
      const growth = prevRev && prevRev > 0 ? `${(((rev - prevRev) / prevRev) * 100).toFixed(1)}%` : "N/A";
      return { year: String(y.calendarYear || y.date?.slice(0, 4) || ""), revenue: fmt(rev) ?? "N/A", growth };
    });
    return {
      marketCap: fmt(p?.mktCap), ebitda: fmt(incomeList[0]?.ebitda),
      grossMargin: fmtPct(r?.grossProfitMarginTTM), operatingMargin: fmtPct(r?.operatingProfitMarginTTM),
      stockPrice: p?.price != null ? `${sym}${p.price.toFixed(2)}` : undefined,
      peRatio: r?.peRatioTTM != null ? `${r.peRatioTTM.toFixed(1)}x` : undefined,
      eps: r?.epsTTM != null ? `${sym}${r.epsTTM.toFixed(2)}` : undefined,
      revenueHistory: revenueHistory.length >= 2 ? revenueHistory : undefined,
      currency: fmpCurrency,
    };
  } catch (err) {
    console.warn(`FMP fetch failed for ${ticker}:`, err);
    return {};
  }
}

function fmpCurrencyToSymbol(code: string): string {
  const map: Record<string, string> = {
    GBP: "£", EUR: "€", USD: "$", JPY: "¥", CHF: "CHF ",
    CAD: "C$", AUD: "A$", SEK: "kr", NOK: "kr", DKK: "kr", INR: "₹", CNY: "¥", BRL: "R$",
  };
  return map[code.toUpperCase()] ?? "$";
}

// ─── Company name resolution ──────────────────────────────────────────────────
export async function resolveCompanyName(input: string): Promise<string> {
  const trimmed = input.trim();
  const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(trimmed);
  if (!looksLikeUrl) return trimmed;
  let domain = trimmed;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    domain = new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch { /* leave domain as trimmed */ }
  try {
    const message = await client.messages.create({
      model: MODEL_GROUNDED,
      max_tokens: 50,
      system: "You are a company name lookup assistant. Respond with ONLY the official company name — correct capitalisation, no punctuation, no explanation.",
      messages: [{ role: "user", content: `What is the official company name for the website domain: ${domain}? Return only the name.` }],
    });
    const name = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("").trim().replace(/["'.]/g, "");
    if (name && name.length > 0 && name.length < 100 && !name.includes("\n")) return name;
  } catch (err) {
    console.warn(`Company name resolution failed for ${domain}:`, err);
  }
  const label = domain.split(".")[0];
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

// ─── CEO lookup via web search ────────────────────────────────────────────────
// Uses Sonnet (not Haiku) with web search — better recall for private/smaller
// companies where Haiku's training data is sparse.
async function lookupCEO(companyName: string): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL_FAST, // Sonnet — better web recall for private/smaller companies
      max_tokens: 200,
      system: "You are a factual lookup assistant. Search the web for the current CEO. Respond with ONLY their full name — no punctuation, no explanation, nothing else. If you cannot confirm with high confidence, respond with exactly: unknown",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Search the web for the current CEO of ${companyName}. Return only their full name, or 'unknown' if not found.` }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, "")
      .trim();
    if (
      text &&
      text.length > 2 &&
      text.length < 80 &&
      !text.includes("{") &&
      !text.includes("\n") &&
      !/^unknown$/i.test(text) &&
      !/cannot|unable|not found|no ceo|n\/a/i.test(text)
    ) {
      console.log(`  👤 CEO: "${text}"`);
      return text;
    }
  } catch (err) {
    console.warn(`CEO lookup failed for ${companyName}:`, err);
  }
  console.warn(`  ⚠️ CEO not confirmed for "${companyName}"`);
  return "See company website for current CEO";
}

// ─── callClaude ──────────────────────────────────────────────────────────────
async function callClaude(prompt: string, maxTokens: number): Promise<unknown> {
  const t = Date.now();
  const message = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  console.log(`  callClaude done in ${((Date.now()-t)/1000).toFixed(1)}s (stop_reason=${message.stop_reason}, output_tokens=${message.usage?.output_tokens})`);
  if (message.stop_reason === "max_tokens") {
    console.error(`Response truncated at ${maxTokens} tokens — increase max_tokens`);
    throw new Error("Response was too long and got cut off. Please try again.");
  }
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  if (!text) throw new Error("Empty response from Claude API");
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("JSON parse failed. Raw:", cleaned.slice(0, 500));
    throw new Error("Failed to parse API response. Please try again.");
  }
}

// ─── Merge FMP data ───────────────────────────────────────────────────────────
function mergeFinancials(claudeFinancials: any, fmp: FMPFinancials): any {
  const merged = { ...claudeFinancials };
  if (fmp.marketCap) merged.marketCap = fmp.marketCap;
  if (fmp.ebitda) merged.ebitda = fmp.ebitda;
  if (fmp.stockPrice) merged.stockPrice = fmp.stockPrice;
  if (fmp.revenueHistory && fmp.revenueHistory.length >= 2) merged.revenueHistory = fmp.revenueHistory;
  if (Array.isArray(merged.keyMetrics)) {
    merged.keyMetrics = merged.keyMetrics.map((m: any) => {
      const label = m.label?.toLowerCase() ?? "";
      if (label.includes("gross margin") && fmp.grossMargin) return { ...m, value: fmp.grossMargin, verified: true };
      if (label.includes("operating margin") && fmp.operatingMargin) return { ...m, value: fmp.operatingMargin, verified: true };
      if ((label.includes("p/e") || label.includes("pe ratio")) && fmp.peRatio) return { ...m, value: fmp.peRatio, verified: true };
      if (label.includes("eps") && fmp.eps) return { ...m, value: fmp.eps, verified: true };
      return m;
    });
  }
  return merged;
}

// ─── Part A: overview + financials + strategy + market ────────────────────────
async function generatePartA(companyName: string, industry?: string, ticker?: string, currentCEO?: string): Promise<unknown> {
  const ceo = currentCEO ?? await lookupCEO(companyName);
  const tickerContext = ticker ? ` (Ticker: ${ticker})` : "";
  const industryContext = industry ? ` operating in the ${industry} sector` : "";

  const prompt = `Generate strategic intelligence PART A for: ${companyName}${tickerContext}${industryContext}

The current CEO is: ${ceo} — use this exact name in the executiveSummary.ceo field. Do NOT include the CEO again in keyExecutives.
For keyExecutives: include between 3 and 8 other senior leaders you are certain exist. STRICT RULES: real verified names only — never invent or guess.

CURRENCY RULE — MANDATORY: Use correct native currency symbol (£ UK, € Eurozone, $ US, ¥ Japan, CHF Switzerland). NEVER ISO codes.

FINANCIAL FIELDS — MANDATORY: Every field must have a value. Estimate if needed, suffix with " (est.)". revenueHistory MUST have EXACTLY 4 years. keyMetrics MUST include Gross Margin, Operating Margin, P/E Ratio, EPS.

Return ONLY this JSON:
{
  "companyName": "Official company name",
  "industry": "Primary industry sector",
  "website": "bare domain e.g. apple.com",
  "executiveSummary": {
    "companyOverview": "2-3 sentence overview",
    "headquarters": "City, Country",
    "founded": "Year",
    "employees": "e.g. 250,000",
    "ceo": "${ceo}",
    "keyExecutives": [{"name": "Name", "title": "Title"}],
    "stockExchange": "e.g. LSE: TSCO or N/A if private",
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3", "Highlight 4"],
    "analystRating": "e.g. Buy / Overweight / Hold",
    "lastUpdated": "dd/mm/yyyy"
  },
  "financials": {
    "revenue": "e.g. £68.5B",
    "revenueGrowth": "e.g. +8.1% YoY",
    "netIncome": "e.g. £2.4B",
    "ebitda": "e.g. £4.8B",
    "marketCap": "e.g. £42.5B",
    "stockTicker": "e.g. TSCO",
    "stockPrice": "e.g. £3.24",
    "fiscalYear": "e.g. FY2024",
    "keyMetrics": [
      {"label": "Gross Margin", "value": "28.1%", "trend": "up"},
      {"label": "Operating Margin", "value": "7.0%", "trend": "up"},
      {"label": "P/E Ratio", "value": "18.2x", "trend": "neutral"},
      {"label": "EPS", "value": "£0.24", "trend": "up"}
    ],
    "revenueHistory": [
      {"year": "2021", "revenue": "£X.XB", "growth": "+X%"},
      {"year": "2022", "revenue": "£X.XB", "growth": "+X%"},
      {"year": "2023", "revenue": "£X.XB", "growth": "+X%"},
      {"year": "2024", "revenue": "£X.XB", "growth": "+X%"}
    ],
    "outlook": "2-sentence financial outlook"
  },
  "strategy": {
    "vision": "Vision statement",
    "mission": "Mission statement",
    "coreInitiatives": [{"title": "Initiative", "description": "Brief description", "timeline": "e.g. 2024-2026"}],
    "geographicFocus": ["Region 1", "Region 2", "Region 3"],
    "mAndA": "M&A strategy",
    "capitalAllocation": "Capital allocation priorities",
    "summary": "2-3 sentence summary"
  },
  "marketAnalysis": {
    "totalAddressableMarket": "e.g. £1.1T",
    "marketShare": "e.g. 27%",
    "marketPosition": "e.g. Market leader",
    "competitors": [{"name": "Name", "strength": "Brief strength", "threat": "high|medium|low"}],
    "customerSegments": ["Segment 1", "Segment 2", "Segment 3"],
    "geographicPresence": [{"region": "Region", "percentage": "XX%"}],
    "marketTrends": ["Trend 1", "Trend 2", "Trend 3"],
    "summary": "2-3 sentence summary"
  }
}`;

  return callClaude(prompt, 3500);
}

// ─── Part B1: tech spend + ESG + SWOT (~1400 tokens output) ──────────────────
async function generatePartB1(companyName: string, industry?: string, ticker?: string): Promise<unknown> {
  const ctx = [ticker ? ` (Ticker: ${ticker})` : "", industry ? ` in the ${industry} sector` : ""].join("");
  const prompt = `Generate strategic intelligence for: ${companyName}${ctx}

CURRENCY RULE: Use native currency symbol (£ UK, € Eurozone, $ US, ¥ Japan, CHF Switzerland). NEVER ISO codes.

Return ONLY this JSON:
{
  "techSpend": {
    "annualITBudget": "e.g. £1.8B",
    "itBudgetAsPercentRevenue": "e.g. 4.8%",
    "cloudPlatforms": ["AWS", "Azure", "GCP"],
    "keyVendors": [{"vendor": "Name", "category": "Category", "relationship": "Description"}],
    "dataInfrastructure": "Description",
    "securityPosture": "Description",
    "emergingTech": ["AI/ML", "IoT"],
    "summary": "2-3 sentence summary"
  },
  "esg": {
    "overallRating": "e.g. AA (MSCI)",
    "netZeroTarget": "e.g. 2030",
    "environmentalInitiatives": ["Initiative 1", "Initiative 2"],
    "socialInitiatives": ["Initiative 1", "Initiative 2"],
    "governanceRating": "e.g. Strong",
    "boardDiversity": "e.g. 45%",
    "esgRisks": ["Risk 1", "Risk 2"],
    "summary": "2-3 sentence summary"
  },
  "swot": {
    "strengths": [{"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}],
    "weaknesses": [{"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}],
    "opportunities": [{"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}],
    "threats": [{"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}, {"title": "Title", "detail": "Explanation"}]
  }
}`;
  return callClaude(prompt, 2000);
}

// ─── Part B2: growth + risk + digital (~1400 tokens output) ──────────────────
async function generatePartB2(companyName: string, industry?: string, ticker?: string): Promise<unknown> {
  const ctx = [ticker ? ` (Ticker: ${ticker})` : "", industry ? ` in the ${industry} sector` : ""].join("");
  const prompt = `Generate strategic intelligence for: ${companyName}${ctx}

CURRENCY RULE: Use native currency symbol (£ UK, € Eurozone, $ US, ¥ Japan, CHF Switzerland). NEVER ISO codes.

Return ONLY this JSON:
{
  "growthOpportunities": {
    "opportunities": [
      {"title": "Title", "description": "Description", "potentialValue": "e.g. £5-10B", "timeframe": "e.g. 2025-2027", "confidence": "high|medium|low"}
    ],
    "totalOpportunityValue": "e.g. £20-40B",
    "summary": "2-3 sentence summary"
  },
  "riskAssessment": {
    "overallRiskLevel": "high|medium|low",
    "risks": [
      {"category": "e.g. Regulatory", "title": "Title", "description": "Description", "likelihood": "high|medium|low", "impact": "high|medium|low", "mitigation": "Strategy"}
    ],
    "summary": "2-3 sentence summary"
  },
  "digitalTransformation": {
    "maturityLevel": "leading|advanced|developing|early",
    "maturityScore": 8,
    "keyInitiatives": [{"title": "Initiative", "description": "Description", "status": "live|in_progress|planned"}],
    "aiAdoption": "Description",
    "dataStrategy": "Description",
    "challenges": ["Challenge 1", "Challenge 2"],
    "summary": "2-3 sentence summary"
  }
}`;
  return callClaude(prompt, 2000);
}

// ─── Public: generate full report ────────────────────────────────────────────
// Execution plan:
//   Stage 1 (parallel): CEO lookup + FMP fetch                    ~2-5s
//   Stage 2 (parallel): Part A + Part B1 + Part B2                ~25-35s each
//   Total target: ~35s
export async function generateReport(companyName: string, industry?: string, ticker?: string): Promise<any> {
  const start = Date.now();

  // Stage 1: fast lookups in parallel
  const [ceo, fmpData] = await Promise.all([
    lookupCEO(companyName),
    ticker ? fetchFMPFinancials(ticker) : Promise.resolve({} as FMPFinancials),
  ]);
  console.log(`  ✅ CEO="${ceo}" resolved in ${((Date.now()-start)/1000).toFixed(1)}s`);

  // Stage 2: all three generation calls fully in parallel
  const [partA, partB1, partB2] = await Promise.all([
    generatePartA(companyName, industry, ticker, ceo),
    generatePartB1(companyName, industry, ticker),
    generatePartB2(companyName, industry, ticker),
  ]);

  const mergedPartA = partA as any;
  if (mergedPartA.financials && Object.keys(fmpData).length > 0) {
    mergedPartA.financials = mergeFinancials(mergedPartA.financials, fmpData);
    mergedPartA.financials._fmpVerified = true;
  }

  console.log(
    `✅ Stellanor report generated in ${((Date.now() - start) / 1000).toFixed(1)}s` +
    `${Object.keys(fmpData).length > 0 ? " (FMP verified)" : " (AI estimates)"}`
  );

  return { ...mergedPartA, ...(partB1 as object), ...(partB2 as object) };
}

// ─── Sales Enablement ─────────────────────────────────────────────────────────
export async function generateSalesEnablement(companyName: string, reportData: unknown, sellerProduct: string): Promise<unknown> {
  const isStellanoSeller =
    !sellerProduct || sellerProduct.trim() === "" ||
    /stellanor/i.test(sellerProduct) ||
    /colocation|colo|data.?cent(er|re)|connectivity|rack.?space/i.test(sellerProduct);

  const sellerContext = isStellanoSeller
    ? `\n\nSELLER CONTEXT:\n${STELLANOR_SELLER_CONTEXT}\n\nThe seller is Stellanor Datacenters. Generate this brief specifically for a Stellanor account executive preparing to approach ${companyName}.`
    : `\n\nSeller's Product/Service: ${sellerProduct}`;

  const effectiveProduct = isStellanoSeller
    ? "Stellanor Datacenters — colocation, connectivity, and managed data centre services"
    : sellerProduct;

  const stellanorSpecificInstructions = isStellanoSeller ? `

STELLANOR-SPECIFIC INSTRUCTIONS:
- useCases must reference specific Stellanor services (colocation, IP transit, dark fibre, myStellanor portal, etc.)
- conversationStarters should open doors to data centre discussions (IT refresh cycles, DC costs, ESG commitments, AI workload hosting, latency requirements)
- painPoints must map target company's real operational/infrastructure challenges to specific Stellanor capabilities
- potentialSavings should reference the shift from CapEx (own DC) to OpEx (Stellanor colo), carrier neutrality savings, and sustainability cost avoidance
- competitivePositioning: identify likely incumbent providers (Equinix, CyrusOne, NTT, Virtus, Digital Realty, own-DC) and explain how Stellanor wins
- totalValueOpportunity: estimate in £ based on company size, likely rack count, and connectivity requirements
- nextSteps should include booking a site visit to London East or London North as an early action
- Recommend the most relevant Stellanor site(s) based on the company's HQ / geography
` : "";

  const prompt = `Generate a highly targeted sales enablement brief.

Target Company: ${companyName}
Seller: ${effectiveProduct}
${sellerContext}
${stellanorSpecificInstructions}
Company Intelligence:
${JSON.stringify(reportData, null, 2)}

Return ONLY this JSON:
{
  "sellerProduct": "${effectiveProduct}",
  "salesSummary": "3-4 sentence executive summary specific to this company's profile",
  "recommendedSites": ["e.g. London East (proximity to HQ)"],
  "conversationStarters": ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"],
  "painPoints": [
    {"pain": "Specific pain point", "solution": "Specific Stellanor capability"},
    {"pain": "Pain point 2", "solution": "Solution 2"},
    {"pain": "Pain point 3", "solution": "Solution 3"},
    {"pain": "Pain point 4", "solution": "Solution 4"}
  ],
  "useCases": [
    {"title": "Use case", "roi": "Quantified ROI in £", "description": "Specific application"},
    {"title": "Use case", "roi": "ROI estimate", "description": "Application"},
    {"title": "Use case", "roi": "ROI estimate", "description": "Application"}
  ],
  "totalValueOpportunity": "Estimated £ ACV range with rationale",
  "currentChallenges": ["Challenge 1", "Challenge 2", "Challenge 3", "Challenge 4"],
  "potentialSavings": [
    {"area": "CapEx elimination / DC refresh avoidance", "estimate": "e.g. £X-XM over 3 years"},
    {"area": "Carrier neutrality & connectivity", "estimate": "e.g. £X00K annually"},
    {"area": "ESG / sustainability reporting value", "estimate": "100% renewable energy"},
    {"area": "Operational efficiency via myStellanor", "estimate": "e.g. X% overhead reduction"}
  ],
  "competitivePositioning": "Why Stellanor wins vs likely incumbents",
  "nextSteps": [
    {"step": "1", "action": "Specific outreach action", "timeline": "This week"},
    {"step": "2", "action": "Book site tour of most relevant Stellanor facility", "timeline": "Week 1-2"},
    {"step": "3", "action": "Technical scoping call with Stellanor solutions team", "timeline": "Week 2-3"},
    {"step": "4", "action": "Tailored proposal with rack and connectivity options", "timeline": "Month 1"}
  ]
}`;

  return callClaude(prompt, 5000);
}

// ─── Investor Presentation ────────────────────────────────────────────────────
export async function generateInvestorPresentation(companyName: string, reportData: unknown): Promise<unknown> {
  const today = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);
  const lastQ = currentQ === 1 ? 4 : currentQ - 1;
  const lastQYear = currentQ === 1 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  const prompt = `Generate a structured investor presentation for ${companyName}.

Based on this data:
${JSON.stringify(reportData, null, 2)}

Return ONLY this JSON:
{
  "title": "${companyName}: Investment Analysis",
  "date": "dd/mm/yyyy",
  "analystCitations": [
    {
      "bank": "Bank name",
      "analyst": "Analyst name or null",
      "rating": "Buy|Overweight|Neutral|Underweight|Sell|Hold|Outperform|Market Perform",
      "priceTarget": "e.g. £4.20 or null for private",
      "note": "1 sentence specific thesis",
      "date": "Most recent quarter e.g. Q${lastQ} ${lastQYear}",
      "stale": false
    }
  ],
  "analystConsensus": {
    "overallRating": "e.g. Buy",
    "averagePriceTarget": "e.g. £3.95",
    "numAnalysts": "e.g. 24 analysts covering",
    "bullCase": "1 sentence bull case",
    "bearCase": "1 sentence bear case"
  },
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "type": "cover|executive_summary|financials|market|strategy|swot|growth|risk|analyst_consensus|conclusion",
      "headline": "Key message",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "metric": {"label": "Key metric", "value": "Value"}
    }
  ],
  "disclaimer": "Standard investment disclaimer"
}

ANALYST CITATION RULES:
TODAY: ${today}. SIX MONTHS AGO: ${sixMonthsAgo}. LAST QUARTER: Q${lastQ} ${lastQYear}.

STEP 1 — QUANTITY: Provide 8-12 citations for public companies, 4-6 for private. Banks to consider:
Bulge bracket: JP Morgan, Goldman Sachs, Morgan Stanley, Barclays, Deutsche Bank, UBS, Citi, HSBC, BofA Securities
Mid-tier: Jefferies, Wolfe Research, RBC Capital Markets, Raymond James, Piper Sandler, Evercore ISI, TD Cowen
UK/EU specialists: Berenberg, Numis, Peel Hunt, Panmure Gordon, Investec, Shore Capital, Liberum, Stifel

STEP 2 — INCLUDE if you have ANY knowledge of coverage. Estimated date beats omission.
STEP 3 — DATE: Use most recent known rating. If uncertain, estimate Q${lastQ} ${lastQYear}. Mark stale: true if >6 months old.
STEP 4 — QUALITY: Specific thesis per company, not generic. Correct currency symbol.

Include an Analyst Consensus slide. Include 11-13 slides total.`;

  return callClaude(prompt, 10000);
}
