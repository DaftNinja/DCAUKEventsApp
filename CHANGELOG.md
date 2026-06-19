# Changelog

All notable changes to the Stellanor Insight Generator are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.4.0] — 2026-06-19

### Added
- **Credit badge with popover** — the credit count in the navbar is now an interactive badge. Clicking it opens a popover showing: credit count in purple/amber/red depending on level, a progress bar out of 5 starting credits, an explanation that new reports cost 1 credit and cached reports are free, a low-credit amber warning at 1 remaining, a zero-credit red banner, and a "Request more credits" mailto CTA to `contact@stellanordc.com`. Admins see "Admin" text instead.
- **Batch credit check** — the `/reports/batch` endpoint now performs an upfront credit check before starting generation. Counts non-cached companies, compares against available credits, and rejects the batch with a clear message including `creditsNeeded` and `creditsAvailable` if insufficient. Credits are deducted per report as each completes.

### Changed
- **Batch concurrency raised to chunk size 4** — previously sequential (1 at a time), then chunk size 2. Now runs 4 reports in parallel per chunk, chunks sequentially. Verified safe against Tier 1 limits (1K RPM, 80K output TPM). 6 reports: ~228s → 84s (2.7× faster). Railway logs show `📦 Batch`, `📦 Chunk N`, `📦 Batch complete` with timing.
- **Report-ready email skipped on forceRefresh** — the Refresh button on a report sends `forceRefresh: true`; the email notification now has a `!forceRefresh` guard so users aren’t emailed when they manually refresh a report they’re already viewing.

### Fixed
- **Batch route missing credit deduction** — the `/reports/batch` endpoint was generating reports without checking or decrementing user credits. Now enforces the same credit rules as single report generation.
- **`tools/` build exclusion verified** — confirmed `tools/last30days/` is entirely outside Vite’s `root: "./client"` scope and is never bundled into the frontend build. No changes needed.

---

## [1.3.0] — 2026-06-19

### Added
- **SSE streaming progress** — the `/reports/generate` endpoint now uses Server-Sent Events instead of a blocking JSON response. Progress events (`ceo`, `generating`, `partA`, `partB1`, `partB2`, `saving`) are pushed to the client as each parallel stage completes. The frontend shows a live progress message and a 6-segment progress bar that fills in real time. `generateReport` accepts an `onProgress` callback wired through from the route handler.
- **Report-ready email notification** — `sendReportReadyEmail` in `email.ts` sends a dark Stellanor-branded email (purple `#aa65ff` CTA button, navy background) with a direct "View Report →" link after every new generation. Sent non-blocking after `res.end()` so it never adds latency. Skipped on cache hits and on `forceRefresh` (user is already viewing the report).
- **Admin user management UI** (`/admin`) — admin-only page with full CRUD: create users, edit report credits, toggle active/disabled, delete with confirmation modal. Search by name, email, or company. Credit badge and Active/Disabled badge are both clickable inline. All actions audit logged (`ADMIN_USER_CREATED`, `ADMIN_USER_UPDATED`, `ADMIN_USER_DELETED`).
- **Admin API endpoints** — `GET/POST /api/auth/admin/users`, `PATCH /api/auth/admin/users/:id`, `DELETE /api/auth/admin/users/:id`, all behind `requireAdmin`.
- **Users nav link** — admin navbar now shows "Users" and "Audit Log" links side by side.

### Changed
- **`requireAdmin` hardened** — now falls back to `isAdmin(req.session.email)` when `req.session.isAdmin` is absent (sessions created before the flag was stored). Prevents "Not authorised" on the admin UI for existing sessions without requiring a re-login.
- **Report generation spinner** — message updated from "Usually ready in 30 seconds" to "40 seconds" to match observed timing. Live SSE message replaces the static text during generation.
- **`APP_URL` env var** — updated in Railway to `https://stellanordc.com`; report-ready emails now link to the correct domain instead of the old Railway subdomain.
- **Magic link email** — rebranded to match Stellanor dark theme (navy background, purple CTA button, starburst mark) replacing the previous light blue design.
- **`tools/` build exclusion verified** — confirmed `tools/last30days/` is outside Vite's `root: "./client"` scope and is never bundled. Installed at Railway build time by `scripts/install-last30days.sh`; gitignored and not committed.

