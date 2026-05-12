import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-haiku-4-5-20251001";
const MODEL_FAST     = "claude-haiku-4-5-20251001";

// ─── Alpha Vantage ────────────────────────────────────────────────────────────
const AV_KEY  = process.env.ALPHA_VANTAGE_API_KEY ?? "";
const AV_BASE = "https://www.alphavantage.co/query";

export interface AVFinancials {
  ticker:          string;
  fiscalYear:      string;
  revenue:         string;
  revenueGrowth:   string;
  netIncome:       string;
  ebitda:          string;
  marketCap:       string;
  stockPrice:      string;
  peRatio:         string;
  epsAnnual:       string;
  grossMargin:     string;
  operatingMargin: string;
  analystTarget:   string;
  analystRating:   string;
  revenueHistory:  { year: string; revenue: string; growth: string }[];
}

// ─── Alpha Vantage: resolve company name → best-match ticker ──────────────────

async function resolveTickerSymbol(companyName: string): Promise<string | null> {
  if (!AV_KEY) {
    console.warn("ALPHA_VANTAGE_API_KEY not set — skipping AV lookup");
    return null;
  }
  try {
    const url  = `${AV_BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(companyName)}&apikey=${AV_KEY}`;
    const res  = await fetch(url);
    const data = await res.json() as {
      bestMatches?: { "1. symbol": string; "3. type": string; "4. region": string }[];
    };

    if (!data.bestMatches?.length) return null;

    // Prefer US equity — first matching entry wins
    const equity = data.bestMatches.find(
      m => m["3. type"] === "Equity" && m["4. region"] === "United States"
    ) ?? data.bestMatches[0];

    const ticker = equity["1. symbol"];
    console.log(`📈 Resolved "${companyName}" → ${ticker}`);
    return ticker;
  } catch (err) {
    console.warn(`Ticker resolution failed for "${companyName}":`, err);
    return null;
  }
}

// ─── Alpha Vantage: fetch OVERVIEW + INCOME_STATEMENT in parallel ─────────────

