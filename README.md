# DCA Community Events Platform

A community platform for digital infrastructure professionals to discover events, RSVP, and see who else is attending.

**Working domain:** `community.1giglabs.com`  
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
| Deployment | Railway (single service — Express serves built React as static files) |

---

## Project Structure

```
dca-community-events/
├── src/                          # Backend
│   ├── index.js                  # Express server entry point
│   ├── db/
│   │   ├── index.js              # Database connection
│   │   ├── schema.js             # Drizzle ORM schema (users, events, rsvps)
│   │   └── migrate.js            # Migration runner
│   ├── middleware/
│   │   └── auth.js               # JWT generation & verification
│   ├── routes/
│   │   ├── auth.js               # LinkedIn OAuth flow
│   │   ├── users.js              # User profile endpoints
│   │   └── events.js             # Events + RSVP endpoints
│   └── scripts/
│       └── ingest-events.js      # CSV → database event ingestion
├── frontend/                     # React app
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx               # Routing
│   │   ├── api.js                # Axios API client
│   │   └── pages/
│   │       ├── HomePage.jsx      # Sign-in landing page
│   │       ├── AuthCallback.jsx  # OAuth callback handler
│   │       ├── EventsPage.jsx    # Event listing
│   │       ├── EventDetailPage.jsx
│   │       └── ProfilePage.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── drizzle.config.js
├── package.json
├── QUICKSTART.md
└── README.md
```

---

## Environment Variables

All variables are set in Railway (or a local `.env` file for development).

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Secret for signing JWTs | Any long random string |
| `LINKEDIN_CLIENT_ID` | From LinkedIn Developer app | `783moisnkphgha` |
| `LINKEDIN_CLIENT_SECRET` | From LinkedIn Developer app | *(from Auth tab)* |
| `LINKEDIN_REDIRECT_URI` | Must match LinkedIn app exactly | `https://your-app.railway.app/api/auth/linkedin/callback` |
| `FRONTEND_URL` | Used to redirect after auth | `https://your-app.railway.app` |
| `BACKEND_URL` | Base URL for API | `https://your-app.railway.app` |
| `RESEND_API_KEY` | For transactional email | `re_...` |

> ⚠️ **Important:** The variable name is `LINKEDIN_REDIRECT_URI` — not `LINKEDIN_CALLBACK_URL`. Using the wrong name is a common gotcha.

---

## LinkedIn OAuth Setup

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Open the **1GigLabs DCAUK Event App** (Client ID: `783moisnkphgha`)
3. **Products tab** — confirm these three are added:
   - Share on LinkedIn
   - Events Management API
   - Sign In with LinkedIn using OpenID Connect
4. **Auth tab** — confirm redirect URLs include:
   - `https://dca-community-events-prod.up.railway.app/api/auth/linkedin/callback`
5. The OAuth flow requests scopes: `openid profile email`

---

## Railway Deployment

This is a **single Railway service** — Express serves the built React app as static files.

### Build command
```
npm install && cd frontend && npm install && npm run build && cd ..
```

### Start command
```
node src/index.js
```

### Required Railway environment variables
Set all variables from the table above in the Railway **Variables** tab.

---

## Local Development

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd dca-community-events

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your values

# 4. Run database migrations
node src/db/migrate.js

# 5. Start the backend (port 3000)
npm run dev

# 6. Start the frontend (port 5173, proxies API to port 3000)
cd frontend && npm run dev
```

Access the app at `http://localhost:5173`

---

## Event Ingestion

Events are loaded from a CSV file using the ingestion script.

### CSV format

```csv
title,description,start_date,end_date,location,is_virtual,organiser,event_url
"DCA Annual Conference","Description here","2026-09-15 09:00:00","2026-09-15 17:00:00","London",false,"DCA","https://example.com"
```

### Running the script

```bash
node src/scripts/ingest-events.js path/to/events.csv
```

---

## API Routes

### Auth
| Method | Route | Description |
|---|---|---|
| GET | `/api/auth/linkedin` | Initiate LinkedIn OAuth |
| GET | `/api/auth/linkedin/callback` | OAuth callback — creates/updates user, returns JWT |

### Users
| Method | Route | Description |
|---|---|---|
| GET | `/api/users/me` | Get logged-in user profile |
| PUT | `/api/users/me` | Update bio |

### Events
| Method | Route | Description |
|---|---|---|
| GET | `/api/events` | List all events |
| GET | `/api/events/:id` | Event detail |
| POST | `/api/events/:id/rsvp` | RSVP (interested / going) |
| DELETE | `/api/events/:id/rsvp` | Remove RSVP |
| GET | `/api/events/:id/attendees` | List attendees |

---

## Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| linkedin_id | VARCHAR | Unique, from LinkedIn |
| email | VARCHAR | From LinkedIn |
| name | VARCHAR | From LinkedIn |
| headline | VARCHAR | Job title |
| company | VARCHAR | |
| avatar_url | TEXT | LinkedIn profile photo |
| bio | TEXT | User-editable |
| created_at / updated_at | TIMESTAMP | |

### events
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | VARCHAR | |
| description | TEXT | |
| start_date / end_date | TIMESTAMP | |
| location | VARCHAR | Null if virtual |
| is_virtual | BOOLEAN | |
| organiser | VARCHAR | e.g. "DCA" |
| event_url | TEXT | Link to event page |

### rsvps
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| event_id | UUID | FK → events |
| status | VARCHAR | `interested` or `going` |
| created_at | TIMESTAMP | |

---

## Known Issues & Fixes

| Issue | Fix |
|---|---|
| `jsonwebtoken` install error | Use version `^9.0.2` in package.json |
| Railway build fails (Railpack can't detect Node) | Ensure files are at repo root, not in a subdirectory |
| LinkedIn "application is disabled" error | Check `LINKEDIN_REDIRECT_URI` env var name — not `LINKEDIN_CALLBACK_URL` |
| LinkedIn redirect URI mismatch | Ensure `LINKEDIN_REDIRECT_URI` value exactly matches what's registered in LinkedIn Auth tab |

---

## Roadmap

**MVP (current)**
- [x] LinkedIn OAuth sign-in
- [x] Event listing
- [x] RSVP (interested / going)
- [x] Attendee list per event
- [x] User profile (auto-populated from LinkedIn)
- [x] CSV event ingestion

**Phase 2**
- [ ] Email reminders (Resend + cron)
- [ ] News feed aggregation
- [ ] Groups / channels
- [ ] Following / connections
- [ ] Training section
- [ ] Student engagement features
- [ ] Migration to `dcauk.org`
