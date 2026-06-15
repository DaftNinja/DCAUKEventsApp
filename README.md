# 1GigLabs Insight Generator

Strategic business intelligence platform powered by Claude AI. Enter any company
name and get a comprehensive 10-section report — financials, strategy, market
analysis, tech spend, ESG, SWOT, growth opportunities, risk assessment, digital
transformation, and sales enablement — in under 60 seconds.

> **Currency-aware:** All financial figures are displayed in the company's native
> currency (£ for UK, € for Eurozone,  for US, ¥ for Japan, etc.) — never ISO
> codes like GBP or USD.

---

## Stack

| Layer | Technology |
|---|---|
| **AI** | Anthropic Claude (`claude-haiku-4-5`) |
| **Financial Data** | Financial Modeling Prep (FMP) API |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| **Backend** | Express 5 + TypeScript + Node 20 |
| **Database** | PostgreSQL + Drizzle ORM |
| **Routing** | Wouter |
| **Deploy** | Railway (Nixpacks) |

---

## How It Works

Report generation runs in two parallel streams:



        generateReport(companyName, industry?, ticker?)
        │
        ├── generatePartA()          ← Executive summary, financials,
        │       └── lookupCEO()          strategy, market analysis
        │
        ├── generatePartB()          ← Tech spend, ESG, SWOT, growth,
        │                                risk, digital transformation
        │
        └── fetchFMPFinancials()     ← Live verified data from FMP API
                └── mergeFinancials()    (market cap, EBITDA, margins,
                                          revenue history, stock price)

Currency Resolution

Currency symbols are resolved automatically — never ISO codes:

1. FMP profile returns the company's country field
2. currencySymbol(hq) maps the HQ country → native symbol
   (e.g. "United Kingdom" → £, "Germany" → €)
3. If no HQ country is available, fmpCurrencyToSymbol(code) maps
   FMP's ISO currency code → symbol as a fallback
4. The resolved symbol is applied to all formatted financial values
   (revenue, market cap, EBITDA, stock price, EPS, revenue history)
5. The Claude system prompt enforces the same rule for AI-estimated
   figures — ISO codes like GBP, USD, EUR are explicitly forbidden

## Symbol reference:

| HQ Country / Region | Symbol |
|---|---|
| United Kingdom | £ |
| Eurozone (DE, FR, IT, ES, NL, …) | € |
| United States |  |
| Japan / China | ¥ |
| Switzerland | CHF |
| Canada | C |
| Australia | A |
| Scandinavia | kr |
| India | ₹ |
| Brazil | R |

---

Local Development

Prerequisites

- Node 20+
- PostgreSQL instance (local or remote)
- Anthropic API key — console.anthropic.com
- FMP API key — financialmodelingprep.com
  (free tier works for development)

Setup

bash
Clone
git clone https://github.com/DaftNinja/insights-generator.git
cd insights-generator

Install
npm install

Configure
cp .env.example .env
Edit .env — see Environment Variables section below

Start dev server
npm run dev

The app runs at http://localhost:5173 (Vite) with the API proxied to
http://localhost:3000.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| ANTHROPICAPIKEY | ✅ | Claude API key from console.anthropic.com |
| FMPAPIKEY | ✅ | Financial Modeling Prep API key |
| DATABASEURL | ✅ | PostgreSQL connection string |
| SESSIONSECRET | ✅ | Random 32+ character string for session signing |
| NODEENV | ✅ | development or production |
| RESENDAPIKEY | ⚪ | Email service key (optional) |
| RESENDFROM | ⚪ | Sender email address (optional) |
| APPURL | ⚪ | Public URL of the app (optional, used in emails) |
| CLIENTURL | ⚪ | Frontend URL if different from APPURL (optional) |
| REDISURL | ⚪ | Redis connection string (optional, for job queuing) |

> DATABASEURL and PORT are injected automatically by Railway when
> using the PostgreSQL plugin — no manual config needed in production.

---

## Railway Deployment

1. Create a Railway project

1. Go to railway.app → New Project
2. Choose Deploy from GitHub repo → select this repo
3. Railway will auto-detect Nixpacks from nixpacks.toml

