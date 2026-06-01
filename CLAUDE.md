# DCA Community Events Platform (UK)

## Commands

```bash
# Backend (Express + Drizzle)
npm run dev                 # start Express server (port 5000)
npm run db:migrate          # run migrations
npm run db:studio           # open Drizzle Studio
npm run seed                # seed database
npm run db:generate         # generate Drizzle types

# Frontend (React + Vite)
cd frontend && npm run dev  # start Vite dev server (port 5173)
cd frontend && npm run build

# Full build (for production)
npm run build               # builds frontend, bundles backend
```

## Architecture

Express.js + Drizzle ORM backend + React Vite frontend (separate directories, shared database).

## Key Decisions

(LinkedIn OAuth flow, event ingestion from CSV, Resend email integration rationale?)

## Domain Knowledge

(RSVP, event discovery, user segments from event metadata?)
