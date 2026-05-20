#!/bin/sh
set -e

# Sync the Drizzle schema to the database before starting the app.
# Uses drizzle-kit push, matching the local development workflow.
echo "==> Syncing database schema with drizzle-kit push..."
npx drizzle-kit push

echo "==> Schema sync complete. Starting server..."
exec node src/index.js