### Fixed
- **Sales tab Generate button did nothing with bespoke text** — `sellerProduct` state lived in `Dashboard` and was passed as a prop; `handleGenerateSales` closed over a stale value at render time. Fixed by moving input state into `SalesTab` as `localProduct` and passing the value explicitly on submit.
- **Report-ready email sent on Refresh** — the refresh button sends `forceRefresh: true` but the email was firing regardless. Fixed with a `!forceRefresh` guard so the email only sends on genuine first-time generations.
- **"Not authorised" on admin UI** — `requireAdmin` was checking only `req.session.isAdmin` which was absent on sessions predating that field. Fixed by adding `isAdmin(email)` email fallback.

---

## [1.2.0] — 2026-06-18

### Added
- **Admin user management UI** (`/admin`) — admin-only page to create users, edit report credits, toggle active/disabled status, and delete users. All actions audit logged (`ADMIN_USER_CREATED`, `ADMIN_USER_UPDATED`, `ADMIN_USER_DELETED`). Search filters by name, email, or company client-side. Credit badge is clickable inline; Active/Disabled badge toggles on click.
- **Admin API endpoints** — `GET/POST /api/auth/admin/users`, `PATCH /api/auth/admin/users/:id`, `DELETE /api/auth/admin/users/:id` — all behind `requireAdmin` middleware.
- **Users nav link** — admin navbar now shows both "Users" (people icon) and "Audit Log" links.
- **CHANGELOG.md** entries for this session.

### Changed
- **CEO lookup upgraded to Sonnet 4.6 + web search** — previously used Haiku which lacked training coverage for smaller and private companies (e.g. Pirum returned “See company website”). Sonnet with web search resolves CEO names reliably for public, private, and niche companies alike. Validation tightened: responses matching `unknown`, `cannot`, `unable`, `not found` are treated as failures and fall back to the placeholder cleanly.
- **`req.session.*` key audit completed** — confirmed all server files use `userId`, `email`, and `isAdmin` consistently. Set in `authRoutes.ts` callback; read identically in `routes.ts` (`getSessionUser`), `authRoutes.ts` (`requireAuth`, `requireAdmin`, `/me`, `/logout`), and `index.ts`. No inconsistencies found.

### Fixed
- **CEO fallback logging** — added `⚠️ CEO not confirmed` warning log and `👤 CEO: "name"` success log so Railway logs make it immediately clear whether lookup succeeded or fell back.

---

## [1.1.0] — 2026-06-17

### Added
- **Day/dark mode theme toggle** — CSS variable-driven theming with sun/moon button in navbar and burger menu. Preference persisted to `localStorage`. Dark mode is default.
- **Company logo in report header** — Clearbit logo API used to fetch company favicon; falls back silently to a purple initial-letter monogram if domain unavailable or missing.
- **Domain hyperlink in report header** — replaced duplicate CEO line with the company's website domain as a clickable link. `website` field added to the Claude Part A JSON prompt so new reports populate it.
- **Analyst citations in investor deck** — `generateInvestorPresentation` now returns `analystCitations` (8–12 banks for public companies) and `analystConsensus`. UI panel shows bank name, analyst, rating badge, price target, thesis note, and date. Each citation has a coloured left-border stripe keyed to the bank's brand colour (JP Morgan blue, Barclays cyan, Jefferies red, etc.).
- **Stale citation flagging** — citations older than 6 months are flagged with an amber `stale` badge. Panel header shows "some ratings may be outdated" warning if any are stale.
- **Stellanor seller context in sales enablement** — `generateSalesEnablement` auto-detects when Stellanor is the seller and injects a grounded `STELLANOR_SELLER_CONTEXT` block sourced from real product documents (overview doc, London East/North datasheets, press release). Covers all 4 core services, key differentiators, both flagship facilities, and ideal customer profile.
- **"Generate default Stellanor alignment" shortcut** — one-click button in the Sales tab bypasses the product input field and directly triggers Stellanor-grounded sales brief generation.
- **Report credit system** — users are granted 5 credits on signup. Each new report generation (non-cached) deducts one credit. Users at zero are blocked with a clear message. Admins bypass the credit system. Cache hits are always free.
- **`ThemeProvider` context** — wraps the app in `client/src/lib/theme.tsx`; exposes `useTheme()` hook consumed by `Layout.tsx` toggle button and `export.ts`.
- **Export follows onscreen theme** — PDF, PPTX, and HTML exports detect the active theme at generation time via `document.documentElement.getAttribute("data-theme")` and apply the correct palette. Day mode exports use off-white backgrounds and dark text; dark mode exports retain the navy/purple scheme.
- **Investor presentation private company block** — `POST /reports/:slug/investor-presentation` now rejects requests for privately held companies with a `403 PRIVATE_COMPANY` error. Detection uses an allowlist of recognised exchange identifiers (NYSE, NASDAQ, LSE, EURONEXT, etc.) rather than a blocklist, so descriptive text like "Privately held by the Schwarz family" is correctly caught. UI shows an amber warning banner and disables the Generate button when a private company is selected.
- **`CHANGELOG.md`** — this file.

