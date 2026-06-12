import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-haiku-4-5-20251001";
const MODEL_FAST = "claude-haiku-4-5-20251001";

const SYSTEM = `You are an elite strategic intelligence analyst.
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

// ─── Currency helper ──────────────────────────────────────────────────────────
// Maps a headquarters country/region to its native currency symbol.
function currencySymbol(hq: string): string {
  const h = hq.toLowerCase();
  if (/uk|united kingdom|england|scotland|wales|britain/.test(h)) return "£";
  if (/germany|france|italy|spain|netherlands|belgium|austria|finland|ireland|portugal|greece|luxembourg/.test(h)) return "€";
  if (/japan/.test(h)) return "¥";
  if (/switzerland/.test(h)) return "CHF ";
  if (/canada/.test(h)) return "C$";
  if (/australia/.test(h)) return "A$";
  if (/sweden/.test(h)) return "kr";
  if (/norway/.test(h)) return "kr";
  if (/denmark/.test(h)) return "kr";
  if (/china/.test(h)) return "¥";
  if (/india/.test(h)) return "₹";
  if (/brazil/.test(h)) return "R$";
  // Default: USD
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
  currency?: string; // e.g. "GBP", "USD", "EUR"
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
      profileRes.json(),
      incomeRes.json(),
      ratiosRes.json(),
    ]);

    const p = Array.isArray(profile) ? profile[0] : null;
    const r = Array.isArray(ratios) ? ratios[0] : null;
    const incomeList = Array.isArray(income) ? income : [];

    // Determine currency symbol from FMP profile currency field
    const fmpCurrency: string = p?.currency ?? "USD";
    const hqCountry: string = p?.country ?? "";
    // Prefer HQ-based symbol detection; fall back to FMP currency code mapping
    const sym = hqCountry
      ? currencySymbol(hqCountry)
      : fmpCurrencyToSymbol(fmpCurrency);

    // Format large numbers with the correct currency symbol
    const fmt = (n: number | undefined): string | undefined => {
      if (n == null || isNaN(n)) return undefined;
      if (Math.abs(n) >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
      if (Math.abs(n) >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
      if (Math.abs(n) >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
      return `${sym}${n.toFixed(2)}`;
    };

    const fmtPct = (n: number | undefined): string | undefined => {
      if (n == null || isNaN(n)) return undefined;
      return `${(n * 100).toFixed(1)}%`;
    };

    // Build revenue history from income statements
    const revenueHistory = incomeList
      .slice(0, 4)
      .reverse()
      .map((y: any, idx: number, arr: any[]) => {
        const rev = y.revenue as number;
        const prevRev = idx > 0 ? (arr[idx - 1].revenue as number) : null;
        const growth =
          prevRev && prevRev > 0
            ? `${(((rev - prevRev) / prevRev) * 100).toFixed(1)}%`
            : "N/A";
        return {
          year: String(y.calendarYear || y.date?.slice(0, 4) || ""),
          revenue: fmt(rev) ?? "N/A",
          growth,
        };
      });

    return {
      marketCap: fmt(p?.mktCap),
      ebitda: fmt(incomeList[0]?.ebitda),
      grossMargin: fmtPct(r?.grossProfitMarginTTM),
      operatingMargin: fmtPct(r?.operatingProfitMarginTTM),
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

// Maps FMP ISO currency codes to display symbols (fallback when no HQ country)
function fmpCurrencyToSymbol(code: string): string {
  const map: Record<string, string> = {
    GBP: "£",
    EUR: "€",
    USD: "$",
    JPY: "¥",
    CHF: "CHF ",
    CAD: "C$",
    AUD: "A$",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    INR: "₹",
    CNY: "¥",
    BRL: "R$",
  };
  return map[code.toUpperCase()] ?? "$";
}

// ─── CEO lookup via web search ────────────────────────────────────────────────
async function lookupCEO(companyName: string): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL_GROUNDED,
      max_tokens: 200,
      system:
        "You are a factual lookup assistant. Respond with ONLY the current CEO's full name — no punctuation, no explanation, nothing else.",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: `Who is the current CEO of ${companyName}? Search the web and return only their full name.`,
        },
      ],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, "")
      .trim();

    if (text && text.length < 80 && !text.includes("{") && !text.includes("\n")) {
      return text;
    }
  } catch (err) {
    console.warn(`CEO lookup failed for ${companyName}:`, err);
  }
  return "See company website for current CEO";
}

// ─── Fast caller (Haiku, no tools) ───────────────────────────────────────────
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

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  if (!text) throw new Error("Empty response from Claude API");

  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/\n?```/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("JSON parse failed. Raw:", cleaned.slice(0, 500));
    throw new Error("Failed to parse API response. Please try again.");
  }
}

