# syntax=docker/dockerfile:1.7

# --- Build Stage ---
FROM node:20-bullseye-slim AS build
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1

# Ensure corepack (for potential future pnpm/yarn) and disable progress noise
RUN corepack enable || true && npm set fund false && npm set audit false

# Install deps separately for better caching
COPY frontend/package*.json ./
ENV CI=1
RUN rm -rf node_modules package-lock.json && npm install --no-audit --no-fund
RUN node -e "try{console.log('Rollup version:',require('rollup/package.json').version)}catch(e){console.log('Rollup não instalado ainda')}" || true

# Copy source
COPY frontend/ ./

# Copy markdown docs needed by frontend (imports like /docs/quickstart.md?raw)
# They live at project root `docs/`; we place them both under /docs (absolute) and /app/docs for safety.
COPY docs /docs
COPY docs ./docs

# Build argument for API base URL (can be overridden at build time)
ARG VITE_API_BASE=http://localhost:8000
ENV VITE_API_BASE=${VITE_API_BASE}

# Run tests if a test script is defined (will succeed if none or tests pass)
RUN if npm run | grep -q "test"; then npm test -- --watch=false || npm test || exit 1; else echo "No test script"; fi

RUN set -eux; \
	if ! npm run build; then \
		echo '--- First build failed; retrying with clean install (keeping lockfile) ---'; \
		rm -rf node_modules; \
		npm ci --no-audit --no-fund || npm install --no-audit --no-fund; \
		npm run build; \
	fi

# --- Runtime Stage ---
FROM nginx:1.27-alpine

# Remove default config and add our own
RUN rm /etc/nginx/conf.d/default.conf || true
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1
