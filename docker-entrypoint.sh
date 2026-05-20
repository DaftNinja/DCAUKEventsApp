#!/bin/sh
set -e
 
# Diagnostic: confirm DATABASE_URL is visible to this process WITHOUT printing
# the secret. Prints only whether it's set and its length.
if [ -n "$DATABASE_URL" ]; then
  echo "==> DATABASE_URL is set (length: ${#DATABASE_URL})."
else
  echo "==> WARNING: DATABASE_URL is NOT set in this environment."
fi
 
# Sync the Drizzle schema to the database before starting the app.
# Uses drizzle-kit push, matching the local development workflow.
# Requires drizzle-kit 0.21+ (the version your drizzle.config.js is written for).
echo "==> Syncing database schema with drizzle-kit push..."
npx drizzle-kit push
 
echo "==> Schema sync complete. Starting server..."
exec node src/index.js