# DCAUK Community Events Platform

A community platform for digital infrastructure professionals to discover events, RSVP, connect with peers, and manage their professional presence.

**Live URL:** `https://dcaevents-production.up.railway.app`  
**Working domain:** `dacuk-events.1giglabs.com`  
**Future migration:** `dcauk.org`

---

## Architecture

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React 18 + Vite + React Router |
| Auth | LinkedIn OAuth 2.0 (OpenID Connect) |
| Email | Resend |
| Logging | Pino (structured JSON in production) |
| Validation | Zod |
| Deployment | Railway (single service — Express serves built React as static files) |

---

## Project Structure

```
DCAUKEvents/
├── src/                              # Backend
│   ├── index.js                      # Express server entry point
│   ├── instrument.js                 # Sentry ESM instrumentation (loaded via --import)
│   ├── db/
│   │   ├── index.js                  # Database connection (pg + Drizzle)
│   │   ├── schema.js                 # Drizzle ORM schema (users, events, rsvps)
│   │   ├── migrate.js                # Drizzle migration runner
│   │   └── migrations/               # SQL migration files (tracked by Drizzle)
│   │       ├── 0000_perpetual_tarantula.sql  # Initial schema
│   │       ├── 0001_add_user_roles.sql       # role column
│   │       ├── 0002_add_user_status.sql      # status column
│   │       └── meta/
│   │           └── journal.json
│   ├── middleware/
│   │   ├── auth.js                   # JWT generation & verification
│   │   ├── authorize.js              # Role-based access (attachUser, requireAdmin, etc.)
│   │   └── validate.js               # Zod schema validation middleware factory
│   ├── routes/
│   │   ├── auth.js                   # LinkedIn OAuth flow
│   │   ├── users.js                  # User profile + member directory
│   │   ├── events.js                 # Events + RSVP endpoints
│   │   └── admin.js                  # Admin user management
│   ├── services/
│   │   └── email.js                  # All Resend email functions
│   └── scripts/
│       ├── ingest-events.js          # CSV → database event ingestion
│       └── runMigrations.js          # Standalone migration runner
├── frontend/                         # React app
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   # Routing
│   │   ├── api.js                    # Axios API client
│   │   ├── index.css                 # Global reset + CSS variables
│   │   ├── App.css
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Shared navigation bar
│   │   │   └── Navbar.css
│   │   └── pages/
│   │       ├── HomePage.jsx          # Public landing page
│   │       ├── AuthCallback.jsx      # OAuth callback handler
│   │       ├── EventsPage.jsx        # Upcoming events + calendar
│   │       ├── PastEventsPage.jsx    # Past events archive
│   │       ├── EventDetailPage.jsx   # Event detail + RSVP
│   │       ├── SubmitEventPage.jsx   # Member event submission form
│   │       ├── MembersPage.jsx       # Community member directory
│   │       ├── ProfilePage.jsx       # User profile + event history
│   │       ├── AdminPage.jsx         # User management (admin only)
│   │       ├── AdminEventsPage.jsx   # Event approvals (admin only)
│   │       └── MyEventsPage.jsx      # User's RSVPs
├── drizzle.config.js
├── package.json
└── README.md
```

---

## User Roles

| Role | Capabilities |
|---|---|
| `member` | Browse events, RSVP, view member directory, submit events for review |
| `organiser` | All member capabilities + event submissions auto-approve |
| `admin` | Full platform access including user management and event approvals |

Roles are managed manually by admins at `/admin`. There is no automatic role promotion — organisers must be explicitly granted by an admin.

Your account (`andrew@mccreath.vip`) is set to `admin` by the initial migration.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (injected by Railway Postgres) |
| `JWT_SECRET` | Secret for signing JWTs — any long random string |
| `LINKEDIN_CLIENT_ID` | From LinkedIn Developer app (`783moisnkphgha`) |
| `LINKEDIN_CLIENT_SECRET` | From LinkedIn Auth tab |
| `LINKEDIN_REDIRECT_URI` | Must match LinkedIn app exactly — e.g. `https://dcaevents-production.up.railway.app/api/auth/linkedin/callback` |
| `FRONTEND_URL` | Base URL for frontend links in emails |
| `BACKEND_URL` | Base URL for API |
| `RESEND_API_KEY` | Resend transactional email API key |
| `EMAIL_FROM` | Sending address e.g. `DCAUK <contact@1giglabs.com>` |
| `NODE_ENV` | Set to `production` on Railway — controls pino pretty-printing |
| `LOG_LEVEL` | Pino log level — `info` for production |
| `SENTRY_DSN` | Optional — Sentry error tracking DSN |

> ⚠️ The variable name is `LINKEDIN_REDIRECT_URI` — not `LINKEDIN_CALLBACK_URL`.

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

### Health check
```
GET /health → { "status": "ok", "timestamp": "..." }
```

Use this URL for Railway's uptime monitoring.

