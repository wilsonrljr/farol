# syntax=docker/dockerfile:1.7

# --- Build Stage ---
FROM node:22-bookworm-slim AS build
# Mirror the repository layout so Vite resolves ../docs identically in local,
# Compose and image builds.
WORKDIR /workspace/frontend

# Keep dependency installation quiet and resilient to transient registry errors.
RUN npm set fund false \
	&& npm set audit false \
	&& npm set fetch-retries 5 \
	&& npm set fetch-retry-mintimeout 20000 \
	&& npm set fetch-retry-maxtimeout 120000

# Install deps separately for better caching
COPY frontend/package*.json ./
ENV CI=1
RUN npm ci --no-audit --no-fund

# Copy source
COPY frontend/ ./

# Copy markdown docs imported by the documentation routes.
COPY docs /workspace/docs

# Empty means same-origin. It can still be overridden at build time for an
# explicitly cross-origin deployment.
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

RUN npm run build

# --- Runtime Stage ---
FROM nginx:1.28.3-alpine

# The master process runs as nginx on an unprivileged port. Its pid and all
# temporary paths live under /tmp, allowing a read-only root filesystem.
RUN rm /etc/nginx/conf.d/default.conf \
	&& sed -i 's#^pid .*#pid /tmp/nginx.pid;#; /^user /d' /etc/nginx/nginx.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets
COPY --from=build --chown=nginx:nginx /workspace/frontend/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/readyz || exit 1

# The image is immutable and does not use template/env substitution at runtime.
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
