import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-haiku-4-5-20251001";
const MODEL_FAST = "claude-haiku-4-5-20251001";

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
// Grounded in: company overview doc, London East/North datasheets, Oct 2025 press release.
// Injected into sales enablement prompts so the AI understands who Stellanor is,
// what they sell, and how to position against the target company's specific profile.
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
  if (/sweden/.test(h)) return "kr";
  if (/norway/.test(h)) return "kr";
  if (/denmark/.test(h)) return "kr";
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
      profileRes.json(),
      incomeRes.json(),
      ratiosRes.json(),
    ]);

    const p = Array.isArray(profile) ? profile[0] : null;
    const r = Array.isArray(ratios) ? ratios[0] : null;
    const incomeList = Array.isArray(income) ? income : [];

    const fmpCurrency: string = p?.currency ?? "USD";
    const hqCountry: string = p?.country ?? "";
    const sym = hqCountry ? currencySymbol(hqCountry) : fmpCurrencyToSymbol(fmpCurrency);

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

function fmpCurrencyToSymbol(code: string): string {
  const map: Record<string, string> = {
    GBP: "£", EUR: "€", USD: "$", JPY: "¥", CHF: "CHF ",
    CAD: "C$", AUD: "A$", SEK: "kr", NOK: "kr", DKK: "kr",
    INR: "₹", CNY: "¥", BRL: "R$",
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
      if (label.includes("gross margin") && fmp.grossMargin) return { ...m, value: fmp.grossMargin, verified: true };
      if (label.includes("operating margin") && fmp.operatingMargin) return { ...m, value: fmp.operatingMargin, verified: true };
      if ((label.includes("p/e") || label.includes("pe ratio")) && fmp.peRatio) return { ...m, value: fmp.peRatio, verified: true };
      if (label.includes("eps") && fmp.eps) return { ...m, value: fmp.eps, verified: true };
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
    `✅ Stellanor report generated in ${((Date.now() - start) / 1000).toFixed(1)}s` +
    `${Object.keys(fmpData).length > 0 ? " (FMP verified)" : " (AI estimates)"}`
  );

  return { ...mergedPartA, ...(partB as object) };
}

// ─── Sales Enablement ─────────────────────────────────────────────────────────
// When sellerProduct is empty/default, Stellanor's own colocation & connectivity
// services are used automatically. The STELLANOR_SELLER_CONTEXT block grounds
// the AI in real product facts — no hallucinated services or pricing.
export async function generateSalesEnablement(
  companyName: string,
  reportData: unknown,
  sellerProduct: string
): Promise<unknown> {
  // Determine if this is a Stellanor-as-seller brief or a generic one
  const isStellanoSeller =
    !sellerProduct ||
    sellerProduct.trim() === "" ||
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
- competitivePositioning: identify likely incumbent providers (Equinix, CyrusOne, NTT, Virtus, Digital Realty, own-DC) and explain how Stellanor wins — proximity, personalised service, 100% renewables, Tier 3+, no lock-in
- totalValueOpportunity: estimate in £ based on company size, likely rack count, and connectivity requirements
- nextSteps should include booking a site visit to London East or London North as an early action
- Recommend the most relevant Stellanor site(s) based on the company's HQ / geography
` : "";

  const prompt = `Generate a highly targeted sales enablement brief.

Target Company: ${companyName}
Seller: ${effectiveProduct}
${sellerContext}
${stellanorSpecificInstructions}
Company Intelligence (use this to personalise every section):
${JSON.stringify(reportData, null, 2)}

Return ONLY this JSON:
{
  "sellerProduct": "${effectiveProduct}",
  "salesSummary": "3-4 sentence executive summary of the sales opportunity — specific to this company's profile, size, industry, and infrastructure signals",
  "recommendedSites": ["e.g. London East (proximity to HQ), London North (scale)"],
  "conversationStarters": [
    "Specific, insight-led question referencing something real from the company intelligence",
    "Question about their current DC strategy or IT refresh cycle",
    "Question linking their AI/digital initiatives to infrastructure needs",
    "Question about their ESG commitments and how their DC estate contributes",
    "Question about carrier or cloud provider flexibility"
  ],
  "painPoints": [
    {"pain": "Specific infrastructure or operational pain derived from the company intelligence", "solution": "Specific Stellanor capability that addresses it directly"},
    {"pain": "Pain point 2", "solution": "Stellanor solution 2"},
    {"pain": "Pain point 3", "solution": "Stellanor solution 3"},
    {"pain": "Pain point 4", "solution": "Stellanor solution 4"}
  ],
  "useCases": [
    {"title": "Use case title", "roi": "Quantified ROI or saving estimate in £", "description": "How this Stellanor service applies specifically to this company"},
    {"title": "Use case title", "roi": "Quantified ROI estimate", "description": "Specific application"},
    {"title": "Use case title", "roi": "Quantified ROI estimate", "description": "Specific application"}
  ],
  "totalValueOpportunity": "Estimated £ ACV range based on company size and likely rack/connectivity requirements — with brief rationale",
  "currentChallenges": [
    "Infrastructure challenge specific to this company or industry",
    "Cost or ESG pressure inferred from the intelligence",
    "Connectivity or latency requirement",
    "AI / digital transformation infrastructure need"
  ],
  "potentialSavings": [
    {"area": "CapEx elimination / DC refresh avoidance", "estimate": "e.g. £X-XM over 3 years vs own-DC refresh"},
    {"area": "Carrier neutrality & connectivity optimisation", "estimate": "e.g. £X00K annually"},
    {"area": "ESG / sustainability reporting value", "estimate": "e.g. 100% renewable energy supporting net-zero commitments"},
    {"area": "Operational efficiency via myStellanor portal", "estimate": "e.g. X% reduction in DC management overhead"}
  ],
  "competitivePositioning": "Identify likely incumbent or competing providers (own-DC, Equinix, Digital Realty, CyrusOne, NTT, Virtus, hyperscalers) and articulate specifically why Stellanor wins — city-edge proximity, personalised service, 100% renewables, Tier 3+, carrier neutral, predictable opex",
  "nextSteps": [
    {"step": "1", "action": "Specific first outreach action referencing something from the intelligence", "timeline": "This week"},
    {"step": "2", "action": "Book a no-obligation site tour of the most relevant Stellanor facility", "timeline": "Week 1-2"},
    {"step": "3", "action": "Arrange a technical scoping call with Stellanor's solutions team", "timeline": "Week 2-3"},
    {"step": "4", "action": "Deliver a tailored proposal with rack configuration and connectivity options", "timeline": "Month 1"}
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
