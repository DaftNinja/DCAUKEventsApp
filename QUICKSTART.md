# Quick Start Guide

## 1. LinkedIn OAuth Setup (5 mins)

1. Go to https://www.linkedin.com/developers/apps
2. Click **Create app**
3. Fill in:
   - App name: "DCA Community Events"
   - LinkedIn page: Create a basic page if needed
   - App logo: Any image
4. Accept terms, create
5. Go to **Auth** tab
6. Add redirect URIs:
   - `http://localhost:3000/api/auth/linkedin/callback` (local dev)
   - `https://community.1giglabs.com/api/auth/linkedin/callback` (production)
7. **Request Sign In with LinkedIn access** (if not already enabled)
8. Copy **Client ID** and **Client Secret**

## 2. Local Setup (10 mins)

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Copy env template
cp .env.example .env

# Edit .env with your credentials:
# - LINKEDIN_CLIENT_ID
# - LINKEDIN_CLIENT_SECRET
# - JWT_SECRET (any random string for local dev)
# - DATABASE_URL (see step 3)
```

## 3. Database Setup (5 mins)

**Option A: Use Railway PostgreSQL (recommended for dev)**

1. Go to https://railway.app
2. Create free account
3. Create new project → Add PostgreSQL
4. Copy the connection string
5. Paste into `.env` as `DATABASE_URL`

**Option B: Local PostgreSQL**

```bash
# Create database locally
createdb dca_community

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://localhost:5432/dca_community
```

## 4. Run Migrations

```bash
npm run db:generate   # Generate migration files
npm run db:migrate    # Run migrations
```

## 5. Start Development

**Terminal 1 (Backend)**
```bash
npm run dev
# Backend running on http://localhost:5000
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm run dev
# Frontend running on http://localhost:3000
```

## 6. Test OAuth

1. Go to http://localhost:3000
2. Click **Sign in with LinkedIn**
3. Authorize
4. You should land on `/events` (empty initially)

## 7. Add Test Events

Create a CSV file `events.csv`:
```
title,description,start_date,end_date,location,is_virtual,event_url,organiser
"Data Centre World 2024","Annual conference on data centre innovation","2024-06-10T09:00:00Z","2024-06-12T17:00:00Z","London ExCeL","false","https://www.datacentreworld.com","DCA"
"Network Operations Summit","Virtual roundtable on network automation","2024-07-15T14:00:00Z","2024-07-15T16:00:00Z","","true","https://example.com/summit","DCA"
```

Then ingest:
```bash
node src/scripts/ingest-events.js events.csv
```

Refresh http://localhost:3000/events and you'll see the events.

## 8. Deployment Checklist

Before deploying to Railway:

- [ ] LinkedIn OAuth redirect URIs updated
- [ ] Environment variables set in Railway dashboard
- [ ] Database migrations run on Railway instance
- [ ] Frontend and backend both deploying successfully
- [ ] Custom domain configured (community.1giglabs.com → Railway)

## Common Issues

**"Unauthorized" on every request**
- Check that `LINKEDIN_REDIRECT_URI` in `.env` matches your OAuth callback URL exactly

**Database connection fails**
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Try connecting with a PostgreSQL client (pgAdmin, DBeaver) to verify

**"Cannot GET /events" after OAuth**
- Ensure backend is running on port 5000
- Check CORS is enabled (should be by default)

**Events not showing**
- Run `npm run db:migrate` to ensure schema is created
- Run `node src/scripts/ingest-events.js events.csv` to add test data

## Next: Phase 2

Once MVP is live and stable, add:
- Email reminders (Resend integration)
- News feed aggregation
- Groups and messaging
- User following

---

Questions? Check the main README.md
