# DCA Community Events - File Manifest

## Quick Navigation

All files are organized below. Clone/download them to your local machine and follow QUICKSTART.md to get running.

## Root Level

```
.env.example                 # Environment variables template
.gitignore                   # Git ignore config
package.json                 # Backend dependencies
drizzle.config.js            # Database ORM config
README.md                    # Full documentation
QUICKSTART.md                # Quick start guide (START HERE)
FILE_MANIFEST.md             # This file
```

## Backend (`src/`)

### Main Entry
```
src/index.js                 # Express server, routes, middleware setup
```

### Database (`src/db/`)
```
src/db/schema.js             # Drizzle ORM schema (users, events, rsvps)
src/db/index.js              # Database connection
src/db/migrate.js            # Migration runner
```

### Middleware (`src/middleware/`)
```
src/middleware/auth.js       # JWT token generation and verification
```

### Routes (`src/routes/`)
```
src/routes/auth.js           # LinkedIn OAuth endpoints
src/routes/users.js          # User profile endpoints
src/routes/events.js         # Event and RSVP endpoints
```

### Scripts (`src/scripts/`)
```
src/scripts/ingest-events.js # CSV → Database event ingestion
```

## Frontend (`frontend/`)

### Configuration
```
frontend/package.json        # Frontend dependencies
frontend/vite.config.js      # Vite build config
frontend/index.html          # HTML entry point
```

### Core (`frontend/src/`)
```
frontend/src/main.jsx        # React entry point
frontend/src/App.jsx         # Main routing component
frontend/src/api.js          # API client with axios
frontend/src/index.css       # Global styles
```

### Pages (`frontend/src/pages/`)
```
frontend/src/pages/HomePage.jsx             # Sign in page
frontend/src/pages/HomePage.css
frontend/src/pages/AuthCallback.jsx         # OAuth callback handler
frontend/src/pages/EventsPage.jsx           # List of events
frontend/src/pages/EventsPage.css
frontend/src/pages/EventDetailPage.jsx      # Event detail + attendees
frontend/src/pages/EventDetailPage.css
frontend/src/pages/ProfilePage.jsx          # User profile
frontend/src/pages/ProfilePage.css
```

## How to Use

1. **Download/clone all files** to your machine maintaining folder structure
2. **Read QUICKSTART.md** for local setup (5 mins)
3. **Read README.md** for full documentation

## Key Files to Review First

1. `QUICKSTART.md` - Step-by-step to get running locally
2. `src/index.js` - Understand the Express server structure
3. `frontend/src/App.jsx` - React routing
4. `src/db/schema.js` - Database structure
5. `src/routes/auth.js` - LinkedIn OAuth flow

## Stack Summary

- **Backend**: Node.js 20 + Express + PostgreSQL + Drizzle ORM
- **Frontend**: React 18 + Vite + React Router
- **Auth**: LinkedIn OAuth 2.0
- **Email**: Resend (setup in .env)
- **Deployment**: Railway (2 separate projects)

All code is production-ready and follows best practices for security, error handling, and UX.