### Changed
- **Model upgraded from Haiku to Sonnet 4.6** — both `MODEL_GROUNDED` (CEO web search) and `MODEL_FAST` (all report generation) now use `claude-sonnet-4-6` for better accuracy, richer analyst notes, and fewer hallucinated executive names.
- **Stellanor system prompt identity** — `SYSTEM` constant in `claude.ts` now identifies as "working for the Stellanor Insight Generator platform".
- **`website` field in Part A prompt** — added to the JSON schema so new reports return a bare domain (e.g. `apple.com`).
- **Analyst citation count target raised to 8–12** — prompt restructured into explicit Steps (quantity → inclusion → dating → quality) to prevent the model self-censoring banks it knows about due to date uncertainty.
- **Investor presentation token budget raised to 10,000** — accommodates 12 citations plus 13 slides without truncation.
- **Sales tab dark theme** — `bg-violet-50` / `bg-white` input card replaced with dark CSS variable equivalents. All hardcoded `violet-*` Tailwind classes in results section replaced with CSS vars.

### Fixed
- **Report credits not decrementing** — `getSessionUser()` was reading `req.session.user.id` but the session stores `req.session.userId` directly. All credit check and decrement logic was silently skipped. Fixed by correcting the key reference.
- **`ADMIN_EMAIL` mismatch** — was set to `andrew.mccreath@stellanordc.com`; corrected to `andrew.mccreath@1giglabs.com` to match actual login email, ensuring admin bypass works correctly.
- **Wouter `<Link>` double-render warnings** — all `<Link><a className="...">` patterns in `Layout.tsx` refactored to `<Link className="...">` (Wouter v3 pattern).
- **`StellanorMark` prop mismatch** — `size={32}` → `height={32}` to match the component's actual prop interface.
- **"Generate default Stellanor alignment" button did nothing** — `setSellerProduct("")` is async; calling `onGenerate()` immediately after read stale state and the empty string hit the `if (!product.trim()) return` guard. Fixed by passing `"stellanor"` directly as a `productOverride` parameter, bypassing React state entirely.
- **Analyst citations reduced after recency rule added** — overly strict date rules caused the model to drop banks it knew about rather than include-and-flag. Fixed by separating inclusion from dating: include any bank with any known coverage, then mark stale if >6 months.
- **Lidl shown in investor deck dropdown and generated analyst coverage** — private company detection used a blocklist regex that couldn't match descriptive text. Replaced with an allowlist of exchange identifiers; any `stockExchange` value that doesn't match a real exchange is now treated as private.
- **Duplicate `border-b` in navbar** — stray duplicate class removed from the `<nav>` element in `Layout.tsx`.

### Rebrand (1GigLabs → Stellanor)
- All `1GigLabs` / `1GL` / `emerald` colour references replaced across frontend, backend, email, and export files.
- Real Stellanor SVG logo paths (starburst mark + wordmark) integrated in `StellanorLogo.tsx`.
- CSS theme migrated to dark navy `#0a0a14` background with `#AA65FF` purple accent (dark mode) and `#f4f3f8` / `#7c3aed` (day mode).
- Favicon updated to starburst mark on dark background.
- Admin email, server startup log, email sender, and package name updated to Stellanor.

---

## [1.0.0] — 2026-06-01 *(estimated)*

### Added
- Initial release as **1GigLabs Insight Generator**.
- AI-powered company intelligence reports covering 10 sections: Executive Summary, Financials, Strategy, Market Analysis, Tech Spend, ESG, SWOT, Growth Opportunities, Risk Assessment, Digital Transformation.
- Sales Enablement tab with custom product/service input.
- Investor Presentation generator with slide deck and lightbox viewer.
- Batch Upload for generating multiple reports sequentially.
- Magic-link authentication (business email only, personal domains blocked).
- PDF, PPTX, and HTML export across all 10 report sections.
- FMP API integration for ticker resolution and financial data enrichment.
- Wikipedia and Claude web search fallbacks for private company data.
- PostgreSQL database via Drizzle ORM, deployed on Railway.
- Audit log for all key user actions.
- Revenue chart, Market Radar, SWOT Grid, and Risk Matrix visualisations.

---

*Maintained by the Stellanor team. For license questions contact andrew.mccreath@1giglabs.com*
