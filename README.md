# DCA Community Events Platform

A community platform for digital infrastructure professionals to discover events, network, and stay informed.

## Architecture

- **Backend**: Node.js + Express + PostgreSQL + Drizzle ORM
- **Frontend**: React 18 + React Router + Vite
- **Auth**: LinkedIn OAuth 2.0
- **Email**: Resend
- **Deployment**: Railway (separate projects for backend and frontend)

## Project Structure

```
dca-community-events/
├── src/                      # Backend
│   ├── index.js             # Express server entry point
│   ├── db/
│   │   ├── index.js         # Database connection
│   │   ├── schema.js        # Drizzle ORM schema
│   │   ├── migrate.js       # Migration runner
│   │   └── seed.js          # Seed script (optional)
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── routes/
│   │   ├── auth.js          # LinkedIn OAuth
│   │   ├── users.js         # User profiles
│   │   └── events.js        # Events and RSVPs
│   └── scripts/
│       └── ingest-events.js # CSV ingestion script
├── frontend/                 # React app
│   ├── src/
│   │   ├── main.jsx         # React entry point
│   │   ├── App.jsx          # Main component
│   │   ├── api.js           # API client
│   │   └── pages/
│   │       ├── HomePage.jsx
│   │       ├── AuthCallback.jsx
│   │       ├── EventsPage.jsx
│   │       ├── EventDetailPage.jsx
│   │       └── ProfilePage.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── package.json
└── README.md
```

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- LinkedIn Developer app (see below)

### Local Development

1. **Clone and install**
   ```bash
   git clone <repo>
   cd dca-community-events
   npm install
   cd frontend && npm install && cd ..
   ```

2. **LinkedIn OAuth Setup**
   - Go to https://www.linkedin.com/developers/apps
   - Create an app or use existing credentials
   - Add redirect URI: `http://localhost:3000/api/auth/linkedin/callback`
   - Copy Client ID and Client Secret

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Fill in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/dca_community
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback
   JWT_SECRET=your_jwt_secret_here_change_in_production
   RESEND_API_KEY=your_resend_api_key
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   BACKEND_URL=http://localhost:5000
   PORT=5000
   ```

4. **Database Setup**
   ```bash
   # Create Drizzle migrations
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

