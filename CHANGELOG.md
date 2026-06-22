# Changelog

All notable changes to the DCAUK Community Events Platform are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Server-side token blocklist on logout — each JWT now carries a `jti` claim; `POST /api/auth/logout` adds it to an in-memory blocklist until natural expiry
- `POST /api/auth/logout` endpoint
- Frontend `logout()` now calls the server endpoint before clearing localStorage

### Fixed
- `console.error` in `src/middleware/auth.js` replaced with structured Pino `logger.error` for consistent production logging

---

## [1.6.0] — 2026-06-07

### Added
- Mobile hamburger menu — full navigation accessible on all screen sizes
- Homepage shows full shared Navbar for logged-in users instead of minimal landing nav
- ThEventGuide rebrand on `TEG` branch (previously TheVentGuide)

### Fixed
- `role` was not being passed in the LinkedIn OAuth redirect URL — Admin nav link now appears correctly after sign-in
- `AuthCallback.jsx` updated to read and store `role` from URL params

---

## [1.5.0] — 2026-06-06

### Added
- **Groups** — topic-based community groups with join/leave, post feed (text + links), members sidebar
- Six default groups seeded: AI & Data Infrastructure, Sustainability & Net Zero, Colocation & Interconnection, Edge Computing, Power & Cooling, Investment & M&A
- **Meet-Me** — per-event opt-in for Going attendees to appear in a connection list; LinkedIn Connect button links directly to their profile
- `defaultOpenToMeeting` profile preference — auto-enables Meet-Me when RSVPing Going
- `open_to_meeting` column on `rsvps` table
- `default_open_to_meeting` column on `users` table
- Groups API: `GET/POST /api/groups`, `GET/DELETE /api/groups/:slug`, join/leave, posts CRUD
- Meet-Me API: `PUT /api/events/:id/rsvp/meeting`, `GET /api/events/:id/meeting`
- `src/scripts/seed.js` — standalone database seeding script
- `npm run db:seed` and `npm run db:migrate` scripts in `package.json`
- Event ingestion decoupled from server startup — no more risk of duplicate data on redeploy

### Changed
- Server startup no longer calls `ingestEvents()` automatically
- `pool` exported from `src/db/index.js` for use by seed script

---

## [1.4.0] — 2026-06-05

### Added
- **News feed** — 13 industry RSS feeds fetched hourly, stored in `news_items` table
- News page at `/news` with source filter tabs
- News carousel on homepage hero (auto-cycles every 5s, public — no auth required)
- News preview section on homepage for logged-in users
- Admin News tab — manually post or remove news items
- Cross-feed deduplication by normalised title (catches syndicated stories)
- HTML entity decoding in RSS titles and summaries; future dates filtered out
- RSS sources: Data Centre Dynamics, Data Centre Magazine, BizClik, ITPro, ComputerWeekly, The Register, DatacenterKnowledge, Uptime Institute Journal, DCNN Magazine, The Stack, Silicon Republic, Hosting Journalist, Telecoms.com
- News link added to shared Navbar

### Fixed
- `<p data-block-key=...>` HTML fragments appearing in DCD summaries — entities now decoded before tag stripping

---

## [1.3.0] — 2026-06-04

### Added
- **Groups** foundation (schema + migrations) — `groups`, `group_members`, `group_posts` tables
- `TEG` branch created — ThEventGuide rebrand of all frontend and backend copy
- Admin panel Users/News tab switcher
- `status` badge column in admin user table

### Fixed
- `AdminPage.jsx` missing closing braces causing Vite build failure
- `src/routes/news.js` accidentally imported into `src/db/index.js` — moved to correct `src/index.js`
- `reminders.js` missing from repository — added
- `express.json()` registered after admin routes — reordered to fix validation failures

---

## [1.2.0] — 2026-06-03

### Added
- **Event submission workflow** — any member can submit events; organiser/admin submissions auto-approve
- Submit event page at `/events/submit` with full form validation
- Organiser approval/rejection emails via Resend
- `+ Submit event` link in Navbar
- **User management admin panel** at `/admin` — edit, suspend, reinstate, delete, add users manually
- Role management — member / organiser / admin (manual grant only, no auto-promotion)
- Suspended user enforcement at OAuth callback
- Admin link in Navbar visible to admin role only (role stored in localStorage from OAuth callback)
- `role` and `status` columns on `users` table (migrations `0001`, `0002`)
- `attachUser`, `requireAdmin`, `requireOrganiserOrAdmin` middleware

### Changed
- Admin panel expanded from role-only dropdown to full slide-out detail panel
- `logout()` clears `role` from localStorage

### Fixed
- Navbar CSS `@media` block missing closing brace — silently broke all page styling

---

## [1.1.0] — 2026-06-02

### Added
- **Email notifications** via Resend:
  - RSVP confirmation (going / interested)
  - RSVP cancellation
  - New event notification (BCC batched, all members)
  - Event approved (organiser)
  - Event rejected (organiser)
  - 48hr event reminders (hourly scheduler, all Going RSVPs)
- Shared `Navbar` component across all pages (Events, Members, My Profile, Sign out)
- Past events page at `/events/past`
- Profile page with upcoming and past RSVP history
- Member directory at `/members` with search
- Compact monthly calendar on events page
- Add to Calendar — Google Calendar URL + `.ics` download
- `email.js` service with all Resend functions
- `reminders.js` hourly scheduler

### Changed
- Events page split into upcoming / past
- Navbar styling — sticky, consistent across pages

---

## [1.0.0] — 2026-05-27

### Added
- LinkedIn OAuth 2.0 (OpenID Connect) sign-in
- JWT authentication (30-day expiry)
- Auto-populated user profiles from LinkedIn (name, headline, company, avatar)
- Events listing with monthly calendar view
- Event detail page with RSVP (going / interested) via upsert
- PostgreSQL database with Drizzle ORM
- Initial schema — `users`, `events`, `rsvps`
- Drizzle migrations replacing hand-rolled SQL
- Zod validation on all mutating routes
- Pino structured logging (JSON in production, pretty in dev)
- Health check endpoint `GET /health`
- Railway deployment (single service — Express serves built React)
- `events.csv` ingestion script
- Homepage with hero, features section, CTA