### Startup sequence
On every deploy, the server runs:
1. **Drizzle migrations** — applies any pending SQL migrations
2. **Event ingestion** — imports from `events.csv` if present
3. **Express server** — binds to `PORT` (injected by Railway)

---

## Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd DCAUKEvents
npm install
cd frontend && npm install && cd ..

# 2. Environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, LinkedIn credentials, RESEND_API_KEY

# 3. Start backend (port 8080)
npm run dev

# 4. Start frontend (port 5173, proxies /api → port 8080)
cd frontend && npm run dev
```

---

## API Reference

### Auth
| Method | Route | Description |
|---|---|---|
| GET | `/api/auth/linkedin` | Initiate LinkedIn OAuth |
| GET | `/api/auth/linkedin/callback` | OAuth callback — creates/updates user, returns JWT |

### Users
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/users/me` | ✓ | Get logged-in user profile |
| PUT | `/api/users/me` | ✓ | Update own profile |
| GET | `/api/users` | ✓ | Member directory (public fields only, no emails) |

### Events
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | Optional | List all events with current user's RSVP status |
| GET | `/api/events/:id` | Optional | Event detail with attendee list |
| POST | `/api/events` | ✓ | Submit event (auto-approved for organiser/admin) |
| PUT | `/api/events/:id` | Owner/Admin | Update event |
| DELETE | `/api/events/:id` | Owner/Admin | Delete event |
| POST | `/api/events/:id/rsvp` | ✓ | RSVP going or interested |
| DELETE | `/api/events/:id/rsvp` | ✓ | Remove RSVP |
| POST | `/api/events/:id/approve` | Admin | Approve pending event |
| POST | `/api/events/:id/reject` | Admin | Reject pending event |

### Admin
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | List all users with roles |
| GET | `/api/admin/users/:id` | Admin | User detail + RSVP counts |
| POST | `/api/admin/users` | Admin | Manually create user |
| PUT | `/api/admin/users/:id` | Admin | Update any user field |
| PUT | `/api/admin/users/:id/role` | Admin | Update role only |
| DELETE | `/api/admin/users/:id` | Admin | Delete user |

---

## Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| linkedinId | TEXT | Unique — `manual_<uuid>` for manually added users |
| email | TEXT | Unique |
| name | TEXT | |
| headline | TEXT | Job title / role |
| company | TEXT | |
| avatarUrl | TEXT | LinkedIn profile photo URL |
| bio | TEXT | User-editable |
| role | TEXT | `member` \| `organiser` \| `admin` |
| status | TEXT | `active` \| `suspended` |
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
| createdAt / updatedAt | TIMESTAMP | |

---

## Email Notifications

All email is sent via Resend from `EMAIL_FROM`. The following events trigger emails:

| Trigger | Recipients | Template |
|---|---|---|
| User RSVPs going/interested | The user | RSVP confirmation |
| User removes RSVP | The user | RSVP cancellation |
| Admin approves event | All members (batched BCC 50) | New event notification |
| Admin approves event | Event organiser | Approval confirmation |
| Admin rejects event | Event organiser | Rejection notice |

Email failures are caught silently — they log an error but never fail the originating request.

---

## Migrations

Migrations use Drizzle's file-based migrator. To add a new migration:

```bash
# Edit src/db/schema.js first, then:
npx drizzle-kit generate:pg

# The new .sql file appears in src/db/migrations/
# Commit it — Drizzle applies it automatically on next deploy
```

To apply a one-off schema change directly (e.g. in Railway's Postgres query tab):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_column TEXT;
```

---

## LinkedIn OAuth Setup

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Open the **1GigLabs DCAUK Event App** (Client ID: `783moisnkphgha`)
3. **Products tab** — confirm added: Share on LinkedIn, Sign In with LinkedIn using OpenID Connect
4. **Auth tab** — confirm redirect URLs include your deployment URL + `/api/auth/linkedin/callback`
5. Scopes requested: `openid profile email`

---

## Roadmap

### Shipped
- [x] LinkedIn OAuth sign-in with auto-populated profiles
- [x] Events listing with monthly calendar view
- [x] Upcoming / past events split
- [x] Event detail with RSVP (going / interested)
- [x] Add to Calendar (Google + .ics)
- [x] Member directory with search
- [x] Profile page with event history
- [x] Event submission workflow (member → admin approval queue)
- [x] Email notifications (RSVP confirmation, new event alerts, organiser approval/rejection)
- [x] Role-based access (member / organiser / admin)
- [x] Full admin user management (edit, suspend, delete, add manually)
- [x] Zod input validation on all mutating routes
- [x] Structured logging (pino)
- [x] Health check endpoint
- [x] Drizzle migrations replacing hand-rolled SQL

### Next
- [ ] Domain migration to `dcauk.org`
- [ ] Resend domain verification (emails from `@dcauk.org`)
- [ ] News feed
- [ ] Groups / channels
- [ ] Event reminders (email 48hrs before)
- [ ] Training section
- [ ] Student engagement features