2. Add PostgreSQL plugin

1. Click + New → Database → Add PostgreSQL
2. Railway automatically injects DATABASEURL into your service

3. Set environment variables

In your service → Variables tab, add:

| Variable | Value |
|---|---|
| ANTHROPICAPIKEY | sk-ant-... from console.anthropic.com |
| FMPAPIKEY | Your FMP API key |
| SESSIONSECRET | Any random 32+ character string |
| NODEENV | production |

4. Deploy

Railway triggers a build on every push to main. The build process:

1. Installs dependencies (npm install)
2. Builds frontend (vite build → dist/public/)
3. Bundles server (esbuild → dist/server.js)
4. Starts server (node dist/server.js)

The server initialises the reports table on first boot — no manual
migration needed.

---

## Project Structure


client/
  src/
    pages/          Home, Reports, Dashboard, Mission, Presentation, Batch
    components/     Layout, MetricCard, SWOTGrid, RiskMatrix, charts/
    hooks/          useReport.ts — data fetching + SSE progress streaming
    lib/            api.ts, export.ts, utils.ts

server/
  index.ts          Express entry point + DB bootstrap
  routes.ts         All API endpoints
  storage.ts        DB abstraction layer (Drizzle ORM)
  claude.ts         AI service — report generation, currency resolution,
                    FMP integration, CEO lookup
  db.ts             Drizzle + pg pool

shared/
  schema.ts         Drizzle table defs + Zod schemas + TypeScript types

server/claude.ts — Key Exports & Helpers

| Function | Description |
|---|---|
| generateReport() | Orchestrates Part A + Part B + FMP in parallel |
| generatePartA() | Executive summary, financials, strategy, market |
| generatePartB() | Tech, ESG, SWOT, growth, risk, digital transformation |
| fetchFMPFinancials() | Fetches verified data from FMP API |
| mergeFinancials() | Merges FMP verified data over Claude estimates |
| lookupCEO() | Web-search grounded CEO lookup via Claude |
| currencySymbol() | Maps HQ country string → native currency symbol |
| fmpCurrencyToSymbol() | Maps FMP ISO currency code → symbol (fallback) |
| generateSalesEnablement() | Generates sales brief for a target company |
| generateInvestorPresentation() | Generates structured investor slide deck |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/reports/generate | Generate or return cached report |
| GET | /api/reports | List all reports |
| GET | /api/reports/:slug | Get single report |
| DELETE | /api/reports/:id | Delete report |
| PATCH | /api/reports/:id/verify | Toggle isVerified status + audit log |
| POST | /api/reports/:slug/sales-enablement | Generate sales brief |
| POST | /api/reports/:slug/investor-presentation | Generate investor deck |
| POST | /api/reports/batch | Batch generate up to 50 reports |
| GET | /api/reports/:id/stream | SSE stream for real-time progress |
| GET | /api/queue/status | BullMQ queue status |

---

## Report Caching

Reports are cached for 2 months. On generation:

- Report exists and is < 2 months old → return immediately from DB
- Expired or missing → call Claude + FMP → save → return
- Pass forceRefresh: true in the generate request body to bypass cache

---

## Financial Data — Verified vs Estimated

Each report clearly distinguishes between verified and estimated figures:

| Source | Fields | Label |
|---|---|---|
| FMP API (verified) | Market cap, EBITDA, gross margin, operating margin, P/E, EPS, stock price, revenue history | verified: true on keyMetrics |
| Claude AI (estimated) | Revenue, net income, outlook, all non-FMP fields | Marked (est.) where uncertain |

When a ticker is supplied and FMP returns data, _fmpVerified: true is
set on the financials object. The frontend uses this flag to display
the appropriate verification badge.

---

## Export Formats

From any report page:

- PDF — html2canvas + jsPDF browser-side rendering
- PPTX — pptxgenjs structured slide deck (cover + exec summary +
  financials + SWOT + risk)
- HTML — Self-contained dark-themed HTML file

---

Licence

Private / proprietary — 1GigLabs © 2026