async function fetchAVFinancials(ticker: string): Promise<AVFinancials | null> {
  if (!AV_KEY) return null;
  try {
    const [ovRes, incRes] = await Promise.all([
      fetch(`${AV_BASE}?function=OVERVIEW&symbol=${ticker}&apikey=${AV_KEY}`),
      fetch(`${AV_BASE}?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${AV_KEY}`),
    ]);

    const ov  = await ovRes.json()  as Record<string, string>;
    const inc = await incRes.json() as { annualReports?: Record<string, string>[] };

    // AV returns {"Note":"..."} or {"Information":"..."} on rate-limit / bad key
    if (ov["Note"] || ov["Information"] || !ov["Symbol"]) {
      console.warn(`AV OVERVIEW unavailable for ${ticker}:`, ov["Note"] ?? ov["Information"]);
      return null;
    }

    const reports = inc.annualReports ?? [];

    // ── Format raw number strings → readable "$X.XB / $X.XM" ────────────────
    const fmt = (raw: string | undefined): string => {
      const n = parseFloat(raw ?? "");
      if (isNaN(n)) return "N/A";
      if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
      if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
      if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
      return `$${n.toLocaleString()}`;
    };

    const fmtPct = (raw: string | undefined): string => {
      const n = parseFloat(raw ?? "");
      return isNaN(n) ? "N/A" : `${(n * 100).toFixed(1)}%`;
    };

    const fmtPE = (raw: string | undefined): string => {
      const n = parseFloat(raw ?? "");
      return isNaN(n) ? "N/A" : `${n.toFixed(1)}x`;
    };

    // ── Revenue history — most recent 4 years, returned chronologically ───────
    const revenueHistory = reports.slice(0, 4).map((r, i) => {
      const year    = r["fiscalDateEnding"]?.slice(0, 4) ?? "N/A";
      const rev     = parseFloat(r["totalRevenue"] ?? "");
      const prevRev = parseFloat(reports[i + 1]?.["totalRevenue"] ?? "");
      const growth  = (!isNaN(rev) && !isNaN(prevRev) && prevRev !== 0)
        ? `${rev > prevRev ? "+" : ""}${(((rev - prevRev) / prevRev) * 100).toFixed(1)}%`
        : "N/A";
      return { year, revenue: fmt(r["totalRevenue"]), growth };
    }).reverse();

    // ── YoY revenue growth (latest vs prior year) ────────────────────────────
    const latestRev = parseFloat(reports[0]?.["totalRevenue"] ?? "");
    const priorRev  = parseFloat(reports[1]?.["totalRevenue"] ?? "");
    const yoyGrowth = (!isNaN(latestRev) && !isNaN(priorRev) && priorRev !== 0)
      ? `${latestRev > priorRev ? "+" : ""}${(((latestRev - priorRev) / priorRev) * 100).toFixed(1)}% YoY`
      : "N/A";

    // ── Fiscal year label ────────────────────────────────────────────────────
    const fiscalYear = reports[0]?.["fiscalDateEnding"]
      ? `FY${reports[0]["fiscalDateEnding"].slice(0, 4)}`
      : `FY${ov["LatestQuarter"]?.slice(0, 4) ?? new Date().getFullYear()}`;

    // ── Analyst rating summary ────────────────────────────────────────────────
    const sb    = parseInt(ov["AnalystRatingStrongBuy"]  ?? "0");
    const b     = parseInt(ov["AnalystRatingBuy"]        ?? "0");
    const h     = parseInt(ov["AnalystRatingHold"]       ?? "0");
    const s     = parseInt(ov["AnalystRatingSell"]       ?? "0")
                + parseInt(ov["AnalystRatingStrongSell"] ?? "0");
    const total = sb + b + h + s;
    const analystRating = total > 0
      ? (() => {
          const bullPct = ((sb + b) / total) * 100;
          if (bullPct >= 70) return `Buy (${Math.round(bullPct)}% bullish, ${total} analysts)`;
          if (bullPct >= 50) return `Hold/Buy (${Math.round(bullPct)}% bullish, ${total} analysts)`;
          return `Hold (${Math.round(bullPct)}% bullish, ${total} analysts)`;
        })()
      : "N/A";

    // ── Gross margin derived from TTM figures ─────────────────────────────────
    const grossProfitTTM = parseFloat(ov["GrossProfitTTM"] ?? "");
    const revenueTTM     = parseFloat(ov["RevenueTTM"]     ?? "");
    const grossMarginRaw = (!isNaN(grossProfitTTM) && !isNaN(revenueTTM) && revenueTTM !== 0)
      ? String(grossProfitTTM / revenueTTM)
      : ov["ProfitMargin"];

    return {
      ticker,
      fiscalYear,
      revenue:         fmt(reports[0]?.["totalRevenue"]),
      revenueGrowth:   yoyGrowth,
      netIncome:       fmt(reports[0]?.["netIncome"]),
      ebitda:          fmt(reports[0]?.["ebitda"]),
      marketCap:       fmt(ov["MarketCapitalization"]),
      stockPrice:      ov["50DayMovingAverage"]
                         ? `$${parseFloat(ov["50DayMovingAverage"]).toFixed(2)}`
                         : "N/A",
      peRatio:         fmtPE(ov["PERatio"]),
      epsAnnual:       ov["EPS"] ? `$${parseFloat(ov["EPS"]).toFixed(2)}` : "N/A",
      grossMargin:     fmtPct(grossMarginRaw),
      operatingMargin: fmtPct(ov["OperatingMarginTTM"]),
      analystTarget:   ov["AnalystTargetPrice"]
                         ? `$${parseFloat(ov["AnalystTargetPrice"]).toFixed(2)}`
                         : "N/A",
      analystRating,
      revenueHistory,
    };
  } catch (err) {
    console.warn(`AV financials fetch failed for ${ticker}:`, err);
    return null;
  }
}

// ─── Public: resolve ticker + fetch financials ────────────────────────────────

