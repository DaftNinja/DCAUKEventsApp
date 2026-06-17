# Changelog

All notable changes to the Stellanor Insight Generator are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

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

*Maintained by the Stellanor engineering team. For questions contact andrew.mccreath@stellanordc.com*