// ─── Merge FMP data into Claude financials ────────────────────────────────────
function mergeFinancials(claudeFinancials: any, fmp: FMPFinancials): any {
  const merged = { ...claudeFinancials };

  if (fmp.marketCap) merged.marketCap = fmp.marketCap;
  if (fmp.ebitda) merged.ebitda = fmp.ebitda;
  if (fmp.stockPrice) merged.stockPrice = fmp.stockPrice;
  if (fmp.revenueHistory && fmp.revenueHistory.length >= 2) {
    merged.revenueHistory = fmp.revenueHistory;
  }

  if (Array.isArray(merged.keyMetrics)) {
    merged.keyMetrics = merged.keyMetrics.map((m: any) => {
      const label = m.label?.toLowerCase() ?? "";
      if (label.includes("gross margin") && fmp.grossMargin) {
        return { ...m, value: fmp.grossMargin, verified: true };
      }
      if (label.includes("operating margin") && fmp.operatingMargin) {
        return { ...m, value: fmp.operatingMargin, verified: true };
      }
      if ((label.includes("p/e") || label.includes("pe ratio")) && fmp.peRatio) {
        return { ...m, value: fmp.peRatio, verified: true };
      }
      if (label.includes("eps") && fmp.eps) {
        return { ...m, value: fmp.eps, verified: true };
      }
      return m;
    });
  }

  return merged;
}

// ─── Report Part A: overview + financials + strategy + market ─────────────────
async function generatePartA(
  companyName: string,
  industry?: string,
  ticker?: string
): Promise<unknown> {
  const currentCEO = await lookupCEO(companyName);

  const tickerContext = ticker ? ` (Ticker: ${ticker})` : "";
  const industryContext = industry ? ` operating in the ${industry} sector` : "";

  const prompt = `Generate strategic intelligence PART A for: ${companyName}${tickerContext}${industryContext}

The current CEO is: ${currentCEO} — use this exact name in the executiveSummary.ceo field. Do NOT include the CEO again in keyExecutives.
For keyExecutives: include between 3 and 8 other senior leaders you are certain exist (CFO, COO, CTO, division presidents, etc). STRICT RULES: real verified names only — if uncertain about a person, omit them entirely. Never invent, guess, or recombine names. Quality over quantity.

CURRENCY RULE — MANDATORY:
Identify the company's headquarters country and use the correct native currency symbol throughout ALL financial fields.
- UK company → use £ for ALL values (e.g. £68.5B, £2.4B, £225.00)
- Eurozone company → use € for ALL values (e.g. €142.0B, €8.5B)
- US company → use $ for ALL values (e.g. $391.0B, $93.7B)
- Japanese company → use ¥ for ALL values (e.g. ¥10.0T, ¥500B)
- Swiss company → use CHF for ALL values (e.g. CHF 94.0B)
NEVER write "GBP", "USD", "EUR", "JPY" — always the symbol.

FINANCIAL FIELDS — MANDATORY RULES:
- Every field MUST have a real value. NEVER use "—", null, or "N/A".
- revenue, netIncome, ebitda, marketCap are ALL required — provide estimates if needed, suffix with " (est.)"
- revenueHistory MUST contain EXACTLY 4 consecutive years ending with the most recent fiscal year.
- keyMetrics MUST include Gross Margin, Operating Margin, P/E Ratio, and EPS — all 4 required.
- stockPrice and stockTicker are required for public companies.

Return ONLY this JSON (use correct currency symbol throughout, NOT ISO codes):
{
  "companyName": "Official company name",
  "industry": "Primary industry sector",
  "executiveSummary": {
    "companyOverview": "2-3 sentence overview",
    "headquarters": "City, Country",
    "founded": "Year",
    "employees": "e.g. 250,000",
    "ceo": "${currentCEO}",
    "keyExecutives": [{"name": "Name", "title": "Title"}],
    "stockExchange": "e.g. LSE: TSCO or N/A if private",
    "highlights": ["Key highlight 1", "Key highlight 2", "Key highlight 3", "Key highlight 4"],
    "analystRating": "e.g. Buy / Overweight / Hold",
    "lastUpdated": "Today dd/mm/yyyy"
  },
  "financials": {
    "revenue": "e.g. £68.5B for UK, €142.0B for Germany, $391.0B for US",
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
    "vision": "Company vision statement",
    "mission": "Company mission statement",
    "coreInitiatives": [{"title": "Initiative name", "description": "Brief description", "timeline": "e.g. 2024-2026"}],
    "geographicFocus": ["Region 1", "Region 2", "Region 3"],
    "mAndA": "M&A strategy description",
    "capitalAllocation": "Capital allocation priorities",
    "summary": "2-3 sentence strategy summary"
  },
  "marketAnalysis": {
    "totalAddressableMarket": "e.g. £1.1T",
    "marketShare": "e.g. 27%",
    "marketPosition": "e.g. Market leader / Strong #2",
    "competitors": [{"name": "Competitor name", "strength": "Brief strength", "threat": "high|medium|low"}],
    "customerSegments": ["Segment 1", "Segment 2", "Segment 3"],
    "geographicPresence": [
      {"region": "UK & Ireland", "percentage": "XX%"},
      {"region": "Europe", "percentage": "XX%"},
      {"region": "APAC", "percentage": "XX%"}
    ],
    "marketTrends": ["Trend 1", "Trend 2", "Trend 3"],
    "summary": "2-3 sentence market position summary"
  }
}`;

  return callClaude(prompt, 5000);
}

