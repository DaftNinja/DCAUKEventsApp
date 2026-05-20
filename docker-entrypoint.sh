#!/bin/sh
set -e

# Sync the Drizzle schema to the database before starting the app.
# Uses drizzle-kit push, matching the local development workflow.
# Note: drizzle-kit 0.20.x uses "push:pg"; newer versions (0.21+) use "push".
echo "==> Syncing database schema with drizzle-kit push:pg..."
npx drizzle-kit push:pg

echo "==> Schema sync complete. Starting server..."
exec node src/index.js