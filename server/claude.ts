import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Models ───────────────────────────────────────────────────────────────────
const MODEL_GROUNDED = "claude-sonnet-4-20250514"; // web search needs Sonnet
const MODEL_FAST = "claude-haiku-4-5-20251001";    // Part B — no factual recall needed

const SYSTEM = `You are an elite strategic intelligence analyst.
Respond with ONLY valid JSON — no prose, no markdown fences, no explanation.
Use real accurate data for well-known companies. Estimates for smaller ones.
CRITICAL: For CEO and key executives, only provide names you are highly confident are currently accurate.
If uncertain about the current CEO, set "ceo" to "See company website for current CEO".
Never confuse executives across different companies.
All currency in USD unless the company primarily operates in another currency.
Dates in dd/mm/yyyy format.
Be concise — keep string values short (1-2 sentences max), keep arrays to 3-5 items max.`;

// ─── Grounded caller (Sonnet + web search) — used for Part A ─────────────────

async function callClaudeGrounded(prompt: string, maxTokens: number): Promise<unknown> {
  const message = await client.messages.create({
    model: MODEL_GROUNDED,
    max_tokens: maxTokens,
    system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: prompt }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("Response was too long and got cut off. Please try again.");
  }

  // Extract text blocks only — web search adds tool_use/tool_result blocks too
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");

  if (!text) throw new Error("Empty response from Claude API");

  // Sonnet with web search injects <cite index="...">...</cite> tags into its output.
  // Strip them so the raw name/value lands in the JSON, not the markup.
  const stripped = text.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, "$1");

  const cleaned = stripped.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("JSON parse failed. Raw:", cleaned.slice(0, 500));
    throw new Error("Failed to parse API response. Please try again.");
  }
}

// ─── Fast caller (Haiku, no tools) — used for Part B ─────────────────────────

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
  const prompt = `Generate strategic intelligence PART A for: ${companyName}

Search the web for the current CEO, key executives, and recent financial data before responding.

Return ONLY this JSON:
{
  "companyName": "Official company name",
  "industry": "Primary industry sector",
  "executiveSummary": {
    "companyOverview": "2-3 sentence overview",
    "headquarters": "City, Country",
    "founded": "Year",
    "employees": "e.g. 250,000",
    "ceo": "Full name",
    "keyExecutives": [{"name": "Name", "title": "Title"}],
    "stockExchange": "e.g. NYSE: AAPL or N/A if private",
    "highlights": ["Key highlight 1", "Key highlight 2", "Key highlight 3", "Key highlight 4"],
    "analystRating": "e.g. Buy / Overweight / Hold",
    "lastUpdated": "Today dd/mm/yyyy"
  },
  "financials": {
    "revenue": "e.g. $391.0B",
    "revenueGrowth": "e.g. +8.1% YoY",
    "netIncome": "e.g. $93.7B",
    "ebitda": "e.g. $125.8B",
    "marketCap": "e.g. $3.4T",
    "stockTicker": "e.g. AAPL",
    "stockPrice": "e.g. $225.00",
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
    "totalAddressableMarket": "e.g. $2.1T",
    "marketShare": "e.g. 18.5%",
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

  return callClaudeGrounded(prompt, 5000); // ← grounded: Sonnet + web search
}

// ─── Report Part B: tech + ESG + SWOT + growth + risk + digital ──────────────

async function generatePartB(companyName: string): Promise<unknown> {
  const prompt = `Generate strategic intelligence PART B for: ${companyName}

Return ONLY this JSON:
{
  "techSpend": {
    "annualITBudget": "e.g. $4.2B",
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
        "potentialValue": "e.g. $50-100B",
        "timeframe": "e.g. 2025-2027",
        "confidence": "high|medium|low"
      }
    ],
    "totalOpportunityValue": "e.g. $200-400B across identified opportunities",
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

  return callClaude(prompt, 5000); // ← fast: Haiku, no web search needed
}

// ─── Public: generate full report (parallel) ──────────────────────────────────

export async function generateReport(companyName: string): Promise<unknown> {
  const start = Date.now();

  // Fire both halves simultaneously — total time = max(A, B) not A+B
  const [partA, partB] = await Promise.all([
    generatePartA(companyName),
    generatePartB(companyName),
  ]);

  console.log(`✅ Report generated in ${((Date.now() - start) / 1000).toFixed(1)}s`);

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