5. **Start Development Servers**
   
   Terminal 1 (Backend):
   ```bash
   npm run dev
   ```
   
   Terminal 2 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```

   Backend: http://localhost:5000
   Frontend: http://localhost:3000

### Ingesting Events

1. **Prepare CSV** with columns:
   ```
   title,description,start_date,end_date,location,is_virtual,event_url,organiser
   ```

   Example:
   ```
   "Data Centre World 2024","Leading conference","2024-06-10T09:00:00Z","2024-06-12T17:00:00Z","London","false","https://example.com","DCA"
   ```

2. **Ingest CSV**
   ```bash
   node src/scripts/ingest-events.js events.csv
   ```

## Deployment to Railway

### Combined Backend + Frontend Setup (Option 3)

This project deploys both frontend and backend as a single Node.js service on Railway.

#### Prerequisites

1. **Railway Account**: https://railway.app
2. **GitHub Repository**: Connected to Railway
3. **PostgreSQL Plugin**: Added to your Railway project
4. **Environment Variables Set** (see below)

#### Step 1: Create Procfile

Create a `Procfile` in the root directory:

```
web: node src/index.js
```

This tells Railway to start the Node.js server (which serves the frontend).

#### Step 2: Configure Railway Build & Start Commands

In your Railway service settings:

**Build Command:**
```
npm install && cd frontend && npm install && npm run build && cd ..
```

This:
1. Installs backend dependencies
2. Installs frontend dependencies
3. Builds the React app to `frontend/dist/`
4. Returns to root directory

**Start Command:**
```
node src/index.js
```

This starts the Express server, which:
- Serves the built frontend from `frontend/dist/`
- Handles all `/api/*` routes
- Falls back to `index.html` for React routing

#### Step 3: Set Environment Variables

In Railway dashboard → Your Service → Variables, add:

```
DATABASE_URL=<auto-populated from PostgreSQL plugin>
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=https://your-railway-url.railway.app/api/auth/linkedin/callback
JWT_SECRET=your-strong-random-secret-change-in-production
RESEND_API_KEY=your_resend_api_key
NODE_ENV=production
FRONTEND_URL=https://your-railway-url.railway.app
BACKEND_URL=https://your-railway-url.railway.app
PORT=8080
```

**Important**: Replace `your-railway-url.railway.app` with your actual Railway domain.

#### Step 4: Connect PostgreSQL

If not already connected:

1. Click **+ Add** in your Railway project
2. Select **PostgreSQL**
3. Railway auto-injects `DATABASE_URL`
4. Run migrations (see below)

#### Step 5: Run Database Migrations

After first deploy, run migrations via Railway shell:

```bash
# In Railway dashboard, open your service
# Click "Connect" → Open Shell
npm run db:migrate
```

Or run locally and push:

```bash
DATABASE_URL=your_url npm run db:migrate
```

#### Step 6: Deploy

1. Push to GitHub:
   ```bash
   git add Procfile
   git commit -m "Add Procfile for Railway deployment"
   git push origin main
   ```

2. Railway auto-detects the push and rebuilds

3. Once deployed, visit: `https://your-railway-url.railway.app`

### How It Works

- **Frontend**: Built as static files to `frontend/dist/`
- **Backend**: Express server serves frontend + API
- **API Calls**: Frontend makes requests to `/api/*`, which routes to backend endpoints
- **Routing**: Express fallback routes React requests to `index.html` for client-side routing

### Testing the Deployment

1. **Check backend health:**
   ```bash
   curl https://your-railway-url.railway.app/health
   ```
   Should return: `{"status":"ok"}`

2. **Test OAuth flow:**
   - Visit `https://your-railway-url.railway.app`
   - Click "Sign in with LinkedIn"
   - Should redirect to LinkedIn, then back to `/events`

3. **Check logs:**
   - Railway dashboard → Deployments → View logs
   - Look for "✓ Database connected" and "✓ Server running on port 8080"

### Troubleshooting

**Build fails with "Could not resolve App.css"**
- Ensure `frontend/src/App.jsx` does NOT have `import './App.css';`
- Push the fix and rebuild

**"Cannot connect to database"**
- Verify `DATABASE_URL` is set in Variables
- Check PostgreSQL plugin is added to project
- Run migrations: `npm run db:migrate`

**LinkedIn OAuth not working**
- Verify `LINKEDIN_REDIRECT_URI` matches your Railway URL exactly
- Check Client ID and Secret are correct
- Make sure "Sign In with LinkedIn" is approved in your LinkedIn app

**Port conflicts**
- Railway assigns port dynamically; `src/index.js` reads `PORT` env var
- Default fallback: port 8080

### Domain Migration (community.1giglabs.com → dcauk.org)

1. Update DNS to point to Railway
2. Update `LINKEDIN_REDIRECT_URI` environment variable:
   ```
   https://your-new-domain.com/api/auth/linkedin/callback
   ```
3. Update `FRONTEND_URL` and `BACKEND_URL` variables
4. Redeploy on Railway

---

## API Endpoints

### Authentication
- `GET /api/auth/linkedin` - Redirect to LinkedIn
- `GET /api/auth/linkedin/callback` - OAuth callback handler

### Users
- `GET /api/users/me` - Get current user (requires auth)
- `PUT /api/users/me` - Update user profile (requires auth)

### Events
- `GET /api/events` - List all events (optional filters: startDate, endDate, organiser)
- `GET /api/events/:id` - Get event details with attendee list
- `POST /api/events/:id/rsvp` - RSVP to event (requires auth)
- `DELETE /api/events/:id/rsvp` - Remove RSVP (requires auth)

## Database Schema

### users
- `id` (UUID, PK)
- `linkedin_id` (varchar, unique)
- `email` (varchar, unique)
- `name` (varchar)
- `headline` (varchar, nullable)
- `company` (varchar, nullable)
- `avatar_url` (text, nullable)
- `bio` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### events
- `id` (UUID, PK)
- `title` (varchar)
- `description` (text, nullable)
- `start_date` (timestamp)
- `end_date` (timestamp, nullable)
- `location` (varchar, nullable)
- `is_virtual` (boolean, default false)
- `organiser` (varchar, default 'DCA')
- `event_url` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### rsvps
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `event_id` (UUID, FK → events)
- `status` (varchar, 'interested' or 'going')
- `created_at` (timestamp)
- Unique constraint: (user_id, event_id)

## Features (MVP)

✅ LinkedIn OAuth signin with auto-populated profiles
✅ Event listing and filtering
✅ Event detail page with attendee list
✅ RSVP functionality (interested / going)
✅ User profiles with optional bio/headline/company
✅ CSV event ingestion

## Next Steps (Phase 2)

- [ ] Email reminders for events
- [ ] Push notifications
- [ ] News/feed aggregation
- [ ] Groups and channels
- [ ] User following/messaging
- [ ] Surveys and polls
- [ ] Training/courses section
- [ ] Student/apprentice board

## Troubleshooting

### Database Connection Failed
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Verify credentials

### LinkedIn OAuth Error
- Verify `LINKEDIN_REDIRECT_URI` matches your app's registered URI
- Check Client ID and Secret are correct
- Ensure email scope is included

### Port Already in Use
- Backend: `lsof -i :5000` to find process
- Frontend: `lsof -i :3000`

## License

MIT
# Rebuild trigger
