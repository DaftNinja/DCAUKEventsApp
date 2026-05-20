# syntax=docker/dockerfile:1

# ---- Stage 1: Build the React frontend ----
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install frontend dependencies (cached unless package files change)
COPY frontend/package*.json ./
RUN npm install

# Copy source and build static assets
COPY frontend/ ./
RUN npm run build


# ---- Stage 2: Install backend dependencies ----
# Includes devDependencies so drizzle-kit is available for schema push at startup.
FROM node:20-alpine AS backend-deps

WORKDIR /app

COPY package*.json ./
RUN npm install


# ---- Stage 3: Final runtime image ----
FROM node:20-alpine AS runtime

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
ENV NODE_ENV=production

# Backend node_modules (includes drizzle-kit for the startup schema push)
COPY --from=backend-deps /app/node_modules ./node_modules

# Backend source
COPY package*.json ./
COPY src/ ./src/
COPY drizzle.config.* ./

# Startup script: runs drizzle-kit push, then starts the server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Built frontend assets, served as static files by Express
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Drop privileges
USER app

# The port Express listens on (Railway/most hosts inject PORT at runtime)
EXPOSE 8080
ENV PORT=8080

# Basic healthcheck — adjust the path if you have a dedicated /health route
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/ >/dev/null 2>&1 || exit 1

CMD ["./docker-entrypoint.sh"]