export async function lookupFinancials(companyName: string): Promise<AVFinancials | null> {
  const ticker = await resolveTickerSymbol(companyName);
  if (!ticker) return null;
  return fetchAVFinancials(ticker);
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

async function generatePartA(companyName: string): Promise<unknown> {
  // CEO lookup (web search) and AV financials are both external calls —
  // run in parallel since neither touches the Anthropic token bucket.
  const [currentCEO, avData] = await Promise.all([
    lookupCEO(companyName),
    lookupFinancials(companyName),
  ]);

  // Build verified financial injection block
  const finBlock = avData
    ? `VERIFIED FINANCIAL DATA (Alpha Vantage — use verbatim, do not alter):
- Ticker:               ${avData.ticker}
- Fiscal Year:          ${avData.fiscalYear}
- Revenue:              ${avData.revenue}
- Revenue Growth (YoY): ${avData.revenueGrowth}
- Net Income:           ${avData.netIncome}
- EBITDA:               ${avData.ebitda}
- Market Cap:           ${avData.marketCap}
- Stock Price (50d MA): ${avData.stockPrice}
- P/E Ratio:            ${avData.peRatio}
- EPS (Annual):         ${avData.epsAnnual}
- Gross Margin:         ${avData.grossMargin}
- Operating Margin:     ${avData.operatingMargin}
- Analyst Target Price: ${avData.analystTarget}
- Analyst Rating:       ${avData.analystRating}
- Revenue History (chronological):
${avData.revenueHistory.map(r => `  ${r.year}: ${r.revenue} (${r.growth})`).join("\n")}

Use ALL of the above values verbatim in the financials object. Do not substitute your own estimates for any field that has been provided above.`
    : `No verified financial data available (private or unlisted company). Use best estimates from training data where confident; return null for any value you cannot verify.`;

  const prompt = `Generate strategic intelligence PART A for: ${companyName}

EXECUTIVE INSTRUCTIONS
- Set executiveSummary.ceo to exactly: ${currentCEO}
- Do NOT include the CEO in keyExecutives.
- keyExecutives: 3–8 other verified senior leaders (CFO, COO, CTO, division presidents). Real names only. Omit anyone you cannot verify. Never invent or recombine names.

${finBlock}

Return ONLY this JSON:
{
  "companyName": "Official company name",
  "industry": "Primary industry sector",
  "executiveSummary": {
    "companyOverview": "2-3 sentence overview",
    "headquarters": "City, Country",
    "founded": "Year or null",
    "employees": "e.g. 250,000 or null",
    "ceo": "Full name",
    "keyExecutives": [{"name": "Name", "title": "Title"}, {"name": "Name", "title": "Title"}, {"name": "Name", "title": "Title"}],
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
    "vision": "Company vision statement or null",
    "mission": "Company mission statement or null",
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

  return callClaude(prompt, 5000);
}

// ─── Report Part B: tech + ESG + SWOT + growth + risk + digital ──────────────

async function generatePartB(companyName: string): Promise<unknown> {
  const prompt = `Generate strategic intelligence PART B for: ${companyName}

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
    "overallRating": "e.g. AA (MSCI) / Strong or null",
    "netZeroTarget": "e.g. 2030 / 2050 / Not committed or null",
    "environmentalInitiatives": ["Initiative 1", "Initiative 2"],
    "socialInitiatives": ["Initiative 1", "Initiative 2"],
    "governanceRating": "e.g. Strong / Average or null",
    "boardDiversity": "e.g. 45% diverse board members or null",
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

  return callClaude(prompt, 5000);
}

// ─── Public: generate full report ─────────────────────────────────────────────

export async function generateReport(companyName: string): Promise<unknown> {
  const start = Date.now();

  // Part A pre-fetches CEO (web search) + AV financials in parallel before
  // calling Haiku. Part B runs sequentially after to respect token rate limits.
  const partA = await generatePartA(companyName);
  const partB = await generatePartB(companyName);

  console.log(`✅ Report generated in ${((Date.now() - start) / 1000).toFixed(1)}s (AV + CEO + Haiku x2)`);

  return { ...(partA as object), ...(partB as object) };
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