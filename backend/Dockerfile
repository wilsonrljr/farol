# syntax=docker/dockerfile:1.7

ARG PYTHON_VERSION=3.13-slim-trixie
ARG UV_VERSION=0.11.32

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv-bin

# Development target used by docker-compose.yml. The project is editable so a
# bind-mounted backend directory is picked up immediately by uvicorn --reload.
FROM python:${PYTHON_VERSION} AS development
COPY --from=uv-bin /uv /uvx /bin/
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_NO_PROGRESS=1 \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --extra dev
COPY backend ./backend
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --extra dev

FROM development AS test
RUN pytest -q

# Build a non-editable production environment. uv is intentionally absent from
# the final image; the locked virtualenv is the only Python installation layer.
FROM python:${PYTHON_VERSION} AS production-builder
COPY --from=uv-bin /uv /uvx /bin/
ENV UV_LINK_MODE=copy \
    UV_NO_PROGRESS=1 \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-dev --no-editable
COPY backend ./backend
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

FROM python:${PYTHON_VERSION} AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    API_HOST=0.0.0.0 \
    API_PORT=8000
WORKDIR /app
RUN groupadd --system --gid 10001 farol \
    && useradd --system --uid 10001 --gid farol --no-create-home \
        --home-dir /nonexistent --shell /usr/sbin/nologin farol
COPY --from=production-builder --chown=farol:farol /app/.venv /app/.venv

USER farol

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os,urllib.request; port=os.environ.get('API_PORT', os.environ.get('PORT', '8000')); urllib.request.urlopen(f'http://127.0.0.1:{port}/readyz', timeout=3).read()"]

CMD ["python", "-m", "backend.app.main"]
