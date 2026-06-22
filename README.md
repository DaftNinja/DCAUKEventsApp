# DCAUK Community Events Platform

A community platform for digital infrastructure professionals to discover events, RSVP, connect with peers, and stay informed on industry news.

**Live URL:** `https://dacuk-events.1giglabs.com`
**Repository:** `DaftNinja/DCAUKEventsApp` (branches: `main` = DCAUK, `TEG` = ThEventGuide)

---

## Architecture

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React 18 + Vite + React Router |
| Auth | LinkedIn OAuth 2.0 (OpenID Connect) + JWT |
| Email | Resend |
| Logging | Pino (structured JSON in production) |
| Validation | Zod |
| Deployment | Railway (single service — Express serves built React as static files) |

---

## Project Structure

```
DCAUKEvents/
├── src/                              # Backend
│   ├── index.js                      # Express server entry point + scheduler
│   ├── db/
│   │   ├── index.js                  # Database connection (pg pool + Drizzle) — exports pool
│   │   ├── schema.js                 # Drizzle ORM schema
│   │   ├── migrate.js                # Drizzle migration runner
│   │   └── migrations/               # SQL migration files
│   │       ├── 0000_perpetual_tarantula.sql  # Initial schema
│   │       ├── 0001_add_user_roles.sql       # role column
│   │       ├── 0002_add_user_status.sql      # status column
│   │       ├── 0003_add_news_items.sql       # news_items table
│   │       └── 0004_groups_meetme.sql        # groups, group_members, group_posts, meet-me
│   ├── middleware/
│   │   ├── auth.js                   # JWT generation, verification, token blocklist
│   │   ├── authorize.js              # Role-based access (attachUser, requireAdmin, etc.)
│   │   └── validate.js               # Zod schema validation middleware factory
│   ├── routes/
│   │   ├── auth.js                   # LinkedIn OAuth + POST /api/auth/logout
│   │   ├── users.js                  # User profile + member directory
│   │   ├── events.js                 # Events, RSVP, Meet-Me endpoints
│   │   ├── groups.js                 # Groups + group posts
│   │   ├── news.js                   # News feed (public GET, admin POST/DELETE)
│   │   └── admin.js                  # Admin user management
│   ├── services/
│   │   ├── email.js                  # All Resend email functions
│   │   ├── reminders.js              # 48hr event reminder scheduler
│   │   └── newsFetcher.js            # RSS aggregation (13 feeds, hourly)
│   └── scripts/
│       ├── ingest-events.js          # CSV → database event ingestion
│       └── seed.js                   # Standalone seed script (npm run db:seed)
├── frontend/                         # React app
│   ├── index.html                    # Page title + Vite entry
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   # Routing
│   │   ├── api.js                    # Fetch API client + server-side logout
│   │   ├── index.css                 # Global reset + CSS variables
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Shared nav (desktop + hamburger mobile menu)
│   │   │   ├── Navbar.css
│   │   │   ├── MeetMe.jsx            # Meet-Me attendee component
│   │   │   └── MeetMe.css
│   │   └── pages/
│   │       ├── HomePage.jsx          # Public landing page + news carousel
│   │       ├── AuthCallback.jsx      # OAuth callback — stores token + role
│   │       ├── EventsPage.jsx        # Upcoming events + monthly calendar
│   │       ├── PastEventsPage.jsx    # Past events archive
│   │       ├── EventDetailPage.jsx   # Event detail + RSVP + Meet-Me
│   │       ├── SubmitEventPage.jsx   # Member event submission form
│   │       ├── NewsPage.jsx          # Industry news feed with source filters
│   │       ├── GroupsPage.jsx        # Browse and join groups
│   │       ├── GroupPage.jsx         # Group feed, posts, members sidebar
│   │       ├── MembersPage.jsx       # Community member directory
│   │       ├── ProfilePage.jsx       # User profile + event history + Meet-Me default
│   │       ├── AdminPage.jsx         # User management + news management (admin only)
│   │       ├── AdminEventsPage.jsx   # Event approvals (admin only)
│   │       └── MyEventsPage.jsx      # User's RSVPs
├── drizzle.config.js
├── package.json                      # Scripts: start, dev, db:migrate, db:seed
└── README.md
```

---

## User Roles

| Role | Capabilities |
|---|---|
| `member` | Browse events, RSVP, view member directory, submit events for review, join groups |
| `organiser` | All member capabilities + event submissions auto-approve and notify members |
| `admin` | Full platform access — user management, event approvals, news management |

