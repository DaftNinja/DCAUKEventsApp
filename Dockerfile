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


# ---- Stage 2: Install backend production dependencies ----
FROM node:20-alpine AS backend-deps

WORKDIR /app

# Only production deps for the final image
COPY package*.json ./
RUN npm install --omit=dev


# ---- Stage 3: Final runtime image ----
FROM node:20-alpine AS runtime

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
ENV NODE_ENV=production

# Backend production node_modules
COPY --from=backend-deps /app/node_modules ./node_modules

# Backend source
COPY package*.json ./
COPY src/ ./src/
COPY drizzle.config.* ./
# Migrations / schema folder used by Drizzle (safe no-op if absent at build,
# but include it so `drizzle-kit migrate` can run in the container)
COPY drizzle/ ./drizzle/

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

CMD ["node", "src/index.js"]