// ─── Report Part B: tech + ESG + SWOT + growth + risk + digital ──────────────
async function generatePartB(
  companyName: string,
  industry?: string,
  ticker?: string
): Promise<unknown> {
  const tickerContext = ticker ? ` (Ticker: ${ticker})` : "";
  const industryContext = industry ? ` operating in the ${industry} sector` : "";

  const prompt = `Generate strategic intelligence PART B for: ${companyName}${tickerContext}${industryContext}

CURRENCY RULE: Use the native currency symbol of the company's headquarters country throughout (£ for UK, € for Eurozone, $ for US, ¥ for Japan, CHF for Switzerland). NEVER use ISO codes like GBP, USD, EUR.

Return ONLY this JSON:
{
  "techSpend": {
    "annualITBudget": "e.g. £1.8B for UK company",
    "itBudgetAsPercentRevenue": "e.g. 4.8%",
    "cloudPlatforms": ["AWS", "Azure", "GCP"],
    "keyVendors": [{"vendor": "Vendor name", "category": "Category", "relationship": "Strategic partner / key vendor / etc"}],
    "dataInfrastructure": "Description of data infrastructure",
    "securityPosture": "Description of security approach",
    "emergingTech": ["AI/ML", "Blockchain", "IoT"],
    "summary": "2-3 sentence tech summary"
  },
  "esg": {
    "overallRating": "e.g. AA (MSCI) / Strong",
    "netZeroTarget": "e.g. 2030 / 2050 / Not committed",
    "environmentalInitiatives": ["Initiative 1", "Initiative 2"],
    "socialInitiatives": ["Initiative 1", "Initiative 2"],
    "governanceRating": "e.g. Strong / Average",
    "boardDiversity": "e.g. 45% diverse board members",
    "esgRisks": ["Risk 1", "Risk 2"],
    "summary": "2-3 sentence ESG summary"
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
        "potentialValue": "e.g. £5-10B",
        "timeframe": "e.g. 2025-2027",
        "confidence": "high|medium|low"
      }
    ],
    "totalOpportunityValue": "e.g. £20-40B across identified opportunities",
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
    "aiAdoption": "Description of AI adoption",
    "dataStrategy": "Description of data strategy",
    "challenges": ["Challenge 1", "Challenge 2"],
    "summary": "2-3 sentence DX summary"
  }
}`;

  return callClaude(prompt, 5000);
}

// ─── Public: generate full report ─────────────────────────────────────────────
export async function generateReport(
  companyName: string,
  industry?: string,
  ticker?: string
): Promise<any> {
  const start = Date.now();

  const [partA, partBAndFMP] = await Promise.all([
    generatePartA(companyName, industry, ticker),
    Promise.all([
      generatePartB(companyName, industry, ticker),
      ticker ? fetchFMPFinancials(ticker) : Promise.resolve({} as FMPFinancials),
    ]),
  ]);

  const [partB, fmpData] = partBAndFMP;

  const mergedPartA = partA as any;
  if (mergedPartA.financials && Object.keys(fmpData).length > 0) {
    mergedPartA.financials = mergeFinancials(mergedPartA.financials, fmpData);
    mergedPartA.financials._fmpVerified = true;
  }

  console.log(
    `✅ Report generated in ${((Date.now() - start) / 1000).toFixed(1)}s` +
    `${Object.keys(fmpData).length > 0 ? " (FMP verified)" : " (AI estimates)"}`
  );

  return { ...mergedPartA, ...(partB as object) };
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
  "totalValueOpportunity": "e.g. £2-5M ACV based on company profile",
  "currentChallenges": ["Challenge 1", "Challenge 2", "Challenge 3", "Challenge 4"],
  "potentialSavings": [
    {"area": "Area name", "estimate": "e.g. £500K-1M annually"},
    {"area": "Area name", "estimate": "e.g. £200K annually"},
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