Roles are managed manually by admins at `/admin`. There is no automatic role promotion. Your account (`andrew@mccreath.vip`) is set to `admin` by migration `0001_add_user_roles.sql`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string (injected by Railway Postgres plugin) |
| `JWT_SECRET` | ✓ | Secret key for signing and verifying JWTs — use a long random string (32+ chars) |
| `LINKEDIN_CLIENT_ID` | ✓ | From LinkedIn Developer app (`783moisnkphgha`) |
| `LINKEDIN_CLIENT_SECRET` | ✓ | From LinkedIn app Auth tab |
| `LINKEDIN_REDIRECT_URI` | ✓ | Must match LinkedIn app exactly — e.g. `https://dacuk-events.1giglabs.com/api/auth/linkedin/callback` |
| `FRONTEND_URL` | ✓ | Base URL used in email links — e.g. `https://dacuk-events.1giglabs.com` |
| `VITE_API_URL` | ✓ | Base URL for API calls from the frontend — e.g. `https://dacuk-events.1giglabs.com`. Read via `import.meta.env.VITE_API_URL` in `frontend/src/api.js` |
| `RESEND_API_KEY` | ✓ | Resend transactional email API key |
| `EMAIL_FROM` | ✓ | Sending address — e.g. `DCAUK <contact@1giglabs.com>` |
| `NODE_ENV` | ✓ | Set to `production` on Railway — controls Pino pretty-printing |
| `LOG_LEVEL` | — | Pino log level — defaults to `info` |
| `SENTRY_DSN` | — | *(Optional)* Sentry error tracking DSN. Set but currently inactive due to a known ESM compatibility issue with Drizzle ORM |
| `PORT` | — | Injected automatically by Railway — defaults to `8080` |

> ⚠️ The LinkedIn redirect variable is `LINKEDIN_REDIRECT_URI` — not `LINKEDIN_CALLBACK_URL`.
> ⚠️ Frontend env vars must be prefixed `VITE_` to be exposed to the browser build.

---

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node src/index.js` | Production server |
| `dev` | `node --watch src/index.js` | Development server with file watching |
| `db:migrate` | `node src/db/migrate.js` | Run pending Drizzle migrations manually |
| `db:seed` | `node src/scripts/seed.js` | Seed the database from `events.csv` (one-off, safe to re-run) |

---

## Railway Deployment

### Build command
```
npm install && cd frontend && npm install && npm run build && cd ..
```

### Start command
```
node src/index.js
```

### Health check endpoint
```
GET /health → { "status": "ok", "timestamp": "..." }
```

### Startup sequence
On every deploy the server:
1. Runs Drizzle migrations — applies any pending `.sql` files
2. Starts the Express server
3. Launches the hourly scheduler (event reminders + RSS news fetcher)

> ℹ️ Event CSV ingestion (`npm run db:seed`) is intentionally **not** part of the startup sequence to prevent duplicate data on restarts. Run it manually for fresh databases.

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/DaftNinja/DCAUKEventsApp.git
cd DCAUKEventsApp
npm install
cd frontend && npm install && cd ..

# 2. Create environment file
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, LINKEDIN_CLIENT_ID,
#          LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI,
#          RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL, VITE_API_URL

# 3. Run migrations
npm run db:migrate

# 4. (Optional) Seed events
npm run db:seed

# 5. Start backend (port 8080)
npm run dev

# 6. Start frontend in a separate terminal (port 5173)
cd frontend && npm run dev
```

---

## Security

### Authentication
- LinkedIn OAuth 2.0 (OpenID Connect) — scopes: `openid profile email`
- JWTs signed with `JWT_SECRET`, 30-day expiry
- Each token includes a `jti` (JWT ID) claim for individual invalidation

### Token Invalidation
Logout is handled both client-side and server-side:
- **Client:** `POST /api/auth/logout` is called before clearing localStorage
- **Server:** The token's `jti` is added to an in-memory blocklist until its natural expiry
- `authenticateToken` middleware rejects any token whose `jti` is on the blocklist
- The blocklist is cleaned up automatically every 15 minutes

> For multi-instance deployments, replace the in-memory blocklist in `src/middleware/auth.js` with a Redis or database-backed store.

### Suspended users
Suspended accounts are blocked at the OAuth callback — they receive a clear error and cannot log in.

---

