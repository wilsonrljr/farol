# syntax=docker/dockerfile:1.7

# --- Build Stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps separately for better caching
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source
COPY frontend/ ./

# Copy markdown docs needed by frontend (imports like /docs/quickstart.md?raw)
# They live at project root `docs/`; we place them both under /docs (absolute) and /app/docs for safety.
COPY docs /docs
COPY docs ./docs

# Build argument for API base URL (can be overridden at build time)
ARG VITE_API_BASE=http://localhost:8000
ENV VITE_API_BASE=${VITE_API_BASE}

RUN npm run build

# --- Runtime Stage ---
FROM nginx:1.27-alpine

# Remove default config and add our own
RUN rm /etc/nginx/conf.d/default.conf || true
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1
