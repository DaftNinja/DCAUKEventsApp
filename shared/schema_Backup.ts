import { pgTable, text, timestamp, jsonb, serial, boolean, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

// ─── Database Tables ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  company: text("company"),
  isActive: boolean("is_active").default(true).notNull(),
  reportCredits: integer("report_credits").default(5).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// One-time magic-link sign-in tokens. Consumed on click, then marked used.
export const signinTokens = pgTable("signin_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email"),
  action: text("action").notNull(),
  detail: text("detail"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  companyName: text("company_name").notNull(),
  companySlug: text("company_slug").notNull().unique(),
  industry: text("industry"),
  reportData: jsonb("report_data"),
  salesEnablementData: jsonb("sales_enablement_data"),
  generatedAt: timestamp("generated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isGenerating: boolean("is_generating").default(false),
});

export const sessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// ─── Report Section Types ─────────────────────────────────────────────────────

export const FinancialsSchema = z.object({
  revenue: z.string(),
  revenueGrowth: z.string(),
  netIncome: z.string(),
  ebitda: z.string(),
  marketCap: z.string(),
  stockTicker: z.string().optional(),
  stockPrice: z.string().optional(),
  fiscalYear: z.string(),
  keyMetrics: z.array(z.object({ label: z.string(), value: z.string(), trend: z.enum(["up", "down", "neutral"]) })),
  revenueHistory: z.array(z.object({ year: z.string(), revenue: z.string(), growth: z.string() })),
  outlook: z.string(),
});

export const StrategySchema = z.object({
  vision: z.string(),
  mission: z.string(),
  coreInitiatives: z.array(z.object({ title: z.string(), description: z.string(), timeline: z.string() })),
  geographicFocus: z.array(z.string()),
  mAndA: z.string(),
  capitalAllocation: z.string(),
  summary: z.string(),
});

export const MarketAnalysisSchema = z.object({
  totalAddressableMarket: z.string(),
  marketShare: z.string(),
  marketPosition: z.string(),
  competitors: z.array(z.object({ name: z.string(), strength: z.string(), threat: z.enum(["high", "medium", "low"]) })),
  customerSegments: z.array(z.string()),
  geographicPresence: z.array(z.object({ region: z.string(), percentage: z.string() })),
  marketTrends: z.array(z.string()),
  summary: z.string(),
});

export const TechSpendSchema = z.object({
  annualITBudget: z.string(),
  itBudgetAsPercentRevenue: z.string(),
  cloudPlatforms: z.array(z.string()),
  keyVendors: z.array(z.object({ vendor: z.string(), category: z.string(), relationship: z.string() })),
  dataInfrastructure: z.string(),
  securityPosture: z.string(),
  emergingTech: z.array(z.string()),
  summary: z.string(),
});

export const ESGSchema = z.object({
  overallRating: z.string(),
  netZeroTarget: z.string(),
  environmentalInitiatives: z.array(z.string()),
  socialInitiatives: z.array(z.string()),
  governanceRating: z.string(),
  boardDiversity: z.string(),
  esgRisks: z.array(z.string()),
  summary: z.string(),
});

export const SWOTSchema = z.object({
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })),
  weaknesses: z.array(z.object({ title: z.string(), detail: z.string() })),
  opportunities: z.array(z.object({ title: z.string(), detail: z.string() })),
  threats: z.array(z.object({ title: z.string(), detail: z.string() })),
});

export const GrowthOpportunitiesSchema = z.object({
  opportunities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    potentialValue: z.string(),
    timeframe: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  })),
  totalOpportunityValue: z.string(),
  summary: z.string(),
});

export const RiskAssessmentSchema = z.object({
  overallRiskLevel: z.enum(["high", "medium", "low"]),
  risks: z.array(z.object({
    category: z.string(),
    title: z.string(),
    description: z.string(),
    likelihood: z.enum(["high", "medium", "low"]),
    impact: z.enum(["high", "medium", "low"]),
    mitigation: z.string(),
  })),
  summary: z.string(),
});

export const DigitalTransformationSchema = z.object({
  maturityLevel: z.enum(["leading", "advanced", "developing", "early"]),
  maturityScore: z.number().min(1).max(10),
  keyInitiatives: z.array(z.object({ title: z.string(), description: z.string(), status: z.enum(["live", "in_progress", "planned"]) })),
  aiAdoption: z.string(),
  dataStrategy: z.string(),
  challenges: z.array(z.string()),
  summary: z.string(),
});

export const ExecutiveSummarySchema = z.object({
  companyOverview: z.string(),
  headquarters: z.string(),
  founded: z.string(),
  employees: z.string(),
  ceo: z.string(),
  keyExecutives: z.array(z.object({ name: z.string(), title: z.string() })),
  stockExchange: z.string().optional(),
  highlights: z.array(z.string()),
  analystRating: z.string(),
  lastUpdated: z.string(),
});

export const ReportDataSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  executiveSummary: ExecutiveSummarySchema,
  financials: FinancialsSchema,
  strategy: StrategySchema,
  marketAnalysis: MarketAnalysisSchema,
  techSpend: TechSpendSchema,
  esg: ESGSchema,
  swot: SWOTSchema,
  growthOpportunities: GrowthOpportunitiesSchema,
  riskAssessment: RiskAssessmentSchema,
  digitalTransformation: DigitalTransformationSchema,
});

export const SalesEnablementSchema = z.object({
  sellerProduct: z.string(),
  salesSummary: z.string(),
  conversationStarters: z.array(z.string()),
  painPoints: z.array(z.object({ pain: z.string(), solution: z.string() })),
  useCases: z.array(z.object({ title: z.string(), roi: z.string(), description: z.string() })),
  totalValueOpportunity: z.string(),
  currentChallenges: z.array(z.string()),
  potentialSavings: z.array(z.object({ area: z.string(), estimate: z.string() })),
  competitivePositioning: z.string(),
  nextSteps: z.array(z.object({ step: z.string(), action: z.string(), timeline: z.string() })),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SigninToken = typeof signinTokens.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ReportData = z.infer<typeof ReportDataSchema>;
export type SalesEnablement = z.infer<typeof SalesEnablementSchema>;
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type Financials = z.infer<typeof FinancialsSchema>;
export type SWOT = z.infer<typeof SWOTSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type DigitalTransformation = z.infer<typeof DigitalTransformationSchema>;

// ─── Auth Zod Schemas ─────────────────────────────────────────────────────────

// Single magic-link request form. First-time users supply name/company;
// returning users can leave them blank — we ignore them.
export const RequestLinkSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  company: z.string().trim().min(1).max(120).optional(),
});