## API Reference

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/linkedin` | — | Initiate LinkedIn OAuth |
| GET | `/api/auth/linkedin/callback` | — | OAuth callback — creates/updates user, returns JWT |
| POST | `/api/auth/logout` | ✓ | Invalidate current token server-side |

### Users
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/users/me` | ✓ | Get logged-in user profile |
| PUT | `/api/users/me` | ✓ | Update own profile (incl. `defaultOpenToMeeting`) |
| GET | `/api/users` | ✓ | Member directory (public fields only, no emails) |

### Events
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | Optional | List all approved events with current user's RSVP |
| GET | `/api/events/:id` | Optional | Event detail with attendee list |
| POST | `/api/events` | ✓ | Submit event (auto-approved for organiser/admin) |
| PUT | `/api/events/:id` | Owner/Admin | Update event |
| DELETE | `/api/events/:id` | Owner/Admin | Delete event |
| POST | `/api/events/:id/rsvp` | ✓ | RSVP going or interested |
| DELETE | `/api/events/:id/rsvp` | ✓ | Remove RSVP |
| PUT | `/api/events/:id/rsvp/meeting` | ✓ | Toggle Meet-Me opt-in (Going only) |
| GET | `/api/events/:id/meeting` | ✓ Going | Get Meet-Me attendees (Going RSVPs only) |
| POST | `/api/events/:id/approve` | Admin | Approve pending event |
| POST | `/api/events/:id/reject` | Admin | Reject pending event |

### Groups
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/groups` | ✓ | List all groups with member counts + membership status |
| POST | `/api/groups` | Admin | Create a group |
| GET | `/api/groups/:slug` | ✓ | Group detail — posts + member list |
| DELETE | `/api/groups/:slug` | Admin | Delete a group |
| POST | `/api/groups/:slug/join` | ✓ | Join a group |
| DELETE | `/api/groups/:slug/join` | ✓ | Leave a group |
| POST | `/api/groups/:slug/posts` | ✓ Member | Create a post (members only) |
| DELETE | `/api/groups/:slug/posts/:id` | Owner/Admin | Delete a post |

### News
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/news` | — | Latest 40 news items (RSS + manual), newest first |
| POST | `/api/news` | Admin | Manually post a news item |
| DELETE | `/api/news/:id` | Admin | Remove a news item |

### Admin
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | List all users |
| GET | `/api/admin/users/:id` | Admin | User detail + RSVP counts |
| POST | `/api/admin/users` | Admin | Manually create user account |
| PUT | `/api/admin/users/:id` | Admin | Update any user field |
| PUT | `/api/admin/users/:id/role` | Admin | Update role only |
| DELETE | `/api/admin/users/:id` | Admin | Delete user (cascades RSVPs) |

---

## Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| linkedinId | TEXT | Unique — `manual_<uuid>` for manually created accounts |
| email | TEXT | Unique |
| name | TEXT | |
| headline | TEXT | Job title / role |
| company | TEXT | |
| avatarUrl | TEXT | LinkedIn profile photo URL |
| bio | TEXT | User-editable |
| role | TEXT | `member` \| `organiser` \| `admin` |
| status | TEXT | `active` \| `suspended` |
| defaultOpenToMeeting | BOOLEAN | Default Meet-Me preference for new RSVPs |
| createdAt / updatedAt | TIMESTAMP | |

### events
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | TEXT | |
| description | TEXT | |
| startDate / endDate | TIMESTAMP | |
| location | TEXT | |
| isVirtual | BOOLEAN | |
| organiser | TEXT | Organiser name |
| organizerEmail | TEXT | |
| organizerId | UUID | FK → users |
| eventUrl | TEXT | Link to external event page |
| status | TEXT | `pending` \| `approved` \| `rejected` |
| approvedAt | TIMESTAMP | |
| createdAt / updatedAt | TIMESTAMP | |

### rsvps
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | FK → users (cascade delete) |
| eventId | UUID | FK → events (cascade delete) |
| status | TEXT | `going` \| `interested` |
| openToMeeting | BOOLEAN | Meet-Me opt-in for this event |
| createdAt / updatedAt | TIMESTAMP | |

### groups
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | |
| slug | TEXT | Unique URL-safe identifier |
| description | TEXT | |
| imageUrl | TEXT | |
| createdBy | UUID | FK → users |
| createdAt / updatedAt | TIMESTAMP | |

### group_members
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| groupId | UUID | FK → groups (cascade delete) |
| userId | UUID | FK → users (cascade delete) |
| role | TEXT | `member` \| `moderator` |
| joinedAt | TIMESTAMP | |

### group_posts
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| groupId | UUID | FK → groups (cascade delete) |
| userId | UUID | FK → users (cascade delete) |
| content | TEXT | |
| linkUrl / linkTitle | TEXT | Optional link attachment |
| attachmentUrl / attachmentName | TEXT | Optional file attachment |
| createdAt / updatedAt | TIMESTAMP | |

### news_items
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | TEXT | |
| summary | TEXT | |
| url | TEXT | Unique |
| source | TEXT | Publication name |
| imageUrl | TEXT | |
| publishedAt | TIMESTAMP | |
| type | TEXT | `rss` \| `manual` |
| createdAt | TIMESTAMP | |

---

## News Feed

RSS feeds are fetched hourly. Current sources:

| Source | Type |
|---|---|
| Data Centre Dynamics | RSS |
| Data Centre Magazine | RSS |
| BizClik Media — Data Centre | RSS |
| ITPro — Data Centre | RSS |
| ComputerWeekly — Data Centre | RSS |
| The Register — Data Centre | RSS |
| DatacenterKnowledge | RSS |
| Uptime Institute Journal | RSS |
| DCNN Magazine | RSS |
| The Stack | RSS |
| Silicon Republic | RSS |
| Hosting Journalist | RSS |
| Telecoms.com | RSS |

Admin users can also post items manually via Admin → News tab.

Deduplication runs on both URL (exact match) and normalised title (catches syndicated stories across feeds).

---

## Email Notifications

All email is sent via Resend from `EMAIL_FROM`. Failures are caught silently — they log an error but never fail the originating request.

| Trigger | Recipients | Notes |
|---|---|---|
| User RSVPs Going or Interested | The user | Confirmation with event details |
| User removes RSVP | The user | Cancellation notice |
| Admin approves event | All members (BCC batches of 50) | New event announcement |
| Admin approves event | Event organiser | Approval confirmation |
| Admin rejects event | Event organiser | Polite rejection notice |
| 48hrs before event | All Going RSVPs (BCC batches of 50) | Reminder — runs hourly |

---

## LinkedIn OAuth Setup

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Open the **1GigLabs DCAUK Event App** (Client ID: `783moisnkphgha`)
3. **Products tab** — confirm: Share on LinkedIn, Sign In with LinkedIn using OpenID Connect
4. **Auth tab** — add `https://dacuk-events.1giglabs.com/api/auth/linkedin/callback` to authorised redirect URLs
5. Scopes: `openid profile email`

When changing domains, add the new redirect URL to the LinkedIn app **before** updating `LINKEDIN_REDIRECT_URI` in Railway.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | DCAUK — digital infrastructure community platform |
| `TEG` | ThEventGuide — rebranded version for general events industry |

Both branches share the same backend architecture and database schema. The TEG branch replaces all DCAUK branding with ThEventGuide and adjusts copy for a broader events audience.

---

## Roadmap

### Shipped
- [x] LinkedIn OAuth sign-in with auto-populated profiles
- [x] Events listing with monthly calendar view + upcoming/past split
- [x] Event detail with RSVP (going / interested) + Add to Calendar
- [x] Event submission workflow (member → admin approval queue)
- [x] Auto-approve for organiser/admin submissions
- [x] Member directory with search
- [x] Profile page with event history + Meet-Me default preference
- [x] Meet-Me — per-event opt-in to connect with fellow Going attendees
- [x] Groups — topic-based communities with post feeds (text, links, attachments)
- [x] Industry news feed — 13 RSS sources, hourly refresh, admin manual posting
- [x] News carousel on homepage hero
- [x] Email notifications — RSVP, new events, approvals, 48hr reminders
- [x] Role-based access — member / organiser / admin
- [x] Full admin panel — user management, event approvals, news management
- [x] Server-side token invalidation on logout (JWT blocklist)
- [x] Mobile hamburger navigation
- [x] Structured logging (Pino) throughout
- [x] Health check endpoint
- [x] Drizzle migrations
- [x] Event seeding decoupled from server startup (`npm run db:seed`)
- [x] TEG branch — ThEventGuide rebrand

### Next
- [ ] Domain migration to `dcauk.org`
- [ ] Resend domain verification (`@dcauk.org` sending)
- [ ] Training section
- [ ] Student engagement features
- [ ] Admin group management UI
- [ ] Multi-instance token blocklist (Redis)
